import { tx, type Text } from "@/i18n/text";

// Facts and term banks for the topic "flowers-seeds", shared by lessons, widgets and tasks.

// ---------------------------------------------------------------------------
// Parts of the flower (cherry blossom)

export type PartId = "sepal" | "petal" | "anther" | "filament" | "pollen" | "stigma" | "style" | "ovary" | "ovule" | "nectar" | "receptacle" | "stalk";

export type FlowerPart = {
  id: PartId;
  name: Text;
  /** Its job, as a short phrase (for matching). */
  job: Text;
  /** Where it sits: Blob uses this when a student picked this name for another part. */
  where: Text;
  /** male: belongs to the stamen; female: belongs to the pistil. */
  group: "male" | "female" | "other";
  /** Names students mix it up with. */
  confused: PartId[];
};

export const PARTS: Record<PartId, FlowerPart> = {
  sepal: {
    id: "sepal",
    name: tx("sepal", "Kelchblatt"),
    job: tx("protects the flower bud", "schützt die Blütenknospe"),
    where: tx("Sepals are the small green leaves on the outside, right below the petals.", "Kelchblätter sind die kleinen grünen Blätter ganz außen, unterhalb der Kronblätter."),
    group: "other",
    confused: ["petal", "receptacle"],
  },
  petal: {
    id: "petal",
    name: tx("petal", "Kronblatt"),
    job: tx("attracts insects", "lockt Insekten an"),
    where: tx("Petals are the big, coloured leaves of the flower (white or pink in the cherry).", "Kronblätter sind die großen, farbigen Blätter der Blüte (bei der Kirsche weiß bis rosa)."),
    group: "other",
    confused: ["sepal", "filament"],
  },
  anther: {
    id: "anther",
    name: tx("anther", "Staubbeutel"),
    job: tx("makes the pollen", "bildet den Pollen"),
    where: tx("Anthers sit on top of the thin filaments and are yellow with pollen.", "Staubbeutel sitzen oben auf den dünnen Staubfäden und sind gelb vom Pollen."),
    group: "male",
    confused: ["stigma", "pollen", "filament"],
  },
  filament: {
    id: "filament",
    name: tx("filament", "Staubfaden"),
    job: tx("holds the anther up", "trägt den Staubbeutel"),
    where: tx("Filaments are the thin stalks around the middle with an anther on top.", "Staubfäden sind die dünnen Stiele rund um die Mitte, mit einem Staubbeutel obendrauf."),
    group: "male",
    confused: ["style", "anther"],
  },
  pollen: {
    id: "pollen",
    name: tx("pollen grains", "Pollen"),
    job: tx("carries the male sex cells", "enthält die männlichen Keimzellen"),
    where: tx("Pollen is the fine yellow dust that comes out of the anthers.", "Pollen ist der feine gelbe Staub, der aus den Staubbeuteln kommt."),
    group: "male",
    confused: ["anther", "nectar"],
  },
  stigma: {
    id: "stigma",
    name: tx("stigma", "Narbe"),
    job: tx("catches the pollen", "fängt den Pollen auf"),
    where: tx("The stigma is the sticky tip of the pistil, right in the middle at the top.", "Die Narbe ist die klebrige Spitze des Stempels, ganz in der Mitte oben."),
    group: "female",
    confused: ["anther", "style"],
  },
  style: {
    id: "style",
    name: tx("style", "Griffel"),
    job: tx("connects the stigma with the ovary", "verbindet Narbe und Fruchtknoten"),
    where: tx("The style is the single stalk in the very middle. It carries the stigma.", "Der Griffel ist der einzelne Stiel genau in der Mitte. Er trägt die Narbe."),
    group: "female",
    confused: ["filament", "stigma"],
  },
  ovary: {
    id: "ovary",
    name: tx("ovary", "Fruchtknoten"),
    job: tx("holds the ovule and becomes the fruit", "enthält die Samenanlage und wird zur Frucht"),
    where: tx("The ovary is the thick lower part of the pistil. The ovule lies inside it.", "Der Fruchtknoten ist der dicke untere Teil des Stempels. In ihm liegt die Samenanlage."),
    group: "female",
    confused: ["ovule", "receptacle"],
  },
  ovule: {
    id: "ovule",
    name: tx("ovule", "Samenanlage"),
    job: tx("holds the egg cell and becomes the seed", "enthält die Eizelle und wird zum Samen"),
    where: tx("The ovule is the small body inside the ovary. It holds the egg cell.", "Die Samenanlage ist das kleine Gebilde im Inneren des Fruchtknotens. Sie enthält die Eizelle."),
    group: "female",
    confused: ["ovary", "pollen"],
  },
  nectar: {
    id: "nectar",
    name: tx("nectar", "Nektar"),
    job: tx("rewards insects with sugar", "belohnt Insekten mit Zucker"),
    where: tx("Nectar is the sweet juice deep down on the inside of the receptacle.", "Nektar ist der süße Saft tief unten innen am Blütenboden."),
    group: "other",
    confused: ["pollen", "receptacle"],
  },
  receptacle: {
    id: "receptacle",
    name: tx("receptacle", "Blütenboden"),
    job: tx("carries all the other parts of the flower", "trägt alle anderen Blütenteile"),
    where: tx("The receptacle is the cup at the base. All other parts grow from it.", "Der Blütenboden ist der Becher am Grund. Aus ihm wachsen alle anderen Teile."),
    group: "other",
    confused: ["ovary", "sepal"],
  },
  stalk: {
    id: "stalk",
    name: tx("flower stalk", "Blütenstiel"),
    job: tx("connects the flower with the branch", "verbindet die Blüte mit dem Zweig"),
    where: tx("The flower stalk is the long stem below the flower.", "Der Blütenstiel ist der lange Stiel unter der Blüte."),
    group: "other",
    confused: ["style", "receptacle"],
  },
};

/** Parts with a clear job that students learn first (for matching). */
export const JOB_PARTS: PartId[] = ["sepal", "petal", "anther", "filament", "stigma", "style", "ovary", "ovule", "nectar"];
/** Parts that the "what is this called?" picture asks for. */
export const ASK_PARTS: PartId[] = ["sepal", "petal", "anther", "filament", "stigma", "style", "ovary", "ovule", "receptacle", "nectar", "pollen", "stalk"];

// ---------------------------------------------------------------------------
// From pollination to seed (level 1)

export const CHAIN1: Text[] = [
  tx("An insect visits the flower and picks up pollen", "Ein Insekt besucht die Blüte und nimmt Pollen auf"),
  tx("Pollen lands on the stigma of another flower (pollination)", "Pollen gelangt auf die Narbe einer anderen Blüte (Bestäubung)"),
  tx("A pollen tube grows through the style to the ovule", "Ein Pollenschlauch wächst durch den Griffel zur Samenanlage"),
  tx("A sperm cell fuses with the egg cell (fertilisation)", "Eine Spermazelle verschmilzt mit der Eizelle (Befruchtung)"),
  tx("The ovary grows into a fruit with a seed inside", "Der Fruchtknoten wächst zur Frucht mit dem Samen heran"),
  tx("The fruits and seeds are spread", "Früchte und Samen werden verbreitet"),
  tx("The seed germinates and a new plant grows", "Der Samen keimt und eine neue Pflanze wächst"),
];

// ---------------------------------------------------------------------------
// Seed dispersal

export type Mode = "wind" | "animal" | "self" | "water";

export const MODES: Record<Mode, { name: Text; short: Text; kind: Text }> = {
  wind: { name: tx("by the wind", "durch den Wind"), short: tx("Wind", "Wind"), kind: tx("wind dispersal", "Windverbreitung") },
  animal: { name: tx("by animals", "durch Tiere"), short: tx("Animals", "Tiere"), kind: tx("animal dispersal", "Tierverbreitung") },
  self: { name: tx("by the plant itself", "durch die Pflanze selbst"), short: tx("Self", "Selbst"), kind: tx("self-dispersal", "Selbstverbreitung") },
  water: { name: tx("by water", "durch Wasser"), short: tx("Water", "Wasser"), kind: tx("water dispersal", "Wasserverbreitung") },
};

export type DispersalPlant = {
  id: string;
  name: Text;
  mode: Mode;
  /** The feature that does the job (for matching). */
  feature: Text;
  /** Why, in one short sentence. */
  why: Text;
};

export const DISPERSAL: DispersalPlant[] = [
  {
    id: "dandelion",
    name: tx("dandelion", "Löwenzahn"),
    mode: "wind",
    feature: tx("a tiny parachute of hairs", "ein Flugschirm aus Härchen"),
    why: tx("Each fruit hangs from a parachute of fine hairs and floats far on the wind.", "Jede Frucht hängt an einem Flugschirm aus feinen Härchen und schwebt weit mit dem Wind."),
  },
  {
    id: "maple",
    name: tx("maple", "Ahorn"),
    mode: "wind",
    feature: tx("a wing that spins like a propeller", "ein Flügel, der sich wie ein Propeller dreht"),
    why: tx("The winged fruits spin like little helicopters and drift away from the tree.", "Die Flügelfrüchte drehen sich wie kleine Hubschrauber und segeln vom Baum weg."),
  },
  {
    id: "linden",
    name: tx("lime tree (linden)", "Linde"),
    mode: "wind",
    feature: tx("a leaf-like wing above the small nuts", "ein blattartiger Flügel über den Nüsschen"),
    why: tx("A leaf-like bract works as a wing and lets the little nuts spin away.", "Ein blattartiges Hochblatt dient als Flügel, und die Nüsschen drehen sich davon."),
  },
  {
    id: "birch",
    name: tx("birch", "Birke"),
    mode: "wind",
    feature: tx("tiny fruits with two thin wings", "winzige Früchte mit zwei dünnen Flügeln"),
    why: tx("The tiny winged fruits are as light as dust and the wind carries them far.", "Die winzigen geflügelten Früchte sind leicht wie Staub, der Wind trägt sie weit."),
  },
  {
    id: "burdock",
    name: tx("burdock", "Klette"),
    mode: "animal",
    feature: tx("hooked spines", "Widerhaken"),
    why: tx("Its hooks catch in the fur of passing animals (or on your jumper) and travel along.", "Ihre Haken bleiben im Fell vorbeilaufender Tiere hängen (oder an deinem Pulli) und reisen mit."),
  },
  {
    id: "cherry",
    name: tx("cherry", "Kirsche"),
    mode: "animal",
    feature: tx("sweet, juicy flesh", "süßes, saftiges Fruchtfleisch"),
    why: tx("Birds eat the juicy fruit. The hard stone passes through them and lands somewhere else.", "Vögel fressen die saftige Frucht. Der harte Steinkern wird unverdaut wieder ausgeschieden, woanders."),
  },
  {
    id: "oak",
    name: tx("oak", "Eiche"),
    mode: "animal",
    feature: tx("nutritious acorns that animals hide", "nahrhafte Eicheln, die Tiere verstecken"),
    why: tx("Jays and squirrels hide acorns as winter food and forget some of them.", "Eichelhäher und Eichhörnchen verstecken Eicheln als Wintervorrat und vergessen einige."),
  },
  {
    id: "hazel",
    name: tx("hazel", "Hasel"),
    mode: "animal",
    feature: tx("nuts that squirrels bury", "Nüsse, die Eichhörnchen vergraben"),
    why: tx("Squirrels and mice bury the nuts as a store. Forgotten nuts can germinate.", "Eichhörnchen und Mäuse vergraben die Nüsse als Vorrat. Vergessene Nüsse können keimen."),
  },
  {
    id: "rowan",
    name: tx("rowan", "Eberesche"),
    mode: "animal",
    feature: tx("bright red berries", "leuchtend rote Beeren"),
    why: tx("Birds love the red berries and drop the seeds far away with their droppings.", "Vögel lieben die roten Beeren und scheiden die Samen weit entfernt wieder aus."),
  },
  {
    id: "balsam",
    name: tx("touch-me-not (balsam)", "Springkraut"),
    mode: "self",
    feature: tx("a capsule that bursts open", "eine Kapsel, die aufspringt"),
    why: tx("When you touch the ripe capsule it bursts and flings the seeds away.", "Berührt man die reife Kapsel, springt sie auf und schleudert die Samen weg."),
  },
  {
    id: "lupin",
    name: tx("lupin", "Lupine"),
    mode: "self",
    feature: tx("pods that twist open as they dry", "Hülsen, die beim Trocknen aufplatzen"),
    why: tx("The drying pods twist open with a snap and throw out the seeds.", "Die trocknenden Hülsen platzen mit einem Ruck auf und werfen die Samen heraus."),
  },
  {
    id: "coconut",
    name: tx("coconut palm", "Kokospalme"),
    mode: "water",
    feature: tx("a fibrous husk full of air", "eine faserige, luftgefüllte Hülle"),
    why: tx("The coconut floats: its husk is full of air. Sea currents carry it to other islands.", "Die Kokosnuss schwimmt, denn ihre Hülle ist voller Luft. Meeresströmungen tragen sie zu anderen Inseln."),
  },
  {
    id: "waterlily",
    name: tx("water lily", "Seerose"),
    mode: "water",
    feature: tx("seeds wrapped in a little air sac", "Samen mit einem kleinen Luftsack"),
    why: tx("Its seeds float in little air-filled sacs until the water carries them to a new spot.", "Ihre Samen schwimmen in kleinen luftgefüllten Hüllen, bis das Wasser sie an eine neue Stelle trägt."),
  },
];

export const plantById = (id: string) => DISPERSAL.find((p) => p.id === id)!;

// ---------------------------------------------------------------------------
// Level 2: insect and wind flowers

export type FlowerKind = "insect" | "wind";

export const FEATURES: { text: Text; kind: FlowerKind }[] = [
  { text: tx("large, colourful petals", "große, auffällig gefärbte Kronblätter"), kind: "insect" },
  { text: tx("a strong scent", "ein kräftiger Duft"), kind: "insect" },
  { text: tx("sweet nectar as a reward", "süßer Nektar als Belohnung"), kind: "insect" },
  { text: tx("sticky pollen that clings to insects", "klebriger Pollen, der an Insekten haften bleibt"), kind: "insect" },
  { text: tx("a small, sticky stigma inside the flower", "eine kleine, klebrige Narbe in der Blüte"), kind: "insect" },
  { text: tx("tiny or no petals, often green", "winzige oder keine Kronblätter, oft grün"), kind: "wind" },
  { text: tx("no scent and no nectar", "kein Duft und kein Nektar"), kind: "wind" },
  { text: tx("huge amounts of light, dry pollen", "riesige Mengen leichter, trockener Pollen"), kind: "wind" },
  { text: tx("large, feathery stigmas", "große, federartige Narben"), kind: "wind" },
  { text: tx("anthers dangling out on long filaments", "Staubbeutel, die an langen Staubfäden heraushängen"), kind: "wind" },
];

export const WIND_FLOWERS: { name: Text; look: Text }[] = [
  { name: tx("hazel", "Hasel"), look: tx("long yellow catkins hang from the branches in February and shed clouds of pollen. The female flowers show only tiny red, feathery stigmas.", "Im Februar hängen lange gelbe Kätzchen an den Zweigen und geben Wolken von Pollen ab. Die weiblichen Blüten zeigen nur winzige rote, fedrige Narben.") },
  { name: tx("rye", "Roggen"), look: tx("the flowers are hidden between green husks. Long anthers dangle out and big feathery stigmas stick out.", "Die Blüten stecken zwischen grünen Spelzen. Lange Staubbeutel baumeln heraus, und große federige Narben ragen hervor.") },
  { name: tx("maize", "Mais"), look: tx("the male flowers sit in a tassel at the top and release masses of pollen. The female cobs have long silky threads (the styles with stigmas).", "Die männlichen Blüten sitzen oben in einer Rispe und geben Unmengen Pollen ab. Die weiblichen Kolben haben lange seidige Fäden (Griffel mit Narben).") },
  { name: tx("birch", "Birke"), look: tx("brownish-yellow catkins without petals or scent hang in the wind.", "Bräunlich-gelbe Kätzchen ohne Kronblätter und ohne Duft hängen im Wind.") },
  { name: tx("ribwort plantain", "Spitzwegerich"), look: tx("small, plain brown flower heads on long stalks. The anthers stick far out on thin filaments.", "Kleine, unscheinbare bräunliche Blütenähren an langen Stielen. Die Staubbeutel ragen an dünnen Fäden weit heraus.") },
];
export const INSECT_FLOWERS: { name: Text; look: Text }[] = [
  { name: tx("rapeseed", "Raps"), look: tx("bright yellow, sweet-smelling flowers with nectar. The pollen is sticky.", "Leuchtend gelbe, süß duftende Blüten mit Nektar. Der Pollen ist klebrig.") },
  { name: tx("sage", "Salbei"), look: tx("violet flowers with a landing platform for bumblebees and nectar deep inside.", "Violette Blüten mit einer Landeplattform für Hummeln und Nektar tief im Inneren.") },
  { name: tx("apple", "Apfel"), look: tx("white to pink, fragrant flowers with nectar. A small sticky stigma sits in the middle.", "Weiße bis rosa, duftende Blüten mit Nektar. In der Mitte sitzt eine kleine klebrige Narbe.") },
  { name: tx("dead-nettle", "Taubnessel"), look: tx("white lip-shaped flowers with nectar at the bottom of a tube: a reward for bumblebees.", "Weiße Lippenblüten mit Nektar am Grund einer Röhre: eine Belohnung für Hummeln.") },
  { name: tx("clover", "Klee"), look: tx("pink, sweet-smelling flower heads full of nectar, visited by bees all day.", "Rosa, süß duftende Blütenköpfchen voller Nektar, die den ganzen Tag von Bienen besucht werden.") },
];

// ---------------------------------------------------------------------------
// Level 2: from pollen tube to seed

export const CHAIN2: Text[] = [
  tx("A pollen grain lands on the stigma (pollination)", "Ein Pollenkorn landet auf der Narbe (Bestäubung)"),
  tx("The pollen grain germinates and forms a pollen tube", "Das Pollenkorn keimt und bildet einen Pollenschlauch"),
  tx("The pollen tube grows down through the style", "Der Pollenschlauch wächst durch den Griffel nach unten"),
  tx("The tube enters the ovule through the micropyle", "Der Schlauch dringt durch die Mikropyle in die Samenanlage ein"),
  tx("The sperm cell fuses with the egg cell to form the zygote", "Die Spermazelle verschmilzt mit der Eizelle zur Zygote"),
  tx("The zygote develops into the embryo", "Aus der Zygote entwickelt sich der Keimling (Embryo)"),
  tx("The ovule becomes the seed, the ovary the fruit", "Die Samenanlage wird zum Samen, der Fruchtknoten zur Frucht"),
];

// ---------------------------------------------------------------------------
// Level 2: fruit types

export type FruitType = "drupe" | "berry" | "nut" | "capsule" | "aggregateNut" | "aggregateDrupe" | "legume";

export const FRUIT_TYPES: Record<FruitType, { name: Text; rule: Text }> = {
  drupe: { name: tx("drupe (stone fruit)", "Steinfrucht"), rule: tx("fleshy outside, hard stone inside", "außen fleischig, innen ein harter Steinkern") },
  berry: { name: tx("berry", "Beere"), rule: tx("the whole fruit wall is fleshy, usually many seeds", "die ganze Fruchtwand ist fleischig, meist viele Samen") },
  nut: { name: tx("nut", "Nuss"), rule: tx("the whole fruit wall is hard and woody, stays closed", "die ganze Fruchtwand ist hart und verholzt und bleibt geschlossen") },
  capsule: { name: tx("capsule", "Kapsel"), rule: tx("dry fruit wall that opens and releases many seeds", "trockene Fruchtwand, die sich öffnet und viele Samen entlässt") },
  aggregateNut: { name: tx("aggregate fruit of nutlets", "Sammelnussfrucht"), rule: tx("many tiny nutlets on a fleshy receptacle", "viele winzige Nüsschen auf einem fleischigen Blütenboden") },
  aggregateDrupe: { name: tx("aggregate fruit of drupelets", "Sammelsteinfrucht"), rule: tx("many tiny stone fruits stuck together", "viele winzige Steinfrüchtchen, die zusammenhängen") },
  legume: { name: tx("legume (pod)", "Hülse"), rule: tx("dry pod that splits along two seams", "trockene Frucht, die an zwei Nähten aufspringt") },
};

/** Fruits with their type; `pic` names a section drawing (FlowerFruitSection) if there is one. */
export const FRUIT_BANK: { name: Text; type: FruitType; pic?: "cherry" | "tomato" | "hazel" | "poppy" | "strawberry" }[] = [
  { name: tx("cherry", "Kirsche"), type: "drupe", pic: "cherry" },
  { name: tx("plum", "Pflaume"), type: "drupe" },
  { name: tx("peach", "Pfirsich"), type: "drupe" },
  { name: tx("apricot", "Aprikose"), type: "drupe" },
  { name: tx("nectarine", "Nektarine"), type: "drupe" },
  { name: tx("tomato", "Tomate"), type: "berry", pic: "tomato" },
  { name: tx("grape", "Weintraube"), type: "berry" },
  { name: tx("blueberry", "Heidelbeere"), type: "berry" },
  { name: tx("pepper", "Paprika"), type: "berry" },
  { name: tx("redcurrant", "Johannisbeere"), type: "berry" },
  { name: tx("hazelnut", "Haselnuss"), type: "nut", pic: "hazel" },
  { name: tx("acorn", "Eichel"), type: "nut" },
  { name: tx("beechnut", "Buchecker"), type: "nut" },
  { name: tx("poppy", "Mohn"), type: "capsule", pic: "poppy" },
  { name: tx("tulip", "Tulpe"), type: "capsule" },
  { name: tx("violet", "Veilchen"), type: "capsule" },
  { name: tx("strawberry", "Erdbeere"), type: "aggregateNut", pic: "strawberry" },
  { name: tx("raspberry", "Himbeere"), type: "aggregateDrupe" },
  { name: tx("blackberry", "Brombeere"), type: "aggregateDrupe" },
  { name: tx("pea", "Erbse"), type: "legume" },
  { name: tx("bean", "Bohne"), type: "legume" },
];

// ---------------------------------------------------------------------------
// Level 2: seeds, germination and vegetative reproduction

export type SeedPart = "coat" | "hilum" | "cotyledon" | "plumule" | "stem" | "radicle";
export const SEED_PARTS: Record<SeedPart, { name: Text; job: Text }> = {
  coat: { name: tx("seed coat", "Samenschale"), job: tx("protects the embryo", "schützt den Keimling") },
  hilum: { name: tx("hilum", "Nabel"), job: tx("scar where the seed was attached", "Narbe, an der der Samen festgewachsen war") },
  cotyledon: { name: tx("cotyledon", "Keimblatt"), job: tx("stores food for the embryo", "speichert Nährstoffe für den Keimling") },
  plumule: { name: tx("shoot bud", "Sprossknospe"), job: tx("grows into the shoot with the first leaves", "wächst zum Spross mit den ersten Laubblättern") },
  stem: { name: tx("embryonic stem", "Keimstängel"), job: tx("connects root and shoot, lifts the cotyledons", "verbindet Wurzel und Spross, hebt die Keimblätter") },
  radicle: { name: tx("embryonic root", "Keimwurzel"), job: tx("grows into the first root", "wächst zur ersten Wurzel") },
};

export const GERM_CHAIN: Text[] = [
  tx("The seed soaks up water and swells", "Der Samen nimmt Wasser auf und quillt"),
  tx("The seed coat bursts and the embryonic root breaks out", "Die Samenschale platzt und die Keimwurzel bricht heraus"),
  tx("The embryonic stem pushes up through the soil in a hook", "Der Keimstängel schiebt sich hakenförmig durch die Erde"),
  tx("The cotyledons come above ground and turn green", "Die Keimblätter kommen über die Erde und ergrünen"),
  tx("The first true leaves unfold", "Die ersten Laubblätter entfalten sich"),
  tx("The cotyledons shrivel and fall off", "Die Keimblätter schrumpfen und fallen ab"),
];

export type Dish = { id: string; water: "dry" | "moist" | "under"; cold: boolean; dark: boolean };
export const DISHES: Dish[] = [
  { id: "A", water: "dry", cold: false, dark: false },
  { id: "B", water: "moist", cold: false, dark: false },
  { id: "C", water: "moist", cold: true, dark: false },
  { id: "D", water: "under", cold: false, dark: false },
  { id: "E", water: "moist", cold: false, dark: true },
];
export const germinates = (d: Dish) => d.water === "moist" && !d.cold;

export type Vegetative = "runner" | "tuber" | "bulb" | "cutting" | "rhizome" | "plantlets";
export const VEG_ORGANS: Record<Vegetative, { name: Text; what: Text }> = {
  runner: { name: tx("runners", "Ausläufer"), what: tx("long side shoots above ground that root at their tips", "lange oberirdische Seitensprosse, die an der Spitze wurzeln") },
  tuber: { name: tx("tubers", "Knollen"), what: tx("thickened underground shoots full of starch", "verdickte unterirdische Sprosse voller Stärke") },
  bulb: { name: tx("bulbs", "Zwiebeln"), what: tx("a short shoot with thick storage leaves and daughter bulbs", "ein kurzer Spross mit dicken Speicherblättern und Tochterzwiebeln") },
  cutting: { name: tx("cuttings", "Stecklinge"), what: tx("cut-off shoots that grow roots", "abgeschnittene Triebe, die Wurzeln bilden") },
  rhizome: { name: tx("rhizomes (underground stems)", "Erdsprosse (Rhizome)"), what: tx("shoots that creep sideways under the ground", "Sprosse, die waagerecht unter der Erde wachsen") },
  plantlets: { name: tx("plantlets on the leaf edge", "Brutknospen am Blattrand"), what: tx("tiny plants that drop off the leaves", "winzige Pflänzchen, die vom Blatt abfallen") },
};
export const VEG_PLANTS: { name: Text; how: Vegetative }[] = [
  { name: tx("strawberry", "Erdbeere"), how: "runner" },
  { name: tx("potato", "Kartoffel"), how: "tuber" },
  { name: tx("tulip", "Tulpe"), how: "bulb" },
  { name: tx("onion", "Küchenzwiebel"), how: "bulb" },
  { name: tx("geranium", "Geranie"), how: "cutting" },
  { name: tx("willow", "Weide"), how: "cutting" },
  { name: tx("couch grass", "Quecke"), how: "rhizome" },
  { name: tx("reed", "Schilf"), how: "rhizome" },
  { name: tx("mother of thousands (Kalanchoe)", "Brutblatt (Kalanchoe)"), how: "plantlets" },
];

// ---------------------------------------------------------------------------
// Level 3: chromosome sets

/** Species with their diploid chromosome number. */
export const SPECIES: { name: Text; n2: number }[] = [
  { name: tx("sweet cherry", "Süßkirsche"), n2: 16 },
  { name: tx("maize", "Mais"), n2: 20 },
  { name: tx("tomato", "Tomate"), n2: 24 },
  { name: tx("pea", "Erbse"), n2: 14 },
  { name: tx("common bean", "Gartenbohne"), n2: 22 },
  { name: tx("sunflower", "Sonnenblume"), n2: 34 },
  { name: tx("barley", "Gerste"), n2: 14 },
  { name: tx("rice", "Reis"), n2: 24 },
  { name: tx("thale cress (Arabidopsis)", "Ackerschmalwand (Arabidopsis)"), n2: 10 },
];

export type Ploidy = 1 | 2 | 3;
export type Structure = { id: string; name: Text; ploidy: Ploidy; why: Text; maternal?: boolean; /** with an article, as the object of "How many chromosomes does … have?" */ obj: Text };

export const STRUCTURES: Structure[] = [
  { id: "egg", obj: tx("an egg cell", "eine Eizelle"), name: tx("egg cell", "Eizelle"), ploidy: 1, why: tx("The egg cell is a gamete, made by mitosis in the haploid embryo sac.", "Die Eizelle ist ein Gamet, gebildet durch Mitose im haploiden Embryosack.") },
  { id: "sperm", obj: tx("a sperm cell", "eine Spermazelle"), name: tx("sperm cell", "Spermazelle"), ploidy: 1, why: tx("Sperm cells come from the generative cell of the haploid pollen grain.", "Spermazellen stammen aus der generativen Zelle des haploiden Pollenkorns.") },
  { id: "synergid", obj: tx("a synergid", "eine Synergide"), name: tx("synergid", "Synergide"), ploidy: 1, why: tx("All cells of the embryo sac are haploid: it is the female gametophyte.", "Alle Zellen des Embryosacks sind haploid: Er ist der weibliche Gametophyt.") },
  { id: "antipode", obj: tx("an antipodal cell", "eine Antipode"), name: tx("antipodal cell", "Antipode"), ploidy: 1, why: tx("All cells of the embryo sac are haploid: it is the female gametophyte.", "Alle Zellen des Embryosacks sind haploid: Er ist der weibliche Gametophyt.") },
  { id: "polar", obj: tx("one polar nucleus", "ein einzelner Polkern"), name: tx("polar nucleus (one of them)", "Polkern (einer davon)"), ploidy: 1, why: tx("Each polar nucleus is one of the eight haploid nuclei of the embryo sac.", "Jeder Polkern ist einer der acht haploiden Kerne des Embryosacks.") },
  { id: "tubenucleus", obj: tx("the vegetative nucleus of the pollen tube", "der vegetative Kern des Pollenschlauchs"), name: tx("vegetative nucleus of the pollen tube", "vegetativer Kern des Pollenschlauchs"), ploidy: 1, why: tx("The pollen grain is the male gametophyte: all its nuclei are haploid.", "Das Pollenkorn ist der männliche Gametophyt: Alle seine Kerne sind haploid.") },
  { id: "megaspore", obj: tx("a megaspore", "eine Megaspore"), name: tx("megaspore", "Megaspore"), ploidy: 1, why: tx("Megaspores are the products of meiosis: haploid.", "Megasporen sind Produkte der Meiose: haploid.") },
  { id: "zygote", obj: tx("the zygote", "die Zygote"), name: tx("zygote", "Zygote"), ploidy: 2, why: tx("Sperm cell (n) + egg cell (n) = zygote (2n).", "Spermazelle (n) + Eizelle (n) = Zygote (2n).") },
  { id: "embryo", obj: tx("a cell of the embryo", "eine Zelle des Embryos"), name: tx("cell of the embryo", "Zelle des Embryos"), ploidy: 2, why: tx("The embryo grows from the zygote by mitosis: diploid.", "Der Embryo entsteht durch Mitosen aus der Zygote: diploid.") },
  { id: "coat", obj: tx("a cell of the seed coat", "eine Zelle der Samenschale"), name: tx("cell of the seed coat", "Zelle der Samenschale"), ploidy: 2, maternal: true, why: tx("The seed coat comes from the integuments: tissue of the diploid mother plant, untouched by fertilisation.", "Die Samenschale entsteht aus den Integumenten: Gewebe der diploiden Mutterpflanze, von der Befruchtung unberührt.") },
  { id: "flesh", obj: tx("a cell of the fruit flesh", "eine Zelle des Fruchtfleischs"), name: tx("cell of the fruit flesh", "Zelle des Fruchtfleischs"), ploidy: 2, maternal: true, why: tx("The fruit wall comes from the ovary wall: tissue of the diploid mother plant.", "Die Fruchtwand entsteht aus der Fruchtknotenwand: Gewebe der diploiden Mutterpflanze.") },
  { id: "nucellus", obj: tx("a cell of the nucellus", "eine Zelle des Nucellus"), name: tx("cell of the nucellus", "Zelle des Nucellus"), ploidy: 2, maternal: true, why: tx("The nucellus is tissue of the mother plant (sporophyte): diploid.", "Der Nucellus ist Gewebe der Mutterpflanze (Sporophyt): diploid.") },
  { id: "mmc", obj: tx("the megaspore mother cell", "die Megasporenmutterzelle"), name: tx("megaspore mother cell", "Megasporenmutterzelle"), ploidy: 2, why: tx("It still belongs to the sporophyte and only becomes haploid through meiosis.", "Sie gehört noch zum Sporophyten und wird erst durch die Meiose haploid.") },
  { id: "endo", obj: tx("a cell of the endosperm", "eine Zelle des Endosperms"), name: tx("cell of the endosperm", "Zelle des Endosperms"), ploidy: 3, why: tx("Sperm cell (n) + central cell with two polar nuclei (n + n) = endosperm (3n).", "Spermazelle (n) + Zentralzelle mit zwei Polkernen (n + n) = Endosperm (3n).") },
  { id: "endonucleus", obj: tx("the primary endosperm nucleus", "der primäre Endospermkern"), name: tx("primary endosperm nucleus", "primärer Endospermkern"), ploidy: 3, why: tx("Sperm cell (n) + two polar nuclei (n + n) = 3n.", "Spermazelle (n) + zwei Polkerne (n + n) = 3n.") },
];

export const PLOIDY_NAME: Record<Ploidy, string> = { 1: "n", 2: "2n", 3: "3n" };

// ---------------------------------------------------------------------------
// Level 3: process chains

export const CHAINS3: { name: Text; items: Text[]; short: Text[]; slips: { first: number; then: number; title: Text; say: Text }[] }[] = [
  {
    name: tx("From the pollen mother cell to the sperm cells", "Von der Pollenmutterzelle zu den Spermazellen"),
    items: [
      tx("Pollen mother cell (2n) in the anther", "Pollenmutterzelle (2n) im Staubbeutel"),
      tx("Meiosis: four microspores (n)", "Meiose: vier Mikrosporen (n)"),
      tx("First pollen mitosis: vegetative and generative cell", "Erste Pollenmitose: vegetative und generative Zelle"),
      tx("The pollen grain germinates on the stigma", "Das Pollenkorn keimt auf der Narbe"),
      tx("Second pollen mitosis (in the cherry inside the pollen tube): two sperm cells", "Zweite Pollenmitose (bei der Kirsche im Pollenschlauch): zwei Spermazellen"),
    ],
    short: [tx("pollen mother cell", "Pollenmutterzelle"), tx("meiosis", "Meiose"), tx("1st pollen mitosis", "1. Pollenmitose"), tx("germination", "Keimung"), tx("2nd pollen mitosis", "2. Pollenmitose")],
    slips: [
      { first: 2, then: 1, title: tx("Meiosis first", "Erst die Meiose"), say: tx("The haploid microspores have to exist before they can divide by mitosis.", "Erst müssen durch Meiose haploide Mikrosporen entstehen, dann können sie sich mitotisch teilen.") },
      { first: 4, then: 2, title: tx("Generative cell first", "Erst die generative Zelle"), say: tx("The two sperm cells come from the generative cell, so the first pollen mitosis must come before.", "Die zwei Spermazellen entstehen aus der generativen Zelle, also muss die erste Pollenmitose vorher kommen.") },
    ],
  },
  {
    name: tx("From the megaspore mother cell to the embryo sac", "Von der Megasporenmutterzelle zum Embryosack"),
    items: [
      tx("Megaspore mother cell (2n) in the nucellus", "Megasporenmutterzelle (2n) im Nucellus"),
      tx("Meiosis: four megaspores (n)", "Meiose: vier Megasporen (n)"),
      tx("Three megaspores die", "Drei Megasporen gehen zugrunde"),
      tx("Three mitoses: eight nuclei", "Drei Mitosen: acht Kerne"),
      tx("Cell walls form: seven cells", "Zellwände bilden sich: sieben Zellen"),
    ],
    short: [tx("mother cell (2n)", "Mutterzelle (2n)"), tx("meiosis: 4 megaspores", "Meiose: 4 Megasporen"), tx("3 of them die", "3 gehen zugrunde"), tx("3 mitoses: 8 nuclei", "3 Mitosen: 8 Kerne"), tx("7 cells", "7 Zellen")],
    slips: [
      { first: 3, then: 2, title: tx("Only one survivor divides", "Nur die Überlebende teilt sich"), say: tx("The mitoses happen in the one surviving megaspore, so three have to die first.", "Die Mitosen laufen in der einen überlebenden Megaspore ab. Erst gehen also drei zugrunde.") },
      { first: 4, then: 3, title: tx("Nuclei before cells", "Erst Kerne, dann Zellen"), say: tx("The eight nuclei form first without walls. Only then are the cells separated.", "Erst entstehen die acht Kerne ohne Zellwände. Danach werden die Zellen abgegrenzt.") },
      { first: 3, then: 1, title: tx("Meiosis first", "Erst die Meiose"), say: tx("The embryo sac is haploid: meiosis must come before the mitoses.", "Der Embryosack ist haploid: Die Meiose muss vor den Mitosen kommen.") },
    ],
  },
  {
    name: tx("Double fertilisation", "Doppelte Befruchtung"),
    items: [
      tx("A pollen grain germinates on the stigma", "Ein Pollenkorn keimt auf der Narbe"),
      tx("The pollen tube grows through the style", "Der Pollenschlauch wächst durch den Griffel"),
      tx("The tube enters the ovule through the micropyle", "Der Schlauch dringt durch die Mikropyle in die Samenanlage ein"),
      tx("It bursts into a synergid and releases two sperm cells", "Er entlädt sich in eine Synergide und gibt zwei Spermazellen frei"),
      tx("Zygote (2n) and endosperm nucleus (3n) form", "Zygote (2n) und Endospermkern (3n) entstehen"),
      tx("Embryo and endosperm develop in the seed", "Embryo und Endosperm entwickeln sich im Samen"),
    ],
    short: [tx("germination", "Keimung"), tx("through the style", "durch den Griffel"), tx("micropyle", "Mikropyle"), tx("synergid", "Synergide"), tx("zygote and endosperm nucleus", "Zygote und Endospermkern"), tx("embryo and endosperm", "Embryo und Endosperm")],
    slips: [
      { first: 3, then: 2, title: tx("Enter first", "Erst eindringen"), say: tx("The synergids sit inside the embryo sac: the tube must pass the micropyle first.", "Die Synergiden liegen im Embryosack: Der Schlauch muss erst durch die Mikropyle.") },
      { first: 4, then: 3, title: tx("Release first", "Erst freisetzen"), say: tx("The sperm cells can only fuse after the tube has released them.", "Die Spermazellen können erst verschmelzen, wenn der Schlauch sie freigegeben hat.") },
    ],
  },
  {
    name: tx("Alternation of generations in a seed plant", "Generationswechsel einer Samenpflanze"),
    items: [
      tx("Sporophyte (2n): the cherry tree", "Sporophyt (2n): der Kirschbaum"),
      tx("Meiosis: spores (n)", "Meiose: Sporen (n)"),
      tx("Gametophytes (n): pollen grain and embryo sac", "Gametophyten (n): Pollenkorn und Embryosack"),
      tx("Gametes (n) by mitosis", "Gameten (n) durch Mitose"),
      tx("Fertilisation: zygote (2n)", "Befruchtung: Zygote (2n)"),
      tx("Embryo in the seed: a new sporophyte", "Embryo im Samen: ein neuer Sporophyt"),
    ],
    short: [tx("sporophyte (2n)", "Sporophyt (2n)"), tx("spores (n)", "Sporen (n)"), tx("gametophytes (n)", "Gametophyten (n)"), tx("gametes (n)", "Gameten (n)"), tx("zygote (2n)", "Zygote (2n)"), tx("embryo (2n)", "Embryo (2n)")],
    slips: [
      { first: 3, then: 2, title: tx("Gametophytes make gametes", "Gametophyten bilden Gameten"), say: tx("In plants, meiosis makes spores. The gametes are made later by mitosis in the gametophyte.", "Bei Pflanzen bildet die Meiose Sporen. Die Gameten entstehen erst später durch Mitose im Gametophyten.") },
      { first: 2, then: 1, title: tx("Spores first", "Erst Sporen"), say: tx("Each gametophyte grows from a haploid spore, so meiosis comes first.", "Jeder Gametophyt wächst aus einer haploiden Spore, also kommt die Meiose zuerst.") },
    ],
  },
];
