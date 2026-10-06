"use client";

// Level 1 (Klasse 5–6): nutrients and a balanced diet, teeth, and the way of the food through
// the digestive system with its helper organs.

import { resolveText, tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson } from "@/learn/types";
import { DigestionJourney1 } from "@/learn/biology/visuals/DigestionJourney";
import { DigestionPyramid } from "@/learn/biology/visuals/DigestionPyramid";
import { BASIC_PARTS, DigestionSystem, SYSTEM_PARTS, type OrganId } from "@/learn/biology/visuals/DigestionSystem";
import { DigestionTeeth, DigestionTeethExplore, TEETH_PARTS, type ToothType } from "@/learn/biology/visuals/DigestionTeeth";
import { choice, fixedChoice, matchTask, mistakes, multi, num, orderTask, pickN, quote, weighted, word, type Opt, type Stmt } from "./kit";

// ---------------------------------------------------------------------------
// Nutrients

type Nutrient = "carbs" | "fat" | "protein";

const NUTRIENT: Record<Nutrient, Text> = {
  carbs: tx("carbohydrates", "Kohlenhydrate"),
  fat: tx("fats", "Fette"),
  protein: tx("proteins", "Eiweiße (Proteine)"),
};

type FoodFact = { name: Text; main: Nutrient; why: Text; dat?: string };

const FOODS: FoodFact[] = [
  { name: tx("pasta", "Nudeln"), main: "carbs", why: tx("Pasta is made of flour, so mostly of starch.", "Nudeln werden aus Mehl gemacht und bestehen vor allem aus Stärke.") },
  { name: tx("bread", "Brot"), main: "carbs", why: tx("Bread is made of flour, so mostly of starch.", "Brot wird aus Mehl gebacken und besteht vor allem aus Stärke.") },
  { name: tx("potatoes", "Kartoffeln"), main: "carbs", why: tx("Potatoes store starch: that's why they fill you up.", "Kartoffeln speichern Stärke: Darum machen sie satt.") },
  { name: tx("rice", "Reis"), main: "carbs", why: tx("Rice grains are packed with starch.", "Reiskörner sind voller Stärke.") },
  { name: tx("honey", "Honig"), main: "carbs", why: tx("Honey is almost pure sugar, and sugars are carbohydrates.", "Honig ist fast reiner Zucker, und Zucker gehört zu den Kohlenhydraten.") },
  { name: tx("oat flakes", "Haferflocken"), main: "carbs", why: tx("Oats are a cereal: mostly starch.", "Hafer ist ein Getreide: vor allem Stärke.") },
  { name: tx("butter", "Butter"), main: "fat", why: tx("Butter is more than 80 % fat.", "Butter besteht zu über 80 % aus Fett.") },
  { name: tx("cooking oil", "Speiseöl"), main: "fat", why: tx("Oil is pure fat.", "Öl ist reines Fett.") },
  { name: tx("bacon", "Speck"), main: "fat", why: tx("Bacon is mainly fat tissue.", "Speck ist vor allem Fettgewebe.") },
  { name: tx("walnuts", "Walnüsse"), main: "fat", why: tx("Nuts contain lots of fat, more than half their weight.", "Nüsse enthalten viel Fett, mehr als die Hälfte ihres Gewichts.") },
  { name: tx("eggs", "Eier"), main: "protein", why: tx("Egg white is almost pure protein (plus water).", "Eiklar ist fast reines Eiweiß (und Wasser).") },
  { name: tx("fish", "Fisch"), main: "protein", why: tx("Fish is muscle, and muscle is built from protein.", "Fisch ist Muskelfleisch, und Muskeln sind aus Eiweiß gebaut.") },
  { name: tx("lean meat", "mageres Fleisch"), dat: "magerem Fleisch", main: "protein", why: tx("Meat is muscle, and muscle is built from protein.", "Fleisch ist Muskel, und Muskeln sind aus Eiweiß gebaut.") },
  { name: tx("low-fat quark", "Magerquark"), main: "protein", why: tx("Quark is made from milk protein.", "Quark wird aus Milcheiweiß hergestellt.") },
  { name: tx("lentils", "Linsen"), main: "protein", why: tx("Pulses like lentils and beans are rich in plant protein (and starch).", "Hülsenfrüchte wie Linsen und Bohnen sind reich an Pflanzeneiweiß (und Stärke).") },
];

const nutrientOpts = (main: Nutrient, f: FoodFact): Opt[] => {
  const other = (["carbs", "fat", "protein"] as Nutrient[]).filter((n) => n !== main);
  return [
    { text: NUTRIENT[main] },
    ...other.map((n) => ({
      text: NUTRIENT[n],
      title: tx("Another nutrient wins", "Ein anderer Nährstoff überwiegt"),
      say: tx(`Not quite: ${resolveText(f.why, "en")}`, `Nicht ganz: ${resolveText(f.why, "de")}`),
    })),
    {
      text: tx("vitamins", "Vitamine"),
      title: tx("Vitamins come in tiny amounts", "Vitamine gibt es nur in winzigen Mengen"),
      say: tx("Vitamins are important, but there are only tiny amounts in any food. Which nutrient makes up most of it?", "Vitamine sind wichtig, aber sie stecken nur in winzigen Mengen in einem Lebensmittel. Welcher Nährstoff macht den Großteil aus?"),
    },
  ];
};

function foodTask(rng: Rng): Exercise {
  const f = rng.pick(FOODS);
  const c = choice(rng, nutrientOpts(f.main, f));
  return {
    instruction: tx("Which nutrient?", "Welcher Nährstoff?"),
    text: tx(`Which nutrient makes up most of **${resolveText(f.name, "en")}** (apart from water)?`, `Welcher Nährstoff steckt vor allem in **${f.dat ?? resolveText(f.name, "de")}** (außer Wasser)?`),
    answer: c.answer,
    hint: tx("Energy from starch and sugar, energy from fat, or building material for muscles?", "Energie aus Stärke und Zucker, Energie aus Fett oder Baustoff für Muskeln?"),
    solution: [{ math: quote(NUTRIENT[f.main]), note: f.why }],
    mistakes: c.mistakes,
  };
}

function foodMatchTask(rng: Rng): Exercise {
  const pick = (n: Nutrient) => rng.pick(FOODS.filter((f) => f.main === n));
  const trio = rng.shuffle(["carbs", "fat", "protein"] as Nutrient[]).map((n) => pick(n));
  const short: Record<Nutrient, Text> = { carbs: tx("mostly carbohydrates", "vor allem Kohlenhydrate"), fat: tx("mostly fat", "vor allem Fett"), protein: tx("mostly protein", "vor allem Eiweiß") };
  const carbsFood = trio.find((f) => f.main === "carbs")!;
  const proteinFood = trio.find((f) => f.main === "protein")!;
  return matchTask({
    instruction: tx("Match the food to its nutrient", "Ordne den Nährstoff zu"),
    text: tx("What do these foods mainly contain (apart from water)?", "Was steckt in diesen Lebensmitteln vor allem drin (außer Wasser)?"),
    pairs: trio.map((f) => [f.name, short[f.main]] as [Text, Text]),
    hint: tx("Cereals and potatoes: starch. Oil, butter, nuts: fat. Meat, fish, eggs, quark, pulses: protein.", "Getreide und Kartoffeln: Stärke. Öl, Butter, Nüsse: Fett. Fleisch, Fisch, Ei, Quark, Hülsenfrüchte: Eiweiß."),
    solution: trio.map((f) => ({ math: tx(`"${resolveText(f.name, "en")}" \\to "${resolveText(short[f.main], "en")}"`, `"${resolveText(f.name, "de")}" \\to "${resolveText(short[f.main], "de")}"`), note: f.why })),
    wrong: [
      {
        pairs: [[proteinFood.name, short.carbs]],
        title: tx("Protein foods", "Eiweißreiche Lebensmittel"),
        say: tx(`Hm, look again: ${resolveText(proteinFood.why, "en")}`, `Hm, schau noch mal: ${resolveText(proteinFood.why, "de")}`),
      },
      {
        pairs: [[carbsFood.name, short.protein]],
        title: tx("Starch, not protein", "Stärke, nicht Eiweiß"),
        say: tx(`Ah, I see! But ${resolveText(carbsFood.why, "en").replace(/^./, (c) => c.toLowerCase())}`, `Ah, verstehe! Aber: ${resolveText(carbsFood.why, "de")}`),
      },
    ],
  });
}

type Q = { q: Text; opts: Opt[]; hint: Text; note: Text };

const NUTRIENT_QS: Q[] = [
  {
    q: tx("Which nutrients are the body's main building material, for example for muscles?", "Welche Nährstoffe sind der wichtigste Baustoff des Körpers, zum Beispiel für Muskeln?"),
    opts: [
      { text: tx("proteins", "Eiweiße (Proteine)") },
      { text: tx("carbohydrates", "Kohlenhydrate"), title: tx("Carbohydrates are fuel", "Kohlenhydrate sind Brennstoff"), say: tx("Carbohydrates are mainly burnt for energy. Muscles are built from **proteins**.", "Kohlenhydrate werden vor allem für Energie verbrannt. Muskeln sind aus **Eiweißen** gebaut.") },
      { text: tx("fats", "Fette"), title: tx("Fat is a store", "Fett ist ein Speicher"), say: tx("Fat is mainly a store of energy. The building material is protein.", "Fett ist vor allem ein Energiespeicher. Baustoff sind die Eiweiße.") },
      { text: tx("vitamins", "Vitamine"), title: tx("Far too little", "Viel zu wenig"), say: tx("Vitamins are vital, but you only need tiny amounts. You can't build muscles from them.", "Vitamine sind lebenswichtig, aber du brauchst nur winzige Mengen. Muskeln baust du daraus nicht.") },
    ],
    hint: tx("Meat, fish and eggs are rich in it.", "Fleisch, Fisch und Eier sind reich daran."),
    note: tx("**Proteins** are building materials: muscles, skin, hair and enzymes are made of them.", "**Eiweiße** sind Baustoffe: Muskeln, Haut, Haare und Enzyme bestehen daraus."),
  },
  {
    q: tx("Which nutrient contains the most energy per gram?", "Welcher Nährstoff enthält pro Gramm die meiste Energie?"),
    opts: [
      { text: tx("fat", "Fett") },
      { text: tx("sugar", "Zucker"), title: tx("Sugar has less", "Zucker hat weniger"), say: tx("Sugar is quick energy, but per gram fat has more than twice as much.", "Zucker ist schnelle Energie, aber pro Gramm hat Fett mehr als doppelt so viel.") },
      { text: tx("protein", "Eiweiß"), title: tx("Protein has less", "Eiweiß hat weniger"), say: tx("Protein has about as much energy as sugar per gram. Fat has more than twice as much.", "Eiweiß hat pro Gramm etwa so viel Energie wie Zucker. Fett hat mehr als doppelt so viel.") },
      { text: tx("water", "Wasser"), title: tx("Water has no energy", "Wasser hat keine Energie"), say: tx("Water is vital, but it contains no energy at all.", "Wasser ist lebenswichtig, enthält aber überhaupt keine Energie.") },
    ],
    hint: tx("That's why the body uses it as its energy store.", "Darum nutzt der Körper ihn als Energiespeicher."),
    note: tx("**Fat** has more than twice as much energy per gram as sugar or protein. That makes it the perfect store.", "**Fett** hat pro Gramm mehr als doppelt so viel Energie wie Zucker oder Eiweiß. Darum ist es der perfekte Speicher."),
  },
  {
    q: tx("What are dietary fibres good for?", "Wofür sind Ballaststoffe gut?"),
    opts: [
      { text: tx("They fill you up and keep the gut moving.", "Sie machen satt und halten den Darm in Schwung.") },
      { text: tx("They are the most important source of energy.", "Sie sind die wichtigste Energiequelle."), title: tx("We can't digest them", "Wir können sie nicht verdauen"), say: tx("Our own enzymes can't digest fibres at all. Energy mostly comes from carbohydrates and fats.", "Ballaststoffe kann der Körper mit seinen eigenen Enzymen gar nicht verdauen. Energie kommt vor allem aus Kohlenhydraten und Fetten.") },
      { text: tx("They build up muscles.", "Sie bauen Muskeln auf."), title: tx("That's protein", "Das ist Eiweiß"), say: tx("Muscles are built from proteins. Fibres pass through the gut largely undigested.", "Muskeln werden aus Eiweißen gebaut. Ballaststoffe wandern größtenteils unverdaut durch den Darm.") },
      { text: tx("They are unhealthy ballast.", "Sie sind ungesunder Ballast."), title: tx("The name tricks you", "Der Name täuscht"), say: tx("The name sounds like useless ballast, but fibres are healthy: they fill you up and help digestion.", "Der Name klingt nach nutzlosem Ballast, aber Ballaststoffe sind gesund: Sie sättigen und helfen der Verdauung.") },
    ],
    hint: tx("They are plant fibres in wholemeal bread, vegetables and fruit.", "Es sind Pflanzenfasern in Vollkornbrot, Gemüse und Obst."),
    note: tx("**Dietary fibres** are plant fibres we can't digest. They swell up, fill you up and keep the gut moving.", "**Ballaststoffe** sind Pflanzenfasern, die wir nicht verdauen können. Sie quellen auf, sättigen und halten den Darm in Schwung."),
  },
  {
    q: tx("Why do you need calcium?", "Wofür brauchst du Calcium?"),
    opts: [
      { text: tx("for bones and teeth", "für Knochen und Zähne") },
      { text: tx("for the red blood colour", "für den roten Blutfarbstoff"), title: tx("That's iron", "Das ist Eisen"), say: tx("For blood you need **iron**. Calcium makes bones and teeth hard.", "Für das Blut brauchst du **Eisen**. Calcium macht Knochen und Zähne hart.") },
      { text: tx("as a store of energy", "als Energiespeicher"), title: tx("Minerals have no energy", "Mineralstoffe haben keine Energie"), say: tx("Minerals like calcium contain no energy. The energy store is fat.", "Mineralstoffe wie Calcium enthalten keine Energie. Der Energiespeicher ist Fett.") },
      { text: tx("for the thyroid gland", "für die Schilddrüse"), title: tx("That's iodine", "Das ist Iod"), say: tx("The thyroid gland needs **iodine**. Calcium is for bones and teeth.", "Die Schilddrüse braucht **Iod**. Calcium ist für Knochen und Zähne.") },
    ],
    hint: tx("Milk and cheese are rich in it.", "Milch und Käse sind reich daran."),
    note: tx("**Calcium** is a mineral. It makes bones and teeth hard. Good sources: milk, cheese, yoghurt.", "**Calcium** ist ein Mineralstoff. Es macht Knochen und Zähne hart. Gute Quellen: Milch, Käse, Joghurt."),
  },
  {
    q: tx("Which food is a good source of vitamin C?", "Welches Lebensmittel ist eine gute Quelle für Vitamin C?"),
    opts: [
      { text: tx("red pepper", "Paprika") },
      { text: tx("butter", "Butter"), title: tx("Mostly fat", "Vor allem Fett"), say: tx("Butter is mostly fat. Vitamin C is found in fresh fruit and vegetables.", "Butter ist vor allem Fett. Vitamin C steckt in frischem Obst und Gemüse.") },
      { text: tx("white bread", "Weißbrot"), title: tx("Mostly starch", "Vor allem Stärke"), say: tx("White bread is mostly starch. Vitamin C is found in fresh fruit and vegetables.", "Weißbrot ist vor allem Stärke. Vitamin C steckt in frischem Obst und Gemüse.") },
      { text: tx("sugar", "Zucker"), title: tx("Just energy", "Nur Energie"), say: tx("Sugar brings energy and nothing else. Vitamin C is in fresh fruit and vegetables.", "Zucker bringt Energie und sonst nichts. Vitamin C steckt in frischem Obst und Gemüse.") },
    ],
    hint: tx("Think fresh and colourful.", "Denk an frisch und bunt."),
    note: tx("**Vitamin C** is in fresh fruit and vegetables: red pepper, citrus fruit, kiwi. It helps your body's defences.", "**Vitamin C** steckt in frischem Obst und Gemüse: Paprika, Zitrusfrüchte, Kiwi. Es unterstützt die Abwehrkräfte."),
  },
  {
    q: tx("Which nutrients does the body use mainly as fuel for energy?", "Welche Nährstoffe nutzt der Körper vor allem als Brennstoff für Energie?"),
    opts: [
      { text: tx("carbohydrates and fats", "Kohlenhydrate und Fette") },
      { text: tx("vitamins and minerals", "Vitamine und Mineralstoffe"), title: tx("No energy in them", "Darin steckt keine Energie"), say: tx("Vitamins and minerals contain no energy. They are needed in small amounts for other jobs.", "Vitamine und Mineralstoffe enthalten keine Energie. Sie werden in kleinen Mengen für andere Aufgaben gebraucht.") },
      { text: tx("proteins and water", "Eiweiße und Wasser"), title: tx("Proteins build", "Eiweiße bauen"), say: tx("Proteins are mainly building materials, and water has no energy at all.", "Eiweiße sind vor allem Baustoffe, und Wasser hat gar keine Energie.") },
      { text: tx("dietary fibres", "Ballaststoffe"), title: tx("Not digestible", "Nicht verdaulich"), say: tx("We can't digest fibres with our own enzymes. They don't count as fuel.", "Ballaststoffe können wir mit eigenen Enzymen nicht verdauen. Als Brennstoff zählen sie nicht.") },
    ],
    hint: tx("Bread and pasta, butter and oil.", "Brot und Nudeln, Butter und Öl."),
    note: tx("**Carbohydrates** and **fats** are the fuels. Proteins are mainly building materials.", "**Kohlenhydrate** und **Fette** sind die Brennstoffe. Eiweiße sind vor allem Baustoffe."),
  },
  {
    q: tx("Which mineral does the body need to make blood?", "Welchen Mineralstoff braucht der Körper für die Blutbildung?"),
    opts: [
      { text: tx("iron", "Eisen") },
      { text: tx("calcium", "Calcium"), title: tx("That's for bones", "Das ist für Knochen"), say: tx("Calcium is for bones and teeth. Blood needs **iron**.", "Calcium ist für Knochen und Zähne. Das Blut braucht **Eisen**.") },
      { text: tx("iodine", "Iod"), title: tx("That's for the thyroid", "Das ist für die Schilddrüse"), say: tx("Iodine is for the thyroid gland. Blood needs **iron**.", "Iod ist für die Schilddrüse. Das Blut braucht **Eisen**.") },
      { text: tx("fluoride", "Fluorid"), title: tx("That's for teeth", "Das ist für die Zähne"), say: tx("Fluoride hardens tooth enamel. Blood needs **iron**.", "Fluorid härtet den Zahnschmelz. Das Blut braucht **Eisen**.") },
    ],
    hint: tx("Meat and lentils are rich in it. A lack makes you tired and pale.", "Fleisch und Linsen sind reich daran. Fehlt er, wirst du müde und blass."),
    note: tx("**Iron** is part of the red blood pigment that carries oxygen. Good sources: meat, lentils, wholemeal.", "**Eisen** ist Teil des roten Blutfarbstoffs, der Sauerstoff transportiert. Gute Quellen: Fleisch, Linsen, Vollkorn."),
  },
  {
    q: tx("How much should you drink a day, roughly?", "Wie viel solltest du ungefähr am Tag trinken?"),
    opts: [
      { text: tx("about 1.5 litres", "etwa 1,5 Liter") },
      { text: tx("about 0.2 litres", "etwa 0,2 Liter"), title: tx("Far too little", "Viel zu wenig"), say: tx("That's just one glass. You lose much more water every day by breathing, sweating and urine.", "Das ist nur ein Glas. Du verlierst jeden Tag viel mehr Wasser durch Atmen, Schwitzen und Urin.") },
      { text: tx("about 8 litres", "etwa 8 Liter"), title: tx("Far too much", "Viel zu viel"), say: tx("That would be far too much. About six glasses a day are right.", "Das wäre viel zu viel. Etwa sechs Gläser am Tag sind richtig.") },
      { text: tx("nothing, food is enough", "nichts, das Essen reicht"), title: tx("You need to drink", "Trinken muss sein"), say: tx("Food contains some water, but not enough. You need to drink about six glasses a day.", "Essen enthält etwas Wasser, aber nicht genug. Du musst etwa sechs Gläser am Tag trinken.") },
    ],
    hint: tx("The food pyramid has six blocks for drinks.", "Die Ernährungspyramide hat sechs Bausteine für Getränke."),
    note: tx("About **1.5 litres** (six glasses), best water or unsweetened tea. More when it's hot or you do sport.", "Etwa **1,5 Liter** (sechs Gläser), am besten Wasser oder ungesüßten Tee. Mehr, wenn es heiß ist oder du Sport machst."),
  },
];

function nutrientQuestion(rng: Rng, bank: Q[], instruction: Text): Exercise {
  const qq = rng.pick(bank);
  const c = choice(rng, qq.opts);
  return { instruction, text: qq.q, answer: c.answer, hint: qq.hint, solution: [{ math: quote(qq.opts[0].text), note: qq.note }], mistakes: c.mistakes };
}

// ---------------------------------------------------------------------------
// Food pyramid

const PYRAMID_QS: Q[] = [
  {
    q: tx("What is on the bottom, widest level of the food pyramid?", "Was steht auf der untersten, breitesten Stufe der Ernährungspyramide?"),
    opts: [
      { text: tx("drinks like water and unsweetened tea", "Getränke wie Wasser und ungesüßter Tee") },
      { text: tx("bread, pasta and potatoes", "Brot, Nudeln und Kartoffeln"), title: tx("One level up", "Eine Stufe höher"), say: tx("Close! Cereals and potatoes are in the green part too, but the base is drinks.", "Fast! Getreide und Kartoffeln sind auch im grünen Bereich, aber die Basis sind Getränke.") },
      { text: tx("meat and sausage", "Fleisch und Wurst"), title: tx("Meat is higher up", "Fleisch steht weiter oben"), say: tx("Meat and sausage are in the yellow part: one portion a day is enough.", "Fleisch und Wurst stehen im gelben Bereich: Eine Portion am Tag reicht.") },
      { text: tx("sweets and snacks", "Süßes und Knabberzeug"), title: tx("That's the top", "Das ist die Spitze"), say: tx("Sweets are at the very top, in red: only a little.", "Süßes steht ganz oben im roten Bereich: nur wenig.") },
    ],
    hint: tx("The base is what you need most of.", "Die Basis ist das, wovon du am meisten brauchst."),
    note: tx("The base: **drinks**, six portions a day.", "Die Basis: **Getränke**, sechs Portionen am Tag."),
  },
  {
    q: tx("Apart from drinks: of which group should you eat the most portions a day?", "Abgesehen von Getränken: Von welcher Gruppe solltest du am Tag die meisten Portionen essen?"),
    opts: [
      { text: tx("vegetables and fruit", "Gemüse und Obst") },
      { text: tx("bread, cereals and potatoes", "Brot, Getreide und Kartoffeln"), title: tx("Close: four portions", "Knapp: vier Portionen"), say: tx("Close! Cereals and potatoes get four portions. Vegetables and fruit get five.", "Knapp daneben! Getreide und Kartoffeln bekommen vier Portionen, Gemüse und Obst fünf.") },
      { text: tx("milk and dairy products", "Milch und Milchprodukte"), title: tx("Three portions", "Drei Portionen"), say: tx("Milk products are good, but three portions are enough. Vegetables and fruit get five.", "Milchprodukte sind gut, aber drei Portionen reichen. Gemüse und Obst bekommen fünf.") },
      { text: tx("meat, fish and eggs", "Fleisch, Fisch und Eier"), title: tx("Just one portion", "Nur eine Portion"), say: tx("For meat, fish or egg one portion a day is enough.", "Bei Fleisch, Fisch oder Ei reicht eine Portion am Tag.") },
    ],
    hint: tx("\"Five a day\"", "„Fünf am Tag“"),
    note: tx("**Vegetables and fruit**: five portions a day, three of vegetables and two of fruit.", "**Gemüse und Obst**: fünf Portionen am Tag, drei Gemüse und zwei Obst."),
  },
  {
    q: tx("Which foods are at the top of the pyramid, in red?", "Welche Lebensmittel stehen an der Spitze der Pyramide, im roten Bereich?"),
    opts: [
      { text: tx("sweets, snacks and soft drinks", "Süßes, Knabberzeug und Limo") },
      { text: tx("oils and fats", "Öle und Fette"), title: tx("Yellow, just below", "Gelb, knapp darunter"), say: tx("Oils and fats are just below, in yellow: two portions a day are fine.", "Öle und Fette stehen knapp darunter im gelben Bereich: zwei Portionen am Tag sind in Ordnung.") },
      { text: tx("vegetables", "Gemüse"), title: tx("Vegetables are green", "Gemüse ist grün"), say: tx("Vegetables are in the green part: eat plenty!", "Gemüse steht im grünen Bereich: Davon darfst du reichlich essen!") },
      { text: tx("water", "Wasser"), title: tx("Water is the base", "Wasser ist die Basis"), say: tx("Water is the base of the pyramid, not the top.", "Wasser ist die Basis der Pyramide, nicht die Spitze.") },
    ],
    hint: tx("Red means: only a little.", "Rot heißt: nur wenig."),
    note: tx("At the top, in red: **extras** like sweets, snacks and soft drinks. One small portion a day at most.", "Oben im roten Bereich: **Extras** wie Süßes, Knabberzeug und Limo. Höchstens eine kleine Portion am Tag."),
  },
  {
    q: tx("What does \"balanced diet\" mean?", "Was bedeutet „ausgewogene Ernährung“?"),
    opts: [
      { text: tx("eating a varied mix, in the right amounts", "abwechslungsreich und in den richtigen Mengen essen") },
      { text: tx("never eating sweets again", "nie wieder Süßes essen"), title: tx("A little is fine", "Ein bisschen ist okay"), say: tx("A balanced diet allows a small treat. It's about the mix.", "Ausgewogen darf auch mal etwas Süßes sein. Es kommt auf die Mischung an.") },
      { text: tx("eating only fruit and vegetables", "nur Obst und Gemüse essen"), title: tx("Too one-sided", "Zu einseitig"), say: tx("Only fruit and vegetables would be one-sided: you also need protein, fat and starch.", "Nur Obst und Gemüse wäre einseitig: Du brauchst auch Eiweiß, Fett und Stärke.") },
      { text: tx("eating as much protein as possible", "möglichst viel Eiweiß essen"), title: tx("More isn't better", "Mehr ist nicht besser"), say: tx("Too much of one nutrient isn't balanced. The mix matters.", "Zu viel von einem Nährstoff ist nicht ausgewogen. Die Mischung macht's.") },
    ],
    hint: tx("Think of the whole pyramid, not one level.", "Denk an die ganze Pyramide, nicht an eine Stufe."),
    note: tx("**Balanced** means: a varied mix of all food groups in the amounts the pyramid shows.", "**Ausgewogen** heißt: eine abwechslungsreiche Mischung aller Lebensmittelgruppen in den Mengen, die die Pyramide zeigt."),
  },
];

const PORTIONS: { group: Text; n: number; wrong: [number, Text][] }[] = [
  { group: tx("drinks", "Getränke"), n: 6, wrong: [[5, tx("That's vegetables and fruit together. Drinks get one more.", "Das sind Gemüse und Obst zusammen. Getränke bekommen eins mehr.")]] },
  { group: tx("vegetables and fruit (together)", "Gemüse und Obst (zusammen)"), n: 5, wrong: [[3, tx("Three is just the vegetables. Add the two portions of fruit.", "Drei sind nur das Gemüse. Zähl die zwei Portionen Obst dazu.")], [6, tx("Six is for drinks. Vegetables and fruit get one less.", "Sechs sind die Getränke. Gemüse und Obst bekommen eine weniger.")]] },
  { group: tx("bread, cereals and potatoes", "Brot, Getreide und Kartoffeln"), n: 4, wrong: [[5, tx("Five is vegetables and fruit. Cereals and potatoes get one less.", "Fünf sind Gemüse und Obst. Getreide und Kartoffeln bekommen eine weniger.")]] },
  { group: tx("milk and dairy products", "Milch und Milchprodukte"), n: 3, wrong: [[1, tx("One is for meat, fish or egg. Dairy gets three.", "Eine ist für Fleisch, Fisch oder Ei. Milchprodukte bekommen drei.")]] },
  { group: tx("oils and fats", "Öle und Fette"), n: 2, wrong: [[1, tx("One portion is the extras at the top. Oils and fats get two.", "Eine Portion sind die Extras ganz oben. Öle und Fette bekommen zwei.")]] },
  { group: tx("meat, sausage, fish or egg", "Fleisch, Wurst, Fisch oder Ei"), n: 1, wrong: [[3, tx("Three is a lot: one portion of meat, sausage, fish or egg a day is enough.", "Drei sind viel: Eine Portion Fleisch, Wurst, Fisch oder Ei am Tag reicht.")]] },
];

function portionsTask(rng: Rng): Exercise {
  const p = rng.pick(PORTIONS);
  const m = mistakes(num(p.n, 0));
  for (const [v, say] of p.wrong) m.add(num(v, 0), tx("Wrong level", "Falsche Stufe"), say);
  return {
    instruction: tx("Portions a day", "Portionen am Tag"),
    text: tx(`How many portions of **${resolveText(p.group, "en")}** a day does the food pyramid recommend?`, `Wie viele Portionen **${resolveText(p.group, "de")}** empfiehlt die Ernährungspyramide pro Tag?`),
    answer: num(p.n, 0),
    hint: tx("From the bottom: drinks 6, vegetables and fruit 5, cereals 4, dairy 3 plus meat/fish/egg 1, fats 2, extras 1.", "Von unten: Getränke 6, Gemüse und Obst 5, Getreide 4, Milch 3 plus Fleisch/Fisch/Ei 1, Fette 2, Extras 1."),
    solution: [
      { math: "6 \\quad 5 \\quad 4 \\quad 3 + 1 \\quad 2 \\quad 1", note: tx("The pyramid from the bottom: drinks, vegetables and fruit, cereals, dairy plus meat/fish/egg, fats, extras.", "Die Pyramide von unten: Getränke, Gemüse und Obst, Getreide, Milch plus Fleisch/Fisch/Ei, Fette, Extras.") },
      { math: `${p.n}`, note: tx(`**${p.n}** portions of ${resolveText(p.group, "en")}.`, `**${p.n}** Portionen ${resolveText(p.group, "de")}.`) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Organs: names, functions, the way of the food

const organ = (id: OrganId) => SYSTEM_PARTS.find((p) => p.id === id)!;
const organName = (id: OrganId) => organ(id).label;

/** Accepted spellings per organ (both languages plus common extras). */
const ACCEPT: Record<OrganId, Text[]> = {
  mouth: [tx("mouth", "Mundhöhle"), "Mund", "oral cavity"],
  teeth: [tx("teeth", "Zähne"), "Zahn", "tooth", "Gebiss"],
  saliva: [tx("salivary glands", "Speicheldrüsen"), "Speicheldrüse", "salivary gland"],
  oesophagus: [tx("oesophagus", "Speiseröhre"), "gullet", "esophagus"],
  stomach: [tx("stomach", "Magen")],
  liver: [tx("liver", "Leber")],
  gallbladder: [tx("gall bladder", "Gallenblase"), "gallbladder"],
  pancreas: [tx("pancreas", "Bauchspeicheldrüse")],
  small: [tx("small intestine", "Dünndarm")],
  large: [tx("large intestine", "Dickdarm"), "colon", "Grimmdarm"],
  appendix: [tx("appendix", "Blinddarm"), "Wurmfortsatz", "caecum"],
  rectum: [tx("rectum", "Mastdarm"), "Enddarm"],
  anus: [tx("anus", "After")],
  duodenum: [tx("duodenum", "Zwölffingerdarm")],
};

/** Organs that look alike or sit close, and why they're different. */
const CONFUSE: Partial<Record<OrganId, [OrganId, Text][]>> = {
  small: [["large", tx("The large intestine is the thick tube that frames the small intestine like a picture frame. The coiled one in the middle is the small intestine.", "Der Dickdarm ist der dicke Schlauch, der den Dünndarm wie ein Bilderrahmen umgibt. Der aufgeknäuelte in der Mitte ist der Dünndarm.")]],
  large: [["small", tx("The small intestine is the long coiled tube in the middle. The thicker tube around it is the large intestine.", "Der Dünndarm ist der lange, aufgeknäuelte Schlauch in der Mitte. Der dickere Schlauch drumherum ist der Dickdarm.")]],
  stomach: [["liver", tx("The liver is the big brown-red organ on the right side of the body (left in the picture). The stomach is the pink bag on the other side.", "Die Leber ist das große rotbraune Organ auf der rechten Körperseite (im Bild links). Der Magen ist der rosa Sack auf der anderen Seite.")]],
  liver: [["stomach", tx("The stomach is the pink bag where the oesophagus ends. The big brown-red organ next to it is the liver.", "Der Magen ist der rosa Sack, in dem die Speiseröhre endet. Das große rotbraune Organ daneben ist die Leber.")]],
  pancreas: [["stomach", tx("The stomach sits above it. The long gland below the stomach is the pancreas.", "Der Magen liegt darüber. Die lange Drüse unter dem Magen ist die Bauchspeicheldrüse.")]],
  gallbladder: [["liver", tx("The liver is the big organ. The small green bag hanging below it is the gall bladder.", "Die Leber ist das große Organ. Der kleine grüne Beutel darunter ist die Gallenblase.")]],
  rectum: [["anus", tx("The anus is just the opening at the very end. The last piece of gut before it is the rectum.", "Der After ist nur die Öffnung ganz am Ende. Das letzte Darmstück davor ist der Mastdarm.")]],
  oesophagus: [["stomach", tx("The stomach is the bag at the end of this tube. The tube itself is the oesophagus.", "Der Magen ist der Sack am Ende dieses Schlauchs. Der Schlauch selbst ist die Speiseröhre.")]],
};

function organNameExercise(id: OrganId): Exercise {
  const m = mistakes(word(ACCEPT[id], tx("name of the organ", "Name des Organs")));
  for (const [other, say] of CONFUSE[id] ?? []) m.add(word(ACCEPT[other]), tx("Neighbour mixed up", "Nachbarorgan verwechselt"), say);
  const o = organ(id);
  return {
    instruction: tx("Name the organ", "Benenne das Organ"),
    text: tx("What is the organ marked with **?** called?", "Wie heißt das mit **?** markierte Organ?"),
    visual: { component: DigestionSystem as never, props: { mode: "numbers", ask: id, legend: "none", show: [id] } },
    answer: word(ACCEPT[id], tx("name of the organ", "Name des Organs")),
    hint: tx("Follow the way of the food from the mouth: where is the marked spot?", "Folge dem Weg der Nahrung vom Mund aus: Wo liegt die markierte Stelle?"),
    solution: [{ math: quote(o.label), note: o.info ?? o.label }],
    mistakes: m.list,
  };
}

function organNameTask(rng: Rng): Exercise {
  return organNameExercise(rng.pick(BASIC_PARTS.filter((id) => id !== "teeth" && id !== "mouth")));
}

const JOBS: Record<OrganId, Text> = {
  mouth: tx("chews the food and mixes it with saliva", "zerkleinert die Nahrung und vermischt sie mit Speichel"),
  teeth: tx("bite off and grind the food", "beißen ab und zermahlen die Nahrung"),
  saliva: tx("make saliva", "bilden Speichel"),
  oesophagus: tx("pushes the bite to the stomach", "schiebt den Bissen in den Magen"),
  stomach: tx("kneads the food with acidic gastric juice", "knetet die Nahrung mit saurem Magensaft"),
  liver: tx("makes bile", "bildet die Galle"),
  gallbladder: tx("stores bile", "speichert die Galle"),
  pancreas: tx("makes a digestive juice for the small intestine", "bildet einen Verdauungssaft für den Dünndarm"),
  small: tx("nutrients pass into the blood here", "hier gelangen die Nährstoffe ins Blut"),
  large: tx("takes water back from the leftovers", "entzieht den Resten Wasser"),
  appendix: tx("a small dead end at the start of the large intestine", "eine kleine Sackgasse am Anfang des Dickdarms"),
  rectum: tx("collects the faeces", "sammelt den Kot"),
  anus: tx("lets the faeces out", "lässt den Kot hinaus"),
  duodenum: tx("first part of the small intestine, bile flows in", "erster Abschnitt des Dünndarms, hier mündet die Galle"),
};

const JOB_ORGANS: OrganId[] = ["oesophagus", "stomach", "liver", "gallbladder", "pancreas", "small", "large", "rectum"];

function organJobTask(rng: Rng): Exercise {
  const ids = pickN(rng, JOB_ORGANS, 4);
  const extra = rng.pick(JOB_ORGANS.filter((i) => !ids.includes(i)));
  const has = (i: OrganId) => ids.includes(i);
  const wrong: { pairs: [Text, Text][]; title: Text; say: Text }[] = [];
  if (has("stomach")) wrong.push({ pairs: [[organName("stomach"), JOBS.small]], title: tx("Not in the stomach", "Nicht im Magen"), say: tx("Classic trap! The stomach kneads and starts digestion, but nutrients pass into the blood only in the **small intestine**.", "Die klassische Falle! Der Magen knetet und beginnt mit der Verdauung, aber ins Blut gehen die Nährstoffe erst im **Dünndarm**.") });
  if (has("large")) wrong.push({ pairs: [[organName("large"), JOBS.small]], title: tx("Small, not large", "Dünn-, nicht Dickdarm"), say: tx("The large intestine takes back water. The nutrients have already passed into the blood in the **small intestine**.", "Der Dickdarm holt Wasser zurück. Die Nährstoffe sind da schon im **Dünndarm** ins Blut gegangen.") });
  if (has("liver") && has("gallbladder")) wrong.push({ pairs: [[organName("liver"), JOBS.gallbladder]], title: tx("Made vs stored", "Bilden oder speichern"), say: tx("Nearly! The liver **makes** bile, the gall bladder only **stores** it.", "Fast! Die Leber **bildet** die Galle, die Gallenblase **speichert** sie nur.") });
  if (has("pancreas") && has("liver")) wrong.push({ pairs: [[organName("pancreas"), JOBS.liver]], title: tx("Two different juices", "Zwei verschiedene Säfte"), say: tx("Bile comes from the liver. The pancreas makes its own juice, the pancreatic juice.", "Die Galle kommt aus der Leber. Die Bauchspeicheldrüse bildet ihren eigenen Saft, den Bauchspeichel.") });
  return matchTask({
    instruction: tx("Match organ and job", "Ordne Organ und Aufgabe zu"),
    text: tx("What does each organ do?", "Was macht welches Organ?"),
    pairs: ids.map((i) => [organName(i), JOBS[i]] as [Text, Text]),
    distractors: [JOBS[extra]],
    hint: tx("Follow the food: mouth, oesophagus, stomach, small intestine, large intestine, rectum. Liver, gall bladder and pancreas only send juices.", "Folge der Nahrung: Mund, Speiseröhre, Magen, Dünndarm, Dickdarm, Mastdarm. Leber, Gallenblase und Bauchspeicheldrüse schicken nur Säfte."),
    solution: ids.map((i) => ({ math: tx(`"${resolveText(organName(i), "en")}"`, `"${resolveText(organName(i), "de")}"`), note: tx(`${resolveText(organName(i), "en")}: ${resolveText(JOBS[i], "en")}.`, `${resolveText(organName(i), "de")}: ${resolveText(JOBS[i], "de")}.`) })),
    wrong,
  });
}

const WAY: OrganId[] = ["mouth", "oesophagus", "stomach", "small", "large", "rectum", "anus"];
const WAY_NAME: Record<string, Text> = {
  mouth: tx("mouth", "Mund"),
  oesophagus: tx("oesophagus", "Speiseröhre"),
  stomach: tx("stomach", "Magen"),
  small: tx("small intestine", "Dünndarm"),
  large: tx("large intestine", "Dickdarm"),
  rectum: tx("rectum", "Mastdarm"),
  anus: tx("anus", "After"),
};

function wayExercise(from: number, len: number): Exercise {
  const ids = WAY.slice(from, from + len);
  const items = ids.map((i) => WAY_NAME[i]);
  const N = WAY_NAME;
  return orderTask({
    instruction: tx("Put the stations in order", "Bring die Stationen in die richtige Reihenfolge"),
    text: tx("Which way does a bite of food take through the body? Start with the first station.", "Welchen Weg nimmt ein Bissen durch den Körper? Beginne mit der ersten Station."),
    items,
    hint: tx("Small intestine first, then large intestine: the long thin one comes before the short thick one.", "Erst Dünndarm, dann Dickdarm: Der lange dünne kommt vor dem kurzen dicken."),
    solution: [
      { math: tx(items.map((i) => `"${resolveText(i, "en")}"`).join(" \\to "), items.map((i) => `"${resolveText(i, "de")}"`).join(" \\to ")), note: tx("Liver, gall bladder and pancreas are not on the way: they only add their juices.", "Leber, Gallenblase und Bauchspeicheldrüse liegen nicht auf dem Weg: Sie geben nur ihre Säfte dazu.") },
    ],
    wrong: [
      { items: [N.large, N.small], title: tx("Large before small?", "Dick- vor Dünndarm?"), say: tx("Ah, I see! The thick one sounds like it comes first, but food goes through the **small intestine** first, then the large intestine.", "Ah, ich seh's! Der Dicke klingt nach Anfang, aber die Nahrung kommt zuerst in den **Dünndarm**, dann in den Dickdarm.") },
      { items: [N.small, N.stomach], title: tx("Stomach first", "Erst der Magen"), say: tx("The oesophagus leads into the **stomach**. Only after hours there does the chyme go on to the small intestine.", "Die Speiseröhre führt in den **Magen**. Erst nach Stunden dort geht der Brei weiter in den Dünndarm.") },
      { items: [N.anus, N.rectum], title: tx("The anus is the exit", "Der After ist der Ausgang"), say: tx("The anus is the very last opening. The rectum comes just before it and collects the faeces.", "Der After ist die allerletzte Öffnung. Der Mastdarm kommt kurz davor und sammelt den Kot.") },
      { items: [N.stomach, N.oesophagus], title: tx("Swallow first", "Erst schlucken"), say: tx("After the mouth you swallow: the bite goes down the **oesophagus**, then into the stomach.", "Nach dem Mund wird geschluckt: Der Bissen rutscht durch die **Speiseröhre** und dann in den Magen.") },
    ],
  });
}

function wayTask(rng: Rng): Exercise {
  const len = rng.int(4, 6);
  return wayExercise(rng.int(0, WAY.length - len), len);
}

// Word questions about the organs
type WordQ = { q: Text; id: OrganId; wrong: [OrganId, Text, Text][]; note: Text };

const WORD_QS: WordQ[] = [
  { q: tx("Which organ stores the bile?", "Welches Organ speichert die Galle?"), id: "gallbladder", wrong: [["liver", tx("Made, not stored", "Gebildet, nicht gespeichert"), tx("Nearly! The liver **makes** the bile. It's stored in a small bag below it.", "Fast! Die Leber **bildet** die Galle. Gespeichert wird sie in einem kleinen Beutel darunter.")]], note: tx("The **gall bladder** stores the bile from the liver.", "Die **Gallenblase** speichert die Galle aus der Leber.") },
  { q: tx("Which organ makes the bile?", "Welches Organ bildet die Galle?"), id: "liver", wrong: [["gallbladder", tx("Stored, not made", "Gespeichert, nicht gebildet"), tx("The gall bladder only **stores** bile. It's made by the biggest gland of the body.", "Die Gallenblase **speichert** die Galle nur. Gebildet wird sie von der größten Drüse des Körpers.")]], note: tx("The **liver** makes bile, about half a litre a day.", "Die **Leber** bildet die Galle, etwa einen halben Liter am Tag.") },
  { q: tx("In which organ do the nutrients pass into the blood?", "In welchem Organ gelangen die Nährstoffe ins Blut?"), id: "small", wrong: [["stomach", tx("Not in the stomach", "Nicht im Magen"), tx("Classic trap! In the stomach the food is only kneaded and digestion goes on. Into the blood: in the **small intestine**.", "Die klassische Falle! Im Magen wird nur geknetet und weiterverdaut. Ins Blut geht es im **Dünndarm**.")], ["large", tx("Too late", "Zu spät"), tx("The large intestine mainly takes back water. The nutrients have already gone into the blood before.", "Der Dickdarm holt vor allem Wasser zurück. Die Nährstoffe sind schon vorher ins Blut gegangen.")]], note: tx("In the **small intestine** the building blocks pass through the gut wall into the blood.", "Im **Dünndarm** gelangen die Bausteine durch die Darmwand ins Blut.") },
  { q: tx("Which organ takes water back from the food leftovers?", "Welches Organ entzieht den Nahrungsresten Wasser?"), id: "large", wrong: [["small", tx("The next one", "Das nächste"), tx("The small intestine takes up the nutrients. Most of the remaining water is taken back in the next part, the **large intestine**.", "Der Dünndarm nimmt die Nährstoffe auf. Das restliche Wasser holt vor allem der nächste Abschnitt zurück, der **Dickdarm**.")]], note: tx("The **large intestine** takes water and minerals back: the pulp becomes firm.", "Der **Dickdarm** holt Wasser und Mineralstoffe zurück: Der Brei wird fest.") },
  { q: tx("Which organ kneads the food with acidic juice for several hours?", "Welches Organ knetet die Nahrung mehrere Stunden lang mit saurem Saft?"), id: "stomach", wrong: [["small", tx("Before that", "Davor"), tx("The small intestine isn't acidic. The acidic juice with hydrochloric acid is made by the **stomach**.", "Im Dünndarm ist es nicht sauer. Den sauren Saft mit Salzsäure bildet der **Magen**.")]], note: tx("The **stomach**: its gastric juice contains hydrochloric acid that kills germs.", "Der **Magen**: Sein Magensaft enthält Salzsäure, die Keime abtötet.") },
  { q: tx("Which muscular tube carries the bite from the throat to the stomach?", "Welcher Muskelschlauch bringt den Bissen vom Rachen in den Magen?"), id: "oesophagus", wrong: [], note: tx("The **oesophagus**: waves of muscle push the bite down.", "Die **Speiseröhre**: Muskelwellen schieben den Bissen nach unten.") },
  { q: tx("Which gland lies below the stomach and makes a juice full of digestive enzymes?", "Welche Drüse liegt unter dem Magen und bildet einen Saft voller Verdauungsenzyme?"), id: "pancreas", wrong: [["liver", tx("The liver makes bile", "Die Leber bildet Galle"), tx("The liver makes bile, which has no enzymes. The juice full of enzymes comes from the **pancreas**.", "Die Leber bildet die Galle, und die hat keine Enzyme. Der Saft voller Enzyme kommt aus der **Bauchspeicheldrüse**.")]], note: tx("The **pancreas** makes pancreatic juice for the small intestine.", "Die **Bauchspeicheldrüse** bildet den Bauchspeichel für den Dünndarm.") },
  { q: tx("Where are the faeces collected before you go to the toilet?", "Wo wird der Kot gesammelt, bevor du zur Toilette gehst?"), id: "rectum", wrong: [["anus", tx("That's the exit", "Das ist der Ausgang"), tx("The anus is just the exit with the sphincter muscle. The faeces collect in the part before it.", "Der After ist nur der Ausgang mit dem Schließmuskel. Der Kot sammelt sich im Abschnitt davor.")]], note: tx("In the **rectum**, the last part of the large intestine.", "Im **Mastdarm**, dem letzten Abschnitt des Dickdarms.") },
];

function organWordTask(rng: Rng): Exercise {
  const w = rng.pick(WORD_QS);
  const right = word(ACCEPT[w.id], tx("name of the organ", "Name des Organs"));
  const m = mistakes(right);
  for (const [id, title, say] of w.wrong) m.add(word(ACCEPT[id]), title, say);
  return {
    instruction: tx("Which organ?", "Welches Organ?"),
    text: w.q,
    answer: right,
    hint: tx("Picture the way of the food and the three helpers next to it.", "Stell dir den Weg der Nahrung vor und die drei Helfer daneben."),
    solution: [{ math: quote(ACCEPT[w.id][0]), note: w.note }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Teeth

const TOOTH_NAME: Record<ToothType, Text> = Object.fromEntries(TEETH_PARTS.map((p) => [p.id, p.label])) as Record<ToothType, Text>;

function toothTask(rng: Rng): Exercise {
  const type = rng.pick(["incisors", "canines", "premolars", "molars"] as ToothType[]);
  const part = TEETH_PARTS.find((p) => p.id === type)!;
  const why: Record<ToothType, Text> = {
    incisors: tx("These are the flat ones at the very front with a sharp edge: the incisors.", "Das sind die flachen ganz vorne mit scharfer Kante: die Schneidezähne."),
    canines: tx("This one is pointed and sits at the corner of the arch: a canine.", "Dieser ist spitz und sitzt an der Ecke des Zahnbogens: ein Eckzahn."),
    premolars: tx("These are smaller cheek teeth with two cusps, between canine and molars: premolars.", "Das sind kleinere Backenzähne mit zwei Höckern, zwischen Eckzahn und großen Backenzähnen: die vorderen Backenzähne."),
    molars: tx("These are the big cheek teeth at the back with a broad surface: molars.", "Das sind die großen Backenzähne hinten mit breiter Kaufläche: die hinteren Backenzähne."),
  };
  const opts: Opt[] = [
    { text: TOOTH_NAME[type] },
    ...(["incisors", "canines", "premolars", "molars"] as ToothType[])
      .filter((x) => x !== type)
      .map((x) => ({ text: TOOTH_NAME[x], title: tx("Look at the shape", "Schau auf die Form"), say: why[type] })),
  ];
  const c = choice(rng, opts);
  return {
    instruction: tx("Which teeth?", "Welche Zähne?"),
    text: tx("Which type of tooth is marked with **?**", "Welche Zahnart ist mit **?** markiert?"),
    visual: { component: DigestionTeeth as never, props: { mode: "numbers", ask: type, legend: "none", show: [type] } },
    answer: c.answer,
    hint: tx("From the front: cutting, holding, crushing, grinding.", "Von vorne: schneiden, festhalten, zerkleinern, zermahlen."),
    solution: [{ math: quote(TOOTH_NAME[type]), note: part.info ?? part.label }],
    mistakes: c.mistakes,
  };
}

function teethCountTask(rng: Rng): Exercise {
  const adult = rng.chance(0.6);
  const v = adult ? 32 : 20;
  const m = mistakes(num(v, 0));
  if (adult) {
    m.add(num(20, 0), tx("That's the milk teeth", "Das ist das Milchgebiss"), tx("20 is the milk teeth of a child. The permanent set has more: per half jaw 2 incisors, 1 canine, 2 premolars and 3 molars.", "20 sind die Milchzähne eines Kindes. Das Dauergebiss hat mehr: pro Kieferhälfte 2 Schneidezähne, 1 Eckzahn, 2 vordere und 3 hintere Backenzähne."));
    m.add(num(28, 0), tx("Wisdom teeth forgotten", "Weisheitszähne vergessen"), tx("Nearly! 28 is without the four wisdom teeth. Count them too.", "Fast! 28 sind es ohne die vier Weisheitszähne. Zähl sie mit."), true);
    m.add(num(16, 0), tx("Only one jaw", "Nur ein Kiefer"), tx("16 is just the upper jaw. The lower jaw has just as many.", "16 sind nur die Zähne im Oberkiefer. Der Unterkiefer hat genauso viele."));
  } else {
    m.add(num(32, 0), tx("That's the adult set", "Das ist das Erwachsenengebiss"), tx("32 is the permanent set of an adult. Children's milk teeth are fewer: there are no premolars and no third molars yet.", "32 hat das Dauergebiss eines Erwachsenen. Milchzähne sind weniger: Es gibt noch keine vorderen Backenzähne und keine dritten Backenzähne."));
    m.add(num(10, 0), tx("Only one jaw", "Nur ein Kiefer"), tx("10 is just one jaw. Upper and lower jaw together have twice as many.", "10 sind nur ein Kiefer. Ober- und Unterkiefer zusammen haben doppelt so viele."));
  }
  return {
    instruction: tx("Count the teeth", "Zähne zählen"),
    text: adult ? tx("How many teeth does the complete permanent set of an adult have (with wisdom teeth)?", "Wie viele Zähne hat das vollständige Dauergebiss eines Erwachsenen (mit Weisheitszähnen)?") : tx("How many milk teeth does a child have?", "Wie viele Milchzähne hat ein Kind?"),
    answer: num(v, 0),
    hint: adult ? tx("Per half jaw: 2 incisors, 1 canine, 2 premolars, 3 molars. And there are four half jaws.", "Pro Kieferhälfte: 2 Schneidezähne, 1 Eckzahn, 2 vordere und 3 hintere Backenzähne. Und es gibt vier Kieferhälften.") : tx("Per half jaw: 2 incisors, 1 canine, 2 molars.", "Pro Kieferhälfte: 2 Schneidezähne, 1 Eckzahn, 2 Backenzähne."),
    solution: adult
      ? [{ math: "(2 + 1 + 2 + 3) \\cdot 4 = 32", note: tx("8 teeth per half jaw, four half jaws: **32 teeth**. The last molars are the wisdom teeth.", "8 Zähne pro Kieferhälfte, vier Kieferhälften: **32 Zähne**. Die letzten Backenzähne sind die Weisheitszähne.") }]
      : [{ math: "(2 + 1 + 2) \\cdot 4 = 20", note: tx("5 teeth per half jaw, four half jaws: **20 milk teeth**.", "5 Zähne pro Kieferhälfte, vier Kieferhälften: **20 Milchzähne**.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// True or false

const TRUE_STMTS: Stmt[] = [
  { text: tx("Digestion already starts in the mouth.", "Die Verdauung beginnt schon im Mund.") },
  { text: tx("Nutrients pass into the blood in the small intestine.", "Im Dünndarm gelangen die Nährstoffe ins Blut.") },
  { text: tx("The large intestine takes water back from the leftovers.", "Der Dickdarm entzieht den Resten Wasser.") },
  { text: tx("The liver makes bile.", "Die Leber bildet die Galle.") },
  { text: tx("Hydrochloric acid in the stomach kills germs.", "Salzsäure im Magen tötet Keime ab.") },
  { text: tx("Fat contains more energy per gram than sugar.", "Fett enthält pro Gramm mehr Energie als Zucker.") },
  { text: tx("Proteins are building materials for muscles.", "Eiweiße sind Baustoffe für Muskeln.") },
];
const FALSE_STMTS: Stmt[] = [
  { text: tx("Digestion only starts in the stomach.", "Die Verdauung beginnt erst im Magen."), title: tx("It starts in the mouth", "Sie beginnt im Mund"), say: tx("Classic trap! Saliva already starts to break down starch in the **mouth**.", "Die klassische Falle! Schon im **Mund** beginnt der Speichel, Stärke zu zerlegen.") },
  { text: tx("Most nutrients pass into the blood in the stomach.", "Die meisten Nährstoffe gelangen im Magen ins Blut."), title: tx("Not in the stomach", "Nicht im Magen"), say: tx("The stomach kneads and digests, but the building blocks pass into the blood in the **small intestine**.", "Der Magen knetet und verdaut, aber ins Blut gehen die Bausteine im **Dünndarm**.") },
  { text: tx("Food passes through the liver on its way.", "Die Nahrung wandert auf ihrem Weg durch die Leber."), title: tx("Helpers aren't on the way", "Helfer liegen nicht auf dem Weg"), say: tx("Liver, gall bladder and pancreas only send juices into the gut. The food itself never passes through them.", "Leber, Gallenblase und Bauchspeicheldrüse schicken nur Säfte in den Darm. Die Nahrung selbst kommt nie durch sie hindurch.") },
  { text: tx("The large intestine comes before the small intestine.", "Der Dickdarm kommt vor dem Dünndarm."), title: tx("Small first", "Erst der Dünndarm"), say: tx("It's the other way round: first the long small intestine, then the large intestine.", "Andersherum: erst der lange Dünndarm, dann der Dickdarm.") },
  { text: tx("Vitamins are our most important source of energy.", "Vitamine sind unsere wichtigste Energiequelle."), title: tx("Vitamins have no energy", "Vitamine haben keine Energie"), say: tx("Vitamins contain no energy at all. Energy comes from carbohydrates and fats.", "Vitamine enthalten gar keine Energie. Energie kommt aus Kohlenhydraten und Fetten.") },
  { text: tx("Fat has the same energy per gram as sugar.", "Fett hat pro Gramm genauso viel Energie wie Zucker."), title: tx("Fat has more", "Fett hat mehr"), say: tx("Fat has more than **twice** as much energy per gram as sugar.", "Fett hat pro Gramm mehr als **doppelt** so viel Energie wie Zucker.") },
];

function statementsTask(rng: Rng): Exercise {
  const trues = pickN(rng, TRUE_STMTS, rng.int(2, 3));
  const falses = pickN(rng, FALSE_STMTS, 5 - trues.length);
  const mu = multi(rng, trues, falses);
  return {
    instruction: tx("Select all true statements", "Wähle alle richtigen Aussagen"),
    text: tx("Which statements about food and digestion are true?", "Welche Aussagen über Ernährung und Verdauung stimmen?"),
    answer: mu.answer,
    hint: tx("Watch out for where digestion starts and where nutrients enter the blood.", "Pass auf, wo die Verdauung beginnt und wo die Nährstoffe ins Blut gelangen."),
    solution: [
      { math: tx('"mouth" \\to "stomach" \\to "small intestine" \\to "large intestine"', '"Mund" \\to "Magen" \\to "Dünndarm" \\to "Dickdarm"'), note: tx("Digestion starts in the mouth, nutrients pass into the blood in the small intestine, the large intestine takes back water.", "Die Verdauung beginnt im Mund, ins Blut geht es im Dünndarm, der Dickdarm holt Wasser zurück.") },
    ],
    mistakes: mu.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  return weighted(rng, [
    [1.6, () => foodTask(rng)],
    [1, () => foodMatchTask(rng)],
    [1.6, () => nutrientQuestion(rng, NUTRIENT_QS, tx("Pick the right answer", "Wähle die richtige Antwort"))],
    [1.1, () => nutrientQuestion(rng, PYRAMID_QS, tx("The food pyramid", "Die Ernährungspyramide"))],
    [0.8, () => portionsTask(rng)],
    [1.4, () => wayTask(rng)],
    [1.4, () => organNameTask(rng)],
    [1.2, () => organJobTask(rng)],
    [1.2, () => organWordTask(rng)],
    [0.9, () => toothTask(rng)],
    [0.6, () => teethCountTask(rng)],
    [1.2, () => statementsTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const jobsCheck = matchTask({
  instruction: tx("Match the nutrient to its job", "Ordne jedem Nährstoff seine Aufgabe zu"),
  text: tx("What does your body use each one for?", "Wofür nutzt dein Körper sie?"),
  pairs: [
    [tx("carbohydrates", "Kohlenhydrate"), tx("main source of energy", "wichtigste Energiequelle")],
    [tx("fats", "Fette"), tx("lots of energy, energy store", "viel Energie, Energiespeicher")],
    [tx("proteins", "Eiweiße"), tx("building material for muscles", "Baustoff für Muskeln")],
    [tx("dietary fibre", "Ballaststoffe"), tx("keeps the gut moving", "hält den Darm in Schwung")],
  ],
  distractors: [tx("gives blood its red colour", "gibt dem Blut die rote Farbe")],
  hint: tx("Bread and pasta give quick energy, butter and nuts a lot of it, meat and eggs build you up.", "Brot und Nudeln geben schnelle Energie, Butter und Nüsse besonders viel, Fleisch und Eier bauen dich auf."),
  solution: [
    { math: tx('"carbohydrates, fats" \\to "energy"', '"Kohlenhydrate, Fette" \\to "Energie"'), note: tx("Carbohydrates are the main fuel, fats the store with the most energy.", "Kohlenhydrate sind der Hauptbrennstoff, Fette der Speicher mit der meisten Energie.") },
    { math: tx('"proteins" \\to "building material"', '"Eiweiße" \\to "Baustoffe"'), note: tx("Proteins build muscles, skin and hair. Fibres keep the gut moving. (Red blood needs iron.)", "Eiweiße bauen Muskeln, Haut und Haare. Ballaststoffe halten den Darm in Schwung. (Für rotes Blut braucht es Eisen.)") },
  ],
  wrong: [
    { pairs: [[tx("proteins", "Eiweiße"), tx("main source of energy", "wichtigste Energiequelle")]], title: tx("Proteins build", "Eiweiße bauen"), say: tx("Proteins are mainly building materials. The main fuel comes from bread, pasta and potatoes: carbohydrates.", "Eiweiße sind vor allem Baustoffe. Der Hauptbrennstoff kommt aus Brot, Nudeln und Kartoffeln: Kohlenhydrate.") },
    { pairs: [[tx("fats", "Fette"), tx("building material for muscles", "Baustoff für Muskeln")]], title: tx("Fat is a store", "Fett ist ein Speicher"), say: tx("Fat is mostly stored as an energy reserve. Muscles are built from proteins.", "Fett wird vor allem als Energiereserve gespeichert. Muskeln werden aus Eiweißen gebaut.") },
  ],
});

const pyramidCheck = (() => {
  const c = fixedChoice(PYRAMID_QS[1].opts, 2);
  return {
    instruction: tx("The food pyramid", "Die Ernährungspyramide"),
    text: PYRAMID_QS[1].q,
    answer: c.answer,
    hint: PYRAMID_QS[1].hint,
    solution: [{ math: quote(PYRAMID_QS[1].opts[0].text), note: PYRAMID_QS[1].note }],
    mistakes: c.mistakes,
  } satisfies Exercise;
})();

const bloodCheck = (() => {
  const c = fixedChoice(
    [
      { text: tx("in the small intestine", "im Dünndarm") },
      { text: tx("in the stomach", "im Magen"), title: tx("Not in the stomach", "Nicht im Magen"), say: tx("Classic trap! The stomach kneads the food and digestion goes on there, but the nutrients pass into the blood only in the **small intestine**.", "Die klassische Falle! Der Magen knetet die Nahrung, und die Verdauung geht dort weiter, aber ins Blut gelangen die Nährstoffe erst im **Dünndarm**.") },
      { text: tx("in the large intestine", "im Dickdarm"), title: tx("That's mostly water", "Da geht es vor allem um Wasser"), say: tx("The large intestine mainly takes back water. The nutrients are already gone by then.", "Der Dickdarm holt vor allem Wasser zurück. Die Nährstoffe sind dann schon weg.") },
      { text: tx("in the liver", "in der Leber"), title: tx("Food doesn't pass the liver", "Die Nahrung kommt nicht in die Leber"), say: tx("The liver only sends bile into the gut. Food never passes through it.", "Die Leber schickt nur Galle in den Darm. Die Nahrung kommt nie durch sie hindurch.") },
    ],
    0,
  );
  return {
    instruction: tx("Pick the right answer", "Wähle die richtige Antwort"),
    text: tx("Where do the nutrients from your food pass into the blood?", "Wo gelangen die Nährstoffe aus deinem Essen ins Blut?"),
    answer: c.answer,
    hint: tx("It's the longest part of the gut, 3 to 5 metres.", "Es ist der längste Abschnitt des Darms, 3 bis 5 Meter."),
    solution: [{ math: tx('"small intestine" \\to "blood"', '"Dünndarm" \\to "Blut"'), note: tx("In the **small intestine** the food is cut into tiny building blocks. They pass through the gut wall into the blood.", "Im **Dünndarm** wird die Nahrung in winzige Bausteine zerlegt. Die gehen durch die Darmwand ins Blut.") }],
    mistakes: c.mistakes,
  } satisfies Exercise;
})();

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("What's in our food?", "Was steckt in unserem Essen?"),
      blob: tx("Hungry? Good! Let's see what's inside your food.", "Hunger? Gut! Schauen wir mal, was in deinem Essen steckt."),
      body: tx(
        "Food contains **nutrients**: carbohydrates, fats and proteins. Each of them has its own job in your body.",
        "Lebensmittel enthalten **Nährstoffe**: Kohlenhydrate, Fette und Eiweiße (Proteine). Jeder davon hat im Körper seine eigene Aufgabe.",
      ),
      frames: [
        {
          math: tx('"carbohydrates"#a \\to#a2 "energy"#a3', '"Kohlenhydrate"#a \\to#a2 "Energie"#a3'),
          note: tx("**Carbohydrates** (starch and sugar) are the main source of energy. Bread, pasta, potatoes, rice, fruit.", "**Kohlenhydrate** (Stärke und Zucker) sind die wichtigste Energiequelle. Brot, Nudeln, Kartoffeln, Reis, Obst."),
        },
        {
          math: tx('"carbohydrates"#a \\to#a2 "energy"#a3 \\\\ "fats"#b \\to#b2 "energy, store"#b3', '"Kohlenhydrate"#a \\to#a2 "Energie"#a3 \\\\ "Fette"#b \\to#b2 "Energie, Speicher"#b3'),
          note: tx("**Fats** contain the most energy. The body stores them as a reserve and as padding against cold and knocks. Butter, oil, nuts, cheese.", "**Fette** enthalten am meisten Energie. Der Körper speichert sie als Reserve und als Polster gegen Kälte und Stöße. Butter, Öl, Nüsse, Käse."),
        },
        {
          math: tx(
            '"carbohydrates"#a \\to#a2 "energy"#a3 \\\\ "fats"#b \\to#b2 "energy, store"#b3 \\\\ "proteins"#c \\to#c2 "building material"#c3',
            '"Kohlenhydrate"#a \\to#a2 "Energie"#a3 \\\\ "Fette"#b \\to#b2 "Energie, Speicher"#b3 \\\\ "Eiweiße"#c \\to#c2 "Baustoffe"#c3',
          ),
          note: tx("**Proteins** are building materials: muscles, skin, hair and enzymes are made of them. Meat, fish, eggs, milk products, lentils and beans.", "**Eiweiße** sind Baustoffe: Muskeln, Haut, Haare und Enzyme bestehen daraus. Fleisch, Fisch, Eier, Milchprodukte, Linsen und Bohnen."),
        },
        {
          math: tx(
            '"carbohydrates"#a \\to#a2 "energy"#a3 \\\\ "fats"#b \\to#b2 "energy, store"#b3 \\\\ "proteins"#c \\to#c2 "building material"#c3',
            '"Kohlenhydrate"#a \\to#a2 "Energie"#a3 \\\\ "Fette"#b \\to#b2 "Energie, Speicher"#b3 \\\\ "Eiweiße"#c \\to#c2 "Baustoffe"#c3',
          ),
          highlight: ["a3", "b3"],
          note: tx("Carbohydrates and fats are the **fuels**. Proteins are mostly **building materials**.", "Kohlenhydrate und Fette sind die **Brennstoffe**. Eiweiße sind vor allem **Baustoffe**."),
        },
      ],
    },
    {
      type: "explain",
      title: tx("Small but vital", "Klein, aber lebenswichtig"),
      blob: tx("Some of the most important things come in tiny amounts!", "Manches Wichtige gibt es nur in winzigen Mengen!"),
      body: tx(
        "Besides the nutrients your body needs vitamins, minerals, dietary fibre and water. Vitamins, minerals and water contain **no energy**, but you can't live without them.",
        "Neben den Nährstoffen braucht dein Körper Vitamine, Mineralstoffe, Ballaststoffe und Wasser. Vitamine, Mineralstoffe und Wasser liefern **keine Energie**, aber ohne sie geht es nicht.",
      ),
      frames: [
        {
          math: tx('"vitamins"#v', '"Vitamine"#v'),
          note: tx("**Vitamins**: tiny amounts, big effect. Vitamin C (red pepper, citrus fruit) helps your defences, vitamin A (carrots) your eyes, vitamin D (fish, sunlight) your bones.", "**Vitamine**: winzige Mengen, große Wirkung. Vitamin C (Paprika, Zitrusfrüchte) stärkt die Abwehr, Vitamin A (Möhren) hilft beim Sehen, Vitamin D (Fisch, Sonnenlicht) den Knochen."),
        },
        {
          math: tx('"vitamins"#v \\quad "minerals"#m', '"Vitamine"#v \\quad "Mineralstoffe"#m'),
          note: tx("**Minerals**: calcium (milk) for bones and teeth, iron (meat, lentils) for the blood, iodine (iodised salt, sea fish) for the thyroid gland.", "**Mineralstoffe**: Calcium (Milch) für Knochen und Zähne, Eisen (Fleisch, Linsen) für das Blut, Iod (Iodsalz, Seefisch) für die Schilddrüse."),
        },
        {
          math: tx('"vitamins"#v \\quad "minerals"#m \\\\ "dietary fibre"#f', '"Vitamine"#v \\quad "Mineralstoffe"#m \\\\ "Ballaststoffe"#f'),
          note: tx("**Dietary fibre**: plant fibres we can't digest (wholemeal, vegetables, fruit). They fill you up and keep the gut moving.", "**Ballaststoffe**: Pflanzenfasern, die wir nicht verdauen können (Vollkorn, Gemüse, Obst). Sie machen satt und halten den Darm in Schwung."),
        },
        {
          math: tx('"vitamins"#v \\quad "minerals"#m \\\\ "dietary fibre"#f \\quad "water"#w', '"Vitamine"#v \\quad "Mineralstoffe"#m \\\\ "Ballaststoffe"#f \\quad "Wasser"#w'),
          note: tx("**Water**: your body is about 60 % water. Drink about 1.5 litres a day, best water or unsweetened tea.", "**Wasser**: Dein Körper besteht zu etwa 60 % aus Wasser. Trink etwa 1,5 Liter am Tag, am besten Wasser oder ungesüßten Tee."),
        },
      ],
    },
    { type: "check", blob: tx("Let's sort them out!", "Sortieren wir mal!"), exercise: jobsCheck },
    {
      type: "widget",
      title: tx("A balanced diet: the food pyramid", "Ausgewogen essen: die Ernährungspyramide"),
      blob: tx("Plan your day! Can you make Blob's pyramid happy?", "Plane deinen Tag! Schaffst du eine Pyramide, über die Blob sich freut?"),
      body: tx(
        "No single food is healthy or unhealthy on its own: the **mix** matters. The **food pyramid** shows what to eat plenty of (bottom, green), moderately (yellow) and only a little of (top, red). Each block is one portion, about a handful.",
        "Kein Lebensmittel ist allein gesund oder ungesund: Auf die **Mischung** kommt es an. Die **Ernährungspyramide** zeigt, wovon du reichlich (unten, grün), mäßig (gelb) und nur wenig (oben, rot) essen solltest. Jeder Baustein ist eine Portion, etwa eine Handvoll.",
      ),
      widget: DigestionPyramid,
    },
    { type: "check", blob: tx("A question about the pyramid.", "Eine Frage zur Pyramide."), exercise: pyramidCheck },
    {
      type: "widget",
      title: tx("Your teeth", "Dein Gebiss"),
      blob: tx("Smile! Digestion starts right here.", "Lächeln! Hier fängt die Verdauung an."),
      body: tx(
        "Digestion starts in the **mouth**: the teeth cut the food into small pieces. Children first have **20 milk teeth**, adults have **32 permanent teeth**. Tap the types of teeth. Tooth enamel is the hardest substance in the body, but bacteria turn sugar into acids that attack it: tooth decay. So brush your teeth!",
        "Die Verdauung beginnt im **Mund**: Die Zähne zerkleinern die Nahrung. Kinder haben zuerst **20 Milchzähne**, Erwachsene **32 bleibende Zähne**. Tipp die Zahnarten an. Zahnschmelz ist der härteste Stoff im Körper, aber Bakterien machen aus Zucker Säuren, die ihn angreifen: Karies. Also Zähne putzen!",
      ),
      widget: DigestionTeethExplore,
    },
    {
      type: "widget",
      title: tx("The journey of a bite", "Die Reise eines Bissens"),
      blob: tx("All aboard! Let's ride along with a bite of bread.", "Alle einsteigen! Wir reisen mit einem Bissen Brot."),
      body: tx(
        "Follow a bite through your body. At each station something different happens. Which organs light up?",
        "Folge einem Bissen durch deinen Körper. An jeder Station passiert etwas anderes. Welche Organe leuchten auf?",
      ),
      widget: DigestionJourney1,
    },
    {
      type: "explain",
      title: tx("The helpers: liver, gall bladder, pancreas", "Die Helfer: Leber, Gallenblase, Bauchspeicheldrüse"),
      blob: tx("Three organs help without the food ever passing through them.", "Drei Organe helfen, ohne dass die Nahrung durch sie hindurchkommt."),
      frames: [
        {
          math: tx('"liver"#l \\to#l2 "bile"#l3', '"Leber"#l \\to#l2 "Galle"#l3'),
          note: tx("The **liver** is the largest gland of the body. It makes **bile**, which helps with fat digestion.", "Die **Leber** ist die größte Drüse des Körpers. Sie bildet die **Galle**, die bei der Fettverdauung hilft."),
        },
        {
          math: tx('"liver"#l \\to#l2 "bile"#l3 \\\\ "gall bladder"#g \\to#g2 "stores bile"#g3', '"Leber"#l \\to#l2 "Galle"#l3 \\\\ "Gallenblase"#g \\to#g2 "speichert Galle"#g3'),
          note: tx("The **gall bladder** stores the bile and releases it into the small intestine when you eat.", "Die **Gallenblase** speichert die Galle und gibt sie beim Essen in den Dünndarm ab."),
        },
        {
          math: tx(
            '"liver"#l \\to#l2 "bile"#l3 \\\\ "gall bladder"#g \\to#g2 "stores bile"#g3 \\\\ "pancreas"#p \\to#p2 "digestive juice"#p3',
            '"Leber"#l \\to#l2 "Galle"#l3 \\\\ "Gallenblase"#g \\to#g2 "speichert Galle"#g3 \\\\ "Bauchspeicheldrüse"#p \\to#p2 "Verdauungssaft"#p3',
          ),
          note: tx("The **pancreas** makes a digestive juice full of enzymes, the pancreatic juice.", "Die **Bauchspeicheldrüse** bildet einen Verdauungssaft voller Enzyme, den Bauchspeichel."),
        },
        {
          math: tx('"bile, pancreatic juice" \\to "small intestine"', '"Galle, Bauchspeichel" \\to "Dünndarm"'),
          note: tx("Both juices flow into the small intestine. The food itself **never** passes through liver, gall bladder or pancreas!", "Beide Säfte fließen in den Dünndarm. Die Nahrung selbst kommt **nie** durch Leber, Gallenblase oder Bauchspeicheldrüse!"),
        },
      ],
    },
    { type: "check", blob: tx("Can you retrace the journey?", "Kannst du die Reise nachzeichnen?"), exercise: wayExercise(0, 6) },
    { type: "check", blob: tx("Last one, and a classic trap!", "Die letzte, und eine klassische Falle!"), exercise: bloodCheck },
  ],
  summary: [
    {
      title: tx("Nutrients", "Nährstoffe"),
      body: tx(
        "**Carbohydrates** (bread, pasta, potatoes): main source of energy. **Fats** (oil, butter, nuts): most energy, energy store. **Proteins** (meat, fish, eggs, milk, pulses): building materials for muscles, skin and hair.",
        "**Kohlenhydrate** (Brot, Nudeln, Kartoffeln): wichtigste Energiequelle. **Fette** (Öl, Butter, Nüsse): meiste Energie, Energiespeicher. **Eiweiße** (Fleisch, Fisch, Eier, Milch, Hülsenfrüchte): Baustoffe für Muskeln, Haut und Haare.",
      ),
      examples: [tx('"carbohydrates, fats" \\to "energy"', '"Kohlenhydrate, Fette" \\to "Energie"'), tx('"proteins" \\to "building materials"', '"Eiweiße" \\to "Baustoffe"')],
      tone: "rule",
    },
    {
      title: tx("Also vital", "Außerdem lebenswichtig"),
      body: tx(
        "**Vitamins** and **minerals** (calcium, iron, iodine) in small amounts, **dietary fibre** for the gut, and about **1.5 litres** of water a day. They contain no energy.",
        "**Vitamine** und **Mineralstoffe** (Calcium, Eisen, Iod) in kleinen Mengen, **Ballaststoffe** für den Darm und etwa **1,5 Liter** Wasser am Tag. Sie liefern keine Energie.",
      ),
      tone: "rule",
    },
    {
      title: tx("Eat balanced", "Ausgewogen essen"),
      body: tx(
        "Food pyramid: drink a lot, plenty of vegetables, fruit and wholemeal; milk, meat, fish and fat in moderation; sweets only a little.",
        "Ernährungspyramide: viel trinken, reichlich Gemüse, Obst und Vollkorn; Milch, Fleisch, Fisch und Fett mäßig; Süßes nur wenig.",
      ),
      examples: [tx('"6 drinks, 5 vegetables/fruit, 4 cereals"', '"6 Getränke, 5 Gemüse/Obst, 4 Getreide"')],
      tone: "tip",
    },
    {
      title: tx("The way of the food", "Der Weg der Nahrung"),
      body: tx(
        "Mouth (teeth, saliva) → oesophagus → stomach (acid, kneading) → small intestine (into the blood) → large intestine (water back) → rectum → anus. The whole trip takes 1 to 3 days.",
        "Mund (Zähne, Speichel) → Speiseröhre → Magen (Säure, Kneten) → Dünndarm (ins Blut) → Dickdarm (Wasser zurück) → Mastdarm → After. Die ganze Reise dauert 1 bis 3 Tage.",
      ),
      examples: [tx('"mouth → oesophagus → stomach"', '"Mund → Speiseröhre → Magen"'), tx('"→ small intestine → large intestine → anus"', '"→ Dünndarm → Dickdarm → After"')],
      tone: "rule",
    },
    {
      title: tx("The helpers", "Die Helfer"),
      body: tx(
        "The **liver** makes bile, the **gall bladder** stores it, the **pancreas** makes pancreatic juice. Both juices flow into the small intestine; the food never passes through these organs.",
        "Die **Leber** bildet Galle, die **Gallenblase** speichert sie, die **Bauchspeicheldrüse** bildet den Bauchspeichel. Beide Säfte fließen in den Dünndarm; die Nahrung selbst kommt nie durch diese Organe.",
      ),
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Digestion starts in the **mouth**, not in the stomach. The nutrients pass into the blood in the **small intestine**, not in the stomach. First small, then large intestine.",
        "Die Verdauung beginnt schon im **Mund**, nicht erst im Magen. Ins Blut gelangen die Nährstoffe im **Dünndarm**, nicht im Magen. Erst Dünndarm, dann Dickdarm.",
      ),
      tone: "warning",
    },
  ],
};
