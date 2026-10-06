"use client";

import { tx } from "@/i18n/text";
import { EcoNitrogenCycle } from "@/learn/biology/visuals/EcoCycles";
import { EcoGrowth } from "@/learn/biology/visuals/EcoGrowth";
import { EcoLakeSeasons } from "@/learn/biology/visuals/EcoLake";
import { EcoLotkaVolterra } from "@/learn/biology/visuals/EcoPredatorPrey";
import { createRng } from "@/learn/engine/rng";
import type { Frame, LevelLesson } from "@/learn/types";
import { expGrowthTask, lvRuleTask, nitrogenMatchTask, nppTask } from "./tasks3";

export { generate3 } from "./tasks3";

// ---------------------------------------------------------------------------
// Frames

const growthFrames: Frame[] = [
  {
    math: "N(t)#N =#e N_0#n0 \\cdot#c 2^{\\frac{t}{t_D}}#p",
    note: tx(
      "With unlimited resources a population grows **exponentially**: it doubles in equal time steps (doubling time $t_D$). The curve is J-shaped.",
      "Bei unbegrenzten Ressourcen wächst eine Population **exponentiell**: Sie verdoppelt sich in gleichen Zeitabständen (Verdopplungszeit $t_D$). Die Kurve ist J-förmig.",
    ),
  },
  {
    math: tx('N(6 "h")#N =#e 100#n0 \\cdot#c 2^{\\frac{6}{2}}#p = 800#r', 'N(6 "h")#N =#e 100#n0 \\cdot#c 2^{\\frac{6}{2}}#p = 800#r'),
    note: tx("Example: 100 bacteria, doubling time 2 h. After 6 h: three doublings, 800 bacteria.", "Beispiel: 100 Bakterien, Verdopplungszeit 2 h. Nach 6 h: drei Verdopplungen, also 800 Bakterien."),
    highlight: ["r"],
  },
  {
    math: "\\frac{\\Delta N}{\\Delta t}#d =#e r#r \\cdot#c N#N",
    note: tx(
      "The increase per time unit is proportional to the population size: the more individuals, the faster it grows. $r$ is the growth rate (birth rate minus death rate).",
      "Der Zuwachs pro Zeiteinheit ist proportional zur Populationsgröße: Je mehr Individuen, desto schneller wächst sie. $r$ ist die Wachstumsrate (Geburtenrate minus Sterberate).",
    ),
  },
  {
    math: "\\frac{\\Delta N}{\\Delta t}#d =#e r#r \\cdot#c N#N \\cdot#c2 \\frac{K - N}{K}#k",
    note: tx(
      "In nature food and space run short. In **logistic growth** the factor $\\frac{K-N}{K}$ slows growth down: the population approaches the **carrying capacity K**. S-shaped curve.",
      "In der Natur werden Nahrung und Platz knapp. Beim **logistischen Wachstum** bremst der Faktor $\\frac{K-N}{K}$: Die Population nähert sich der **Kapazität K** (Umweltkapazität). S-förmige Kurve.",
    ),
    highlight: ["k"],
  },
  {
    math: tx('"density-dependent:"#a \\; "food, competition, predators, disease"#b', '"dichteabhängig:"#a \\; "Nahrung, Konkurrenz, Fressfeinde, Krankheiten"#b'),
    note: tx(
      "**Density-dependent factors** act more strongly the denser the population: lack of food, intraspecific competition, predators, parasites and diseases, stress. They regulate the population around K.",
      "**Dichteabhängige Faktoren** wirken umso stärker, je dichter die Population ist: Nahrungsmangel, innerartliche Konkurrenz, Fressfeinde, Parasiten und Krankheiten, Stress. Sie regulieren die Population um K.",
    ),
  },
  {
    math: tx('"density-independent:"#a \\; "frost, drought, flood"#b', '"dichteunabhängig:"#a \\; "Frost, Dürre, Hochwasser"#b'),
    note: tx("**Density-independent factors** hit a population no matter how dense it is: mostly weather such as frost, drought or floods.", "**Dichteunabhängige Faktoren** treffen eine Population unabhängig von ihrer Dichte: meist Witterung wie Frost, Dürre oder Hochwasser."),
  },
  {
    math: tx('"r strategists"#a \\quad "K strategists"#b', '"r-Strategen"#a \\quad "K-Strategen"#b'),
    note: tx(
      "**r strategists** (aphids, voles, dandelion) have many offspring, little care, a short life and colonise new habitats fast. **K strategists** (elephant, human, golden eagle, beech) have few offspring, lots of care, a long life; their population stays close to K.",
      "**r-Strategen** (Blattläuse, Feldmäuse, Löwenzahn) haben viele Nachkommen, kaum Brutpflege, ein kurzes Leben und besiedeln neue Lebensräume schnell. **K-Strategen** (Elefant, Mensch, Steinadler, Buche) haben wenige Nachkommen, viel Brutpflege, ein langes Leben; ihre Population bleibt nahe K.",
    ),
  },
];

const competitionFrames: Frame[] = [
  {
    math: tx('"intraspecific:"#a \\; "within one species"#b', '"intraspezifisch:"#a \\; "innerhalb einer Art"#b'),
    note: tx("**Intraspecific competition** happens between individuals of the same species. It is density-dependent and is what limits logistic growth.", "**Intraspezifische Konkurrenz** herrscht zwischen Individuen derselben Art. Sie ist dichteabhängig und bremst das logistische Wachstum."),
  },
  {
    math: tx('"interspecific:"#a \\; "between species"#b', '"interspezifisch:"#a \\; "zwischen Arten"#b'),
    note: tx("**Interspecific competition** happens between different species with similar demands.", "**Interspezifische Konkurrenz** herrscht zwischen verschiedenen Arten mit ähnlichen Ansprüchen."),
  },
  {
    math: tx('"same niche"#a \\Rightarrow "exclusion"#b', '"gleiche Nische"#a \\Rightarrow "Ausschluss"#b'),
    note: tx(
      "**Competitive exclusion principle** (Gause): two species with the same ecological niche cannot live in the same habitat permanently. Gause kept two species of slipper animalcule together: Paramecium aurelia drove out P. caudatum.",
      "**Konkurrenzausschlussprinzip** (Gause): Zwei Arten mit derselben ökologischen Nische können nicht dauerhaft im selben Lebensraum leben. Gause hielt zwei Pantoffeltierchen-Arten zusammen: Paramecium aurelia verdrängte P. caudatum.",
    ),
    highlight: ["b"],
  },
  {
    math: tx('"different niches"#a \\Rightarrow "coexistence"#b', '"verschiedene Nischen"#a \\Rightarrow "Koexistenz"#b'),
    note: tx(
      "**Niche differentiation** avoids competition: cormorants fish near the bottom (flatfish, shrimps), shags in open water (sand eels, herring). Great tits, blue tits and coal tits search different parts of the trees.",
      "**Einnischung** vermeidet Konkurrenz: Der Kormoran fischt am Grund (Plattfische, Garnelen), die Krähenscharbe im freien Wasser (Sandaale, Heringe). Kohl-, Blau- und Tannenmeise suchen in verschiedenen Bereichen der Bäume.",
    ),
    highlight: ["b"],
  },
  {
    math: tx('"symbiosis"#a \\; "+/+" \\quad "parasitism"#b \\; "+/−" \\quad "commensalism"#c \\; "+/0"', '"Symbiose"#a \\; "+/+" \\quad "Parasitismus"#b \\; "+/−" \\quad "Kommensalismus"#c \\; "+/0"'),
    note: tx(
      "**Mutualism** (+/+): both partners profit; a close, lasting partnership is called **symbiosis** (lichen, mycorrhiza, nodule bacteria). **Parasitism** (+/−): ectoparasites (tick) and endoparasites (tapeworm). **Commensalism** (+/0): one profits, the other is unaffected.",
      "**Mutualismus** (+/+): Beide Partner profitieren; ein enges, dauerhaftes Zusammenleben heißt **Symbiose** (Flechte, Mykorrhiza, Knöllchenbakterien). **Parasitismus** (+/−): Ektoparasiten (Zecke) und Endoparasiten (Bandwurm). **Kommensalismus** (+/0): Einer profitiert, der andere bleibt unbeeinflusst.",
    ),
  },
];

const productionFrames: Frame[] = [
  {
    math: tx('"NPP"#n =#e "GPP"#b -#m "R"#r', '"NPP"#n =#e "BPP"#b -#m "R"#r'),
    note: tx(
      "**Gross primary production (GPP)** is all the energy producers fix by photosynthesis. They use part of it for their own respiration (R). What's left is the **net primary production (NPP)**: new biomass, food for all consumers.",
      "Die **Bruttoprimärproduktion (BPP)** ist die gesamte Energie, die Produzenten durch Fotosynthese binden. Einen Teil verbrauchen sie selbst bei der Zellatmung (R). Was übrig bleibt, ist die **Nettoprimärproduktion (NPP)**: neue Biomasse, Nahrung für alle Konsumenten.",
    ),
  },
  {
    math: tx('"efficiency" = \\frac{"energy of level n+1"}{"energy of level n"} \\cdot 100 "%"', '"Effizienz" = \\frac{"Energie Stufe n+1"}{"Energie Stufe n"} \\cdot 100 "%"'),
    note: tx("The **ecological efficiency** tells you what share of one level arrives at the next: usually 5 to 20 %, about 10 % on average.", "Die **ökologische Effizienz** gibt an, welcher Anteil einer Stufe in der nächsten ankommt: meist 5 bis 20 %, im Mittel etwa 10 %."),
  },
  {
    math: tx('"bare rock"#a \\to#t1 "lichens, mosses"#b', '"nacktes Gestein"#a \\to#t1 "Flechten, Moose"#b'),
    note: tx(
      "**Succession** is the sequence of communities at one place over time. On bare rock (e.g. after a glacier retreats) **pioneer organisms** settle first: lichens and mosses. They weather the rock and form the first humus.",
      "**Sukzession** ist die zeitliche Abfolge von Lebensgemeinschaften an einem Ort. Auf nacktem Gestein (z. B. nach einem Gletscherrückzug) siedeln zuerst **Pionierorganismen**: Flechten und Moose. Sie verwittern das Gestein und bilden ersten Humus.",
    ),
  },
  {
    math: tx('"lichens, mosses"#b \\to#t2 "grasses, herbs"#c \\to#t3 "shrubs"#d', '"Flechten, Moose"#b \\to#t2 "Gräser, Kräuter"#c \\to#t3 "Sträucher"#d'),
    note: tx("As the soil deepens, grasses and herbs follow, later shrubs.", "Je dicker der Boden wird, desto mehr folgen Gräser und Kräuter, später Sträucher."),
  },
  {
    math: tx('"shrubs"#d \\to#t4 "birch, pine"#e \\to#t5 "beech forest"#f', '"Sträucher"#d \\to#t4 "Birke, Kiefer"#e \\to#t5 "Buchenwald"#f'),
    note: tx(
      "Light-loving pioneer trees such as birch and pine form an early woodland. At the end comes the stable **climax community**, in Central Europe mostly beech forest. Starting on existing soil (abandoned field, clear-felling) is **secondary succession**; it is faster.",
      "Lichtliebende Pionierbäume wie Birke und Kiefer bilden einen Vorwald. Am Ende steht die stabile **Klimaxgesellschaft** (Schlussgesellschaft), in Mitteleuropa meist ein Buchenwald. Beginnt die Sukzession auf vorhandenem Boden (aufgegebener Acker, Kahlschlag), ist es eine **sekundäre Sukzession**; sie verläuft schneller.",
    ),
    highlight: ["f"],
  },
];

// ---------------------------------------------------------------------------
// Checks

const checkExp = expGrowthTask(createRng(1), { g: 0, n0: 100, td: 20, k: 6 });
const checkLV = lvRuleTask(createRng(1), 5);
const checkNitrogen = nitrogenMatchTask(createRng(2), false);
const checkNpp = nppTask(createRng(1), { gpp: 24000, rPct: 45 });

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Population growth", "Populationswachstum"),
      blob: tx("Bacteria, mice, elephants: how fast can a population grow?", "Bakterien, Mäuse, Elefanten: Wie schnell kann eine Population wachsen?"),
      body: tx(
        "A **population** is all the individuals of one species in an area that can reproduce with each other. How does its size change over time?",
        "Eine **Population** sind alle Individuen einer Art in einem Gebiet, die sich miteinander fortpflanzen können. Wie verändert sich ihre Größe mit der Zeit?",
      ),
      frames: growthFrames,
    },
    {
      type: "widget",
      title: tx("Exponential and logistic growth", "Exponentielles und logistisches Wachstum"),
      blob: tx("Change r and K. When does the J turn into an S?", "Verändere r und K. Wann wird aus dem J ein S?"),
      body: tx(
        "Both curves start the same way. The logistic one is braked by limited resources and levels off at the capacity K. Show the growth per time unit: where is it largest?",
        "Beide Kurven beginnen gleich. Die logistische wird durch begrenzte Ressourcen gebremst und flacht bei der Kapazität K ab. Lass dir den Zuwachs pro Zeiteinheit zeigen: Wo ist er am größten?",
      ),
      widget: EcoGrowth,
    },
    { type: "check", blob: tx("Classic exam question: bacteria in a nutrient solution.", "Klassische Abituraufgabe: Bakterien in Nährlösung."), exercise: checkExp },
    {
      type: "widget",
      title: tx("The Lotka-Volterra rules", "Die Lotka-Volterra-Regeln"),
      blob: tx("A model with just two species. Play it, then hit both with the scissors!", "Ein Modell mit nur zwei Arten. Spiel es ab und dezimier dann beide mit der Schere!"),
      body: tx(
        "Lotka and Volterra described predator and prey with equations. Three rules follow: **1.** both populations oscillate periodically, the predator maxima follow the prey maxima with a delay. **2.** The mean values stay constant over a long time. **3.** If both are reduced by the same proportion, the prey recovers faster.",
        "Lotka und Volterra beschrieben Räuber und Beute mit Gleichungen. Daraus folgen drei Regeln: **1.** Beide Populationen schwanken periodisch, die Maxima der Räuber folgen phasenverzögert auf die der Beute. **2.** Die Mittelwerte bleiben über lange Zeit konstant. **3.** Werden beide gleich stark dezimiert, erholt sich die Beute schneller.",
      ),
      widget: EcoLotkaVolterra,
    },
    { type: "check", blob: tx("One of the most common traps in exams!", "Eine der häufigsten Fallen in Klausuren!"), exercise: checkLV },
    {
      type: "explain",
      title: tx("Competition, niches and interactions", "Konkurrenz, Nischen und Wechselbeziehungen"),
      blob: tx("Why can so many similar species live side by side?", "Warum können so viele ähnliche Arten nebeneinander leben?"),
      frames: competitionFrames,
    },
    {
      type: "widget",
      title: tx("The nitrogen cycle", "Der Stickstoffkreislauf"),
      blob: tx("78 % of the air is nitrogen, but plants can't use it. Bacteria to the rescue!", "78 % der Luft sind Stickstoff, aber Pflanzen können ihn nicht nutzen. Bakterien helfen!"),
      body: tx(
        "Living things need nitrogen for proteins and DNA. Plants can only take it up as nitrate or ammonium. Bacteria drive the cycle: tap the processes and note which need oxygen.",
        "Lebewesen brauchen Stickstoff für Proteine und DNA. Pflanzen können ihn nur als Nitrat oder Ammonium aufnehmen. Bakterien treiben den Kreislauf an: Tippe die Vorgänge an und achte darauf, welche Sauerstoff brauchen.",
      ),
      widget: EcoNitrogenCycle,
    },
    { type: "check", blob: tx("Nitrification or denitrification? Don't mix them up!", "Nitrifikation oder Denitrifikation? Nicht verwechseln!"), exercise: checkNitrogen },
    {
      type: "widget",
      title: tx("The lake through the year", "Der See im Jahresverlauf"),
      blob: tx("Why don't lakes freeze solid? Water has a secret at 4 °C.", "Warum frieren Seen nicht durch? Wasser hat bei 4 °C ein Geheimnis."),
      body: tx(
        "Water is densest at 4 °C (**density anomaly**). That's why a deep lake is layered in summer and winter (**stagnation**) and mixed in spring and autumn (**circulation**). Go through the seasons and watch temperature and oxygen.",
        "Wasser hat bei 4 °C die größte Dichte (**Dichteanomalie**). Deshalb ist ein tiefer See im Sommer und Winter geschichtet (**Stagnation**) und im Frühjahr und Herbst durchmischt (**Zirkulation**). Geh durch die Jahreszeiten und beobachte Temperatur und Sauerstoff.",
      ),
      widget: EcoLakeSeasons,
    },
    {
      type: "explain",
      title: tx("Production and succession", "Produktion und Sukzession"),
      blob: tx("How much do plants really produce? And how does a forest grow on bare rock?", "Wie viel produzieren Pflanzen wirklich? Und wie entsteht auf nacktem Fels ein Wald?"),
      frames: productionFrames,
    },
    { type: "check", blob: tx("Last one: gross minus respiration.", "Zum Schluss: Brutto minus Atmung."), exercise: checkNpp },
  ],
  summary: [
    {
      title: tx("Population growth", "Populationswachstum"),
      body: tx(
        "Exponential (unlimited, J-curve) and logistic (limited by K, S-curve; fastest growth at K/2). Density-dependent factors (food, competition, predators, disease) regulate; density-independent ones (weather) don't.",
        "Exponentiell (unbegrenzt, J-Kurve) und logistisch (begrenzt durch K, S-Kurve; größter Zuwachs bei K/2). Dichteabhängige Faktoren (Nahrung, Konkurrenz, Fressfeinde, Krankheiten) regulieren, dichteunabhängige (Witterung) nicht.",
      ),
      examples: ["N(t) = N_0 \\cdot 2^{\\frac{t}{t_D}}", "\\frac{\\Delta N}{\\Delta t} = r \\cdot N \\cdot \\frac{K - N}{K}"],
      tone: "rule",
    },
    {
      title: tx("Lotka-Volterra rules", "Lotka-Volterra-Regeln"),
      body: tx(
        "1. Predator and prey oscillate periodically, the predator maxima follow with a delay. 2. The mean values stay constant. 3. After an equal decimation the prey recovers faster. Model: only one predator and one prey.",
        "1. Räuber und Beute schwanken periodisch, die Räubermaxima folgen phasenverzögert. 2. Die Mittelwerte bleiben konstant. 3. Nach gleich starker Dezimierung erholt sich die Beute schneller. Modell: nur ein Räuber und eine Beute.",
      ),
      tone: "rule",
    },
    {
      title: tx("Competition and niche", "Konkurrenz und Nische"),
      body: tx(
        "Intraspecific (within a species) and interspecific (between species). Competitive exclusion (Gause): identical niches can't coexist. Niche differentiation avoids competition. Symbiosis +/+, parasitism +/−, commensalism +/0. r strategists: many offspring; K strategists: few offspring, lots of care.",
        "Intraspezifisch (innerhalb einer Art) und interspezifisch (zwischen Arten). Konkurrenzausschluss (Gause): Gleiche Nischen können nicht koexistieren. Einnischung vermeidet Konkurrenz. Symbiose +/+, Parasitismus +/−, Kommensalismus +/0. r-Strategen: viele Nachkommen; K-Strategen: wenige Nachkommen, viel Brutpflege.",
      ),
      tone: "rule",
    },
    {
      title: tx("Nitrogen cycle", "Stickstoffkreislauf"),
      body: tx(
        "Fixation (nodule bacteria: N₂ → NH₄⁺), ammonification (decomposers: proteins → NH₄⁺), nitrification (aerobic: NH₄⁺ → NO₂⁻ → NO₃⁻, Nitrosomonas, Nitrobacter), uptake of nitrate by plants, denitrification (anaerobic: NO₃⁻ → N₂).",
        "Fixierung (Knöllchenbakterien: N₂ → NH₄⁺), Ammonifikation (Destruenten: Proteine → NH₄⁺), Nitrifikation (aerob: NH₄⁺ → NO₂⁻ → NO₃⁻, Nitrosomonas, Nitrobacter), Aufnahme von Nitrat durch Pflanzen, Denitrifikation (anaerob: NO₃⁻ → N₂).",
      ),
      examples: ["\\ce{N2 -> NH4+ -> NO2- -> NO3-}"],
      tone: "rule",
    },
    {
      title: tx("Lake, production, succession", "See, Produktion, Sukzession"),
      body: tx(
        "Water is densest at 4 °C: summer and winter stagnation, spring and autumn circulation (oxygen down, minerals up). NPP = GPP − respiration. Succession: pioneers (lichens, mosses) → grasses → shrubs → pioneer trees → climax (beech forest).",
        "Wasser hat bei 4 °C die größte Dichte: Sommer- und Winterstagnation, Frühjahrs- und Herbstzirkulation (Sauerstoff nach unten, Mineralstoffe nach oben). NPP = BPP − Atmung. Sukzession: Pioniere (Flechten, Moose) → Gräser → Sträucher → Pionierbäume → Klimax (Buchenwald).",
      ),
      examples: [tx('"NPP" = "GPP" - "R"', '"NPP" = "BPP" - "R"')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The prey peaks first, not the predator. K strategists have FEW offspring. Nitrification needs oxygen, denitrification works without. Exponential growth multiplies (2^n), it doesn't add. The largest growth per time unit is at K/2, not at K.",
        "Die Beute hat ihr Maximum zuerst, nicht der Räuber. K-Strategen haben WENIGE Nachkommen. Nitrifikation braucht Sauerstoff, Denitrifikation läuft ohne. Exponentielles Wachstum multipliziert (2^n), es addiert nicht. Der größte Zuwachs pro Zeiteinheit liegt bei K/2, nicht bei K.",
      ),
      tone: "warning",
    },
  ],
};
