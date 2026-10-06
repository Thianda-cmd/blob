"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { FlowerFruits, FlowerFruitSection } from "@/learn/biology/visuals/FlowerFruits";
import { FlowerPollenTube } from "@/learn/biology/visuals/FlowerPollenTube";
import { FlowerBeanSeed, FlowerGermDishes, FlowerMaizeGrain, FlowerSeed } from "@/learn/biology/visuals/FlowerSeed";
import { FlowerWindInsect } from "@/learn/biology/visuals/FlowerWindInsect";
import {
  CHAIN2,
  DISHES,
  FEATURES,
  FRUIT_BANK,
  FRUIT_TYPES,
  GERM_CHAIN,
  INSECT_FLOWERS,
  SEED_PARTS,
  VEG_ORGANS,
  VEG_PLANTS,
  WIND_FLOWERS,
  germinates,
  type FlowerKind,
  type FruitType,
  type SeedPart,
  type Vegetative,
} from "./data";
import { cap, capT, choice, de, en, join, multi, q, some, visual, type MultiOpt, type MultiSlip, type Opt } from "./kit";

// Level 2 (Fortgeschritten, Klasse 7–9): insect and wind flowers, self- and cross-pollination,
// the pollen tube, fruit types, seed structure and germination, vegetative reproduction.

// ---------------------------------------------------------------------------
// Insect or wind flower: features

/** What Blob says when a feature is picked for the wrong kind of flower (same order as FEATURES). */
const FEATURE_SLIP: { title: Text; say: Text }[] = [
  { title: tx("Wind flowers are plain", "Windblüten sind unscheinbar"), say: tx("Colourful petals are an advert for insects. The wind doesn't need to be attracted, so wind flowers save the effort.", "Bunte Kronblätter sind Werbung für Insekten. Den Wind muss man nicht anlocken, also sparen sich Windblüten das.") },
  { title: tx("Scent is for animals", "Duft ist für Tiere"), say: tx("A scent lures animals. For the wind it would be wasted.", "Duft lockt Tiere an. Für den Wind wäre er verschwendet.") },
  { title: tx("Nectar is a reward", "Nektar ist eine Belohnung"), say: tx("Nectar rewards visitors. The wind doesn't need paying.", "Nektar belohnt Besucher. Den Wind muss man nicht bezahlen.") },
  { title: tx("Sticky pollen doesn't fly", "Klebriger Pollen fliegt nicht"), say: tx("Sticky pollen clumps and clings. Pollen for the wind has to be light and dry.", "Klebriger Pollen verklumpt und haftet. Pollen für den Wind muss leicht und trocken sein.") },
  { title: tx("Too small for the air", "Zu klein für die Luft"), say: tx("A small stigma would hardly catch pollen from the air. Wind flowers have large, feathery stigmas.", "Eine kleine Narbe würde kaum Pollen aus der Luft fischen. Windblüten haben große, federartige Narben.") },
  { title: tx("Insects need an advert", "Insekten brauchen Werbung"), say: tx("Without eye-catching petals, insects would hardly find the flower.", "Ohne auffällige Kronblätter würden Insekten die Blüte kaum finden.") },
  { title: tx("No reason to visit", "Kein Grund für einen Besuch"), say: tx("Without scent and nectar, there would be no reason for insects to come by.", "Ohne Duft und Nektar gäbe es für Insekten keinen Grund, vorbeizukommen.") },
  { title: tx("Insects deliver precisely", "Insekten liefern gezielt"), say: tx("Insects carry pollen straight to the next flower, so less pollen is enough. Masses of light pollen are typical for the wind.", "Insekten bringen den Pollen gezielt zur nächsten Blüte, deshalb reicht weniger. Massen von leichtem Pollen sind typisch für den Wind.") },
  { title: tx("A net for the air", "Ein Netz für die Luft"), say: tx("Feathery stigmas fish pollen out of the air. That's what wind flowers need.", "Federartige Narben fischen Pollen aus der Luft. Das brauchen Windblüten.") },
  { title: tx("Out in the wind", "Raus in den Wind"), say: tx("Dangling anthers give their pollen to the wind. In insect flowers they sit protected inside the flower.", "Heraushängende Staubbeutel geben ihren Pollen an den Wind ab. Bei Insektenblüten liegen sie geschützt in der Blüte."),
  },
];

const KIND_NAME: Record<FlowerKind, Text> = { insect: tx("insect-pollinated flower", "Insektenblüte"), wind: tx("wind-pollinated flower", "Windblüte") };

export function featuresTask(rng: Rng, fixedKind?: FlowerKind): Exercise {
  const kind = fixedKind ?? (rng.chance(0.5) ? "wind" : "insect");
  const idx = (k: FlowerKind) => FEATURES.map((f, i) => (f.kind === k ? i : -1)).filter((i) => i >= 0);
  const right = some(rng, idx(kind), 3);
  const wrong = some(rng, idx(kind === "wind" ? "insect" : "wind"), 3);
  const ids = [...right, ...wrong];
  const opts: MultiOpt[] = ids.map((i) => ({ text: capT(FEATURES[i].text), ok: FEATURES[i].kind === kind }));
  const slips: MultiSlip[] = wrong.map((w, k) => ({ pick: [0, 1, 2, 3 + k], title: FEATURE_SLIP[w].title, say: FEATURE_SLIP[w].say }));
  const { answer, mistakes } = multi(rng, opts, slips);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: kind === "wind" ? tx("Which features are typical for a **wind-pollinated** flower?", "Welche Merkmale sind typisch für eine **Windblüte**?") : tx("Which features are typical for an **insect-pollinated** flower?", "Welche Merkmale sind typisch für eine **Insektenblüte**?"),
    answer,
    hint: tx("Insect flowers advertise and reward. Wind flowers rely on masses of pollen and a good net.", "Insektenblüten werben und belohnen. Windblüten setzen auf Massen von Pollen und ein gutes Netz."),
    solution: [
      {
        math: q(KIND_NAME[kind], "k"),
        note: tx(`Typical: ${right.map((i) => en(FEATURES[i].text)).join("; ")}.`, `Typisch: ${right.map((i) => de(FEATURES[i].text)).join("; ")}.`),
      },
    ],
    mistakes: mistakes.slice(0, 3),
  };
}

const POLL_OPTS: Text[] = [tx("By insects (insect flower)", "Durch Insekten (Insektenblüte)"), tx("By the wind (wind flower)", "Durch den Wind (Windblüte)")];

export function classifyTask(rng: Rng): Exercise {
  const wind = rng.chance(0.5);
  const f = rng.pick(wind ? WIND_FLOWERS : INSECT_FLOWERS);
  const opts: Opt[] = wind
    ? [
        { text: POLL_OPTS[1] },
        {
          text: POLL_OPTS[0],
          title: tx("Look for the advert", "Such die Werbung"),
          say: tx("Any colourful petals, scent or nectar? No. But lots of pollen and feathery stigmas: that's the wind's style. (Yellow catkins are yellow from pollen, not from petals.)", "Bunte Kronblätter, Duft oder Nektar? Fehlanzeige. Aber viel Pollen und federige Narben: Das ist der Stil des Windes. (Gelbe Kätzchen sind gelb vom Pollen, nicht von Kronblättern.)"),
        },
      ]
    : [
        { text: POLL_OPTS[0] },
        {
          text: POLL_OPTS[1],
          title: tx("Advert and reward", "Werbung und Belohnung"),
          say: tx("Colour, scent and nectar are an advert and a reward. They are meant for animals, not for the wind.", "Farbe, Duft und Nektar sind Werbung und Belohnung. Die richten sich an Tiere, nicht an den Wind."),
        },
      ];
  const { answer, mistakes } = choice(rng, opts);
  return {
    instruction: tx("Insect or wind?", "Insekten oder Wind?"),
    text: tx(`**${cap(en(f.name))}**: ${en(f.look)} How is this plant pollinated?`, `**${de(f.name)}**: ${de(f.look)} Wie wird diese Pflanze bestäubt?`),
    answer,
    hint: tx("Advert (colour, scent, nectar) means insects. Masses of light pollen and big stigmas mean wind.", "Werbung (Farbe, Duft, Nektar) heißt Insekten. Massen von leichtem Pollen und große Narben heißen Wind."),
    solution: [{ math: join(q(f.name, "p"), "\\to", q(KIND_NAME[wind ? "wind" : "insect"], "k")), note: wind ? tx("No advert, but lots of pollen and big stigmas: a wind flower.", "Keine Werbung, aber viel Pollen und große Narben: eine Windblüte.") : tx("Colour, scent and nectar attract insects: an insect flower.", "Farbe, Duft und Nektar locken Insekten an: eine Insektenblüte."), highlight: ["k"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Self- or cross-pollination

const SELF = tx("Self-pollination", "Selbstbestäubung");
const CROSS = tx("Cross-pollination", "Fremdbestäubung");

const SC_SCENES: { text: Text; self: boolean; trap?: Text }[] = [
  { text: tx("In a pea flower, pollen falls onto the stigma of the same flower while it is still closed.", "In einer Erbsenblüte fällt Pollen noch in der geschlossenen Blüte auf die Narbe derselben Blüte."), self: true },
  { text: tx("A bee carries pollen from an apple tree in one garden to an apple tree in the neighbour's garden.", "Eine Biene trägt Pollen von einem Apfelbaum im einen Garten zu einem Apfelbaum im Nachbargarten."), self: false },
  { text: tx("The wind blows pollen from one rye plant onto the stigmas of another rye plant.", "Der Wind weht Pollen einer Roggenpflanze auf die Narben einer anderen Roggenpflanze."), self: false },
  {
    text: tx("A bumblebee carries pollen from one flower of a dead-nettle plant to another flower of the same plant.", "Eine Hummel trägt Pollen von einer Blüte einer Taubnesselpflanze zu einer anderen Blüte derselben Pflanze."),
    self: true,
    trap: tx("Another flower, but the same plant: the genes are the same. That still counts as self-pollination.", "Andere Blüte, aber dieselbe Pflanze: Die Erbanlagen sind gleich. Das zählt noch als Selbstbestäubung."),
  },
  { text: tx("A hoverfly carries pollen from a rapeseed plant at the edge of the field to a rapeseed plant in the middle.", "Eine Schwebfliege trägt Pollen von einer Rapspflanze am Feldrand zu einer Rapspflanze in der Mitte des Feldes."), self: false },
];

export function selfCrossTask(rng: Rng): Exercise {
  const s = rng.pick(SC_SCENES);
  const right = s.self ? SELF : CROSS;
  const wrong = s.self ? CROSS : SELF;
  const { answer, mistakes } = choice(rng, [
    { text: right },
    {
      text: wrong,
      title: s.self ? tx("Same plant", "Dieselbe Pflanze") : tx("Two plants", "Zwei Pflanzen"),
      say: s.trap ?? (s.self ? tx("The pollen stays on the same plant. Cross-pollination needs a second plant of the same species.", "Der Pollen bleibt auf derselben Pflanze. Für Fremdbestäubung braucht es eine zweite Pflanze derselben Art.") : tx("The pollen comes from a different plant of the same species. Think about which word fits that.", "Der Pollen stammt von einer anderen Pflanze derselben Art. Überleg, welcher Begriff dazu passt.")),
    },
  ]);
  return {
    instruction: tx("Self or cross?", "Selbst oder fremd?"),
    text: s.text,
    answer,
    hint: tx("Count the plants, not the flowers: one plant or two?", "Zähl die Pflanzen, nicht die Blüten: eine Pflanze oder zwei?"),
    solution: [{ math: q(right, "a"), note: s.self ? tx("All the pollen stays on one plant: **self-pollination**.", "Der Pollen bleibt auf einer Pflanze: **Selbstbestäubung**.") : tx("Pollen from another plant of the same species: **cross-pollination**.", "Pollen von einer anderen Pflanze derselben Art: **Fremdbestäubung**.") }],
    mistakes,
  };
}

const SC_WHY: { ask: Text; right: Text; short: Text; wrong: Opt[]; note: Text }[] = [
  {
    ask: tx("What is an advantage of **cross-pollination**?", "Welchen Vorteil hat die **Fremdbestäubung**?"),
    right: tx("The genes of two plants are mixed: the offspring are more varied.", "Die Erbanlagen zweier Pflanzen werden neu gemischt: Die Nachkommen sind vielfältiger."),
    short: tx("more variety", "mehr Vielfalt"),
    wrong: [
      { text: tx("No pollinator is needed.", "Es ist kein Bestäuber nötig."), title: tx("Swapped", "Vertauscht"), say: tx("That's the advantage of self-pollination. Cross-pollination needs wind or animals to carry the pollen to another plant.", "Das ist der Vorteil der Selbstbestäubung. Fremdbestäubung braucht Wind oder Tiere, die den Pollen zu einer anderen Pflanze tragen.") },
      { text: tx("All offspring are exactly the same.", "Alle Nachkommen sind genau gleich."), title: tx("The opposite", "Das Gegenteil"), say: tx("Mixing the genes of two plants makes the offspring different from each other.", "Werden die Erbanlagen zweier Pflanzen gemischt, werden die Nachkommen verschieden.") },
      { text: tx("The plant doesn't need flowers any more.", "Die Pflanze braucht keine Blüten mehr.") },
    ],
    note: tx("New combinations of genes make the offspring varied, so some may cope better with change.", "Neue Kombinationen von Erbanlagen machen die Nachkommen vielfältig. Manche kommen dann mit Veränderungen besser zurecht."),
  },
  {
    ask: tx("What is an advantage of **self-pollination**?", "Welchen Vorteil hat die **Selbstbestäubung**?"),
    right: tx("Seeds form even without pollinators or neighbouring plants.", "Samen entstehen auch ohne Bestäuber oder Nachbarpflanzen."),
    short: tx("works alone", "klappt allein"),
    wrong: [
      { text: tx("The offspring are especially varied.", "Die Nachkommen sind besonders vielfältig."), title: tx("Swapped", "Vertauscht"), say: tx("Variety comes from mixing the genes of two different plants. With self-pollination there is hardly any new mixing.", "Vielfalt entsteht durch Mischen der Erbanlagen zweier verschiedener Pflanzen. Bei Selbstbestäubung wird kaum neu gemischt.") },
      { text: tx("The plant doesn't need stamens.", "Die Pflanze braucht keine Staubblätter.") },
      { text: tx("The seeds are spread further.", "Die Samen werden weiter verbreitet."), title: tx("That's dispersal", "Das ist Verbreitung"), say: tx("How far seeds travel depends on the fruit, not on the kind of pollination.", "Wie weit Samen reisen, hängt von der Frucht ab, nicht von der Art der Bestäubung.") },
    ],
    note: tx("Self-pollination is safe: it works even for a lonely plant or in bad weather. But it hardly creates variety.", "Selbstbestäubung ist sicher: Sie klappt auch bei einer einzelnen Pflanze oder bei schlechtem Wetter. Vielfalt entsteht dabei aber kaum."),
  },
  {
    ask: tx("In meadow sage the anthers ripen a few days before the stigma. What does that achieve?", "Beim Wiesensalbei reifen die Staubbeutel einige Tage vor der Narbe. Was wird dadurch erreicht?"),
    right: tx("Self-pollination is made harder, cross-pollination is favoured.", "Selbstbestäubung wird erschwert, Fremdbestäubung gefördert."),
    short: tx("cross-pollination favoured", "Fremdbestäubung gefördert"),
    wrong: [
      { text: tx("Self-pollination is favoured.", "Selbstbestäubung wird gefördert."), title: tx("Bad timing for selfing", "Schlechtes Timing für Selbstbestäubung"), say: tx("When the pollen is ripe, the stigma of the same flower isn't ready yet. So its own pollen can hardly be used.", "Wenn der Pollen reif ist, ist die Narbe derselben Blüte noch nicht bereit. Der eigene Pollen kann also kaum genutzt werden.") },
      { text: tx("The pollen is spread by the wind.", "Der Pollen wird vom Wind verbreitet.") },
      { text: tx("The flower no longer needs insects.", "Die Blüte braucht keine Insekten mehr.") },
    ],
    note: tx("Stamens and stigma ripen at different times, so the flower's own pollen comes too early: cross-pollination wins.", "Staubbeutel und Narbe reifen zu verschiedenen Zeiten, der eigene Pollen kommt zu früh: So setzt sich die Fremdbestäubung durch."),
  },
  {
    ask: tx("Willows have purely male and purely female plants. What follows from this?", "Bei Weiden gibt es rein männliche und rein weibliche Pflanzen. Was folgt daraus?"),
    right: tx("Only cross-pollination is possible.", "Es ist nur Fremdbestäubung möglich."),
    short: tx("only cross-pollination", "nur Fremdbestäubung"),
    wrong: [
      { text: tx("Only self-pollination is possible.", "Es ist nur Selbstbestäubung möglich."), title: tx("Think about the female plant", "Denk an die weibliche Pflanze"), say: tx("A female willow has no stamens and so no pollen of its own. Where must its pollen come from?", "Eine weibliche Weide hat keine Staubblätter und damit keinen eigenen Pollen. Woher muss ihr Pollen also kommen?") },
      { text: tx("Willows don't need pollination.", "Weiden brauchen keine Bestäubung.") },
      { text: tx("Every willow forms fruits.", "Jede Weide bildet Früchte."), title: tx("Only the females", "Nur die weiblichen"), say: tx("Fruits grow from ovaries, and only the female plants have them.", "Früchte entstehen aus Fruchtknoten, und die haben nur die weiblichen Pflanzen.") },
    ],
    note: tx("A female willow has no pollen of its own: it always gets pollen from a male plant.", "Eine weibliche Weide hat keinen eigenen Pollen: Sie bekommt ihn immer von einer männlichen Pflanze."),
  },
];

export function selfCrossWhyTask(rng: Rng): Exercise {
  const w = rng.pick(SC_WHY);
  const { answer, mistakes } = choice(rng, [{ text: w.right }, ...w.wrong]);
  return {
    instruction: tx("Self- and cross-pollination", "Selbst- und Fremdbestäubung"),
    text: w.ask,
    answer,
    hint: tx("Cross-pollination mixes the genes of two plants. Self-pollination works alone.", "Fremdbestäubung mischt die Erbanlagen zweier Pflanzen. Selbstbestäubung klappt allein."),
    solution: [{ math: q(w.short, "a"), note: tx(`${en(w.right)} ${en(w.note)}`, `${de(w.right)} ${de(w.note)}`) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// From the stigma to the seed (order)

const CHAIN2_SLIPS: { first: number; then: number; title: Text; say: Text }[] = [
  { first: 2, then: 1, title: tx("Germinate first", "Erst keimen"), say: tx("The tube can only grow down the style once the pollen grain has germinated.", "Der Schlauch kann erst durch den Griffel wachsen, wenn das Pollenkorn gekeimt ist.") },
  { first: 4, then: 3, title: tx("Through the micropyle first", "Erst durch die Mikropyle"), say: tx("The sperm cell is inside the tube. It can only reach the egg cell after the tube has entered the ovule.", "Die Spermazelle steckt im Schlauch. Sie erreicht die Eizelle erst, wenn der Schlauch in die Samenanlage eingedrungen ist.") },
  { first: 5, then: 4, title: tx("No embryo without a zygote", "Kein Keimling ohne Zygote"), say: tx("The embryo develops from the zygote, so fertilisation has to come first.", "Der Keimling entwickelt sich aus der Zygote, also muss erst die Befruchtung kommen.") },
  { first: 6, then: 4, title: tx("No seed without fertilisation", "Kein Samen ohne Befruchtung"), say: tx("Seed and fruit only develop after fertilisation.", "Samen und Frucht entwickeln sich erst nach der Befruchtung.") },
];
const CHAIN2_SHORT: Text[] = [
  tx("pollination", "Bestäubung"),
  tx("pollen grain germinates", "Pollenkorn keimt"),
  tx("tube through the style", "Schlauch durch den Griffel"),
  tx("through the micropyle", "durch die Mikropyle"),
  tx("fertilisation: zygote", "Befruchtung: Zygote"),
  tx("embryo", "Keimling"),
  tx("seed and fruit", "Samen und Frucht"),
];

export function tubeOrderTask(rng: Rng, from?: number, len?: number): Exercise {
  const n = len ?? rng.int(4, 5);
  const start = from ?? rng.int(0, CHAIN2.length - n);
  const idx = Array.from({ length: n }, (_, i) => start + i);
  const mistakes: Mistake[] = CHAIN2_SLIPS.filter((s) => idx.includes(s.first) && idx.includes(s.then)).map((s) => ({ when: { kind: "order", items: [CHAIN2[s.first], CHAIN2[s.then]] }, title: s.title, say: s.say }));
  const lines = idx.map((i, k) => q(CHAIN2_SHORT[i], `s${k}`));
  return {
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx("From the pollen grain on the stigma to the seed:", "Vom Pollenkorn auf der Narbe bis zum Samen:"),
    answer: { kind: "order", items: idx.map((i) => CHAIN2[i]) },
    hint: tx("Follow the sperm cell: it travels inside the pollen tube from the stigma to the egg cell.", "Folge der Spermazelle: Sie reist im Pollenschlauch von der Narbe bis zur Eizelle."),
    solution: [
      {
        math: tx(lines.map((l, k) => `${k + 1}. ${en(l)}`).join(" \\\\ "), lines.map((l, k) => `${k + 1}. ${de(l)}`).join(" \\\\ ")),
        note: tx("The pollen tube carries the sperm cell through the style and the micropyle to the egg cell. Only then comes fertilisation.", "Der Pollenschlauch bringt die Spermazelle durch Griffel und Mikropyle zur Eizelle. Erst dann folgt die Befruchtung."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Fruit types

const CONFUSE_FRUIT: Record<FruitType, FruitType[]> = {
  drupe: ["berry", "nut", "aggregateDrupe"],
  berry: ["drupe", "aggregateNut", "capsule"],
  nut: ["capsule", "drupe", "berry"],
  capsule: ["nut", "legume", "berry"],
  aggregateNut: ["berry", "aggregateDrupe", "drupe"],
  aggregateDrupe: ["berry", "aggregateNut", "drupe"],
  legume: ["capsule", "nut", "berry"],
};

function fruitSay(right: FruitType, picked: FruitType, fruit: Text): { title: Text; say: Text } | null {
  const F = en(fruit);
  const D = de(fruit);
  const SAY: Partial<Record<string, { title: Text; say: Text }>> = {
    "aggregateNut>berry": {
      title: tx("Not a berry!", "Keine Beere!"),
      say: tx("The famous trap: the red flesh of the strawberry is the swollen receptacle. The real fruits are the tiny yellow nutlets on the outside.", "Die berühmte Falle: Das rote Fruchtfleisch der Erdbeere ist der angeschwollene Blütenboden. Die echten Früchte sind die winzigen gelben Nüsschen außen."),
    },
    "drupe>berry": { title: tx("Feel for the stone", "Fühl nach dem Stein"), say: tx(`In a berry the whole fruit wall is soft. The ${F} has a hard stone around its seed.`, `Bei einer Beere ist die ganze Fruchtwand weich. ${cap(D)} hat einen harten Steinkern um den Samen.`) },
    "berry>drupe": { title: tx("No stone", "Kein Steinkern"), say: tx(`The ${F} has no hard stone: the whole fruit wall is fleshy and the seeds sit right in the flesh.`, `${cap(D)} hat keinen harten Steinkern: Die ganze Fruchtwand ist fleischig, die Samen liegen direkt im Fruchtfleisch.`) },
    "nut>capsule": { title: tx("It stays closed", "Sie bleibt geschlossen"), say: tx("A capsule opens and releases many seeds. This fruit stays closed and holds just one seed.", "Eine Kapsel öffnet sich und entlässt viele Samen. Diese Frucht bleibt geschlossen und enthält nur einen Samen.") },
    "capsule>nut": { title: tx("It opens", "Sie öffnet sich"), say: tx("A nut stays closed. This dry fruit opens and lets out many seeds.", "Eine Nuss bleibt geschlossen. Diese trockene Frucht öffnet sich und entlässt viele Samen.") },
    "aggregateDrupe>berry": { title: tx("Many little stones", "Viele kleine Steine"), say: tx("Look closely: it's made of many little balls, each with its own tiny stone: lots of little drupes stuck together.", "Schau genau hin: Sie besteht aus vielen kleinen Kügelchen, jedes mit einem eigenen Kernchen: lauter kleine Steinfrüchte, die zusammenhängen.") },
    "legume>capsule": { title: tx("A special case", "Ein Sonderfall"), say: tx("Close! It's dry and opens, but it grows from a single carpel and splits along two seams: that has its own name.", "Knapp! Sie ist trocken und springt auf, entsteht aber aus einem einzigen Fruchtblatt und öffnet sich an zwei Nähten: Das hat einen eigenen Namen.") },
    "berry>aggregateNut": { title: tx("One fruit, one wall", "Eine Frucht, eine Wand"), say: tx("Here the flesh is the fruit wall itself, with the seeds inside. No nutlets sit on the outside.", "Hier ist das Fruchtfleisch die Fruchtwand selbst, die Samen liegen innen. Außen sitzen keine Nüsschen.") },
  };
  return SAY[`${right}>${picked}`] ?? null;
}

export function fruitTypeTask(rng: Rng, fixed?: number): Exercise {
  const f = fixed !== undefined ? FRUIT_BANK[fixed] : rng.pick(FRUIT_BANK);
  const wrong = CONFUSE_FRUIT[f.type];
  const { answer, mistakes } = choice(rng, [{ text: capT(FRUIT_TYPES[f.type].name) }, ...wrong.map((w) => ({ text: capT(FRUIT_TYPES[w].name), ...(fruitSay(f.type, w, f.name) ?? {}) }))]);
  return {
    instruction: tx("Which type of fruit?", "Welcher Fruchttyp?"),
    text: tx(`**${cap(en(f.name))}**: what type of fruit is it?`, `**${de(f.name)}**: Zu welchem Fruchttyp gehört diese Frucht?`),
    ...(f.pic ? { visual: visual(FlowerFruitSection, { fruit: f.pic, mode: "plain" as const }) } : {}),
    answer,
    hint: tx("Look at the fruit wall: all fleshy, fleshy with a hard stone, all hard, or dry and opening?", "Schau auf die Fruchtwand: ganz fleischig, fleischig mit hartem Steinkern, ganz hart oder trocken und aufspringend?"),
    solution: [{ math: join(q(f.name, "f"), "\\to", q(FRUIT_TYPES[f.type].name, "t")), note: tx(`${cap(en(FRUIT_TYPES[f.type].name))}: ${en(FRUIT_TYPES[f.type].rule)}.`, `${de(FRUIT_TYPES[f.type].name)}: ${de(FRUIT_TYPES[f.type].rule)}.`), highlight: ["t"] }],
    mistakes,
  };
}

export function fruitMatchTask(rng: Rng): Exercise {
  const types = some(rng, ["drupe", "berry", "nut", "capsule", "aggregateNut"] as FruitType[], 4);
  const fruits = types.map((t) => rng.pick(FRUIT_BANK.filter((f) => f.type === t)));
  const pairs: [Text, Text][] = fruits.map((f) => [capT(f.name), capT(FRUIT_TYPES[f.type].name)]);
  const mistakes: Mistake[] = [];
  const straw = fruits.find((f) => f.type === "aggregateNut");
  if (straw && types.includes("berry"))
    mistakes.push({ when: { kind: "match", pairs: [[capT(straw.name), capT(FRUIT_TYPES.berry.name)]] }, title: tx("Not a berry!", "Keine Beere!"), say: fruitSay("aggregateNut", "berry", straw.name)!.say });
  const drupe = fruits.find((f) => f.type === "drupe");
  if (drupe && types.includes("berry"))
    mistakes.push({ when: { kind: "match", pairs: [[capT(drupe.name), capT(FRUIT_TYPES.berry.name)]] }, title: tx("Feel for the stone", "Fühl nach dem Stein"), say: fruitSay("drupe", "berry", drupe.name)!.say });
  return {
    instruction: tx("Match each fruit with its type", "Ordne jeder Frucht ihren Fruchttyp zu"),
    text: tx("Which type of fruit is it?", "Welcher Fruchttyp ist es?"),
    answer: { kind: "match", pairs },
    hint: tx("Drupe: hard stone. Berry: all fleshy. Nut: all hard. Capsule: dry and opens. Strawberry: nutlets on a receptacle.", "Steinfrucht: harter Kern. Beere: ganz fleischig. Nuss: ganz hart. Kapsel: trocken, öffnet sich. Erdbeere: Nüsschen auf dem Blütenboden."),
    solution: [
      {
        math: tx(fruits.map((f, i) => `"${cap(en(f.name))}:"#n${i} "${en(FRUIT_TYPES[f.type].name)}"#t${i}`).join(" \\\\ "), fruits.map((f, i) => `"${de(f.name)}:"#n${i} "${de(FRUIT_TYPES[f.type].name)}"#t${i}`).join(" \\\\ ")),
        note: tx("The type depends on how the fruit wall is built.", "Der Typ hängt davon ab, wie die Fruchtwand gebaut ist."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Seeds

const SEED_WHERE: Record<SeedPart, Text> = {
  coat: tx("The seed coat is the tough skin around the whole seed.", "Die Samenschale ist die feste Haut um den ganzen Samen."),
  hilum: tx("The hilum is the small scar on the outside of the seed.", "Der Nabel ist die kleine Narbe außen am Samen."),
  cotyledon: tx("The cotyledons are the two big, thick halves of the bean.", "Die Keimblätter sind die zwei großen, dicken Hälften der Bohne."),
  plumule: tx("The shoot bud is the tiny pair of folded leaves of the embryo.", "Die Sprossknospe ist das winzige Paar gefalteter Blättchen am Keimling."),
  stem: tx("The embryonic stem is the short piece between the root and the shoot bud.", "Der Keimstängel ist das kurze Stück zwischen Wurzel und Sprossknospe."),
  radicle: tx("The embryonic root is the pointed tip of the embryo that points outwards.", "Die Keimwurzel ist die spitze Spitze des Keimlings, die nach außen zeigt."),
};

export function seedPartTask(rng: Rng, fixed?: SeedPart): Exercise {
  const maize = fixed === undefined && rng.chance(0.25);
  if (maize) {
    const ask = rng.pick(["endosperm", "cotyledon", "wall"] as const);
    const NAME = {
      endosperm: tx("Endosperm (nutritive tissue)", "Nährgewebe (Endosperm)"),
      cotyledon: tx("Cotyledon", "Keimblatt"),
      wall: tx("Fruit wall and seed coat", "Fruchtwand und Samenschale"),
      radicle: tx("Embryonic root", "Keimwurzel"),
    };
    const opts: Opt[] = [
      { text: NAME[ask] },
      ...(["endosperm", "cotyledon", "wall", "radicle"] as const)
        .filter((k) => k !== ask)
        .map((k) => ({
          text: NAME[k],
          ...(ask === "endosperm" && k === "cotyledon"
            ? { title: tx("One cotyledon only", "Nur ein Keimblatt"), say: tx("Maize has just one small cotyledon next to the embryo. The big white store is a tissue of its own.", "Mais hat nur ein kleines Keimblatt neben dem Keimling. Der große weiße Speicher ist ein eigenes Gewebe.") }
            : ask === "cotyledon" && k === "endosperm"
              ? { title: tx("The store is bigger", "Der Speicher ist größer"), say: tx("The nutritive tissue is the big white store. The marked part is the small leaf that takes food from it.", "Das Nährgewebe ist der große weiße Speicher. Der markierte Teil ist das kleine Blatt, das daraus Nährstoffe aufnimmt.") }
              : {}),
        })),
    ];
    const { answer, mistakes } = choice(rng, opts);
    return {
      instruction: tx("Name the part", "Benenne den Teil"),
      text: tx("A maize grain cut lengthwise. What is the part marked with **?**", "Ein Maiskorn, längs aufgeschnitten. Wie heißt der Teil mit dem **?**"),
      visual: visual(FlowerMaizeGrain, { mode: "numbers", ask, show: [ask], legend: "none" }),
      answer,
      hint: tx("Unlike the bean, maize stores its food outside the embryo, in a big tissue of its own.", "Anders als die Bohne speichert der Mais seine Nährstoffe außerhalb des Keimlings, in einem großen eigenen Gewebe."),
      solution: [{ math: q(NAME[ask], "a"), note: tx("Maize: one cotyledon, and a big endosperm full of starch. Fruit wall and seed coat are grown together.", "Mais: ein Keimblatt und ein großes Nährgewebe voller Stärke. Fruchtwand und Samenschale sind verwachsen.") }],
      mistakes,
    };
  }
  const id = fixed ?? rng.pick(["coat", "hilum", "cotyledon", "plumule", "stem", "radicle"] as SeedPart[]);
  const NEAR: Record<SeedPart, SeedPart[]> = {
    coat: ["cotyledon", "hilum", "plumule"],
    hilum: ["coat", "radicle", "plumule"],
    cotyledon: ["plumule", "coat", "radicle"],
    plumule: ["cotyledon", "radicle", "stem"],
    stem: ["radicle", "plumule", "cotyledon"],
    radicle: ["plumule", "stem", "cotyledon"],
  };
  const { answer, mistakes } = choice(rng, [
    { text: capT(SEED_PARTS[id].name) },
    ...NEAR[id].map((o) => ({
      text: capT(SEED_PARTS[o].name),
      title: o === "cotyledon" && id === "plumule" ? tx("Seed leaf vs true leaf", "Keimblatt oder Laubblatt?") : tx(`${cap(en(SEED_PARTS[o].name))}?`, `${de(SEED_PARTS[o].name)}?`),
      say: o === "cotyledon" && id === "plumule" ? tx("The cotyledons are the thick food stores. The first true leaves are still tiny and folded in the shoot bud.", "Die Keimblätter sind die dicken Nährstoffspeicher. Die ersten Laubblätter sind noch winzig und gefaltet in der Sprossknospe.") : tx(`Not quite. ${en(SEED_WHERE[o])}`, `Nicht ganz. ${de(SEED_WHERE[o])}`),
    })),
  ]);
  return {
    instruction: tx("Name the part", "Benenne den Teil"),
    text: tx("A bean seed, closed and opened. What is the part marked with **?**", "Ein Bohnensamen, geschlossen und aufgeklappt. Wie heißt der Teil mit dem **?**"),
    visual: visual(FlowerBeanSeed, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("The embryo has a root, a stem and a shoot bud. The two thick halves around it store food.", "Der Keimling hat Wurzel, Stängel und Sprossknospe. Die zwei dicken Hälften drumherum speichern Nährstoffe."),
    solution: [{ math: join(q(SEED_PARTS[id].name, "a"), ":", q(SEED_PARTS[id].job, "j")), note: SEED_WHERE[id], highlight: ["a"] }],
    mistakes,
  };
}

export function seedJobTask(rng: Rng): Exercise {
  const ids = some(rng, ["coat", "cotyledon", "plumule", "radicle", "stem"] as SeedPart[], 4);
  const pairs: [Text, Text][] = ids.map((i) => [capT(SEED_PARTS[i].name), SEED_PARTS[i].job]);
  const mistakes: Mistake[] = [];
  if (ids.includes("cotyledon") && ids.includes("plumule"))
    mistakes.push({
      when: { kind: "match", pairs: [[capT(SEED_PARTS.cotyledon.name), SEED_PARTS.plumule.job]] },
      title: tx("Seed leaf vs true leaf", "Keimblatt oder Laubblatt?"),
      say: tx("Cotyledons aren't the first true leaves. They are food stores and shrivel later. The true leaves grow from the shoot bud.", "Keimblätter sind nicht die ersten Laubblätter. Sie sind Nährstoffspeicher und schrumpfen später. Die Laubblätter wachsen aus der Sprossknospe."),
    });
  if (ids.includes("coat") && ids.includes("cotyledon"))
    mistakes.push({
      when: { kind: "match", pairs: [[capT(SEED_PARTS.coat.name), SEED_PARTS.cotyledon.job]] },
      title: tx("Skin vs store", "Hülle oder Speicher?"),
      say: tx("The seed coat is only a thin protective skin. The food is stored in the thick cotyledons.", "Die Samenschale ist nur eine dünne Schutzhülle. Die Nährstoffe stecken in den dicken Keimblättern."),
    });
  return {
    instruction: tx("Match each part of the seed with its job", "Ordne jedem Teil des Samens seine Aufgabe zu"),
    text: tx("The parts of a bean seed:", "Die Teile eines Bohnensamens:"),
    answer: { kind: "match", pairs },
    hint: tx("Protection, food store, and the three parts of the embryo: root, stem, shoot bud.", "Schutz, Nährstoffspeicher und die drei Teile des Keimlings: Wurzel, Stängel, Sprossknospe."),
    solution: [
      {
        math: tx(ids.map((p, i) => `"${cap(en(SEED_PARTS[p].name))}:"#n${i} "${en(SEED_PARTS[p].job)}"#j${i}`).join(" \\\\ "), ids.map((p, i) => `"${de(SEED_PARTS[p].name)}:"#n${i} "${de(SEED_PARTS[p].job)}"#j${i}`).join(" \\\\ ")),
        note: tx("The embryo is the tiny plant. Coat and cotyledons protect and feed it.", "Der Keimling ist die winzige Pflanze. Schale und Keimblätter schützen und ernähren ihn."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Germination experiment and order

const dishById = (id: string) => DISHES.find((d) => d.id === id)!;

export function germExperimentTask(rng: Rng, fixedKind?: number): Exercise {
  const kind = fixedKind ?? rng.int(0, 3);
  if (kind === 0) {
    const ids = ["B", ...some(rng, ["A", "C", "D", "E"], rng.int(2, 3))].sort();
    const opts: MultiOpt[] = ids.map((id) => ({ text: tx(`Dish ${id}`, `Schale ${id}`), ok: germinates(dishById(id)) }));
    const okIdx = ids.map((id, i) => (germinates(dishById(id)) ? i : -1)).filter((i) => i >= 0);
    const slips: MultiSlip[] = [];
    if (ids.includes("D"))
      slips.push({ pick: [...okIdx, ids.indexOf("D")], title: tx("Water isn't everything", "Wasser ist nicht alles"), say: tx("Under water the seeds have plenty of water, but they can't get any oxygen.", "Unter Wasser haben die Samen zwar genug Wasser, aber sie bekommen keinen Sauerstoff.") });
    if (ids.includes("E"))
      slips.push({ pick: okIdx.filter((i) => ids[i] !== "E"), title: tx("Seeds germinate in the dark", "Samen keimen im Dunkeln"), say: tx("Most seeds don't need light to germinate. Think about it: in the soil it's dark too.", "Die meisten Samen brauchen zum Keimen kein Licht. Überleg mal: Im Boden ist es auch dunkel.") });
    if (ids.includes("C"))
      slips.push({ pick: [...okIdx, ids.indexOf("C")], title: tx("Too cold", "Zu kalt"), say: tx("Moist is good, but at 4 °C the seeds' enzymes work far too slowly. They need warmth.", "Feucht ist gut, aber bei 4 °C arbeiten die Enzyme im Samen viel zu langsam. Sie brauchen Wärme.") });
    const { answer, mistakes } = multi(rng, opts, slips);
    return {
      instruction: tx("Germination experiment", "Keimungsversuch"),
      text: tx("Bean seeds are kept in dishes under different conditions for a week. In which dishes do they germinate?", "Bohnensamen liegen eine Woche lang unter verschiedenen Bedingungen. In welchen Schalen keimen sie?"),
      visual: visual(FlowerGermDishes, { ids }),
      answer,
      hint: tx("Seeds need water, warmth and oxygen. Do they need light?", "Samen brauchen Wasser, Wärme und Sauerstoff. Brauchen sie auch Licht?"),
      solution: [
        {
          math: tx(ids.filter((id) => germinates(dishById(id))).map((id) => `"Dish ${id}"`).join(" , "), ids.filter((id) => germinates(dishById(id))).map((id) => `"Schale ${id}"`).join(" , ")),
          note: tx("Only where it is moist and warm and air can reach the seeds. Light doesn't matter.", "Nur dort, wo es feucht und warm ist und Luft an die Samen kommt. Licht spielt keine Rolle."),
        },
      ],
      mistakes,
    };
  }
  const QS = [
    {
      ask: tx("Which two dishes show that seeds need **oxygen** to germinate?", "Welche zwei Schalen zeigen, dass Samen zum Keimen **Sauerstoff** brauchen?"),
      right: tx("B and D", "B und D"),
      wrong: [
        { text: tx("A and B", "A und B"), title: tx("That's water", "Das ist Wasser"), say: tx("A and B differ only in water. Find the pair that differs only in air.", "A und B unterscheiden sich nur im Wasser. Such das Paar, das sich nur in der Luft unterscheidet.") },
        { text: tx("B and C", "B und C"), title: tx("That's temperature", "Das ist Temperatur"), say: tx("B and C differ only in temperature.", "B und C unterscheiden sich nur in der Temperatur.") },
        { text: tx("B and E", "B und E"), title: tx("That's light", "Das ist Licht"), say: tx("B and E differ only in light.", "B und E unterscheiden sich nur im Licht.") },
      ],
      note: tx("B and D differ in one thing only: under water, no air reaches the seeds. D doesn't germinate, so oxygen is needed.", "B und D unterscheiden sich nur in einem: Unter Wasser kommt keine Luft an die Samen. D keimt nicht, also wird Sauerstoff gebraucht."),
    },
    {
      ask: tx("What does comparing dish B with dish E show? (Both germinate.)", "Was zeigt der Vergleich von Schale B mit Schale E? (Beide keimen.)"),
      right: tx("Light is not needed for germination.", "Licht ist zum Keimen nicht nötig."),
      wrong: [
        { text: tx("Seeds need light to germinate.", "Samen brauchen zum Keimen Licht."), title: tx("Both germinated", "Beide haben gekeimt"), say: tx("E was dark and still germinated. So light can't be necessary.", "E stand im Dunkeln und hat trotzdem gekeimt. Licht kann also nicht nötig sein.") },
        { text: tx("Seeds need warmth.", "Samen brauchen Wärme.") },
        { text: tx("Seeds need oxygen.", "Samen brauchen Sauerstoff.") },
      ],
      note: tx("B and E differ only in light, and both germinate: light isn't needed. (In the soil it's dark, too.)", "B und E unterscheiden sich nur im Licht, und beide keimen: Licht ist nicht nötig. (Im Boden ist es ja auch dunkel.)"),
    },
    {
      ask: tx("Why don't the seeds in dish D germinate, although they have plenty of water?", "Warum keimen die Samen in Schale D nicht, obwohl sie reichlich Wasser haben?"),
      right: tx("Under water they lack oxygen.", "Unter Wasser fehlt ihnen der Sauerstoff."),
      wrong: [
        { text: tx("It's too cold.", "Es ist zu kalt."), title: tx("20 °C is warm enough", "20 °C sind warm genug"), say: tx("Dish D is at 20 °C, just like B. The difference is something else.", "Schale D steht bei 20 °C, genau wie B. Der Unterschied ist ein anderer.") },
        { text: tx("They get too much light.", "Sie bekommen zu viel Licht."), title: tx("Light doesn't matter", "Licht spielt keine Rolle"), say: tx("Light neither helps nor stops germination here: B is just as light.", "Licht hilft und stört hier nicht: B steht genauso hell.") },
        { text: tx("Water makes the seed coat too hard.", "Wasser macht die Samenschale zu hart.") },
      ],
      note: tx("Seeds respire while germinating: they need oxygen. Under water, hardly any reaches them.", "Beim Keimen atmen die Samen: Sie brauchen Sauerstoff. Unter Wasser kommt kaum welcher an."),
    },
  ];
  const Q = QS[kind - 1];
  const { answer, mistakes } = choice(rng, [{ text: Q.right }, ...Q.wrong]);
  return {
    instruction: tx("Germination experiment", "Keimungsversuch"),
    text: tx(`Bean seeds were kept in five dishes for a week. Seeds germinated in B and E only. ${en(Q.ask)}`, `Bohnensamen lagen eine Woche lang in fünf Schalen. Nur in B und E haben sie gekeimt. ${de(Q.ask)}`),
    visual: visual(FlowerGermDishes, { ids: ["A", "B", "C", "D", "E"] }),
    answer,
    hint: tx("Compare two dishes that differ in only one condition.", "Vergleich zwei Schalen, die sich nur in einer Bedingung unterscheiden."),
    solution: [{ math: q(Q.right, "a"), note: Q.note }],
    mistakes,
  };
}

const GERM_SHORT: Text[] = [
  tx("swelling", "Quellung"),
  tx("root breaks out", "Keimwurzel bricht heraus"),
  tx("hooked stem", "Keimstängel als Haken"),
  tx("cotyledons above ground", "Keimblätter über der Erde"),
  tx("true leaves unfold", "Laubblätter entfalten sich"),
  tx("cotyledons shrivel", "Keimblätter schrumpfen"),
];

export function germOrderTask(rng: Rng): Exercise {
  const n = rng.int(4, 5);
  const start = rng.int(0, GERM_CHAIN.length - n);
  const idx = Array.from({ length: n }, (_, i) => start + i);
  const mistakes: Mistake[] = [];
  if (idx.includes(1) && idx.includes(2))
    mistakes.push({ when: { kind: "order", items: [GERM_CHAIN[2], GERM_CHAIN[1]] }, title: tx("Root first", "Erst die Wurzel"), say: tx("The root comes out first: the seedling needs water and a hold before the shoot pushes up.", "Die Wurzel kommt zuerst: Der Keimling braucht Wasser und Halt, bevor der Spross nach oben drängt.") });
  if (idx.includes(4) && idx.includes(5))
    mistakes.push({ when: { kind: "order", items: [GERM_CHAIN[5], GERM_CHAIN[4]] }, title: tx("Stores until the leaves work", "Speicher, bis die Blätter arbeiten"), say: tx("The cotyledons feed the seedling until the true leaves can make food. Only then do they shrivel.", "Die Keimblätter ernähren den Keimling, bis die Laubblätter selbst Nährstoffe herstellen. Erst dann schrumpfen sie.") });
  if (idx.includes(0) && idx.includes(1))
    mistakes.push({ when: { kind: "order", items: [GERM_CHAIN[1], GERM_CHAIN[0]] }, title: tx("Swelling first", "Erst quellen"), say: tx("A dry seed is hard and resting. It first has to soak up water before anything can break out.", "Ein trockener Samen ist hart und ruht. Er muss erst Wasser aufnehmen, bevor etwas herausbrechen kann.") });
  return {
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx("How a bean seed germinates:", "So keimt ein Bohnensamen:"),
    answer: { kind: "order", items: idx.map((i) => GERM_CHAIN[i]) },
    hint: tx("Water first, then the root, then the shoot.", "Erst Wasser, dann die Wurzel, dann der Spross."),
    solution: [
      {
        math: tx(idx.map((i, k) => `"${k + 1}."#k${k} "${en(GERM_SHORT[i])}"#s${k}`).join(" \\\\ "), idx.map((i, k) => `"${k + 1}."#k${k} "${de(GERM_SHORT[i])}"#s${k}`).join(" \\\\ ")),
        note: tx("Swelling, root, hooked stem, cotyledons in the light, true leaves. The cotyledons shrivel last.", "Quellung, Wurzel, hakenförmiger Stängel, Keimblätter ans Licht, Laubblätter. Zuletzt schrumpfen die Keimblätter."),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Vegetative reproduction

export function vegMatchTask(rng: Rng): Exercise {
  const organs = some(rng, ["runner", "tuber", "bulb", "cutting", "rhizome", "plantlets"] as Vegetative[], 4);
  const plants = organs.map((o) => rng.pick(VEG_PLANTS.filter((p) => p.how === o)));
  const pairs: [Text, Text][] = plants.map((p) => [capT(p.name), capT(VEG_ORGANS[p.how].name)]);
  const mistakes: Mistake[] = [];
  const bulb = plants.find((p) => p.how === "bulb");
  if (bulb && organs.includes("tuber"))
    mistakes.push({
      when: { kind: "match", pairs: [[capT(bulb.name), capT(VEG_ORGANS.tuber.name)]] },
      title: tx("Bulb vs tuber", "Zwiebel oder Knolle?"),
      say: tx("Cut it open in your head: a bulb has layers of thick storage leaves. A tuber is a solid, thickened shoot.", "Schneid sie im Kopf auf: Eine Zwiebel hat Schichten aus dicken Speicherblättern. Eine Knolle ist ein massiver, verdickter Spross."),
    });
  const potato = plants.find((p) => en(p.name) === "potato");
  if (potato && organs.includes("bulb"))
    mistakes.push({
      when: { kind: "match", pairs: [[capT(potato.name), capT(VEG_ORGANS.bulb.name)]] },
      title: tx("No layers", "Keine Schichten"),
      say: tx("A potato has no layers of leaves inside. It's a solid store with little buds, the eyes.", "Eine Kartoffel hat innen keine Blattschichten. Sie ist ein massiver Speicher mit kleinen Knospen, den Augen."),
    });
  return {
    instruction: tx("Match each plant with its way of reproducing", "Ordne jeder Pflanze ihre Art der Vermehrung zu"),
    text: tx("These plants also reproduce without seeds. How?", "Diese Pflanzen vermehren sich auch ohne Samen. Wie?"),
    answer: { kind: "match", pairs },
    hint: tx("Runners creep above ground, tubers and rhizomes are underground shoots, bulbs have layers, cuttings are cut off.", "Ausläufer kriechen oberirdisch, Knollen und Erdsprosse sind unterirdische Sprosse, Zwiebeln haben Schichten, Stecklinge werden abgeschnitten."),
    solution: [
      {
        math: tx(plants.map((p, i) => `"${cap(en(p.name))}:"#n${i} "${en(VEG_ORGANS[p.how].name)}"#o${i}`).join(" \\\\ "), plants.map((p, i) => `"${de(p.name)}:"#n${i} "${de(VEG_ORGANS[p.how].name)}"#o${i}`).join(" \\\\ ")),
        note: tx("A part of the plant grows into a new plant: no flower, no seed.", "Ein Teil der Pflanze wächst zu einer neuen Pflanze heran: ohne Blüte, ohne Samen."),
      },
    ],
    mistakes,
  };
}

export function potatoTask(rng: Rng): Exercise {
  const { answer, mistakes } = choice(rng, [
    { text: tx("A thickened underground shoot", "Ein verdickter unterirdischer Spross") },
    {
      text: tx("A thickened root", "Eine verdickte Wurzel"),
      title: tx("Look at the eyes", "Schau auf die Augen"),
      say: tx("Classic mix-up! It grows underground, but it has eyes: buds that sprout shoots with leaves. Roots never have buds like that.", "Klassische Verwechslung! Sie wächst zwar unter der Erde, hat aber Augen: Knospen, aus denen Sprosse mit Blättern treiben. Wurzeln haben nie solche Knospen."),
    },
    {
      text: tx("The fruit of the potato plant", "Die Frucht der Kartoffelpflanze"),
      title: tx("Fruits grow from flowers", "Früchte entstehen aus Blüten"),
      say: tx("Fruits grow from flowers. The potato plant does have fruits: small green berries above ground (poisonous!).", "Früchte entstehen aus Blüten. Die Kartoffel hat tatsächlich Früchte: kleine grüne Beeren über der Erde (giftig!)."),
    },
    { text: tx("A large seed", "Ein großer Samen"), title: tx("No seed", "Kein Samen"), say: tx("A seed comes from an ovule after fertilisation. The tuber forms without any flower.", "Ein Samen entsteht nach der Befruchtung aus einer Samenanlage. Die Knolle bildet sich ganz ohne Blüte.") },
  ]);
  return {
    instruction: tx("What is a potato?", "Was ist eine Kartoffel?"),
    text: tx("New potato plants can grow from a potato tuber. What is the tuber, biologically?", "Aus einer Kartoffelknolle wachsen neue Kartoffelpflanzen. Was ist die Knolle biologisch gesehen?"),
    answer,
    hint: tx("Look at the eyes on a potato: what grows out of them?", "Schau dir die Augen einer Kartoffel an: Was wächst aus ihnen heraus?"),
    solution: [{ math: q(tx("tuber = shoot", "Knolle = Spross"), "a"), note: tx("The eyes are buds, and only shoots have buds: the tuber is a thickened underground shoot full of starch.", "Die Augen sind Knospen, und Knospen hat nur ein Spross: Die Knolle ist ein verdickter unterirdischer Spross voller Stärke.") }],
    mistakes,
  };
}

const VEG_TRUE: Text[] = [
  tx("The offspring have the same genes as the mother plant (clones).", "Die Nachkommen sind erbgleich mit der Mutterpflanze (Klone)."),
  tx("No pollination is needed.", "Es ist keine Bestäubung nötig."),
  tx("A plant can spread quickly this way.", "Eine Pflanze kann sich so schnell ausbreiten."),
  tx("Good features of the mother plant are kept exactly.", "Gute Eigenschaften der Mutterpflanze bleiben genau erhalten."),
];
const VEG_FALSE: { text: Text; title: Text; say: Text }[] = [
  { text: tx("The offspring are genetically varied.", "Die Nachkommen sind genetisch vielfältig."), title: tx("All the same", "Alle gleich"), say: tx("No sex cells fuse, so nothing gets mixed: the offspring are genetic copies.", "Es verschmelzen keine Keimzellen, also wird nichts gemischt: Die Nachkommen sind genetische Kopien.") },
  { text: tx("Seeds are formed in the process.", "Dabei werden Samen gebildet."), title: tx("No seeds", "Keine Samen"), say: tx("Seeds need flowers and fertilisation. Here a part of the plant simply grows on.", "Samen brauchen Blüte und Befruchtung. Hier wächst einfach ein Teil der Pflanze weiter.") },
  { text: tx("The offspring are better protected against new diseases.", "Die Nachkommen sind besser gegen neue Krankheiten geschützt."), title: tx("The opposite", "Das Gegenteil"), say: tx("If all plants are clones, a disease that hits one can hit all of them. That's the big disadvantage.", "Sind alle Pflanzen Klone, kann eine Krankheit, die eine trifft, alle treffen. Das ist der große Nachteil.") },
];

export function vegStatementsTask(rng: Rng): Exercise {
  const trues = some(rng, VEG_TRUE, 2);
  const falses = some(rng, VEG_FALSE, 2);
  const opts: MultiOpt[] = [...trues.map((t) => ({ text: t, ok: true })), ...falses.map((f) => ({ text: f.text, ok: false }))];
  const slips: MultiSlip[] = falses.map((f, k) => ({ pick: [0, 1, 2 + k], title: f.title, say: f.say }));
  const { answer, mistakes } = multi(rng, opts, slips);
  return {
    instruction: tx("Which statements are true?", "Welche Aussagen stimmen?"),
    text: tx("About vegetative (asexual) reproduction, for example with runners or tubers:", "Über die ungeschlechtliche (vegetative) Vermehrung, zum Beispiel durch Ausläufer oder Knollen:"),
    answer,
    hint: tx("No sex cells fuse. What does that mean for the genes of the offspring?", "Es verschmelzen keine Keimzellen. Was heißt das für die Erbanlagen der Nachkommen?"),
    solution: [{ math: q(tx("offspring = clones", "Nachkommen = Klone"), "a"), note: tx(`True: ${trues.map(en).join(" ")}`, `Richtig: ${trues.map(de).join(" ")}`) }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  switch (rng.int(0, 13)) {
    case 0:
      return featuresTask(rng);
    case 1:
      return classifyTask(rng);
    case 2:
      return selfCrossTask(rng);
    case 3:
      return selfCrossWhyTask(rng);
    case 4:
      return tubeOrderTask(rng);
    case 5:
      return fruitTypeTask(rng);
    case 6:
      return fruitMatchTask(rng);
    case 7:
      return seedPartTask(rng);
    case 8:
      return seedJobTask(rng);
    case 9:
      return germExperimentTask(rng);
    case 10:
      return germOrderTask(rng);
    case 11:
      return vegMatchTask(rng);
    case 12:
      return potatoTask(rng);
    default:
      return vegStatementsTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const adaptFrames: Frame[] = [
  {
    math: tx('"insect flower:"#i \\; "colour, scent, nectar"#ia', '"Insektenblüte:"#i \\; "Farbe, Duft, Nektar"#ia'),
    note: tx("Insect flowers **advertise**: bright colours and scent lure insects, nectar rewards them. Their pollen is sticky and clings to the insect's fur.", "Insektenblüten **werben**: Leuchtende Farben und Duft locken Insekten an, Nektar belohnt sie. Ihr Pollen ist klebrig und haftet im Pelz der Insekten."),
    highlight: ["ia"],
  },
  {
    math: tx('"insect flower:"#i \\; "colour, scent, nectar"#ia \\\\ "wind flower:"#w \\; "plain, masses of pollen"#wa', '"Insektenblüte:"#i \\; "Farbe, Duft, Nektar"#ia \\\\ "Windblüte:"#w \\; "unscheinbar, Massen von Pollen"#wa'),
    note: tx("Wind flowers save themselves the advert. Instead they make **millions** of light, dry pollen grains: most of them are lost in the wind.", "Windblüten sparen sich die Werbung. Dafür bilden sie **Millionen** leichter, trockener Pollenkörner: Die meisten gehen im Wind verloren."),
    highlight: ["wa"],
  },
  {
    math: tx('"wind flower:"#w \\; "feathery stigmas, dangling anthers"#wb', '"Windblüte:"#w \\; "federige Narben, hängende Staubbeutel"#wb'),
    note: tx("Big feathery stigmas work like a net that fishes pollen out of the air. The anthers dangle far out into the wind.", "Große, federartige Narben wirken wie ein Netz, das Pollen aus der Luft fischt. Die Staubbeutel hängen weit heraus in den Wind."),
    highlight: ["wb"],
  },
  {
    math: tx('"hazel, alder:"#h \\; "flowers before the leaves"#hb', '"Hasel, Erle:"#h \\; "Blüte vor dem Laub"#hb'),
    note: tx("Hazel and alder flower as early as February, long before their leaves come out: no leaves get in the pollen's way. Bad luck for people with hay fever!", "Hasel und Erle blühen schon im Februar, lange bevor ihre Blätter austreiben: So bremst kein Laub den Pollenflug. Pech für Menschen mit Heuschnupfen!"),
  },
];

const selfFrames: Frame[] = [
  {
    math: tx('"self-pollination:"#s \\; "the same plant"#sa', '"Selbstbestäubung:"#s \\; "dieselbe Pflanze"#sa'),
    note: tx("**Self-pollination**: pollen reaches the stigma of the same flower or of another flower on the same plant.", "**Selbstbestäubung**: Pollen gelangt auf die Narbe derselben Blüte oder einer anderen Blüte derselben Pflanze."),
  },
  {
    math: tx('"self-pollination:"#s \\; "the same plant"#sa \\\\ "cross-pollination:"#f \\; "another plant, same species"#fa', '"Selbstbestäubung:"#s \\; "dieselbe Pflanze"#sa \\\\ "Fremdbestäubung:"#f \\; "andere Pflanze, gleiche Art"#fa'),
    note: tx("**Cross-pollination**: the pollen comes from another plant of the same species.", "**Fremdbestäubung**: Der Pollen stammt von einer anderen Pflanze derselben Art."),
    highlight: ["fa"],
  },
  {
    math: tx('"cross:"#f \\; "genes mixed"#fx \\to "variety"#fv', '"fremd:"#f \\; "Erbanlagen gemischt"#fx \\to "Vielfalt"#fv'),
    note: tx("Advantage of cross-pollination: the genes of two plants are mixed anew. The offspring are more varied and some may cope better with change.", "Vorteil der Fremdbestäubung: Die Erbanlagen zweier Pflanzen werden neu gemischt. Die Nachkommen sind vielfältiger, manche kommen mit Veränderungen besser zurecht."),
    highlight: ["fv"],
  },
  {
    math: tx('"self:"#s \\; "no partner needed"#sx', '"selbst:"#s \\; "kein Partner nötig"#sx'),
    note: tx("Advantage of self-pollination: it works without pollinators and without neighbours. Disadvantage: hardly any new variety.", "Vorteil der Selbstbestäubung: Es klappt ohne Bestäuber und ohne Nachbarn. Nachteil: kaum neue Vielfalt."),
  },
  {
    math: tx('"against selfing:"#g \\; "different timing, separate sexes"#gx', '"gegen Selbstbestäubung:"#g \\; "versetzte Reife, getrennte Geschlechter"#gx'),
    note: tx("Many plants prevent self-pollination: anthers and stigma ripen at different times (sage), or male and female flowers are separate (hazel, maize) or even on separate plants (willow).", "Viele Pflanzen verhindern Selbstbestäubung: Staubbeutel und Narbe reifen zu verschiedenen Zeiten (Salbei), oder männliche und weibliche Blüten sind getrennt (Hasel, Mais), manchmal sogar auf verschiedenen Pflanzen (Weide)."),
  },
];

const vegFrames: Frame[] = [
  {
    math: tx('"strawberry:"#a \\; "runners"#av', '"Erdbeere:"#a \\; "Ausläufer"#av'),
    note: tx("The strawberry forms **runners**: long side shoots above ground. Where they touch the soil, new plants take root.", "Die Erdbeere bildet **Ausläufer**: lange oberirdische Seitensprosse. Wo sie den Boden berühren, wurzeln neue Pflanzen."),
  },
  {
    math: tx('"strawberry:"#a \\; "runners"#av \\\\ "potato:"#b \\; "tubers"#bv', '"Erdbeere:"#a \\; "Ausläufer"#av \\\\ "Kartoffel:"#b \\; "Knollen"#bv'),
    note: tx("The potato forms **tubers**: thickened underground **shoots** (not roots!) full of starch. Each eye is a bud that can sprout.", "Die Kartoffel bildet **Knollen**: verdickte unterirdische **Sprosse** (keine Wurzeln!) voller Stärke. Jedes Auge ist eine Knospe, die austreiben kann."),
  },
  {
    math: tx('"strawberry:"#a \\; "runners"#av \\\\ "potato:"#b \\; "tubers"#bv \\\\ "tulip:"#c \\; "bulbs"#cv', '"Erdbeere:"#a \\; "Ausläufer"#av \\\\ "Kartoffel:"#b \\; "Knollen"#bv \\\\ "Tulpe:"#c \\; "Zwiebeln"#cv'),
    note: tx("Tulips and onions form **bulbs** with daughter bulbs. Gardeners also take **cuttings**: cut-off shoots that grow roots (geranium, willow).", "Tulpen und Küchenzwiebeln bilden **Zwiebeln** mit Tochterzwiebeln. Gärtner schneiden außerdem **Stecklinge**: abgeschnittene Triebe, die Wurzeln bilden (Geranie, Weide)."),
  },
  {
    math: tx('"offspring"#o = "clones"#k', '"Nachkommen"#o = "Klone"#k'),
    note: tx("No sex cells fuse: all offspring have the same genes as the mother plant. Fast and safe, but no variety: one disease can wipe out them all.", "Es verschmelzen keine Keimzellen: Alle Nachkommen sind erbgleich mit der Mutterpflanze. Schnell und sicher, aber ohne Vielfalt: Eine Krankheit kann alle treffen."),
    highlight: ["k"],
  },
];

function WindInsectWidget() {
  return <FlowerWindInsect />;
}
function PollenTubeWidget() {
  return <FlowerPollenTube />;
}

const checkWind = featuresTask(createRng(21), "wind");
const checkTube = tubeOrderTask(createRng(4), 1, 5);
const checkGerm = germExperimentTask(createRng(9), 1);
const checkPotato = potatoTask(createRng(2));

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Advert or wind?", "Werbung oder Wind?"),
      blob: tx("Flowers are built for their postman: insect or wind?", "Blüten sind an ihren Briefträger angepasst: Insekt oder Wind?"),
      body: tx("How a flower looks depends on who carries its pollen. Compare the two strategies.", "Wie eine Blüte aussieht, hängt davon ab, wer ihren Pollen transportiert. Vergleich die zwei Strategien."),
      frames: adaptFrames,
    },
    {
      type: "widget",
      title: tx("Insect flower or wind flower", "Insektenblüte oder Windblüte"),
      blob: tx("Switch between the two and watch the flower change. Then blow!", "Schalte zwischen beiden um und schau, wie sich die Blüte verwandelt. Dann puste!"),
      body: tx("Toggle the flower type. Every feature of the flower changes with it: petals, pollen, stamens and stigma.", "Wechsle den Blütentyp. Mit ihm ändert sich jedes Merkmal: Kronblätter, Pollen, Staubblätter und Narbe."),
      widget: WindInsectWidget,
    },
    { type: "check", blob: tx("Careful: one of the classic traps is in here!", "Vorsicht: Hier steckt eine klassische Falle drin!"), exercise: checkWind },
    {
      type: "explain",
      title: tx("Self- or cross-pollination?", "Selbst- oder Fremdbestäubung?"),
      blob: tx("Whose pollen is it? That makes a big difference.", "Wessen Pollen ist das? Das macht einen großen Unterschied."),
      frames: selfFrames,
    },
    {
      type: "widget",
      title: tx("The pollen tube", "Der Pollenschlauch"),
      blob: tx("A journey through the style! Step through it.", "Eine Reise durch den Griffel! Geh sie Schritt für Schritt durch."),
      body: tx(
        "After pollination the pollen grain germinates. Its pollen tube carries the sperm cell to the egg cell in the ovule. Step through with the arrows.",
        "Nach der Bestäubung keimt das Pollenkorn. Sein Pollenschlauch bringt die Spermazelle zur Eizelle in der Samenanlage. Geh mit den Pfeilen Schritt für Schritt durch.",
      ),
      widget: PollenTubeWidget,
    },
    { type: "check", blob: tx("Can you retell the journey?", "Kannst du die Reise nacherzählen?"), exercise: checkTube },
    {
      type: "widget",
      title: tx("Types of fruit", "Fruchttypen"),
      blob: tx("Fruit salad time! But which of these is a real berry?", "Zeit für Obstsalat! Aber was davon ist eine echte Beere?"),
      body: tx(
        "Fruits are sorted by their **fruit wall**, which grew from the wall of the ovary. Tap through the fruits and their parts.",
        "Früchte werden nach ihrer **Fruchtwand** sortiert, die aus der Wand des Fruchtknotens entstanden ist. Tipp dich durch die Früchte und ihre Teile.",
      ),
      widget: FlowerFruits,
    },
    {
      type: "widget",
      title: tx("Seed and germination", "Samen und Keimung"),
      blob: tx("A whole plant in a tiny packet, with a lunch box!", "Eine ganze Pflanze in einem winzigen Päckchen, mit Brotdose!"),
      body: tx(
        "A seed contains the **embryo** (a tiny plant with root, stem and shoot bud), a **food store** (cotyledons in the bean, nutritive tissue in maize) and the protective **seed coat**. Then watch a bean germinate.",
        "Ein Samen enthält den **Keimling** (eine winzige Pflanze mit Wurzel, Stängel und Sprossknospe), einen **Nährstoffspeicher** (Keimblätter bei der Bohne, Nährgewebe beim Mais) und die schützende **Samenschale**. Dann schau einer Bohne beim Keimen zu.",
      ),
      widget: FlowerSeed,
    },
    { type: "check", blob: tx("Time for a proper experiment!", "Zeit für ein richtiges Experiment!"), exercise: checkGerm },
    {
      type: "explain",
      title: tx("Without flowers: vegetative reproduction", "Ohne Blüte: ungeschlechtliche Vermehrung"),
      blob: tx("Some plants just clone themselves. Handy!", "Manche Pflanzen klonen sich einfach selbst. Praktisch!"),
      frames: vegFrames,
    },
    { type: "check", blob: tx("A famous trick question about chips!", "Eine berühmte Fangfrage über Pommes!"), exercise: checkPotato },
  ],
  summary: [
    {
      title: tx("Insect and wind flowers", "Insekten- und Windblüten"),
      body: tx(
        "Insect flowers: colourful, scented, nectar, sticky pollen (cherry, rapeseed). Wind flowers: plain, no nectar, masses of light pollen, large feathery stigmas, dangling anthers (hazel, grasses).",
        "Insektenblüten: bunt, duftend, Nektar, klebriger Pollen (Kirsche, Raps). Windblüten: unscheinbar, kein Nektar, Massen leichter Pollen, große federige Narben, hängende Staubbeutel (Hasel, Gräser).",
      ),
      tone: "rule",
    },
    {
      title: tx("Self- and cross-pollination", "Selbst- und Fremdbestäubung"),
      body: tx("Cross: genes of two plants mixed, more variety. Self: works alone, but little variety.", "Fremd: Erbanlagen zweier Pflanzen gemischt, mehr Vielfalt. Selbst: klappt allein, aber wenig Vielfalt."),
      examples: [tx('"pollen tube" \\to "micropyle" \\to "zygote"', '"Pollenschlauch" \\to "Mikropyle" \\to "Zygote"')],
      tone: "rule",
    },
    {
      title: tx("Types of fruit", "Fruchttypen"),
      body: tx(
        "Drupe: fleshy with a hard stone (cherry). Berry: all fleshy (tomato, grape). Nut: all hard (hazelnut). Capsule: dry, opens (poppy). Strawberry: nutlets on a fleshy receptacle. Legume: pod (pea).",
        "Steinfrucht: fleischig mit hartem Steinkern (Kirsche). Beere: ganz fleischig (Tomate, Weintraube). Nuss: ganz hart (Haselnuss). Kapsel: trocken, öffnet sich (Mohn). Erdbeere: Nüsschen auf fleischigem Blütenboden. Hülse: Erbse, Bohne.",
      ),
      tone: "tip",
    },
    {
      title: tx("Seed and germination", "Samen und Keimung"),
      body: tx("Seed = seed coat + food store (cotyledons or endosperm) + embryo (root, stem, shoot bud).", "Samen = Samenschale + Nährstoffspeicher (Keimblätter oder Nährgewebe) + Keimling (Wurzel, Stängel, Sprossknospe)."),
      examples: [tx('"germination:" \\; "water + warmth + oxygen"', '"Keimung:" \\; "Wasser + Wärme + Sauerstoff"')],
      tone: "rule",
    },
    {
      title: tx("Vegetative reproduction", "Ungeschlechtliche Vermehrung"),
      body: tx("Runners (strawberry), tubers (potato), bulbs (tulip), cuttings (geranium): offspring are clones of the mother plant.", "Ausläufer (Erdbeere), Knollen (Kartoffel), Zwiebeln (Tulpe), Stecklinge (Geranie): Die Nachkommen sind Klone der Mutterpflanze."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Wind flowers are plain, not colourful. The strawberry is not a berry. The potato tuber is a shoot, not a root. Seeds germinate in the dark too.",
        "Windblüten sind unscheinbar, nicht bunt. Die Erdbeere ist keine Beere. Die Kartoffelknolle ist ein Spross, keine Wurzel. Samen keimen auch im Dunkeln.",
      ),
      tone: "warning",
    },
  ],
};
