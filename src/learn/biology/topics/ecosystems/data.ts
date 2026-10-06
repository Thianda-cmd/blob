// Curated ecology facts for the ecosystems topic: organisms of German habitats (forest,
// meadow, lake) with their role and diet, food chains and food webs that a biology teacher
// would accept, and the forest layers.

import { tx, type Text } from "@/i18n/text";

export type Habitat = "forest" | "meadow" | "lake";
export type Role = "producer" | "consumer" | "decomposer";
export type Diet = "herbivore" | "carnivore" | "omnivore";

export type Org = {
  name: Text;
  role: Role;
  /** Only set where the diet is clear-cut (used for "herbivore, carnivore or omnivore?"). */
  diet?: Diet;
  /** Why it is a producer/decomposer when that is surprising (used by Blob). */
  note?: Text;
};

const ORG_LIST = {
  // producers
  grass: { name: tx("grass", "Gras"), role: "producer" },
  herbs: { name: tx("herbs", "Kräuter"), role: "producer" },
  clover: { name: tx("clover", "Klee"), role: "producer" },
  dandelion: { name: tx("dandelion", "Löwenzahn"), role: "producer" },
  oak: { name: tx("oak", "Eiche"), role: "producer" },
  beech: { name: tx("beech", "Buche"), role: "producer" },
  spruce: { name: tx("spruce", "Fichte"), role: "producer" },
  bramble: { name: tx("bramble", "Brombeere"), role: "producer" },
  algae: { name: tx("algae", "Algen"), role: "producer", note: tx("Algae have chlorophyll and carry out photosynthesis, even the tiny ones floating in the water.", "Algen haben Chlorophyll und betreiben Fotosynthese, auch die winzigen, die im Wasser schweben.") },
  waterplants: { name: tx("water plants", "Wasserpflanzen"), role: "producer" },
  moss: { name: tx("moss", "Moos"), role: "producer", note: tx("Moss has no flowers, but it is green: it makes its own food by photosynthesis.", "Moos hat keine Blüten, aber es ist grün: Es stellt seine Nährstoffe durch Fotosynthese selbst her.") },
  fern: { name: tx("fern", "Farn"), role: "producer" },
  anemone: { name: tx("wood anemone", "Buschwindröschen"), role: "producer" },
  waterlily: { name: tx("water lily", "Seerose"), role: "producer" },
  // herbivores
  roe: { name: tx("roe deer", "Reh"), role: "consumer", diet: "herbivore" },
  hare: { name: tx("brown hare", "Feldhase"), role: "consumer", diet: "herbivore" },
  vole: { name: tx("common vole", "Feldmaus"), role: "consumer", diet: "herbivore" },
  bankvole: { name: tx("bank vole", "Rötelmaus"), role: "consumer" },
  grasshopper: { name: tx("grasshopper", "Heuschrecke"), role: "consumer", diet: "herbivore" },
  caterpillar: { name: tx("caterpillar", "Raupe"), role: "consumer", diet: "herbivore" },
  aphid: { name: tx("aphid", "Blattlaus"), role: "consumer", diet: "herbivore" },
  daphnia: { name: tx("water flea", "Wasserfloh"), role: "consumer", diet: "herbivore" },
  snail: { name: tx("pond snail", "Schlammschnecke"), role: "consumer" },
  reddeer: { name: tx("red deer", "Rothirsch"), role: "consumer", diet: "herbivore" },
  mosquito: { name: tx("mosquito larva", "Mückenlarve"), role: "consumer" },
  squirrel: { name: tx("red squirrel", "Eichhörnchen"), role: "consumer" },
  // carnivores
  fox: { name: tx("fox", "Fuchs"), role: "consumer" },
  buzzard: { name: tx("common buzzard", "Mäusebussard"), role: "consumer", diet: "carnivore" },
  kestrel: { name: tx("kestrel", "Turmfalke"), role: "consumer", diet: "carnivore" },
  sparrowhawk: { name: tx("sparrowhawk", "Sperber"), role: "consumer", diet: "carnivore" },
  goshawk: { name: tx("goshawk", "Habicht"), role: "consumer", diet: "carnivore" },
  owl: { name: tx("tawny owl", "Waldkauz"), role: "consumer", diet: "carnivore" },
  marten: { name: tx("pine marten", "Baummarder"), role: "consumer" },
  lynx: { name: tx("lynx", "Luchs"), role: "consumer", diet: "carnivore" },
  wolf: { name: tx("wolf", "Wolf"), role: "consumer", diet: "carnivore" },
  greattit: { name: tx("great tit", "Kohlmeise"), role: "consumer" },
  frog: { name: tx("common frog", "Grasfrosch"), role: "consumer", diet: "carnivore" },
  stork: { name: tx("white stork", "Weißstorch"), role: "consumer", diet: "carnivore" },
  heron: { name: tx("grey heron", "Graureiher"), role: "consumer", diet: "carnivore" },
  pike: { name: tx("pike", "Hecht"), role: "consumer", diet: "carnivore" },
  perch: { name: tx("perch", "Barsch"), role: "consumer", diet: "carnivore" },
  roach: { name: tx("roach", "Rotauge"), role: "consumer" },
  stickleback: { name: tx("stickleback", "Stichling"), role: "consumer", diet: "carnivore" },
  kingfisher: { name: tx("kingfisher", "Eisvogel"), role: "consumer", diet: "carnivore" },
  osprey: { name: tx("osprey", "Fischadler"), role: "consumer", diet: "carnivore" },
  cormorant: { name: tx("cormorant", "Kormoran"), role: "consumer", diet: "carnivore" },
  dragonfly: { name: tx("dragonfly larva", "Libellenlarve"), role: "consumer", diet: "carnivore" },
  ladybird: { name: tx("ladybird", "Marienkäfer"), role: "consumer", diet: "carnivore" },
  spider: { name: tx("garden spider", "Kreuzspinne"), role: "consumer", diet: "carnivore" },
  shrike: { name: tx("red-backed shrike", "Neuntöter"), role: "consumer", diet: "carnivore" },
  lark: { name: tx("skylark", "Feldlerche"), role: "consumer" },
  // omnivores
  boar: { name: tx("wild boar", "Wildschwein"), role: "consumer", diet: "omnivore" },
  badger: { name: tx("badger", "Dachs"), role: "consumer", diet: "omnivore" },
  human: { name: tx("human", "Mensch"), role: "consumer", diet: "omnivore" },
  crow: { name: tx("carrion crow", "Rabenkrähe"), role: "consumer", diet: "omnivore" },
  jay: { name: tx("jay", "Eichelhäher"), role: "consumer", diet: "omnivore" },
  blackbird: { name: tx("blackbird", "Amsel"), role: "consumer", diet: "omnivore" },
  // decomposers
  earthworm: { name: tx("earthworm", "Regenwurm"), role: "decomposer", note: tx("The earthworm eats dead leaves and breaks them down into small crumbs. That makes it a decomposer.", "Der Regenwurm frisst totes Laub und zerkleinert es. Damit gehört er zu den Zersetzern (Destruenten).") },
  woodlouse: { name: tx("woodlouse", "Assel"), role: "decomposer", note: tx("Woodlice eat dead leaves and wood. They break down dead material.", "Asseln fressen totes Laub und Holz. Sie zersetzen tote Reste.") },
  springtail: { name: tx("springtail", "Springschwanz"), role: "decomposer", note: tx("Springtails live in the leaf litter and feed on dead plant material and fungi.", "Springschwänze leben in der Streu und fressen tote Pflanzenreste und Pilzfäden.") },
  millipede: { name: tx("millipede", "Tausendfüßer"), role: "decomposer", note: tx("Millipedes chew dead leaves and wood into small pieces.", "Tausendfüßer zerkleinern totes Laub und Holz.") },
  mould: { name: tx("mould", "Schimmelpilz"), role: "decomposer", note: tx("Fungi have no chlorophyll. They feed on dead material and break it down into minerals.", "Pilze haben kein Chlorophyll. Sie ernähren sich von toten Resten und bauen sie zu Mineralstoffen ab.") },
  mushroom: { name: tx("field mushroom", "Wiesenchampignon"), role: "decomposer", note: tx("Mushrooms are fungi, not plants: no chlorophyll, no photosynthesis. This one breaks down dead plant material in the soil.", "Champignons sind Pilze, keine Pflanzen: kein Chlorophyll, keine Fotosynthese. Dieser zersetzt tote Pflanzenreste im Boden.") },
  bacteria: { name: tx("soil bacteria", "Bodenbakterien"), role: "decomposer", note: tx("Soil bacteria break down dead remains completely into minerals, carbon dioxide and water.", "Bodenbakterien bauen tote Reste vollständig zu Mineralstoffen, Kohlenstoffdioxid und Wasser ab.") },
  beetle: { name: tx("burying beetle", "Totengräber"), role: "decomposer", note: tx("The burying beetle buries dead mice and birds and feeds its larvae on them: it helps break down carrion.", "Der Totengräber vergräbt tote Mäuse und Vögel und füttert seine Larven damit: Er hilft, Aas abzubauen.") },
} satisfies Record<string, Org>;

export type OrgId = keyof typeof ORG_LIST;
export const ORGS: Record<OrgId, Org> = ORG_LIST;
export const org = (id: OrgId): Org => ORGS[id];
export const nameOf = (id: OrgId) => ORGS[id].name;

export const HABITAT_NAME: Record<Habitat, Text> = {
  forest: tx("forest", "Wald"),
  meadow: tx("meadow", "Wiese"),
  lake: tx("lake", "See"),
};

// ---------------------------------------------------------------------------
// Food chains (producer first). Every link is a real feeding relation in Central Europe.

export type Chain = { habitat: Habitat; ids: OrgId[] };

export const CHAINS: Chain[] = [
  { habitat: "forest", ids: ["oak", "caterpillar", "greattit", "sparrowhawk"] },
  { habitat: "forest", ids: ["beech", "bankvole", "owl"] },
  { habitat: "forest", ids: ["oak", "squirrel", "marten"] },
  { habitat: "forest", ids: ["herbs", "roe", "lynx"] },
  { habitat: "forest", ids: ["spruce", "squirrel", "goshawk"] },
  { habitat: "forest", ids: ["bramble", "roe", "wolf"] },
  { habitat: "forest", ids: ["beech", "caterpillar", "greattit", "sparrowhawk"] },
  { habitat: "meadow", ids: ["grass", "hare", "fox"] },
  { habitat: "meadow", ids: ["grass", "grasshopper", "frog", "stork"] },
  { habitat: "meadow", ids: ["clover", "vole", "buzzard"] },
  { habitat: "meadow", ids: ["grass", "vole", "kestrel"] },
  { habitat: "meadow", ids: ["dandelion", "hare", "fox"] },
  { habitat: "meadow", ids: ["grass", "grasshopper", "shrike", "sparrowhawk"] },
  { habitat: "meadow", ids: ["grass", "grasshopper", "spider", "greattit", "sparrowhawk"] },
  { habitat: "meadow", ids: ["clover", "aphid", "ladybird"] },
  { habitat: "lake", ids: ["algae", "daphnia", "roach", "pike"] },
  { habitat: "lake", ids: ["algae", "daphnia", "dragonfly", "perch", "pike"] },
  { habitat: "lake", ids: ["waterplants", "snail", "roach", "heron"] },
  { habitat: "lake", ids: ["algae", "mosquito", "stickleback", "kingfisher"] },
  { habitat: "lake", ids: ["algae", "daphnia", "roach", "pike", "osprey"] },
  { habitat: "lake", ids: ["algae", "mosquito", "dragonfly", "perch", "cormorant"] },
];

/** "consumer of the 2nd order" etc. (0 = producer). */
export const ORDER_NAME: Text[] = [
  tx("producer", "Produzent"),
  tx("primary consumer (1st order)", "Konsument 1. Ordnung"),
  tx("secondary consumer (2nd order)", "Konsument 2. Ordnung"),
  tx("tertiary consumer (3rd order)", "Konsument 3. Ordnung"),
  tx("quaternary consumer (4th order)", "Konsument 4. Ordnung"),
];

export const ROLE_NAME: Record<Role, Text> = {
  producer: tx("Producer", "Produzent"),
  consumer: tx("Consumer", "Konsument"),
  decomposer: tx("Decomposer", "Destruent (Zersetzer)"),
};

export const DIET_NAME: Record<Diet, Text> = {
  herbivore: tx("Herbivore", "Pflanzenfresser"),
  carnivore: tx("Carnivore", "Fleischfresser"),
  omnivore: tx("Omnivore", "Allesfresser"),
};

/** What the herbivores, carnivores and omnivores of the diet task eat (for Blob's notes). */
export const DIET_FOOD: Partial<Record<OrgId, Text>> = {
  roe: tx("leaves, buds, herbs and grass", "Blätter, Knospen, Kräuter und Gras"),
  hare: tx("grass, herbs and clover", "Gras, Kräuter und Klee"),
  vole: tx("grass, herbs and seeds", "Gras, Kräuter und Samen"),
  grasshopper: tx("grass and leaves", "Gras und Blätter"),
  caterpillar: tx("leaves", "Blätter"),
  aphid: tx("plant sap", "Pflanzensaft"),
  daphnia: tx("tiny algae", "winzige Algen"),
  reddeer: tx("grass, leaves, buds and bark", "Gras, Blätter, Knospen und Rinde"),
  buzzard: tx("mainly voles", "vor allem Feldmäuse"),
  kestrel: tx("voles and other small animals", "Mäuse und andere Kleintiere"),
  sparrowhawk: tx("small birds", "kleine Vögel"),
  goshawk: tx("birds and squirrels", "Vögel und Eichhörnchen"),
  owl: tx("mice, voles and small birds", "Mäuse und kleine Vögel"),
  lynx: tx("mainly roe deer", "vor allem Rehe"),
  wolf: tx("roe deer, red deer and wild boar", "Rehe, Hirsche und Wildschweine"),
  frog: tx("insects, spiders and worms", "Insekten, Spinnen und Würmer"),
  stork: tx("frogs, mice and insects", "Frösche, Mäuse und Insekten"),
  heron: tx("fish and frogs", "Fische und Frösche"),
  pike: tx("other fish", "andere Fische"),
  perch: tx("insect larvae and small fish", "Insektenlarven und kleine Fische"),
  stickleback: tx("small water animals", "kleine Wassertiere"),
  kingfisher: tx("small fish", "kleine Fische"),
  osprey: tx("fish", "Fische"),
  cormorant: tx("fish", "Fische"),
  dragonfly: tx("water fleas and insect larvae", "Wasserflöhe und Insektenlarven"),
  ladybird: tx("aphids", "Blattläuse"),
  spider: tx("insects caught in its web", "Insekten aus ihrem Netz"),
  shrike: tx("large insects and sometimes mice", "große Insekten und manchmal Mäuse"),
  boar: tx("acorns, roots, worms, insect larvae and carrion", "Eicheln, Wurzeln, Würmer, Insektenlarven und Aas"),
  badger: tx("earthworms, insects, fruit and roots", "Regenwürmer, Insekten, Früchte und Wurzeln"),
  human: tx("plants and animals", "Pflanzen und Tiere"),
  crow: tx("seeds, insects, eggs and carrion", "Samen, Insekten, Eier und Aas"),
  jay: tx("acorns, insects and bird eggs", "Eicheln, Insekten und Vogeleier"),
  blackbird: tx("earthworms, insects and berries", "Regenwürmer, Insekten und Beeren"),
};

// ---------------------------------------------------------------------------
// Food webs for the builder and for picture tasks. Nodes sit in rows by trophic level
// (producers at the bottom). `core` arrows complete the web; `extra` arrows are also true
// and accepted, just not required. Arrows point from the eaten to the eater.

export type WebNode = { id: OrgId; x: number; y: number };
export type Web = { id: Habitat; nodes: WebNode[]; core: [OrgId, OrgId][]; extra: [OrgId, OrgId][] };

export const WEB_W = 400;
export const WEB_H = 330;

export const WEBS: Record<Habitat, Web> = {
  meadow: {
    id: "meadow",
    nodes: [
      { id: "buzzard", x: 115, y: 38 },
      { id: "fox", x: 290, y: 38 },
      { id: "lark", x: 70, y: 120 },
      { id: "grasshopper", x: 70, y: 205 },
      { id: "vole", x: 200, y: 205 },
      { id: "hare", x: 330, y: 205 },
      { id: "grass", x: 130, y: 292 },
      { id: "clover", x: 290, y: 292 },
    ],
    core: [
      ["grass", "grasshopper"],
      ["grass", "vole"],
      ["grass", "hare"],
      ["clover", "hare"],
      ["grasshopper", "lark"],
      ["vole", "buzzard"],
      ["vole", "fox"],
      ["hare", "fox"],
    ],
    extra: [
      ["clover", "vole"],
      ["clover", "grasshopper"],
      ["lark", "fox"],
      ["grasshopper", "fox"],
      ["grasshopper", "buzzard"],
      ["grass", "lark"],
    ],
  },
  forest: {
    id: "forest",
    nodes: [
      { id: "sparrowhawk", x: 75, y: 38 },
      { id: "greattit", x: 75, y: 120 },
      { id: "owl", x: 205, y: 120 },
      { id: "marten", x: 330, y: 120 },
      { id: "caterpillar", x: 75, y: 205 },
      { id: "squirrel", x: 205, y: 205 },
      { id: "bankvole", x: 330, y: 205 },
      { id: "oak", x: 135, y: 292 },
      { id: "beech", x: 285, y: 292 },
    ],
    core: [
      ["oak", "caterpillar"],
      ["beech", "caterpillar"],
      ["oak", "squirrel"],
      ["beech", "squirrel"],
      ["beech", "bankvole"],
      ["caterpillar", "greattit"],
      ["greattit", "sparrowhawk"],
      ["bankvole", "owl"],
      ["squirrel", "marten"],
    ],
    extra: [
      ["oak", "bankvole"],
      ["greattit", "owl"],
      ["greattit", "marten"],
      ["bankvole", "marten"],
      ["caterpillar", "bankvole"],
      ["beech", "greattit"],
    ],
  },
  lake: {
    id: "lake",
    nodes: [
      { id: "pike", x: 130, y: 38 },
      { id: "heron", x: 300, y: 38 },
      { id: "dragonfly", x: 75, y: 120 },
      { id: "roach", x: 230, y: 120 },
      { id: "daphnia", x: 95, y: 205 },
      { id: "snail", x: 300, y: 205 },
      { id: "algae", x: 120, y: 292 },
      { id: "waterplants", x: 295, y: 292 },
    ],
    core: [
      ["algae", "daphnia"],
      ["algae", "snail"],
      ["waterplants", "snail"],
      ["daphnia", "dragonfly"],
      ["daphnia", "roach"],
      ["dragonfly", "roach"],
      ["roach", "pike"],
      ["roach", "heron"],
    ],
    extra: [
      ["waterplants", "roach"],
      ["snail", "roach"],
      ["pike", "heron"],
      ["dragonfly", "pike"],
    ],
  },
};

export const webArrows = (w: Web) => [...w.core, ...w.extra];
export const eats = (w: Web, eater: OrgId, food: OrgId) => webArrows(w).some(([a, b]) => a === food && b === eater);

export type Effect = "up" | "down" | "mixed";
export type EffectWhy = "prey" | "food" | "rival" | "predator" | "only" | "mixed";

/**
 * What happens first when one species disappears from a web (simple one- and two-step rules):
 * its prey increase, the food of that prey is eaten more, other hunters of the same prey find
 * more food, and its own predators lose food. Opposite effects on one species → "mixed".
 */
export function removalEffects(w: Web, gone: OrgId): Map<OrgId, { effect: Effect; why: EffectWhy }> {
  const arrows = webArrows(w);
  const preyOf = (x: OrgId) => arrows.filter(([, b]) => b === x).map(([a]) => a);
  const predsOf = (x: OrgId) => arrows.filter(([a]) => a === x).map(([, b]) => b);
  const votes = new Map<OrgId, { up: EffectWhy[]; down: EffectWhy[] }>();
  const vote = (id: OrgId, dir: "up" | "down", why: EffectWhy) => {
    if (id === gone) return;
    const v = votes.get(id) ?? { up: [], down: [] };
    v[dir].push(why);
    votes.set(id, v);
  };
  const prey = preyOf(gone);
  for (const p of prey) {
    vote(p, "up", "prey");
    for (const f of preyOf(p)) if (!prey.includes(f)) vote(f, "down", "food");
    for (const c of predsOf(p)) if (c !== gone) vote(c, "up", "rival");
  }
  for (const b of predsOf(gone)) vote(b, "down", preyOf(b).length === 1 ? "only" : "predator");
  const out = new Map<OrgId, { effect: Effect; why: EffectWhy }>();
  for (const [id, v] of votes) {
    if (v.up.length && v.down.length) out.set(id, { effect: "mixed", why: "mixed" });
    else if (v.up.length) out.set(id, { effect: "up", why: v.up[0] });
    else out.set(id, { effect: "down", why: v.down.includes("only") ? "only" : v.down[0] });
  }
  return out;
}

/** All food chains in a web from a producer to a species with no predator (for counting tasks). */
export function chainsTo(w: Web, top: OrgId, arrows = w.core): OrgId[][] {
  const preyOf = (x: OrgId) => arrows.filter(([, b]) => b === x).map(([a]) => a);
  const walk = (x: OrgId): OrgId[][] => {
    const p = preyOf(x);
    if (!p.length) return [[x]];
    return p.flatMap((y) => walk(y).map((c) => [...c, x]));
  };
  return walk(top);
}

// ---------------------------------------------------------------------------
// Forest layers (Stockwerke des Waldes), top to bottom.

export type LayerId = "tree" | "shrub" | "herb" | "moss" | "root";
export const LAYERS: { id: LayerId; name: Text; height: Text; plants: Text; animals: Text }[] = [
  {
    id: "tree",
    name: tx("tree layer", "Baumschicht"),
    height: tx("from about 5 m up to 40 m", "ab etwa 5 m bis 40 m hoch"),
    plants: tx("beech, oak, spruce", "Buche, Eiche, Fichte"),
    animals: tx("great spotted woodpecker, squirrel, tawny owl", "Buntspecht, Eichhörnchen, Waldkauz"),
  },
  {
    id: "shrub",
    name: tx("shrub layer", "Strauchschicht"),
    height: tx("about 1 m to 5 m", "etwa 1 m bis 5 m hoch"),
    plants: tx("hazel, elder, hawthorn, young trees", "Hasel, Holunder, Weißdorn, junge Bäume"),
    animals: tx("blackcap, wren, dormouse", "Mönchsgrasmücke, Zaunkönig, Haselmaus"),
  },
  {
    id: "herb",
    name: tx("herb layer", "Krautschicht"),
    height: tx("up to about 1 m", "bis etwa 1 m hoch"),
    plants: tx("wood anemone, woodruff, ferns, wild garlic, grasses", "Buschwindröschen, Waldmeister, Farne, Bärlauch, Gräser"),
    animals: tx("snails, beetles, butterflies", "Schnecken, Käfer, Schmetterlinge"),
  },
  {
    id: "moss",
    name: tx("moss layer", "Moosschicht"),
    height: tx("a few centimetres above the ground", "wenige Zentimeter über dem Boden"),
    plants: tx("mosses, lichens, mushrooms, leaf litter", "Moose, Flechten, Pilze, Laubstreu"),
    animals: tx("ground beetles, ants, woodlice, spiders", "Laufkäfer, Ameisen, Asseln, Spinnen"),
  },
  {
    id: "root",
    name: tx("root layer (soil)", "Wurzelschicht (Boden)"),
    height: tx("below the ground", "unter der Erde"),
    plants: tx("roots, fungal threads", "Wurzeln, Pilzgeflechte"),
    animals: tx("earthworms, moles, bacteria", "Regenwürmer, Maulwürfe, Bakterien"),
  },
];

/** Plants and animals and the layer they typically live in (for tasks). `nom`: with article. */
export const LAYER_MEMBERS: { name: Text; nom: Text; layer: LayerId; plant: boolean; plural?: boolean }[] = [
  { name: tx("beech", "Buche"), nom: tx("the beech", "die Buche"), layer: "tree", plant: true },
  { name: tx("oak", "Eiche"), nom: tx("the oak", "die Eiche"), layer: "tree", plant: true },
  { name: tx("spruce", "Fichte"), nom: tx("the spruce", "die Fichte"), layer: "tree", plant: true },
  { name: tx("great spotted woodpecker", "Buntspecht"), nom: tx("the great spotted woodpecker", "der Buntspecht"), layer: "tree", plant: false },
  { name: tx("hazel", "Hasel"), nom: tx("the hazel", "die Hasel"), layer: "shrub", plant: true },
  { name: tx("elder", "Holunder"), nom: tx("the elder", "der Holunder"), layer: "shrub", plant: true },
  { name: tx("hawthorn", "Weißdorn"), nom: tx("the hawthorn", "der Weißdorn"), layer: "shrub", plant: true },
  { name: tx("dormouse", "Haselmaus"), nom: tx("the dormouse", "die Haselmaus"), layer: "shrub", plant: false },
  { name: tx("wood anemone", "Buschwindröschen"), nom: tx("the wood anemone", "das Buschwindröschen"), layer: "herb", plant: true },
  { name: tx("woodruff", "Waldmeister"), nom: tx("woodruff", "der Waldmeister"), layer: "herb", plant: true },
  { name: tx("wild garlic", "Bärlauch"), nom: tx("wild garlic", "der Bärlauch"), layer: "herb", plant: true },
  { name: tx("fern", "Farn"), nom: tx("the fern", "der Farn"), layer: "herb", plant: true },
  { name: tx("lily of the valley", "Maiglöckchen"), nom: tx("the lily of the valley", "das Maiglöckchen"), layer: "herb", plant: true },
  { name: tx("moss cushions", "Moospolster"), nom: tx("moss cushions", "Moospolster"), layer: "moss", plant: true, plural: true },
  { name: tx("lichens", "Flechten"), nom: tx("lichens", "Flechten"), layer: "moss", plant: false, plural: true },
  { name: tx("ground beetle", "Laufkäfer"), nom: tx("the ground beetle", "der Laufkäfer"), layer: "moss", plant: false },
  { name: tx("earthworm", "Regenwurm"), nom: tx("the earthworm", "der Regenwurm"), layer: "root", plant: false },
  { name: tx("mole", "Maulwurf"), nom: tx("the mole", "der Maulwurf"), layer: "root", plant: false },
];

// ---------------------------------------------------------------------------
// Grammar for sentences about organisms: German article (nominative singular), plural (or the
// mass noun), English plural. `plural`: the name itself is a plural ("Algen").

type Gram = { art: "der" | "die" | "das"; pl: string; plEn: string; mass?: true; plural?: true };
const G = (art: Gram["art"], pl: string, plEn: string, extra: Partial<Gram> = {}): Gram => ({ art, pl, plEn, ...extra });

export const GRAM: Record<OrgId, Gram> = {
  grass: G("das", "Gras", "grass", { mass: true }),
  herbs: G("die", "Kräuter", "herbs", { plural: true }),
  clover: G("der", "Klee", "clover", { mass: true }),
  dandelion: G("der", "Löwenzahn", "dandelion", { mass: true }),
  oak: G("die", "Eichen", "oaks"),
  beech: G("die", "Buchen", "beeches"),
  spruce: G("die", "Fichten", "spruces"),
  bramble: G("die", "Brombeeren", "brambles"),
  algae: G("die", "Algen", "algae", { plural: true }),
  waterplants: G("die", "Wasserpflanzen", "water plants", { plural: true }),
  moss: G("das", "Moose", "mosses"),
  fern: G("der", "Farne", "ferns"),
  anemone: G("das", "Buschwindröschen", "wood anemones"),
  waterlily: G("die", "Seerosen", "water lilies"),
  roe: G("das", "Rehe", "roe deer"),
  hare: G("der", "Feldhasen", "hares"),
  vole: G("die", "Feldmäuse", "voles"),
  bankvole: G("die", "Rötelmäuse", "bank voles"),
  grasshopper: G("die", "Heuschrecken", "grasshoppers"),
  caterpillar: G("die", "Raupen", "caterpillars"),
  aphid: G("die", "Blattläuse", "aphids"),
  daphnia: G("der", "Wasserflöhe", "water fleas"),
  snail: G("die", "Schlammschnecken", "pond snails"),
  reddeer: G("der", "Rothirsche", "red deer"),
  mosquito: G("die", "Mückenlarven", "mosquito larvae"),
  squirrel: G("das", "Eichhörnchen", "squirrels"),
  fox: G("der", "Füchse", "foxes"),
  buzzard: G("der", "Mäusebussarde", "buzzards"),
  kestrel: G("der", "Turmfalken", "kestrels"),
  sparrowhawk: G("der", "Sperber", "sparrowhawks"),
  goshawk: G("der", "Habichte", "goshawks"),
  owl: G("der", "Waldkäuze", "tawny owls"),
  marten: G("der", "Baummarder", "pine martens"),
  lynx: G("der", "Luchse", "lynx"),
  wolf: G("der", "Wölfe", "wolves"),
  greattit: G("die", "Kohlmeisen", "great tits"),
  frog: G("der", "Grasfrösche", "frogs"),
  stork: G("der", "Weißstörche", "storks"),
  heron: G("der", "Graureiher", "herons"),
  pike: G("der", "Hechte", "pike"),
  perch: G("der", "Barsche", "perch"),
  roach: G("das", "Rotaugen", "roach"),
  stickleback: G("der", "Stichlinge", "sticklebacks"),
  kingfisher: G("der", "Eisvögel", "kingfishers"),
  osprey: G("der", "Fischadler", "ospreys"),
  cormorant: G("der", "Kormorane", "cormorants"),
  dragonfly: G("die", "Libellenlarven", "dragonfly larvae"),
  ladybird: G("der", "Marienkäfer", "ladybirds"),
  spider: G("die", "Kreuzspinnen", "garden spiders"),
  shrike: G("der", "Neuntöter", "shrikes"),
  lark: G("die", "Feldlerchen", "skylarks"),
  boar: G("das", "Wildschweine", "wild boar"),
  badger: G("der", "Dachse", "badgers"),
  human: G("der", "Menschen", "humans"),
  crow: G("die", "Rabenkrähen", "crows"),
  jay: G("der", "Eichelhäher", "jays"),
  blackbird: G("die", "Amseln", "blackbirds"),
  earthworm: G("der", "Regenwürmer", "earthworms"),
  woodlouse: G("die", "Asseln", "woodlice"),
  springtail: G("der", "Springschwänze", "springtails"),
  millipede: G("der", "Tausendfüßer", "millipedes"),
  mould: G("der", "Schimmelpilze", "moulds"),
  mushroom: G("der", "Wiesenchampignons", "field mushrooms"),
  bacteria: G("die", "Bodenbakterien", "soil bacteria", { plural: true }),
  beetle: G("der", "Totengräber", "burying beetles"),
};

const up = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "the fox" / "der Fuchs" (nominative). */
export const the = (id: OrgId): Text => {
  const g = GRAM[id];
  const n = ORGS[id].name as { en: string; de: string };
  return tx(`the ${n.en}`, `${g.plural ? "die" : g.art} ${n.de}`);
};
/** "The fox" / "Der Fuchs". */
export const The = (id: OrgId): Text => {
  const t = the(id) as { en: string; de: string };
  return tx(up(t.en), up(t.de));
};
/** Plural or mass noun: "foxes" / "Füchse", "grass" / "Gras". */
export const plOf = (id: OrgId): Text => tx(GRAM[id].plEn, GRAM[id].pl);
/** German dative plural ("von Füchsen", "an Gras"). */
export const datPl = (id: OrgId): Text => {
  const g = GRAM[id];
  return tx(g.plEn, g.mass || /[ns]$/.test(g.pl) ? g.pl : `${g.pl}n`);
};
/** Is the name itself a plural (verb in plural)? */
export const isPl = (id: OrgId) => !!GRAM[id].plural;
/** Verb agreeing with the name: vb(id, "eats", "eat", "frisst", "fressen"). */
export const vb = (id: OrgId, sgEn: string, plEn: string, sgDe: string, plDe: string): Text => (isPl(id) ? tx(plEn, plDe) : tx(sgEn, sgDe));
/** "the number of hares" / "die Zahl der Feldhasen", "the amount of grass" / "die Menge an Gras". */
export const amountOf = (id: OrgId): Text => (GRAM[id].mass ? tx(`the amount of ${GRAM[id].plEn}`, `die Menge an ${GRAM[id].pl}`) : tx(`the number of ${GRAM[id].plEn}`, `die Zahl der ${GRAM[id].pl}`));
