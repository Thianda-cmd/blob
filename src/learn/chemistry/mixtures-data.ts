// Facts for the "mixtures" topic: kinds of mixtures with everyday examples, pure substances,
// and the separation methods with the property each one uses.

import { tx, type Text } from "@/i18n/text";

export type State = "s" | "l" | "g";

export type MixType = "solution" | "suspension" | "emulsion" | "alloy" | "solidmix" | "smoke" | "fog" | "foam" | "gasmix";

export const MIX_TYPES: Record<MixType, { name: Text; homogeneous: boolean; what: Text; parts: Text }> = {
  solution: {
    name: tx("solution", "Lösung"),
    homogeneous: true,
    parts: tx("solid, liquid or gas in a liquid", "fest, flüssig oder gasförmig in flüssig"),
    what: tx(
      "A substance is spread so finely in a liquid that you can't see it even under a microscope.",
      "Ein Stoff ist so fein in einer Flüssigkeit verteilt, dass man ihn selbst unter dem Mikroskop nicht sieht.",
    ),
  },
  suspension: {
    name: tx("suspension", "Suspension"),
    homogeneous: false,
    parts: tx("solid in liquid", "fest in flüssig"),
    what: tx("Solid bits float in a liquid without dissolving. Left to stand, they settle.", "Feste Teilchen schweben in einer Flüssigkeit, ohne sich zu lösen. Lässt man sie stehen, setzen sie sich ab."),
  },
  emulsion: {
    name: tx("emulsion", "Emulsion"),
    homogeneous: false,
    parts: tx("liquid in liquid", "flüssig in flüssig"),
    what: tx("Tiny droplets of one liquid are spread in another liquid that doesn't mix with it.", "Winzige Tröpfchen einer Flüssigkeit sind in einer anderen Flüssigkeit verteilt, die sich nicht mit ihr mischt."),
  },
  alloy: {
    name: tx("alloy", "Legierung"),
    homogeneous: true,
    parts: tx("solid in solid (metals)", "fest in fest (Metalle)"),
    what: tx("Metals melted together (sometimes with a little carbon). Evenly mixed throughout.", "Zusammengeschmolzene Metalle (manchmal mit etwas Kohlenstoff). Durch und durch gleichmäßig gemischt."),
  },
  solidmix: {
    name: tx("mixture of solids", "Gemenge"),
    homogeneous: false,
    parts: tx("solid in solid", "fest in fest"),
    what: tx("Grains of different solids lie side by side. You can often tell them apart.", "Körner verschiedener Feststoffe liegen nebeneinander. Oft kann man sie unterscheiden."),
  },
  smoke: {
    name: tx("smoke", "Rauch"),
    homogeneous: false,
    parts: tx("solid in gas", "fest in gasförmig"),
    what: tx("Tiny solid particles float in a gas.", "Winzige feste Teilchen schweben in einem Gas."),
  },
  fog: {
    name: tx("fog", "Nebel"),
    homogeneous: false,
    parts: tx("liquid in gas", "flüssig in gasförmig"),
    what: tx("Tiny liquid droplets float in a gas.", "Winzige Flüssigkeitströpfchen schweben in einem Gas."),
  },
  foam: {
    name: tx("foam", "Schaum"),
    homogeneous: false,
    parts: tx("gas in liquid or solid", "gasförmig in flüssig oder fest"),
    what: tx("Gas bubbles are trapped in a liquid or a solid.", "Gasblasen sind in einer Flüssigkeit oder einem Feststoff eingeschlossen."),
  },
  gasmix: {
    name: tx("gas mixture", "Gasgemisch"),
    homogeneous: true,
    parts: tx("gas in gas", "gasförmig in gasförmig"),
    what: tx("Gases always mix completely.", "Gase mischen sich immer vollständig."),
  },
};

export type Example = { name: Text; type: MixType };

export const EXAMPLES: Example[] = [
  { name: tx("salt water", "Salzwasser"), type: "solution" },
  { name: tx("sugar water", "Zuckerwasser"), type: "solution" },
  { name: tx("sea water", "Meerwasser"), type: "solution" },
  { name: tx("vinegar", "Essig"), type: "solution" },
  { name: tx("still mineral water", "stilles Mineralwasser"), type: "solution" },
  { name: tx("tea without the leaves", "Tee ohne Teeblätter"), type: "solution" },
  { name: tx("muddy water", "Schlammwasser"), type: "suspension" },
  { name: tx("orange juice with pulp", "Orangensaft mit Fruchtfleisch"), type: "suspension" },
  { name: tx("chalk stirred into water", "Kreidewasser"), type: "suspension" },
  { name: tx("blood", "Blut"), type: "suspension" },
  { name: tx("milk", "Milch"), type: "emulsion" },
  { name: tx("mayonnaise", "Mayonnaise"), type: "emulsion" },
  { name: tx("hand cream", "Handcreme"), type: "emulsion" },
  { name: tx("salad dressing of oil and vinegar (shaken)", "Salatsoße aus Öl und Essig (geschüttelt)"), type: "emulsion" },
  { name: tx("brass (copper and zinc)", "Messing (Kupfer und Zink)"), type: "alloy" },
  { name: tx("bronze (copper and tin)", "Bronze (Kupfer und Zinn)"), type: "alloy" },
  { name: tx("muesli", "Müsli"), type: "solidmix" },
  { name: tx("granite", "Granit"), type: "solidmix" },
  { name: tx("sand with iron filings", "Sand mit Eisenspänen"), type: "solidmix" },
  { name: tx("salt and pepper", "Salz und Pfeffer"), type: "solidmix" },
  { name: tx("smoke from a campfire", "Rauch eines Lagerfeuers"), type: "smoke" },
  { name: tx("dust in the air", "Staub in der Luft"), type: "smoke" },
  { name: tx("soot in exhaust fumes", "Ruß in Autoabgasen"), type: "smoke" },
  { name: tx("fog over a meadow", "Nebel über einer Wiese"), type: "fog" },
  { name: tx("clouds", "Wolken"), type: "fog" },
  { name: tx("spray from a spray bottle", "Sprühnebel aus einer Sprühflasche"), type: "fog" },
  { name: tx("soap suds", "Seifenschaum"), type: "foam" },
  { name: tx("whipped cream", "Schlagsahne"), type: "foam" },
  { name: tx("the froth on a glass of beer", "Bierschaum"), type: "foam" },
  { name: tx("shaving foam", "Rasierschaum"), type: "foam" },
  { name: tx("polystyrene (a solid foam)", "Styropor (ein fester Schaum)"), type: "foam" },
  { name: tx("air", "Luft"), type: "gasmix" },
  { name: tx("the air you breathe out", "Atemluft"), type: "gasmix" },
];

/** Pure substances students know (each one kind of particle, fixed melting and boiling temperature). */
export const PURE: Text[] = [
  tx("distilled water", "destilliertes Wasser"),
  tx("pure table salt (sodium chloride)", "reines Kochsalz (Natriumchlorid)"),
  tx("sugar", "Zucker"),
  tx("pure gold (24 carat)", "reines Gold (24 Karat)"),
  tx("copper", "Kupfer"),
  tx("oxygen", "Sauerstoff"),
  tx("carbon dioxide", "Kohlenstoffdioxid"),
  tx("diamond", "Diamant"),
  tx("nitrogen", "Stickstoff"),
  tx("pure iron", "reines Eisen"),
];

/** Mixtures that look like pure substances (the classic traps). */
export const LOOKALIKES: { name: Text; why: Text }[] = [
  { name: tx("tap water", "Leitungswasser"), why: tx("It looks pure, but minerals like calcium and magnesium salts are dissolved in it.", "Es sieht rein aus, aber darin sind Mineralstoffe wie Calcium- und Magnesiumsalze gelöst.") },
  { name: tx("air", "Luft"), why: tx("Air is a mixture of gases: mostly nitrogen and oxygen, plus argon and carbon dioxide.", "Luft ist ein Gasgemisch: vor allem Stickstoff und Sauerstoff, dazu Argon und Kohlenstoffdioxid.") },
  { name: tx("brass", "Messing"), why: tx("Brass shines like a pure metal, but it's an alloy of copper and zinc.", "Messing glänzt wie ein reines Metall, ist aber eine Legierung aus Kupfer und Zink.") },
  { name: tx("steel", "Stahl"), why: tx("Steel is an alloy: iron with a little carbon (and often other metals).", "Stahl ist eine Legierung: Eisen mit etwas Kohlenstoff (und oft weiteren Metallen).") },
  { name: tx("mineral water", "Mineralwasser"), why: tx("The name says it: minerals and often carbon dioxide are dissolved in it.", "Der Name verrät es: Darin sind Mineralstoffe und oft Kohlenstoffdioxid gelöst.") },
  { name: tx("milk", "Milch"), why: tx("Milk looks uniform, but under a microscope you see tiny fat droplets in water: an emulsion.", "Milch sieht einheitlich aus, aber unter dem Mikroskop siehst du winzige Fetttröpfchen in Wasser: eine Emulsion.") },
  { name: tx("sea water", "Meerwasser"), why: tx("Sea water is a salt solution: about 3.5 % of it is dissolved salts.", "Meerwasser ist eine Salzlösung: Etwa 3,5 % davon sind gelöste Salze.") },
  { name: tx("vinegar", "Essig"), why: tx("Vinegar is acetic acid dissolved in water: a solution.", "Essig ist in Wasser gelöste Essigsäure: eine Lösung.") },
];

// ---------------------------------------------------------------------------
// Separation methods

export type Prop = "size" | "density" | "boiling" | "solubility" | "magnetism" | "adhesion";

export const PROPS: Record<Prop, Text> = {
  size: tx("particle size", "Teilchengröße"),
  density: tx("density", "Dichte"),
  boiling: tx("boiling temperature", "Siedetemperatur"),
  solubility: tx("solubility", "Löslichkeit"),
  magnetism: tx("magnetism", "Magnetisierbarkeit"),
  adhesion: tx("how strongly it sticks to the paper (adsorption)", "Haftfähigkeit am Papier (Adsorption)"),
};

export type Method = "sieve" | "sediment" | "filter" | "evaporate" | "distil" | "extract" | "chroma" | "magnet" | "centrifuge";

export const METHODS: Record<Method, { name: Text; prop: Prop; how: Text; accept: Text[] }> = {
  sieve: {
    name: tx("sieving", "Sieben"),
    prop: "size",
    how: tx("Coarse grains stay in the sieve, fine ones fall through.", "Grobe Körner bleiben im Sieb, feine fallen durch."),
    accept: [tx("sieving", "Sieben"), "sifting"],
  },
  sediment: {
    name: tx("settling and decanting", "Sedimentieren und Dekantieren"),
    prop: "density",
    how: tx("Heavier solid particles sink to the bottom (settling); the liquid above is carefully poured off (decanting).", "Schwerere feste Teilchen sinken nach unten (Sedimentieren), die Flüssigkeit darüber wird vorsichtig abgegossen (Dekantieren)."),
    accept: [tx("settling", "Sedimentieren"), tx("sedimentation", "Dekantieren"), tx("decanting", "Sedimentation"), "Absetzen"],
  },
  filter: {
    name: tx("filtering", "Filtrieren"),
    prop: "size",
    how: tx("Undissolved solid particles stay in the filter (residue); the liquid runs through (filtrate).", "Ungelöste feste Teilchen bleiben im Filter (Rückstand), die Flüssigkeit läuft durch (Filtrat)."),
    accept: [tx("filtering", "Filtrieren"), tx("filtration", "Filtration")],
  },
  evaporate: {
    name: tx("evaporating", "Eindampfen"),
    prop: "boiling",
    how: tx("The liquid boils away; the dissolved solid stays behind.", "Die Flüssigkeit verdampft, der gelöste Feststoff bleibt zurück."),
    accept: [tx("evaporating", "Eindampfen"), tx("evaporation", "Verdampfen"), "Abdampfen", "Verdunsten"],
  },
  distil: {
    name: tx("distilling", "Destillieren"),
    prop: "boiling",
    how: tx("The substance with the lower boiling temperature boils first and turns liquid again in a condenser (distillate).", "Der Stoff mit der niedrigeren Siedetemperatur siedet zuerst und wird im Kühler wieder flüssig (Destillat)."),
    accept: [tx("distilling", "Destillieren"), tx("distillation", "Destillation")],
  },
  extract: {
    name: tx("extracting", "Extrahieren"),
    prop: "solubility",
    how: tx("A solvent dissolves one substance out of a mixture.", "Ein Lösungsmittel löst einen Stoff aus einem Gemisch heraus."),
    accept: [tx("extracting", "Extrahieren"), tx("extraction", "Extraktion"), "Herauslösen"],
  },
  chroma: {
    name: tx("chromatography", "Chromatografie"),
    prop: "adhesion",
    how: tx("A solvent creeps up the paper; dyes that stick less strongly travel further.", "Ein Laufmittel steigt im Papier auf. Farbstoffe, die schwächer haften, wandern weiter."),
    accept: [tx("chromatography", "Chromatografie"), "Chromatographie", "Papierchromatografie"],
  },
  magnet: {
    name: tx("magnetic separation", "Magnetscheiden"),
    prop: "magnetism",
    how: tx("Iron, nickel and cobalt stick to a magnet; everything else stays.", "Eisen, Nickel und Cobalt bleiben am Magneten hängen, alles andere bleibt liegen."),
    accept: [tx("magnetic separation", "Magnetscheiden"), tx("magnet", "Magnettrennung"), "Magnetscheidung"],
  },
  centrifuge: {
    name: tx("centrifuging", "Zentrifugieren"),
    prop: "density",
    how: tx("Fast spinning pushes the denser parts outwards: like settling, only much faster.", "Schnelles Drehen drückt die Teile mit größerer Dichte nach außen: wie Sedimentieren, nur viel schneller."),
    accept: [tx("centrifuging", "Zentrifugieren"), tx("centrifugation", "Zentrifugation"), "Schleudern"],
  },
};

/** Everyday separations: the method that fits, other methods that would also work, and tempting wrong ones. */
export type Case = { task: Text; method: Method; also?: Method[]; traps: Partial<Record<Method, Text>> };

export const CASES: Case[] = [
  {
    task: tx("Get iron filings out of sand.", "Eisenspäne aus Sand herausholen."),
    method: "magnet",
    traps: {
      sieve: tx("Iron filings and sand grains are about the same size, so a sieve can't tell them apart. What can only iron do?", "Eisenspäne und Sandkörner sind etwa gleich groß, ein Sieb kann sie nicht unterscheiden. Was kann nur Eisen?"),
      filter: tx("A filter needs a liquid, and neither sand nor iron dissolves. What's special about iron?", "Ein Filter braucht eine Flüssigkeit, und weder Sand noch Eisen löst sich. Was ist an Eisen besonders?"),
      distil: tx("There's nothing to boil here: both are solids that melt only far above 1000 °C.", "Hier gibt es nichts zu sieden: Beides sind Feststoffe, die erst weit über 1000 °C schmelzen."),
    },
  },
  {
    task: tx("Get the salt back out of salt water.", "Das Salz aus Salzwasser zurückgewinnen."),
    method: "evaporate",
    also: ["distil"],
    traps: {
      filter: tx("Classic trap! Dissolved salt particles are far too small for a filter: the salt water runs straight through.", "Die klassische Falle! Gelöste Salzteilchen sind viel zu klein für einen Filter: Das Salzwasser läuft einfach durch."),
      sediment: tx("Dissolved salt never settles, however long you wait. It's spread out as tiny particles.", "Gelöstes Salz setzt sich nie ab, egal wie lange du wartest. Es ist in winzigen Teilchen verteilt."),
      magnet: tx("Salt isn't magnetic. Think about what happens when you heat the water.", "Salz ist nicht magnetisch. Überleg, was beim Erhitzen mit dem Wasser passiert."),
      centrifuge: tx("Spinning doesn't help: dissolved salt doesn't separate from the water by density.", "Schleudern hilft nicht: Gelöstes Salz trennt sich nicht durch die Dichte vom Wasser."),
    },
  },
  {
    task: tx("Make drinking water from sea water.", "Aus Meerwasser Trinkwasser gewinnen."),
    method: "distil",
    traps: {
      evaporate: tx("Evaporating keeps the salt, but the water escapes into the air. You want to catch the water.", "Beim Eindampfen behältst du das Salz, aber das Wasser entweicht in die Luft. Du willst das Wasser auffangen."),
      filter: tx("The salt is dissolved: it runs through any filter together with the water.", "Das Salz ist gelöst: Es läuft zusammen mit dem Wasser durch jeden Filter."),
      sediment: tx("Dissolved salt doesn't settle. The water stays salty.", "Gelöstes Salz setzt sich nicht ab. Das Wasser bleibt salzig."),
    },
  },
  {
    task: tx("Separate sand from muddy water.", "Sand aus Schlammwasser abtrennen."),
    method: "filter",
    also: ["sediment", "centrifuge", "distil", "evaporate"],
    traps: {
      magnet: tx("Sand isn't magnetic. The sand isn't dissolved, though: what can hold back solid bits?", "Sand ist nicht magnetisch. Der Sand ist aber nicht gelöst: Was kann feste Teilchen zurückhalten?"),
      sieve: tx("Sand grains are far smaller than the holes of a sieve: they'd go through with the water. A much finer 'sieve' is needed.", "Sandkörner sind viel kleiner als die Löcher eines Siebs: Sie liefen mit dem Wasser durch. Es braucht ein viel feineres „Sieb“."),
      chroma: tx("Chromatography separates dyes. Here you just need to hold back undissolved sand.", "Chromatografie trennt Farbstoffe. Hier musst du nur ungelösten Sand zurückhalten."),
    },
  },
  {
    task: tx("Separate gravel from sand.", "Kies und Sand trennen."),
    method: "sieve",
    traps: {
      filter: tx("Filtering needs a liquid. The two only differ in grain size: big and small.", "Filtrieren braucht eine Flüssigkeit. Die beiden unterscheiden sich nur in der Korngröße: groß und klein."),
      magnet: tx("Neither gravel nor sand is magnetic. What's different about them?", "Weder Kies noch Sand ist magnetisch. Was ist an ihnen verschieden?"),
      distil: tx("Nothing here boils at a sensible temperature. Look at the size of the grains.", "Hier siedet nichts bei einer vernünftigen Temperatur. Schau auf die Größe der Körner."),
    },
  },
  {
    task: tx("Find out which dyes are in a black felt-tip pen.", "Herausfinden, welche Farbstoffe in einem schwarzen Filzstift stecken."),
    method: "chroma",
    traps: {
      filter: tx("The dyes are dissolved: they'd all run through the filter together.", "Die Farbstoffe sind gelöst: Sie liefen alle zusammen durch den Filter."),
      distil: tx("Distilling would leave all the dyes behind together. You need a method that spreads them apart.", "Beim Destillieren blieben alle Farbstoffe zusammen zurück. Du brauchst ein Verfahren, das sie auseinanderzieht."),
      sieve: tx("Dye particles are tiny and dissolved. A sieve can't see the difference.", "Farbstoffteilchen sind winzig und gelöst. Ein Sieb merkt da keinen Unterschied."),
    },
  },
  {
    task: tx("Get the alcohol out of wine.", "Den Alkohol aus Wein gewinnen."),
    method: "distil",
    traps: {
      filter: tx("Alcohol and water are completely mixed (a solution). Both run through a filter.", "Alkohol und Wasser sind völlig vermischt (eine Lösung). Beides läuft durch einen Filter."),
      evaporate: tx("When you evaporate, the alcohol boils away into the air too. You need to catch it again.", "Beim Eindampfen verdampft auch der Alkohol in die Luft. Du musst ihn wieder auffangen."),
      sediment: tx("Alcohol and water don't separate by standing: they're a solution.", "Alkohol und Wasser trennen sich nicht durch Stehenlassen: Sie bilden eine Lösung."),
    },
  },
  {
    task: tx("Separate blood cells from blood plasma in a lab.", "Im Labor die Blutzellen vom Blutplasma trennen."),
    method: "centrifuge",
    also: ["sediment"],
    traps: {
      filter: tx("A paper filter would clog up and damage the cells. The cells are just a bit denser than the plasma: speed that difference up.", "Ein Papierfilter würde verstopfen und die Zellen beschädigen. Die Zellen haben nur eine etwas größere Dichte als das Plasma: Diesen Unterschied kann man beschleunigen."),
      magnet: tx("The iron in blood is bound inside the red blood cells; they don't stick to a magnet like iron filings.", "Das Eisen im Blut ist in den roten Blutkörperchen gebunden. Die bleiben nicht wie Eisenspäne an einem Magneten hängen."),
      distil: tx("Boiling would destroy the blood cells. Think about density.", "Sieden würde die Blutzellen zerstören. Denk an die Dichte."),
    },
  },
  {
    task: tx("Make coffee from ground coffee and hot water.", "Aus Kaffeepulver und heißem Wasser Kaffee machen."),
    method: "extract",
    traps: {
      distil: tx("Distilling would boil the water off again. You want the flavour to go **into** the water.", "Beim Destillieren würdest du das Wasser wieder abdampfen. Du willst, dass die Aromastoffe **ins** Wasser gehen."),
      sieve: tx("Sieving only sorts grains by size. The flavour has to be dissolved out of the powder first.", "Sieben sortiert nur Körner nach Größe. Die Aromastoffe müssen erst aus dem Pulver herausgelöst werden."),
      magnet: tx("Nothing magnetic here. Hot water dissolves something out of the powder.", "Hier ist nichts Magnetisches. Heißes Wasser löst etwas aus dem Pulver heraus."),
    },
  },
  {
    task: tx("Separate the cream from fresh milk quickly in a dairy.", "In der Molkerei den Rahm schnell von frischer Milch trennen."),
    method: "centrifuge",
    also: ["sediment"],
    traps: {
      filter: tx("The fat droplets are liquid and tiny: they'd slip through the filter.", "Die Fetttröpfchen sind flüssig und winzig: Sie rutschen durch den Filter."),
      distil: tx("Heating milk until it boils doesn't give you cream. Fat and water differ in density.", "Milch zu kochen trennt keinen Rahm ab. Fett und Wasser unterscheiden sich in der Dichte."),
      sieve: tx("The fat droplets are far smaller than the holes of a sieve.", "Die Fetttröpfchen sind viel kleiner als die Löcher eines Siebs."),
    },
  },
  {
    task: tx("Separate scrap iron from household waste at a recycling plant.", "Im Recyclinghof Eisenschrott aus dem Hausmüll aussortieren."),
    method: "magnet",
    traps: {
      sieve: tx("Iron scrap comes in all sizes, like the rest of the rubbish. What can only iron do?", "Eisenschrott gibt es in allen Größen, genau wie den restlichen Müll. Was kann nur Eisen?"),
      sediment: tx("Rubbish isn't a liquid that could settle. Use iron's special property.", "Müll ist keine Flüssigkeit, in der sich etwas absetzen könnte. Nutz die besondere Eigenschaft von Eisen."),
      chroma: tx("Chromatography is for dyes. Think about what makes iron special.", "Chromatografie ist für Farbstoffe. Überleg, was Eisen besonders macht."),
    },
  },
  {
    task: tx("Let the mud settle in the first tank of a sewage plant.", "In der Kläranlage den Schlamm im Absetzbecken abtrennen."),
    method: "sediment",
    also: ["filter", "centrifuge"],
    traps: {
      distil: tx("Distilling millions of litres of water would cost far too much energy. Just let the heavy mud sink.", "Millionen Liter Wasser zu destillieren, würde viel zu viel Energie kosten. Lass den schweren Schlamm einfach absinken."),
      magnet: tx("Mud isn't magnetic. Mud particles are denser than water, though.", "Schlamm ist nicht magnetisch. Schlammteilchen haben aber eine größere Dichte als Wasser."),
      chroma: tx("Chromatography is for separating dyes, not mud.", "Chromatografie trennt Farbstoffe, keinen Schlamm."),
    },
  },
  {
    task: tx("Wash gold grains out of river sand by swirling them in a pan.", "Goldkörnchen aus Flusssand waschen, indem man sie in einer Pfanne schwenkt."),
    method: "sediment",
    also: ["centrifuge"],
    traps: {
      magnet: tx("Gold isn't magnetic! But it's much denser than sand.", "Gold ist nicht magnetisch! Aber es hat eine viel größere Dichte als Sand."),
      sieve: tx("Gold grains and sand grains can be the same size. What's different is how heavy they are for their size.", "Goldkörnchen und Sandkörner können gleich groß sein. Verschieden ist, wie schwer sie für ihre Größe sind."),
      evaporate: tx("Evaporating the river water would leave gold and sand mixed together.", "Wenn du das Flusswasser verdampfst, bleiben Gold und Sand gemischt zurück."),
    },
  },
  {
    task: tx("Get the scent out of lavender flowers with alcohol.", "Mit Alkohol den Duftstoff aus Lavendelblüten herauslösen."),
    method: "extract",
    traps: {
      sieve: tx("Sieving only sorts grains by size. The scent has to be dissolved out of the flowers.", "Sieben sortiert nur nach Größe. Der Duftstoff muss aus den Blüten herausgelöst werden."),
      magnet: tx("Nothing magnetic here. The alcohol dissolves something out.", "Hier ist nichts Magnetisches. Der Alkohol löst etwas heraus."),
      filter: tx("Filtering comes afterwards, to remove the flowers. The scent itself is dissolved out first.", "Filtrieren kommt danach, um die Blüten zu entfernen. Der Duftstoff selbst wird vorher herausgelöst."),
    },
  },
];
