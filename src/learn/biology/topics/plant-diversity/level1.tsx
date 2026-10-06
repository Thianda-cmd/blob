"use client";

// Level 1 (Einsteiger, Klasse 5–6): broadleaf and conifer trees, leaf shapes and edges, simple and
// compound leaves, early bloomers and their storage organs, and a simple dichotomous key.

import { tx, type Text } from "@/i18n/text";
import { DiversityBloomerExplorer, DiversityBloomerPicture, DiversitySeasons, type OrganId } from "@/learn/biology/visuals/DiversityBloomers";
import { DiversityKeyTable, DiversityTreeKey, TREE_KEY, keyPath } from "@/learn/biology/visuals/DiversityKey";
import { DiversityFruitPicture, DiversityLeafGallery, DiversityLeafPicture, TREE_FACTS, type TreeId } from "@/learn/biology/visuals/DiversityLeaves";
import { DiversityConifers, DiversityTwigPicture, type ConiferId } from "@/learn/biology/visuals/DiversityNeedles";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import {
  BLOOMERS,
  CONIFERS,
  CONIFER_CLUES,
  CONIFER_CONFUSE,
  CONIFER_NAME,
  FRUIT_CONFUSE,
  FRUIT_NAME,
  ORGAN_SHORT,
  TREES,
  TREE_ART,
  TREE_CONFUSE,
  TREE_NAME,
  bloomerThe,
  coniferSay,
  fruitSay,
  leafSay,
  organSay,
  type Bloomer,
} from "./data";
import { capT, choice, de, en, join, multi, pickSome, q, visual, type MultiOpt, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Tree from its leaf

/** Two short words that give each leaf away (for the worked solution). */
const LEAF_KEYS: Record<TreeId, [Text, Text]> = {
  oak: [tx("round lobes", "runde Lappen"), tx("short stalk", "kurzer Stiel")],
  beech: [tx("oval", "eiförmig"), tx("smooth edge", "ganzrandig")],
  maple: [tx("palm-shaped", "handförmig gelappt"), tx("pointed lobes", "spitze Lappen")],
  lime: [tx("heart-shaped", "herzförmig"), tx("saw-toothed", "gesägt")],
  birch: [tx("diamond-shaped", "rautenförmig"), tx("double saw-toothed", "doppelt gesägt")],
  chestnut: [tx("compound", "zusammengesetzt"), tx("palmate", "gefingert")],
  ash: [tx("compound", "zusammengesetzt"), tx("pinnate", "gefiedert")],
};

/** "zur Linde" / "zum Ahorn" */
const zuDe = (id: TreeId) => `${TREE_ART[id] === "der" ? "zum" : "zur"} ${de(TREE_NAME[id])}`;

function treeSolution(id: TreeId) {
  const [a, b] = LEAF_KEYS[id];
  const F = TREE_FACTS[id];
  return [
    { math: join(q(a, "f"), "\\;", q(b, "r")), note: tx(`Leaf: ${en(F.shape)}. Edge: ${en(F.margin)}.`, `Blatt: ${de(F.shape)}. Rand: ${de(F.margin)}.`) },
    { math: join(q(a, "f"), "\\Rightarrow#r", q(capT(TREE_NAME[id]), "ans")), note: tx(`So it's the **${en(TREE_NAME[id])}**. Its fruit: ${en(F.fruit)}.`, `Also ist es ${TREE_ART[id]} **${de(TREE_NAME[id])}**. Frucht: ${de(F.fruit)}.`), highlight: ["ans"] },
  ];
}

function leafTask(rng: Rng, fixed?: TreeId): Exercise {
  const id = fixed ?? rng.pick(TREES);
  const wrong = pickSome(rng, TREE_CONFUSE[id].slice(0, 4), 3);
  const opts: Opt[] = [{ text: capT(TREE_NAME[id]) }, ...wrong.map((w) => ({ text: capT(TREE_NAME[w]), title: leafSay(id, w)[0], say: leafSay(id, w)[1] }))];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Which tree?", "Welcher Baum?"),
    text: tx("Which tree does this leaf come from?", "Von welchem Baum stammt dieses Blatt?"),
    visual: visual(DiversityLeafPicture, { id }),
    answer,
    hint: tx("Look at the shape first, then at the edge. Is it one blade, or is it made of separate leaflets?", "Schau zuerst auf die Form, dann auf den Rand. Ist es eine Spreite oder besteht es aus einzelnen Teilblättchen?"),
    solution: treeSolution(id),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Tree from its fruit

function fruitTask(rng: Rng): Exercise {
  const id = rng.pick(TREES);
  const opts: Opt[] = [{ text: capT(TREE_NAME[id]) }, ...FRUIT_CONFUSE[id].map((w) => ({ text: capT(TREE_NAME[w]), title: fruitSay(id, w)[0], say: fruitSay(id, w)[1] }))];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Whose fruit?", "Wessen Frucht?"),
    text: tx("Which tree does this fruit belong to?", "Zu welchem Baum gehört diese Frucht?"),
    visual: visual(DiversityFruitPicture, { id }),
    answer,
    hint: tx("Is it a nut in a cup, a spiny husk, a winged fruit? How many wings?", "Ist es eine Nuss im Becher, eine stachelige Hülle, eine Flügelfrucht? Wie viele Flügel?"),
    solution: [
      { math: q(FRUIT_NAME[id], "f"), note: tx(`The picture shows ${en(FRUIT_NAME[id])}.`, `Das Bild zeigt ${de(FRUIT_NAME[id])}.`) },
      { math: join(q(FRUIT_NAME[id], "f"), "\\Rightarrow#r", q(capT(TREE_NAME[id]), "ans")), note: tx(`They belong to the **${en(TREE_NAME[id])}**.`, `Sie gehören ${zuDe(id).replace(" ", " **")}**.`), highlight: ["ans"] },
    ],
    mistakes,
  };
}

/** Match trees and fruits. */
function fruitMatchTask(rng: Rng): Exercise {
  const ids = pickSome(rng, TREES, 4);
  const pairs: [Text, Text][] = ids.map((id) => [capT(TREE_NAME[id]), FRUIT_NAME[id]]);
  const rest = TREES.filter((t) => !ids.includes(t));
  const distractors = rng.chance(0.5) ? [FRUIT_NAME[rng.pick(rest)]] : undefined;
  const has = (a: TreeId) => ids.includes(a);
  const list: Mistake[] = [];
  const answer: AnswerSpec = { kind: "match", pairs, ...(distractors ? { distractors } : {}) };
  const swap = (a: TreeId, b: TreeId, title: Text, say: Text) => {
    if (has(a) && has(b))
      list.push({
        when: {
          kind: "match",
          pairs: [
            [capT(TREE_NAME[a]), FRUIT_NAME[b]],
            [capT(TREE_NAME[b]), FRUIT_NAME[a]],
          ],
        },
        title,
        say,
      });
  };
  swap("beech", "chestnut", tx("Two spiny husks", "Zwei stachelige Hüllen"), tx("Beech and horse chestnut both have spiny husks. Small three-sided nuts: beech. A big shiny seed: horse chestnut.", "Buche und Rosskastanie haben beide stachelige Hüllen. Kleine dreikantige Nüsse: Buche. Ein großer glänzender Samen: Rosskastanie."));
  swap("maple", "ash", tx("Count the wings", "Zähl die Flügel"), tx("Maple fruits have two wings joined together, ash fruits only one wing each.", "Ahornfrüchte haben zwei zusammenhängende Flügel, Eschenfrüchte nur einen Flügel."));
  swap("maple", "lime", tx("Own wing or shared wing?", "Eigener oder gemeinsamer Flügel?"), tx("In the maple each nut has its own wing. In the lime several nuts hang from one pale wing.", "Beim Ahorn hat jede Nuss ihren eigenen Flügel. Bei der Linde hängen mehrere Nüsschen an einem hellen Flugblatt."));
  swap("oak", "beech", tx("Cup or husk?", "Becher oder Hülle?"), tx("Acorns sit in a smooth, scaly cup; beechnuts in a spiny husk.", "Eicheln sitzen in einem schuppigen Becher, Bucheckern in einer stacheligen Hülle."));
  return {
    instruction: tx("Match tree and fruit", "Ordne Baum und Frucht zu"),
    text: tx("Which fruit belongs to which tree?", "Welche Frucht gehört zu welchem Baum?"),
    answer,
    hint: tx("Think of what you find under the trees in autumn: acorns, beechnuts, conkers, little propellers…", "Denk daran, was du im Herbst unter den Bäumen findest: Eicheln, Bucheckern, Kastanien, kleine Propeller …"),
    solution: ids.slice(0, 2).map((id, i) => ({ math: join(q(capT(TREE_NAME[id]), `t${i}`), "\\to", q(FRUIT_NAME[id], `f${i}`)), note: TREE_FACTS[id].fruit })).concat([{ math: join(q(capT(TREE_NAME[ids[2]]), "t2"), "\\to", q(FRUIT_NAME[ids[2]], "f2"), "\\quad", q(capT(TREE_NAME[ids[3]]), "t3"), "\\to", q(FRUIT_NAME[ids[3]], "f3")), note: tx("And the other two.", "Und die beiden anderen.") }]),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Leaf edge and leaf type

const MARGINS: Text[] = [tx("smooth (entire)", "ganzrandig"), tx("saw-toothed", "gesägt"), tx("double saw-toothed", "doppelt gesägt"), tx("lobed", "gelappt")];
const MARGIN_OF: Partial<Record<TreeId, number>> = { beech: 0, lime: 1, birch: 2, oak: 3 };

function marginTask(rng: Rng): Exercise {
  const id = rng.pick(["beech", "lime", "birch", "oak"] as TreeId[]);
  const right = MARGIN_OF[id]!;
  const say: Record<string, [Text, Text, boolean?]> = {
    "2>1": [tx("Look closer", "Schau genauer"), tx("Nearly! Look closely: on the big teeth there are small ones. That's called double saw-toothed.", "Fast! Schau genau hin: Auf den großen Zähnen sitzen noch kleine. Das heißt doppelt gesägt."), true],
    "1>2": [tx("All teeth alike", "Alle Zähne gleich"), tx("The teeth are all about the same size, there are no small teeth on big ones.", "Die Zähne sind alle etwa gleich groß, auf großen Zähnen sitzen keine kleinen.")],
    "0>1": [tx("No teeth", "Keine Zähne"), tx("This edge has no teeth at all. It is only a little wavy.", "Dieser Rand hat gar keine Zähne. Er ist nur leicht gewellt.")],
    "3>0": [tx("Deep bays", "Tiefe Buchten"), tx("The edge between the bays is smooth, true. But the blade is cut in deeply: that's what counts here.", "Der Rand zwischen den Buchten ist zwar glatt. Aber die Spreite ist tief eingebuchtet: Das zählt hier.")],
    "0>3": [tx("Not cut in", "Nicht eingeschnitten"), tx("The edge only waves a little. Lobed leaves are cut in deeply, like oak leaves.", "Der Rand ist nur leicht gewellt. Gelappte Blätter sind tief eingeschnitten, wie bei der Eiche.")],
  };
  const opts: Opt[] = [{ text: MARGINS[right] }];
  MARGINS.forEach((m, i) => {
    if (i === right) return;
    const s = say[`${right}>${i}`];
    opts.push(s ? { text: m, title: s[0], say: s[1] } : { text: m });
  });
  const { answer, mistakes } = choice(rng, opts);
  // Single instead of double teeth is a near miss.
  if (right === 2) mistakes.forEach((m) => m.say === say["2>1"][1] && (m.close = true));
  return {
    instruction: tx("Describe the leaf edge", "Beschreib den Blattrand"),
    text: tx("What is the edge of this leaf like?", "Wie ist der Rand dieses Blattes?"),
    visual: visual(DiversityLeafPicture, { id }),
    answer,
    hint: tx("Run your eyes along the edge: smooth, teeth, teeth on teeth, or deep bays?", "Fahr mit den Augen den Rand entlang: glatt, Zähne, Zähne auf Zähnen oder tiefe Buchten?"),
    solution: [
      { math: q(MARGINS[right], "ans"), note: tx(`The ${en(TREE_NAME[id])} leaf: ${en(TREE_FACTS[id].margin)}.`, `Blatt der ${de(TREE_NAME[id])}: ${de(TREE_FACTS[id].margin)}.`), highlight: ["ans"] },
    ],
    mistakes,
  };
}

const TYPES: Text[] = [tx("simple", "einfach"), tx("compound: palmate (like fingers)", "zusammengesetzt: gefingert"), tx("compound: pinnate (like a feather)", "zusammengesetzt: gefiedert")];
const TYPE_OF: Record<TreeId, number> = { oak: 0, beech: 0, maple: 0, lime: 0, birch: 0, chestnut: 1, ash: 2 };

function leafTypeTask(rng: Rng): Exercise {
  const id = rng.pick(TREES);
  const right = TYPE_OF[id];
  const lobedTrap: [Text, Text] = [tx("Lobed is still simple", "Gelappt ist trotzdem einfach"), tx("The lobes are cut in, but the blade hangs together in one piece. That's a simple leaf.", "Die Lappen sind eingeschnitten, aber die Spreite hängt zusammen. Das ist ein einfaches Blatt.")];
  const says: Record<string, [Text, Text]> = {
    "0>1": lobedTrap,
    "0>2": lobedTrap,
    "1>2": [tx("Fingers or feather?", "Finger oder Feder?"), tx("All leaflets start from one point at the end of the stalk, like fingers on a hand.", "Alle Teilblättchen gehen von einem Punkt am Ende des Stiels aus, wie die Finger einer Hand.")],
    "2>1": [tx("Fingers or feather?", "Finger oder Feder?"), tx("The leaflets sit in pairs along a central stalk, like the parts of a feather.", "Die Fiederblättchen sitzen paarweise an einer Mittelachse, wie die Äste einer Feder.")],
    "1>0": [tx("Separate leaflets", "Einzelne Teilblättchen"), tx("Look: the parts are separate little leaves, each with its own base. So the leaf is compound.", "Schau hin: Die Teile sind einzelne Blättchen mit eigenem Grund. Also ist das Blatt zusammengesetzt.")],
    "2>0": [tx("Separate leaflets", "Einzelne Teilblättchen"), tx("Look: the parts are separate little leaves along a stalk. So the leaf is compound.", "Schau hin: Die Teile sind einzelne Blättchen an einer Achse. Also ist das Blatt zusammengesetzt.")],
  };
  const opts: Opt[] = [{ text: TYPES[right] }];
  TYPES.forEach((t, i) => {
    if (i === right) return;
    const s = says[`${right}>${i}`];
    opts.push(s ? { text: t, title: s[0], say: s[1] } : { text: t });
  });
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Simple or compound?", "Einfach oder zusammengesetzt?"),
    text: tx("What kind of leaf is this?", "Was für ein Blatt ist das?"),
    visual: visual(DiversityLeafPicture, { id }),
    answer,
    hint: tx("Does the blade hang together in one piece, or is it made of separate leaflets? If separate: from one point or in pairs?", "Hängt die Spreite zusammen oder besteht sie aus einzelnen Teilblättchen? Wenn einzeln: von einem Punkt aus oder paarweise?"),
    solution: [{ math: q(TYPES[right], "ans"), note: tx(`The ${en(TREE_NAME[id])}: ${en(TREE_FACTS[id].kind)}.`, `${id === "maple" ? "Der" : "Die"} ${de(TREE_NAME[id])}: ${de(TREE_FACTS[id].kind)}.`), highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Conifers

function coniferOpts(id: ConiferId, rng: Rng): Opt[] {
  const wrong = pickSome(rng, CONIFER_CONFUSE[id].slice(0, 4), 3);
  return [{ text: capT(CONIFER_NAME[id]) }, ...wrong.map((w) => ({ text: capT(CONIFER_NAME[w]), title: coniferSay(id, w)[0], say: coniferSay(id, w)[1] }))];
}

function coniferSolution(id: ConiferId, clue: Text) {
  return [
    { math: q(CONIFER_NAME[id], "ans"), note: tx(`${en(clue)} That's the **${en(CONIFER_NAME[id])}**.`, `${de(clue)} Das ist die **${de(CONIFER_NAME[id])}**.`), highlight: ["ans"] },
  ];
}

function coniferPicTask(rng: Rng, fixed?: ConiferId, season?: "summer" | "autumn"): Exercise {
  const id = fixed ?? rng.pick(CONIFERS);
  const s = season ?? (id === "larch" && rng.chance(0.4) ? "autumn" : "summer");
  const { answer, mistakes } = choice(rng, coniferOpts(id, rng));
  return {
    instruction: tx("Which conifer?", "Welcher Nadelbaum?"),
    text: s === "autumn" ? tx("A conifer twig in October. Which tree is it?", "Ein Nadelzweig im Oktober. Welcher Baum ist das?") : tx("Which conifer does this twig come from?", "Von welchem Nadelbaum stammt dieser Zweig?"),
    visual: visual(DiversityTwigPicture, { id, season: s }),
    answer,
    hint: tx("Single needles or groups? Flat or pointed? White stripes? And look at the cones.", "Einzelne Nadeln oder Gruppen? Flach oder spitz? Weiße Streifen? Und schau auf die Zapfen."),
    solution: coniferSolution(id, CONIFER_CLUES[id][id === "larch" && s === "autumn" ? 1 : 0]),
    mistakes,
  };
}

function coniferClueTask(rng: Rng): Exercise {
  const id = rng.pick(CONIFERS);
  const clues = pickSome(rng, CONIFER_CLUES[id], 2);
  const { answer, mistakes } = choice(rng, coniferOpts(id, rng));
  return {
    instruction: tx("Identify the conifer", "Bestimme den Nadelbaum"),
    text: tx(`${en(clues[0])} ${en(clues[1])} Which tree is it?`, `${de(clues[0])} ${de(clues[1])} Welcher Baum ist das?`),
    answer,
    hint: tx("Spruce stings, fir is kind. Pine needles come in pairs, larch needles in tufts. The yew has no cones.", "Die Fichte sticht, die Tanne nicht. Kiefernnadeln stehen zu zweit, Lärchennadeln in Büscheln. Die Eibe hat keine Zapfen."),
    solution: coniferSolution(id, clues[0]),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Early bloomers

const ORGANS: OrganId[] = ["bulb", "corm", "rhizome", "roottuber"];

function organTask(rng: Rng, fixed?: Bloomer, picture?: boolean): Exercise {
  const b = fixed ?? rng.pick(BLOOMERS);
  const pic = picture ?? (!!b.pic && rng.chance(0.5));
  const opts: Opt[] = [{ text: capT(ORGAN_SHORT[b.organ]) }, ...ORGANS.filter((o) => o !== b.organ).map((o) => ({ text: capT(ORGAN_SHORT[o]), title: organSay(b.organ, o, b)[0], say: organSay(b.organ, o, b)[1] }))];
  const { answer, mistakes } = choice(rng, opts);
  const the = bloomerThe(b);
  return {
    instruction: tx("Storage organ", "Speicherorgan"),
    text: pic ? tx(`This is ${en(the)}. Which storage organ does it have in the soil (marked ?)?`, `Das ist ${de(the)}. Welches Speicherorgan hat ${b.art === "das" ? "es" : b.art === "die" ? "sie" : "er"} im Boden (mit ? markiert)?`) : tx(`Which storage organ does ${en(the)} have?`, `Welches Speicherorgan hat ${de(the)}?`),
    ...(pic && b.pic ? { visual: visual(DiversityBloomerPicture, { plant: b.pic, mode: "numbers", ask: "storage", legend: "none" }) } : {}),
    answer,
    hint: tx("Bulb: layers of thick leaves. Corm: a solid, thickened stem. Rhizome: a stem lying sideways in the soil. Root tubers: thickened roots.", "Zwiebel: Schichten aus dicken Blättern. Sprossknolle: eine feste, verdickte Sprossachse. Erdspross: ein waagerechter Spross im Boden. Wurzelknollen: verdickte Wurzeln."),
    solution: [
      { math: join(q(capT(b.name), "p"), "\\to", q(capT(ORGAN_SHORT[b.organ]), "ans")), note: tx(`${en(the).replace(/^the/, "The")} stores starch in ${b.organ === "roottuber" ? "" : "a "}${en(ORGAN_SHORT[b.organ])}.`, `${de(the).charAt(0).toUpperCase()}${de(the).slice(1)} speichert Stärke in ${b.organ === "bulb" ? "einer Zwiebel" : b.organ === "corm" ? "einer Sprossknolle" : b.organ === "rhizome" ? "einem Erdspross" : "Wurzelknollen"}.`), highlight: ["ans"] },
    ],
    mistakes,
  };
}

type Why = { q: Text; right: Text; wrong: Opt[]; why: Text };

const WHYS: Why[] = [
  {
    q: tx("Why do many plants in a broadleaf wood flower as early as March and April?", "Warum blühen viele Pflanzen im Laubwald schon im März und April?"),
    right: tx("Because the trees have no leaves yet, so plenty of light reaches the forest floor.", "Weil die Bäume noch kein Laub haben und deshalb viel Licht auf den Waldboden fällt."),
    wrong: [
      { text: tx("Because it is warmest in the wood in spring.", "Weil es im Frühling im Wald am wärmsten ist."), title: tx("It's about light", "Es geht ums Licht"), say: tx("In March it is still quite cold. What these plants need is light, and in summer the leafy roof takes it away.", "Im März ist es noch ziemlich kalt. Was diese Pflanzen brauchen, ist Licht, und im Sommer nimmt es ihnen das Blätterdach weg.") },
      { text: tx("Because their flowers need no light.", "Weil ihre Blüten kein Licht brauchen."), title: tx("Light is the point", "Licht ist der Punkt"), say: tx("The opposite: they hurry so that their leaves get light for photosynthesis before the trees shade them.", "Im Gegenteil: Sie beeilen sich, damit ihre Blätter Licht für die Fotosynthese bekommen, bevor die Bäume sie beschatten.") },
      { text: tx("Because the soil is full of nutrients only in spring.", "Weil der Boden nur im Frühling Nährstoffe enthält."), title: tx("Not the soil", "Nicht der Boden"), say: tx("Plants make their food themselves by photosynthesis. The reason is the light before the trees come into leaf.", "Pflanzen stellen ihre Nährstoffe durch Fotosynthese selbst her. Der Grund ist das Licht, bevor die Bäume austreiben.") },
    ],
    why: tx("Before the beeches and oaks come into leaf, up to half of the daylight reaches the floor. Later it is only a few percent.", "Bevor Buchen und Eichen austreiben, erreicht bis zur Hälfte des Tageslichts den Boden. Später sind es nur noch wenige Prozent."),
  },
  {
    q: tx("Where do early bloomers get the energy to sprout so quickly?", "Woher nehmen Frühblüher die Energie, um so schnell auszutreiben?"),
    right: tx("From nutrients (starch) they stored in their storage organ the year before.", "Aus Nährstoffen (Stärke), die sie im Vorjahr in ihrem Speicherorgan eingelagert haben."),
    wrong: [
      { text: tx("From nutrients they take up from the soil in spring.", "Aus Nährstoffen, die sie im Frühjahr aus dem Boden aufnehmen."), title: tx("Plants don't eat soil", "Pflanzen essen keine Erde"), say: tx("From the soil a plant only takes water and minerals. Its food (sugar, starch) it makes itself by photosynthesis, and early bloomers did that last year.", "Aus dem Boden nimmt eine Pflanze nur Wasser und Mineralstoffe auf. Ihre Nährstoffe (Zucker, Stärke) stellt sie selbst durch Fotosynthese her, und das haben Frühblüher im Vorjahr getan.") },
      { text: tx("From the warmth of the soil.", "Aus der Wärme des Bodens."), title: tx("Warmth is no food", "Wärme ist keine Nahrung"), say: tx("Warmth only speeds things up. The energy comes from stored starch.", "Wärme beschleunigt nur. Die Energie steckt in gespeicherter Stärke.") },
      { text: tx("From light caught by their flowers.", "Aus Licht, das ihre Blüten auffangen."), title: tx("Flowers aren't leaves", "Blüten sind keine Blätter"), say: tx("Flowers don't do photosynthesis. And at first there are not even leaves yet: the shoot lives on its store.", "Blüten betreiben keine Fotosynthese. Und anfangs gibt es noch nicht einmal Blätter: Der Spross lebt von seinem Speicher.") },
    ],
    why: tx("The bulb, corm, rhizome or root tubers are full of starch from last year. That's why the shoot can grow without photosynthesis at first.", "Zwiebel, Knolle, Erdspross oder Wurzelknollen sind voller Stärke aus dem Vorjahr. Deshalb kann der Spross zuerst ohne Fotosynthese wachsen."),
  },
  {
    q: tx("Why do the parts above ground of many early bloomers die back in June?", "Warum sterben die oberirdischen Teile vieler Frühblüher im Juni ab?"),
    right: tx("Under the dense leaf roof it is too dark for enough photosynthesis.", "Unter dem dichten Blätterdach ist es zu dunkel für genug Fotosynthese."),
    wrong: [
      { text: tx("Because their store is empty by then.", "Weil ihr Speicher dann leer ist."), title: tx("The store is full", "Der Speicher ist voll"), say: tx("By June the leaves have refilled the store. The plant withdraws with a full store and waits in the soil.", "Bis Juni haben die Blätter den Speicher wieder aufgefüllt. Die Pflanze zieht sich mit vollem Speicher zurück und wartet im Boden.") },
      { text: tx("Because they freeze in summer.", "Weil sie im Sommer erfrieren."), title: tx("No frost in June", "Kein Frost im Juni"), say: tx("There's no frost in June. The problem is the shade of the trees.", "Im Juni gibt es keinen Frost. Das Problem ist der Schatten der Bäume.") },
      { text: tx("Because they need no more water.", "Weil sie kein Wasser mehr brauchen."), title: tx("Think of the light", "Denk ans Licht"), say: tx("They still need water. What's missing is light: only a few percent reach the floor.", "Wasser brauchen sie weiterhin. Was fehlt, ist Licht: Nur wenige Prozent erreichen den Boden.") },
    ],
    why: tx("From May the canopy closes. With so little light the leaves can't make enough sugar, so the plant withdraws into the soil.", "Ab Mai schließt sich das Blätterdach. Bei so wenig Licht können die Blätter nicht genug Zucker bilden, also zieht sich die Pflanze in den Boden zurück."),
  },
  {
    q: tx("What do early bloomers mainly store in their storage organs?", "Was speichern Frühblüher in ihren Speicherorganen vor allem?"),
    right: tx("Starch (food made by photosynthesis)", "Stärke (durch Fotosynthese gebildete Nährstoffe)"),
    wrong: [
      { text: tx("Minerals from the soil", "Mineralstoffe aus dem Boden"), title: tx("Food, not minerals", "Nährstoffe, keine Mineralstoffe"), say: tx("Minerals are needed too, but the store is mostly starch: sugar made by photosynthesis and packed away.", "Mineralstoffe braucht die Pflanze auch, aber der Speicher besteht vor allem aus Stärke: Zucker aus der Fotosynthese, platzsparend verpackt.") },
      { text: tx("Oxygen", "Sauerstoff"), title: tx("Not a gas", "Kein Gas"), say: tx("Oxygen is released by photosynthesis, not stored. Try the iodine test on a potato: blue-black means starch.", "Sauerstoff wird bei der Fotosynthese abgegeben, nicht gespeichert. Mach die Iodprobe an einer Kartoffel: Blauschwarz heißt Stärke.") },
      { text: tx("Chlorophyll", "Blattgrün (Chlorophyll)"), title: tx("Underground and not green", "Im Boden und nicht grün") , say: tx("Storage organs in the soil are pale, not green. They are packed with starch.", "Speicherorgane im Boden sind blass, nicht grün. Sie sind voller Stärke.") },
    ],
    why: tx("Starch is how plants store sugar. The iodine test turns it blue-black.", "In Form von Stärke speichern Pflanzen Zucker. Die Iodprobe färbt sie blauschwarz."),
  },
];

function whyTask(rng: Rng, fixed?: number): Exercise {
  const w = WHYS[fixed ?? rng.int(0, WHYS.length - 1)];
  const { answer, mistakes } = choice(rng, [{ text: w.right }, ...w.wrong]);
  return {
    instruction: tx("Early bloomers", "Frühblüher"),
    text: w.q,
    answer,
    hint: tx("Think about the wood through the year: when is it light on the floor, and when dark?", "Denk an den Wald im Jahreslauf: Wann ist es am Boden hell, wann dunkel?"),
    solution: [{ math: join(q(tx("light", "Licht"), "l"), "\\;", q(tx("store", "Speicher"), "s")), note: w.why }],
    mistakes,
  };
}

const REST: Record<OrganId, Text> = {
  bulb: tx("Winter: the bulb rests in the soil, full of starch.", "Winter: Die Zwiebel ruht voller Stärke im Boden."),
  corm: tx("Winter: the corm rests in the soil, full of starch.", "Winter: Die Sprossknolle ruht voller Stärke im Boden."),
  rhizome: tx("Winter: the rhizome rests in the soil, full of starch.", "Winter: Der Erdspross ruht voller Stärke im Boden."),
  roottuber: tx("Winter: the root tubers rest in the soil, full of starch.", "Winter: Die Wurzelknollen ruhen voller Stärke im Boden."),
};
const YEAR: Text[] = [
  tx("Early spring: a shoot pushes up fast, using the stored starch.", "Vorfrühling: Ein Spross wächst schnell nach oben und verbraucht dabei gespeicherte Stärke."),
  tx("The plant flowers while plenty of light still reaches the floor.", "Die Pflanze blüht, solange noch viel Licht auf den Boden fällt."),
  tx("The leaves make sugar by photosynthesis and refill the store.", "Die Blätter bilden durch Fotosynthese Zucker und füllen den Speicher wieder auf."),
  tx("The trees come into leaf; the parts above ground wither.", "Die Bäume treiben aus, die oberirdischen Teile welken."),
];

function yearTask(rng: Rng): Exercise {
  const b = rng.pick(BLOOMERS);
  const all = [REST[b.organ], ...YEAR];
  const start = rng.int(0, 1);
  const items = rng.chance(0.4) ? all : all.slice(start, start + 4);
  const list: Mistake[] = [];
  if (items.includes(YEAR[1]) && items.includes(YEAR[2]))
    list.push({ when: { kind: "order", items: [YEAR[2], YEAR[1]] }, title: tx("Empty the store first", "Erst wird der Speicher geleert"), say: tx("Sprouting and flowering use up the store. Only afterwards do the leaves refill it, before it gets dark.", "Austreiben und Blühen verbrauchen den Speicher. Erst danach füllen die Blätter ihn wieder auf, bevor es dunkel wird.") });
  if (items.includes(YEAR[0]) && items.includes(YEAR[1]))
    list.push({ when: { kind: "order", items: [YEAR[1], YEAR[0]] }, title: tx("No flower without a shoot", "Keine Blüte ohne Spross"), say: tx("First the shoot has to come up out of the soil, then it can flower.", "Zuerst muss der Spross aus dem Boden kommen, dann kann er blühen.") });
  return {
    instruction: tx("Put the year in order", "Bring das Jahr in die richtige Reihenfolge"),
    text: tx(`The year of an early bloomer (${en(b.name)}). Put the steps in order.`, `Das Jahr eines Frühblühers (${de(b.name)}). Bring die Schritte in die richtige Reihenfolge.`),
    answer: { kind: "order", items },
    hint: tx("Start with the store in the soil. What uses the store, what fills it up again?", "Beginne mit dem Speicher im Boden. Was verbraucht den Speicher, was füllt ihn wieder auf?"),
    solution: [
      { math: join(q(tx("store full", "Speicher voll"), "a"), "\\to", q(tx("sprout, flower", "austreiben, blühen"), "b"), "\\to", q(tx("refill", "auffüllen"), "c"), "\\to", q(tx("withdraw", "einziehen"), "d")), note: tx("The store is used up in spring and refilled before the trees shade the floor.", "Der Speicher wird im Frühjahr verbraucht und wieder aufgefüllt, bevor die Bäume den Boden beschatten.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// True or false: a mix of statements

const STATEMENTS: MultiOpt[] = [
  { text: tx("The larch drops its needles in autumn.", "Die Lärche wirft im Herbst ihre Nadeln ab."), right: true, title: tx("It's true!", "Das stimmt!"), say: tx("That one is true: the larch is the only native conifer that is bare in winter.", "Das stimmt wirklich: Die Lärche ist der einzige heimische Nadelbaum, der im Winter kahl ist.") },
  { text: tx("The horse chestnut has palmate, compound leaves.", "Die Rosskastanie hat gefingerte, zusammengesetzte Blätter."), right: true },
  { text: tx("Most broadleaf trees drop their leaves in autumn.", "Die meisten Laubbäume werfen im Herbst ihre Blätter ab."), right: true },
  { text: tx("A rhizome is a stem, not a root.", "Ein Erdspross (Rhizom) ist ein Spross und keine Wurzel."), right: true, title: tx("It's true!", "Das stimmt!"), say: tx("True: a rhizome carries buds, and only shoots have buds.", "Stimmt: Ein Erdspross trägt Knospen, und Knospen haben nur Sprosse.") },
  { text: tx("The yew has no cones but red seed cups.", "Die Eibe trägt keine Zapfen, sondern rote Samenmäntel."), right: true },
  { text: tx("Pine needles grow in pairs.", "Kiefernnadeln stehen zu zweit."), right: true },
  { text: tx("Early bloomers use the light before the trees come into leaf.", "Frühblüher nutzen das Licht, bevor die Bäume austreiben."), right: true },
  { text: tx("Spruce cones hang down from the twig.", "Fichtenzapfen hängen nach unten."), right: true },
  { text: tx("All conifers are evergreen.", "Alle Nadelbäume sind immergrün."), right: false, title: tx("One exception", "Eine Ausnahme"), say: tx("Almost! But the larch drops its needles in autumn. So not all conifers are evergreen.", "Fast! Aber die Lärche wirft im Herbst ihre Nadeln ab. Also sind nicht alle Nadelbäume immergrün.") },
  { text: tx("All conifers carry cones.", "Alle Nadelbäume tragen Zapfen."), right: false, title: tx("The yew", "Die Eibe"), say: tx("The yew has no cones: each seed sits in a red, fleshy cup.", "Die Eibe hat keine Zapfen: Jeder Samen sitzt in einem roten, fleischigen Samenmantel.") },
  { text: tx("Early bloomers take their food from the soil in spring.", "Frühblüher holen sich ihre Nährstoffe im Frühjahr aus dem Boden."), right: false, title: tx("Plants make their own food", "Pflanzen machen ihre Nahrung selbst"), say: tx("From the soil they only take water and minerals. Their starch comes from last year's photosynthesis.", "Aus dem Boden kommen nur Wasser und Mineralstoffe. Ihre Stärke stammt aus der Fotosynthese des Vorjahrs.") },
  { text: tx("The crocus survives the winter as a bulb.", "Der Krokus überwintert als Zwiebel."), right: false, title: tx("Solid inside", "Innen fest"), say: tx("The crocus has a corm: solid inside, no layers. A bulb has layers of leaves.", "Der Krokus hat eine Sprossknolle: innen fest, ohne Schichten. Eine Zwiebel hat Schichten aus Blättern.") },
  { text: tx("The maple leaf is a compound leaf.", "Das Ahornblatt ist ein zusammengesetztes Blatt."), right: false, title: tx("Lobed, not compound", "Gelappt, nicht zusammengesetzt"), say: tx("The maple leaf is deeply lobed but hangs together in one piece: a simple leaf.", "Das Ahornblatt ist tief gelappt, hängt aber zusammen: ein einfaches Blatt.") },
  { text: tx("Fir cones hang down from the twig.", "Tannenzapfen hängen nach unten."), right: false, title: tx("Fir cones stand", "Tannenzapfen stehen"), say: tx("Fir cones stand upright and fall apart on the tree. Hanging cones belong to the spruce.", "Tannenzapfen stehen aufrecht und zerfallen am Baum. Hängende Zapfen hat die Fichte.") },
  { text: tx("Early bloomers flower early because it is warmest in spring.", "Frühblüher blühen früh, weil es im Frühling am wärmsten ist."), right: false, title: tx("It's the light", "Es ist das Licht"), say: tx("Spring is still cool. They flower early because the trees have no leaves yet and light reaches the floor.", "Der Frühling ist noch kühl. Sie blühen früh, weil die Bäume noch kein Laub haben und Licht auf den Boden fällt.") },
  { text: tx("The wood anemone stores food in a bulb.", "Das Buschwindröschen speichert in einer Zwiebel."), right: false, title: tx("A rhizome", "Ein Erdspross"), say: tx("The wood anemone has a rhizome: a thin stem lying sideways in the soil.", "Das Buschwindröschen hat einen Erdspross: einen dünnen Spross, der waagerecht im Boden liegt.") },
];

function statementsTask(rng: Rng): Exercise {
  const trues = STATEMENTS.filter((s) => s.right);
  const falses = STATEMENTS.filter((s) => !s.right);
  const k = rng.int(1, 3);
  const picked = [...pickSome(rng, trues, k), ...pickSome(rng, falses, 4 - k)];
  const { answer, mistakes } = multi(rng, picked);
  const rightOnes = picked.filter((s) => s.right);
  return {
    instruction: tx("Which statements are true?", "Welche Aussagen stimmen?"),
    text: tx("Select all true statements.", "Wähle alle Aussagen, die stimmen."),
    answer,
    hint: tx("Watch out for words like \"all\": one exception is enough to make a statement false.", "Achte auf Wörter wie „alle“: Eine Ausnahme reicht, damit eine Aussage falsch ist."),
    solution: [
      { math: q(tx(`${rightOnes.length} true`, `${rightOnes.length} richtig`), "n"), note: tx(`True: ${rightOnes.map((s) => en(s.text)).join(" ")}`, `Richtig: ${rightOnes.map((s) => de(s.text)).join(" ")}`) },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// The key

const KEY_TAXA = ["oak", "beech", "maple", "lime", "birch", "chestnut", "ash", "spruce", "fir", "pine", "larch", "yew"];
const pathText = (p: [number, "a" | "b"][]) => p.map(([n, s]) => `${n}${s}`).join(" → ");

function keyPathTask(rng: Rng): Exercise {
  const taxon = rng.pick(KEY_TAXA);
  const path = keyPath(TREE_KEY, taxon);
  const [ln, ls] = path[path.length - 1];
  const other = TREE_KEY.couplets[ln - 1][ls === "a" ? "b" : "a"].to;
  const name = (id: string) => capT(TREE_KEY.names[id]);
  const opts: Opt[] = [{ text: name(taxon) }];
  if (other.startsWith("="))
    opts.push({ text: name(other.slice(1)), title: tx("Wrong letter at the end", "Falscher Buchstabe am Ende"), say: tx(`At couplet ${ln} the path says ${ln}${ls}. Read the line with exactly that letter.`, `Bei Schritt ${ln} sagt der Weg ${ln}${ls}. Lies genau die Zeile mit diesem Buchstaben.`) });
  const conifer = ["spruce", "fir", "pine", "larch", "yew"].includes(taxon);
  const pool = KEY_TAXA.filter((x) => x !== taxon && `=${x}` !== other && ["spruce", "fir", "pine", "larch", "yew"].includes(x) === conifer);
  for (const x of pickSome(rng, pool, 4 - opts.length)) opts.push({ text: name(x) });
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Follow the key", "Folge dem Schlüssel"),
    text: tx(`Follow the path **${pathText(path)}** through the key. Which tree do you reach?`, `Folge dem Weg **${pathText(path)}** durch den Schlüssel. Bei welchem Baum kommst du an?`),
    visual: visual(DiversityKeyTable, { which: "trees", couplets: path.map(([n]) => n) }),
    answer,
    hint: tx("Start at 1 and go line by line: each line tells you where to go next.", "Starte bei 1 und geh Zeile für Zeile: Jede Zeile sagt dir, wohin es weitergeht."),
    solution: [{ math: join(q(pathText(path), "p"), "\\Rightarrow#r", q(name(taxon), "ans")), note: tx(`Line ${ln}${ls} ends with the name: **${en(TREE_KEY.names[taxon])}**.`, `Die Zeile ${ln}${ls} endet mit dem Namen: **${de(TREE_KEY.names[taxon])}**.`), highlight: ["ans"] }],
    mistakes,
  };
}

/** Identify with the key from a description. */
function keyIdentifyTask(rng: Rng): Exercise {
  const id = rng.pick(TREES);
  const F = TREE_FACTS[id];
  const path = keyPath(TREE_KEY, id);
  const wrong = pickSome(rng, TREE_CONFUSE[id].slice(0, 4), 3);
  const opts: Opt[] = [{ text: capT(TREE_NAME[id]) }, ...wrong.map((w) => ({ text: capT(TREE_NAME[w]), title: leafSay(id, w)[0], say: leafSay(id, w)[1] }))];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Identify with the key", "Bestimme mit dem Schlüssel"),
    text: tx(`A tree with broad leaves. Leaf: ${en(F.shape)}. Edge: ${en(F.margin)}. Use the key: which tree is it?`, `Ein Baum mit breiten Blättern. Blatt: ${de(F.shape)}. Rand: ${de(F.margin)}. Bestimme mit dem Schlüssel: Welcher Baum ist es?`),
    visual: visual(DiversityKeyTable, { which: "trees", couplets: [1, 6, 7, 8, 9, 10, 11] }),
    answer,
    hint: tx("Start at 1. Broad leaves: go to 6. Then decide at every step.", "Starte bei 1. Breite Blätter: weiter zu 6. Dann entscheide bei jedem Schritt."),
    solution: [{ math: join(q(pathText(path), "p"), "\\Rightarrow#r", q(capT(TREE_NAME[id]), "ans")), note: tx(`The path ${pathText(path)} leads to the **${en(TREE_NAME[id])}**.`, `Der Weg ${pathText(path)} führt ${zuDe(id).replace(" ", " **")}**.`), highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  switch (rng.int(0, 13)) {
    case 0:
    case 1:
      return leafTask(rng);
    case 2:
      return fruitTask(rng);
    case 3:
      return fruitMatchTask(rng);
    case 4:
      return marginTask(rng);
    case 5:
      return leafTypeTask(rng);
    case 6:
      return coniferPicTask(rng);
    case 7:
      return coniferClueTask(rng);
    case 8:
    case 9:
      return organTask(rng);
    case 10:
      return whyTask(rng);
    case 11:
      return yearTask(rng);
    case 12:
      return statementsTask(rng);
    default:
      return rng.chance(0.5) ? keyPathTask(rng) : keyIdentifyTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const checkLeaf = leafTask(createRng(11), "lime");
const checkLarch = coniferPicTask(createRng(4), "larch", "autumn");
const checkCrocus = organTask(createRng(9), BLOOMERS.find((b) => en(b.name) === "crocus")!, true);
const checkWhy = whyTask(createRng(3), 1);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Broadleaf or conifer?", "Laubbaum oder Nadelbaum?"),
      blob: tx("Let's go for a walk in the wood! First question: leaves or needles?", "Komm mit in den Wald! Erste Frage: Blätter oder Nadeln?"),
      body: tx("Trees are sorted by their leaves first. **Broadleaf trees** have broad, flat leaves. **Conifers** have narrow, tough needles and usually cones.", "Bäume unterscheidest du zuerst an ihren Blättern. **Laubbäume** haben breite, flache Blätter. **Nadelbäume** haben schmale, harte Nadeln und meist Zapfen."),
      frames: [
        { math: join(q(tx("broadleaf trees", "Laubbäume"), "l"), "\\quad", q(tx("conifers", "Nadelbäume"), "n")), note: tx("Oak, beech, maple, lime, birch, horse chestnut: broadleaf trees. Spruce, fir, pine, larch, yew: conifers.", "Eiche, Buche, Ahorn, Linde, Birke, Rosskastanie: Laubbäume. Fichte, Tanne, Kiefer, Lärche, Eibe: Nadelbäume.") },
        { math: join(q(tx("broadleaf trees:", "Laubbäume:"), "l"), "\\;", q(tx("bare in winter", "im Winter kahl"), "w")), note: tx("Most broadleaf trees drop their leaves in autumn. Without leaves they lose hardly any water in winter, when the ground is frozen.", "Die meisten Laubbäume werfen im Herbst ihr Laub ab. Ohne Blätter verlieren sie im Winter kaum Wasser, wenn der Boden gefroren ist."), highlight: ["w"] },
        { math: join(q(tx("conifers:", "Nadelbäume:"), "n"), "\\;", q(tx("evergreen", "immergrün"), "e")), note: tx("Most conifers stay green. Their needles have a thick wax layer and lose little water. Each needle lives for several years.", "Die meisten Nadelbäume bleiben grün. Ihre Nadeln haben eine dicke Wachsschicht und verdunsten wenig Wasser. Jede Nadel lebt mehrere Jahre."), highlight: ["e"] },
        { math: join(q(tx("conifers:", "Nadelbäume:"), "n"), "\\;", q(tx("evergreen", "immergrün"), "e"), "\\;", q(tx("except the larch", "außer der Lärche"), "x")), note: tx("But careful: the **larch** is a conifer that drops its needles in autumn!", "Aber Vorsicht: Die **Lärche** ist ein Nadelbaum, der im Herbst seine Nadeln abwirft!"), highlight: ["x"] },
      ],
    },
    {
      type: "widget",
      title: tx("Leaves and fruits of our trees", "Blätter und Früchte unserer Bäume"),
      blob: tx("Tap a tree. In the corner you see its fruit!", "Tipp auf einen Baum. In der Ecke siehst du seine Frucht!"),
      body: tx("Every broadleaf tree has its own leaf shape and its own fruit. You can tell them apart even in winter, by the fruits on the ground.", "Jeder Laubbaum hat seine eigene Blattform und seine eigene Frucht. Sogar im Winter erkennst du ihn an den Früchten am Boden."),
      widget: DiversityLeafGallery,
    },
    {
      type: "explain",
      title: tx("Describing a leaf", "Ein Blatt beschreiben"),
      blob: tx("Three questions and you can describe any leaf!", "Drei Fragen, und du kannst jedes Blatt beschreiben!"),
      body: tx("A leaf has a **blade** (Blattspreite) and a **stalk** (Blattstiel). To identify it, ask about the shape, the edge and whether it is simple or compound.", "Ein Laubblatt hat eine **Blattspreite** und einen **Blattstiel**. Zum Bestimmen fragst du nach Form, Rand und ob es einfach oder zusammengesetzt ist."),
      frames: [
        { math: join(q(tx("1. shape", "1. Form"), "a")), note: tx("Oval like the beech, heart-shaped like the lime, diamond-shaped like the birch, or lobed like oak and maple.", "Eiförmig wie bei der Buche, herzförmig wie bei der Linde, rautenförmig wie bei der Birke oder gelappt wie bei Eiche und Ahorn.") },
        { math: join(q(tx("1. shape", "1. Form"), "a"), "\\quad", q(tx("2. edge", "2. Rand"), "b")), note: tx("Smooth (entire) like the beech, saw-toothed like the lime, double saw-toothed like the birch: big teeth with small ones on them.", "Glatt (ganzrandig) wie bei der Buche, gesägt wie bei der Linde, doppelt gesägt wie bei der Birke: große Zähne mit kleinen darauf.") },
        { math: join(q(tx("1. shape", "1. Form"), "a"), "\\quad", q(tx("2. edge", "2. Rand"), "b"), "\\quad", q(tx("3. simple?", "3. einfach?"), "c")), note: tx("**Simple** leaves have one blade, even if it is deeply lobed (maple). **Compound** leaves are made of separate leaflets: palmate like the horse chestnut or pinnate like the ash.", "**Einfache** Blätter haben eine Spreite, auch wenn sie tief gelappt ist (Ahorn). **Zusammengesetzte** Blätter bestehen aus einzelnen Teilblättchen: gefingert wie bei der Rosskastanie oder gefiedert wie bei der Esche."), highlight: ["c"] },
      ],
    },
    { type: "check", blob: tx("Heart or diamond? Look closely at the base.", "Herz oder Raute? Schau dir den Blattgrund genau an."), exercise: checkLeaf },
    {
      type: "widget",
      title: tx("Five conifers", "Fünf Nadelbäume"),
      blob: tx("Switch to winter and watch one of them!", "Schalte auf Winter und beobachte einen von ihnen!"),
      body: tx("Look at how the needles sit on the twig (singly, in pairs, in tufts), whether they are flat or pointed, and at the cones.", "Achte darauf, wie die Nadeln am Zweig sitzen (einzeln, zu zweit, in Büscheln), ob sie flach oder spitz sind, und auf die Zapfen."),
      widget: DiversityConifers,
    },
    { type: "check", blob: tx("A twig in October. Not every conifer stays green!", "Ein Zweig im Oktober. Nicht jeder Nadelbaum bleibt grün!"), exercise: checkLarch },
    {
      type: "widget",
      title: tx("The dichotomous key", "Der Bestimmungsschlüssel"),
      blob: tx("Detective work: two choices at every step!", "Detektivarbeit: Bei jedem Schritt zwei Möglichkeiten!"),
      body: tx("A **dichotomous key** always offers two descriptions (a and b). Exactly one fits your plant. It sends you to the next step until you reach a name. If the name doesn't fit, go back and check.", "Ein **Bestimmungsschlüssel** bietet immer zwei Beschreibungen an (a und b). Genau eine passt zu deiner Pflanze. Sie schickt dich zum nächsten Schritt, bis du bei einem Namen ankommst. Passt der Name nicht, geh zurück und prüf noch mal."),
      widget: DiversityTreeKey,
    },
    {
      type: "widget",
      title: tx("Early bloomers: racing the leaves", "Frühblüher: Wettlauf mit dem Laub"),
      blob: tx("Slide through the year and watch the light on the floor!", "Schieb dich durch das Jahr und beobachte das Licht am Boden!"),
      body: tx("**Early bloomers** such as snowdrop, wood anemone, crocus, tulip and lesser celandine flower before the trees come into leaf. Only then does enough light reach the forest floor. They can start so early because they stored food (starch) in the soil last year.", "**Frühblüher** wie Schneeglöckchen, Buschwindröschen, Krokus, Tulpe und Scharbockskraut blühen, bevor die Bäume austreiben. Nur dann erreicht genug Licht den Waldboden. Sie können so früh starten, weil sie im Vorjahr Nährstoffe (Stärke) im Boden gespeichert haben."),
      widget: DiversitySeasons,
    },
    {
      type: "widget",
      title: tx("Storage organs", "Speicherorgane"),
      blob: tx("Dig a little: what's hidden in the soil?", "Grab ein bisschen: Was steckt im Boden?"),
      body: tx("**Bulb** (tulip, snowdrop): thick storage leaves on a very short stem. **Corm** (crocus): a solid, thickened stem. **Rhizome** (wood anemone): a stem lying sideways in the soil. **Root tubers** (lesser celandine): thickened roots.", "**Zwiebel** (Tulpe, Schneeglöckchen): dicke Speicherblätter an einer gestauchten Sprossachse. **Sprossknolle** (Krokus): eine feste, verdickte Sprossachse. **Erdspross** (Buschwindröschen): ein Spross, der waagerecht im Boden liegt. **Wurzelknollen** (Scharbockskraut): verdickte Wurzeln."),
      widget: DiversityBloomerExplorer,
    },
    { type: "check", blob: tx("The crocus has a little trick up its sleeve!", "Der Krokus hat einen kleinen Trick auf Lager!"), exercise: checkCrocus },
    { type: "check", blob: tx("Last one: where does the energy come from?", "Zum Schluss: Woher kommt die Energie?"), exercise: checkWhy },
  ],
  summary: [
    {
      title: tx("Broadleaf trees and conifers", "Laubbäume und Nadelbäume"),
      body: tx("Broadleaf trees have broad, flat leaves and are mostly bare in winter. Conifers have needles and are mostly evergreen.", "Laubbäume haben breite, flache Blätter und sind im Winter meist kahl. Nadelbäume haben Nadeln und sind meist immergrün."),
      examples: [tx('"Exception: the larch drops its needles"', '"Ausnahme: Die Lärche wirft ihre Nadeln ab"')],
      tone: "rule",
    },
    {
      title: tx("Describing leaves", "Blätter beschreiben"),
      body: tx("Shape, edge, simple or compound.", "Form, Rand, einfach oder zusammengesetzt."),
      examples: [
        tx('"lime: heart-shaped, saw-toothed"', '"Linde: herzförmig, gesägt"'),
        tx('"birch: diamond-shaped, double saw-toothed"', '"Birke: rautenförmig, doppelt gesägt"'),
        tx('"beech: oval, smooth" \\quad "oak: round lobes"', '"Buche: eiförmig, ganzrandig" \\quad "Eiche: runde Lappen"'),
        tx('"horse chestnut: palmate" \\quad "ash: pinnate"', '"Rosskastanie: gefingert" \\quad "Esche: gefiedert"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Telling conifers apart", "Nadelbäume unterscheiden"),
      examples: [
        tx('"spruce stings, fir is kind"', '"Die Fichte sticht, die Tanne nicht"'),
        tx('"pine: needles in pairs" \\quad "larch: tufts"', '"Kiefer: Nadeln zu zweit" \\quad "Lärche: Büschel"'),
        tx('"yew: no cones, red seed cups"', '"Eibe: keine Zapfen, rote Samenmäntel"'),
      ],
      tone: "tip",
    },
    {
      title: tx("Early bloomers and their stores", "Frühblüher und ihre Speicher"),
      body: tx("They flower before the trees come into leaf, using light on the forest floor and starch stored last year.", "Sie blühen, bevor die Bäume austreiben, und nutzen das Licht am Waldboden und die im Vorjahr gespeicherte Stärke."),
      examples: [
        tx('"tulip, snowdrop" \\to "bulb"', '"Tulpe, Schneeglöckchen" \\to "Zwiebel"'),
        tx('"crocus" \\to "corm" \\quad "wood anemone" \\to "rhizome"', '"Krokus" \\to "Sprossknolle" \\quad "Buschwindröschen" \\to "Erdspross"'),
        tx('"lesser celandine" \\to "root tubers"', '"Scharbockskraut" \\to "Wurzelknollen"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Using a key", "Mit dem Schlüssel bestimmen"),
      body: tx("At every step two descriptions, a and b. Pick the one that fits, follow the number, and check the name against your plant at the end.", "Bei jedem Schritt zwei Beschreibungen, a und b. Wähle die passende, folge der Nummer und vergleich am Ende den Namen mit deiner Pflanze."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("\"All conifers are evergreen\" (the larch isn't). A rhizome is a stem, not a root. The crocus has a corm, not a bulb. A lobed maple leaf is still simple.", "„Alle Nadelbäume sind immergrün“ (die Lärche nicht). Ein Erdspross ist ein Spross, keine Wurzel. Der Krokus hat eine Sprossknolle, keine Zwiebel. Ein gelapptes Ahornblatt ist trotzdem einfach."),
      tone: "warning",
    },
  ],
};
