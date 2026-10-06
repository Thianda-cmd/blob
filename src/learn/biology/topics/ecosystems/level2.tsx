"use client";

import { tx } from "@/i18n/text";
import { EcoCarbonCycle } from "@/learn/biology/visuals/EcoCycles";
import { EcoLynxHare } from "@/learn/biology/visuals/EcoPredatorPrey";
import { EcoPyramidFill } from "@/learn/biology/visuals/EcoPyramid";
import { EcoToleranceLab } from "@/learn/biology/visuals/EcoTolerance";
import { createRng } from "@/learn/engine/rng";
import type { Frame, LevelLesson } from "@/learn/types";
import { carbonMultiTask, energyForwardTask, predatorCurveTask, toleranceReadTask } from "./tasks2";

export { generate2 } from "./tasks2";

// ---------------------------------------------------------------------------
// Frames

const factorFrames: Frame[] = [
  {
    math: tx('"abiotic:"#k \\; "light, temperature, water, soil, wind"#x', '"abiotisch:"#k \\; "Licht, Temperatur, Wasser, Boden, Wind"#x'),
    note: tx(
      "**Abiotic factors** are the non-living conditions: light, temperature, water (humidity), soil (minerals, pH value), wind. In water also the oxygen and salt content.",
      "**Abiotische Faktoren** sind die unbelebten Bedingungen: Licht, Temperatur, Wasser (Feuchtigkeit), Boden (Mineralstoffe, pH-Wert), Wind. Im Wasser auch Sauerstoff- und Salzgehalt.",
    ),
    highlight: ["k"],
  },
  {
    math: tx('"biotic:"#k \\; "other living things"#x', '"biotisch:"#k \\; "andere Lebewesen"#x'),
    note: tx("**Biotic factors** are all influences from other living things. Four kinds of relationship are especially important.", "**Biotische Faktoren** sind alle Einflüsse durch andere Lebewesen. Vier Beziehungen sind besonders wichtig."),
    highlight: ["k"],
  },
  {
    math: tx('"competition"#k \\; "fox, buzzard: voles"#x', '"Konkurrenz"#k \\; "Fuchs, Bussard: Feldmäuse"#x'),
    note: tx(
      "**Competition**: living things use the same scarce resource (food, light, space), between species or within a species. Both lose out.",
      "**Konkurrenz**: Lebewesen nutzen dieselbe knappe Ressource (Nahrung, Licht, Platz), zwischen Arten oder innerhalb einer Art. Beide haben Nachteile.",
    ),
    highlight: ["k"],
  },
  {
    math: tx('"predator and prey"#k \\; "lynx, roe deer"#x', '"Räuber und Beute"#k \\; "Luchs, Reh"#x'),
    note: tx("**Predator and prey**: the predator kills its prey and eats it.", "**Räuber-Beute-Beziehung**: Der Räuber tötet seine Beute und frisst sie."),
    highlight: ["k"],
  },
  {
    math: tx('"parasitism"#k \\; "tick, tapeworm, mistletoe"#x', '"Parasitismus"#k \\; "Zecke, Bandwurm, Mistel"#x'),
    note: tx("**Parasitism**: the parasite lives on or in its host and harms it, but usually doesn't kill it.", "**Parasitismus**: Der Parasit lebt auf oder in seinem Wirt und schädigt ihn, tötet ihn aber meist nicht."),
    highlight: ["k"],
  },
  {
    math: tx('"symbiosis"#k \\; "lichen, mycorrhiza"#x', '"Symbiose"#k \\; "Flechte, Mykorrhiza"#x'),
    note: tx(
      "**Symbiosis**: both partners profit. A lichen is a fungus and an alga; in mycorrhiza fungal threads and tree roots exchange minerals for sugar.",
      "**Symbiose**: Beide Partner haben einen Vorteil. Eine Flechte besteht aus Pilz und Alge; bei der Mykorrhiza tauschen Pilzfäden und Baumwurzeln Mineralstoffe gegen Zucker.",
    ),
    highlight: ["k"],
  },
];

const nicheFrames: Frame[] = [
  {
    math: tx('"stinging nettle"#z \\Rightarrow "soil rich in nitrogen"#a', '"Brennnessel"#z \\Rightarrow "stickstoffreicher Boden"#a'),
    note: tx(
      "Species with a narrow range of tolerance (stenoecious) tell you about their site: **indicator plants**. Lots of stinging nettles show soil rich in nitrogen.",
      "Arten mit engem Toleranzbereich (stenök) verraten etwas über ihren Standort: **Zeigerpflanzen**. Viele Brennnesseln zeigen einen stickstoffreichen Boden.",
    ),
  },
  {
    math: tx('"heather"#z \\Rightarrow "acidic, poor soil"#a', '"Heidekraut"#z \\Rightarrow "saurer, nährstoffarmer Boden"#a'),
    note: tx("Heather shows acidic, nutrient-poor soil; marsh marigold wet soil; liverleaf soil rich in lime.", "Heidekraut zeigt sauren, nährstoffarmen Boden, Sumpfdotterblume nassen Boden, Leberblümchen kalkreichen Boden."),
  },
  {
    math: tx('"ecological niche"#z', '"ökologische Nische"#z'),
    note: tx(
      "The **ecological niche** is the sum of all the demands a species makes on its environment and all its relationships: what it eats, when and where it hunts, which temperature it needs. A niche is the species' \"job\", not its \"address\".",
      "Die **ökologische Nische** ist die Gesamtheit aller Ansprüche einer Art an ihre Umwelt und aller ihrer Beziehungen: was sie frisst, wann und wo sie jagt, welche Temperatur sie braucht. Die Nische ist der „Beruf“ einer Art, nicht ihre „Adresse“.",
    ),
  },
  {
    math: tx('"many niches"#z \\Rightarrow "biodiversity"#a', '"viele Nischen"#z \\Rightarrow "Biodiversität"#a'),
    note: tx(
      "Many different niches allow many species: **biodiversity** (diversity of species, genes and ecosystems). Sealed land, monocultures, heavy fertilising and climate change reduce it; hedges, flower strips and restored streams increase it.",
      "Viele verschiedene Nischen ermöglichen viele Arten: **Biodiversität** (Vielfalt der Arten, Gene und Ökosysteme). Versiegelung, Monokulturen, Überdüngung und Klimawandel verringern sie; Hecken, Blühstreifen und renaturierte Bäche fördern sie.",
    ),
  },
];

const energyFrames: Frame[] = [
  {
    math: tx('"producers:"#l \\; 10\\,000#v0 "kJ"#u0', '"Produzenten:"#l \\; 10\\,000#v0 "kJ"#u0'),
    note: tx("Plants store light energy in their biomass. Let's say the grass of a meadow stores 10,000 kJ.", "Pflanzen speichern Lichtenergie in ihrer Biomasse. Angenommen, das Gras einer Wiese speichert 10.000 kJ."),
  },
  {
    math: tx('10\\,000#v0 "kJ"#u0 \\to#a1 1000#v1 "kJ"#u1', '10\\,000#v0 "kJ"#u0 \\to#a1 1000#v1 "kJ"#u1'),
    note: tx("Only about **10 %** of it reaches the primary consumers (the herbivores). About 90 % is lost.", "Nur etwa **10 %** davon kommen bei den Konsumenten 1. Ordnung an (den Pflanzenfressern). Rund 90 % gehen verloren."),
    highlight: ["v1"],
  },
  {
    math: tx('"90 %:"#l \\; "heat, droppings, uneaten parts"#x', '"90 %:"#l \\; "Wärme, Kot, nicht Gefressenes"#x'),
    note: tx(
      "Where does it go? Most is used in **cellular respiration** for movement and body heat and leaves as heat. Undigested food (droppings) and parts that aren't eaten at all go to the decomposers.",
      "Wohin? Das meiste wird bei der **Zellatmung** für Bewegung und Körperwärme genutzt und als Wärme abgegeben. Unverdautes (Kot) und Teile, die gar nicht gefressen werden, bekommen die Destruenten.",
    ),
  },
  {
    math: tx('10\\,000#v0 \\to#a1 1000#v1 \\to#a2 100#v2 \\to#a3 10#v3 "kJ"', '10\\,000#v0 \\to#a1 1000#v1 \\to#a2 100#v2 \\to#a3 10#v3 "kJ"'),
    note: tx("Again only 10 % from level to level (trophic level). The tertiary consumers get only 10 kJ: 0.1 %.", "Von Stufe zu Stufe (Trophieebene) wieder nur 10 %. Bei den Konsumenten 3. Ordnung kommen nur 10 kJ an: 0,1 %."),
    highlight: ["v3"],
  },
  {
    math: tx('"energy flows,"#e \\; "matter cycles"#s', '"Energie fließt,"#e \\; "Stoffe kreisen"#s'),
    note: tx(
      "Energy leaves as heat and has to be supplied by the sun all the time: **energy flows**. Carbon, nitrogen and minerals are released again by decomposers: **matter cycles**.",
      "Energie geht als Wärme verloren und muss ständig von der Sonne nachgeliefert werden: **Energie fließt**. Kohlenstoff, Stickstoff und Mineralstoffe werden von Destruenten wieder freigesetzt: **Stoffe kreisen**.",
    ),
  },
];

// ---------------------------------------------------------------------------
// Checks

const checkTolerance = toleranceReadTask(createRng(3), {
  f: { name: tx("temperature in °C", "Temperatur in °C"), unit: "°C", organism: tx("a fish species", "eine Fischart"), xMin: 0, xMax: 40, step: 5, curves: [{ min: 5, opt: 20, max: 30 }] },
  ask: "range",
});
const checkEnergy = energyForwardTask(createRng(1), 20000, 2);
const checkCarbon = carbonMultiTask(createRng(7), true);
const checkPredator = predatorCurveTask(createRng(4));

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Abiotic and biotic factors", "Abiotische und biotische Faktoren"),
      blob: tx("What decides whether a species can live somewhere? Let's look!", "Was entscheidet, ob eine Art irgendwo leben kann? Schauen wir nach!"),
      body: tx(
        "Whether a species occurs in a habitat depends on **environmental factors**. Abiotic factors are non-living, biotic factors come from other living things.",
        "Ob eine Art in einem Lebensraum vorkommt, hängt von **Umweltfaktoren** ab. Abiotische Faktoren sind unbelebt, biotische Faktoren gehen von anderen Lebewesen aus.",
      ),
      frames: factorFrames,
    },
    {
      type: "widget",
      title: tx("The tolerance curve", "Die Toleranzkurve"),
      blob: tx("Turn up the heat and watch the fish! When is it happiest?", "Dreh an der Temperatur und beobachte den Fisch! Wann geht es ihm am besten?"),
      body: tx(
        "For every factor a species has a **range of tolerance** between a **minimum** and a **maximum**. It does best at the **optimum**. Close to the limits lies the **pessimum**: it survives, but hardly grows and doesn't reproduce.",
        "Für jeden Faktor hat eine Art einen **Toleranzbereich** zwischen **Minimum** und **Maximum**. Am besten geht es ihr im **Optimum**. Nahe den Grenzen liegt das **Pessimum**: Sie überlebt, wächst aber kaum und pflanzt sich nicht fort.",
      ),
      widget: EcoToleranceLab,
    },
    { type: "check", blob: tx("Read carefully: where does the curve start and end?", "Lies genau ab: Wo beginnt und wo endet die Kurve?"), exercise: checkTolerance },
    {
      type: "explain",
      title: tx("Indicator plants and niches", "Zeigerpflanzen und Nischen"),
      blob: tx("Some plants are like little measuring devices!", "Manche Pflanzen sind wie kleine Messgeräte!"),
      frames: nicheFrames,
    },
    {
      type: "explain",
      title: tx("Energy flow: the 10 % rule", "Energiefluss: die 10-%-Regel"),
      blob: tx("Why are there so few foxes and so much grass? The answer is energy.", "Warum gibt es so wenige Füchse und so viel Gras? Die Antwort heißt Energie."),
      frames: energyFrames,
    },
    {
      type: "widget",
      title: tx("Fill the energy pyramid", "Füll die Energiepyramide"),
      blob: tx("Your turn to calculate! Divide by ten and watch it shrink.", "Jetzt rechnest du! Teile durch zehn und schau, wie sie schrumpft."),
      body: tx(
        "Stack the trophic levels on top of each other and you get a **pyramid**: energy and biomass decrease strongly towards the top. Fill it in with the 10 % rule.",
        "Stapelt man die Trophieebenen (Ernährungsstufen) übereinander, entsteht eine **Pyramide**: Energie und Biomasse nehmen nach oben stark ab. Füll sie mit der 10-%-Regel aus.",
      ),
      widget: EcoPyramidFill,
    },
    { type: "check", blob: tx("Two steps up: how much is left?", "Zwei Stufen nach oben: Wie viel bleibt übrig?"), exercise: checkEnergy },
    {
      type: "widget",
      title: tx("The carbon cycle", "Der Kohlenstoffkreislauf"),
      blob: tx("Every carbon atom in you was once CO₂ in the air. Really!", "Jedes Kohlenstoffatom in dir war mal CO₂ in der Luft. Wirklich!"),
      body: tx(
        "Carbon is in the CO₂ of the air and in all organic substances. Tap the processes: which ones take CO₂ out of the air, which release it? And what does the greenhouse effect have to do with it?",
        "Kohlenstoff steckt im CO₂ der Luft und in allen organischen Stoffen. Tippe die Vorgänge an: Welche entziehen der Luft CO₂, welche setzen es frei? Und was hat der Treibhauseffekt damit zu tun?",
      ),
      widget: EcoCarbonCycle,
    },
    { type: "check", blob: tx("Careful, there's a classic trap in this one!", "Vorsicht, hier steckt eine klassische Falle drin!"), exercise: checkCarbon },
    {
      type: "widget",
      title: tx("Predator and prey: lynx and hare", "Räuber und Beute: Luchs und Schneehase"),
      blob: tx("Almost 100 years of fur counts from Canada. Move through time!", "Fast 100 Jahre Fellzählungen aus Kanada. Reise durch die Zeit!"),
      body: tx(
        "For almost a century, a fur trading company in Canada counted the skins of lynx and snowshoe hares. The numbers rise and fall in a rhythm of about 10 years, and the lynx always follows the hare.",
        "Fast ein Jahrhundert lang zählte eine Pelzhandelsgesellschaft in Kanada die Felle von Luchsen und Schneeschuhhasen. Die Zahlen steigen und fallen im Rhythmus von etwa 10 Jahren, und der Luchs folgt immer dem Hasen.",
      ),
      widget: EcoLynxHare,
    },
    { type: "check", blob: tx("No labels this time. Can you tell who is who?", "Diesmal ohne Beschriftung. Erkennst du, wer wer ist?"), exercise: checkPredator },
  ],
  summary: [
    {
      title: tx("Abiotic and biotic factors", "Abiotische und biotische Faktoren"),
      body: tx(
        "Abiotic: light, temperature, water, soil, wind. Biotic: competition (−/−), predator and prey (+/−), parasitism (+/−, the host usually survives), symbiosis (+/+, e.g. lichen, mycorrhiza).",
        "Abiotisch: Licht, Temperatur, Wasser, Boden, Wind. Biotisch: Konkurrenz (−/−), Räuber-Beute (+/−), Parasitismus (+/−, Wirt überlebt meist), Symbiose (+/+, z. B. Flechte, Mykorrhiza).",
      ),
      tone: "rule",
    },
    {
      title: tx("Tolerance curve", "Toleranzkurve"),
      body: tx(
        "Range of tolerance from minimum to maximum; optimum = best growth and reproduction; pessimum = survival without reproduction. Narrow range: stenoecious (indicator plants!), wide range: euryoecious.",
        "Toleranzbereich von Minimum bis Maximum; Optimum = bestes Wachstum und Fortpflanzung; Pessimum = Überleben ohne Fortpflanzung. Enger Bereich: stenök (Zeigerpflanzen!), weiter Bereich: euryök.",
      ),
      examples: [tx('"range of tolerance" = "max" - "min"', '"Toleranzbereich" = "Max" - "Min"')],
      tone: "rule",
    },
    {
      title: tx("Energy flow and the 10 % rule", "Energiefluss und 10-%-Regel"),
      body: tx(
        "Only about 10 % of the energy reaches the next trophic level; about 90 % is released as heat by cellular respiration or ends up in droppings and remains. Energy flows, matter cycles.",
        "Nur etwa 10 % der Energie erreichen die nächste Trophieebene; rund 90 % werden bei der Zellatmung als Wärme abgegeben oder landen in Kot und Resten. Energie fließt, Stoffe kreisen.",
      ),
      examples: [tx('10\\,000 \\to 1000 \\to 100 \\to 10 "kJ"', '10\\,000 \\to 1000 \\to 100 \\to 10 "kJ"')],
      tone: "rule",
    },
    {
      title: tx("Carbon cycle", "Kohlenstoffkreislauf"),
      body: tx(
        "Photosynthesis takes CO₂ out of the air. Cellular respiration (of plants, animals and decomposers) and burning release it. Burning fossil fuels raises the CO₂ in the air (about 280 ppm in 1850, over 420 ppm today) and strengthens the greenhouse effect.",
        "Fotosynthese entzieht der Luft CO₂. Zellatmung (von Pflanzen, Tieren und Destruenten) und Verbrennung setzen es frei. Das Verbrennen fossiler Brennstoffe erhöht den CO₂-Gehalt (1850 etwa 280 ppm, heute über 420 ppm) und verstärkt den Treibhauseffekt.",
      ),
      examples: ["\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}"],
      tone: "rule",
    },
    {
      title: tx("Predator and prey", "Räuber und Beute"),
      body: tx(
        "Numbers of predator and prey rise and fall periodically. The predator's curve follows the prey's with a delay (lynx and snowshoe hare: about 10 years per cycle).",
        "Die Zahlen von Räuber und Beute schwanken periodisch. Die Räuberkurve folgt der Beutekurve zeitversetzt (Luchs und Schneeschuhhase: etwa 10 Jahre pro Zyklus).",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Energy is not recycled, only matter is. Plants respire too, day and night. The prey peaks first, the predator follows. A niche is a species' job, not its address. A parasite usually doesn't kill its host.",
        "Energie wird nicht recycelt, nur Stoffe. Auch Pflanzen atmen, Tag und Nacht. Die Beute hat ihr Maximum zuerst, der Räuber folgt. Die Nische ist der Beruf einer Art, nicht ihre Adresse. Ein Parasit tötet seinen Wirt meist nicht.",
      ),
      tone: "warning",
    },
  ],
};
