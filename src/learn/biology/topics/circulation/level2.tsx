"use client";

// Level 2 (Fortgeschritten, Klasse 7–9): the heart's chambers and valves (right half on the
// left of the picture!), the double circulation, artery/vein/capillary walls, blood components,
// gas exchange in the alveoli and the AB0 blood groups.

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { HeartAlveoliWidget } from "@/learn/biology/visuals/HeartAlveoli";
import { HeartBeatWidget } from "@/learn/biology/visuals/HeartBeat";
import { antibodiesOf, antigensOf, GROUPS, HeartBloodCells, HeartBloodGroupsWidget, HeartBloodTest, type BloodGroup } from "@/learn/biology/visuals/HeartBlood";
import { HeartCirculationWidget } from "@/learn/biology/visuals/HeartCirculation";
import { HeartSection, heartLabel } from "@/learn/biology/visuals/HeartSection";
import { HeartVessels } from "@/learn/biology/visuals/HeartVessels";
import { answerFrames, capT, choice, de, en, listText, mistakes, multi, multiFrames, orderFrames, PATH, pathName, q, visual, type Opt } from "./data";

// ---------------------------------------------------------------------------
// Parts of the heart

type PartId = "ra" | "rv" | "la" | "lv" | "septum" | "av" | "sl" | "svc" | "ivc" | "pa" | "pv" | "aorta";
const PART_IDS: PartId[] = ["ra", "rv", "la", "lv", "septum", "av", "sl", "svc", "ivc", "pa", "pv", "aorta"];
const name = (id: PartId) => capT(heartLabel(id));
const CONFUSE: Record<PartId, PartId[]> = {
  ra: ["la", "rv", "svc"],
  rv: ["lv", "ra", "septum"],
  la: ["ra", "lv", "pv"],
  lv: ["rv", "la", "septum"],
  septum: ["lv", "rv", "av"],
  av: ["sl", "septum", "rv"],
  sl: ["av", "aorta", "pa"],
  svc: ["ivc", "pa", "aorta"],
  ivc: ["svc", "pv", "aorta"],
  pa: ["aorta", "pv", "svc"],
  pv: ["pa", "svc", "aorta"],
  aorta: ["pa", "svc", "pv"],
};
const MIRROR = tx(
  "The classic trap! The heart is drawn from the front, as if the person faced you. Their **right** half is on the **left** of the picture.",
  "Die klassische Falle! Das Herz ist von vorn gezeichnet, als stündest du dem Menschen gegenüber. Seine **rechte** Hälfte ist **links** im Bild.",
);
function partTrap(right: PartId, picked: PartId): { title: Text; say: Text } {
  const pair = `${right}>${picked}`;
  if (["ra>la", "la>ra", "rv>lv", "lv>rv"].includes(pair)) return { title: tx("Sides swapped", "Seiten vertauscht"), say: MIRROR };
  if (["ra>rv", "la>lv", "rv>ra", "lv>la"].includes(pair)) return { title: tx("Atrium or ventricle?", "Vorhof oder Kammer?"), say: tx("The atria sit on top and collect the blood; the ventricles below have the thick muscle walls and pump.", "Die Vorhöfe liegen oben und sammeln das Blut. Die Kammern darunter haben die dicken Muskelwände und pumpen.") };
  if (pair === "pa>aorta" || pair === "aorta>pa") return { title: tx("Two arteries leave the heart", "Zwei Arterien verlassen das Herz"), say: tx("The aorta leaves the left ventricle (oxygen-rich, red); the pulmonary artery leaves the right ventricle (oxygen-poor, blue). Which ventricle does the marked vessel come from?", "Die Aorta kommt aus der linken Kammer (sauerstoffreich, rot), die Lungenarterie aus der rechten Kammer (sauerstoffarm, blau). Aus welcher Kammer kommt das markierte Gefäß?") };
  if (pair === "pa>pv" || pair === "pv>pa") return { title: tx("Artery or vein?", "Arterie oder Vene?"), say: tx("Arteries lead away from the heart, veins lead to it, whatever the oxygen. Does the marked vessel leave a ventricle or enter an atrium?", "Arterien führen vom Herzen weg, Venen zum Herzen hin, egal wie viel Sauerstoff. Verlässt das markierte Gefäß eine Kammer oder mündet es in einen Vorhof?") };
  if (pair === "svc>ivc" || pair === "ivc>svc") return { title: tx("Upper or lower?", "Oben oder unten?"), say: tx("The superior vena cava comes from above (head and arms), the inferior one from below (trunk and legs).", "Die obere Hohlvene kommt von oben (Kopf und Arme), die untere von unten (Rumpf und Beine).") };
  if (pair === "av>sl" || pair === "sl>av") return { title: tx("Which valves?", "Welche Klappen?"), say: tx("AV valves (Segelklappen) sit between atrium and ventricle; semilunar valves (Taschenklappen) at the exits of the ventricles.", "Segelklappen sitzen zwischen Vorhof und Kammer, Taschenklappen am Ausgang der Kammern.") };
  if (right === "septum") return { title: tx("The wall in between", "Die Wand dazwischen"), say: tx("The marker sits on the muscle wall between the two ventricles, not in a chamber.", "Die Markierung sitzt auf der Muskelwand zwischen den beiden Kammern, nicht in einer Kammer.") };
  return { title: tx("Another part", "Ein anderer Teil"), say: tx("Look where the marker sits: atria on top, ventricles below, the person's right half on the left of the picture.", "Schau, wo die Markierung sitzt: Vorhöfe oben, Kammern unten, die rechte Hälfte des Menschen links im Bild.") };
}
const PART_WHY: Record<PartId, Text> = {
  ra: tx("Top left in the picture = the person's right atrium. The venae cavae open into it.", "Oben links im Bild = rechter Vorhof des Menschen. In ihn münden die Hohlvenen."),
  rv: tx("Bottom left in the picture = the person's right ventricle. Its wall is thinner; it pumps into the pulmonary artery.", "Unten links im Bild = rechte Herzkammer des Menschen. Ihre Wand ist dünner, sie pumpt in die Lungenarterie."),
  la: tx("Top right in the picture = the person's left atrium. The pulmonary veins open into it.", "Oben rechts im Bild = linker Vorhof des Menschen. In ihn münden die Lungenvenen."),
  lv: tx("Bottom right in the picture = the person's left ventricle, with the thickest wall. It pumps into the aorta.", "Unten rechts im Bild = linke Herzkammer des Menschen, mit der dicksten Wand. Sie pumpt in die Aorta."),
  septum: tx("The septum separates the right and left halves of the heart.", "Die Herzscheidewand trennt rechte und linke Herzhälfte."),
  av: tx("Between atrium and ventricle sit the AV valves (Segelklappen), held by tendons.", "Zwischen Vorhof und Kammer sitzen die Segelklappen, gehalten von Sehnenfäden."),
  sl: tx("At the exits into the aorta and pulmonary artery sit the semilunar valves (Taschenklappen).", "Am Ausgang zu Aorta und Lungenarterie sitzen die Taschenklappen."),
  svc: tx("The superior vena cava brings oxygen-poor blood from above into the right atrium.", "Die obere Hohlvene bringt sauerstoffarmes Blut von oben in den rechten Vorhof."),
  ivc: tx("The inferior vena cava brings oxygen-poor blood from below into the right atrium.", "Die untere Hohlvene bringt sauerstoffarmes Blut von unten in den rechten Vorhof."),
  pa: tx("The pulmonary artery leaves the right ventricle and carries oxygen-poor blood to the lungs.", "Die Lungenarterie verlässt die rechte Kammer und führt sauerstoffarmes Blut zur Lunge."),
  pv: tx("The pulmonary veins bring oxygen-rich blood from the lungs into the left atrium.", "Die Lungenvenen bringen sauerstoffreiches Blut aus der Lunge in den linken Vorhof."),
  aorta: tx("The aorta leaves the left ventricle and arches over the heart.", "Die Aorta verlässt die linke Kammer und macht einen Bogen über das Herz."),
};

function heartPartTask(rng: Rng, fixed?: PartId): Exercise {
  const id = fixed ?? rng.pick(PART_IDS);
  const opts: Opt[] = [{ text: name(id) }, ...CONFUSE[id].map((c) => ({ text: name(c), ...partTrap(id, c) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("The heart, seen from the front. What is the part marked **?** called?", "Das Herz von vorn gesehen. Wie heißt der mit **?** markierte Teil?"),
    visual: visual(HeartSection, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("The person faces you: their right half is on the left of the picture. Atria on top, ventricles below.", "Der Mensch steht dir gegenüber: Seine rechte Hälfte ist links im Bild. Vorhöfe oben, Kammern unten."),
    solution: answerFrames(name(id), PART_WHY[id]),
    mistakes: list,
  };
}

const ACCEPT: Record<PartId, Text[]> = {
  ra: [tx("right atrium", "rechter Vorhof"), "rechtes Atrium", "rechter Vorhof"],
  rv: [tx("right ventricle", "rechte Herzkammer"), "rechte Kammer", "rechter Ventrikel"],
  la: [tx("left atrium", "linker Vorhof"), "linkes Atrium"],
  lv: [tx("left ventricle", "linke Herzkammer"), "linke Kammer", "linker Ventrikel"],
  septum: [tx("septum", "Herzscheidewand"), "Scheidewand", "Septum", "Kammerscheidewand"],
  av: [tx("atrioventricular valve", "Segelklappe"), "Segelklappen", "AV-Klappe", "AV-Klappen", "AV valve", "atrioventricular valves"],
  sl: [tx("semilunar valve", "Taschenklappe"), "Taschenklappen", "semilunar valves"],
  svc: [tx("superior vena cava", "obere Hohlvene"), "vena cava superior"],
  ivc: [tx("inferior vena cava", "untere Hohlvene"), "vena cava inferior"],
  pa: [tx("pulmonary artery", "Lungenarterie"), "Lungenschlagader", "Lungenarterien", "Truncus pulmonalis"],
  pv: [tx("pulmonary veins", "Lungenvenen"), "Lungenvene", "pulmonary vein"],
  aorta: [tx("aorta", "Aorta"), "Hauptschlagader", "Körperschlagader"],
};
const WORD_IDS: PartId[] = ["ra", "rv", "la", "lv", "septum", "av", "sl", "pa", "pv", "aorta"];

function heartPartWordTask(rng: Rng): Exercise {
  const id = rng.pick(WORD_IDS);
  const answer: AnswerSpec = { kind: "word", accept: ACCEPT[id], placeholder: tx("name of the part", "Name des Teils") };
  const m = mistakes(answer);
  for (const c of CONFUSE[id]) {
    const t = partTrap(id, c);
    m.add({ kind: "word", accept: ACCEPT[c] }, t.title, t.say);
  }
  return {
    instruction: tx("Name the structure", "Benenne die Struktur"),
    text: tx("Type the name of the part marked **?**.", "Schreib den Namen des mit **?** markierten Teils."),
    visual: visual(HeartSection, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("Right half on the left of the picture; atria on top, ventricles below; arteries leave the heart, veins enter it.", "Rechte Hälfte links im Bild, Vorhöfe oben, Kammern unten, Arterien verlassen das Herz, Venen münden hinein."),
    solution: answerFrames(name(id), PART_WHY[id]),
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// The way of the blood

function bloodPathTask(rng: Rng, fixed?: { start: number; len: number }): Exercise {
  const start = fixed?.start ?? rng.int(0, PATH.length - 1);
  const len = fixed?.len ?? rng.pick([5, 6]);
  const stations = Array.from({ length: len }, (_, i) => PATH[(start + i) % PATH.length]);
  const items = stations.map((s) => s.name);
  const ids = stations.map((s) => s.id);
  const before = (a: string, b: string) => ids.includes(a) && ids.includes(b) && ids.indexOf(a) < ids.indexOf(b);
  const list: Mistake[] = [];
  const add = (a: string, b: string, title: Text, say: Text) => {
    if (before(a, b)) list.push({ when: { kind: "order", items: [pathName(b), pathName(a)] }, title, say });
  };
  add("ra", "rv", tx("Atrium first", "Erst der Vorhof"), tx("Blood arrives in the atrium; the ventricle below pumps it out. So: atrium, then ventricle.", "Das Blut kommt im Vorhof an, die Kammer darunter pumpt es hinaus. Also: erst Vorhof, dann Kammer."));
  add("la", "lv", tx("Atrium first", "Erst der Vorhof"), tx("Blood arrives in the atrium; the ventricle below pumps it out. So: atrium, then ventricle.", "Das Blut kommt im Vorhof an, die Kammer darunter pumpt es hinaus. Also: erst Vorhof, dann Kammer."));
  add("pa", "pv", tx("There and back", "Hin und zurück"), tx("The pulmonary artery takes the blood **to** the lungs, the pulmonary veins bring it **back**.", "Die Lungenarterie bringt das Blut **zur** Lunge, die Lungenvenen bringen es **zurück**."));
  add("rv", "la", tx("No door in the septum", "Keine Tür in der Scheidewand"), tx("There's no opening between the right and left halves. From the right ventricle the blood first has to go through the lungs.", "Zwischen rechter und linker Hälfte gibt es keine Öffnung. Aus der rechten Kammer muss das Blut erst durch die Lunge."));
  add("vc", "ra", tx("Veins lead into the atrium", "Venen münden in den Vorhof"), tx("The venae cavae open into the right atrium: they come first.", "Die Hohlvenen münden in den rechten Vorhof: Sie kommen zuerst."));
  add("ao", "bc", tx("Aorta first", "Erst die Aorta"), tx("From the left ventricle the blood goes into the aorta and only then, through ever smaller arteries, into the capillaries.", "Aus der linken Kammer geht das Blut in die Aorta und erst dann über immer kleinere Arterien in die Kapillaren."));
  return {
    instruction: tx("The way of the blood", "Der Weg des Blutes"),
    text: tx(`Put the stations in the order the blood passes them. Start with: **${en(items[0])}**.`, `Bring die Stationen in die Reihenfolge, in der das Blut sie durchfließt. Beginne mit: **${de(items[0])}**.`),
    answer: { kind: "order", items, label: tx("in the direction of the blood flow", "in Fließrichtung des Blutes") },
    hint: tx("Atrium before ventricle; the right ventricle pumps to the lungs, the left one into the body.", "Vorhof vor Kammer. Die rechte Kammer pumpt zur Lunge, die linke in den Körper."),
    solution: orderFrames(items, stations.map((s) => s.note)),
    mistakes: list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Two circuits

const CH = {
  rv: capT(heartLabel("rv")),
  lv: capT(heartLabel("lv")),
  ra: capT(heartLabel("ra")),
  la: capT(heartLabel("la")),
};
const CIRCUIT_QUESTIONS: { q: Text; opts: Opt[]; why: Text }[] = [
  {
    q: tx("Which chamber pumps the blood into the **systemic circulation** (through the body)?", "Welche Herzkammer pumpt das Blut in den **Körperkreislauf**?"),
    opts: [
      { text: CH.lv },
      { text: CH.rv, title: tx("That's the lungs' pump", "Das ist die Pumpe der Lunge"), say: tx("The right ventricle pumps into the pulmonary circulation. The body is supplied by the left, stronger ventricle.", "Die rechte Kammer pumpt in den Lungenkreislauf. Den Körper versorgt die linke, kräftigere Kammer.") },
      { text: CH.la, title: tx("Atria don't pump into vessels", "Vorhöfe pumpen nicht in Gefäße"), say: tx("Atria collect the blood and pass it into the ventricles. Only the ventricles pump it into the arteries.", "Vorhöfe sammeln das Blut und geben es in die Kammern weiter. Erst die Kammern pumpen es in die Arterien.") },
      { text: CH.ra, title: tx("Atria don't pump into vessels", "Vorhöfe pumpen nicht in Gefäße"), say: tx("Atria collect the blood and pass it into the ventricles. Only the ventricles pump it into the arteries.", "Vorhöfe sammeln das Blut und geben es in die Kammern weiter. Erst die Kammern pumpen es in die Arterien.") },
    ],
    why: tx("The left ventricle pumps oxygen-rich blood into the aorta and so into the whole body.", "Die linke Kammer pumpt sauerstoffreiches Blut in die Aorta und damit in den ganzen Körper."),
  },
  {
    q: tx("Which chamber pumps the blood into the **pulmonary circulation**?", "Welche Herzkammer pumpt das Blut in den **Lungenkreislauf**?"),
    opts: [
      { text: CH.rv },
      { text: CH.lv, title: tx("That's the body's pump", "Das ist die Pumpe des Körpers"), say: tx("The left ventricle pumps into the aorta, i.e. the body. Oxygen-poor blood goes to the lungs from the right ventricle.", "Die linke Kammer pumpt in die Aorta, also in den Körper. Sauerstoffarmes Blut kommt aus der rechten Kammer zur Lunge.") },
      { text: CH.ra, title: tx("Atria don't pump into vessels", "Vorhöfe pumpen nicht in Gefäße"), say: tx("Atria collect the blood and pass it on to the ventricles.", "Vorhöfe sammeln das Blut und geben es an die Kammern weiter.") },
    ],
    why: tx("The right ventricle pumps oxygen-poor blood through the pulmonary artery to the lungs.", "Die rechte Kammer pumpt sauerstoffarmes Blut durch die Lungenarterie zur Lunge."),
  },
  {
    q: tx("Into which atrium does the blood from the **lungs** flow?", "In welchen Vorhof fließt das Blut aus der **Lunge**?"),
    opts: [
      { text: CH.la },
      { text: CH.ra, title: tx("Sides swapped", "Seiten vertauscht"), say: tx("The right atrium receives the blood from the body. Oxygen-rich blood from the lungs goes into the left half.", "Der rechte Vorhof bekommt das Blut aus dem Körper. Sauerstoffreiches Blut aus der Lunge kommt in die linke Hälfte.") },
      { text: CH.lv, title: tx("Atria receive", "Vorhöfe nehmen auf"), say: tx("Veins always open into an atrium; the ventricles pump out.", "Venen münden immer in einen Vorhof, die Kammern pumpen hinaus.") },
    ],
    why: tx("The pulmonary veins open into the left atrium.", "Die Lungenvenen münden in den linken Vorhof."),
  },
  {
    q: tx("Into which atrium does the blood from the **body** return?", "In welchen Vorhof kehrt das Blut aus dem **Körper** zurück?"),
    opts: [
      { text: CH.ra },
      { text: CH.la, title: tx("Sides swapped", "Seiten vertauscht"), say: tx("The left atrium receives oxygen-rich blood from the lungs. Oxygen-poor blood from the body goes into the right half.", "Der linke Vorhof bekommt sauerstoffreiches Blut aus der Lunge. Sauerstoffarmes Blut aus dem Körper kommt in die rechte Hälfte.") },
      { text: CH.rv, title: tx("Atria receive", "Vorhöfe nehmen auf"), say: tx("Veins always open into an atrium; the ventricles pump out.", "Venen münden immer in einen Vorhof, die Kammern pumpen hinaus.") },
    ],
    why: tx("The venae cavae open into the right atrium.", "Die Hohlvenen münden in den rechten Vorhof."),
  },
  {
    q: tx("Why does the left ventricle have a thicker wall than the right one?", "Warum hat die linke Herzkammer eine dickere Wand als die rechte?"),
    opts: [
      { text: tx("It has to pump the blood through the whole body, with much higher pressure.", "Sie muss das Blut mit viel höherem Druck durch den ganzen Körper pumpen.") },
      { text: tx("It pumps more blood per beat than the right ventricle.", "Sie pumpt pro Schlag mehr Blut als die rechte Kammer."), title: tx("Same amount, more pressure", "Gleiche Menge, mehr Druck"), say: tx("Both ventricles eject the same amount per beat, otherwise blood would pile up somewhere. The difference is the **pressure**: the body circuit is much longer.", "Beide Kammern werfen pro Schlag gleich viel Blut aus, sonst würde es sich irgendwo stauen. Der Unterschied ist der **Druck**: Der Körperkreislauf ist viel länger.") },
      { text: tx("It pumps oxygen-poor blood, which is heavier.", "Sie pumpt sauerstoffarmes Blut, das schwerer ist."), title: tx("Oxygen-rich blood", "Sauerstoffreiches Blut"), say: tx("The left ventricle pumps oxygen-rich blood, and oxygen hardly changes the weight. It's about the pressure.", "Die linke Kammer pumpt sauerstoffreiches Blut, und Sauerstoff ändert das Gewicht kaum. Es geht um den Druck.") },
      { text: tx("Because the heart lies on the left side of the body.", "Weil das Herz auf der linken Körperseite liegt."), title: tx("Position isn't the reason", "Die Lage ist nicht der Grund"), say: tx("The position has nothing to do with it. The left ventricle has to produce the high pressure for the whole body circuit.", "Die Lage hat damit nichts zu tun. Die linke Kammer muss den hohen Druck für den ganzen Körperkreislauf erzeugen.") },
    ],
    why: tx("The systemic circulation is long and branched: the left ventricle builds up about 120 mmHg, the right one only about 25 mmHg.", "Der Körperkreislauf ist lang und stark verzweigt: Die linke Kammer baut etwa 120 mmHg auf, die rechte nur etwa 25 mmHg."),
  },
  {
    q: tx("What happens to the blood in the pulmonary circulation?", "Was passiert mit dem Blut im Lungenkreislauf?"),
    opts: [
      { text: tx("It gives off carbon dioxide and takes up oxygen.", "Es gibt Kohlenstoffdioxid ab und nimmt Sauerstoff auf.") },
      { text: tx("It gives off oxygen and takes up carbon dioxide.", "Es gibt Sauerstoff ab und nimmt Kohlenstoffdioxid auf."), title: tx("That's the body capillaries", "Das sind die Körperkapillaren"), say: tx("That happens in the body capillaries. In the lungs it's the other way round: oxygen in, carbon dioxide out.", "Das passiert in den Körperkapillaren. In der Lunge ist es umgekehrt: Sauerstoff rein, Kohlenstoffdioxid raus.") },
      { text: tx("It takes up nutrients.", "Es nimmt Nährstoffe auf."), title: tx("Nutrients come from the gut", "Nährstoffe kommen aus dem Darm"), say: tx("Nutrients enter the blood in the intestine, which belongs to the systemic circulation.", "Nährstoffe gelangen im Darm ins Blut, und der gehört zum Körperkreislauf.") },
    ],
    why: tx("In the lung capillaries the blood is loaded with oxygen and unloads carbon dioxide.", "In den Lungenkapillaren wird das Blut mit Sauerstoff beladen und gibt Kohlenstoffdioxid ab."),
  },
];

const CIRCUITS: Text[] = [tx("Pulmonary circulation", "Lungenkreislauf"), tx("Systemic circulation", "Körperkreislauf")];
const CIRCUIT_OF: { id: string; lung: boolean }[] = [
  { id: "pa", lung: true },
  { id: "pv", lung: true },
  { id: "lc", lung: true },
  { id: "ao", lung: false },
  { id: "vc", lung: false },
  { id: "bc", lung: false },
];

function circuitTask(rng: Rng): Exercise {
  if (rng.chance(0.3)) {
    const c = rng.pick(CIRCUIT_OF);
    const answer: AnswerSpec = { kind: "choice", options: CIRCUITS, correct: c.lung ? 0 : 1 };
    const n = pathName(c.id);
    return {
      instruction: tx("Which circuit?", "Welcher Kreislauf?"),
      text: tx(`Which circuit does this belong to: **${en(n)}**?`, `Zu welchem Kreislauf gehört das: **${de(n)}**?`),
      answer,
      hint: tx("Pulmonary circulation: right ventricle → lungs → left atrium. Systemic: left ventricle → body → right atrium.", "Lungenkreislauf: rechte Kammer → Lunge → linker Vorhof. Körperkreislauf: linke Kammer → Körper → rechter Vorhof."),
      solution: answerFrames(CIRCUITS[c.lung ? 0 : 1], PATH.find((p) => p.id === c.id)!.note),
      mistakes: [
        {
          when: { kind: "choice", options: CIRCUITS, correct: c.lung ? 1 : 0 },
          title: tx("Other circuit", "Anderer Kreislauf"),
          say: c.lung
            ? tx("Everything between the right ventricle and the left atrium belongs to the pulmonary circulation, even though 'veins' and 'arteries' sound like the body.", "Alles zwischen rechter Kammer und linkem Vorhof gehört zum Lungenkreislauf, auch wenn »Arterie« und »Vene« nach Körper klingen.")
            : tx("Everything between the left ventricle and the right atrium belongs to the systemic circulation.", "Alles zwischen linker Kammer und rechtem Vorhof gehört zum Körperkreislauf."),
        },
      ],
    };
  }
  const Q = rng.pick(CIRCUIT_QUESTIONS);
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("The double circulation", "Der doppelte Kreislauf"),
    text: Q.q,
    answer,
    hint: tx("Right half: oxygen-poor, to the lungs. Left half: oxygen-rich, into the body.", "Rechte Hälfte: sauerstoffarm, zur Lunge. Linke Hälfte: sauerstoffreich, in den Körper."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Oxygen-rich or oxygen-poor?

const RICH_POOR: Text[] = [tx("oxygen-rich", "sauerstoffreich"), tx("oxygen-poor", "sauerstoffarm")];
type VesselO2 = { name: Text; inText: Text; rich: boolean; artery: boolean; why: Text };
const VESSELS_O2: VesselO2[] = [
  { name: tx("pulmonary artery", "Lungenarterie"), inText: tx("in the pulmonary artery", "in der Lungenarterie"), rich: false, artery: true, why: tx("It leaves the right ventricle and carries oxygen-poor blood to the lungs. An artery, because it leads **away from** the heart.", "Sie verlässt die rechte Kammer und bringt sauerstoffarmes Blut zur Lunge. Eine Arterie, weil sie **vom** Herzen wegführt.") },
  { name: tx("pulmonary veins", "Lungenvenen"), inText: tx("in the pulmonary veins", "in den Lungenvenen"), rich: true, artery: false, why: tx("They come straight from the lungs, freshly loaded with oxygen. Veins, because they lead **to** the heart.", "Sie kommen direkt aus der Lunge, frisch mit Sauerstoff beladen. Venen, weil sie **zum** Herzen führen.") },
  { name: tx("aorta (main artery)", "Aorta (Hauptschlagader)"), inText: tx("in the aorta", "in der Aorta"), rich: true, artery: true, why: tx("It leaves the left ventricle with oxygen-rich blood for the body.", "Sie verlässt die linke Kammer mit sauerstoffreichem Blut für den Körper.") },
  { name: tx("venae cavae", "Hohlvenen"), inText: tx("in the venae cavae", "in den Hohlvenen"), rich: false, artery: false, why: tx("They bring blood back from the body, where it has given off its oxygen.", "Sie bringen Blut aus dem Körper zurück, wo es seinen Sauerstoff abgegeben hat.") },
  { name: tx("carotid artery (to the head)", "Halsschlagader (zum Kopf)"), inText: tx("in the carotid artery (to the head)", "in der Halsschlagader (zum Kopf)"), rich: true, artery: true, why: tx("A branch of the aorta: oxygen-rich blood for the brain.", "Ein Ast der Aorta: sauerstoffreiches Blut für das Gehirn.") },
  { name: tx("leg vein", "Beinvene"), inText: tx("in a leg vein", "in einer Beinvene"), rich: false, artery: false, why: tx("It brings blood back from the leg muscles, which have used its oxygen.", "Sie bringt Blut aus den Beinmuskeln zurück, die seinen Sauerstoff verbraucht haben.") },
];

function o2Trap(v: VesselO2): { title: Text; say: Text } {
  if (v.artery && !v.rich) return { title: tx("Artery ≠ oxygen-rich", "Arterie ≠ sauerstoffreich"), say: tx("The classic trap! An artery is defined by its **direction** (away from the heart), not by its oxygen. The pulmonary artery carries oxygen-poor blood to the lungs.", "Die klassische Falle! Eine Arterie ist durch ihre **Richtung** festgelegt (vom Herzen weg), nicht durch ihren Sauerstoff. Die Lungenarterie bringt sauerstoffarmes Blut zur Lunge.") };
  if (!v.artery && v.rich) return { title: tx("Vein ≠ oxygen-poor", "Vene ≠ sauerstoffarm"), say: tx("Veins lead **to** the heart, whatever their oxygen. The pulmonary veins come straight from the lungs: oxygen-rich!", "Venen führen **zum** Herzen, egal wie viel Sauerstoff sie haben. Die Lungenvenen kommen direkt aus der Lunge: sauerstoffreich!") };
  return { title: tx("Where does it come from?", "Woher kommt das Blut?"), say: v.rich ? tx("Ask where the blood comes from: this vessel gets it from the left heart, which receives it straight from the lungs.", "Frag dich, woher das Blut kommt: Dieses Gefäß bekommt es aus dem linken Herzen, das es direkt aus der Lunge erhält.") : tx("Ask where the blood comes from: it has passed through the body and given off its oxygen.", "Frag dich, woher das Blut kommt: Es ist durch den Körper geflossen und hat seinen Sauerstoff abgegeben.") };
}

function vesselO2Task(rng: Rng, fixed?: number): Exercise {
  const v = fixed !== undefined ? VESSELS_O2[fixed] : rng.pick(VESSELS_O2);
  const answer: AnswerSpec = { kind: "choice", options: RICH_POOR, correct: v.rich ? 0 : 1 };
  const t = o2Trap(v);
  return {
    instruction: tx("Oxygen-rich or oxygen-poor?", "Sauerstoffreich oder sauerstoffarm?"),
    text: tx(`Is the blood **${en(v.inText)}** oxygen-rich or oxygen-poor?`, `Fließt **${de(v.inText)}** sauerstoffreiches oder sauerstoffarmes Blut?`),
    answer,
    hint: tx("Don't go by the word artery or vein. Ask: where does this blood come from?", "Verlass dich nicht auf das Wort Arterie oder Vene. Frag dich: Woher kommt dieses Blut?"),
    solution: [
      { math: join2(v.name, v.artery ? tx("away from the heart", "vom Herzen weg") : tx("to the heart", "zum Herzen hin")), note: v.artery ? tx("An artery: it leads away from the heart.", "Eine Arterie: Sie führt vom Herzen weg.") : tx("A vein: it leads to the heart.", "Eine Vene: Sie führt zum Herzen hin.") },
      { math: q(RICH_POOR[v.rich ? 0 : 1], "a"), note: v.why, highlight: ["a"] },
    ],
    mistakes: [{ when: { kind: "choice", options: RICH_POOR, correct: v.rich ? 1 : 0 }, title: t.title, say: t.say }],
  };
}
const join2 = (a: Text, b: Text): Text => tx(`"${en(a)}"#x \\to "${en(b)}"#y`, `"${de(a)}"#x \\to "${de(b)}"#y`);

function whichVesselTask(rng: Rng): Exercise {
  const askPa = rng.chance(0.5);
  const P = (id: string) => capT(pathName(id));
  const opts: Opt[] = askPa
    ? [
        { text: P("pa") },
        { text: P("pv"), title: tx("Direction!", "Richtung!"), say: tx("Veins lead **to** the heart. You need a vessel that leads away from it.", "Venen führen **zum** Herzen. Gesucht ist ein Gefäß, das vom Herzen wegführt.") },
        { text: P("ao"), title: tx("The aorta is oxygen-rich", "Die Aorta ist sauerstoffreich"), say: tx("The aorta leads away from the heart, but its blood is oxygen-rich. Which artery carries oxygen-poor blood?", "Die Aorta führt vom Herzen weg, ihr Blut ist aber sauerstoffreich. Welche Arterie führt sauerstoffarmes Blut?") },
        { text: P("vc"), title: tx("Direction!", "Richtung!"), say: tx("The venae cavae are oxygen-poor, right, but they lead **to** the heart.", "Die Hohlvenen sind zwar sauerstoffarm, führen aber **zum** Herzen.") },
      ]
    : [
        { text: P("pv") },
        { text: P("pa"), title: tx("Direction!", "Richtung!"), say: tx("The pulmonary artery leads **away** from the heart, and its blood is oxygen-poor.", "Die Lungenarterie führt **vom** Herzen weg, und ihr Blut ist sauerstoffarm.") },
        { text: P("ao"), title: tx("Direction!", "Richtung!"), say: tx("The aorta is oxygen-rich, right, but it leads **away** from the heart.", "Die Aorta ist zwar sauerstoffreich, führt aber **vom** Herzen weg.") },
        { text: P("vc"), title: tx("The venae cavae are oxygen-poor", "Die Hohlvenen sind sauerstoffarm"), say: tx("The venae cavae lead to the heart, but their blood is oxygen-poor. Which vein carries oxygen-rich blood?", "Die Hohlvenen führen zum Herzen, ihr Blut ist aber sauerstoffarm. Welche Vene führt sauerstoffreiches Blut?") },
      ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Find the vessel", "Finde das Gefäß"),
    text: askPa
      ? tx("Which vessel carries **oxygen-poor** blood **away from** the heart?", "Welches Gefäß führt **sauerstoffarmes** Blut **vom Herzen weg**?")
      : tx("Which vessel carries **oxygen-rich** blood **to** the heart?", "Welches Gefäß führt **sauerstoffreiches** Blut **zum Herzen hin**?"),
    answer,
    hint: tx("Two conditions: the direction decides artery or vein; the circuit decides the oxygen.", "Zwei Bedingungen: Die Richtung entscheidet über Arterie oder Vene, der Kreislauf über den Sauerstoff."),
    solution: answerFrames(opts[0].text, askPa ? VESSELS_O2[0].why : VESSELS_O2[1].why),
    mistakes: list,
  };
}

function o2MultiTask(rng: Rng): Exercise {
  const askRich = rng.chance(0.6);
  const pool = [VESSELS_O2[0], VESSELS_O2[1], ...rng.shuffle(VESSELS_O2.slice(2)).slice(0, 3)];
  const M = multi(rng, pool.map((v) => ({ text: capT(v.name), ok: v.rich === askRich })));
  const m = mistakes(M.answer);
  const byText = (x: { text: Text }) => pool.find((v) => en(capT(v.name)) === en(x.text))!;
  const key = askRich ? VESSELS_O2[1] : VESSELS_O2[0];
  m.add(
    { kind: "multi", options: M.options, correct: M.pick((x) => x.ok && byText(x) !== key) },
    askRich ? tx("Vein ≠ oxygen-poor", "Vene ≠ sauerstoffarm") : tx("Artery ≠ oxygen-rich", "Arterie ≠ sauerstoffreich"),
    askRich ? tx("Almost! The pulmonary veins come straight from the lungs: oxygen-rich, even though they are veins.", "Fast! Die Lungenvenen kommen direkt aus der Lunge: sauerstoffreich, obwohl sie Venen sind.") : tx("Almost! The pulmonary artery carries oxygen-poor blood to the lungs, even though it is an artery.", "Fast! Die Lungenarterie bringt sauerstoffarmes Blut zur Lunge, obwohl sie eine Arterie ist."),
  );
  m.add({ kind: "multi", options: M.options, correct: M.pick((x) => byText(x).artery === askRich) }, askRich ? tx("Artery ≠ oxygen-rich", "Arterie ≠ sauerstoffreich") : tx("Vein ≠ oxygen-poor", "Vene ≠ sauerstoffarm"), askRich ? tx("You picked exactly the arteries. But the pulmonary artery carries oxygen-poor blood, and the pulmonary veins oxygen-rich blood!", "Du hast genau die Arterien gewählt. Aber die Lungenarterie führt sauerstoffarmes Blut und die Lungenvenen sauerstoffreiches!") : tx("You picked exactly the veins. But the pulmonary veins carry oxygen-rich blood, and the pulmonary artery oxygen-poor blood!", "Du hast genau die Venen gewählt. Aber die Lungenvenen führen sauerstoffreiches Blut und die Lungenarterie sauerstoffarmes!"));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: askRich ? tx("Which vessels carry **oxygen-rich** blood?", "Welche Gefäße führen **sauerstoffreiches** Blut?") : tx("Which vessels carry **oxygen-poor** blood?", "Welche Gefäße führen **sauerstoffarmes** Blut?"),
    answer: M.answer,
    hint: tx("Oxygen-rich: everything from the lungs to the body capillaries. Oxygen-poor: everything from the body capillaries to the lungs.", "Sauerstoffreich: alles von der Lunge bis zu den Körperkapillaren. Sauerstoffarm: alles von den Körperkapillaren bis zur Lunge."),
    solution: multiFrames(askRich ? tx("oxygen-rich:", "sauerstoffreich:") : tx("oxygen-poor:", "sauerstoffarm:"), M.correct.map((i) => M.options[i]), tx("It's not the name that counts but where the blood comes from.", "Nicht der Name zählt, sondern woher das Blut kommt.")),
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Artery, vein, capillary

const VESSEL_FEATURES: Record<"artery" | "vein" | "capillary", Text[]> = {
  artery: [tx("thick, elastic wall with lots of muscle", "dicke, elastische Wand mit viel Muskulatur"), tx("high pressure; you can feel the pulse", "hoher Druck, hier fühlst du den Puls"), tx("leads away from the heart", "führt vom Herzen weg")],
  vein: [tx("thinner wall and a wide lumen", "dünnere Wand und weites Lumen"), tx("valves stop the blood flowing back", "Klappen verhindern, dass Blut zurückfließt"), tx("leads to the heart", "führt zum Herzen hin")],
  capillary: [tx("wall of a single cell layer", "Wand aus einer einzigen Zellschicht"), tx("substances are exchanged here", "hier findet der Stoffaustausch statt"), tx("so narrow that red blood cells pass in single file", "so eng, dass rote Blutkörperchen einzeln hindurchpassen")],
};
const VESSEL_NAMES = { artery: tx("Artery", "Arterie"), vein: tx("Vein", "Vene"), capillary: tx("Capillary", "Kapillare") };
const FALSE_FEATURES: Text[] = [tx("always carries oxygen-rich blood", "führt immer sauerstoffreiches Blut"), tx("pumps the blood like a small heart", "pumpt das Blut wie ein kleines Herz")];

function vesselMatchTask(rng: Rng): Exercise {
  const k = (["artery", "vein", "capillary"] as const).map((v) => ({ v, f: rng.int(0, 2) }));
  const pairs = k.map(({ v, f }) => [VESSEL_NAMES[v], VESSEL_FEATURES[v][f]] as [Text, Text]);
  const distractors = [rng.pick(FALSE_FEATURES)];
  const list: Mistake[] = [];
  const art = pairs[0];
  const vein = pairs[1];
  if (k[0].f === 0 || k[1].f === 0) list.push({ when: { kind: "match", pairs: [[vein[0], art[1]]] }, title: tx("Veins have thin walls", "Venen haben dünne Wände"), say: tx("Arteries have to withstand the high pressure of the heart: they have the thick, muscular wall. Veins have thinner walls.", "Arterien müssen den hohen Druck des Herzens aushalten: Sie haben die dicke, muskulöse Wand. Venen haben dünnere Wände.") });
  if (en(distractors[0]).startsWith("always")) list.push({ when: { kind: "match", pairs: [[art[0], distractors[0]]] }, title: tx("Artery ≠ oxygen-rich", "Arterie ≠ sauerstoffreich"), say: tx("Careful: the pulmonary artery is an artery with oxygen-poor blood. Arteries are defined by their direction.", "Vorsicht: Die Lungenarterie ist eine Arterie mit sauerstoffarmem Blut. Arterien sind durch ihre Richtung festgelegt.") });
  list.push({ when: { kind: "match", pairs: [[art[0], vein[1]], [vein[0], art[1]]] }, title: tx("Artery and vein swapped", "Arterie und Vene vertauscht"), say: tx("You swapped artery and vein. Arteries: away from the heart, thick wall, high pressure. Veins: to the heart, thin wall, valves.", "Du hast Arterie und Vene vertauscht. Arterien: vom Herzen weg, dicke Wand, hoher Druck. Venen: zum Herzen hin, dünne Wand, Klappen.") });
  return {
    instruction: tx("Match the vessels", "Ordne die Gefäße zu"),
    text: tx("Match each blood vessel with a feature. One feature fits none of them.", "Ordne jedem Blutgefäß ein Merkmal zu. Ein Merkmal passt zu keinem."),
    answer: { kind: "match", pairs, distractors },
    hint: tx("Think of the pressure: high in arteries, low in veins. Exchange needs thin walls.", "Denk an den Druck: hoch in Arterien, niedrig in Venen. Austausch braucht dünne Wände."),
    solution: [
      ...pairs.map(([a, b], i) => ({ math: tx(`"${en(a)}"#a${i} \\to "${en(b)}"#b${i}`, `"${de(a)}"#a${i} \\to "${de(b)}"#b${i}`), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`) }) as Frame),
      { math: q(distractors[0], "x"), note: tx("This one fits none of them.", "Das passt zu keinem."), highlight: ["x"] },
    ],
    mistakes: list,
  };
}

type VesselPart = "artery" | "vein" | "capillary" | "valve" | "media" | "endothelium";
const VESSEL_PICTURE: Record<VesselPart, { name: Text; opts: VesselPart[]; why: Text }> = {
  artery: { name: tx("Artery", "Arterie"), opts: ["vein", "capillary"], why: tx("Thick, muscular wall and a narrow, round lumen: an artery.", "Dicke, muskulöse Wand und ein enges, rundes Lumen: eine Arterie.") },
  vein: { name: tx("Vein", "Vene"), opts: ["artery", "capillary"], why: tx("Thin wall and a wide, often squashed lumen: a vein.", "Dünne Wand und ein weites, oft zusammengedrücktes Lumen: eine Vene.") },
  capillary: { name: tx("Capillary", "Kapillare"), opts: ["artery", "vein"], why: tx("Just wide enough for one red blood cell, with a wall of one cell layer: a capillary.", "Gerade so breit wie ein rotes Blutkörperchen, mit einer Wand aus einer Zellschicht: eine Kapillare.") },
  valve: { name: tx("Venous valve", "Venenklappe"), opts: ["media", "endothelium"], why: tx("Pocket-shaped flaps in the vein: venous valves let blood flow only towards the heart.", "Taschenförmige Klappen in der Vene: Venenklappen lassen das Blut nur zum Herzen hin fließen.") },
  media: { name: tx("Muscle layer with elastic fibres", "Muskelschicht mit elastischen Fasern"), opts: ["endothelium", "valve"], why: tx("The thick middle layer of the artery wall: muscle and elastic fibres.", "Die dicke mittlere Schicht der Arterienwand: Muskulatur und elastische Fasern.") },
  endothelium: { name: tx("Wall of one cell layer", "Wand aus einer Zellschicht"), opts: ["media", "valve"], why: tx("A capillary wall is just one thin cell layer.", "Die Wand einer Kapillare ist nur eine dünne Zellschicht.") },
};
const VALVE_TRAP = tx("Semilunar valves (Taschenklappen)", "Taschenklappe");

function vesselPictureTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(VESSEL_PICTURE) as VesselPart[]);
  const V = VESSEL_PICTURE[id];
  const opts: Opt[] = [
    { text: V.name },
    ...V.opts.map((o) => ({
      text: VESSEL_PICTURE[o].name,
      title: tx("Look at the wall", "Schau auf die Wand"),
      say:
        id === "vein" && o === "artery"
          ? tx("Arteries have a thick muscular wall and a narrow, round lumen. Here the wall is thin and the lumen wide.", "Arterien haben eine dicke Muskelwand und ein enges, rundes Lumen. Hier ist die Wand dünn und das Lumen weit.")
          : id === "artery" && o === "vein"
            ? tx("Veins have thin walls and a wide lumen. Here the wall is thick and muscular.", "Venen haben dünne Wände und ein weites Lumen. Hier ist die Wand dick und muskulös.")
            : tx(`That's another structure. ${en(V.why)}`, `Das ist eine andere Struktur. ${de(V.why)}`),
    })),
    ...(id === "valve" ? [{ text: VALVE_TRAP, title: tx("Not in the heart", "Nicht im Herzen"), say: tx("Semilunar valves sit in the heart at the exits of the ventricles. This valve lies inside a vein.", "Taschenklappen sitzen im Herzen am Ausgang der Kammern. Diese Klappe liegt in einer Vene.") }] : []),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Blood vessels in section", "Blutgefäße im Schnitt"),
    text: tx("What is marked with **?**", "Was ist mit **?** markiert?"),
    visual: visual(HeartVessels, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("Thick muscular wall: artery. Thin wall, wide lumen: vein. One cell layer: capillary.", "Dicke Muskelwand: Arterie. Dünne Wand, weites Lumen: Vene. Eine Zellschicht: Kapillare."),
    solution: answerFrames(V.name, V.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Blood components

type Comp = "rbc" | "wbc" | "platelet" | "plasma";
const COMP: Record<Comp, { name: Text; job: Text }> = {
  rbc: { name: tx("Red blood cells (erythrocytes)", "Rote Blutkörperchen (Erythrozyten)"), job: tx("carry oxygen with haemoglobin", "transportieren mit Hämoglobin Sauerstoff") },
  wbc: { name: tx("White blood cells (leucocytes)", "Weiße Blutkörperchen (Leukozyten)"), job: tx("fight pathogens", "wehren Krankheitserreger ab") },
  platelet: { name: tx("Platelets (thrombocytes)", "Blutplättchen (Thrombozyten)"), job: tx("make blood clot and seal wounds", "sorgen für die Blutgerinnung") },
  plasma: { name: tx("Blood plasma", "Blutplasma"), job: tx("carries dissolved nutrients, salts and hormones", "transportiert gelöste Nährstoffe, Salze und Hormone") },
};

function bloodComponentTask(rng: Rng): Exercise {
  const v = rng.int(0, 3);
  if (v === 0) {
    const ids = rng.shuffle(Object.keys(COMP) as Comp[]).slice(0, rng.int(3, 4));
    const pairs = ids.map((c) => [COMP[c].name, COMP[c].job] as [Text, Text]);
    const list: Mistake[] = [];
    if (ids.includes("wbc") && ids.includes("platelet")) list.push({ when: { kind: "match", pairs: [[COMP.wbc.name, COMP.platelet.job], [COMP.platelet.name, COMP.wbc.job]] }, title: tx("White cells and platelets swapped", "Leukozyten und Thrombozyten vertauscht"), say: tx("White blood cells fight pathogens; the tiny platelets plug wounds.", "Weiße Blutkörperchen wehren Erreger ab, die winzigen Blutplättchen verschließen Wunden.") });
    if (ids.includes("rbc") && ids.includes("wbc")) list.push({ when: { kind: "match", pairs: [[COMP.wbc.name, COMP.rbc.job]] }, title: tx("Red carries oxygen", "Rot trägt Sauerstoff"), say: tx("The red colour comes from haemoglobin, the oxygen carrier. So the **red** cells carry the oxygen.", "Die rote Farbe kommt vom Hämoglobin, dem Sauerstoffträger. Also transportieren die **roten** Blutkörperchen den Sauerstoff.") });
    return {
      instruction: tx("Match the components", "Ordne die Bestandteile zu"),
      text: tx("Match each component of blood with its job.", "Ordne jedem Blutbestandteil seine Aufgabe zu."),
      answer: { kind: "match", pairs },
      hint: tx("Red: oxygen. White: defence. Platelets: clotting. Plasma: the liquid that carries dissolved substances.", "Rot: Sauerstoff. Weiß: Abwehr. Plättchen: Gerinnung. Plasma: die Flüssigkeit, die gelöste Stoffe transportiert."),
      solution: pairs.map(([a, b], i) => ({ math: tx(`"${en(a)}"#a${i} \\to "${en(b)}"#b${i}`, `"${de(a)}"#a${i} \\to "${de(b)}"#b${i}`), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`) })),
      mistakes: list,
    };
  }
  if (v === 1) {
    const id = rng.pick(Object.keys(COMP) as Comp[]);
    const opts: Opt[] = [
      { text: COMP[id].name },
      ...(Object.keys(COMP) as Comp[])
        .filter((c) => c !== id)
        .map((c) => ({ text: COMP[c].name, title: tx("Look at size and nucleus", "Achte auf Größe und Kern"), say: tx("Red cells: red discs without a nucleus. White cells: bigger, with a nucleus. Platelets: tiny fragments. Plasma: the liquid.", "Rote Blutkörperchen: rote Scheiben ohne Kern. Weiße: größer, mit Kern. Blutplättchen: winzige Bruchstücke. Plasma: die Flüssigkeit.") })),
    ];
    const { answer, mistakes: list } = choice(rng, opts);
    return {
      instruction: tx("Blood under the microscope", "Blut unter dem Mikroskop"),
      text: tx("What is marked with **?**", "Was ist mit **?** markiert?"),
      visual: visual(HeartBloodCells, { mode: "numbers", ask: id, legend: "none" }),
      answer,
      hint: tx("Red discs, big cells with a nucleus, tiny fragments, or the liquid?", "Rote Scheiben, große Zellen mit Kern, winzige Bruchstücke oder die Flüssigkeit?"),
      solution: answerFrames(COMP[id].name, tx(`${en(COMP[id].name)}: ${en(COMP[id].job)}.`, `${de(COMP[id].name)}: ${de(COMP[id].job)}.`)),
      mistakes: list,
    };
  }
  if (v === 2) {
    const answer: AnswerSpec = { kind: "word", accept: [tx("haemoglobin", "Hämoglobin"), "Haemoglobin", "Hemoglobin", "Hb"], placeholder: tx("red pigment", "roter Farbstoff") };
    const m = mistakes(answer);
    m.add({ kind: "word", accept: [tx("erythrocytes", "Erythrozyten"), "Erythrozyt", "rote Blutkörperchen"] }, tx("Cells, not the pigment", "Zellen, nicht der Farbstoff"), tx("Those are the cells themselves. You're looking for the red pigment inside them that binds oxygen.", "Das sind die Zellen selbst. Gesucht ist der rote Farbstoff in ihnen, der Sauerstoff bindet."));
    m.add({ kind: "word", accept: [tx("chlorophyll", "Chlorophyll")] }, tx("That's the plant pigment", "Das ist der Pflanzenfarbstoff"), tx("Chlorophyll is the green pigment of plants. The red one in blood has an iron atom at its centre.", "Chlorophyll ist der grüne Farbstoff der Pflanzen. Der rote im Blut hat ein Eisen-Atom in der Mitte."));
    return {
      instruction: tx("Name the pigment", "Nenne den Farbstoff"),
      text: tx("What is the red pigment in the red blood cells called that binds oxygen?", "Wie heißt der rote Farbstoff in den roten Blutkörperchen, der Sauerstoff bindet?"),
      answer,
      hint: tx("It contains iron and starts with H.", "Er enthält Eisen und beginnt mit H."),
      solution: answerFrames(tx("haemoglobin", "Hämoglobin"), tx("Haemoglobin contains iron. In the lungs it binds oxygen, in the tissues it releases it.", "Hämoglobin enthält Eisen. In der Lunge bindet es Sauerstoff, im Gewebe gibt es ihn wieder ab.")),
      mistakes: m.list,
    };
  }
  const opts: Opt[] = [
    { text: COMP.plasma.name },
    { text: COMP.rbc.name, title: tx("All cells together: 45 %", "Alle Zellen zusammen: 45 %"), say: tx("Red blood cells are by far the most common cells, but all cells together make up only about 45 %. The rest is liquid.", "Rote Blutkörperchen sind die mit Abstand häufigsten Zellen, aber alle Zellen zusammen machen nur etwa 45 % aus. Der Rest ist Flüssigkeit.") },
    { text: COMP.wbc.name, title: tx("Far fewer", "Viel weniger"), say: tx("There are about 1000 times fewer white than red blood cells.", "Es gibt etwa 1000-mal weniger weiße als rote Blutkörperchen.") },
    { text: COMP.platelet.name, title: tx("Tiny fragments", "Winzige Bruchstücke"), say: tx("Platelets are tiny and make up hardly any volume.", "Blutplättchen sind winzig und machen kaum Volumen aus.") },
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Composition of blood", "Zusammensetzung des Blutes"),
    text: tx("A blood sample is spun in a centrifuge. Which component makes up about **55 %** of the volume?", "Eine Blutprobe wird zentrifugiert. Welcher Bestandteil macht etwa **55 %** des Volumens aus?"),
    visual: visual(HeartBloodCells, { mode: "plain" }),
    answer,
    hint: tx("Is blood more liquid or more cells?", "Besteht Blut mehr aus Flüssigkeit oder mehr aus Zellen?"),
    solution: answerFrames(COMP.plasma.name, tx("Plasma about 55 %, cells about 45 % (almost all of them red blood cells).", "Plasma etwa 55 %, Zellen etwa 45 % (fast alle davon rote Blutkörperchen).")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Gas exchange

function gasTask(rng: Rng): Exercise {
  const v = rng.int(0, 2);
  if (v === 2) {
    const yes: Text[] = [tx("A huge surface (about 100 m²)", "Eine riesige Oberfläche (etwa 100 m²)"), tx("Very thin walls", "Sehr dünne Wände"), tx("A dense network of capillaries", "Ein dichtes Netz aus Kapillaren"), tx("A moist surface", "Eine feuchte Oberfläche")];
    const no: { text: Text; say: Text }[] = [
      { text: tx("Thick walls that protect the alveoli", "Dicke Wände, die die Bläschen schützen"), say: tx("Thick walls would make the way for diffusion long and slow. The walls are as thin as possible.", "Dicke Wände würden den Weg für die Diffusion lang und langsam machen. Die Wände sind so dünn wie möglich.") },
      { text: tx("A few large air sacs instead of many small ones", "Wenige große Bläschen statt vieler kleiner"), say: tx("Many small alveoli have a much larger surface than a few big ones.", "Viele kleine Bläschen haben zusammen eine viel größere Oberfläche als wenige große.") },
      { text: tx("Rings of cartilage around each alveolus", "Knorpelspangen um jedes Bläschen"), say: tx("Cartilage rings hold the windpipe and bronchi open. The alveoli have only thin walls.", "Knorpelspangen halten Luftröhre und Bronchien offen. Die Lungenbläschen haben nur dünne Wände.") },
    ];
    const pickYes = rng.shuffle(yes).slice(0, 3);
    const pickNo = rng.shuffle(no).slice(0, 2);
    const M = multi(rng, [...pickYes.map((t) => ({ text: t, ok: true })), ...pickNo.map((n) => ({ text: n.text, ok: false }))]);
    const m = mistakes(M.answer);
    for (const n of pickNo) m.add({ kind: "multi", options: M.options, correct: M.pick((x) => x.ok || en(x.text) === en(n.text)) }, tx("That slows exchange down", "Das bremst den Austausch"), n.say);
    return {
      instruction: tx("Select all that apply", "Wähle alle passenden aus"),
      text: tx("What makes the lungs so good at gas exchange?", "Was macht die Lunge so gut für den Gasaustausch geeignet?"),
      answer: M.answer,
      hint: tx("Diffusion is fast over a large area and a short distance.", "Diffusion geht schnell bei großer Fläche und kurzem Weg."),
      solution: multiFrames(tx("good for diffusion:", "gut für Diffusion:"), pickYes, tx("Large surface, short way, lots of blood flowing past: that's what makes diffusion efficient.", "Große Fläche, kurzer Weg, viel vorbeifließendes Blut: Das macht die Diffusion effektiv.")),
      mistakes: m.list,
    };
  }
  const o2 = v === 0;
  const opts: Opt[] = o2
    ? [
        { text: tx("From the air in the alveoli into the blood, because there is more oxygen in the air", "Aus der Luft in den Lungenbläschen ins Blut, weil in der Luft mehr Sauerstoff ist") },
        { text: tx("From the blood into the alveoli, because blood carries oxygen", "Aus dem Blut in die Lungenbläschen, weil Blut Sauerstoff transportiert"), title: tx("Wrong direction", "Falsche Richtung"), say: tx("In the lungs the blood is still oxygen-poor. Oxygen moves from where there is a lot (air) to where there is little (blood).", "In der Lunge ist das Blut noch sauerstoffarm. Sauerstoff wandert von dort, wo viel ist (Luft), dorthin, wo wenig ist (Blut).") },
        { text: tx("It is pumped into the blood by the heart", "Er wird vom Herzen ins Blut gepumpt"), title: tx("No pump needed", "Keine Pumpe nötig"), say: tx("Gases cross the wall by diffusion, all by themselves: from high to low concentration.", "Gase gelangen durch Diffusion über die Wand, ganz von selbst: von hoher zu niedriger Konzentration.") },
        { text: tx("From the air into the blood, because the alveoli pump it actively", "Aus der Luft ins Blut, weil die Lungenbläschen ihn aktiv hineinpumpen"), title: tx("Passive, not pumped", "Passiv, nicht gepumpt"), say: tx("The direction is right, but nothing is pumped: diffusion happens by itself, driven by the concentration difference.", "Die Richtung stimmt, aber hier pumpt nichts: Diffusion läuft von selbst ab, angetrieben vom Konzentrationsunterschied.") },
      ]
    : [
        { text: tx("Out of the blood into the alveoli, because there is more carbon dioxide in the blood", "Aus dem Blut in die Lungenbläschen, weil im Blut mehr Kohlenstoffdioxid ist") },
        { text: tx("Into the blood, because the body needs carbon dioxide", "Ins Blut, weil der Körper Kohlenstoffdioxid braucht"), title: tx("CO₂ is waste", "CO₂ ist Abfall"), say: tx("Carbon dioxide is a waste product of the cells. It leaves the blood in the lungs and is breathed out.", "Kohlenstoffdioxid ist ein Abfallprodukt der Zellen. Es verlässt in der Lunge das Blut und wird ausgeatmet.") },
        { text: tx("Out of the blood, because carbon dioxide is lighter than oxygen", "Aus dem Blut, weil Kohlenstoffdioxid leichter ist als Sauerstoff"), title: tx("Concentration, not weight", "Konzentration, nicht Gewicht"), say: tx("The direction is right, but the reason is the concentration difference: lots of CO₂ in the blood, little in the air.", "Die Richtung stimmt, aber der Grund ist der Konzentrationsunterschied: viel CO₂ im Blut, wenig in der Luft.") },
      ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Gas exchange in the lungs", "Gasaustausch in der Lunge"),
    text: o2 ? tx("Which way does **oxygen** go in the alveoli, and why?", "In welche Richtung wandert **Sauerstoff** in den Lungenbläschen, und warum?") : tx("Which way does **carbon dioxide** go in the alveoli, and why?", "In welche Richtung wandert **Kohlenstoffdioxid** in den Lungenbläschen, und warum?"),
    answer,
    hint: tx("Diffusion: particles move from high to low concentration.", "Diffusion: Teilchen wandern von hoher zu niedriger Konzentration."),
    solution: [
      { math: tx('"diffusion:"#d \\; "high"#h \\to "low"#l', '"Diffusion:"#d \\; "hoch"#h \\to "niedrig"#l'), note: tx("Particles spread from where there are many to where there are few.", "Teilchen verteilen sich von dort, wo viele sind, dorthin, wo wenige sind.") },
      { math: o2 ? tx('\\ce{O2}: "air"#h \\to "blood"#l', '\\ce{O2}: "Luft"#h \\to "Blut"#l') : tx('\\ce{CO2}: "blood"#h \\to "air"#l', '\\ce{CO2}: "Blut"#h \\to "Luft"#l'), note: o2 ? tx("Fresh air in the alveoli has a lot of oxygen, the arriving blood little: oxygen diffuses into the blood.", "Frische Luft in den Bläschen hat viel Sauerstoff, das ankommende Blut wenig: Sauerstoff diffundiert ins Blut.") : tx("The arriving blood is full of carbon dioxide, the air has little: CO₂ diffuses into the alveoli and is breathed out.", "Das ankommende Blut ist voller Kohlenstoffdioxid, die Luft enthält wenig: CO₂ diffundiert in die Bläschen und wird ausgeatmet.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Valves

const VALVES = { av: tx("AV valves (Segelklappen)", "Segelklappen"), sl: tx("Semilunar valves (Taschenklappen)", "Taschenklappen"), all: tx("All valves", "Alle Klappen"), none: tx("No valves", "Keine Klappe") };
function valveTask(rng: Rng): Exercise {
  const v = rng.int(0, 3);
  const B: { q: Text; opts: Opt[]; why: Text }[] = [
    {
      q: tx("**Systole**: the ventricles contract. Which valves are **open**?", "**Systole**: Die Kammern ziehen sich zusammen. Welche Klappen sind **offen**?"),
      opts: [
        { text: VALVES.sl },
        { text: VALVES.av, title: tx("Then blood would flow back", "Dann flösse Blut zurück"), say: tx("If the AV valves were open now, the ventricles would squeeze blood back into the atria. They snap shut (first heart sound).", "Wären die Segelklappen jetzt offen, würden die Kammern Blut zurück in die Vorhöfe drücken. Sie schlagen zu (erster Herzton).") },
        { text: VALVES.all, title: tx("Then blood would flow back", "Dann flösse Blut zurück"), say: tx("Open AV valves would let blood flow back into the atria. Only the exits to the arteries are open.", "Offene Segelklappen ließen Blut zurück in die Vorhöfe fließen. Nur die Ausgänge zu den Arterien sind offen.") },
        { text: VALVES.none, title: tx("Then it couldn't pump", "Dann ginge nichts raus"), say: tx("With all valves shut no blood could leave. The semilunar valves open to let it into aorta and pulmonary artery.", "Wären alle Klappen zu, käme kein Blut hinaus. Die Taschenklappen öffnen sich zu Aorta und Lungenarterie.") },
      ],
      why: tx("In systole the semilunar valves are open (blood out into the arteries), the AV valves are shut.", "In der Systole sind die Taschenklappen offen (Blut hinaus in die Arterien), die Segelklappen geschlossen."),
    },
    {
      q: tx("**Diastole**: the ventricles relax and fill. Which valves are **open**?", "**Diastole**: Die Kammern erschlaffen und füllen sich. Welche Klappen sind **offen**?"),
      opts: [
        { text: VALVES.av },
        { text: VALVES.sl, title: tx("Then blood would flow back", "Dann flösse Blut zurück"), say: tx("Open semilunar valves would let blood flow back from the aorta into the relaxed ventricle. They are shut (second heart sound).", "Offene Taschenklappen ließen Blut aus der Aorta zurück in die erschlaffte Kammer fließen. Sie sind geschlossen (zweiter Herzton).") },
        { text: VALVES.all, title: tx("Then blood would flow back", "Dann flösse Blut zurück"), say: tx("Open semilunar valves would let blood flow back from the arteries. Only the way from the atria is open.", "Offene Taschenklappen ließen Blut aus den Arterien zurückfließen. Nur der Weg aus den Vorhöfen ist offen.") },
      ],
      why: tx("In diastole the AV valves are open: blood flows from the atria into the ventricles.", "In der Diastole sind die Segelklappen offen: Blut fließt aus den Vorhöfen in die Kammern."),
    },
    {
      q: tx("What do the **AV valves** (Segelklappen) prevent?", "Was verhindern die **Segelklappen**?"),
      opts: [
        { text: tx("That blood flows back from the ventricles into the atria", "Dass Blut aus den Kammern in die Vorhöfe zurückfließt") },
        { text: tx("That blood flows back from the aorta into the ventricle", "Dass Blut aus der Aorta in die Kammer zurückfließt"), title: tx("That's the semilunar valves", "Das machen die Taschenklappen"), say: tx("The exits to the arteries are guarded by the semilunar valves. The AV valves sit between atrium and ventricle.", "Die Ausgänge zu den Arterien bewachen die Taschenklappen. Die Segelklappen sitzen zwischen Vorhof und Kammer.") },
        { text: tx("That oxygen-poor and oxygen-rich blood mix", "Dass sich sauerstoffarmes und sauerstoffreiches Blut mischen"), title: tx("That's the septum", "Das macht die Scheidewand"), say: tx("The septum keeps the two halves apart. Valves only decide the direction of flow.", "Die Scheidewand hält die beiden Hälften getrennt. Klappen bestimmen nur die Fließrichtung.") },
      ],
      why: tx("The AV valves shut when the ventricles contract, so blood can only go forward into the arteries.", "Die Segelklappen schließen, wenn sich die Kammern zusammenziehen. So kann das Blut nur nach vorn in die Arterien.") },
    {
      q: tx("What do the **semilunar valves** (Taschenklappen) prevent?", "Was verhindern die **Taschenklappen**?"),
      opts: [
        { text: tx("That blood flows back from the aorta and pulmonary artery into the ventricles", "Dass Blut aus Aorta und Lungenarterie in die Kammern zurückfließt") },
        { text: tx("That blood flows back from the ventricles into the atria", "Dass Blut aus den Kammern in die Vorhöfe zurückfließt"), title: tx("That's the AV valves", "Das machen die Segelklappen"), say: tx("Between atrium and ventricle sit the AV valves (Segelklappen). The semilunar valves guard the exits.", "Zwischen Vorhof und Kammer sitzen die Segelklappen. Die Taschenklappen bewachen die Ausgänge.") },
        { text: tx("That blood flows back in the leg veins", "Dass Blut in den Beinvenen zurückfließt"), title: tx("Those are venous valves", "Das sind Venenklappen"), say: tx("Veins have their own valves. Semilunar valves sit in the heart, at the exits of the ventricles.", "Venen haben eigene Klappen. Taschenklappen sitzen im Herzen am Ausgang der Kammern.") },
      ],
      why: tx("When the ventricles relax, the semilunar valves fill like pockets and shut the way back.", "Erschlaffen die Kammern, füllen sich die Taschenklappen wie Taschen und verschließen den Rückweg."),
    },
  ];
  const Q = B[v];
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("Heart valves", "Herzklappen"),
    text: Q.q,
    answer,
    hint: tx("AV valves (Segelklappen): between atrium and ventricle. Semilunar valves (Taschenklappen): at the exits. Valves open in the direction of flow.", "Segelklappen: zwischen Vorhof und Kammer. Taschenklappen: an den Ausgängen. Klappen öffnen in Fließrichtung."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Blood groups

const GROUP_TEXT = (g: BloodGroup): Text => g;
const sameSet = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
const canGive = (donor: BloodGroup, recipient: BloodGroup) => !antigensOf(donor).some((a) => antibodiesOf(recipient).includes(a));

export function donorTask(rng: Rng, fixed?: { g: BloodGroup; asRecipient: boolean }): Exercise {
  const g = fixed?.g ?? rng.pick(GROUPS);
  const asRecipient = fixed?.asRecipient ?? rng.chance(0.6);
  const options = GROUPS.map(GROUP_TEXT);
  const okFor = (x: BloodGroup) => (asRecipient ? canGive(x, g) : canGive(g, x));
  const correct = GROUPS.map((x, i) => (okFor(x) ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const set = (f: (x: BloodGroup) => boolean) => GROUPS.map((x, i) => (f(x) ? i : -1)).filter((i) => i >= 0);
  const reversed = set((x) => (asRecipient ? canGive(g, x) : canGive(x, g)));
  if (!sameSet(reversed, correct)) m.add({ kind: "multi", options, correct: reversed }, tx("Direction swapped", "Richtung vertauscht"), asRecipient ? tx(`Those are the people **${g}** may give blood **to**. Here ${g} is the one receiving.`, `Das sind die Menschen, **denen** ${g} Blut spenden darf. Hier bekommt ${g} das Blut.`) : tx(`Those are the people ${g} may **receive** from. Here ${g} is the donor.`, `Von diesen Menschen darf ${g} Blut **bekommen**. Hier ist ${g} der Spender.`));
  if (asRecipient) {
    const withAB = set((x) => okFor(x) || x === "AB");
    if (!sameSet(withAB, correct)) m.add({ kind: "multi", options, correct: withAB }, tx("AB is not the universal donor", "AB ist kein Universalspender"), tx("AB red cells carry **both** antigens A and B, so many antibodies attack them. AB is the universal **recipient**; the universal donor is 0.", "AB-Blutkörperchen tragen **beide** Antigene A und B, deshalb greifen viele Antikörper sie an. AB ist der Universal**empfänger**, der Universalspender ist 0."));
    const same = set((x) => x === g);
    if (!sameSet(same, correct)) m.add({ kind: "multi", options, correct: same }, tx("Not only the same group", "Nicht nur dieselbe Gruppe"), tx("Group 0 red cells carry no antigens A or B, so no antibody can make them clump. Check every donor: do their antigens fit the recipient's antibodies?", "Blutkörperchen der Gruppe 0 tragen weder Antigen A noch B, also kann sie kein Antikörper verklumpen. Prüf jeden Spender: Passen seine Antigene zu den Antikörpern des Empfängers?"), true);
  } else {
    const all = GROUPS.map((_, i) => i);
    if (!sameSet(all, correct)) m.add({ kind: "multi", options, correct: all }, g === "AB" ? tx("AB is not the universal donor", "AB ist kein Universalspender") : tx("Not to everyone", "Nicht an alle"), g === "AB" ? tx("AB red cells carry **both** antigens: anti-A and anti-B of other groups make them clump. AB can **receive** from everyone, but give only to AB.", "AB-Blutkörperchen tragen **beide** Antigene: Anti-A und Anti-B der anderen Gruppen verklumpen sie. AB kann von allen **empfangen**, aber nur an AB spenden.") : tx(`${g} red cells carry antigen ${g}. Whoever has anti-${g} in their plasma can't take them.`, `Blutkörperchen der Gruppe ${g} tragen das Antigen ${g}. Wer Anti-${g} im Plasma hat, verträgt sie nicht.`));
  }
  const rightGroups = correct.map((i) => GROUPS[i]);
  return {
    instruction: tx("Blood donation", "Blutspende"),
    text: asRecipient
      ? tx(`A patient with blood group **${g}** needs red blood cells. Which donor groups are compatible (AB0 system only)?`, `Ein Patient mit Blutgruppe **${g}** braucht rote Blutkörperchen. Welche Spender-Blutgruppen sind verträglich (nur das AB0-System)?`)
      : tx(`A donor has blood group **${g}**. To which recipients may their red blood cells be given (AB0 system only)?`, `Eine Spenderin hat Blutgruppe **${g}**. Welchen Empfängern darf man ihre roten Blutkörperchen geben (nur das AB0-System)?`),
    answer,
    hint: tx("Donor antigens must not meet matching antibodies in the recipient's plasma. A has anti-B, B has anti-A, 0 has both, AB none.", "Die Antigene des Spenders dürfen nicht auf passende Antikörper im Plasma des Empfängers treffen. A hat Anti-B, B hat Anti-A, 0 hat beide, AB keine."),
    solution: [
      {
        math: asRecipient ? tx(`"recipient"#r \\; ${g} : "${en(antibodyText(g))}"#k`, `"Empfänger"#r \\; ${g} : "${de(antibodyText(g))}"#k`) : tx(`"donor"#r \\; ${g} : "${en(antigenText(g))}"#k`, `"Spender"#r \\; ${g} : "${de(antigenText(g))}"#k`),
        note: asRecipient ? tx(`Group ${g} has ${en(antibodyText(g))} in the plasma. Donor cells must not carry a matching antigen.`, `Gruppe ${g} hat ${de(antibodyText(g))} im Plasma. Die Spenderzellen dürfen kein passendes Antigen tragen.`) : tx(`Group ${g} cells carry ${en(antigenText(g))}. The recipient must not have matching antibodies.`, `Blutkörperchen der Gruppe ${g} tragen ${de(antigenText(g))}. Der Empfänger darf keine passenden Antikörper haben.`),
      },
      { math: tx(`\\Rightarrow#x \\; ${rightGroups.join(" , ")}`, `\\Rightarrow#x \\; ${rightGroups.join(" , ")}`), note: tx(`Compatible: ${en(listText(rightGroups))}. Remember: 0 can give to everyone, AB can receive from everyone.`, `Verträglich: ${de(listText(rightGroups))}. Merke: 0 kann allen spenden, AB kann von allen empfangen.`) },
    ],
    mistakes: m.list,
  };
}
const antibodyText = (g: BloodGroup): Text => {
  const a = antibodiesOf(g);
  return a.length === 0 ? tx("no antibodies", "keine Antikörper") : a.length === 2 ? tx("anti-A and anti-B", "Anti-A und Anti-B") : tx(`anti-${a[0]}`, `Anti-${a[0]}`);
};
const antigenText = (g: BloodGroup): Text => {
  const a = antigensOf(g);
  return a.length === 0 ? tx("no antigens", "keine Antigene") : a.length === 2 ? tx("antigens A and B", "Antigene A und B") : tx(`antigen ${a[0]}`, `Antigen ${a[0]}`);
};

function antibodyTask(rng: Rng): Exercise {
  const g = rng.pick(GROUPS);
  const askAntibodies = rng.chance(0.55);
  const abOpts: Text[] = [tx("anti-A", "Anti-A"), tx("anti-B", "Anti-B"), tx("anti-A and anti-B", "Anti-A und Anti-B"), tx("none", "keine")];
  const agOpts: Text[] = [tx("antigen A", "Antigen A"), tx("antigen B", "Antigen B"), tx("antigens A and B", "Antigene A und B"), tx("none", "keine")];
  const idxOf = (set: ("A" | "B")[]) => (set.length === 2 ? 2 : set.length === 0 ? 3 : set[0] === "A" ? 0 : 1);
  const right = idxOf(askAntibodies ? antibodiesOf(g) : antigensOf(g));
  const wrongIdx = idxOf(askAntibodies ? antigensOf(g) : antibodiesOf(g));
  const opts = askAntibodies ? abOpts : agOpts;
  const order = rng.shuffle([0, 1, 2, 3]);
  const options = order.map((i) => opts[i]);
  const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(right) };
  const list: Mistake[] =
    wrongIdx !== right
      ? [
          {
            when: { kind: "choice", options, correct: order.indexOf(wrongIdx) },
            title: askAntibodies ? tx("Then it would clump itself", "Dann verklumpte es selbst") : tx("Antigens, not antibodies", "Antigene, nicht Antikörper"),
            say: askAntibodies
              ? tx("If you had antibodies against your own antigens, your own blood would clump! You only have antibodies against the antigens you **don't** have.", "Hättest du Antikörper gegen deine eigenen Antigene, würde dein eigenes Blut verklumpen! Man hat nur Antikörper gegen die Antigene, die man **nicht** hat.")
              : tx("Those are the antibodies in the plasma. The blood group is named after the antigens on the red cells.", "Das sind die Antikörper im Plasma. Die Blutgruppe ist nach den Antigenen auf den roten Blutkörperchen benannt."),
          },
        ]
      : [];
  return {
    instruction: tx("Antigens and antibodies", "Antigene und Antikörper"),
    text: askAntibodies ? tx(`Which antibodies are in the **plasma** of a person with blood group **${g}**?`, `Welche Antikörper befinden sich im **Blutplasma** eines Menschen mit Blutgruppe **${g}**?`) : tx(`Which antigens are on the **red blood cells** of a person with blood group **${g}**?`, `Welche Antigene tragen die **roten Blutkörperchen** eines Menschen mit Blutgruppe **${g}**?`),
    answer,
    hint: tx("The group is named after the antigens. Antibodies exist only against the antigens you lack.", "Die Gruppe ist nach den Antigenen benannt. Antikörper gibt es nur gegen die Antigene, die man nicht hat."),
    solution: [
      { math: tx(`${g} : "${en(antigenText(g))}"#a`, `${g} : "${de(antigenText(g))}"#a`), note: tx("The blood group names the antigens on the red cells.", "Die Blutgruppe benennt die Antigene auf den roten Blutkörperchen.") },
      { math: tx(`"plasma:"#p \\; "${en(antibodyText(g))}"#b`, `"Plasma:"#p \\; "${de(antibodyText(g))}"#b`), note: tx("In the plasma: antibodies against the missing antigens.", "Im Plasma: Antikörper gegen die fehlenden Antigene."), highlight: [askAntibodies ? "b" : "a"] },
    ],
    mistakes: list,
  };
}

function bloodTestTask(rng: Rng): Exercise {
  const g = rng.pick(GROUPS);
  const inverse: Record<BloodGroup, BloodGroup> = { A: "B", B: "A", AB: "0", "0": "AB" };
  const opts: Opt[] = [
    { text: g },
    { text: inverse[g], title: tx("Read the other way round", "Umgekehrt gelesen"), say: tx("Clumping in the anti-A field means: antigen A **is** there, the test serum grabbed it. Smooth blood means: no such antigen.", "Verklumpung im Feld Anti-A heißt: Das Antigen A **ist** da, das Testserum hat es gepackt. Glattes Blut heißt: kein solches Antigen.") },
    ...GROUPS.filter((x) => x !== g && x !== inverse[g]).map((x) => ({ text: x, title: tx("Check both fields", "Prüf beide Felder"), say: tx("Look at each field on its own: clumping = this antigen is present.", "Schau jedes Feld einzeln an: Verklumpung = dieses Antigen ist vorhanden.") })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Blood group test", "Blutgruppentest"),
    text: tx("A drop of blood was mixed with test serum anti-A and anti-B. Which blood group does the person have?", "Ein Tropfen Blut wurde mit den Testseren Anti-A und Anti-B gemischt. Welche Blutgruppe hat die Person?"),
    visual: visual(HeartBloodTest, { group: g }),
    answer,
    hint: tx("Anti-A makes cells with antigen A clump; anti-B makes cells with antigen B clump.", "Anti-A verklumpt Blutkörperchen mit Antigen A, Anti-B solche mit Antigen B."),
    solution: answerFrames(tx(`blood group ${g}`, `Blutgruppe ${g}`), tx(`Clumping with ${en(listText(antigensOf(g).map((a) => `anti-${a}`))) || "none of the sera"}: antigens ${en(listText(antigensOf(g))) || "none"}, so blood group ${g}.`, `Verklumpung mit ${de(listText(antigensOf(g).map((a) => `Anti-${a}`))) || "keinem Serum"}: Antigene ${de(listText(antigensOf(g))) || "keine"}, also Blutgruppe ${g}.`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  switch (rng.int(0, 15)) {
    case 0:
      return heartPartTask(rng);
    case 1:
      return heartPartWordTask(rng);
    case 2:
    case 3:
      return bloodPathTask(rng);
    case 4:
      return circuitTask(rng);
    case 5:
      return rng.chance(0.6) ? vesselO2Task(rng) : whichVesselTask(rng);
    case 6:
      return o2MultiTask(rng);
    case 7:
      return vesselMatchTask(rng);
    case 8:
      return vesselPictureTask(rng);
    case 9:
      return bloodComponentTask(rng);
    case 10:
      return gasTask(rng);
    case 11:
      return valveTask(rng);
    case 12:
    case 13:
      return donorTask(rng);
    case 14:
      return antibodyTask(rng);
    default:
      return bloodTestTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const valveFrames: Frame[] = [
  { math: tx('"atrium"#v \\to "AV valve"#s \\to "ventricle"#k \\to "semilunar valve"#t \\to "artery"#a', '"Vorhof"#v \\to "Segelklappe"#s \\to "Kammer"#k \\to "Taschenklappe"#t \\to "Arterie"#a'), note: tx("On each side the blood flows from the atrium into the ventricle and from there into a large artery. Two valves per side make sure it only flows this way.", "Auf jeder Seite fließt das Blut vom Vorhof in die Kammer und von dort in eine große Arterie. Zwei Klappen pro Seite sorgen dafür, dass es nur in diese Richtung fließt.") },
  { math: tx('"AV valves:"#s \\; "between atrium and ventricle"#x', '"Segelklappen:"#s \\; "zwischen Vorhof und Kammer"#x'), note: tx("The **AV valves** (Segelklappen) are thin flaps held by tendons. When the ventricles contract they snap shut, so no blood flows back into the atria.", "Die **Segelklappen** sind dünne Häute, die an Sehnenfäden hängen. Ziehen sich die Kammern zusammen, schlagen sie zu, damit kein Blut zurück in die Vorhöfe fließt."), highlight: ["s"] },
  { math: tx('"semilunar valves:"#t \\; "at the exits"#y', '"Taschenklappen:"#t \\; "am Ausgang der Kammern"#y'), note: tx("The **semilunar valves** (Taschenklappen) sit where the aorta and pulmonary artery begin. They look like little pockets and shut when blood tries to flow back.", "Die **Taschenklappen** sitzen am Anfang von Aorta und Lungenarterie. Sie sehen aus wie kleine Taschen und schließen, wenn das Blut zurückfließen will."), highlight: ["t"] },
  { math: tx('"systole:"#p \\; "ventricles contract"#q', '"Systole:"#p \\; "Kammern ziehen sich zusammen"#q'), note: tx("**Systole**: the ventricles contract and pump. AV valves shut, semilunar valves open.", "**Systole**: Die Kammern ziehen sich zusammen und pumpen. Segelklappen zu, Taschenklappen auf."), highlight: ["p"] },
  { math: tx('"diastole:"#d \\; "ventricles relax"#r', '"Diastole:"#d \\; "Kammern erschlaffen"#r'), note: tx("**Diastole**: the ventricles relax and fill. AV valves open, semilunar valves shut.", "**Diastole**: Die Kammern erschlaffen und füllen sich. Segelklappen auf, Taschenklappen zu."), highlight: ["d"] },
];

const checkPart = heartPartTask(createRng(3), "lv");
const checkPath = bloodPathTask(createRng(1), { start: 1, len: 6 });
const checkPa = vesselO2Task(createRng(1), 0);
const checkDonor = donorTask(createRng(2), { g: "A", asRecipient: true });

export const level2: LevelLesson = {
  lesson: [
    {
      type: "widget",
      title: tx("Inside the heart", "Ein Blick ins Herz"),
      blob: tx("Imagine the person facing you. Their right hand is on your left!", "Stell dir vor, der Mensch steht dir gegenüber. Seine rechte Hand ist auf deiner linken Seite!"),
      body: tx(
        "The **septum** divides the heart into a right and a left half. Each half has an **atrium** on top and a **ventricle** below. The right half pumps oxygen-poor blood (blue) to the lungs, the left half oxygen-rich blood (red) into the body. The left ventricle has the thickest wall.\n\n**Watch out:** pictures show the heart from the front, as if the person faced you. So their **right** half is on the **left** of the picture. Tap the numbers!",
        "Die **Herzscheidewand** teilt das Herz in eine rechte und eine linke Hälfte. Jede Hälfte hat oben einen **Vorhof** und darunter eine **Kammer**. Die rechte Hälfte pumpt sauerstoffarmes Blut (blau) zur Lunge, die linke sauerstoffreiches Blut (rot) in den Körper. Die linke Kammer hat die dickste Wand.\n\n**Achtung:** Abbildungen zeigen das Herz von vorn, als stünde der Mensch dir gegenüber. Seine **rechte** Hälfte ist deshalb **links** im Bild. Tipp auf die Nummern!",
      ),
      widget: () => <HeartSection mode="explore" sides />,
    },
    {
      type: "explain",
      title: tx("Valves are one-way gates", "Klappen sind Ventile"),
      blob: tx("Valves work like the valve on a bike tyre: they only let air, or blood, through one way.", "Klappen funktionieren wie das Ventil am Fahrradreifen: Sie lassen nur in eine Richtung durch."),
      frames: valveFrames,
    },
    {
      type: "widget",
      title: tx("The heart beats", "Das Herz schlägt"),
      blob: tx("Lub-dub: the two heart sounds are valves snapping shut!", "Bumm-bumm: Die beiden Herztöne sind Klappen, die zuschlagen!"),
      body: tx("Let the heart beat or jump through the three moments of a heartbeat. Watch the valves!", "Lass das Herz schlagen oder spring durch die drei Momente eines Herzschlags. Achte auf die Klappen!"),
      widget: HeartBeatWidget,
    },
    { type: "check", blob: tx("Which chamber is this? Mind the mirror!", "Welche Kammer ist das? Denk an den Spiegel!"), exercise: checkPart },
    {
      type: "widget",
      title: tx("The double circulation", "Der doppelte Kreislauf"),
      blob: tx("Two rounds, one heart: that's why it's called the double circulation.", "Zwei Runden, ein Herz: Deshalb heißt er doppelter Kreislauf."),
      body: tx(
        "The blood flows through two circuits one after the other. In the **pulmonary circulation** the right ventricle pumps oxygen-poor blood to the lungs; oxygen-rich, it returns to the left atrium. In the **systemic circulation** the left ventricle pumps oxygen-rich blood through the body; oxygen-poor, it returns to the right atrium. Follow one blood cell all the way round!",
        "Das Blut durchfließt zwei Kreisläufe nacheinander. Im **Lungenkreislauf** pumpt die rechte Kammer sauerstoffarmes Blut zur Lunge, sauerstoffreich kommt es in den linken Vorhof zurück. Im **Körperkreislauf** pumpt die linke Kammer sauerstoffreiches Blut durch den Körper, sauerstoffarm kehrt es in den rechten Vorhof zurück. Folge einem Blutkörperchen einmal ganz herum!",
      ),
      widget: HeartCirculationWidget,
    },
    { type: "check", blob: tx("Now without the picture: the way of the blood.", "Jetzt ohne Bild: der Weg des Blutes."), exercise: checkPath },
    {
      type: "widget",
      title: tx("Artery, vein, capillary", "Arterie, Vene, Kapillare"),
      blob: tx("Thick wall, thin wall, paper-thin wall. Each fits its job.", "Dicke Wand, dünne Wand, hauchdünne Wand. Jede passt zu ihrer Aufgabe."),
      body: tx(
        "**Arteries** have a thick, elastic wall with lots of muscle: they withstand the high pressure with which the heart ejects the blood. **Veins** have a thinner wall and a wide lumen. The pressure in them is low, so many veins have **venous valves**, and the surrounding muscles squeeze the blood towards the heart (muscle pump). **Capillaries** consist of just one cell layer: ideal for exchange.",
        "**Arterien** haben eine dicke, elastische Wand mit viel Muskulatur: Sie halten den hohen Druck aus, mit dem das Herz das Blut auswirft. **Venen** haben eine dünnere Wand und ein weites Lumen. In ihnen ist der Druck niedrig, deshalb haben viele Venen **Venenklappen**, und die umliegenden Muskeln drücken das Blut zum Herzen (Muskelpumpe). **Kapillaren** bestehen nur aus einer Zellschicht: ideal für den Stoffaustausch.",
      ),
      widget: () => <HeartVessels mode="explore" />,
    },
    {
      type: "widget",
      title: tx("What swims in the blood", "Was im Blut schwimmt"),
      blob: tx("Under the microscope blood gets really interesting!", "Unter dem Mikroskop wird Blut richtig spannend!"),
      body: tx(
        "Spin blood in a centrifuge and it separates: about **55 %** is **plasma**, a yellowish liquid. About **45 %** are cells: **red blood cells** (erythrocytes) with the red pigment **haemoglobin**, which binds oxygen; **white blood cells** (leucocytes) for defence; and **platelets** (thrombocytes) for clotting.",
        "Zentrifugiert man Blut, trennt es sich: Etwa **55 %** sind **Blutplasma**, eine gelbliche Flüssigkeit. Etwa **45 %** sind Zellen: **rote Blutkörperchen** (Erythrozyten) mit dem roten Farbstoff **Hämoglobin**, der Sauerstoff bindet, **weiße Blutkörperchen** (Leukozyten) für die Abwehr und **Blutplättchen** (Thrombozyten) für die Blutgerinnung.",
      ),
      widget: () => <HeartBloodCells mode="explore" />,
    },
    {
      type: "widget",
      title: tx("Gas exchange in the lungs", "Gasaustausch in der Lunge"),
      blob: tx("Diffusion needs no pump: particles wander from a lot to a little.", "Diffusion braucht keine Pumpe: Teilchen wandern von viel nach wenig."),
      body: tx(
        "In the **alveoli** only a paper-thin wall separates the air from the blood in the capillaries. Oxygen **diffuses** from the air, where there is a lot of it, into the blood, where there is little. Carbon dioxide diffuses the other way. About 300 million alveoli give a huge surface of about 100 m².",
        "In den **Lungenbläschen** trennt nur eine hauchdünne Wand die Luft vom Blut in den Kapillaren. Sauerstoff **diffundiert** aus der Luft, wo viel davon ist, ins Blut, wo wenig ist. Kohlenstoffdioxid diffundiert umgekehrt. Etwa 300 Millionen Lungenbläschen ergeben eine riesige Oberfläche von etwa 100 m².",
      ),
      widget: HeartAlveoliWidget,
    },
    { type: "check", blob: tx("A favourite exam question. Careful, trap ahead!", "Eine beliebte Testfrage. Vorsicht, Falle!"), exercise: checkPa },
    {
      type: "widget",
      title: tx("Blood groups", "Blutgruppen"),
      blob: tx("For a transfusion the blood group has to fit. Find out why!", "Bei einer Bluttransfusion muss die Blutgruppe passen. Finde heraus, warum!"),
      body: tx(
        "Red blood cells carry surface markers, the **antigens** A and B. The plasma contains **antibodies** against the antigens you don't have: group A has anti-B, group B has anti-A, group 0 has both, AB none. If antibodies meet matching antigens, the red cells clump (**agglutination**). Try it out: who may give to whom?",
        "Rote Blutkörperchen tragen auf ihrer Oberfläche Merkmale, die **Antigene** A und B. Im Plasma schwimmen **Antikörper** gegen die Antigene, die man nicht hat: Gruppe A hat Anti-B, Gruppe B hat Anti-A, Gruppe 0 hat beide, AB keine. Treffen Antikörper auf passende Antigene, verklumpen die roten Blutkörperchen (**Agglutination**). Probier aus: Wer darf wem spenden?",
      ),
      widget: HeartBloodGroupsWidget,
    },
    { type: "check", blob: tx("Last one: a patient needs blood. Who can help?", "Zum Schluss: Ein Patient braucht Blut. Wer kann helfen?"), exercise: checkDonor },
  ],
  summary: [
    {
      title: tx("Structure of the heart", "Bau des Herzens"),
      body: tx("The septum separates the right half (oxygen-poor) from the left half (oxygen-rich). Each half: atrium on top, ventricle below. The left ventricle has the thickest wall: it pumps through the whole body.", "Die Herzscheidewand trennt die rechte Hälfte (sauerstoffarm) von der linken (sauerstoffreich). Jede Hälfte: oben Vorhof, unten Kammer. Die linke Kammer hat die dickste Wand: Sie pumpt durch den ganzen Körper."),
      tone: "rule",
    },
    {
      title: tx("Right is left in the picture", "Rechts ist links im Bild"),
      body: tx("Diagrams show the heart from the front, as if the person faced you: their right half is on the left of the picture.", "Abbildungen zeigen das Herz von vorn, als stünde der Mensch dir gegenüber: Seine rechte Hälfte ist links im Bild."),
      tone: "warning",
    },
    {
      title: tx("Valves and heartbeat", "Klappen und Herzschlag"),
      body: tx("AV valves (Segelklappen) between atrium and ventricle, semilunar valves (Taschenklappen) at the exits. Systole: ventricles contract, AV valves shut, semilunar valves open. Diastole: ventricles relax and fill.", "Segelklappen zwischen Vorhof und Kammer, Taschenklappen an den Ausgängen. Systole: Kammern ziehen sich zusammen, Segelklappen zu, Taschenklappen auf. Diastole: Kammern erschlaffen und füllen sich."),
      tone: "rule",
    },
    {
      title: tx("Double circulation", "Doppelter Kreislauf"),
      examples: [
        tx('"pulmonary:" \\; "right ventricle" \\to "lungs" \\to "left atrium"', '"Lungenkreislauf:" \\; "rechte Kammer" \\to "Lunge" \\to "linker Vorhof"'),
        tx('"systemic:" \\; "left ventricle" \\to "body" \\to "right atrium"', '"Körperkreislauf:" \\; "linke Kammer" \\to "Körper" \\to "rechter Vorhof"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Arteries and veins", "Arterien und Venen"),
      body: tx("Arteries lead away from the heart (thick, elastic wall), veins lead to it (thin wall, valves), whatever their oxygen: the pulmonary artery is oxygen-poor, the pulmonary veins are oxygen-rich! Capillaries: one cell layer.", "Arterien führen vom Herzen weg (dicke, elastische Wand), Venen zum Herzen hin (dünne Wand, Klappen), egal wie viel Sauerstoff: Die Lungenarterie ist sauerstoffarm, die Lungenvenen sind sauerstoffreich! Kapillaren: eine Zellschicht."),
      tone: "warning",
    },
    {
      title: tx("Blood, gas exchange, blood groups", "Blut, Gasaustausch, Blutgruppen"),
      body: tx("Plasma 55 %, cells 45 %: red cells (haemoglobin, oxygen), white cells (defence), platelets (clotting). Gases cross the alveoli by diffusion. AB0: 0 can give to everyone (no antigens), AB can receive from everyone (no antibodies).", "Plasma 55 %, Zellen 45 %: Erythrozyten (Hämoglobin, Sauerstoff), Leukozyten (Abwehr), Thrombozyten (Gerinnung). Gase gelangen durch Diffusion durch die Wand der Lungenbläschen. AB0: 0 kann allen spenden (keine Antigene), AB kann von allen empfangen (keine Antikörper)."),
      tone: "tip",
    },
  ],
};
