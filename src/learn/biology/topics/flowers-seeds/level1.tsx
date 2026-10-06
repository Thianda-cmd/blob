"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { FlowerDispersal, FlowerFruitPicture } from "@/learn/biology/visuals/FlowerDispersal";
import { FlowerPollination } from "@/learn/biology/visuals/FlowerPollination";
import { FlowerSection, FlowerSectionExplore } from "@/learn/biology/visuals/FlowerSection";
import { FlowerToFruit } from "@/learn/biology/visuals/FlowerToFruit";
import { ASK_PARTS, CHAIN1, DISPERSAL, JOB_PARTS, MODES, PARTS, plantById, type DispersalPlant, type Mode, type PartId } from "./data";
import { cap, capT, choice, de, en, join, multi, q, some, visual, type MultiOpt, type MultiSlip, type Opt } from "./kit";

// Level 1 (Einsteiger, Klasse 5–6): the parts of the cherry blossom, pollination vs
// fertilisation, from flower to fruit, and how fruits and seeds are spread.

// ---------------------------------------------------------------------------
// What is this part called? (picture)

const nameOf = (id: PartId) => PARTS[id].name;

function wrongPart(other: PartId): Opt {
  const p = PARTS[other];
  return {
    text: capT(p.name),
    title: tx(`${cap(en(p.name))}?`, `${de(p.name)}?`),
    say: tx(`Not quite. ${en(p.where)} Look again where the marked part sits.`, `Nicht ganz. ${de(p.where)} Schau noch mal, wo der markierte Teil sitzt.`),
  };
}

function others(rng: Rng, id: PartId, n: number): PartId[] {
  const near = PARTS[id].confused.filter((c) => ASK_PARTS.includes(c));
  const rest = rng.shuffle(ASK_PARTS.filter((p) => p !== id && !near.includes(p)));
  return [...near, ...rest].slice(0, n);
}

function partSolution(id: PartId): Frame[] {
  const p = PARTS[id];
  return [
    { math: q(p.name, "a"), note: p.where },
    { math: join(q(p.name, "a"), ":", q(p.job, "j")), note: tx(`Its job: it ${en(p.job)}.`, `Aufgabe: ${cap(de(p.job))}.`), highlight: ["j"] },
  ];
}



export function nameTask(rng: Rng, fixed?: PartId): Exercise {
  const id = fixed ?? rng.pick(ASK_PARTS);
  const { answer, mistakes } = choice(rng, [{ text: capT(nameOf(id)) }, ...others(rng, id, 3).map(wrongPart)]);
  return {
    instruction: tx("Name the part", "Benenne den Blütenteil"),
    text: tx("What is the part marked with **?** called?", "Wie heißt der Teil, der mit **?** markiert ist?"),
    visual: visual(FlowerSection, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Start from the outside: sepals, petals, stamens, and the pistil in the very middle.", "Geh von außen nach innen: Kelchblätter, Kronblätter, Staubblätter und ganz in der Mitte der Stempel."),
    solution: partSolution(id),
    mistakes,
  };
}

const WORD_ALT: Partial<Record<PartId, Text[]>> = {
  sepal: [tx("sepals", "Kelchblätter"), "Kelch"],
  petal: [tx("petals", "Kronblätter"), tx("flower petal", "Blütenblatt"), "Blütenblätter"],
  anther: [tx("anthers", "Staubbeutel"), "Anthere"],
  filament: [tx("filaments", "Staubfäden")],
  stigma: [tx("stigmas", "Narben")],
  style: [tx("styles", "Griffel")],
  ovary: [tx("ovaries", "Fruchtknoten")],
  ovule: [tx("ovules", "Samenanlagen")],
  receptacle: [tx("flower base", "Blütenbecher")],
};
const WORD_PARTS: PartId[] = ["sepal", "petal", "anther", "filament", "stigma", "style", "ovary", "ovule", "receptacle"];

export function nameWordTask(rng: Rng, fixed?: PartId): Exercise {
  const id = fixed ?? rng.pick(WORD_PARTS);
  const mistakes: Mistake[] = PARTS[id].confused.map((o) => {
    const w = wrongPart(o);
    return { when: { kind: "word", accept: [PARTS[o].name, ...(WORD_ALT[o] ?? [])] }, title: w.title, say: w.say! };
  });
  return {
    instruction: tx("Name the part", "Benenne den Blütenteil"),
    text: tx("Type the name of the part marked with **?**.", "Schreib den Namen des Teils auf, der mit **?** markiert ist."),
    visual: visual(FlowerSection, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer: { kind: "word", accept: [nameOf(id), ...(WORD_ALT[id] ?? [])], placeholder: tx("name of the part", "Name des Blütenteils") },
    hint: tx("Is it on the outside, a stamen, or part of the pistil in the middle?", "Liegt der Teil außen, gehört er zum Staubblatt oder zum Stempel in der Mitte?"),
    solution: partSolution(id),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Part → job

type JobSlip = { part: PartId; jobOf: PartId; title: Text; say: Text };
const JOB_SLIPS: JobSlip[] = [
  {
    part: "anther",
    jobOf: "stigma",
    title: tx("Making vs catching", "Bilden oder auffangen"),
    say: tx("Swapped! The anther **makes** the pollen. Catching pollen is the job of the female part in the middle.", "Vertauscht! Der Staubbeutel **bildet** den Pollen. Auffangen macht der weibliche Teil in der Mitte."),
  },
  {
    part: "stigma",
    jobOf: "anther",
    title: tx("Making vs catching", "Bilden oder auffangen"),
    say: tx("The stigma doesn't make pollen, it **catches** it. Pollen comes from the stamens.", "Die Narbe bildet keinen Pollen, sie **fängt** ihn auf. Pollen kommt aus den Staubblättern."),
  },
  {
    part: "petal",
    jobOf: "sepal",
    title: tx("Petal or sepal?", "Kronblatt oder Kelchblatt?"),
    say: tx("The small green sepals protect the bud. The big coloured petals have another job: think of the bees.", "Die kleinen grünen Kelchblätter schützen die Knospe. Die großen bunten Kronblätter haben eine andere Aufgabe: Denk an die Bienen."),
  },
  {
    part: "ovary",
    jobOf: "ovule",
    title: tx("Ovary or ovule?", "Fruchtknoten oder Samenanlage?"),
    say: tx("Close, but the egg cell lies in the **ovule**, and the ovule becomes the seed. The whole ovary becomes the fruit.", "Knapp: Die Eizelle liegt in der **Samenanlage**, und die wird zum Samen. Der ganze Fruchtknoten wird zur Frucht."),
  },
  {
    part: "ovule",
    jobOf: "ovary",
    title: tx("Ovary or ovule?", "Fruchtknoten oder Samenanlage?"),
    say: tx("The ovule becomes the **seed**. The fruit grows from the whole ovary around it.", "Die Samenanlage wird zum **Samen**. Die Frucht entsteht aus dem ganzen Fruchtknoten drumherum."),
  },
  {
    part: "style",
    jobOf: "filament",
    title: tx("Two kinds of stalks", "Zwei Arten von Stielen"),
    say: tx("Both are stalks! But the style is in the middle and carries the stigma. The anthers sit on the filaments.", "Beides sind Stiele! Aber der Griffel steht in der Mitte und trägt die Narbe. Die Staubbeutel sitzen auf den Staubfäden."),
  },
  {
    part: "petal",
    jobOf: "nectar",
    title: tx("Colour vs reward", "Farbe oder Belohnung"),
    say: tx("Petals attract insects with colour, but the sweet reward is the nectar.", "Kronblätter locken mit Farbe an, die süße Belohnung ist aber der Nektar."),
  },
];

export function jobMatchTask(rng: Rng): Exercise {
  let set: PartId[] = [];
  for (let i = 0; i < 20; i++) {
    set = some(rng, JOB_PARTS, 4);
    if (set.some((p) => PARTS[p].group === "male") && set.some((p) => PARTS[p].group === "female")) break;
  }
  const extra = rng.chance(0.5) ? rng.pick(JOB_PARTS.filter((p) => !set.includes(p))) : null;
  const pairs: [Text, Text][] = set.map((p) => [capT(PARTS[p].name), PARTS[p].job]);
  const mistakes: Mistake[] = JOB_SLIPS.filter((s) => set.includes(s.part) && (set.includes(s.jobOf) || s.jobOf === extra))
    .slice(0, 3)
    .map((s) => ({ when: { kind: "match", pairs: [[capT(PARTS[s.part].name), PARTS[s.jobOf].job]] }, title: s.title, say: s.say }));
  return {
    instruction: tx("Match each part with its job", "Ordne jedem Blütenteil seine Aufgabe zu"),
    text: tx("What does each part of the flower do?", "Was macht welcher Teil der Blüte?"),
    answer: { kind: "match", pairs, ...(extra ? { distractors: [PARTS[extra].job] } : {}) },
    hint: tx("Male parts make pollen, female parts catch it and make seeds. Petals and nectar are for the insects.", "Männliche Teile bilden Pollen, weibliche fangen ihn auf und bilden Samen. Kronblätter und Nektar sind für die Insekten."),
    solution: [
      {
        math: tx(set.map((p, i) => `"${cap(en(PARTS[p].name))}:"#n${i} "${en(PARTS[p].job)}"#j${i}`).join(" \\\\ "), set.map((p, i) => `"${de(PARTS[p].name)}:"#n${i} "${de(PARTS[p].job)}"#j${i}`).join(" \\\\ ")),
        note: tx("Each part has exactly one job.", "Jeder Teil hat genau eine Aufgabe."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Which parts belong together? (select all)

type Group = { ask: Text; yes: PartId[]; no: PartId[]; slips: { pick: PartId[]; title: Text; say: Text }[]; note: Text };

const GROUPS: Group[] = [
  {
    ask: tx("Which parts belong to the **pistil**?", "Welche Teile gehören zum **Stempel**?"),
    yes: ["stigma", "style", "ovary"],
    no: ["anther", "filament", "petal", "sepal", "receptacle"],
    slips: [
      {
        pick: ["stigma", "style"],
        title: tx("Not the whole pistil", "Nicht der ganze Stempel"),
        say: tx("The pistil goes all the way down: the thick part at the bottom belongs to it too.", "Der Stempel reicht bis ganz nach unten: Auch der dicke Teil unten gehört dazu."),
      },
      {
        pick: ["stigma", "style", "ovary", "filament"],
        title: tx("Filament or style?", "Staubfaden oder Griffel?"),
        say: tx("The filament looks like the style, but it carries an anther. It belongs to the stamen.", "Der Staubfaden sieht aus wie der Griffel, trägt aber einen Staubbeutel. Er gehört zum Staubblatt."),
      },
      {
        pick: ["stigma", "style", "ovary", "anther"],
        title: tx("Anthers are male", "Staubbeutel sind männlich"),
        say: tx("Anthers make pollen: they belong to the stamens, not to the pistil.", "Staubbeutel bilden Pollen: Sie gehören zu den Staubblättern, nicht zum Stempel."),
      },
    ],
    note: tx("The pistil (carpel) consists of stigma, style and ovary.", "Der Stempel (das Fruchtblatt) besteht aus Narbe, Griffel und Fruchtknoten."),
  },
  {
    ask: tx("Which parts belong to a **stamen**?", "Welche Teile gehören zu einem **Staubblatt**?"),
    yes: ["anther", "filament"],
    no: ["stigma", "style", "ovary", "sepal", "petal"],
    slips: [
      {
        pick: ["anther"],
        title: tx("The stalk too", "Der Stiel gehört dazu"),
        say: tx("The anther doesn't float in the air: the stalk that carries it is part of the stamen too.", "Der Staubbeutel schwebt nicht in der Luft: Auch der Stiel, der ihn trägt, gehört zum Staubblatt."),
      },
      {
        pick: ["anther", "filament", "style"],
        title: tx("Style or filament?", "Griffel oder Staubfaden?"),
        say: tx("The style is the stalk in the middle that carries the stigma. It's part of the female pistil.", "Der Griffel ist der Stiel in der Mitte, der die Narbe trägt. Er gehört zum weiblichen Stempel."),
      },
      {
        pick: ["anther", "filament", "stigma"],
        title: tx("The stigma is female", "Die Narbe ist weiblich"),
        say: tx("The stigma only catches pollen. It belongs to the pistil.", "Die Narbe fängt den Pollen nur auf. Sie gehört zum Stempel."),
      },
    ],
    note: tx("A stamen is an anther on a filament. The anther makes the pollen.", "Ein Staubblatt ist ein Staubbeutel auf einem Staubfaden. Der Staubbeutel bildet den Pollen."),
  },
  {
    ask: tx("Which are the **female** parts of the flower?", "Welche Teile der Blüte sind **weiblich**?"),
    yes: ["stigma", "style", "ovary", "ovule"],
    no: ["anther", "filament", "pollen", "petal"],
    slips: [
      {
        pick: ["stigma", "style", "ovary", "ovule", "petal"],
        title: tx("Petals are neither", "Kronblätter sind weder noch"),
        say: tx("Petals are neither male nor female. They only attract insects.", "Kronblätter sind weder männlich noch weiblich. Sie locken nur Insekten an."),
      },
      {
        pick: ["stigma", "style", "ovary", "ovule", "pollen"],
        title: tx("Pollen is male", "Pollen ist männlich"),
        say: tx("Pollen lands on the stigma, but it comes from the stamens: it's male.", "Pollen landet zwar auf der Narbe, kommt aber aus den Staubblättern: Er ist männlich."),
      },
    ],
    note: tx("Female: the pistil (stigma, style, ovary) with the ovule and its egg cell.", "Weiblich: der Stempel (Narbe, Griffel, Fruchtknoten) mit der Samenanlage und ihrer Eizelle."),
  },
  {
    ask: tx("Which are the **male** parts of the flower?", "Welche Teile der Blüte sind **männlich**?"),
    yes: ["anther", "filament", "pollen"],
    no: ["stigma", "style", "ovule", "sepal"],
    slips: [
      {
        pick: ["anther", "filament", "pollen", "stigma"],
        title: tx("The stigma is female", "Die Narbe ist weiblich"),
        say: tx("The stigma catches the pollen, but it's part of the female pistil.", "Die Narbe fängt den Pollen auf, gehört aber zum weiblichen Stempel."),
      },
      {
        pick: ["anther", "filament", "pollen", "style"],
        title: tx("Style or filament?", "Griffel oder Staubfaden?"),
        say: tx("The style is the stalk of the pistil, the female part in the middle.", "Der Griffel ist der Stiel des Stempels, also des weiblichen Teils in der Mitte."),
      },
    ],
    note: tx("Male: the stamens (anther and filament) and the pollen they make.", "Männlich: die Staubblätter (Staubbeutel und Staubfaden) und der Pollen, den sie bilden."),
  },
];

export function groupTask(rng: Rng, fixed?: number): Exercise {
  const g = GROUPS[fixed ?? rng.int(0, GROUPS.length - 1)];
  const no = some(rng, g.no, rng.int(2, 3));
  // Keep slips whose wrong parts are on offer.
  const ids: PartId[] = [...g.yes, ...no];
  const slipParts = g.slips.flatMap((s) => s.pick.filter((p) => !g.yes.includes(p)));
  for (const p of slipParts) if (!ids.includes(p) && ids.length < 7 && rng.chance(0.6)) ids.push(p);
  const opts: MultiOpt[] = ids.map((id) => ({ text: capT(PARTS[id].name), ok: g.yes.includes(id) }));
  const slips: MultiSlip[] = g.slips.filter((s) => s.pick.every((p) => ids.includes(p))).map((s) => ({ pick: s.pick.map((p) => ids.indexOf(p)), title: s.title, say: s.say }));
  const { answer, mistakes } = multi(rng, opts, slips);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: g.ask,
    visual: visual(FlowerSection, { mode: "plain" }),
    answer,
    hint: tx("Male parts make pollen. Female parts receive it and hold the egg cell.", "Männliche Teile bilden Pollen. Weibliche Teile nehmen ihn auf und enthalten die Eizelle."),
    solution: [{ math: tx(g.yes.map((p, i) => `"${cap(en(PARTS[p].name))}"#c${i}`).join(" , "), g.yes.map((p, i) => `"${de(PARTS[p].name)}"#c${i}`).join(" , ")), note: g.note }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Pollination, fertilisation, germination or dispersal?

type EventId = "pollination" | "fertilisation" | "germination" | "dispersal";
const EVENTS: Record<EventId, Text> = {
  pollination: tx("Pollination", "Bestäubung"),
  fertilisation: tx("Fertilisation", "Befruchtung"),
  germination: tx("Germination", "Keimung"),
  dispersal: tx("Seed dispersal", "Samenverbreitung"),
};
const EVENT_IDS: EventId[] = ["pollination", "fertilisation", "germination", "dispersal"];

const SCENES: { text: Text; is: EventId; trap?: EventId }[] = [
  { text: tx("A bee carries pollen from one cherry blossom to the stigma of a cherry blossom on another tree.", "Eine Biene bringt Pollen von einer Kirschblüte auf die Narbe einer Kirschblüte an einem anderen Baum."), is: "pollination", trap: "fertilisation" },
  { text: tx("The wind blows pollen from a hazel bush onto the stigmas of another hazel bush.", "Der Wind weht Pollen eines Haselstrauchs auf die Narben eines anderen Haselstrauchs."), is: "pollination", trap: "dispersal" },
  { text: tx("A bumblebee wipes pollen from its fur onto the sticky stigma of a rapeseed flower.", "Eine Hummel streift Pollen aus ihrem Pelz auf die klebrige Narbe einer Rapsblüte."), is: "pollination", trap: "fertilisation" },
  { text: tx("Inside the ovule, a sperm cell from the pollen fuses with the egg cell.", "In der Samenanlage verschmilzt eine Spermazelle aus dem Pollen mit der Eizelle."), is: "fertilisation", trap: "pollination" },
  { text: tx("The male sex cell from a pollen grain unites with the female sex cell of the flower.", "Die männliche Keimzelle aus einem Pollenkorn vereinigt sich mit der weiblichen Keimzelle der Blüte."), is: "fertilisation", trap: "pollination" },
  { text: tx("A bean seed soaks up water, swells, and a tiny root breaks out of it.", "Ein Bohnensamen nimmt Wasser auf, quillt, und eine kleine Wurzel bricht heraus."), is: "germination" },
  { text: tx("In spring, a little green shoot pushes out of a buried acorn.", "Im Frühling schiebt sich aus einer vergrabenen Eichel ein kleiner grüner Spross."), is: "germination", trap: "dispersal" },
  { text: tx("A squirrel buries a hazelnut as winter food and forgets it.", "Ein Eichhörnchen vergräbt eine Haselnuss als Wintervorrat und vergisst sie."), is: "dispersal" },
  { text: tx("A blackbird eats cherries and drops the stones far away from the tree.", "Eine Amsel frisst Kirschen und scheidet die Kerne weit weg vom Baum wieder aus."), is: "dispersal" },
  { text: tx("The wind carries the dandelion's fruits away on their little parachutes.", "Der Wind trägt die Früchte des Löwenzahns an ihren Flugschirmen davon."), is: "dispersal", trap: "pollination" },
];

const EVENT_SAY: Record<string, { title: Text; say: Text }> = {
  "pollination>fertilisation": {
    title: tx("Pollination ≠ fertilisation", "Bestäubung ≠ Befruchtung"),
    say: tx("Classic trap! Pollen on the stigma is only the **pollination**. The flower is fertilised later, when a sperm cell fuses with the egg cell.", "Die klassische Falle! Pollen auf der Narbe ist erst die **Bestäubung**. Befruchtet ist die Blüte erst, wenn eine Spermazelle mit der Eizelle verschmilzt."),
  },
  "fertilisation>pollination": {
    title: tx("More than pollination", "Mehr als Bestäubung"),
    say: tx("Pollination only means pollen reaching the stigma. Here two sex cells fuse: that's the next, bigger step.", "Bestäubung heißt nur: Pollen gelangt auf die Narbe. Hier verschmelzen zwei Keimzellen, das ist der nächste, größere Schritt."),
  },
  "pollination>dispersal": {
    title: tx("Pollen, not seeds", "Pollen, nicht Samen"),
    say: tx("The wind carries **pollen** here, not fruits or seeds. Pollen travelling to a stigma has its own name.", "Der Wind trägt hier **Pollen**, keine Früchte oder Samen. Pollen auf dem Weg zur Narbe hat einen eigenen Namen."),
  },
  "dispersal>pollination": {
    title: tx("Fruits, not pollen", "Früchte, nicht Pollen"),
    say: tx("The dandelion's parachutes carry **fruits with seeds**, not pollen. That's how the plant spreads to new places.", "An den Flugschirmen des Löwenzahns hängen **Früchte mit Samen**, kein Pollen. So erobert die Pflanze neue Orte."),
  },
  "germination>dispersal": {
    title: tx("It's already growing", "Es wächst schon"),
    say: tx("The acorn has already arrived. Now a new plant starts to grow out of the seed.", "Die Eichel ist schon angekommen. Jetzt beginnt aus dem Samen eine neue Pflanze zu wachsen."),
  },
};

export function eventTask(rng: Rng, fixed?: number): Exercise {
  const s = SCENES[fixed ?? rng.int(0, SCENES.length - 1)];
  const wrong = rng.shuffle(EVENT_IDS.filter((e) => e !== s.is));
  const opts: Opt[] = [{ text: EVENTS[s.is] }, ...wrong.map((w) => ({ text: EVENTS[w], ...(EVENT_SAY[`${s.is}>${w}`] ?? {}) }))];
  const { answer, mistakes } = choice(rng, opts);
  const NOTE: Record<EventId, Text> = {
    pollination: tx("Pollen reaches the stigma: that's **pollination**. Fertilisation comes later.", "Pollen gelangt auf die Narbe: Das ist die **Bestäubung**. Die Befruchtung kommt erst danach."),
    fertilisation: tx("A sperm cell and the egg cell fuse: that's **fertilisation**.", "Spermazelle und Eizelle verschmelzen: Das ist die **Befruchtung**."),
    germination: tx("A new plant grows out of the seed: that's **germination**.", "Aus dem Samen wächst eine neue Pflanze: Das ist die **Keimung**."),
    dispersal: tx("Fruits and seeds get to new places: that's **seed dispersal**.", "Früchte und Samen kommen an neue Orte: Das ist die **Samenverbreitung**."),
  };
  return {
    instruction: tx("What is happening?", "Was passiert hier?"),
    text: s.text,
    answer,
    hint: tx("Ask yourself: is pollen travelling, are sex cells fusing, is a seed travelling, or is a seed growing?", "Frag dich: Reist Pollen, verschmelzen Keimzellen, reist ein Samen oder wächst ein Samen?"),
    solution: [{ math: q(EVENTS[s.is], "a"), note: NOTE[s.is] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// From pollination to a new plant (order)

const CHAIN1_SLIPS: { first: number; then: number; title: Text; say: Text }[] = [
  {
    first: 3,
    then: 1,
    title: tx("Pollination comes first", "Erst die Bestäubung"),
    say: tx("Fertilisation can't happen before the pollen has even reached the stigma. Which comes first?", "Befruchtung geht nicht, bevor der Pollen überhaupt auf der Narbe ist. Was kommt also zuerst?"),
  },
  {
    first: 3,
    then: 2,
    title: tx("The tube comes first", "Erst der Schlauch"),
    say: tx("The sperm cell needs a way to the egg cell first: the pollen tube.", "Die Spermazelle braucht erst einen Weg zur Eizelle: den Pollenschlauch."),
  },
  {
    first: 4,
    then: 3,
    title: tx("No fruit without fertilisation", "Ohne Befruchtung keine Frucht"),
    say: tx("The ovary only grows into a fruit with a seed after fertilisation.", "Der Fruchtknoten wächst erst nach der Befruchtung zur Frucht mit Samen heran."),
  },
  {
    first: 6,
    then: 5,
    title: tx("Travel first, then grow", "Erst reisen, dann keimen"),
    say: tx("The seed germinates where it lands, so it has to travel first.", "Der Samen keimt dort, wo er landet. Also muss er erst reisen."),
  },
];
const CHAIN1_SHORT: Text[] = [
  tx("insect picks up pollen", "Insekt nimmt Pollen auf"),
  tx("pollination", "Bestäubung"),
  tx("pollen tube", "Pollenschlauch"),
  tx("fertilisation", "Befruchtung"),
  tx("fruit with seed", "Frucht mit Samen"),
  tx("dispersal", "Verbreitung"),
  tx("germination", "Keimung"),
];

export function chainTask(rng: Rng, from?: number, len?: number): Exercise {
  const n = len ?? rng.int(4, 5);
  const start = from ?? rng.int(0, CHAIN1.length - n);
  const idx = Array.from({ length: n }, (_, i) => start + i);
  const items = idx.map((i) => CHAIN1[i]);
  const mistakes: Mistake[] = CHAIN1_SLIPS.filter((s) => idx.includes(s.first) && idx.includes(s.then)).map((s) => ({
    when: { kind: "order", items: [CHAIN1[s.first], CHAIN1[s.then]] },
    title: s.title,
    say: s.say,
  }));
  const short = idx.map((i, k) => q(CHAIN1_SHORT[i], `s${k}`));
  return {
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx("From the flower to a new plant: what happens first?", "Von der Blüte zur neuen Pflanze: Was passiert zuerst?"),
    answer: { kind: "order", items },
    hint: tx("Pollen has to reach the stigma before anything else can happen in the flower.", "Erst muss Pollen auf die Narbe gelangen, bevor in der Blüte etwas anderes passieren kann."),
    solution: [
      {
        math: tx(short.map((s, k) => `"${k + 1}."#k${k} ${en(s)}`).join(" \\\\ "), short.map((s, k) => `"${k + 1}."#k${k} ${de(s)}`).join(" \\\\ ")),
        note: tx("Pollination, then the pollen tube, then fertilisation: only then fruit and seed can form.", "Bestäubung, dann der Pollenschlauch, dann die Befruchtung: Erst danach entstehen Frucht und Samen."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// What becomes what?

type Becomes = { ask: Text; right: Text; wrong: Opt[]; note: Text; picture?: PartId[] };

const BECOMES: Becomes[] = [
  {
    ask: tx("What does the **ovary** become after fertilisation?", "Was wird nach der Befruchtung aus dem **Fruchtknoten**?"),
    right: tx("The fruit", "Die Frucht"),
    wrong: [
      { text: tx("The seed", "Der Samen"), title: tx("Ovary vs ovule", "Fruchtknoten oder Samenanlage?"), say: tx("The seed grows from the small ovule **inside** the ovary. What does the whole ovary around it become?", "Der Samen wächst aus der kleinen Samenanlage **im** Fruchtknoten. Was wird aus dem ganzen Fruchtknoten drumherum?") },
      { text: tx("Nothing, it falls off", "Nichts, er fällt ab"), title: tx("It stays!", "Er bleibt!"), say: tx("The petals fall off, but the ovary stays on the stalk and grows.", "Die Kronblätter fallen ab, aber der Fruchtknoten bleibt am Stiel und wächst.") },
      { text: tx("The pollen", "Der Pollen") },
    ],
    note: tx("The ovary grows into the **fruit**. The ovule inside becomes the seed.", "Der Fruchtknoten wächst zur **Frucht** heran. Die Samenanlage darin wird zum Samen."),
    picture: ["ovary"],
  },
  {
    ask: tx("What does the **ovule** become after fertilisation?", "Was wird nach der Befruchtung aus der **Samenanlage**?"),
    right: tx("The seed", "Der Samen"),
    wrong: [
      { text: tx("The fruit", "Die Frucht"), title: tx("Ovule vs ovary", "Samenanlage oder Fruchtknoten?"), say: tx("The fruit grows from the whole ovary. The small ovule inside it becomes something else.", "Die Frucht entsteht aus dem ganzen Fruchtknoten. Die kleine Samenanlage darin wird zu etwas anderem.") },
      { text: tx("The flesh of the fruit", "Das Fruchtfleisch") },
      { text: tx("The pollen", "Der Pollen") },
    ],
    note: tx("The ovule with the fertilised egg cell becomes the **seed**.", "Die Samenanlage mit der befruchteten Eizelle wird zum **Samen**."),
    picture: ["ovule"],
  },
  {
    ask: tx("Which part of the flower does the **fruit** grow from?", "Aus welchem Teil der Blüte entsteht die **Frucht**?"),
    right: tx("From the ovary", "Aus dem Fruchtknoten"),
    wrong: [
      { text: tx("From the petals", "Aus den Kronblättern"), title: tx("Petals fall off", "Kronblätter fallen ab"), say: tx("A common idea, but the petals wilt and fall off. The fruit grows from a part in the middle of the flower.", "Ein häufiger Gedanke, aber die Kronblätter welken und fallen ab. Die Frucht wächst aus einem Teil in der Mitte der Blüte.") },
      { text: tx("From the ovule", "Aus der Samenanlage"), title: tx("That's the seed", "Das ist der Samen"), say: tx("The ovule becomes the seed. The fruit is the bigger part around it.", "Aus der Samenanlage wird der Samen. Die Frucht ist der größere Teil drumherum.") },
      { text: tx("From the stamens", "Aus den Staubblättern"), title: tx("Stamens wither", "Staubblätter vertrocknen"), say: tx("The stamens have delivered their pollen and dry up. The fruit grows from the female part.", "Die Staubblätter haben ihren Pollen abgegeben und vertrocknen. Die Frucht wächst aus dem weiblichen Teil.") },
    ],
    note: tx("The fruit grows from the **ovary**. Petals and stamens fall off.", "Die Frucht entsteht aus dem **Fruchtknoten**. Kronblätter und Staubblätter fallen ab."),
  },
  {
    ask: tx("Which part of the flower does the **seed** grow from?", "Aus welchem Teil der Blüte entsteht der **Samen**?"),
    right: tx("From the ovule", "Aus der Samenanlage"),
    wrong: [
      { text: tx("From the ovary", "Aus dem Fruchtknoten"), title: tx("That's the fruit", "Das ist die Frucht"), say: tx("The whole ovary becomes the fruit. The seed comes from a smaller part inside it.", "Der ganze Fruchtknoten wird zur Frucht. Der Samen kommt aus einem kleineren Teil darin.") },
      { text: tx("From the pollen", "Aus dem Pollen"), title: tx("Pollen only brings the sperm", "Pollen bringt nur die Spermazelle"), say: tx("The pollen only delivers the sperm cell. The seed grows from the part that holds the egg cell.", "Der Pollen liefert nur die Spermazelle. Der Samen wächst aus dem Teil, der die Eizelle enthält.") },
      { text: tx("From the stigma", "Aus der Narbe") },
    ],
    note: tx("The seed grows from the **ovule**, which holds the egg cell.", "Der Samen wächst aus der **Samenanlage**, die die Eizelle enthält."),
  },
  {
    ask: tx("What happens to the **petals** after fertilisation?", "Was passiert nach der Befruchtung mit den **Kronblättern**?"),
    right: tx("They wilt and fall off", "Sie welken und fallen ab"),
    wrong: [
      { text: tx("They grow into the fruit", "Sie wachsen zur Frucht heran"), title: tx("Petals fall off", "Kronblätter fallen ab"), say: tx("Many think so, but the fruit grows from the ovary. The petals have done their job of attracting insects.", "Das denken viele, aber die Frucht wächst aus dem Fruchtknoten. Die Kronblätter haben ihre Aufgabe, Insekten anzulocken, erledigt.") },
      { text: tx("They become the seed", "Sie werden zum Samen"), title: tx("Seeds come from ovules", "Samen kommen aus Samenanlagen"), say: tx("Seeds grow from the ovules inside the ovary, not from petals.", "Samen wachsen aus den Samenanlagen im Fruchtknoten, nicht aus Kronblättern.") },
      { text: tx("They turn into sepals", "Sie werden zu Kelchblättern") },
    ],
    note: tx("Their job is done: the petals **wilt and fall off**.", "Ihre Aufgabe ist erledigt: Die Kronblätter **welken und fallen ab**."),
  },
  {
    ask: tx("Which part of the cherry blossom does the **flesh of the cherry** come from?", "Aus welchem Teil der Kirschblüte entsteht das **Fruchtfleisch** der Kirsche?"),
    right: tx("From the wall of the ovary", "Aus der Wand des Fruchtknotens"),
    wrong: [
      { text: tx("From the petals", "Aus den Kronblättern"), title: tx("Petals fall off", "Kronblätter fallen ab"), say: tx("Juicy petals? They wilt and fall off. The flesh grows from the part that surrounds the ovule.", "Saftige Kronblätter? Die welken und fallen ab. Das Fruchtfleisch wächst aus dem Teil, der die Samenanlage umgibt.") },
      { text: tx("From the ovule", "Aus der Samenanlage"), title: tx("That's the seed", "Das ist der Samen"), say: tx("The ovule becomes the seed inside the stone, not the flesh.", "Die Samenanlage wird zum Samen im Steinkern, nicht zum Fruchtfleisch.") },
      { text: tx("From the nectar", "Aus dem Nektar") },
    ],
    note: tx("The wall of the ovary becomes the fruit wall: skin, flesh and the hard stone.", "Die Wand des Fruchtknotens wird zur Fruchtwand: Haut, Fruchtfleisch und der harte Steinkern."),
  },
  {
    ask: tx("Where is the **seed** of a cherry?", "Wo steckt bei der Kirsche der **Samen**?"),
    right: tx("Inside the hard stone", "Im harten Steinkern"),
    wrong: [
      { text: tx("Spread through the flesh", "Im Fruchtfleisch verteilt"), title: tx("That's a berry", "Das wäre eine Beere"), say: tx("Tomatoes have seeds in their flesh. In a cherry, the seed is protected by something hard.", "Tomaten haben Samen im Fruchtfleisch. Bei der Kirsche ist der Samen von etwas Hartem geschützt.") },
      { text: tx("Cherries have no seed", "Kirschen haben keinen Samen"), title: tx("Every fruit has seeds", "Jede Frucht hat Samen"), say: tx("A fruit grows to protect and spread seeds. Crack a cherry stone and you'll find it.", "Eine Frucht schützt und verbreitet Samen. Knack mal einen Kirschkern auf, dann findest du ihn.") },
      { text: tx("In the stalk", "Im Stiel") },
    ],
    note: tx("The cherry stone is the hard inner fruit wall. The **seed** lies inside it.", "Der Kirschkern ist die harte innere Fruchtwand. Darin liegt der **Samen**."),
  },
];

export function becomesTask(rng: Rng, fixed?: number): Exercise {
  const b = BECOMES[fixed ?? rng.int(0, BECOMES.length - 1)];
  const { answer, mistakes } = choice(rng, [{ text: b.right }, ...b.wrong]);
  return {
    instruction: tx("From flower to fruit", "Von der Blüte zur Frucht"),
    text: b.ask,
    ...(b.picture ? { visual: visual(FlowerSection, { mode: "plain", highlight: b.picture }) } : {}),
    answer,
    hint: tx("Ovary becomes fruit, ovule becomes seed. Everything else withers.", "Fruchtknoten wird Frucht, Samenanlage wird Samen. Der Rest vertrocknet."),
    solution: [{ math: q(b.right, "a"), note: b.note }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// How does it travel?

const MODE_IDS: Mode[] = ["wind", "animal", "self", "water"];
const MODE_SAY: Record<Mode, { title: Text; first: Text }> = {
  wind: { title: tx("Too heavy to fly?", "Zu schwer zum Fliegen?"), first: tx("The wind only carries very light fruits with a parachute or wings.", "Der Wind trägt nur sehr leichte Früchte mit Flugschirm oder Flügeln.") },
  animal: { title: tx("Which animal?", "Welches Tier?"), first: tx("Animals spread fruits that they eat, hide or carry in their fur.", "Tiere verbreiten Früchte, die sie fressen, verstecken oder im Fell mitnehmen.") },
  self: { title: tx("No catapult", "Keine Schleuder"), first: tx("Self-dispersal means the fruit bursts open and flings out the seeds.", "Selbstverbreitung heißt: Die Frucht springt auf und schleudert die Samen heraus.") },
  water: { title: tx("Can it swim?", "Kann sie schwimmen?"), first: tx("Only fruits and seeds that float travel with water.", "Mit dem Wasser reisen nur Früchte und Samen, die schwimmen.") },
};

export function dispersalTask(rng: Rng, fixedId?: string): Exercise {
  const p = fixedId ? plantById(fixedId) : rng.pick(DISPERSAL);
  const opts: Opt[] = [
    { text: capT(MODES[p.mode].name) },
    ...MODE_IDS.filter((m) => m !== p.mode).map((m) => ({
      text: capT(MODES[m].name),
      title: MODE_SAY[m].title,
      say: tx(`${en(MODE_SAY[m].first)} Look closely at this one: ${en(p.feature)}. What is that good for?`, `${de(MODE_SAY[m].first)} Schau dir diese hier genau an: ${de(p.feature)}. Wofür ist das gut?`),
    })),
  ];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("How does it travel?", "Wie wird sie verbreitet?"),
    text: tx(`**${cap(en(p.name))}**: how are the fruits and seeds of this plant spread?`, `**${de(p.name)}**: Wie werden die Früchte und Samen dieser Pflanze verbreitet?`),
    visual: visual(FlowerFruitPicture, { id: p.id }),
    answer,
    hint: tx("Look at the fruit: wings or hairs, hooks, something tasty, a bursting capsule, or something that floats?", "Schau dir die Frucht an: Flügel oder Härchen, Haken, etwas Leckeres, eine aufspringende Kapsel oder etwas, das schwimmt?"),
    solution: [{ math: join(q(p.name, "p"), "\\to", q(MODES[p.mode].kind, "m")), note: p.why, highlight: ["m"] }],
    mistakes,
  };
}

export function dispersalMatchTask(rng: Rng): Exercise {
  const byMode = rng.chance(0.5);
  let plants: DispersalPlant[];
  if (byMode) plants = MODE_IDS.map((m) => rng.pick(DISPERSAL.filter((p) => p.mode === m)));
  else plants = some(rng, DISPERSAL, 4);
  const right = (p: DispersalPlant) => (byMode ? capT(MODES[p.mode].kind) : p.feature);
  const pairs: [Text, Text][] = plants.map((p) => [capT(p.name), right(p)]);
  const mistakes: Mistake[] = [];
  if (byMode) {
    const fleshy = plants.find((p) => p.id === "cherry" || p.id === "rowan");
    if (fleshy) {
      mistakes.push({
        when: { kind: "match", pairs: [[capT(fleshy.name), capT(MODES.self.kind)]] },
        title: tx("Not just falling down", "Nicht nur runterfallen"),
        say: tx(`Ripe ${en(fleshy.name)} fruits do drop, but who loves juicy fruit? Those helpers carry the seeds much further.`, `Reife Früchte der ${de(fleshy.name)} fallen zwar herunter, aber wer liebt saftige Früchte? Diese Helfer tragen die Samen viel weiter.`),
      });
    }
  } else {
    const wind = plants.filter((p) => p.mode === "wind");
    if (wind.length >= 2) {
      mistakes.push({
        when: { kind: "match", pairs: [[capT(wind[0].name), wind[1].feature]] },
        title: tx("Both fly, but differently", "Beide fliegen, aber anders"),
        say: tx("Both travel with the wind, but with different flying gear. Picture each fruit.", "Beide reisen mit dem Wind, aber mit unterschiedlicher Flugausrüstung. Stell dir jede Frucht vor."),
      });
    }
  }
  return {
    instruction: byMode ? tx("Match each plant with how it spreads", "Ordne jeder Pflanze ihre Verbreitung zu") : tx("Match each plant with its trick", "Ordne jeder Pflanze ihren Trick zu"),
    text: byMode ? tx("How do the fruits and seeds of these plants travel?", "Wie reisen die Früchte und Samen dieser Pflanzen?") : tx("Which feature helps each plant to spread its fruits and seeds?", "Welche Eigenschaft hilft jeder Pflanze, ihre Früchte und Samen zu verbreiten?"),
    answer: { kind: "match", pairs },
    hint: tx("Light with wings or hairs: wind. Hooks or tasty: animals. Bursting: self. Floating: water.", "Leicht mit Flügeln oder Härchen: Wind. Haken oder lecker: Tiere. Aufspringend: selbst. Schwimmfähig: Wasser."),
    solution: [
      {
        math: tx(plants.map((p, i) => `"${cap(en(p.name))}:"#n${i} "${en(right(p))}"#r${i}`).join(" \\\\ "), plants.map((p, i) => `"${de(p.name)}:"#n${i} "${de(right(p))}"#r${i}`).join(" \\\\ ")),
        note: tx("Each fruit is built for its way of travelling.", "Jede Frucht ist für ihre Art zu reisen gebaut."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Insect or wind?

const INSECT_PLANTS: Text[] = [tx("cherry", "Kirsche"), tx("rapeseed", "Raps"), tx("apple", "Apfel"), tx("sunflower", "Sonnenblume"), tx("dead-nettle", "Taubnessel"), tx("clover", "Klee")];
const WIND_PLANTS: Text[] = [tx("grasses", "Gräser"), tx("hazel", "Hasel"), tx("birch", "Birke"), tx("rye", "Roggen"), tx("maize", "Mais")];

export function windTask(rng: Rng): Exercise {
  const kind = rng.int(0, 2);
  if (kind === 2) {
    const { answer, mistakes } = choice(rng, [
      { text: tx("Small and plain, without colourful petals", "Klein und unscheinbar, ohne bunte Kronblätter") },
      {
        text: tx("Large, colourful petals", "Große, bunte Kronblätter"),
        title: tx("The wind can't see", "Der Wind sieht nichts"),
        say: tx("Colourful petals are an advert for insects. The wind doesn't need to be attracted, so wind flowers save the effort.", "Bunte Kronblätter sind Werbung für Insekten. Den Wind muss man nicht anlocken, deshalb sparen sich Windblüten das."),
      },
      { text: tx("A strong scent and lots of nectar", "Starker Duft und viel Nektar"), title: tx("That's for insects", "Das ist für Insekten"), say: tx("Scent and nectar attract and reward insects. The wind doesn't care about either.", "Duft und Nektar locken Insekten an und belohnen sie. Dem Wind ist beides egal.") },
      { text: tx("Very little, sticky pollen", "Sehr wenig, klebriger Pollen") },
    ]);
    return {
      instruction: tx("Wind flowers", "Windblüten"),
      text: tx("What do flowers that are pollinated by the **wind** usually look like?", "Wie sehen Blüten meist aus, die vom **Wind** bestäubt werden?"),
      answer,
      hint: tx("Who needs to be attracted: the wind or an insect?", "Wer muss angelockt werden: der Wind oder ein Insekt?"),
      solution: [{ math: q(tx("small and plain", "klein und unscheinbar"), "a"), note: tx("Wind flowers don't have to attract anyone. They are plain but make lots of light pollen.", "Windblüten müssen niemanden anlocken. Sie sind unscheinbar, bilden aber sehr viel leichten Pollen.") }],
      mistakes,
    };
  }
  const wind = kind === 0;
  const right = rng.pick(wind ? WIND_PLANTS : INSECT_PLANTS);
  const wrong = some(rng, wind ? INSECT_PLANTS : WIND_PLANTS, 3);
  const say = wind
    ? tx("That one has colourful, scented flowers with nectar: an advert for insects. Wind flowers look plain.", "Die hat bunte, duftende Blüten mit Nektar: Werbung für Insekten. Windblüten sehen unscheinbar aus.")
    : tx("That one has plain flowers without colourful petals. Insects wouldn't notice them: the wind does the job.", "Die hat unscheinbare Blüten ohne bunte Kronblätter. Insekten würden sie kaum bemerken: Hier erledigt das der Wind.");
  const { answer, mistakes } = choice(rng, [{ text: capT(right) }, ...wrong.map((w) => ({ text: capT(w), title: wind ? tx("Insect flower", "Insektenblüte") : tx("Wind flower", "Windblüte"), say }))]);
  return {
    instruction: wind ? tx("Pollinated by the wind", "Vom Wind bestäubt") : tx("Pollinated by insects", "Von Insekten bestäubt"),
    text: wind ? tx("Which plant is pollinated by the **wind**?", "Welche Pflanze wird vom **Wind** bestäubt?") : tx("Which plant is pollinated by **insects**?", "Welche Pflanze wird von **Insekten** bestäubt?"),
    answer,
    hint: tx("Insect flowers are colourful and smell nice. Wind flowers are small and plain.", "Insektenblüten sind bunt und duften. Windblüten sind klein und unscheinbar."),
    solution: [
      {
        math: q(right, "a"),
        note: wind
          ? tx(`${cap(en(right))}: plain flowers, lots of light pollen, the wind carries it.`, `${de(right)}: unscheinbare Blüten, sehr viel leichter Pollen, den der Wind trägt.`)
          : tx(`${cap(en(right))}: colourful, scented flowers with nectar that attract insects.`, `${de(right)}: bunte, duftende Blüten mit Nektar, die Insekten anlocken.`),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// True or false? (select all true statements)

const TRUE1: Text[] = [
  tx("Pollen is made in the anthers.", "Der Pollen entsteht in den Staubbeuteln."),
  tx("The stigma catches the pollen.", "Die Narbe fängt den Pollen auf."),
  tx("The fruit grows from the ovary.", "Die Frucht entsteht aus dem Fruchtknoten."),
  tx("The seed grows from the ovule.", "Der Samen entsteht aus der Samenanlage."),
  tx("In pollination, pollen reaches the stigma.", "Bei der Bestäubung gelangt Pollen auf die Narbe."),
  tx("A cherry blossom has male and female parts.", "Eine Kirschblüte hat männliche und weibliche Teile."),
  tx("Grasses are pollinated by the wind.", "Gräser werden vom Wind bestäubt."),
  tx("The burdock's hooks catch in animal fur.", "Die Haken der Klette bleiben im Fell von Tieren hängen."),
];
const FALSE1: { text: Text; title: Text; say: Text }[] = [
  {
    text: tx("Pollination and fertilisation are the same thing.", "Bestäubung und Befruchtung sind dasselbe."),
    title: tx("Pollination ≠ fertilisation", "Bestäubung ≠ Befruchtung"),
    say: tx("Not the same! Pollination brings pollen to the stigma. Fertilisation is later: sperm cell and egg cell fuse.", "Nicht dasselbe! Bestäubung bringt Pollen auf die Narbe. Befruchtung kommt später: Spermazelle und Eizelle verschmelzen."),
  },
  {
    text: tx("The fruit grows from the petals.", "Die Frucht entsteht aus den Kronblättern."),
    title: tx("Petals fall off", "Kronblätter fallen ab"),
    say: tx("The petals wilt and fall off. The fruit grows from the ovary in the middle.", "Die Kronblätter welken und fallen ab. Die Frucht wächst aus dem Fruchtknoten in der Mitte."),
  },
  {
    text: tx("Wind-pollinated flowers have especially colourful petals.", "Windblüten haben besonders bunte Kronblätter."),
    title: tx("Wind flowers are plain", "Windblüten sind unscheinbar"),
    say: tx("Colour attracts insects, not the wind. Wind flowers are usually small and plain.", "Farbe lockt Insekten an, nicht den Wind. Windblüten sind meist klein und unscheinbar."),
  },
  {
    text: tx("Pollen is made in the stigma.", "Der Pollen entsteht in der Narbe."),
    title: tx("Anther vs stigma", "Staubbeutel oder Narbe?"),
    say: tx("The stigma only catches pollen. Pollen is made in the anthers.", "Die Narbe fängt den Pollen nur auf. Gebildet wird er in den Staubbeuteln."),
  },
  {
    text: tx("The sepals attract insects with their colour.", "Die Kelchblätter locken mit ihrer Farbe Insekten an."),
    title: tx("Sepals protect", "Kelchblätter schützen"),
    say: tx("The small green sepals protected the bud. Attracting insects is the job of the petals.", "Die kleinen grünen Kelchblätter haben die Knospe geschützt. Anlocken ist die Aufgabe der Kronblätter."),
  },
  {
    text: tx("As soon as pollen is on the stigma, the egg cell is fertilised.", "Sobald Pollen auf der Narbe liegt, ist die Eizelle befruchtet."),
    title: tx("Not yet!", "Noch nicht!"),
    say: tx("Pollen on the stigma is only pollination. A pollen tube still has to grow to the egg cell.", "Pollen auf der Narbe ist erst die Bestäubung. Ein Pollenschlauch muss noch bis zur Eizelle wachsen."),
  },
];

export function statementsTask(rng: Rng): Exercise {
  const trues = some(rng, TRUE1, rng.int(2, 3));
  const falses = some(rng, FALSE1, 2);
  const opts: MultiOpt[] = [...trues.map((t) => ({ text: t, ok: true })), ...falses.map((f) => ({ text: f.text, ok: false }))];
  const slips: MultiSlip[] = falses.map((f, k) => ({ pick: [...trues.map((_, i) => i), trues.length + k], title: f.title, say: f.say }));
  const { answer, mistakes } = multi(rng, opts, slips);
  return {
    instruction: tx("Which statements are true?", "Welche Aussagen stimmen?"),
    text: tx("Select all true statements.", "Wähle alle richtigen Aussagen aus."),
    answer,
    hint: tx("Watch out for pollination vs fertilisation and where the fruit comes from.", "Achte auf Bestäubung und Befruchtung und darauf, woraus die Frucht entsteht."),
    solution: [
      {
        math: tx(trues.map((_, i) => `"✓"#t${i}`).join(" \\; "), trues.map((_, i) => `"✓"#t${i}`).join(" \\; ")),
        note: tx(`True: ${trues.map(en).join(" ")}`, `Richtig: ${trues.map(de).join(" ")}`),
      },
      { math: tx(falses.map((_, i) => `"✗"#f${i}`).join(" \\; "), falses.map((_, i) => `"✗"#f${i}`).join(" \\; ")), note: tx(`Wrong: ${falses.map((f) => en(f.say)).join(" ")}`, `Falsch: ${falses.map((f) => de(f.say)).join(" ")}`) },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  switch (rng.int(0, 10)) {
    case 0:
      return nameTask(rng);
    case 1:
      return nameWordTask(rng);
    case 2:
      return jobMatchTask(rng);
    case 3:
      return groupTask(rng);
    case 4:
      return eventTask(rng);
    case 5:
      return chainTask(rng);
    case 6:
      return becomesTask(rng);
    case 7:
      return dispersalTask(rng);
    case 8:
      return dispersalMatchTask(rng);
    case 9:
      return windTask(rng);
    default:
      return statementsTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const partsFrames: Frame[] = [
  {
    math: tx('"sepals"#k', '"Kelchblätter"#k'),
    note: tx("On the very outside: the small green **sepals**. They protected the flower while it was a bud.", "Ganz außen: die kleinen grünen **Kelchblätter**. Sie haben die Blüte geschützt, als sie noch eine Knospe war."),
    highlight: ["k"],
  },
  {
    math: tx('"sepals"#k \\to#a1 "petals"#r', '"Kelchblätter"#k \\to#a1 "Kronblätter"#r'),
    note: tx("Then the big white or pink **petals**. They attract insects.", "Dann die großen weißen bis rosa **Kronblätter**. Sie locken Insekten an."),
    highlight: ["r"],
  },
  {
    math: tx('"sepals"#k \\to#a1 "petals"#r \\\\ \\to#a2 "stamens"#s', '"Kelchblätter"#k \\to#a1 "Kronblätter"#r \\\\ \\to#a2 "Staubblätter"#s'),
    note: tx("Further in: lots of **stamens**. They make the pollen (Blütenstaub). They are the male parts.", "Weiter innen: viele **Staubblätter**. Sie bilden den Pollen (Blütenstaub). Das sind die männlichen Teile."),
    highlight: ["s"],
  },
  {
    math: tx('"sepals"#k \\to#a1 "petals"#r \\\\ \\to#a2 "stamens"#s \\to#a3 "pistil"#f', '"Kelchblätter"#k \\to#a1 "Kronblätter"#r \\\\ \\to#a2 "Staubblätter"#s \\to#a3 "Stempel"#f'),
    note: tx("Right in the middle: the **pistil** (one carpel in the cherry). It is the female part.", "Genau in der Mitte: der **Stempel** (bei der Kirsche ein einziges Fruchtblatt). Er ist der weibliche Teil."),
    highlight: ["f"],
  },
];

const sexFrames: Frame[] = [
  {
    math: tx('"stamen"#sb = "anther"#b + "filament"#fa', '"Staubblatt"#sb = "Staubbeutel"#b + "Staubfaden"#fa'),
    note: tx("A **stamen** is an **anther** on a thin **filament**. The pollen grows in the anther.", "Ein **Staubblatt** ist ein **Staubbeutel** auf einem dünnen **Staubfaden**. Im Staubbeutel entsteht der Pollen."),
  },
  {
    math: tx('"pistil"#st = "stigma"#n + "style"#g + "ovary"#fk', '"Stempel"#st = "Narbe"#n + "Griffel"#g + "Fruchtknoten"#fk'),
    note: tx("The **pistil** has three parts: the sticky **stigma** at the top, the **style** and the thick **ovary** at the bottom.", "Der **Stempel** hat drei Teile: oben die klebrige **Narbe**, dann den **Griffel** und unten den dicken **Fruchtknoten**."),
  },
  {
    math: tx('"ovary"#fk \\to "ovule"#sa \\to "egg cell"#e', '"Fruchtknoten"#fk \\to "Samenanlage"#sa \\to "Eizelle"#e'),
    note: tx("Inside the ovary lies the **ovule**, and inside the ovule the **egg cell**: the female sex cell.", "Im Fruchtknoten liegt die **Samenanlage** und in ihr die **Eizelle**: die weibliche Keimzelle."),
    highlight: ["e"],
  },
  {
    math: tx('"pollen"#p : "male" \\quad "egg cell"#e : "female"', '"Pollen"#p : "männlich" \\quad "Eizelle"#e : "weiblich"'),
    note: tx("Pollen grains carry the male sex cells (sperm cells). The cherry has both sexes in one flower: a **hermaphrodite flower**.", "Pollenkörner enthalten die männlichen Keimzellen (Spermazellen). Die Kirsche hat beides in einer Blüte: eine **Zwitterblüte**."),
  },
];

const pollinationFrames: Frame[] = [
  {
    math: tx('"pollen"#p \\to#a "stigma"#n', '"Pollen"#p \\to#a "Narbe"#n'),
    note: tx("**Pollination** means: pollen reaches the stigma of a flower of the same species.", "**Bestäubung** heißt: Pollen gelangt auf die Narbe einer Blüte derselben Art."),
  },
  {
    math: tx('"insects:"#i \\; "cherry, rapeseed, apple"#ib', '"Insekten:"#i \\; "Kirsche, Raps, Apfel"#ib'),
    note: tx("In cherry and rapeseed, **insects** like bees carry the pollen. Colour, scent and nectar lure them in.", "Bei Kirsche und Raps bringen **Insekten** wie Bienen den Pollen. Farbe, Duft und Nektar locken sie an."),
  },
  {
    math: tx('"insects:"#i \\; "cherry, rapeseed, apple"#ib \\\\ "wind:"#w \\; "grasses, hazel, birch"#wb', '"Insekten:"#i \\; "Kirsche, Raps, Apfel"#ib \\\\ "Wind:"#w \\; "Gräser, Hasel, Birke"#wb'),
    note: tx("In grasses, hazel and birch the **wind** carries the pollen. Their flowers are small and plain: they don't need to attract anyone.", "Bei Gräsern, Hasel und Birke trägt der **Wind** den Pollen. Ihre Blüten sind klein und unscheinbar: Sie müssen niemanden anlocken."),
    highlight: ["w", "wb"],
  },
  {
    math: tx('"pollination"#b \\ne "fertilisation"#f', '"Bestäubung"#b \\ne "Befruchtung"#f'),
    note: tx("Important: pollination is **not yet** fertilisation! Watch in the next step what has to happen in between.", "Wichtig: Bestäubung ist **noch keine** Befruchtung! Im nächsten Schritt siehst du, was dazwischen passieren muss."),
    highlight: ["b", "f"],
  },
];

function PollinationWidget() {
  return <FlowerPollination />;
}
function FruitWidget() {
  return <FlowerToFruit />;
}

const checkName = nameTask(createRng(11), "stigma");
const checkEvent = eventTask(createRng(5), 0);
const checkBecomes = becomesTask(createRng(7), 2);
const checkChain = chainTask(createRng(3), 1, 5);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The cherry blossom", "Die Kirschblüte"),
      blob: tx("In spring the cherry tree is full of blossoms. Let's look inside one!", "Im Frühling ist der Kirschbaum voller Blüten. Schauen wir mal in eine hinein!"),
      body: tx(
        "Flowers are the plant's organs for reproduction. A cherry blossom is built from four kinds of parts, arranged in rings from the outside in.",
        "Blüten sind die Fortpflanzungsorgane der Pflanze. Eine Kirschblüte besteht aus vier Sorten von Blütenteilen, die in Kreisen von außen nach innen angeordnet sind.",
      ),
      frames: partsFrames,
    },
    {
      type: "widget",
      title: tx("Inside the cherry blossom", "Blick in die Kirschblüte"),
      blob: tx("Tap the numbers and find out what each part does!", "Tipp auf die Nummern und finde heraus, was jeder Teil macht!"),
      body: tx(
        "Here the blossom is cut lengthwise through the middle (a **longitudinal section**). Tap a number or a name.",
        "Hier ist die Blüte genau in der Mitte längs durchgeschnitten (ein **Längsschnitt**). Tipp auf eine Nummer oder einen Namen.",
      ),
      widget: FlowerSectionExplore,
    },
    {
      type: "explain",
      title: tx("Male and female", "Männlich und weiblich"),
      blob: tx("A flower is a bit like a tiny factory for seeds.", "Eine Blüte ist ein bisschen wie eine winzige Samenfabrik."),
      frames: sexFrames,
    },
    { type: "check", blob: tx("Where does the pollen have to land?", "Wo muss der Pollen landen?"), exercise: checkName },
    {
      type: "explain",
      title: tx("Pollination", "Bestäubung"),
      blob: tx("Plants can't walk to each other. So who brings the pollen?", "Pflanzen können nicht zueinander laufen. Wer bringt also den Pollen?"),
      frames: pollinationFrames,
    },
    {
      type: "widget",
      title: tx("From bee to egg cell", "Von der Biene zur Eizelle"),
      blob: tx("Drag the bee! I'm buzzing with excitement.", "Zieh die Biene! Ich summe schon vor Aufregung."),
      body: tx(
        "Watch closely: first comes **pollination** (pollen on the stigma), then the pollen tube grows, and only then **fertilisation** (sperm cell and egg cell fuse).",
        "Schau genau hin: Erst kommt die **Bestäubung** (Pollen auf der Narbe), dann wächst der Pollenschlauch und erst dann folgt die **Befruchtung** (Spermazelle und Eizelle verschmelzen).",
      ),
      widget: PollinationWidget,
    },
    { type: "check", blob: tx("Pollination or fertilisation? Careful, classic trap!", "Bestäubung oder Befruchtung? Vorsicht, klassische Falle!"), exercise: checkEvent },
    {
      type: "widget",
      title: tx("From flower to fruit", "Von der Blüte zur Frucht"),
      blob: tx("Now the magic: a blossom turns into a cherry!", "Jetzt kommt der Zauber: Aus einer Blüte wird eine Kirsche!"),
      body: tx(
        "Step through the weeks after fertilisation. Follow the colours: green (ovary) becomes the fruit, orange (ovule) becomes the seed.",
        "Geh die Wochen nach der Befruchtung Schritt für Schritt durch. Folge den Farben: Grün (Fruchtknoten) wird zur Frucht, Orange (Samenanlage) wird zum Samen.",
      ),
      widget: FruitWidget,
    },
    { type: "check", blob: tx("So where does a cherry come from?", "Woraus wird also eine Kirsche?"), exercise: checkBecomes },
    {
      type: "widget",
      title: tx("How seeds travel", "Wie Samen reisen"),
      blob: tx("Plants can't walk, but their seeds still get around. Sort them!", "Pflanzen können nicht laufen, ihre Samen kommen trotzdem herum. Sortier sie!"),
      body: tx(
        "So that new plants don't grow right under the mother plant, fruits and seeds travel: with the **wind**, with **animals**, with **water**, or the plant flings them out **itself**.",
        "Damit neue Pflanzen nicht direkt unter der Mutterpflanze wachsen, reisen Früchte und Samen: mit dem **Wind**, mit **Tieren**, mit dem **Wasser** oder die Pflanze schleudert sie **selbst** heraus.",
      ),
      widget: FlowerDispersal,
    },
    { type: "check", blob: tx("The whole story in the right order!", "Die ganze Geschichte in der richtigen Reihenfolge!"), exercise: checkChain },
  ],
  summary: [
    {
      title: tx("Parts of the flower", "Aufbau der Blüte"),
      body: tx(
        "From the outside in: sepals (protect the bud), petals (attract insects), stamens (make pollen), pistil (with the ovule).",
        "Von außen nach innen: Kelchblätter (schützen die Knospe), Kronblätter (locken an), Staubblätter (bilden Pollen), Stempel (mit der Samenanlage).",
      ),
      examples: [tx('"sepals" \\to "petals" \\to "stamens" \\to "pistil"', '"Kelch" \\to "Krone" \\to "Staubblätter" \\to "Stempel"')],
      tone: "rule",
    },
    {
      title: tx("Male and female", "Männlich und weiblich"),
      body: tx("Stamen = anther + filament (male, pollen). Pistil = stigma + style + ovary (female, ovule with egg cell).", "Staubblatt = Staubbeutel + Staubfaden (männlich, Pollen). Stempel = Narbe + Griffel + Fruchtknoten (weiblich, Samenanlage mit Eizelle)."),
      examples: [tx('"pistil" = "stigma" + "style" + "ovary"', '"Stempel" = "Narbe" + "Griffel" + "Fruchtknoten"')],
      tone: "rule",
    },
    {
      title: tx("Pollination and fertilisation", "Bestäubung und Befruchtung"),
      body: tx(
        "Pollination: pollen reaches the stigma (by insects or wind). Then a pollen tube grows to the ovule. Fertilisation: a sperm cell fuses with the egg cell.",
        "Bestäubung: Pollen gelangt auf die Narbe (durch Insekten oder Wind). Dann wächst ein Pollenschlauch zur Samenanlage. Befruchtung: Eine Spermazelle verschmilzt mit der Eizelle.",
      ),
      examples: [tx('"pollination" \\to "pollen tube" \\to "fertilisation"', '"Bestäubung" \\to "Pollenschlauch" \\to "Befruchtung"')],
      tone: "rule",
    },
    {
      title: tx("From flower to fruit", "Von der Blüte zur Frucht"),
      body: tx("After fertilisation, petals and stamens fall off.", "Nach der Befruchtung fallen Kronblätter und Staubblätter ab."),
      examples: [tx('"ovary" \\to "fruit" \\quad "ovule" \\to "seed"', '"Fruchtknoten" \\to "Frucht" \\quad "Samenanlage" \\to "Samen"')],
      tone: "rule",
    },
    {
      title: tx("How seeds travel", "Samenverbreitung"),
      body: tx(
        "Wind: dandelion (parachute), maple (wing). Animals: burdock (hooks), cherry (eaten). Self: touch-me-not (bursting capsule). Water: coconut (floats).",
        "Wind: Löwenzahn (Flugschirm), Ahorn (Flügel). Tiere: Klette (Haken), Kirsche (wird gefressen). Selbst: Springkraut (Schleuderfrucht). Wasser: Kokosnuss (schwimmt).",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Pollination is not fertilisation. The fruit grows from the ovary, not from the petals. Wind flowers are plain, not colourful.",
        "Bestäubung ist nicht Befruchtung. Die Frucht entsteht aus dem Fruchtknoten, nicht aus den Kronblättern. Windblüten sind unscheinbar, nicht bunt.",
      ),
      tone: "warning",
    },
  ],
};

