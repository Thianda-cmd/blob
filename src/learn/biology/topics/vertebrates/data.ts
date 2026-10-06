// Facts for the "vertebrates" topic: the five classes, a curated animal bank with the traps
// students fall into (whale = fish, bat = bird, crocodile = amphibian...), features, and
// invertebrates for "vertebrate or not?". Shared by the three levels and the widgets.

import { tx, type Text } from "@/i18n/text";

export type ClassId = "fish" | "amph" | "rept" | "bird" | "mammal";
export const CLASS_IDS: ClassId[] = ["fish", "amph", "rept", "bird", "mammal"];

export type VClass = {
  /** Plural, as in "the class of the ..." (Fische, Säugetiere). */
  name: Text;
  /** Singular with article, for sentences ("a mammal" / "ein Säugetier"). */
  one: Text;
  /** Accepted spellings for word answers. */
  accept: Text[];
  skin: Text;
  breath: Text;
  temp: Text;
  young: Text;
  extra: Text;
  /** One sentence that tests a picked class against an animal (used in Blob's notes). */
  test: Text;
};

export const CLASSES: Record<ClassId, VClass> = {
  fish: {
    name: tx("Fish", "Fische"),
    one: tx("a fish", "ein Fisch"),
    accept: [tx("fish", "Fische"), tx("fishes", "Fisch"), "pisces"],
    skin: tx("slimy skin with bony scales", "schleimige Haut mit Knochenschuppen"),
    breath: tx("gills, all their life", "Kiemen, ein Leben lang"),
    temp: tx("cold-blooded (ectothermic)", "wechselwarm"),
    young: tx("eggs without a shell (spawn) in water", "Eier ohne Schale (Laich) im Wasser"),
    extra: tx("fins for swimming", "Flossen zum Schwimmen"),
    test: tx("Fish breathe with gills all their life and swim with fins.", "Fische atmen ihr Leben lang mit Kiemen und schwimmen mit Flossen."),
  },
  amph: {
    name: tx("Amphibians", "Amphibien"),
    one: tx("an amphibian", "eine Amphibie"),
    accept: [tx("amphibians", "Amphibien"), tx("amphibian", "Amphibie"), "Amphib", "Lurche", "Lurch"],
    skin: tx("moist, bare skin with many glands, no scales", "feuchte, nackte Haut mit vielen Drüsen, ohne Schuppen"),
    breath: tx("larva: gills; adult: lungs and skin", "Larve: Kiemen; erwachsen: Lungen und Haut"),
    temp: tx("cold-blooded (ectothermic)", "wechselwarm"),
    young: tx("spawn in water, larvae change form (metamorphosis)", "Laich im Wasser, Larven mit Metamorphose"),
    extra: tx("larvae live in water, adults also on land", "Larven im Wasser, Erwachsene auch an Land"),
    test: tx("Amphibians have moist skin without scales, and their larvae live in water with gills.", "Amphibien haben feuchte Haut ohne Schuppen, und ihre Larven leben mit Kiemen im Wasser."),
  },
  rept: {
    name: tx("Reptiles", "Reptilien"),
    one: tx("a reptile", "ein Reptil"),
    accept: [tx("reptiles", "Reptilien"), tx("reptile", "Reptil"), "Kriechtiere", "Kriechtier"],
    skin: tx("dry skin with horny scales", "trockene Haut mit Hornschuppen"),
    breath: tx("lungs", "Lungen"),
    temp: tx("cold-blooded (ectothermic)", "wechselwarm"),
    young: tx("eggs with a leathery or hard shell, laid on land", "Eier mit ledriger oder harter Schale, an Land abgelegt"),
    extra: tx("most crawl with their belly close to the ground", "die meisten kriechen dicht am Boden"),
    test: tx("Reptiles have dry skin with horny scales and breathe with lungs.", "Reptilien haben trockene Haut mit Hornschuppen und atmen mit Lungen."),
  },
  bird: {
    name: tx("Birds", "Vögel"),
    one: tx("a bird", "ein Vogel"),
    accept: [tx("birds", "Vögel"), tx("bird", "Vogel"), "aves"],
    skin: tx("feathers", "Federn"),
    breath: tx("lungs with air sacs", "Lungen mit Luftsäcken"),
    temp: tx("warm-blooded (endothermic), about 40 °C", "gleichwarm, etwa 40 °C"),
    young: tx("eggs with a hard lime shell, kept warm by brooding", "Eier mit harter Kalkschale, werden bebrütet"),
    extra: tx("beak of horn without teeth, front limbs are wings", "Hornschnabel ohne Zähne, Vordergliedmaßen sind Flügel"),
    test: tx("Birds have feathers and a beak, and lay eggs with a hard lime shell.", "Vögel haben Federn und einen Schnabel und legen Eier mit harter Kalkschale."),
  },
  mammal: {
    name: tx("Mammals", "Säugetiere"),
    one: tx("a mammal", "ein Säugetier"),
    accept: [tx("mammals", "Säugetiere"), tx("mammal", "Säugetier"), "Säuger"],
    skin: tx("fur (hair)", "Fell (Haare)"),
    breath: tx("lungs", "Lungen"),
    temp: tx("warm-blooded (endothermic), about 37 °C", "gleichwarm, etwa 37 °C"),
    young: tx("live young, fed with milk", "lebende Junge, werden mit Milch gesäugt"),
    extra: tx("mammary glands", "Milchdrüsen"),
    test: tx("Mammals have hair and feed their young with milk.", "Säugetiere haben Haare und säugen ihre Jungen mit Milch."),
  },
};

export const cold = (c: ClassId) => c === "fish" || c === "amph" || c === "rept";

// ---------------------------------------------------------------------------
// Animals

export type Art = "der" | "die" | "das";

/** A clue in the "Which class am I?" sorter: `fits` = the classes it is typical of; none = says nothing about the class. */
export type Clue = { text: Text; fits?: ClassId[] };

export type Animal = {
  id: string;
  name: Text;
  art: Art;
  cls: ClassId;
  /** Tricky animals: why it is NOT the class a student is tempted to pick. */
  traps?: Partial<Record<ClassId, Text>>;
  /** Clues for the sorter widget (tricky animals only). */
  clues?: Clue[];
  /** Habitat / look, one short phrase (for task texts). */
  note?: Text;
};

const LUNG: ClassId[] = ["rept", "bird", "mammal"];
const WARM: ClassId[] = ["bird", "mammal"];
const COLD: ClassId[] = ["fish", "amph", "rept"];

export const ANIMALS: Animal[] = [
  // Mammals
  {
    id: "whale",
    name: tx("blue whale", "Blauwal"),
    art: "der",
    cls: "mammal",
    note: tx("lives in the open sea", "lebt im offenen Meer"),
    traps: {
      fish: tx(
        "Fish shape and flippers, sure. But a whale breathes air with lungs, is warm-blooded and suckles its calf with milk. Look at the features, not the habitat!",
        "Fischform und Flossen, klar. Aber ein Wal atmet mit Lungen Luft, ist gleichwarm und säugt sein Junges mit Milch. Schau auf die Merkmale, nicht auf den Lebensraum!",
      ),
    },
    clues: [
      { text: tx("lives in the sea", "lebt im Meer") },
      { text: tx("fish-shaped body with flippers and a tail fluke", "Fischform mit Flossen (Flipper und Fluke)") },
      { text: tx("breathes air with lungs, through its blowhole", "atmet mit Lungen Luft, durch das Blasloch"), fits: LUNG },
      { text: tx("warm-blooded", "gleichwarm"), fits: WARM },
      { text: tx("gives birth to a live calf and suckles it with milk", "bringt ein lebendes Junges zur Welt und säugt es mit Milch"), fits: ["mammal"] },
    ],
  },
  {
    id: "dolphin",
    name: tx("dolphin", "Delfin"),
    art: "der",
    cls: "mammal",
    note: tx("lives in the sea", "lebt im Meer"),
    traps: {
      fish: tx(
        "A dolphin swims like a fish, but it comes up to breathe air with its lungs, is warm-blooded and suckles its young. Habitat doesn't decide the class!",
        "Ein Delfin schwimmt wie ein Fisch, aber er taucht zum Luftholen auf, atmet mit Lungen, ist gleichwarm und säugt seine Jungen. Der Lebensraum entscheidet nicht über die Klasse!",
      ),
    },
  },
  {
    id: "bat",
    name: tx("bat", "Fledermaus"),
    art: "die",
    cls: "mammal",
    note: tx("flies at night", "fliegt nachts"),
    traps: {
      bird: tx(
        "It flies, yes, but a bat has fur instead of feathers, no beak, and suckles its young with milk. Its wings are skin stretched between long finger bones.",
        "Fliegen kann sie, stimmt. Aber eine Fledermaus hat Fell statt Federn, keinen Schnabel und säugt ihre Jungen mit Milch. Ihre Flügel sind Haut zwischen langen Fingerknochen.",
      ),
    },
    clues: [
      { text: tx("flies at night", "fliegt nachts") },
      { text: tx("wings of skin between long fingers", "Flügel aus Haut zwischen langen Fingern") },
      { text: tx("body covered with fur", "Körper mit Fell bedeckt"), fits: ["mammal"] },
      { text: tx("warm-blooded", "gleichwarm"), fits: WARM },
      { text: tx("gives birth to live young and suckles them", "bringt lebende Junge zur Welt und säugt sie"), fits: ["mammal"] },
    ],
  },
  {
    id: "platypus",
    name: tx("platypus", "Schnabeltier"),
    art: "das",
    cls: "mammal",
    note: tx("has a bill like a duck and lays eggs", "hat einen Schnabel wie eine Ente und legt Eier"),
    traps: {
      bird: tx(
        "Bill and eggs, what a trick! But the platypus has fur, no feathers, and its young lick milk from the mother's fur. It's one of the few egg-laying mammals.",
        "Schnabel und Eier, ganz schön gemein! Aber das Schnabeltier hat Fell, keine Federn, und seine Jungen lecken Milch aus dem Fell der Mutter. Es gehört zu den wenigen Säugetieren, die Eier legen.",
      ),
      rept: tx(
        "It lays eggs with a leathery shell like a reptile, true. But it has fur, is warm-blooded and feeds its young with milk. That decides it!",
        "Es legt Eier mit ledriger Schale wie ein Reptil, stimmt. Aber es hat Fell, ist gleichwarm und ernährt seine Jungen mit Milch. Das entscheidet!",
      ),
    },
    clues: [
      { text: tx("bill like a duck's", "Schnabel wie eine Ente") },
      { text: tx("lays eggs", "legt Eier") },
      { text: tx("body covered with dense fur", "Körper mit dichtem Fell"), fits: ["mammal"] },
      { text: tx("warm-blooded", "gleichwarm"), fits: WARM },
      { text: tx("the young lick milk from the mother's fur", "die Jungen lecken Milch aus dem Fell der Mutter"), fits: ["mammal"] },
    ],
  },
  {
    id: "pangolin",
    name: tx("pangolin", "Schuppentier"),
    art: "das",
    cls: "mammal",
    note: tx("is covered in large scales", "ist mit großen Schuppen bedeckt"),
    traps: {
      rept: tx(
        "Those scales are made of horn, like your fingernails, and hair grows between them. A pangolin is warm-blooded and suckles its young: not a reptile.",
        "Die Schuppen sind aus Horn, wie deine Fingernägel, und dazwischen wachsen Haare. Ein Schuppentier ist gleichwarm und säugt seine Jungen: kein Reptil.",
      ),
    },
    clues: [
      { text: tx("covered in large scales of horn", "mit großen Hornschuppen bedeckt") },
      { text: tx("hair on its belly and between the scales", "Haare am Bauch und zwischen den Schuppen"), fits: ["mammal"] },
      { text: tx("warm-blooded", "gleichwarm"), fits: WARM },
      { text: tx("gives birth to a live baby and suckles it", "bringt ein lebendes Junges zur Welt und säugt es"), fits: ["mammal"] },
    ],
  },
  {
    id: "seal",
    name: tx("harbour seal", "Seehund"),
    art: "der",
    cls: "mammal",
    note: tx("hunts fish in the sea", "jagt Fische im Meer"),
    traps: {
      fish: tx(
        "A seal hunts in the sea, but it breathes with lungs, has fur and suckles its pup. Habitat doesn't decide the class.",
        "Ein Seehund jagt im Meer, aber er atmet mit Lungen, hat Fell und säugt sein Junges. Der Lebensraum entscheidet nicht über die Klasse.",
      ),
      amph: tx(
        "Living in water and on land doesn't make an animal an amphibian. A seal has fur, is warm-blooded and suckles its pup.",
        "Im Wasser und an Land leben macht ein Tier noch nicht zur Amphibie. Ein Seehund hat Fell, ist gleichwarm und säugt sein Junges.",
      ),
    },
  },
  {
    id: "manatee",
    name: tx("manatee", "Seekuh"),
    art: "die",
    cls: "mammal",
    note: tx("grazes on sea grass", "weidet Seegras ab"),
    traps: {
      fish: tx(
        "A manatee never leaves the water, but it surfaces to breathe with its lungs and suckles its calf. That's no fish!",
        "Eine Seekuh verlässt nie das Wasser, aber sie taucht zum Atmen auf, hat Lungen und säugt ihr Junges. Das ist kein Fisch!",
      ),
    },
  },
  {
    id: "otter",
    name: tx("otter", "Fischotter"),
    art: "der",
    cls: "mammal",
    note: tx("swims and hunts fish", "schwimmt und jagt Fische"),
    traps: {
      fish: tx("It swims and eats fish, but an otter has thick fur, breathes with lungs and suckles its young.", "Er schwimmt und frisst Fische, aber ein Fischotter hat dichtes Fell, atmet mit Lungen und säugt seine Jungen."),
    },
  },
  { id: "hedgehog", name: tx("hedgehog", "Igel"), art: "der", cls: "mammal", note: tx("has spines", "hat Stacheln") },
  { id: "mole", name: tx("mole", "Maulwurf"), art: "der", cls: "mammal", note: tx("digs tunnels", "gräbt Gänge") },
  { id: "kangaroo", name: tx("kangaroo", "Känguru"), art: "das", cls: "mammal", note: tx("carries its young in a pouch", "trägt sein Junges im Beutel") },
  { id: "squirrel", name: tx("red squirrel", "Eichhörnchen"), art: "das", cls: "mammal", note: tx("climbs trees", "klettert auf Bäume") },
  { id: "polarbear", name: tx("polar bear", "Eisbär"), art: "der", cls: "mammal", note: tx("lives in the Arctic", "lebt in der Arktis") },
  // Birds
  {
    id: "penguin",
    name: tx("emperor penguin", "Kaiserpinguin"),
    art: "der",
    cls: "bird",
    note: tx("cannot fly, swims and dives", "kann nicht fliegen, schwimmt und taucht"),
    traps: {
      fish: tx(
        "It swims brilliantly, but a penguin has feathers and a beak, breathes with lungs and lays an egg with a hard lime shell.",
        "Er schwimmt super, aber ein Pinguin hat Federn und einen Schnabel, atmet mit Lungen und legt ein Ei mit harter Kalkschale.",
      ),
      mammal: tx(
        "Warm-blooded, yes, but a penguin has feathers, not fur, and lays an egg that it broods. No milk here!",
        "Gleichwarm, stimmt, aber ein Pinguin hat Federn, kein Fell, und legt ein Ei, das er ausbrütet. Hier gibt es keine Milch!",
      ),
    },
    clues: [
      { text: tx("cannot fly", "kann nicht fliegen") },
      { text: tx("swims and dives in the sea", "schwimmt und taucht im Meer") },
      { text: tx("body covered with feathers", "Körper mit Federn bedeckt"), fits: ["bird"] },
      { text: tx("beak of horn, no teeth", "Hornschnabel ohne Zähne"), fits: ["bird"] },
      { text: tx("lays an egg with a hard lime shell and broods it", "legt ein Ei mit harter Kalkschale und brütet es aus"), fits: ["bird"] },
    ],
  },
  {
    id: "ostrich",
    name: tx("ostrich", "Strauß"),
    art: "der",
    cls: "bird",
    note: tx("cannot fly, runs very fast", "kann nicht fliegen, rennt sehr schnell"),
    traps: {
      mammal: tx(
        "It runs on two long legs and can't fly, but an ostrich has feathers and a beak and lays the biggest eggs of any living bird.",
        "Er rennt auf zwei langen Beinen und kann nicht fliegen, aber ein Strauß hat Federn und einen Schnabel und legt die größten Eier aller heute lebenden Vögel.",
      ),
    },
    clues: [
      { text: tx("cannot fly", "kann nicht fliegen") },
      { text: tx("runs up to 70 km/h on two legs", "rennt bis zu 70 km/h auf zwei Beinen") },
      { text: tx("feathers (soft, used for display)", "Federn (weich, zum Imponieren)"), fits: ["bird"] },
      { text: tx("beak of horn, no teeth", "Hornschnabel ohne Zähne"), fits: ["bird"] },
      { text: tx("lays huge eggs with a hard lime shell", "legt riesige Eier mit harter Kalkschale"), fits: ["bird"] },
    ],
  },
  {
    id: "kiwi",
    name: tx("brown kiwi", "Streifenkiwi"),
    art: "der",
    cls: "bird",
    note: tx("cannot fly, its feathers look like hair", "kann nicht fliegen, seine Federn sehen aus wie Haare"),
    traps: {
      mammal: tx(
        "Its feathers are thin and look like hair, but they are feathers. A kiwi has a beak and lays eggs with a hard shell.",
        "Seine Federn sind dünn und sehen aus wie Haare, aber es sind Federn. Ein Kiwi hat einen Schnabel und legt Eier mit harter Schale.",
      ),
    },
  },
  { id: "blackbird", name: tx("blackbird", "Amsel"), art: "die", cls: "bird", note: tx("sings in the garden", "singt im Garten") },
  { id: "eagle", name: tx("golden eagle", "Steinadler"), art: "der", cls: "bird", note: tx("hunts from the air", "jagt aus der Luft") },
  { id: "owl", name: tx("tawny owl", "Waldkauz"), art: "der", cls: "bird", note: tx("hunts at night", "jagt nachts") },
  { id: "hummingbird", name: tx("hummingbird", "Kolibri"), art: "der", cls: "bird", note: tx("drinks nectar from flowers", "trinkt Nektar aus Blüten") },
  { id: "stork", name: tx("white stork", "Weißstorch"), art: "der", cls: "bird", note: tx("flies to Africa in autumn", "fliegt im Herbst nach Afrika") },
  { id: "chicken", name: tx("chicken", "Haushuhn"), art: "das", cls: "bird", note: tx("lives on farms", "lebt auf dem Bauernhof") },
  // Reptiles
  {
    id: "crocodile",
    name: tx("Nile crocodile", "Nilkrokodil"),
    art: "das",
    cls: "rept",
    note: tx("lives in water and on land", "lebt im Wasser und an Land"),
    traps: {
      amph: tx(
        "'Amphibian' doesn't mean 'lives in water and on land'! A crocodile has dry skin with horny scales and lays eggs with a hard shell on land.",
        "„Amphibie“ heißt nicht „lebt im Wasser und an Land“! Ein Krokodil hat trockene Haut mit Hornschuppen und legt Eier mit harter Schale an Land.",
      ),
    },
    clues: [
      { text: tx("lives in water and on land", "lebt im Wasser und an Land") },
      { text: tx("dry skin with horny scales and plates", "trockene Haut mit Hornschuppen und Hornplatten"), fits: ["rept"] },
      { text: tx("breathes with lungs", "atmet mit Lungen"), fits: LUNG },
      { text: tx("cold-blooded: warms up in the sun", "wechselwarm: wärmt sich in der Sonne auf"), fits: COLD },
      { text: tx("lays eggs with a hard shell on land", "legt Eier mit harter Schale an Land"), fits: ["rept"] },
    ],
  },
  {
    id: "seaturtle",
    name: tx("green sea turtle", "Suppenschildkröte"),
    art: "die",
    cls: "rept",
    note: tx("lives in the sea", "lebt im Meer"),
    traps: {
      amph: tx(
        "It lives in the sea but crawls onto the beach to lay its eggs with a shell in the sand. Horny plates, lungs: a reptile feature list.",
        "Sie lebt im Meer, kriecht aber an den Strand und legt ihre Eier mit Schale in den Sand. Hornplatten, Lungen: Das ist keine Amphibie.",
      ),
      fish: tx("A sea turtle surfaces to breathe with its lungs and lays its eggs on land. No gills, no fish.", "Eine Meeresschildkröte taucht zum Atmen mit ihren Lungen auf und legt ihre Eier an Land. Keine Kiemen, kein Fisch."),
    },
  },
  {
    id: "slowworm",
    name: tx("slow worm", "Blindschleiche"),
    art: "die",
    cls: "rept",
    note: tx("has no legs", "hat keine Beine"),
    traps: {
      amph: tx(
        "Shiny and smooth, but its skin is dry and covered with tiny horny scales. A slow worm is a lizard without legs: a reptile.",
        "Glänzend und glatt, aber die Haut ist trocken und mit winzigen Hornschuppen bedeckt. Die Blindschleiche ist eine Echse ohne Beine.",
      ),
    },
    clues: [
      { text: tx("no legs, looks like a snake", "keine Beine, sieht aus wie eine Schlange") },
      { text: tx("dry, smooth skin with small horny scales", "trockene, glatte Haut mit kleinen Hornschuppen"), fits: ["rept"] },
      { text: tx("breathes with lungs", "atmet mit Lungen"), fits: LUNG },
      { text: tx("cold-blooded: rigid in winter", "wechselwarm: im Winter starr"), fits: COLD },
    ],
  },
  { id: "lizard", name: tx("sand lizard", "Zauneidechse"), art: "die", cls: "rept", note: tx("basks in the sun", "sonnt sich gern"), traps: { amph: tx("A sand lizard has dry skin with horny scales and lays eggs with a shell in the sand. That's not an amphibian.", "Eine Zauneidechse hat trockene Haut mit Hornschuppen und legt Eier mit Schale in den Sand. Das ist keine Amphibie.") } },
  { id: "grasssnake", name: tx("grass snake", "Ringelnatter"), art: "die", cls: "rept", note: tx("swims well", "schwimmt gut"), traps: { amph: tx("A grass snake swims well, but its skin is dry with horny scales and it lays eggs with a shell on land.", "Eine Ringelnatter schwimmt gut, aber ihre Haut ist trocken mit Hornschuppen, und sie legt Eier mit Schale an Land.") } },
  { id: "adder", name: tx("adder", "Kreuzotter"), art: "die", cls: "rept", note: tx("is venomous", "ist giftig") },
  { id: "chameleon", name: tx("chameleon", "Chamäleon"), art: "das", cls: "rept", note: tx("changes colour", "wechselt die Farbe") },
  { id: "tortoise", name: tx("Greek tortoise", "Griechische Landschildkröte"), art: "die", cls: "rept", note: tx("carries a shell", "trägt einen Panzer") },
  // Amphibians
  {
    id: "salamander",
    name: tx("fire salamander", "Feuersalamander"),
    art: "der",
    cls: "amph",
    note: tx("looks like a lizard", "sieht aus wie eine Eidechse"),
    traps: {
      rept: tx(
        "It looks like a lizard, but its skin is moist and full of glands, with no scales. Its larvae grow up in streams and breathe with gills.",
        "Er sieht aus wie eine Eidechse, aber seine Haut ist feucht und voller Drüsen, ohne Schuppen. Seine Larven wachsen im Bach auf und atmen mit Kiemen.",
      ),
    },
    clues: [
      { text: tx("looks like a lizard", "sieht aus wie eine Eidechse") },
      { text: tx("moist skin full of glands, no scales", "feuchte Haut voller Drüsen, ohne Schuppen"), fits: ["amph"] },
      { text: tx("its larvae live in streams and breathe with gills", "die Larven leben im Bach und atmen mit Kiemen"), fits: ["amph"] },
      { text: tx("cold-blooded", "wechselwarm"), fits: COLD },
    ],
  },
  {
    id: "axolotl",
    name: tx("Mexican axolotl", "Mexikanischer Axolotl"),
    art: "der",
    cls: "amph",
    note: tx("lives in water all its life", "lebt sein ganzes Leben im Wasser"),
    traps: {
      fish: tx(
        "It keeps its feathery gills and stays in the water, but it has moist skin without scales and four legs. An axolotl is an amphibian that stays a larva.",
        "Er behält seine fedrigen Kiemen und bleibt im Wasser, aber er hat feuchte Haut ohne Schuppen und vier Beine. Der Axolotl ist eine Amphibie, die Larve bleibt.",
      ),
    },
    clues: [
      { text: tx("lives in water all its life", "lebt sein ganzes Leben im Wasser") },
      { text: tx("feathery gills on its head", "fedrige Kiemen am Kopf"), fits: ["fish", "amph"] },
      { text: tx("moist skin without scales, four legs", "feuchte Haut ohne Schuppen, vier Beine"), fits: ["amph"] },
      { text: tx("cold-blooded", "wechselwarm"), fits: COLD },
    ],
  },
  {
    id: "toad",
    name: tx("common toad", "Erdkröte"),
    art: "die",
    cls: "amph",
    note: tx("has warty skin", "hat warzige Haut"),
    traps: {
      rept: tx(
        "The warts look dry, but they are skin glands. A toad's skin has no horny scales, and it spawns in a pond.",
        "Die Warzen sehen trocken aus, sind aber Hautdrüsen. Die Haut einer Kröte hat keine Hornschuppen, und sie laicht im Teich.",
      ),
    },
  },
  { id: "frog", name: tx("common frog", "Grasfrosch"), art: "der", cls: "amph", note: tx("spawns in ponds", "laicht im Teich") },
  { id: "treefrog", name: tx("tree frog", "Laubfrosch"), art: "der", cls: "amph", note: tx("climbs bushes", "klettert in Büschen") },
  { id: "newt", name: tx("alpine newt", "Bergmolch"), art: "der", cls: "amph", note: tx("has a tail", "hat einen Schwanz"), traps: { rept: tx("A newt looks a bit like a lizard, but its skin is moist and bare, and its larvae breathe with gills in the pond.", "Ein Molch sieht ein bisschen aus wie eine Eidechse, aber seine Haut ist feucht und nackt, und seine Larven atmen im Teich mit Kiemen.") } },
  // Fish
  {
    id: "seahorse",
    name: tx("seahorse", "Seepferdchen"),
    art: "das",
    cls: "fish",
    note: tx("swims upright, the male carries the eggs", "schwimmt aufrecht, das Männchen trägt die Eier"),
    traps: {
      mammal: tx(
        "Its head looks like a horse's, but a seahorse breathes with gills and has fins. It's a fish!",
        "Sein Kopf sieht aus wie ein Pferdekopf, aber ein Seepferdchen atmet mit Kiemen und hat Flossen.",
      ),
      rept: tx("Its body has bony plates, but a seahorse breathes with gills and swims with fins.", "Sein Körper hat Knochenplatten, aber ein Seepferdchen atmet mit Kiemen und schwimmt mit Flossen."),
    },
    clues: [
      { text: tx("head shaped like a horse's", "Kopf wie ein Pferdekopf") },
      { text: tx("the male carries the eggs in a pouch", "das Männchen trägt die Eier in einer Bruttasche") },
      { text: tx("breathes with gills", "atmet mit Kiemen"), fits: ["fish"] },
      { text: tx("small fins, e.g. on its back", "kleine Flossen, z. B. am Rücken"), fits: ["fish"] },
      { text: tx("cold-blooded", "wechselwarm"), fits: COLD },
    ],
  },
  {
    id: "eel",
    name: tx("European eel", "Europäischer Aal"),
    art: "der",
    cls: "fish",
    note: tx("long and snake-like", "lang wie eine Schlange"),
    traps: {
      rept: tx(
        "Long like a snake, but an eel breathes with gills, has a fin seam along its back and belly, and tiny scales in its slimy skin.",
        "Lang wie eine Schlange, aber ein Aal atmet mit Kiemen, hat einen Flossensaum an Rücken und Bauch und winzige Schuppen in der schleimigen Haut.",
      ),
      amph: tx("It can wriggle over wet grass, but an eel breathes with gills and has fins and scales. It spawns far out in the sea.", "Er kann über nasses Gras kriechen, aber ein Aal atmet mit Kiemen und hat Flossen und Schuppen. Er laicht weit draußen im Meer."),
    },
    clues: [
      { text: tx("long and snake-like", "lang wie eine Schlange") },
      { text: tx("can wriggle over wet grass", "kann über nasses Gras kriechen") },
      { text: tx("breathes with gills", "atmet mit Kiemen"), fits: ["fish"] },
      { text: tx("fin seam along its back and belly", "Flossensaum an Rücken und Bauch"), fits: ["fish"] },
      { text: tx("tiny scales in its slimy skin", "winzige Schuppen in der Schleimhaut"), fits: ["fish"] },
    ],
  },
  {
    id: "shark",
    name: tx("hammerhead shark", "Hammerhai"),
    art: "der",
    cls: "fish",
    note: tx("a big hunter in the sea", "ein großer Jäger im Meer"),
    traps: {
      mammal: tx("Big like a dolphin, but a shark breathes with gills (look for the gill slits) and has fins with a skeleton of cartilage.", "Groß wie ein Delfin, aber ein Hai atmet mit Kiemen (sieh dir die Kiemenspalten an) und hat Flossen und ein Skelett aus Knorpel."),
    },
  },
  {
    id: "mudskipper",
    name: tx("mudskipper", "Schlammspringer"),
    art: "der",
    cls: "fish",
    note: tx("hops over mud on its fins", "hüpft auf seinen Flossen über den Schlamm"),
    traps: {
      amph: tx("It hops over the mud at low tide, but a mudskipper breathes with gills (it keeps water in its gill chambers) and moves with fins.", "Er hüpft bei Ebbe über den Schlamm, aber ein Schlammspringer atmet mit Kiemen (er hält Wasser in den Kiemenhöhlen) und bewegt sich mit Flossen."),
    },
  },
  {
    id: "flyingfish",
    name: tx("flying fish", "Fliegender Fisch"),
    art: "der",
    cls: "fish",
    note: tx("glides above the waves", "gleitet über die Wellen"),
    traps: { bird: tx("It glides on huge fins, but it has no feathers and no beak. It breathes with gills.", "Er gleitet auf riesigen Flossen, hat aber keine Federn und keinen Schnabel. Er atmet mit Kiemen.") },
  },
  { id: "trout", name: tx("brown trout", "Bachforelle"), art: "die", cls: "fish", note: tx("lives in cool streams", "lebt in kühlen Bächen") },
  { id: "carp", name: tx("carp", "Karpfen"), art: "der", cls: "fish", note: tx("lives in ponds", "lebt im Teich") },
  { id: "herring", name: tx("herring", "Hering"), art: "der", cls: "fish", note: tx("swims in huge shoals", "schwimmt in riesigen Schwärmen") },
  { id: "pike", name: tx("pike", "Hecht"), art: "der", cls: "fish", note: tx("hunts in lakes", "jagt in Seen") },
  { id: "clownfish", name: tx("clownfish", "Clownfisch"), art: "der", cls: "fish", note: tx("lives in sea anemones", "lebt in Seeanemonen") },
];

export const animal = (id: string) => ANIMALS.find((a) => a.id === id)!;

/** "the blue whale" / "der Blauwal" (nominative), capitalised for a sentence start with `cap`. */
export const theName = (a: Animal): Text => tx(`the ${(a.name as { en: string }).en}`, `${a.art} ${(a.name as { de: string }).de}`);
export const TheName = (a: Animal): Text => tx(`The ${(a.name as { en: string }).en}`, `${a.art.charAt(0).toUpperCase()}${a.art.slice(1)} ${(a.name as { de: string }).de}`);

/** The tricky animals the "Which class am I?" sorter walks through. */
export const SORTER_IDS = ["whale", "bat", "penguin", "platypus", "eel", "salamander", "crocodile", "ostrich", "seahorse", "slowworm", "axolotl", "pangolin"];

// ---------------------------------------------------------------------------
// Invertebrates (for "vertebrate or not?")

export type Invert = { name: Text; group: Text; trap?: Text };

export const INVERTEBRATES: Invert[] = [
  {
    name: tx("cuttlefish", "Tintenfisch"),
    group: tx("a mollusc", "ein Weichtier"),
    trap: tx("Despite the name, a cuttlefish is no fish: it's a mollusc, a relative of snails, with no backbone.", "Trotz des Namens ist ein Tintenfisch kein Fisch: Er ist ein Weichtier, verwandt mit Schnecken, ohne Wirbelsäule."),
  },
  {
    name: tx("starfish", "Seestern"),
    group: tx("an echinoderm", "ein Stachelhäuter"),
    trap: tx("A starfish has no backbone at all. It's an echinoderm, like the sea urchin.", "Ein Seestern hat gar keine Wirbelsäule. Er ist ein Stachelhäuter, wie der Seeigel."),
  },
  {
    name: tx("jellyfish", "Qualle"),
    group: tx("a cnidarian", "ein Nesseltier"),
    trap: tx("A jellyfish is mostly water and has no skeleton at all, let alone a backbone.", "Eine Qualle besteht fast nur aus Wasser und hat gar kein Skelett, also auch keine Wirbelsäule."),
  },
  { name: tx("octopus", "Krake"), group: tx("a mollusc", "ein Weichtier"), trap: tx("An octopus is clever and big, but it has no bones at all. It's a mollusc.", "Ein Krake ist schlau und groß, hat aber gar keine Knochen. Er ist ein Weichtier.") },
  { name: tx("earthworm", "Regenwurm"), group: tx("an annelid worm", "ein Ringelwurm") },
  { name: tx("garden snail", "Weinbergschnecke"), group: tx("a mollusc", "ein Weichtier") },
  { name: tx("honeybee", "Honigbiene"), group: tx("an insect", "ein Insekt") },
  { name: tx("garden spider", "Kreuzspinne"), group: tx("an arachnid", "ein Spinnentier") },
  { name: tx("edible crab", "Taschenkrebs"), group: tx("a crustacean", "ein Krebstier"), trap: tx("A crab has a hard shell, but that's an outer skeleton of chitin and lime, not a backbone.", "Ein Krebs hat einen harten Panzer, aber das ist ein Außenskelett aus Chitin und Kalk, keine Wirbelsäule.") },
  { name: tx("ladybird", "Marienkäfer"), group: tx("an insect", "ein Insekt") },
];

// ---------------------------------------------------------------------------
// Features that belong to exactly one class (for "which class has ...?")

export type Feature = { id: string; text: Text; cls: ClassId; near: ClassId; nearSay: Text };

export const FEATURES: Feature[] = [
  {
    id: "feathers",
    text: tx("feathers", "Federn"),
    cls: "bird",
    near: "mammal",
    nearSay: tx("Mammals have hair or fur. Feathers grow on only one class.", "Säugetiere haben Haare oder Fell. Federn wachsen nur bei einer Klasse."),
  },
  {
    id: "fur",
    text: tx("fur or hair", "Fell oder Haare"),
    cls: "mammal",
    near: "bird",
    nearSay: tx("Birds keep warm with feathers, not hair. Which class is covered with fur?", "Vögel halten sich mit Federn warm, nicht mit Haaren. Welche Klasse trägt ein Fell?"),
  },
  {
    id: "milk",
    text: tx("feed their young with milk", "säugen ihre Jungen mit Milch"),
    cls: "mammal",
    near: "bird",
    nearSay: tx("Birds feed their chicks, but with insects, seeds or worms, not with milk from milk glands.", "Vögel füttern ihre Küken, aber mit Insekten, Samen oder Würmern, nicht mit Milch aus Milchdrüsen."),
  },
  {
    id: "moist",
    text: tx("moist skin with many glands and no scales", "feuchte Haut mit vielen Drüsen und ohne Schuppen"),
    cls: "amph",
    near: "rept",
    nearSay: tx("Reptiles have dry skin with horny scales. Moist, bare skin belongs to a different class.", "Reptilien haben trockene Haut mit Hornschuppen. Feuchte, nackte Haut gehört zu einer anderen Klasse."),
  },
  {
    id: "metamorphosis",
    text: tx("larvae that change into adults (metamorphosis)", "Larven, die sich zum erwachsenen Tier umwandeln (Metamorphose)"),
    cls: "amph",
    near: "fish",
    nearSay: tx("Young fish already look like small fish. Think of the tadpole that becomes a frog!", "Junge Fische sehen schon aus wie kleine Fische. Denk an die Kaulquappe, die zum Frosch wird!"),
  },
  {
    id: "gills",
    text: tx("gills all their life", "ein Leben lang Kiemen"),
    cls: "fish",
    near: "amph",
    nearSay: tx("Amphibians only breathe with gills as larvae. Adults use lungs and skin. Who keeps gills for life?", "Amphibien atmen nur als Larven mit Kiemen. Erwachsene nutzen Lungen und Haut. Wer behält die Kiemen ein Leben lang?"),
  },
  {
    id: "fins",
    text: tx("fins with fin rays", "Flossen mit Flossenstrahlen"),
    cls: "fish",
    near: "mammal",
    nearSay: tx("Whales and dolphins have flippers, but no fin rays: inside are arm and finger bones. Real fins with rays belong to another class.", "Wale und Delfine haben Flossen, aber ohne Flossenstrahlen: Darin stecken Arm- und Fingerknochen. Echte Flossen mit Strahlen hat eine andere Klasse."),
  },
  {
    id: "hornscales",
    text: tx("dry skin with horny scales", "trockene Haut mit Hornschuppen"),
    cls: "rept",
    near: "fish",
    nearSay: tx("Fish scales are bony and sit in slimy, moist skin. Dry skin with horny scales is a different class.", "Fischschuppen sind aus Knochen und stecken in schleimiger, feuchter Haut. Trockene Haut mit Hornschuppen ist eine andere Klasse."),
  },
  {
    id: "landeggs",
    text: tx("eggs with a leathery shell, buried on land, not brooded", "Eier mit ledriger Schale, an Land vergraben, nicht bebrütet"),
    cls: "rept",
    near: "bird",
    nearSay: tx("Birds brood their eggs with their own body heat. Leathery eggs left in warm sand belong to another class.", "Vögel bebrüten ihre Eier mit der eigenen Körperwärme. Ledrige Eier, die im warmen Sand liegen bleiben, gehören zu einer anderen Klasse."),
  },
  {
    id: "limeeggs",
    text: tx("eggs with a hard lime shell that are brooded", "Eier mit harter Kalkschale, die bebrütet werden"),
    cls: "bird",
    near: "rept",
    nearSay: tx("Most reptile eggs have a soft, leathery shell and are left to warm in the sun. Who sits on its eggs?", "Die meisten Reptilieneier haben eine weiche, ledrige Schale und werden von der Sonne gewärmt. Wer sitzt auf seinen Eiern?"),
  },
  {
    id: "beak",
    text: tx("a beak of horn and no teeth", "einen Hornschnabel und keine Zähne"),
    cls: "bird",
    near: "mammal",
    nearSay: tx("The platypus has a bill, but it's a rare exception, and it's soft and leathery. A beak of horn without teeth is the mark of another class.", "Das Schnabeltier hat zwar einen Schnabel, aber das ist eine seltene Ausnahme, und er ist weich und ledrig. Ein Hornschnabel ohne Zähne ist das Kennzeichen einer anderen Klasse."),
  },
  {
    id: "spawn",
    text: tx("spawn in water and larvae with gills that later breathe with lungs", "Laich im Wasser und Larven mit Kiemen, die später mit Lungen atmen"),
    cls: "amph",
    near: "fish",
    nearSay: tx("Fish spawn in water too, but a fish never switches to lungs. Which class swaps gills for lungs?", "Fische laichen auch im Wasser, aber ein Fisch wechselt nie zu Lungen. Welche Klasse tauscht Kiemen gegen Lungen?"),
  },
];
