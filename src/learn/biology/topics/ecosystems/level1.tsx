"use client";

import { tx } from "@/i18n/text";
import { EcoFoodWebBuilder } from "@/learn/biology/visuals/EcoFoodWeb";
import { EcoForestLayers } from "@/learn/biology/visuals/EcoForestLayers";
import { EcoMatterCycle } from "@/learn/biology/visuals/EcoMatterCycle";
import { createRng } from "@/learn/engine/rng";
import type { Frame, LevelLesson } from "@/learn/types";
import { CHAINS, LAYER_MEMBERS, nameOf } from "./data";
import { chainMath, join, q } from "./kit";
import { consumerOrderTask, dropoutTask, layerWhereTask, roleTask } from "./tasks1";

export { generate1 } from "./tasks1";

// ---------------------------------------------------------------------------
// Frames

const ecosystemFrames: Frame[] = [
  {
    math: tx('"biotope"#b', '"Biotop"#b'),
    note: tx(
      "The **biotope** is the habitat with its non-living conditions: light, temperature, water, soil and air.",
      "Der **Biotop** ist der Lebensraum mit seinen unbelebten Bedingungen: Licht, Temperatur, Wasser, Boden und Luft.",
    ),
  },
  {
    math: tx('"biotope"#b +#p "biocoenosis"#z', '"Biotop"#b +#p "Biozönose"#z'),
    note: tx(
      "The **biocoenosis** is the community: all the plants, animals, fungi and bacteria that live there together.",
      "Die **Biozönose** ist die Lebensgemeinschaft: alle Pflanzen, Tiere, Pilze und Bakterien, die dort zusammenleben.",
    ),
  },
  {
    math: tx('"biotope"#b +#p "biocoenosis"#z =#e "ecosystem"#o', '"Biotop"#b +#p "Biozönose"#z =#e "Ökosystem"#o'),
    note: tx("Together they form an **ecosystem**. Living things and their habitat affect each other.", "Zusammen bilden sie ein **Ökosystem**. Lebewesen und Lebensraum beeinflussen sich gegenseitig."),
    highlight: ["o"],
  },
  {
    math: tx('"ecosystems:"#o \\; "forest, meadow, lake"#x', '"Ökosysteme:"#o \\; "Wald, Wiese, See"#x'),
    note: tx("Examples: forest, meadow, lake, hedge, bog or stream. Even a garden pond is a small ecosystem.", "Beispiele: Wald, Wiese, See, Hecke, Moor oder Bach. Sogar ein Gartenteich ist ein kleines Ökosystem."),
  },
];

const GRASS = tx("grass", "Gras");
const HARE = tx("brown hare", "Feldhase");
const FOX = tx("fox", "Fuchs");

const chainFrames: Frame[] = [
  {
    math: q(GRASS, "a"),
    note: tx("Every food chain starts with a plant. It makes its own food using sunlight.", "Jede Nahrungskette beginnt mit einer Pflanze. Sie stellt mit Sonnenlicht ihre Nährstoffe selbst her."),
  },
  {
    math: join(q(GRASS, "a"), "\\to#p1", q(HARE, "b")),
    note: tx("The brown hare eats the grass. The arrow means **\"is eaten by\"**: it points from the eaten to the eater.", "Der Feldhase frisst das Gras. Der Pfeil bedeutet **„wird gefressen von“**: Er zeigt vom Gefressenen zum Fresser."),
    highlight: ["p1"],
  },
  {
    math: join(q(GRASS, "a"), "\\to#p1", q(HARE, "b"), "\\to#p2", q(FOX, "c")),
    note: tx("The fox eats the hare. That's a **food chain**.", "Der Fuchs frisst den Feldhasen. Das ist eine **Nahrungskette**."),
  },
  {
    math: join(q(GRASS, "a"), "\\to#p1", q(HARE, "b"), "\\to#p2", q(FOX, "c")),
    note: tx(
      "The arrows also show where the nutrients and the energy go: from the grass into the hare and on into the fox.",
      "Die Pfeile zeigen auch, wohin die Nährstoffe und die Energie fließen: vom Gras in den Hasen und weiter in den Fuchs.",
    ),
    highlight: ["p1", "p2"],
  },
  {
    math: chainMath(CHAINS[15].ids.map(nameOf)),
    note: tx("In the lake: algae → water flea → roach → pike. Food chains usually have 3 to 5 links.", "Im See: Algen → Wasserfloh → Rotauge → Hecht. Nahrungsketten haben meist 3 bis 5 Glieder."),
  },
];

const roleFrames: Frame[] = [
  {
    math: join(q(GRASS, "a"), "\\Rightarrow#r", q(tx("producer", "Produzent"), "p")),
    note: tx("**Producers** are green plants and algae. They make food by photosynthesis, for themselves and for everyone else.", "**Produzenten** (Erzeuger) sind grüne Pflanzen und Algen. Sie stellen durch Fotosynthese Nährstoffe her, für sich und für alle anderen."),
    highlight: ["p"],
  },
  {
    math: join(q(HARE, "a"), "\\Rightarrow#r", q(tx("primary consumer (1st order)", "Konsument 1. Ordnung"), "p")),
    note: tx("**Consumers** eat other living things. Animals that eat plants are **primary consumers** (consumers of the 1st order): herbivores.", "**Konsumenten** (Verbraucher) fressen andere Lebewesen. Wer Pflanzen frisst, ist **Konsument 1. Ordnung**: ein Pflanzenfresser."),
    highlight: ["p"],
  },
  {
    math: join(q(FOX, "a"), "\\Rightarrow#r", q(tx("secondary consumer (2nd order)", "Konsument 2. Ordnung"), "p")),
    note: tx("Who eats herbivores is a **consumer of the 2nd order** (a carnivore). Who eats those is a consumer of the 3rd order.", "Wer Pflanzenfresser frisst, ist **Konsument 2. Ordnung** (Fleischfresser). Wer diese frisst, ist Konsument 3. Ordnung."),
    highlight: ["p"],
  },
  {
    math: join(q(tx("wild boar", "Wildschwein"), "a"), "\\Rightarrow#r", q(tx("omnivore", "Allesfresser"), "p")),
    note: tx("**Omnivores** eat plants and animals, for example wild boar, badger and humans. So they can sit at several levels.", "**Allesfresser** fressen Pflanzen und Tiere, zum Beispiel Wildschwein, Dachs und Mensch. Deshalb können sie auf mehreren Stufen stehen."),
    highlight: ["p"],
  },
  {
    math: join(q(tx("fungi, bacteria, earthworm", "Pilze, Bakterien, Regenwurm"), "a"), "\\Rightarrow#r", q(tx("decomposers", "Destruenten"), "p")),
    note: tx(
      "**Decomposers** break down dead remains: leaves, dead animals, droppings. They are a group of their own, neither producers nor consumers.",
      "**Destruenten** (Zersetzer) bauen tote Reste ab: Laub, tote Tiere, Kot. Sie sind eine eigene Gruppe, weder Produzenten noch Konsumenten.",
    ),
    highlight: ["p"],
  },
];

// ---------------------------------------------------------------------------
// Checks (fixed tasks)

const anemone = LAYER_MEMBERS.find((m) => m.name && typeof m.name !== "string" && m.name.en === "wood anemone")!;
const checkLayer = layerWhereTask(createRng(5), anemone);
const frogChain = CHAINS.find((c) => c.ids.join() === "grass,grasshopper,frog,stork")!;
const checkOrder = consumerOrderTask(createRng(2), frogChain, 2);
const checkMould = roleTask(createRng(1), "mould");
const foxChain = CHAINS.find((c) => c.ids.join() === "grass,hare,fox")!;
const checkFox = dropoutTask(createRng(1), { chain: foxChain, gone: 2, ask: 1 });

const ForestWidget = () => <EcoForestLayers mode="explore" />;
const WebWidget = () => <EcoFoodWebBuilder start="meadow" />;

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("What is an ecosystem?", "Was ist ein Ökosystem?"),
      blob: tx("Forest, meadow, lake: let's find out what they have in common!", "Wald, Wiese, See: Finden wir heraus, was sie gemeinsam haben!"),
      body: tx(
        "Living things never live on their own. They share a habitat and depend on each other. Habitat and community together are called an **ecosystem**.",
        "Lebewesen leben nie für sich allein. Sie teilen sich einen Lebensraum und sind voneinander abhängig. Lebensraum und Lebensgemeinschaft zusammen nennt man **Ökosystem**.",
      ),
      frames: ecosystemFrames,
    },
    {
      type: "widget",
      title: tx("The layers of the forest", "Die Stockwerke des Waldes"),
      blob: tx("Let's climb through the forest, from the treetops down into the soil!", "Lass uns durch den Wald klettern, von den Baumkronen bis in den Boden!"),
      body: tx(
        "A forest is built in layers, like a house with storeys. Each layer gets a different amount of light, so different plants and animals live there. Tap the numbers!",
        "Ein Wald ist in Schichten aufgebaut, wie ein Haus mit Stockwerken. Jedes Stockwerk bekommt unterschiedlich viel Licht, deshalb leben dort verschiedene Pflanzen und Tiere. Tippe auf die Nummern!",
      ),
      widget: ForestWidget,
    },
    { type: "check", blob: tx("The wood anemone flowers in early spring. Where does it grow?", "Das Buschwindröschen blüht schon im Vorfrühling. Wo wächst es?"), exercise: checkLayer },
    {
      type: "explain",
      title: tx("Food chains", "Nahrungsketten"),
      blob: tx("Who eats whom? Follow the arrows!", "Wer frisst wen? Folge den Pfeilen!"),
      frames: chainFrames,
    },
    {
      type: "explain",
      title: tx("Producers, consumers, decomposers", "Produzenten, Konsumenten, Destruenten"),
      blob: tx("Everyone in an ecosystem has a job. Here are the three big groups.", "Im Ökosystem hat jeder eine Aufgabe. Hier sind die drei großen Gruppen."),
      frames: roleFrames,
    },
    { type: "check", blob: tx("Careful when you count!", "Vorsicht beim Zählen!"), exercise: checkOrder },
    {
      type: "widget",
      title: tx("Decomposers close the cycle", "Destruenten schließen den Kreislauf"),
      blob: tx("Where do all the fallen leaves go? Follow the dot!", "Wo bleibt eigentlich das ganze Laub? Folge dem Punkt!"),
      body: tx(
        "Without decomposers the forest would drown in dead leaves. They turn dead remains back into minerals that plants can use again: the substances go round in a **cycle**.",
        "Ohne Destruenten würde der Wald im Laub ersticken. Sie machen aus toten Resten wieder Mineralstoffe, die Pflanzen erneut nutzen: Die Stoffe gehen im **Kreislauf**.",
      ),
      widget: EcoMatterCycle,
    },
    { type: "check", blob: tx("Mould on old bread. Plant, animal or something else?", "Schimmel auf altem Brot. Pflanze, Tier oder etwas anderes?"), exercise: checkMould },
    {
      type: "widget",
      title: tx("Build a food web", "Bau ein Nahrungsnetz"),
      blob: tx("Now you're the builder! And then we'll see what happens without the fox.", "Jetzt baust du! Und dann schauen wir, was ohne den Fuchs passiert."),
      body: tx(
        "Most animals eat more than one kind of food and are eaten by more than one enemy. Many linked food chains form a **food web**. Draw the arrows, then let a species disappear.",
        "Die meisten Tiere fressen mehr als eine Sorte Nahrung und haben mehrere Fressfeinde. Viele verknüpfte Nahrungsketten bilden ein **Nahrungsnetz**. Zieh die Pfeile, dann lass eine Art verschwinden.",
      ),
      widget: WebWidget,
    },
    { type: "check", blob: tx("Last one: one link drops out of the chain.", "Zum Schluss: Ein Glied fällt aus der Kette."), exercise: checkFox },
  ],
  summary: [
    {
      title: tx("Ecosystem", "Ökosystem"),
      body: tx(
        "Biotope (habitat with its non-living conditions such as light, water, soil) + biocoenosis (all the living things there) = ecosystem. Examples: forest, meadow, lake.",
        "Biotop (Lebensraum mit unbelebten Bedingungen wie Licht, Wasser, Boden) + Biozönose (alle Lebewesen dort) = Ökosystem. Beispiele: Wald, Wiese, See.",
      ),
      examples: [tx('"ecosystem" = "biotope" + "biocoenosis"', '"Ökosystem" = "Biotop" + "Biozönose"')],
      tone: "rule",
    },
    {
      title: tx("Food chain and food web", "Nahrungskette und Nahrungsnetz"),
      body: tx(
        "The arrow means \"is eaten by\": it points from the eaten to the eater. Many linked food chains form a food web.",
        "Der Pfeil bedeutet „wird gefressen von“: Er zeigt vom Gefressenen zum Fresser. Viele verknüpfte Nahrungsketten bilden ein Nahrungsnetz.",
      ),
      examples: [tx('"grass" \\to "hare" \\to "fox"', '"Gras" \\to "Feldhase" \\to "Fuchs"')],
      tone: "rule",
    },
    {
      title: tx("Producers, consumers, decomposers", "Produzenten, Konsumenten, Destruenten"),
      body: tx(
        "Producers (green plants, algae) make food with light. Consumers eat others: primary consumers are herbivores, secondary and tertiary consumers carnivores; omnivores eat both. Decomposers (soil animals, bacteria, fungi) break down dead remains.",
        "Produzenten (grüne Pflanzen, Algen) stellen mit Licht Nährstoffe her. Konsumenten fressen andere: Konsumenten 1. Ordnung sind Pflanzenfresser, 2. und 3. Ordnung Fleischfresser; Allesfresser fressen beides. Destruenten (Bodentiere, Bakterien, Pilze) bauen tote Reste ab.",
      ),
      examples: [tx('"P" \\to "C1" \\to "C2" \\to "C3"', '"P" \\to "K1" \\to "K2" \\to "K3"')],
      tone: "rule",
    },
    {
      title: tx("The cycle of matter", "Der Stoffkreislauf"),
      body: tx(
        "Decomposers turn dead remains into minerals, water and carbon dioxide. Plants take them up again: the substances go round in a cycle.",
        "Destruenten machen aus toten Resten Mineralstoffe, Wasser und Kohlenstoffdioxid. Pflanzen nehmen sie wieder auf: Die Stoffe gehen im Kreislauf.",
      ),
      examples: [tx('"producers" \\to "consumers" \\\\ \\to "decomposers" \\to "minerals"', '"Produzenten" \\to "Konsumenten" \\\\ \\to "Destruenten" \\to "Mineralstoffe"')],
      tone: "tip",
    },
    {
      title: tx("Layers of the forest", "Stockwerke des Waldes"),
      body: tx(
        "From top to bottom: tree layer (above 5 m), shrub layer (1 to 5 m), herb layer (up to 1 m), moss layer (a few cm), root layer (soil). Early bloomers in the herb layer flower before the trees come into leaf.",
        "Von oben nach unten: Baumschicht (über 5 m), Strauchschicht (1 bis 5 m), Krautschicht (bis 1 m), Moosschicht (wenige cm), Wurzelschicht (Boden). Frühblüher der Krautschicht blühen, bevor die Bäume Blätter haben.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Arrows never point from the eater to its food. The plant is the producer, the first animal the primary consumer: don't count the plant. Fungi are not plants: no photosynthesis, they are decomposers. If a predator disappears, its prey first increases.",
        "Pfeile zeigen nie vom Fresser zur Nahrung. Die Pflanze ist der Produzent, erst das erste Tier ist Konsument 1. Ordnung: Die Pflanze nicht mitzählen. Pilze sind keine Pflanzen: keine Fotosynthese, sie sind Destruenten. Fällt ein Räuber aus, nimmt seine Beute zuerst zu.",
      ),
      tone: "warning",
    },
  ],
};
