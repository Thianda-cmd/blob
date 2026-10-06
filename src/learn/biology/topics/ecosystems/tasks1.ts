// Level 1 (Einsteiger) practice: ecosystem, food chains and webs, producers, consumers,
// decomposers, forest layers, what happens when a link drops out.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { EcoFoodWebPicture } from "@/learn/biology/visuals/EcoFoodWeb";
import { EcoForestLayers } from "@/learn/biology/visuals/EcoForestLayers";
import {
  CHAINS,
  DIET_FOOD,
  DIET_NAME,
  GRAM,
  HABITAT_NAME,
  LAYERS,
  LAYER_MEMBERS,
  ORDER_NAME,
  ORGS,
  ROLE_NAME,
  The,
  WEBS,
  amountOf,
  datPl,
  nameOf,
  plOf,
  vb,
  type Chain,
  type Diet,
  type Habitat,
  type LayerId,
  type OrgId,
  type Role,
} from "./data";
import { cap, capT, chainMath, chainText, choice, de, en, fixedChoice, join, listText, mistakes, pickN, q, visual } from "./kit";

const sp = (id: OrgId, sgEn: string, plEn: string, sgDe: string, plDe: string) => vb(id, sgEn, plEn, sgDe, plDe);
/** "The fox is" / "Der Fuchs ist" etc. built in both languages. */
const say2 = (en0: string, de0: string) => tx(en0, de0);

// ---------------------------------------------------------------------------
// Put a food chain in order

export function chainOrderTask(rng: Rng, chain: Chain = rng.pick(CHAINS)): Exercise {
  const names = chain.ids.map(nameOf);
  const p0 = chain.ids[0];
  const answer: AnswerSpec = { kind: "order", items: names, label: tx("From the start of the food chain to its end", "Vom Anfang der Nahrungskette bis zu ihrem Ende") };
  const list: Mistake[] = [
    {
      when: { kind: "order", items: [...names].reverse() },
      title: tx("Arrows the wrong way round", "Pfeile verkehrt herum"),
      say: tx("You started with the hunter. A food chain starts with the plant, and each arrow points to the one that eats it.", "Du hast beim Jäger angefangen. Eine Nahrungskette beginnt bei der Pflanze, und jeder Pfeil zeigt auf den, der frisst."),
    },
    {
      when: { kind: "order", items: [names[1], names[0]] },
      title: tx("The plant comes first", "Die Pflanze kommt zuerst"),
      say: say2(`${en(The(p0))} ${en(sp(p0, "is", "are", "", ""))} the producer: every food chain starts with a plant (or algae).`, `${de(The(p0))} ${de(sp(p0, "", "", "ist der Produzent", "sind die Produzenten"))}: Jede Nahrungskette beginnt mit einer Pflanze (oder mit Algen).`),
    },
  ];
  return {
    instruction: tx("Put the food chain in order", "Bring die Nahrungskette in die richtige Reihenfolge"),
    text: tx(`These living things from a ${en(HABITAT_NAME[chain.habitat])} form a food chain. Sort them: who is eaten by whom?`, `Diese Lebewesen aus dem Ökosystem ${de(HABITAT_NAME[chain.habitat])} bilden eine Nahrungskette. Sortiere sie: Wer wird von wem gefressen?`),
    answer,
    hint: tx("Start with the plant. The next one eats it, and so on.", "Fang mit der Pflanze an. Der Nächste frisst sie, und so weiter."),
    solution: [
      { math: q(names[0], "c0"), note: tx(`It starts with the producer: ${en(names[0])}.`, `Am Anfang steht der Produzent: ${de(names[0])}.`) },
      { math: chainMath(names), note: tx("Each arrow means \"is eaten by\". It points from the eaten to the eater.", "Jeder Pfeil bedeutet „wird gefressen von“. Er zeigt vom Gefressenen zum Fresser."), highlight: [`c${names.length - 1}`] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Producer, consumer or decomposer?

const ROLES: Role[] = ["producer", "consumer", "decomposer"];
const ROLE_OPTIONS = ROLES.map((r) => ROLE_NAME[r]);

/** Pick a role first (so the answers are spread), then an organism with that role. */
const pickByRole = (rng: Rng) => {
  const role = rng.pick(ROLES);
  return rng.pick((Object.keys(ORGS) as OrgId[]).filter((id) => ORGS[id].role === role));
};

export function roleTask(rng: Rng, id: OrgId = pickByRole(rng)): Exercise {
  const o = ORGS[id];
  const The0 = The(id);
  const right = ROLES.indexOf(o.role);
  const isFungus = id === "mould" || id === "mushroom";
  const wrong: { at: number; title: Text; say: Text }[] = [];
  if (o.role === "decomposer") {
    wrong.push({
      at: 1,
      title: tx("Decomposers are their own group", "Destruenten sind eine eigene Gruppe"),
      say:
        isFungus || id === "bacteria"
          ? tx(`${en(The0)} ${en(sp(id, "doesn't eat living things: it breaks", "don't eat living things: they break", "", ""))} down dead remains. That makes ${en(sp(id, "it a decomposer", "them decomposers", "", ""))}, not ${en(sp(id, "a consumer", "consumers", "", ""))}.`, `${de(The0)} ${de(sp(id, "", "", "frisst keine Lebewesen, sondern baut", "fressen keine Lebewesen, sondern bauen"))} tote Reste ab. Das sind Destruenten, keine Konsumenten.`)
          : tx("It's an animal, I know! But it feeds on dead leaves and remains and breaks them down: a decomposer.", "Es ist ein Tier, klar! Aber es ernährt sich von totem Laub und Resten und zersetzt sie: ein Destruent."),
    });
    wrong.push({
      at: 0,
      title: isFungus ? tx("Fungi are not plants", "Pilze sind keine Pflanzen") : tx("No photosynthesis", "Keine Fotosynthese"),
      say: isFungus
        ? tx("Fungi have no chlorophyll and can't do photosynthesis. They live on dead material: decomposers.", "Pilze haben kein Chlorophyll und können keine Fotosynthese betreiben. Sie leben von toten Resten: Destruenten.")
        : tx("Producers make their own food with light. This one feeds on dead remains.", "Produzenten stellen ihre Nährstoffe mit Licht selbst her. Dieses Lebewesen ernährt sich von toten Resten."),
    });
  } else if (o.role === "producer") {
    wrong.push({
      at: 1,
      title: tx("It makes its own food", "Es stellt Nahrung selbst her"),
      say: o.note ?? tx(`${en(The0)} ${en(sp(id, "is green and carries", "are green and carry", "", ""))} out photosynthesis: a producer.`, `${de(The0)} ${de(sp(id, "", "", "ist grün und betreibt", "sind grün und betreiben"))} Fotosynthese: ein Produzent.`),
    });
    wrong.push({
      at: 2,
      title: tx("It's alive and green", "Es lebt und ist grün"),
      say: tx("Decomposers break down dead remains. A living green plant makes its own food: a producer.", "Destruenten bauen tote Reste ab. Eine lebende grüne Pflanze stellt ihre Nährstoffe selbst her: ein Produzent."),
    });
  } else {
    wrong.push({
      at: 0,
      title: tx("Animals can't photosynthesise", "Tiere betreiben keine Fotosynthese"),
      say: tx(`${en(The0)} has to eat other living things to get food: a consumer.`, `${de(The0)} muss andere Lebewesen fressen, um an Nährstoffe zu kommen: ein Konsument.`),
    });
    wrong.push({
      at: 2,
      title: tx("It eats living things", "Es frisst Lebendes"),
      say: tx("Decomposers break down dead remains. This animal eats living plants or animals: a consumer.", "Destruenten bauen tote Reste ab. Dieses Tier frisst lebende Pflanzen oder Tiere: ein Konsument."),
    });
  }
  const { answer, mistakes: list } = fixedChoice(ROLE_OPTIONS, right, wrong);
  const why =
    o.note ??
    (o.role === "producer"
      ? tx(`${en(The0)} ${en(sp(id, "makes", "make", "", ""))} food by photosynthesis.`, `${de(The0)} ${de(sp(id, "", "", "stellt", "stellen"))} durch Fotosynthese selbst Nährstoffe her.`)
      : o.role === "consumer"
        ? tx(`${en(The0)} feeds on other living things.`, `${de(The0)} ernährt sich von anderen Lebewesen.`)
        : tx(`${en(The0)} ${en(sp(id, "breaks", "break", "", ""))} down dead remains.`, `${de(The0)} ${de(sp(id, "", "", "baut", "bauen"))} tote Reste ab.`));
  return {
    instruction: tx("Producer, consumer or decomposer?", "Produzent, Konsument oder Destruent?"),
    text: tx(`Which group ${en(sp(id, "does", "do", "", ""))} **${en(The0).replace(/^The /, "the ")}** belong to?`, `Zu welcher Gruppe ${de(sp(id, "", "", "gehört", "gehören"))} **${de(The0).replace(/^D/, "d")}**?`),
    answer,
    hint: tx("Producers make their own food with light. Consumers eat living things. Decomposers break down dead remains.", "Produzenten stellen mit Licht selbst Nährstoffe her. Konsumenten fressen Lebewesen. Destruenten bauen tote Reste ab."),
    solution: [
      { math: q(o.name, "n"), note: why },
      { math: join(q(o.name, "n"), "\\Rightarrow#r", q(ROLE_NAME[o.role], "g")), note: tx(`So: **${en(ROLE_NAME[o.role]).toLowerCase()}**.`, `Also: **${de(ROLE_NAME[o.role])}**.`), highlight: ["g"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Which consumer order?

export function consumerOrderTask(rng: Rng, chain: Chain = rng.pick(CHAINS), pos?: number): Exercise {
  const names = chain.ids.map(nameOf);
  const at = pos ?? rng.int(1, names.length - 1);
  const id = chain.ids[at];
  const p0 = chain.ids[0];
  const first = at >= 4 ? 1 : 0;
  const optIdx = [first, first + 1, first + 2, first + 3];
  const options = optIdx.map((i) => capT(ORDER_NAME[i]));
  const correct = optIdx.indexOf(at);
  const animals = listText(names.slice(1, at + 1));
  const wrong: { at: number; title: Text; say: Text }[] = [];
  if (optIdx.includes(at + 1))
    wrong.push({
      at: optIdx.indexOf(at + 1),
      title: tx("The plant doesn't count", "Die Pflanze zählt nicht mit"),
      say: tx("Did you count the plant as well? The plant is the producer. The first animal is the consumer of the 1st order.", "Hast du die Pflanze mitgezählt? Die Pflanze ist der Produzent. Erst das erste Tier ist Konsument 1. Ordnung."),
    });
  if (optIdx.includes(at - 1) && at - 1 >= 1)
    wrong.push({
      at: optIdx.indexOf(at - 1),
      title: tx("Count every step", "Zähl jeden Schritt"),
      say: tx(`Count the animals from the plant on: ${en(animals)}.`, `Zähl die Tiere ab der Pflanze: ${de(animals)}.`),
    });
  if (optIdx.includes(0))
    wrong.push({
      at: optIdx.indexOf(0),
      title: tx("Only plants are producers", "Nur Pflanzen sind Produzenten"),
      say: tx("Producers make their own food. An animal always eats others: a consumer.", "Produzenten stellen ihre Nährstoffe selbst her. Ein Tier frisst immer andere: ein Konsument."),
    });
  const list: Mistake[] = wrong.map((w) => ({ when: { kind: "choice", options, correct: w.at }, title: w.title, say: w.say }));
  return {
    instruction: tx("Producer or which consumer?", "Produzent oder Konsument welcher Ordnung?"),
    text: tx(`Food chain: **${en(chainText(names))}**. What is ${en(The(id)).replace(/^The /, "the ")} in this chain?`, `Nahrungskette: **${de(chainText(names))}**. Was ist ${de(The(id)).replace(/^D/, "d")} in dieser Kette?`),
    answer: { kind: "choice", options, correct },
    hint: tx("The plant is the producer. The animal that eats it is the consumer of the 1st order, and so on.", "Die Pflanze ist der Produzent. Das Tier, das sie frisst, ist Konsument 1. Ordnung, und so weiter."),
    solution: [
      {
        math: chainMath(names),
        note: tx(`${en(The(p0))} ${en(vb(p0, "is the producer", "are the producers", "", ""))}. Now count the animals.`, `${de(The(p0))} ${de(vb(p0, "", "", "ist der Produzent", "sind die Produzenten"))}. Jetzt zähl die Tiere.`),
        highlight: ["c0"],
      },
      { math: join(q(names[at], "x"), "\\Rightarrow#r", q(ORDER_NAME[at], "o")), note: tx(`It is animal number ${at} in the chain: **${en(ORDER_NAME[at])}**.`, `Es ist das ${at}. Tier in der Kette: **${de(ORDER_NAME[at])}**.`), highlight: ["o"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Herbivore, carnivore or omnivore?

const DIETS: Diet[] = ["herbivore", "carnivore", "omnivore"];
const DIET_IDS = (Object.keys(ORGS) as OrgId[]).filter((id) => ORGS[id].diet && DIET_FOOD[id]);

export function dietTask(rng: Rng): Exercise {
  const want = rng.pick(DIETS);
  const id = rng.pick(DIET_IDS.filter((x) => ORGS[x].diet === want));
  const diet = ORGS[id].diet!;
  const food = DIET_FOOD[id]!;
  const T0 = The(id);
  const eats = tx(`${en(T0)} eats ${en(food)}.`, `${de(T0)} frisst ${de(food)}.`);
  const options = DIETS.map((d) => DIET_NAME[d]);
  const wrong: { at: number; title: Text; say: Text }[] = [];
  if (diet === "omnivore") {
    const both = tx(`${en(T0)} eats ${en(food)}: plants and animals. That's an omnivore.`, `${de(T0)} frisst ${de(food)}: Pflanzen und Tiere. Das ist ein Allesfresser.`);
    wrong.push({ at: 0, title: tx("Not only plants", "Nicht nur Pflanzen"), say: both });
    wrong.push({ at: 1, title: tx("Not only animals", "Nicht nur Tiere"), say: both });
  } else {
    wrong.push({ at: diet === "herbivore" ? 1 : 0, title: tx("What does it eat?", "Was frisst es?"), say: eats });
    wrong.push({ at: 2, title: tx("Only one kind of food", "Nur eine Sorte Nahrung"), say: tx(`An omnivore eats plants and animals. ${en(eats)}`, `Ein Allesfresser frisst Pflanzen und Tiere. ${de(eats)}`) });
  }
  const { answer, mistakes: list } = fixedChoice(options, DIETS.indexOf(diet), wrong);
  return {
    instruction: tx("Herbivore, carnivore or omnivore?", "Pflanzenfresser, Fleischfresser oder Allesfresser?"),
    text: tx(`What kind of eater is ${en(T0).replace(/^The /, "the ")}?`, `Was für ein Fresser ist ${de(T0).replace(/^D/, "d")}?`),
    answer,
    hint: tx("Think about what it eats: only plants, only animals, or both?", "Überleg, was es frisst: nur Pflanzen, nur Tiere oder beides?"),
    solution: [
      { math: join(q(ORGS[id].name, "n"), "\\to", q(food, "f")), note: eats },
      { math: join(q(ORGS[id].name, "n"), "\\Rightarrow#r", q(DIET_NAME[diet], "d")), note: tx(`So it's a **${en(DIET_NAME[diet]).toLowerCase()}**.`, `Also ein **${de(DIET_NAME[diet])}**.`), highlight: ["d"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Biotope or biocoenosis?

const NONLIVING: Text[] = [
  tx("the light on the forest floor", "das Licht am Waldboden"),
  tx("the temperature of the water", "die Temperatur des Wassers"),
  tx("the rain", "der Regen"),
  tx("the type of soil", "die Bodenart"),
  tx("the wind", "der Wind"),
  tx("the oxygen in the lake water", "der Sauerstoff im Seewasser"),
  tx("the stones on the bank", "die Steine am Ufer"),
  tx("the minerals in the soil", "die Mineralstoffe im Boden"),
  tx("frost in winter", "der Frost im Winter"),
];
const LIVING: Text[] = [
  tx("the beech trees", "die Buchen"),
  tx("the earthworms in the soil", "die Regenwürmer im Boden"),
  tx("the algae in the lake", "die Algen im See"),
  tx("the bacteria in the soil", "die Bakterien im Boden"),
  tx("the mushrooms", "die Pilze"),
  tx("the roe deer", "die Rehe"),
  tx("the mosses", "die Moose"),
  tx("the water fleas", "die Wasserflöhe"),
];
const BB: Text[] = [tx("Biotope (habitat)", "Biotop (Lebensraum)"), tx("Biocoenosis (community)", "Biozönose (Lebensgemeinschaft)")];

export function biotopeTask(rng: Rng): Exercise {
  const living = rng.chance(0.5);
  const item = rng.pick(living ? LIVING : NONLIVING);
  const tiny = living && /bacteria|algae|water fleas/.test(en(item));
  const { answer, mistakes: list } = fixedChoice(BB, living ? 1 : 0, [
    living
      ? {
          at: 0,
          title: tx("It's alive", "Es lebt"),
          say: tiny
            ? tx("Even tiny living things are part of the community. The biotope is only the non-living habitat.", "Auch winzige Lebewesen gehören zur Lebensgemeinschaft. Der Biotop ist nur der unbelebte Lebensraum.")
            : tx("All living things together form the biocoenosis. The biotope is the non-living habitat.", "Alle Lebewesen zusammen bilden die Biozönose. Der Biotop ist der unbelebte Lebensraum."),
        }
      : { at: 1, title: tx("Not alive", "Nicht lebendig"), say: tx("That isn't a living thing. It belongs to the habitat with its non-living conditions: the biotope.", "Das ist kein Lebewesen. Es gehört zum Lebensraum mit seinen unbelebten Bedingungen: dem Biotop.") },
  ]);
  return {
    instruction: tx("Biotope or biocoenosis?", "Biotop oder Biozönose?"),
    text: tx(`**${cap(en(item))}**: part of the biotope or of the biocoenosis?`, `**${cap(de(item))}**: Teil des Biotops oder der Biozönose?`),
    answer,
    hint: tx("Biotope: the habitat with its non-living conditions. Biocoenosis: all the living things there.", "Biotop: der Lebensraum mit seinen unbelebten Bedingungen. Biozönose: alle Lebewesen dort."),
    solution: [
      { math: tx('"ecosystem" = "biotope" + "biocoenosis"', '"Ökosystem" = "Biotop" + "Biozönose"'), note: tx("An ecosystem consists of the habitat and the community of living things.", "Ein Ökosystem besteht aus dem Lebensraum und der Lebensgemeinschaft.") },
      { math: join(q(capT(item), "i"), "\\Rightarrow#r", q(BB[living ? 1 : 0], "b")), note: living ? tx("Alive: **biocoenosis**.", "Lebendig: **Biozönose**.") : tx("Not alive: part of the **biotope**.", "Nicht lebendig: Teil des **Biotops**."), highlight: ["b"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Forest layers

const LAYER_NAME = (id: LayerId) => LAYERS.find((l) => l.id === id)!.name;
const LAYER_ACCEPT: Record<LayerId, Text[]> = {
  tree: [tx("tree layer", "Baumschicht")],
  shrub: [tx("shrub layer", "Strauchschicht")],
  herb: [tx("herb layer", "Krautschicht")],
  moss: [tx("moss layer", "Moosschicht")],
  root: [tx("root layer", "Wurzelschicht"), tx("soil layer", "Bodenschicht")],
};

export function layerWhereTask(rng: Rng, member = rng.pick(LAYER_MEMBERS)): Exercise {
  const right = member.layer;
  const others = rng.shuffle(LAYERS.map((l) => l.id).filter((l) => l !== right)).slice(0, 3);
  const L = LAYERS.find((l) => l.id === right)!;
  const say = (w: LayerId): Text => {
    if (right === "herb" && w === "moss") return tx("Close, but it grows taller than mosses: up to about knee height. That's the herb layer.", "Knapp daneben, es wird höher als Moose: etwa bis Kniehöhe. Das ist die Krautschicht.");
    if (right === "shrub" && w === "herb") return tx("It forms woody stems and gets taller than a person: that's the shrub layer.", "Es bildet verholzte Stämmchen und wird größer als ein Mensch: Das ist die Strauchschicht.");
    if (right === "shrub" && w === "tree") return tx("It stays much lower than the big trees: shrub layer, about 1 to 5 m.", "Es bleibt viel niedriger als die großen Bäume: Strauchschicht, etwa 1 bis 5 m.");
    if (right === "tree") return tx("Look up: the crowns of the big trees form the top layer, the tree layer.", "Schau nach oben: Die Kronen der großen Bäume bilden das oberste Stockwerk, die Baumschicht.");
    if (right === "root") return tx("It lives in the soil, below the surface: root layer.", "Es lebt im Boden, unter der Oberfläche: Wurzelschicht.");
    if (right === "moss") return tx("Right on the ground, among moss and leaf litter: moss layer.", "Direkt am Boden zwischen Moos und Laubstreu: Moosschicht.");
    return tx(`Think about the height. ${cap(en(L.name))}: ${en(L.height)}.`, `Überleg, wie hoch. ${de(L.name)}: ${de(L.height)}.`);
  };
  const { answer, mistakes: list } = choice(rng, [{ text: capT(LAYER_NAME(right)) }, ...others.map((w) => ({ text: capT(LAYER_NAME(w)), title: tx("Another layer", "Ein anderes Stockwerk"), say: say(w) }))]);
  const verbEn = member.plant ? "grow" : "live";
  const verbDe = member.plant ? (member.plural ? "wachsen" : "wächst") : member.plural ? "leben" : "lebt";
  return {
    instruction: tx("Find the forest layer", "Finde das Stockwerk"),
    text: tx(`In which layer of the forest ${member.plural ? "do" : "does"} **${en(member.nom)}** ${verbEn}?`, `In welchem Stockwerk des Waldes ${verbDe} **${de(member.nom)}**?`),
    visual: visual(EcoForestLayers, { mode: "plain" as const }),
    answer,
    hint: tx("Think about the height: tree layer, shrub layer, herb layer, moss layer or in the soil?", "Überleg, wie hoch: Baumschicht, Strauchschicht, Krautschicht, Moosschicht oder im Boden?"),
    solution: [
      { math: join(q(capT(member.name), "m"), "\\to", q(capT(L.name), "l")), note: tx(`${cap(en(L.name))}: ${en(L.height)}. Typical: ${en(L.plants)}; ${en(L.animals)}.`, `${de(L.name)}: ${de(L.height)}. Typisch: ${de(L.plants)}; ${de(L.animals)}.`), highlight: ["l"] },
    ],
    mistakes: list,
  };
}

export function layerNameTask(rng: Rng): Exercise {
  const L = rng.pick(LAYERS);
  const idx = (id: LayerId) => LAYERS.findIndex((l) => l.id === id);
  const answer: AnswerSpec = { kind: "word", accept: LAYER_ACCEPT[L.id], placeholder: tx("layer", "Stockwerk") };
  const m = mistakes(answer);
  const neighbours: Record<LayerId, LayerId[]> = { tree: ["shrub"], shrub: ["tree", "herb"], herb: ["shrub", "moss"], moss: ["herb", "root"], root: ["moss"] };
  for (const n of neighbours[L.id]) {
    const above = idx(n) < idx(L.id);
    m.add({ kind: "word", accept: LAYER_ACCEPT[n] }, tx("One layer off", "Ein Stockwerk daneben"), tx(`That's the layer ${above ? "above" : "below"}. Look at what grows at the marked height.`, `Das ist das Stockwerk ${above ? "darüber" : "darunter"}. Schau, was in der markierten Höhe wächst.`), true);
  }
  return {
    instruction: tx("Name the forest layer", "Benenne das Stockwerk"),
    text: tx("What is the layer of the forest marked with **?** called?", "Wie heißt das Stockwerk des Waldes, das mit **?** markiert ist?"),
    visual: visual(EcoForestLayers, { mode: "numbers" as const, show: [L.id], ask: L.id, legend: "none" as const }),
    answer,
    hint: tx(`Typical here: ${en(L.plants)}.`, `Typisch hier: ${de(L.plants)}.`),
    solution: [{ math: q(capT(L.name), "l"), note: tx(`${cap(en(L.name))}: ${en(L.height)}. Typical: ${en(L.plants)}.`, `${de(L.name)}: ${de(L.height)}. Typisch: ${de(L.plants)}.`), highlight: ["l"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// One link drops out

const MORE_LESS: Text[] = [tx("It increases", "Sie nimmt zu"), tx("It decreases", "Sie nimmt ab"), tx("It stays the same", "Sie bleibt gleich")];

export function dropoutTask(rng: Rng, fixed?: { chain: Chain; gone: number; ask: number }): Exercise {
  const chain = fixed?.chain ?? rng.pick(CHAINS);
  const ids = chain.ids;
  const names = ids.map(nameOf);
  const options: [number, number][] = [];
  for (let gone = 1; gone < ids.length; gone++) {
    options.push([gone, gone - 1]);
    if (gone + 1 < ids.length) options.push([gone, gone + 1]);
    if (gone - 2 >= 0) options.push([gone, gone - 2]);
  }
  const [gone, ask] = fixed ? [fixed.gone, fixed.ask] : rng.pick(options);
  const G = ids[gone];
  const A = ids[ask];
  const effect = ask === gone - 1 ? 0 : 1;
  const amount = amountOf(A);
  const Amount = tx(cap(en(amount)), cap(de(amount)));
  const why =
    ask === gone - 1
      ? tx(`The ${en(plOf(G))} fed on ${en(plOf(A))}. Without them, less is eaten: ${en(amount)} increases.`, `Die ${de(plOf(G))} haben ${de(plOf(A))} gefressen. Ohne sie wird weniger davon gefressen: ${de(Amount)} nimmt zu.`)
      : ask === gone + 1
        ? tx(`The ${en(plOf(A))} fed on ${en(plOf(G))}. Now this food is missing: ${en(amount)} decreases (unless they find other food).`, `Die ${de(plOf(A))} haben ${de(plOf(G))} gefressen. Jetzt fehlt diese Nahrung: ${de(Amount)} nimmt ab (wenn sie keine andere Nahrung finden).`)
        : tx(`Without ${en(plOf(G))} there are more ${en(plOf(ids[gone - 1]))}, and they eat more ${en(plOf(A))}: ${en(amount)} decreases.`, `Ohne ${de(plOf(G))} gibt es mehr ${de(plOf(ids[gone - 1]))}, und die fressen mehr ${de(plOf(A))}: ${de(Amount)} nimmt ab.`);
  const wrong =
    effect === 0
      ? [
          { at: 1, title: tx("A predator is missing", "Ein Fressfeind fehlt"), say: tx(`The ${en(plOf(G))} were eating them, they weren't their food. Fewer eaters means more survive.`, `Die ${de(plOf(G))} haben sie gefressen, sie waren nicht ihre Nahrung. Weniger Fresser heißt: Mehr überleben.`) },
          { at: 2, title: tx("Everything is linked", "Alles hängt zusammen"), say: tx("In a food chain every link affects the next one. If an eater disappears, its food changes too.", "In einer Nahrungskette wirkt jedes Glied auf das nächste. Verschwindet ein Fresser, verändert sich auch seine Nahrung.") },
        ]
      : [
          {
            at: 0,
            title: ask === gone + 1 ? tx("Its food is gone", "Seine Nahrung fehlt") : tx("Two steps", "Zwei Schritte"),
            say:
              ask === gone + 1
                ? tx(`The ${en(plOf(G))} were food for the ${en(plOf(A))}. Less food means fewer animals.`, `Die ${de(plOf(G))} waren Nahrung für die ${de(plOf(A))}. Weniger Nahrung heißt: weniger Tiere.`)
                : tx(`Go step by step: first the ${en(plOf(ids[gone - 1]))} increase. What do they eat?`, `Geh Schritt für Schritt vor: Zuerst nehmen die ${de(plOf(ids[gone - 1]))} zu. Was fressen die?`),
          },
          { at: 2, title: tx("Everything is linked", "Alles hängt zusammen"), say: tx("In a food chain every link affects the others. Go step by step from the missing link.", "In einer Nahrungskette wirkt jedes Glied auf die anderen. Geh Schritt für Schritt vom fehlenden Glied aus.") },
        ];
  const { answer, mistakes: list } = fixedChoice(MORE_LESS, effect, wrong);
  const goneNames = names.map((n, i) => (i === gone ? tx(`${en(n)} (gone)`, `${de(n)} (fehlt)`) : n));
  return {
    instruction: tx("What happens first?", "Was passiert zuerst?"),
    text: tx(
      `Food chain: **${en(chainText(names))}**. Suddenly all the ${en(plOf(G))} disappear. What happens first to ${en(amount)}?`,
      `Nahrungskette: **${de(chainText(names))}**. Plötzlich verschwinden alle ${de(plOf(G))}. Was passiert zuerst mit ${GRAM[A].mass ? `der Menge an ${GRAM[A].pl}` : `der Zahl der ${GRAM[A].pl}`}?`,
    ),
    answer,
    hint: tx("Does it lose its food, or does it lose an eater?", "Verliert es seine Nahrung, oder verliert es einen Fresser?"),
    solution: [
      { math: chainMath(goneNames), note: tx(`The ${en(plOf(G))} drop out.`, `Die ${de(plOf(G))} fallen aus.`), highlight: [`c${gone}`] },
      { math: join(q(names[ask], "a"), effect === 0 ? '"↑"#u' : '"↓"#u'), note: why, highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Food web picture: who feeds on …?

export function webEatersTask(rng: Rng): Exercise | null {
  const habitat: Habitat = rng.pick(["meadow", "forest", "lake"] as Habitat[]);
  const web = WEBS[habitat];
  const candidates = web.nodes.map((n) => n.id).filter((id) => web.core.some(([a]) => a === id));
  const target = rng.pick(candidates);
  const eaters = web.core.filter(([a]) => a === target).map(([, b]) => b);
  const food = web.core.filter(([, b]) => b === target).map(([a]) => a);
  const others = web.nodes.map((n) => n.id).filter((id) => id !== target && !eaters.includes(id) && !food.includes(id));
  const pool = rng.shuffle([...eaters, ...food, ...pickN(rng, others, Math.max(1, 5 - eaters.length - food.length))]);
  const options = pool.map(nameOf);
  const correct = pool.map((id, i) => (eaters.includes(id) ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const foodIdx = pool.map((id, i) => (food.includes(id) ? i : -1)).filter((i) => i >= 0);
  if (foodIdx.length) {
    m.add(
      { kind: "multi", options, correct: foodIdx },
      tx("Arrows the wrong way round", "Pfeile verkehrt herum"),
      tx(`You picked what the ${en(plOf(target))} eat. The arrows point to the eater: look where the arrows from the ${en(plOf(target))} go.`, `Du hast gewählt, was die ${de(plOf(target))} fressen. Die Pfeile zeigen zum Fresser: Schau, wohin die Pfeile von dort führen.`),
    );
    m.add(
      { kind: "multi", options, correct: [...correct, ...foodIdx].sort((a, b) => a - b) },
      tx("Only one direction", "Nur eine Richtung"),
      tx("You picked every neighbour. Only the arrows that start there and point away count: those lead to its eaters.", "Du hast alle Nachbarn gewählt. Es zählen nur die Pfeile, die dort starten und wegzeigen: Die führen zu den Fressern."),
    );
  }
  if (correct.length > 1)
    for (const c of correct) m.add({ kind: "multi", options, correct: correct.filter((x) => x !== c) }, tx("One is missing", "Einer fehlt"), tx("Almost! Follow every arrow that starts there.", "Fast! Folge jedem Pfeil, der dort startet."), true);
  return {
    instruction: tx("Read the food web", "Lies das Nahrungsnetz"),
    text: tx(`Food web of a ${en(HABITAT_NAME[habitat])}. Who feeds on **${en(datPl(target))}**? Select all.`, `Nahrungsnetz: ${de(HABITAT_NAME[habitat])}. Wer ernährt sich von **${de(datPl(target))}**? Wähle alle aus.`),
    visual: visual(EcoFoodWebPicture, { habitat, highlight: [target] }),
    answer,
    hint: tx("An arrow points from the eaten to the eater. Follow the arrows that start at the marked one.", "Ein Pfeil zeigt vom Gefressenen zum Fresser. Folge den Pfeilen, die beim markierten Lebewesen starten."),
    solution: [
      {
        math: join(q(nameOf(target), "t"), "\\to", q(listText(eaters.map(nameOf)), "e")),
        note: tx(`The arrows starting there lead to: ${en(listText(eaters.map(nameOf)))}.`, `Die Pfeile, die dort starten, führen zu: ${de(listText(eaters.map(nameOf)))}.`),
        highlight: ["e"],
      },
    ],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------
// Terms

type Term = { term: Text; def: Text; accept: Text[] };
export const TERMS: Term[] = [
  { term: tx("producers", "Produzenten"), def: tx("make their own food by photosynthesis", "stellen durch Fotosynthese selbst Nährstoffe her"), accept: [tx("producers", "Produzenten"), tx("producer", "Produzent"), "Erzeuger"] },
  { term: tx("consumers", "Konsumenten"), def: tx("feed on other living things", "ernähren sich von anderen Lebewesen"), accept: [tx("consumers", "Konsumenten"), tx("consumer", "Konsument"), "Verbraucher"] },
  { term: tx("decomposers", "Destruenten"), def: tx("break down dead remains into minerals", "bauen tote Reste zu Mineralstoffen ab"), accept: [tx("decomposers", "Destruenten"), tx("decomposer", "Destruent"), "Zersetzer"] },
  { term: tx("biotope", "Biotop"), def: tx("the habitat with its non-living conditions", "der Lebensraum mit seinen unbelebten Bedingungen"), accept: [tx("biotope", "Biotop"), tx("habitat", "Lebensraum")] },
  { term: tx("biocoenosis", "Biozönose"), def: tx("all the living things in a habitat together", "alle Lebewesen eines Lebensraums zusammen"), accept: [tx("biocoenosis", "Biozönose"), tx("community", "Lebensgemeinschaft")] },
  { term: tx("ecosystem", "Ökosystem"), def: tx("habitat and community together", "Lebensraum und Lebensgemeinschaft zusammen"), accept: [tx("ecosystem", "Ökosystem")] },
  { term: tx("food chain", "Nahrungskette"), def: tx("a row of living things, each eaten by the next", "eine Reihe von Lebewesen, von denen jedes vom nächsten gefressen wird"), accept: [tx("food chain", "Nahrungskette")] },
  { term: tx("food web", "Nahrungsnetz"), def: tx("many food chains linked together", "viele miteinander verknüpfte Nahrungsketten"), accept: [tx("food web", "Nahrungsnetz")] },
];
const termOf = (k: string) => TERMS.find((t) => en(t.term) === k)!;

export function termMatchTask(rng: Rng): Exercise {
  const picked = pickN(rng, TERMS, 4);
  const pairs = picked.map((t) => [capT(t.term), t.def] as [Text, Text]);
  const has = (k: string) => picked.some((t) => en(t.term) === k);
  const list: Mistake[] = [];
  const add = (a: string, b: string, title: Text, say: Text) => {
    if (has(a) && has(b)) list.push({ when: { kind: "match", pairs: [[capT(termOf(a).term), termOf(b).def]] }, title, say });
  };
  add("producers", "consumers", tx("Producers make, consumers use", "Produzenten erzeugen, Konsumenten verbrauchen"), tx("Producers PRODUCE food themselves. Consumers CONSUME: they eat others.", "Produzenten ERZEUGEN Nahrung selbst. Konsumenten VERBRAUCHEN: Sie fressen andere."));
  add("decomposers", "consumers", tx("Decomposers use dead material", "Destruenten nutzen Totes"), tx("Decomposers don't eat living things: they break down dead remains.", "Destruenten fressen keine Lebewesen: Sie bauen tote Reste ab."));
  add("biotope", "biocoenosis", tx("Biotope = place", "Biotop = Ort"), tx("Biotope comes from the Greek words for life and place: the habitat. The living things are the biocoenosis.", "Biotop kommt von den griechischen Wörtern für Leben und Ort: der Lebensraum. Die Lebewesen sind die Biozönose."));
  add("food chain", "food web", tx("Chain or web?", "Kette oder Netz?"), tx("A chain is one row. Many linked chains make a web.", "Eine Kette ist eine Reihe. Viele verknüpfte Ketten ergeben ein Netz."));
  return {
    instruction: tx("Match the terms", "Ordne die Begriffe zu"),
    text: tx("Match each term with its meaning.", "Ordne jedem Begriff seine Bedeutung zu."),
    answer: { kind: "match", pairs },
    hint: tx("Producers produce, consumers consume, decomposers break down.", "Produzenten erzeugen, Konsumenten verbrauchen, Destruenten zersetzen."),
    solution: pairs.map((p, i) => ({ math: join(q(p[0], `t${i}`), "\\to", q(p[1], `d${i}`)), note: tx(`${en(p[0])}: ${en(p[1])}.`, `${de(p[0])}: ${de(p[1])}.`) })),
    mistakes: list,
  };
}

export function termWordTask(rng: Rng): Exercise {
  const t = rng.pick(TERMS);
  const answer: AnswerSpec = { kind: "word", accept: t.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  const confuse: Record<string, string> = { producers: "consumers", consumers: "decomposers", decomposers: "consumers", biotope: "biocoenosis", biocoenosis: "biotope", ecosystem: "biotope", "food chain": "food web", "food web": "food chain" };
  const other = termOf(confuse[en(t.term)]);
  m.add({ kind: "word", accept: other.accept }, tx("A neighbouring term", "Ein Nachbarbegriff"), tx(`${cap(en(other.term))}: ${en(other.def)}. Read the description again.`, `${de(other.term)}: ${de(other.def)}. Lies die Beschreibung noch mal.`));
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: tx(`What is the term? **${cap(en(t.def))}**.`, `Wie heißt der Fachbegriff? **${cap(de(t.def))}**.`),
    answer,
    hint: tx(`It starts with "${en(t.term).charAt(0).toUpperCase()}".`, `Er beginnt mit „${de(t.term).charAt(0)}“.`),
    solution: [{ math: join(q(capT(t.def), "d"), "\\Rightarrow#r", q(capT(t.term), "t")), note: tx(`That's the definition of **${en(t.term)}**.`, `Das ist die Definition von **${de(t.term)}**.`), highlight: ["t"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------

export function generate1(rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const k = rng.int(0, 10);
    const ex =
      k === 0 ? chainOrderTask(rng)
      : k === 1 ? roleTask(rng)
      : k === 2 ? consumerOrderTask(rng)
      : k === 3 ? dietTask(rng)
      : k === 4 ? biotopeTask(rng)
      : k === 5 ? layerWhereTask(rng)
      : k === 6 ? layerNameTask(rng)
      : k === 7 ? dropoutTask(rng)
      : k === 8 ? webEatersTask(rng)
      : k === 9 ? termMatchTask(rng)
      : termWordTask(rng);
    if (ex) return ex;
  }
  return chainOrderTask(rng);
}
