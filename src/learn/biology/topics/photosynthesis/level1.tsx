"use client";

// Level 1 (Einsteiger, Klasse 5–6): plants make their own food. What goes in (water, carbon
// dioxide, light energy, chlorophyll), what comes out (glucose, oxygen), starch and the iodine
// test on a partly covered leaf, and why all animals and humans depend on photosynthesis.

import { tx, type Text } from "@/i18n/text";
import { PhotoFactory } from "@/learn/biology/visuals/PhotoFactory";
import { PhotoPlant } from "@/learn/biology/visuals/PhotoPlant";
import { PhotoStarchLeaf, PhotoStarchTest, type Stencil } from "@/learn/biology/visuals/PhotoStarch";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson } from "@/learn/types";
import { cap, choice, de, en, join, mistakes, multi, q, reasonFrames, some, visual, type MultiOpt, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Words

const W = {
  water: tx("water", "Wasser"),
  co2: tx("carbon dioxide", "Kohlenstoffdioxid"),
  glucose: tx("glucose", "Traubenzucker"),
  oxygen: tx("oxygen", "Sauerstoff"),
  starch: tx("starch", "Stärke"),
  light: tx("light energy", "Lichtenergie"),
  chlorophyll: tx("chlorophyll", "Chlorophyll"),
};

// ---------------------------------------------------------------------------
// 1. Where does it come from, where does it go?

type Source = { ask: Text; short: Text; right: Text; shortRight: Text; wrong: Opt[] };

const SOURCES: Source[] = [
  {
    ask: tx("Where does the plant get the **water** for photosynthesis from?", "Woher bekommt die Pflanze das **Wasser** für die Fotosynthese?"),
    short: tx("water", "Wasser"),
    right: tx("From the soil, through the roots", "Aus dem Boden, über die Wurzeln"),
    shortRight: tx("soil → roots", "Boden → Wurzeln"),
    wrong: [
      {
        text: tx("From the air, through the stomata", "Aus der Luft, durch die Spaltöffnungen"),
        title: tx("That's the way of CO₂", "Das ist der Weg des CO₂"),
        say: tx("Through the stomata comes **carbon dioxide**. Water is taken up by the roots and travels up the stem.", "Durch die Spaltöffnungen kommt **Kohlenstoffdioxid** hinein. Wasser nehmen die Wurzeln auf, es steigt durch die Sprossachse nach oben."),
      },
      {
        text: tx("The leaf makes it itself", "Das Blatt stellt es selbst her"),
        title: tx("Water is a raw material", "Wasser ist ein Ausgangsstoff"),
        say: tx("Water is one of the raw materials. The plant can't make it, it has to take it up from the soil.", "Wasser ist einer der Ausgangsstoffe. Die Pflanze kann es nicht herstellen, sie muss es aus dem Boden aufnehmen."),
      },
      {
        text: tx("From the sunlight", "Aus dem Sonnenlicht"),
        title: tx("Light is energy", "Licht ist Energie"),
        say: tx("The sun only delivers **energy**, no substances. The water comes from the soil.", "Die Sonne liefert nur **Energie**, keine Stoffe. Das Wasser kommt aus dem Boden."),
      },
    ],
  },
  {
    ask: tx("Where does the plant get the **carbon dioxide** from?", "Woher bekommt die Pflanze das **Kohlenstoffdioxid**?"),
    short: tx("carbon dioxide", "Kohlenstoffdioxid"),
    right: tx("From the air, through the stomata", "Aus der Luft, durch die Spaltöffnungen"),
    shortRight: tx("air → stomata", "Luft → Spaltöffnungen"),
    wrong: [
      {
        text: tx("From the soil, through the roots", "Aus dem Boden, über die Wurzeln"),
        title: tx("Not from the soil", "Nicht aus dem Boden"),
        say: tx("The roots take up water and minerals. Carbon dioxide is a gas from the **air**: it gets into the leaf through the stomata.", "Die Wurzeln nehmen Wasser und Mineralstoffe auf. Kohlenstoffdioxid ist ein Gas aus der **Luft**: Es gelangt durch die Spaltöffnungen ins Blatt."),
      },
      {
        text: tx("The roots make it", "Die Wurzeln stellen es her"),
        title: tx("Roots make no food", "Wurzeln machen keine Nahrung"),
        say: tx("Carbon dioxide is taken in from the air, not made by the plant. And the roots aren't where photosynthesis happens.", "Kohlenstoffdioxid wird aus der Luft aufgenommen, nicht von der Pflanze hergestellt. Und in den Wurzeln findet keine Fotosynthese statt."),
      },
      {
        text: tx("From the sunlight", "Aus dem Sonnenlicht"),
        title: tx("Light is energy", "Licht ist Energie"),
        say: tx("Sunlight is energy, not a substance. Carbon dioxide is a gas in the air.", "Sonnenlicht ist Energie, kein Stoff. Kohlenstoffdioxid ist ein Gas in der Luft."),
      },
    ],
  },
  {
    ask: tx("Where does the **energy** for photosynthesis come from?", "Woher kommt die **Energie** für die Fotosynthese?"),
    short: tx("energy", "Energie"),
    right: tx("From light, usually sunlight", "Aus dem Licht, meist Sonnenlicht"),
    shortRight: tx("light", "Licht"),
    wrong: [
      {
        text: tx("From the soil, through the roots", "Aus dem Boden, über die Wurzeln"),
        title: tx("No food from the soil", "Keine Nahrung aus dem Boden"),
        say: tx("The soil gives water and minerals, but no energy. The energy is **light**, caught by the green chlorophyll.", "Der Boden liefert Wasser und Mineralstoffe, aber keine Energie. Die Energie ist **Licht**, das grüne Chlorophyll fängt es ein."),
      },
      {
        text: tx("From the oxygen in the air", "Aus dem Sauerstoff der Luft"),
        title: tx("Oxygen comes out", "Sauerstoff kommt heraus"),
        say: tx("Oxygen is a **product** of photosynthesis: it is released. The energy comes from light.", "Sauerstoff ist ein **Produkt** der Fotosynthese: Er wird abgegeben. Die Energie kommt aus dem Licht."),
      },
      {
        text: tx("From the warmth of the soil", "Aus der Wärme des Bodens"),
        title: tx("It has to be light", "Es muss Licht sein"),
        say: tx("Warmth alone doesn't help: in a warm, dark room there's no photosynthesis. Only **light** drives it.", "Wärme allein reicht nicht: In einem warmen, dunklen Raum gibt es keine Fotosynthese. Nur **Licht** treibt sie an."),
      },
    ],
  },
  {
    ask: tx("What happens to the **oxygen** that the leaf makes?", "Was passiert mit dem **Sauerstoff**, den das Blatt herstellt?"),
    short: tx("oxygen", "Sauerstoff"),
    right: tx("It leaves through the stomata into the air", "Er gelangt durch die Spaltöffnungen in die Luft"),
    shortRight: tx("stomata → air", "Spaltöffnungen → Luft"),
    wrong: [
      {
        text: tx("It goes down into the roots and the soil", "Er wird in die Wurzeln und den Boden geleitet"),
        title: tx("Out into the air", "Hinaus in die Luft"),
        say: tx("Most of the oxygen isn't needed by the leaf. It escapes through the stomata into the **air**, where we breathe it.", "Den meisten Sauerstoff braucht das Blatt nicht. Er entweicht durch die Spaltöffnungen in die **Luft**, wo wir ihn einatmen."),
      },
      {
        text: tx("It is stored in the leaf as starch", "Er wird im Blatt als Stärke gespeichert"),
        title: tx("Starch is made of sugar", "Stärke entsteht aus Zucker"),
        say: tx("Starch is made from **glucose**, not from oxygen. The oxygen leaves the leaf.", "Stärke entsteht aus **Traubenzucker**, nicht aus Sauerstoff. Der Sauerstoff verlässt das Blatt."),
      },
      {
        text: tx("It is turned straight back into carbon dioxide", "Er wird gleich wieder zu Kohlenstoffdioxid"),
        title: tx("It's given off", "Er wird abgegeben"),
        say: tx("The oxygen is released into the air. That's why plants are so important for us.", "Der Sauerstoff wird an die Luft abgegeben. Darum sind Pflanzen so wichtig für uns."),
      },
    ],
  },
  {
    ask: tx("What does the plant do with the **glucose** it makes?", "Was macht die Pflanze mit dem **Traubenzucker**, den sie herstellt?"),
    short: tx("glucose", "Traubenzucker"),
    right: tx("It uses it for energy and growth and stores it as starch", "Sie nutzt ihn für Energie und Wachstum und speichert ihn als Stärke"),
    shortRight: tx("energy, growth, starch", "Energie, Wachstum, Stärke"),
    wrong: [
      {
        text: tx("It gives it off into the air", "Sie gibt ihn an die Luft ab"),
        title: tx("That's the oxygen", "Das ist der Sauerstoff"),
        say: tx("The gas that goes into the air is **oxygen**. The glucose stays in the plant: it's its food.", "Ins Freie geht das Gas **Sauerstoff**. Der Traubenzucker bleibt in der Pflanze: Er ist ihre Nahrung."),
      },
      {
        text: tx("It turns it back into water", "Sie macht wieder Wasser daraus"),
        title: tx("Glucose is food", "Traubenzucker ist Nahrung"),
        say: tx("Glucose is the plant's food: energy for living and material for growing. What it doesn't need right away is stored as starch.", "Traubenzucker ist die Nahrung der Pflanze: Energie zum Leben und Baustoff zum Wachsen. Was sie nicht sofort braucht, speichert sie als Stärke."),
      },
      {
        text: tx("Nothing, it's a waste product", "Nichts, er ist ein Abfallstoff"),
        title: tx("Glucose is the point", "Darum geht es ja"),
        say: tx("Glucose is exactly why the plant does photosynthesis! It's its food. The by-product is oxygen.", "Traubenzucker ist genau der Grund für die Fotosynthese! Er ist die Nahrung. Das Nebenprodukt ist der Sauerstoff."),
      },
    ],
  },
];

function sourceTask(rng: Rng, s = rng.pick(SOURCES)): Exercise {
  const { answer, mistakes: list } = choice(rng, [{ text: s.right }, ...s.wrong]);
  return {
    instruction: tx("In and out of the leaf", "Hinein und hinaus"),
    text: s.ask,
    answer,
    hint: tx("Water comes from below, gases come from the air, the energy comes from above.", "Wasser kommt von unten, Gase kommen aus der Luft, die Energie kommt von oben."),
    solution: [
      { math: q(s.short, "s"), note: s.ask },
      { math: join(q(s.short, "s"), "\\to#to", q(s.shortRight, "a")), note: tx(`**${en(s.right)}.**`, `**${de(s.right)}.**`), highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 2. The word equation with a gap

const EQ = [W.water, W.co2, W.glucose, W.oxygen];
const EQ_KEYS = ["w", "c", "z", "o"];

function eqMath(gap: number | null, mark?: number): Text {
  const term = (i: number) => (i === gap ? `\\box{"?"}#g` : `"${"%"}"#${EQ_KEYS[i]}`);
  const build = (l: "en" | "de") =>
    [0, 1, 2, 3]
      .map((i) => {
        const word = l === "en" ? en(EQ[i]) : de(EQ[i]);
        const t = term(i).replace("%", word);
        return i === mark ? `\\hl{${t}}` : t;
      })
      .reduce((acc, t, i) => (i === 0 ? t : i === 2 ? `${acc} \\\\ \\to#ar ${t}` : `${acc} + ${t}`), "");
  return tx(build("en"), build("de"));
}

const GAP_WRONG: Record<number, Opt[]> = {
  0: [
    { text: tx("minerals", "Mineralstoffe"), title: tx("Minerals help, but…", "Mineralstoffe helfen, aber…"), say: tx("Minerals are needed for growing, but the raw material of photosynthesis that comes from the roots is **water**.", "Mineralstoffe braucht die Pflanze zum Wachsen. Der Ausgangsstoff der Fotosynthese aus den Wurzeln ist aber **Wasser**.") },
    { text: W.oxygen, title: tx("Oxygen comes out", "Sauerstoff kommt heraus"), say: tx("Oxygen is on the right side: it's a **product**. On the left you need what comes from the roots.", "Sauerstoff steht rechts: Er ist ein **Produkt**. Links fehlt, was aus den Wurzeln kommt.") },
    { text: W.starch, title: tx("Starch comes later", "Stärke kommt später"), say: tx("Starch is made later from glucose. On the left are the raw materials.", "Stärke entsteht erst später aus Traubenzucker. Links stehen die Ausgangsstoffe.") },
  ],
  1: [
    { text: W.oxygen, title: tx("That's breathing", "Das ist die Atmung"), say: tx("Breathing takes in oxygen. Photosynthesis is the other way round: it takes in **carbon dioxide** and gives off oxygen.", "Beim Atmen nimmt man Sauerstoff auf. Bei der Fotosynthese ist es umgekehrt: Sie nimmt **Kohlenstoffdioxid** auf und gibt Sauerstoff ab.") },
    { text: tx("nitrogen", "Stickstoff"), title: tx("Which gas?", "Welches Gas?"), say: tx("Air is mostly nitrogen, but the plant can't use it for sugar. It takes the gas carbon dioxide from the air.", "Luft besteht zwar vor allem aus Stickstoff, den kann die Pflanze aber nicht für Zucker nutzen. Sie nimmt das Gas Kohlenstoffdioxid aus der Luft.") },
    { text: W.glucose, title: tx("That's a product", "Das ist ein Produkt"), say: tx("Glucose is what the leaf **makes**. On the left side you need the gas from the air.", "Traubenzucker ist das, was das Blatt **herstellt**. Links fehlt das Gas aus der Luft.") },
  ],
  2: [
    { text: W.starch, title: tx("Glucose first", "Erst Traubenzucker"), say: tx("Close! Starch is made **from** the glucose afterwards. Photosynthesis itself makes glucose.", "Knapp! Stärke entsteht erst danach **aus** dem Traubenzucker. Die Fotosynthese selbst stellt Traubenzucker her.") },
    { text: W.co2, title: tx("CO₂ goes in", "CO₂ geht hinein"), say: tx("Carbon dioxide is a raw material: it goes **in**. What the plant makes is its food.", "Kohlenstoffdioxid ist ein Ausgangsstoff: Es geht **hinein**. Gesucht ist die Nahrung, die die Pflanze herstellt.") },
    { text: W.water, title: tx("Water goes in", "Wasser geht hinein"), say: tx("Water is already on the left as a raw material. The leaf makes sugar out of it.", "Wasser steht schon links als Ausgangsstoff. Das Blatt macht Zucker daraus.") },
  ],
  3: [
    { text: W.co2, title: tx("Upside down", "Verdreht"), say: tx("Carbon dioxide goes **in**. What comes out is the gas we breathe: oxygen.", "Kohlenstoffdioxid geht **hinein**. Heraus kommt das Gas, das wir einatmen.") },
    { text: W.water, title: tx("Water goes in", "Wasser geht hinein"), say: tx("Water is a raw material. The leaf gives off a gas.", "Wasser ist ein Ausgangsstoff. Das Blatt gibt ein Gas ab.") },
    { text: W.starch, title: tx("Starch stays inside", "Stärke bleibt drin"), say: tx("Starch is stored inside the plant. The second product is a gas that leaves the leaf.", "Stärke wird in der Pflanze gespeichert. Das zweite Produkt ist ein Gas, das das Blatt verlässt.") },
  ],
};

function gapTask(rng: Rng): Exercise {
  const gap = rng.int(0, 3);
  const wrong = some(rng, GAP_WRONG[gap], 3);
  const { answer, mistakes: list } = choice(rng, [{ text: cap1(EQ[gap]) }, ...wrong.map((o) => ({ ...o, text: cap1(o.text) }))]);
  return {
    instruction: tx("Complete the word equation", "Ergänze die Wortgleichung"),
    math: eqMath(gap),
    answer,
    hint: tx("On the left: what goes into the leaf. On the right: what the leaf makes.", "Links steht, was ins Blatt hineingeht. Rechts steht, was das Blatt herstellt."),
    solution: [
      { math: eqMath(null, gap), note: tx(`The missing word is **${en(EQ[gap])}**.`, `Es fehlt **${de(EQ[gap])}**.`), highlight: [EQ_KEYS[gap]] },
      { math: eqMath(null), note: tx("Water and carbon dioxide go in, glucose and oxygen come out. The energy comes from light.", "Wasser und Kohlenstoffdioxid gehen hinein, Traubenzucker und Sauerstoff kommen heraus. Die Energie liefert das Licht.") },
    ],
    mistakes: list,
  };
}

const cap1 = (t: Text): Text => tx(cap(en(t)), de(t));

// ---------------------------------------------------------------------------
// 3. Select all: what goes in, what comes out

const NEEDS: MultiOpt[] = [
  { text: tx("Water", "Wasser"), miss: tx("Water is missing! It comes from the soil through the roots and is one of the two raw materials.", "Wasser fehlt! Es kommt über die Wurzeln aus dem Boden und ist einer der beiden Ausgangsstoffe.") },
  { text: tx("Carbon dioxide", "Kohlenstoffdioxid"), miss: tx("You forgot carbon dioxide: the gas from the air that gets in through the stomata.", "Du hast Kohlenstoffdioxid vergessen: das Gas aus der Luft, das durch die Spaltöffnungen hineinkommt.") },
  { text: tx("Light", "Licht"), miss: tx("Without light nothing happens: it delivers the energy.", "Ohne Licht passiert nichts: Es liefert die Energie.") },
  { text: tx("Chlorophyll (green pigment)", "Chlorophyll (Blattgrün)"), miss: tx("Chlorophyll belongs too: the green pigment catches the light. White leaf parts can't do photosynthesis.", "Chlorophyll gehört dazu: Der grüne Farbstoff fängt das Licht ein. Weiße Blattteile können keine Fotosynthese betreiben.") },
];
const NOT_NEEDED: MultiOpt[] = [
  { text: tx("Oxygen", "Sauerstoff"), title: tx("Oxygen comes out", "Sauerstoff kommt heraus"), say: tx("Oxygen is **made** by photosynthesis, it isn't needed for it. You're thinking of breathing.", "Sauerstoff **entsteht** bei der Fotosynthese, er wird dafür nicht gebraucht. Du denkst an die Atmung.") },
  { text: tx("Humus from the soil", "Humus aus dem Boden"), title: tx("No food from the soil", "Keine Nahrung aus dem Boden"), say: tx("Ah, the classic! Plants don't eat soil. From the soil they only take water and minerals.", "Ah, der Klassiker! Pflanzen essen keine Erde. Aus dem Boden nehmen sie nur Wasser und Mineralstoffe.") },
  { text: tx("Glucose", "Traubenzucker"), title: tx("That's the product", "Das ist das Produkt"), say: tx("Glucose is what the leaf **makes**. It isn't a raw material.", "Traubenzucker ist das, was das Blatt **herstellt**. Er ist kein Ausgangsstoff.") },
  { text: tx("Darkness", "Dunkelheit"), title: tx("Light, not dark", "Licht, nicht Dunkel"), say: tx("In the dark there's no photosynthesis at all. The plant needs light.", "Im Dunkeln gibt es gar keine Fotosynthese. Die Pflanze braucht Licht.") },
  { text: tx("Starch", "Stärke"), title: tx("Starch is made later", "Stärke entsteht danach"), say: tx("Starch is the storage form of the glucose the leaf makes. It isn't needed as a raw material.", "Stärke ist die Speicherform des Traubenzuckers, den das Blatt herstellt. Als Ausgangsstoff wird sie nicht gebraucht.") },
];

function needsTask(rng: Rng, fixed?: { right: MultiOpt[]; wrong: MultiOpt[] }): Exercise {
  const right = fixed?.right ?? some(rng, NEEDS, rng.int(2, 4));
  const wrong = fixed?.wrong ?? some(rng, NOT_NEEDED, 5 - right.length + rng.int(0, 1));
  const { answer, mistakes: list } = multi(rng, right, wrong);
  return {
    instruction: tx("What does the leaf need?", "Was braucht das Blatt?"),
    text: tx("Which of these does a plant need for photosynthesis? Select all that apply.", "Was davon braucht eine Pflanze für die Fotosynthese? Wähle alles Passende."),
    answer,
    hint: tx("Two raw materials, the energy, and something that catches the energy.", "Zwei Ausgangsstoffe, die Energie und etwas, das die Energie einfängt."),
    solution: [
      { math: tx('"water" + "carbon dioxide"', '"Wasser" + "Kohlenstoffdioxid"'), note: tx("The raw materials: water from the soil, carbon dioxide from the air.", "Die Ausgangsstoffe: Wasser aus dem Boden, Kohlenstoffdioxid aus der Luft.") },
      { math: tx('"water" + "carbon dioxide" \\\\ "light" , "chlorophyll"#l', '"Wasser" + "Kohlenstoffdioxid" \\\\ "Licht" , "Chlorophyll"#l'), note: tx("Plus light as the energy source and chlorophyll to catch it. Oxygen and glucose are products.", "Dazu Licht als Energiequelle und Chlorophyll, das es einfängt. Sauerstoff und Traubenzucker sind Produkte."), highlight: ["l"] },
    ],
    mistakes: list,
  };
}

const MADE: MultiOpt[] = [
  { text: tx("Glucose", "Traubenzucker"), miss: tx("Glucose is missing: the sugar is the plant's food, the main product.", "Traubenzucker fehlt: Der Zucker ist die Nahrung der Pflanze, das Hauptprodukt.") },
  { text: tx("Oxygen", "Sauerstoff"), miss: tx("You forgot oxygen: the gas the leaf gives off. We breathe it!", "Du hast Sauerstoff vergessen: das Gas, das das Blatt abgibt. Wir atmen es ein!") },
];
const NOT_MADE: MultiOpt[] = [
  { text: tx("Carbon dioxide", "Kohlenstoffdioxid"), title: tx("CO₂ goes in", "CO₂ geht hinein"), say: tx("Carbon dioxide is taken **in**, it's a raw material. The leaf gives off oxygen.", "Kohlenstoffdioxid wird **aufgenommen**, es ist ein Ausgangsstoff. Das Blatt gibt Sauerstoff ab.") },
  { text: tx("Water", "Wasser"), title: tx("Water goes in", "Wasser geht hinein"), say: tx("Water is a raw material that comes from the roots.", "Wasser ist ein Ausgangsstoff, der aus den Wurzeln kommt.") },
  { text: tx("Light", "Licht"), title: tx("Light is energy", "Licht ist Energie"), say: tx("Light isn't made, it's used: it's the energy source. And light is energy, not a substance.", "Licht wird nicht hergestellt, sondern genutzt: Es ist die Energiequelle. Und Licht ist Energie, kein Stoff.") },
  { text: tx("Chlorophyll (green pigment)", "Chlorophyll (Blattgrün)"), title: tx("Chlorophyll helps", "Chlorophyll hilft"), say: tx("Chlorophyll is the green pigment that catches light. It isn't a product of photosynthesis.", "Chlorophyll ist der grüne Farbstoff, der das Licht einfängt. Es ist kein Produkt der Fotosynthese.") },
  { text: tx("Minerals", "Mineralstoffe"), title: tx("From the soil", "Aus dem Boden"), say: tx("Minerals come from the soil with the water. The leaf doesn't make them.", "Mineralstoffe kommen mit dem Wasser aus dem Boden. Das Blatt stellt sie nicht her.") },
];

function madeTask(rng: Rng): Exercise {
  const wrong = some(rng, NOT_MADE, rng.int(2, 4));
  const { answer, mistakes: list } = multi(rng, MADE, wrong);
  return {
    instruction: tx("What does the leaf make?", "Was stellt das Blatt her?"),
    text: tx("Which substances are **made** by photosynthesis? Select all that apply.", "Welche Stoffe **entstehen** bei der Fotosynthese? Wähle alles Passende."),
    answer,
    hint: tx("Look at the right side of the word equation.", "Schau auf die rechte Seite der Wortgleichung."),
    solution: [
      { math: eqMath(null), note: tx("Right side of the word equation: what is made.", "Rechte Seite der Wortgleichung: was entsteht.") },
      { math: eqMath(null), note: tx("**Glucose** and **oxygen** are made. Everything else goes in or helps.", "Es entstehen **Traubenzucker** und **Sauerstoff**. Alles andere geht hinein oder hilft mit."), highlight: ["z", "o"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 4. The starch test: predict and interpret

const AREA_NAME: Record<string, Text> = {
  lit: tx("green, in the light", "grün, im Licht"),
  covered: tx("covered", "abgedeckt"),
  margin: tx("white edge", "weißer Rand"),
};

function areaList(nums: number[]): Text {
  if (!nums.length) return tx("No area", "Kein Bereich");
  if (nums.length === 1) return tx(`Only area ${nums[0]}`, `Nur Bereich ${nums[0]}`);
  const s = [...nums].sort((a, b) => a - b);
  return tx(`Areas ${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`, `Bereiche ${s.slice(0, -1).join(", ")} und ${s[s.length - 1]}`);
}

const STENCIL_TEXT: Record<Stencil, Text> = {
  strip: tx("a strip of foil", "einem Folienstreifen"),
  circle: tx("a round piece of foil", "einem runden Stück Folie"),
  star: tx("a foil stencil with a star cut out", "einer Folienschablone mit ausgeschnittenem Stern"),
};

function starchTask(rng: Rng, opts?: { stencil: Stencil; variegated: boolean; order: string[]; stage: "foil" | "iodine" }): Exercise {
  const stencil = opts?.stencil ?? rng.pick<Stencil>(["strip", "circle", "star"]);
  const variegated = opts?.variegated ?? (stencil !== "star" && rng.chance(0.45));
  const ids = variegated ? ["lit", "covered", "margin"] : ["lit", "covered"];
  const order = opts?.order ?? rng.shuffle(ids);
  const stage = opts?.stage ?? (rng.chance(0.6) ? "foil" : "iodine");
  const num = (id: string) => order.indexOf(id) + 1;
  const sets: { ids: string[]; title?: Text; say?: Text }[] = [
    { ids: ["lit"] },
    {
      ids: ["covered"],
      title: tx("Swapped round", "Vertauscht"),
      say: tx("The other way round! Under the foil there was **no light**, so no photosynthesis and no starch.", "Andersherum! Unter der Folie gab es **kein Licht**, also keine Fotosynthese und keine Stärke."),
    },
    {
      ids: ["lit", "covered"],
      title: tx("Light is needed", "Licht wird gebraucht"),
      say: tx("The covered part got no light. Without light, no starch: it stays yellow-brown.", "Der abgedeckte Teil bekam kein Licht. Ohne Licht keine Stärke: Er bleibt gelb-braun."),
    },
    ...(variegated
      ? [
          {
            ids: ["lit", "margin"],
            title: tx("No chlorophyll there", "Dort fehlt Chlorophyll"),
            say: tx("The white edge was in the light, but it has **no chlorophyll**. Nothing catches the light, so no starch is made there.", "Der weiße Rand war im Licht, hat aber **kein Chlorophyll**. Nichts fängt das Licht ein, deshalb entsteht dort keine Stärke."),
          },
        ]
      : [
          {
            ids: [],
            title: tx("Starch was made", "Es entstand Stärke"),
            say: tx("The plant was destarched first, right. But afterwards the lit part did photosynthesis and made new starch.", "Die Pflanze wurde vorher entstärkt, stimmt. Danach hat der belichtete Teil aber Fotosynthese betrieben und neue Stärke gebildet."),
          },
        ]),
  ];
  const { answer, mistakes: list } = choice(
    rng,
    sets.map((s) => ({ text: areaList(s.ids.map(num)), title: s.title, say: s.say })),
  );
  const picture = visual(PhotoStarchLeaf, { stencil, variegated, stage, areas: order });
  const story =
    stage === "foil"
      ? tx(
          `A plant${variegated ? " with white-edged leaves" : ""} was kept in the dark for two days. Then a leaf was covered with ${en(STENCIL_TEXT[stencil])} (picture) and put in the sun for a day. After that it was boiled, decolourised in hot alcohol and tested with iodine solution. **Which area turns blue-black?**`,
          `Eine Pflanze${variegated ? " mit weiß gerandeten Blättern" : ""} stand zwei Tage im Dunkeln. Dann wurde ein Blatt mit ${de(STENCIL_TEXT[stencil])} abgedeckt (Bild) und einen Tag in die Sonne gestellt. Danach wurde es abgekocht, in heißem Alkohol entfärbt und mit Iodlösung getestet. **Welcher Bereich wird blau-schwarz?**`,
        )
      : tx(
          `This leaf${variegated ? " (with a white edge)" : ""} was partly covered with ${en(STENCIL_TEXT[stencil])} and lit, then tested with iodine solution. **In which area did the leaf make starch?**`,
          `Dieses Blatt${variegated ? " (mit weißem Rand)" : ""} war teilweise mit ${de(STENCIL_TEXT[stencil])} abgedeckt und wurde belichtet, dann mit Iodlösung getestet. **In welchem Bereich hat das Blatt Stärke gebildet?**`,
        );
  return {
    instruction: tx("The starch test", "Der Stärkenachweis"),
    text: story,
    visual: picture,
    answer,
    hint: variegated
      ? tx("Starch needs two things at once: light and chlorophyll.", "Für Stärke braucht es beides zugleich: Licht und Chlorophyll.")
      : tx("Starch is only made where the leaf did photosynthesis. What does that need?", "Stärke entsteht nur dort, wo das Blatt Fotosynthese betrieben hat. Was braucht man dafür?"),
    solution: [
      {
        math: join(q(tx("light", "Licht"), "l"), "+", q(tx("chlorophyll", "Chlorophyll"), "c"), "\\to#to", q(tx("starch", "Stärke"), "s")),
        note: tx("Starch only forms where light falls on green leaf parts.", "Stärke entsteht nur dort, wo Licht auf grüne Blattteile fällt."),
      },
      {
        math: join(q(tx("starch", "Stärke"), "s"), "+", q(tx("iodine", "Iod"), "i"), "\\to#to", q(tx("blue-black", "blau-schwarz"), "b")),
        note: tx(
          `So only area ${num("lit")} (${en(AREA_NAME.lit)}) turns blue-black.${variegated ? " The white edge lacks chlorophyll," : ""} The covered part had no light.`,
          `Also wird nur Bereich ${num("lit")} (${de(AREA_NAME.lit)}) blau-schwarz.${variegated ? " Dem weißen Rand fehlt das Chlorophyll," : ""} Der abgedeckte Teil hatte kein Licht.`,
        ),
        highlight: ["b"],
      },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 5. The steps of the experiment in order

const STEPS: Text[] = [
  tx("Keep the plant in the dark for 2 days", "Pflanze 2 Tage ins Dunkle stellen"),
  tx("Cover part of a leaf with foil", "Einen Blattteil mit Folie abdecken"),
  tx("Put the plant in the light for some hours", "Pflanze einige Stunden belichten"),
  tx("Boil the leaf briefly in water", "Blatt kurz in Wasser abkochen"),
  tx("Decolourise the leaf in hot alcohol", "Blatt in heißem Alkohol entfärben"),
  tx("Drip iodine solution onto the leaf", "Iodlösung auf das Blatt tropfen"),
];

function orderTask(rng: Rng, keep?: number[]): Exercise {
  const n = rng.int(4, 6);
  const idx = keep ?? some(rng, [0, 1, 2, 3, 4, 5], n).sort((a, b) => a - b);
  const items = idx.map((i) => STEPS[i]);
  const has = (i: number) => idx.includes(i);
  const m: { when: AnswerSpec; title: Text; say: Text }[] = [];
  if (has(4) && has(5))
    m.push({
      when: { kind: "order", items: [STEPS[5], STEPS[4]] },
      title: tx("Green hides the colour", "Grün verdeckt die Farbe"),
      say: tx("If you drip iodine on a green leaf, the green chlorophyll hides the colour. First take the green out with hot alcohol.", "Tropfst du Iod auf ein grünes Blatt, verdeckt das grüne Chlorophyll die Farbe. Erst muss das Grün mit heißem Alkohol heraus."),
    });
  if (has(1) && has(2))
    m.push({
      when: { kind: "order", items: [STEPS[2], STEPS[1]] },
      title: tx("Cover before the light", "Erst abdecken, dann Licht"),
      say: tx("The foil has to be on **before** the light: otherwise the whole leaf has already made starch.", "Die Folie muss **vor** dem Belichten drauf: Sonst hat schon das ganze Blatt Stärke gebildet."),
    });
  if (has(0) && (has(2) || has(1)))
    m.push({
      when: { kind: "order", items: [STEPS[has(2) ? 2 : 1], STEPS[0]] },
      title: tx("Destarch first", "Zuerst entstärken"),
      say: tx("The plant goes into the dark **first**, so the old starch is used up. Only then can you see where new starch is made.", "Die Pflanze kommt **zuerst** ins Dunkle, damit die alte Stärke verbraucht wird. Nur dann sieht man, wo neue Stärke entsteht."),
    });
  if (has(3) && has(5))
    m.push({
      when: { kind: "order", items: [STEPS[5], STEPS[3]] },
      title: tx("Iodine comes last", "Iod kommt zum Schluss"),
      say: tx("The iodine test is the very last step. Before that the leaf is boiled and decolourised.", "Der Iodtest ist der allerletzte Schritt. Vorher wird das Blatt abgekocht und entfärbt."),
    });
  return {
    instruction: tx("Order the steps", "Ordne die Versuchsschritte"),
    text: tx("You want to show that a leaf only makes starch in the light. Put the steps of the experiment in the right order.", "Du willst zeigen, dass ein Blatt nur im Licht Stärke bildet. Bring die Versuchsschritte in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("First make sure there's no old starch left. The colour test comes at the very end.", "Sorg zuerst dafür, dass keine alte Stärke mehr da ist. Der Farbtest kommt ganz am Ende."),
    solution: [
      { math: q(tx("dark → cover → light", "Dunkel → Abdecken → Licht"), "a"), note: tx("Destarch in the dark, cover part of a leaf, then light: now new starch forms only in the uncovered part.", "Im Dunkeln entstärken, einen Blattteil abdecken, dann belichten: Jetzt entsteht neue Stärke nur im freien Teil.") },
      { math: join(q(tx("dark → cover → light", "Dunkel → Abdecken → Licht"), "a"), "\\\\", q(tx("boil → alcohol → iodine", "Abkochen → Alkohol → Iod"), "b")), note: tx("Then boil, take out the green with alcohol and finally test with iodine.", "Dann abkochen, das Grün mit Alkohol herauslösen und zum Schluss mit Iod testen."), highlight: ["b"] },
    ],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// 6. Why is this step needed?

type Why = { ask: Text; short: Text; right: Text; shortRight: Text; wrong: Opt[] };

const WHYS: Why[] = [
  {
    ask: tx("Why is the plant kept in the dark for two days before the experiment?", "Warum stellt man die Pflanze vor dem Versuch zwei Tage ins Dunkle?"),
    short: tx("dark first", "erst Dunkelheit"),
    right: tx("So that it uses up the starch already in its leaves", "Damit sie die Stärke in ihren Blättern verbraucht"),
    shortRight: tx("use up old starch", "alte Stärke verbrauchen"),
    wrong: [
      { text: tx("So that it gets used to the foil", "Damit sie sich an die Folie gewöhnt"), title: tx("Think about old starch", "Denk an alte Stärke"), say: tx("Plants don't get used to anything. In the dark the leaf uses up its old starch, so that any starch later must be new.", "Pflanzen gewöhnen sich an nichts. Im Dunkeln verbraucht das Blatt seine alte Stärke, damit spätere Stärke sicher neu ist.") },
      { text: tx("So that it stores up light", "Damit sie Licht speichert"), title: tx("Light can't be stored", "Licht kann man nicht lagern"), say: tx("Light is energy, not a substance: a plant can't collect it in the dark. The dark phase removes the old starch.", "Licht ist Energie, kein Stoff: Eine Pflanze kann es im Dunkeln nicht sammeln. Die Dunkelphase entfernt die alte Stärke.") },
      { text: tx("So that photosynthesis can happen at night", "Damit nachts Fotosynthese stattfinden kann"), title: tx("No photosynthesis in the dark", "Keine Fotosynthese im Dunkeln"), say: tx("In the dark there's no photosynthesis. That's exactly why the plant uses up its starch there.", "Im Dunkeln gibt es keine Fotosynthese. Genau deshalb verbraucht die Pflanze dort ihre Stärke.") },
    ],
  },
  {
    ask: tx("Why is only **part** of the leaf covered with foil?", "Warum wird nur ein **Teil** des Blattes mit Folie abgedeckt?"),
    short: tx("foil", "Folie"),
    right: tx("To compare a lit part with an unlit part of the same leaf", "Um einen belichteten mit einem unbelichteten Teil desselben Blattes zu vergleichen"),
    shortRight: tx("light vs no light", "Licht vs. kein Licht"),
    wrong: [
      { text: tx("To keep the leaf warm", "Damit das Blatt warm bleibt"), title: tx("It's about light", "Es geht um Licht"), say: tx("The foil keeps out the **light**. The covered part is the comparison: everything is the same except the light.", "Die Folie hält das **Licht** ab. Der abgedeckte Teil ist der Vergleich: Alles ist gleich, nur das Licht fehlt.") },
      { text: tx("To stop water getting into the leaf", "Damit kein Wasser ins Blatt kommt"), title: tx("Water comes from inside", "Wasser kommt von innen"), say: tx("Water gets in from the stem, foil doesn't stop it. The foil keeps out the light.", "Wasser kommt über die Sprossachse, das hält Folie nicht auf. Die Folie hält das Licht ab.") },
      { text: tx("So the iodine sticks better", "Damit das Iod besser haftet"), title: tx("Foil comes off first", "Folie kommt vorher ab"), say: tx("The foil is removed before the test. It's there to keep out the light during the lit phase.", "Die Folie wird vor dem Test entfernt. Sie hält während der Belichtung das Licht ab.") },
    ],
  },
  {
    ask: tx("Why is the leaf put into hot alcohol before the iodine test?", "Warum kommt das Blatt vor dem Iodtest in heißen Alkohol?"),
    short: tx("alcohol", "Alkohol"),
    right: tx("To remove the green chlorophyll so the colour can be seen", "Um das grüne Chlorophyll herauszulösen, damit man die Farbe sieht"),
    shortRight: tx("remove the green", "Grün herauslösen"),
    wrong: [
      { text: tx("To make starch from the sugar", "Damit aus Zucker Stärke wird"), title: tx("Starch is already there", "Stärke ist schon da"), say: tx("The starch formed in the light. The alcohol only takes out the green pigment so you can see the colour clearly.", "Die Stärke entstand im Licht. Der Alkohol löst nur den grünen Farbstoff heraus, damit man die Farbe gut erkennt.") },
      { text: tx("To kill bacteria on the leaf", "Um Bakterien auf dem Blatt abzutöten"), title: tx("It's about colour", "Es geht um Farbe"), say: tx("Bacteria don't matter here. The green would hide the blue-black colour, so it has to go.", "Bakterien spielen hier keine Rolle. Das Grün würde die blau-schwarze Farbe verdecken, deshalb muss es heraus.") },
      { text: tx("To give the leaf more energy", "Um dem Blatt mehr Energie zu geben"), title: tx("The leaf is dead now", "Das Blatt lebt nicht mehr"), say: tx("After boiling the leaf no longer lives. The alcohol takes out the chlorophyll.", "Nach dem Abkochen lebt das Blatt nicht mehr. Der Alkohol löst das Chlorophyll heraus.") },
    ],
  },
  {
    ask: tx("What does iodine solution show in this experiment?", "Was zeigt die Iodlösung bei diesem Versuch?"),
    short: tx("iodine", "Iod"),
    right: tx("Where there is starch: it turns blue-black", "Wo Stärke ist: Sie färbt sich blau-schwarz"),
    shortRight: tx("starch: blue-black", "Stärke: blau-schwarz"),
    wrong: [
      { text: tx("Where there is oxygen: it turns red", "Wo Sauerstoff ist: Er färbt sich rot"), title: tx("Iodine finds starch", "Iod weist Stärke nach"), say: tx("Iodine solution is the test for **starch**: blue-black means starch.", "Iodlösung ist der Nachweis für **Stärke**: Blau-schwarz heißt Stärke.") },
      { text: tx("Where there is water: it turns blue", "Wo Wasser ist: Es färbt sich blau"), title: tx("Iodine finds starch", "Iod weist Stärke nach"), say: tx("Water doesn't change iodine's colour. Only starch turns blue-black.", "Wasser ändert die Farbe von Iod nicht. Nur Stärke wird blau-schwarz.") },
      { text: tx("Where there is starch: it turns yellow-brown", "Wo Stärke ist: Sie färbt sich gelb-braun"), title: tx("The other colour", "Die andere Farbe"), say: tx("Yellow-brown is the colour of the iodine solution itself. With starch it turns **blue-black**.", "Gelb-braun ist die Farbe der Iodlösung selbst. Mit Stärke wird sie **blau-schwarz**.") },
    ],
  },
  {
    ask: tx("A leaf with a white edge is lit and tested with iodine. The white edge stays yellow-brown. What does that show?", "Ein Blatt mit weißem Rand wird belichtet und mit Iod getestet. Der weiße Rand bleibt gelb-braun. Was zeigt das?"),
    short: tx("white edge", "weißer Rand"),
    right: tx("Photosynthesis needs chlorophyll", "Fotosynthese braucht Chlorophyll"),
    shortRight: tx("chlorophyll needed", "Chlorophyll nötig"),
    wrong: [
      { text: tx("Photosynthesis needs darkness", "Fotosynthese braucht Dunkelheit"), title: tx("The edge was lit", "Der Rand war im Licht"), say: tx("The white edge was in the light too. What it lacks is the green chlorophyll.", "Der weiße Rand war ja auch im Licht. Ihm fehlt das grüne Chlorophyll.") },
      { text: tx("The white edge gets no water", "Der weiße Rand bekommt kein Wasser"), title: tx("It's the colour", "Es liegt an der Farbe"), say: tx("The white parts are supplied with water too. They have no chlorophyll, so they can't catch light.", "Auch die weißen Teile werden mit Wasser versorgt. Ihnen fehlt Chlorophyll, sie können kein Licht einfangen.") },
      { text: tx("Iodine doesn't work on white leaves", "Iod wirkt nicht auf weißen Blättern"), title: tx("Iodine works anywhere", "Iod wirkt überall"), say: tx("After the alcohol step the whole leaf is pale anyway. Iodine would show starch anywhere. There just isn't any in the white edge.", "Nach dem Alkohol ist das ganze Blatt sowieso blass. Iod würde Stärke überall zeigen. Im weißen Rand ist nur keine.") },
    ],
  },
];

function whyTask(rng: Rng): Exercise {
  const w = rng.pick(WHYS);
  const { answer, mistakes: list } = choice(rng, [{ text: w.right }, ...w.wrong]);
  return {
    instruction: tx("Explain the experiment", "Erkläre den Versuch"),
    text: w.ask,
    answer,
    hint: tx("Each step has one job: think about what would go wrong without it.", "Jeder Schritt hat eine Aufgabe: Überleg, was ohne ihn schiefgehen würde."),
    solution: reasonFrames(w.short, w.ask, w.shortRight, tx(`**${en(w.right)}.**`, `**${de(w.right)}.**`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 7. Terms

type Term = { def: Text; accept: Text[]; short: Text; near?: { accept: Text[]; title: Text; say: Text }[] };

const TERMS: Term[] = [
  {
    def: tx("The green pigment in leaves that captures light.", "Der grüne Farbstoff in Blättern, der das Licht einfängt."),
    accept: [tx("chlorophyll", "Chlorophyll"), "Blattgrün", "Chlorophyl"],
    short: tx("chlorophyll", "Chlorophyll"),
    near: [{ accept: [tx("chloroplast", "Chloroplast"), "Chloroplasten", "Blattgrünkörner"], title: tx("The grain, not the pigment", "Das Körnchen, nicht der Farbstoff"), say: tx("Close! The **chloroplasts** are the green grains in the cells. The green pigment inside them has its own name.", "Knapp! Die **Chloroplasten** sind die grünen Körnchen in den Zellen. Der grüne Farbstoff darin hat einen eigenen Namen.") }],
  },
  {
    def: tx("Tiny openings, mostly on the underside of a leaf, where carbon dioxide gets in.", "Winzige Öffnungen, meist an der Blattunterseite, durch die Kohlenstoffdioxid hineinkommt."),
    accept: [tx("stomata", "Spaltöffnungen"), "stoma", "Spaltöffnung", "Stomata", "stomas"],
    short: tx("stomata", "Spaltöffnungen"),
    near: [{ accept: [tx("root hairs", "Wurzelhaare")], title: tx("That's for water", "Die sind für Wasser"), say: tx("Root hairs take up water from the soil. The gas gets into the leaf through other openings.", "Wurzelhaare nehmen Wasser aus dem Boden auf. Das Gas gelangt durch andere Öffnungen ins Blatt.") }],
  },
  {
    def: tx("The sugar a plant makes by photosynthesis.", "Der Zucker, den eine Pflanze bei der Fotosynthese herstellt."),
    accept: [tx("glucose", "Traubenzucker"), "Glucose", "Glukose", "grape sugar"],
    short: tx("glucose", "Traubenzucker"),
    near: [{ accept: [tx("starch", "Stärke")], title: tx("That comes next", "Das kommt danach"), say: tx("Starch is made **from** this sugar afterwards, for storage. The first sugar has another name.", "Stärke entsteht erst danach **aus** diesem Zucker, zum Speichern. Der erste Zucker heißt anders.") }],
  },
  {
    def: tx("The storage substance that plants make from glucose. Iodine turns it blue-black.", "Der Speicherstoff, den Pflanzen aus Traubenzucker bilden. Iod färbt ihn blau-schwarz."),
    accept: [tx("starch", "Stärke")],
    short: tx("starch", "Stärke"),
    near: [{ accept: [tx("glucose", "Traubenzucker"), "Glucose"], title: tx("The chain of it", "Die Kette daraus"), say: tx("Glucose is the building block. Many glucose units together form the storage substance.", "Traubenzucker ist der Baustein. Viele Traubenzucker-Bausteine zusammen bilden den Speicherstoff.") }],
  },
  {
    def: tx("The gas that leaves the leaf during photosynthesis and that we breathe.", "Das Gas, das bei der Fotosynthese das Blatt verlässt und das wir einatmen."),
    accept: [tx("oxygen", "Sauerstoff")],
    short: tx("oxygen", "Sauerstoff"),
    near: [{ accept: [tx("carbon dioxide", "Kohlenstoffdioxid"), "CO2"], title: tx("That one goes in", "Das geht hinein"), say: tx("Carbon dioxide is taken **in** by the leaf. The gas that comes out is the one we breathe in.", "Kohlenstoffdioxid nimmt das Blatt **auf**. Heraus kommt das Gas, das wir einatmen.") }],
  },
  {
    def: tx("The green grains in leaf cells where photosynthesis takes place.", "Die grünen Körnchen in den Blattzellen, in denen die Fotosynthese stattfindet."),
    accept: [tx("chloroplasts", "Chloroplasten"), "chloroplast", "Chloroplast", "Blattgrünkörner", "Blattgrünkorn"],
    short: tx("chloroplasts", "Chloroplasten"),
    near: [{ accept: [tx("chlorophyll", "Chlorophyll")], title: tx("The pigment, not the grain", "Der Farbstoff, nicht das Körnchen"), say: tx("Chlorophyll is the pigment **inside** these grains. The grains themselves have another name.", "Chlorophyll ist der Farbstoff **in** diesen Körnchen. Die Körnchen selbst heißen anders.") }],
  },
  {
    def: tx("The process in which plants make glucose and oxygen from water and carbon dioxide, using light.", "Der Vorgang, bei dem Pflanzen mit Licht aus Wasser und Kohlenstoffdioxid Traubenzucker und Sauerstoff herstellen."),
    accept: [tx("photosynthesis", "Fotosynthese"), "Photosynthese"],
    short: tx("photosynthesis", "Fotosynthese"),
    near: [{ accept: [tx("respiration", "Atmung"), "Zellatmung"], title: tx("That's the opposite", "Das ist das Gegenteil"), say: tx("Respiration **breaks down** sugar with oxygen. Here sugar is **built up** with light.", "Bei der Atmung wird Zucker mit Sauerstoff **abgebaut**. Hier wird Zucker mit Licht **aufgebaut**.") }],
  },
];

function termTask(rng: Rng, t = rng.pick(TERMS)): Exercise {
  const answer: AnswerSpec = { kind: "word", accept: t.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const n of t.near ?? []) m.add({ kind: "word", accept: n.accept }, n.title, n.say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: t.def,
    answer,
    hint: tx(`It starts with "${en(t.accept[0]).slice(0, 2)}…".`, `Es beginnt mit „${de(t.accept[0]).slice(0, 2)}…“.`),
    solution: [{ math: q(t.short, "a"), note: tx(`It's called **${en(t.short)}**.`, `Das heißt **${de(t.short)}**.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 8. Which statement is true?

const TRUE: Text[] = [
  tx("Plants make their own food, using the energy of light.", "Pflanzen stellen ihre Nahrung selbst her, mit der Energie des Lichts."),
  tx("The oxygen we breathe comes from photosynthesis.", "Der Sauerstoff, den wir atmen, stammt aus der Fotosynthese."),
  tx("Photosynthesis happens in the green parts of a plant, mainly in the leaves.", "Fotosynthese findet in den grünen Teilen der Pflanze statt, vor allem in den Blättern."),
  tx("Plants respire too: they use oxygen day and night.", "Auch Pflanzen atmen: Sie verbrauchen Tag und Nacht Sauerstoff."),
  tx("All food chains begin with plants or algae.", "Alle Nahrungsketten beginnen mit Pflanzen oder Algen."),
  tx("Iodine solution turns starch blue-black.", "Iodlösung färbt Stärke blau-schwarz."),
];
const FALSE: Opt[] = [
  { text: tx("Plants take their food from the soil.", "Pflanzen nehmen ihre Nahrung aus dem Boden auf."), title: tx("The food isn't in the soil", "Nahrung kommt nicht aus dem Boden"), say: tx("The classic trap! From the soil plants only take water and minerals. Their food, glucose, is made in the leaf.", "Die klassische Falle! Aus dem Boden nehmen Pflanzen nur Wasser und Mineralstoffe. Ihre Nahrung, den Traubenzucker, stellen sie im Blatt her.") },
  { text: tx("Photosynthesis takes place mainly in the roots.", "Fotosynthese findet vor allem in den Wurzeln statt."), title: tx("Roots are in the dark", "Wurzeln sind im Dunkeln"), say: tx("Roots get no light and have no chlorophyll. They take up water. Photosynthesis happens in the green leaves.", "Wurzeln bekommen kein Licht und haben kein Chlorophyll. Sie nehmen Wasser auf. Fotosynthese findet in den grünen Blättern statt.") },
  { text: tx("Plants give off oxygen, but never use any themselves.", "Pflanzen geben Sauerstoff ab, verbrauchen aber selbst nie welchen."), title: tx("Plants respire too", "Pflanzen atmen auch"), say: tx("Plants are living things, so they respire day and night and use oxygen. In light they just make more than they use.", "Pflanzen sind Lebewesen, sie atmen Tag und Nacht und verbrauchen dabei Sauerstoff. Im Licht stellen sie nur mehr her, als sie verbrauchen.") },
  { text: tx("Light is a substance that the plant stores in its leaves.", "Licht ist ein Stoff, den die Pflanze in ihren Blättern speichert."), title: tx("Light is energy", "Licht ist Energie"), say: tx("Light isn't a substance, it's **energy**. The plant stores that energy in glucose and starch.", "Licht ist kein Stoff, sondern **Energie**. Diese Energie speichert die Pflanze im Traubenzucker und in der Stärke.") },
  { text: tx("Plants also do photosynthesis at night.", "Pflanzen betreiben auch nachts Fotosynthese."), title: tx("No light, no photosynthesis", "Ohne Licht keine Fotosynthese"), say: tx("At night there is no light, so there's no photosynthesis. Respiration goes on, though.", "Nachts gibt es kein Licht, also auch keine Fotosynthese. Die Atmung läuft aber weiter.") },
  { text: tx("Plants take in oxygen for photosynthesis.", "Pflanzen nehmen für die Fotosynthese Sauerstoff auf."), title: tx("Carbon dioxide goes in", "Kohlenstoffdioxid geht hinein"), say: tx("For photosynthesis the leaf takes in **carbon dioxide** and gives off oxygen.", "Für die Fotosynthese nimmt das Blatt **Kohlenstoffdioxid** auf und gibt Sauerstoff ab.") },
  { text: tx("Starch turns yellow-brown with iodine.", "Stärke färbt sich mit Iod gelb-braun."), title: tx("Blue-black", "Blau-schwarz"), say: tx("Yellow-brown is just the iodine solution's own colour. Starch turns it **blue-black**.", "Gelb-braun ist nur die Eigenfarbe der Iodlösung. Mit Stärke wird sie **blau-schwarz**.") },
];

function statementTask(rng: Rng): Exercise {
  const right = rng.pick(TRUE);
  const wrong = some(rng, FALSE, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: right }, ...wrong]);
  return {
    instruction: tx("True or false?", "Richtig oder falsch?"),
    text: tx("Which statement is **true**?", "Welche Aussage ist **richtig**?"),
    answer,
    hint: tx("Three of them are classic mix-ups about plants. Check each one against the word equation.", "Drei davon sind typische Irrtümer über Pflanzen. Prüf jede Aussage an der Wortgleichung."),
    solution: [{ math: q(tx("true", "richtig"), "a"), note: tx(`**${en(right)}** The other statements are common mix-ups.`, `**${de(right)}** Die anderen Aussagen sind verbreitete Irrtümer.`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 9. Following the energy: food chains

const CHAINS: Text[][] = [
  [tx("Sunlight", "Sonnenlicht"), tx("Grass", "Gras"), tx("Rabbit", "Kaninchen"), tx("Fox", "Fuchs")],
  [tx("Sunlight", "Sonnenlicht"), tx("Oak leaf", "Eichenblatt"), tx("Caterpillar", "Raupe"), tx("Blue tit", "Blaumeise"), tx("Sparrowhawk", "Sperber")],
  [tx("Sunlight", "Sonnenlicht"), tx("Wheat", "Weizen"), tx("Mouse", "Maus"), tx("Owl", "Eule")],
  [tx("Sunlight", "Sonnenlicht"), tx("Algae", "Algen"), tx("Water flea", "Wasserfloh"), tx("Stickleback", "Stichling"), tx("Heron", "Graureiher")],
  [tx("Sunlight", "Sonnenlicht"), tx("Clover", "Klee"), tx("Cow", "Kuh"), tx("Human", "Mensch")],
  [tx("Sunlight", "Sonnenlicht"), tx("Dandelion", "Löwenzahn"), tx("Snail", "Schnecke"), tx("Hedgehog", "Igel")],
];

const chainMath = (chain: Text[]): Text => {
  const build = (l: "en" | "de") => chain.map((c, i) => `${i ? `\\to#t${i} ` : ""}"${l === "en" ? en(c) : de(c)}"#c${i}`).join(" ");
  return tx(build("en"), build("de"));
};

function chainTask(rng: Rng, chain = rng.pick(CHAINS)): Exercise {
  const plant = chain[1];
  const m: { when: AnswerSpec; title: Text; say: Text }[] = [
    {
      when: { kind: "order", items: [chain[2], plant] },
      title: tx("Plants come first", "Pflanzen kommen zuerst"),
      say: tx(`Animals can't make their own food. The ${en(plant).toLowerCase()} makes it with light, and only then can it be eaten.`, `Tiere können keine Nahrung selbst herstellen. ${de(plant)} stellt sie mit Licht her, erst dann kann gefressen werden.`),
    },
    {
      when: { kind: "order", items: [plant, chain[0]] },
      title: tx("The sun starts it", "Die Sonne steht am Anfang"),
      say: tx("All the energy starts as sunlight. The plant turns it into energy in food by photosynthesis.", "Die ganze Energie beginnt als Sonnenlicht. Die Pflanze macht daraus durch Fotosynthese Energie in der Nahrung."),
    },
  ];
  return {
    instruction: tx("Follow the energy", "Folge der Energie"),
    text: tx("Put them in the order in which the energy flows, from where it starts to the last eater.", "Ordne so, wie die Energie fließt: vom Anfang bis zum letzten Fresser."),
    answer: { kind: "order", items: chain },
    hint: tx("The energy starts outside the food chain. Who can catch it?", "Die Energie kommt von außerhalb der Nahrungskette. Wer kann sie einfangen?"),
    solution: [
      { math: chainMath(chain.slice(0, 2)), note: tx(`Light energy is caught by the ${en(plant).toLowerCase()} (producer) and stored in sugar.`, `${de(plant)} (Produzent) fängt die Lichtenergie ein und speichert sie im Zucker.`) },
      { math: chainMath(chain), note: tx("Then every animal eats the one before it. Without photosynthesis there would be no food at all.", "Dann frisst jedes Tier das vorherige. Ohne Fotosynthese gäbe es überhaupt keine Nahrung.") },
    ],
    mistakes: m,
  };
}

function energyTask(rng: Rng): Exercise {
  const chain = rng.pick(CHAINS);
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("From the sun, caught by plants", "Von der Sonne, eingefangen von Pflanzen") },
    { text: tx("From the soil", "Aus dem Boden"), title: tx("No energy from the soil", "Keine Energie aus dem Boden"), say: tx("The soil gives plants water and minerals, but no energy. The energy comes from sunlight.", "Der Boden liefert Wasser und Mineralstoffe, aber keine Energie. Die Energie kommt aus dem Sonnenlicht.") },
    { text: tx("From the oxygen in the air", "Aus dem Sauerstoff der Luft"), title: tx("Oxygen helps use it", "Sauerstoff hilft beim Nutzen"), say: tx("Oxygen is needed to release the energy from food, but it isn't the source. The source is the sun.", "Sauerstoff braucht man, um Energie aus der Nahrung freizusetzen, er ist aber nicht die Quelle. Die Quelle ist die Sonne.") },
    { text: tx("The animal makes it itself", "Das Tier stellt sie selbst her"), title: tx("Only plants can", "Das können nur Pflanzen"), say: tx("Animals can't make food from light. They get their energy by eating plants or other animals.", "Tiere können keine Nahrung aus Licht herstellen. Sie bekommen ihre Energie, indem sie Pflanzen oder andere Tiere fressen.") },
  ]);
  return {
    instruction: tx("Follow the energy", "Folge der Energie"),
    text: tx(
      `Food chain: ${chain.slice(1).map(en).join(" → ")}. Where does the energy that the last animal gets from its food originally come from?`,
      `Nahrungskette: ${chain.slice(1).map(de).join(" → ")}. Woher stammt ursprünglich die Energie, die das letzte Tier mit seiner Nahrung aufnimmt?`,
    ),
    answer,
    hint: tx("Go back along the chain to its very first link.", "Geh die Kette rückwärts bis zum allerersten Glied."),
    solution: [
      { math: q(chain[1], "p"), note: tx(`At the start of the chain is the ${en(chain[1]).toLowerCase()}: a plant, the producer.`, `Am Anfang der Kette steht ${de(chain[1])}: eine Pflanze, der Produzent.`) },
      { math: join(q(tx("sunlight", "Sonnenlicht"), "s"), "\\to", q(chain[1], "p")), note: tx("Plants catch the energy of sunlight by photosynthesis. So all the energy comes from the sun.", "Pflanzen fangen durch Fotosynthese die Energie des Sonnenlichts ein. Alle Energie stammt also von der Sonne."), highlight: ["s"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 10. Parts of the plant

const PART_JOB: Record<string, { name: Text; theDe: string; job: Text; wrongJob: Opt[] }> = {
  leaf: {
    name: tx("Leaf", "Laubblatt"),
    theDe: "das Laubblatt",
    job: tx("Makes glucose by photosynthesis", "Stellt durch Fotosynthese Traubenzucker her"),
    wrongJob: [
      { text: tx("Takes up water from the soil", "Nimmt Wasser aus dem Boden auf"), title: tx("That's the roots", "Das machen die Wurzeln"), say: tx("Water is taken up by the roots. The leaf is the green factory where sugar is made.", "Wasser nehmen die Wurzeln auf. Das Blatt ist die grüne Fabrik, in der Zucker entsteht.") },
      { text: tx("Anchors the plant in the ground", "Verankert die Pflanze im Boden"), title: tx("That's the roots", "Das machen die Wurzeln"), say: tx("The roots hold the plant in place. The leaf catches light and makes sugar.", "Die Wurzeln halten die Pflanze fest. Das Blatt fängt Licht ein und stellt Zucker her.") },
      { text: tx("Takes up food from the soil", "Nimmt Nahrung aus dem Boden auf"), title: tx("No food from the soil", "Keine Nahrung aus dem Boden"), say: tx("Plants don't take food from the soil at all. The leaf **makes** the food.", "Pflanzen nehmen überhaupt keine Nahrung aus dem Boden auf. Das Blatt **stellt** die Nahrung **her**.") },
    ],
  },
  root: {
    name: tx("Roots", "Wurzeln"),
    theDe: "die Wurzeln",
    job: tx("Take up water and minerals from the soil", "Nehmen Wasser und Mineralstoffe aus dem Boden auf"),
    wrongJob: [
      { text: tx("Make glucose by photosynthesis", "Stellen durch Fotosynthese Traubenzucker her"), title: tx("Roots are in the dark", "Wurzeln sind im Dunkeln"), say: tx("Roots grow in the dark soil and have no chlorophyll: no photosynthesis there. They take up water.", "Wurzeln wachsen im dunklen Boden und haben kein Chlorophyll: Dort gibt es keine Fotosynthese. Sie nehmen Wasser auf.") },
      { text: tx("Take up food from the soil", "Nehmen Nahrung aus dem Boden auf"), title: tx("No food from the soil", "Keine Nahrung aus dem Boden"), say: tx("The classic trap! The soil gives only water and minerals. The food is made in the leaves.", "Die klassische Falle! Der Boden liefert nur Wasser und Mineralstoffe. Die Nahrung entsteht in den Blättern.") },
      { text: tx("Take in carbon dioxide from the soil", "Nehmen Kohlenstoffdioxid aus dem Boden auf"), title: tx("CO₂ comes from the air", "CO₂ kommt aus der Luft"), say: tx("Carbon dioxide gets into the leaves from the air, through the stomata.", "Kohlenstoffdioxid gelangt aus der Luft durch die Spaltöffnungen in die Blätter.") },
    ],
  },
  stem: {
    name: tx("Stem", "Sprossachse"),
    theDe: "die Sprossachse",
    job: tx("Carries water up to the leaves", "Leitet Wasser zu den Blättern"),
    wrongJob: [
      { text: tx("Lets carbon dioxide into the plant", "Lässt Kohlenstoffdioxid in die Pflanze"), title: tx("That's the stomata", "Das machen Spaltöffnungen"), say: tx("Carbon dioxide gets in through the stomata on the leaves. The stem transports water.", "Kohlenstoffdioxid gelangt durch die Spaltöffnungen der Blätter hinein. Die Sprossachse transportiert Wasser.") },
      { text: tx("Catches most of the light", "Fängt das meiste Licht ein"), title: tx("That's the leaves' job", "Das machen die Blätter"), say: tx("The broad green leaves catch most of the light. The stem holds them up and carries water.", "Die breiten grünen Blätter fangen das meiste Licht ein. Die Sprossachse trägt sie und leitet Wasser.") },
      { text: tx("Takes up water from the soil", "Nimmt Wasser aus dem Boden auf"), title: tx("That's the roots", "Das machen die Wurzeln"), say: tx("The roots take up the water. The stem carries it on, up to the leaves.", "Die Wurzeln nehmen das Wasser auf. Die Sprossachse leitet es weiter nach oben zu den Blättern.") },
    ],
  },
  stoma: {
    name: tx("Stoma", "Spaltöffnung"),
    theDe: "eine Spaltöffnung",
    job: tx("Lets carbon dioxide in and oxygen out", "Lässt Kohlenstoffdioxid hinein und Sauerstoff hinaus"),
    wrongJob: [
      { text: tx("Takes up water from the soil", "Nimmt Wasser aus dem Boden auf"), title: tx("That's the roots", "Das machen die Wurzeln"), say: tx("Water comes in through the roots. The stomata are the leaf's doors for gases.", "Wasser kommt über die Wurzeln. Die Spaltöffnungen sind die Türen des Blattes für Gase.") },
      { text: tx("Stores starch", "Speichert Stärke"), title: tx("It's an opening", "Es ist eine Öffnung"), say: tx("A stoma is a tiny opening between two cells. Gases pass through it.", "Eine Spaltöffnung ist eine winzige Öffnung zwischen zwei Zellen. Gase strömen hindurch.") },
      { text: tx("Lets oxygen in and carbon dioxide out", "Lässt Sauerstoff hinein und Kohlenstoffdioxid hinaus"), title: tx("The other way round", "Andersherum"), say: tx("For photosynthesis it's the other way round: carbon dioxide goes in, oxygen comes out.", "Bei der Fotosynthese ist es andersherum: Kohlenstoffdioxid geht hinein, Sauerstoff kommt heraus.") },
    ],
  },
  chloro: {
    name: tx("Chloroplasts", "Chloroplasten"),
    theDe: "die Chloroplasten",
    job: tx("Catch light with their chlorophyll", "Fangen mit ihrem Chlorophyll Licht ein"),
    wrongJob: [
      { text: tx("Take up water from the soil", "Nehmen Wasser aus dem Boden auf"), title: tx("That's the roots", "Das machen die Wurzeln"), say: tx("The green grains are inside leaf cells. They catch light, the roots take up water.", "Die grünen Körnchen sitzen in den Blattzellen. Sie fangen Licht ein, Wasser nehmen die Wurzeln auf.") },
      { text: tx("Let gases in and out of the leaf", "Lassen Gase ins Blatt und hinaus"), title: tx("That's the stomata", "Das machen die Spaltöffnungen"), say: tx("Gases pass through the stomata. The green grains inside the cells are where the sugar is made.", "Gase strömen durch die Spaltöffnungen. In den grünen Körnchen in den Zellen entsteht der Zucker.") },
      { text: tx("Store the light for the night", "Speichern das Licht für die Nacht"), title: tx("Light can't be stored", "Licht lässt sich nicht lagern"), say: tx("Light is energy, not a substance, and can't be stored. The energy is stored in sugar and starch.", "Licht ist Energie, kein Stoff, und lässt sich nicht lagern. Gespeichert wird die Energie in Zucker und Stärke.") },
    ],
  },
};
const PART_IDS = Object.keys(PART_JOB);

function partTask(rng: Rng): Exercise {
  const id = rng.pick(PART_IDS);
  const P = PART_JOB[id];
  const others = PART_IDS.filter((x) => x !== id);
  const askName = rng.chance(0.5);
  const built = askName
    ? choice(rng, [
        { text: P.name },
        ...some(rng, others, 3).map((o) => ({
          text: PART_JOB[o].name,
          title: tx("Another part", "Ein anderer Teil"),
          say: tx(`${en(PART_JOB[o].name)}: ${en(PART_JOB[o].job).toLowerCase()}. That's somewhere else. Look again where the **?** points.`, `${de(PART_JOB[o].name)}: ${de(PART_JOB[o].job)}. Das ist woanders. Schau noch mal, worauf das **?** zeigt.`),
        })),
      ])
    : choice(rng, [{ text: P.job }, ...P.wrongJob]);
  return {
    instruction: askName ? tx("Name the part", "Benenne den Teil") : tx("What does it do?", "Welche Aufgabe hat es?"),
    text: askName ? tx("What is the part marked with **?** called?", "Wie heißt der mit **?** markierte Teil?") : tx("What is the job of the part marked with **?** in photosynthesis?", "Welche Aufgabe hat der mit **?** markierte Teil bei der Fotosynthese?"),
    visual: visual(PhotoPlant, { mode: "numbers", ask: id, legend: "none" }),
    answer: built.answer,
    hint: tx("Water comes from below, gases through the leaf, light from above.", "Wasser kommt von unten, Gase durch das Blatt, Licht von oben."),
    solution: [{ math: q(P.name, "n"), note: tx(`It's the **${en(P.name).toLowerCase()}**. ${en(P.job)}.`, `Das ist ${P.theDe.split(" ")[0]} **${de(P.name)}**. ${de(P.job)}.`), highlight: ["n"] }],
    mistakes: built.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  const r = rng.int(0, 21);
  if (r < 2) return sourceTask(rng);
  if (r < 4) return gapTask(rng);
  if (r < 6) return needsTask(rng);
  if (r < 7) return madeTask(rng);
  if (r < 10) return starchTask(rng);
  if (r < 12) return orderTask(rng);
  if (r < 14) return whyTask(rng);
  if (r < 16) return termTask(rng);
  if (r < 18) return statementTask(rng);
  if (r < 19) return chainTask(rng);
  if (r < 20) return energyTask(rng);
  return partTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const helmont: Frame[] = [
  {
    math: tx('"willow:"#a \\; 2,3 "kg"#m1', '"Weide:"#a \\; 2,3 "kg"#m1'),
    note: tx("He planted a small willow (2.3 kg) in a pot with 90 kg of dried soil. For five years he gave it nothing but water.", "Er pflanzte eine kleine Weide (2,3 kg) in einen Topf mit 90 kg getrockneter Erde. Fünf Jahre lang gab er ihr nur Wasser."),
  },
  {
    math: tx('"willow:"#a \\; 2,3 "kg"#m1 \\to#ar 76,7 "kg"#m2', '"Weide:"#a \\; 2,3 "kg"#m1 \\to#ar 76,7 "kg"#m2'),
    note: tx("After five years the willow weighed 76.7 kg. It had gained more than 74 kg!", "Nach fünf Jahren wog die Weide 76,7 kg. Sie hatte über 74 kg zugenommen!"),
    highlight: ["m2"],
  },
  {
    math: tx('"willow:"#a \\; 2,3 "kg"#m1 \\to#ar 76,7 "kg"#m2 \\\\ "soil:"#b \\; "only" -57 "g"#e', '"Weide:"#a \\; 2,3 "kg"#m1 \\to#ar 76,7 "kg"#m2 \\\\ "Erde:"#b \\; "nur" -57 "g"#e'),
    note: tx("And the soil? It had lost only about 57 g. So the plant's mass can't come from the soil.", "Und die Erde? Sie hatte nur etwa 57 g verloren. Die Masse der Pflanze kann also nicht aus der Erde stammen."),
    highlight: ["e"],
  },
  {
    math: tx('"water"#w + "carbon dioxide"#c \\to#ar "plant"#p', '"Wasser"#w + "Kohlenstoffdioxid"#c \\to#ar "Pflanze"#p'),
    note: tx("Today we know: a plant builds itself mainly from water and from carbon dioxide in the air, with the help of light. This is **photosynthesis**.", "Heute wissen wir: Eine Pflanze baut sich vor allem aus Wasser und aus Kohlenstoffdioxid aus der Luft auf, mit Hilfe von Licht. Das ist die **Fotosynthese**."),
  },
];

const equation: Frame[] = [
  { math: tx('"water"#w', '"Wasser"#w'), note: tx("**Water** comes from the soil. The roots take it up and it rises through the stem into the leaves.", "**Wasser** kommt aus dem Boden. Die Wurzeln nehmen es auf, durch die Sprossachse steigt es in die Blätter.") },
  {
    math: tx('"water"#w + "carbon dioxide"#c', '"Wasser"#w + "Kohlenstoffdioxid"#c'),
    note: tx("**Carbon dioxide** is a gas in the air. It gets into the leaf through tiny openings, the **stomata**, mostly on the underside.", "**Kohlenstoffdioxid** ist ein Gas in der Luft. Es gelangt durch winzige Öffnungen ins Blatt, die **Spaltöffnungen**, meist an der Blattunterseite."),
  },
  {
    math: tx('"water"#w + "carbon dioxide"#c \\\\ \\to#ar \\\\ "glucose"#z + "oxygen"#o', '"Wasser"#w + "Kohlenstoffdioxid"#c \\\\ \\to#ar \\\\ "Traubenzucker"#z + "Sauerstoff"#o'),
    note: tx("Out come **glucose** (a sugar, the plant's food) and **oxygen**, which leaves through the stomata.", "Heraus kommen **Traubenzucker** (ein Zucker, die Nahrung der Pflanze) und **Sauerstoff**, der durch die Spaltöffnungen entweicht."),
    highlight: ["z", "o"],
  },
  {
    math: tx(
      '"water"#w + "carbon dioxide"#c \\\\ \\to#ar \\; \\blob{"light, chlorophyll"#l} \\\\ "glucose"#z + "oxygen"#o',
      '"Wasser"#w + "Kohlenstoffdioxid"#c \\\\ \\to#ar \\; \\blob{"Licht, Chlorophyll"#l} \\\\ "Traubenzucker"#z + "Sauerstoff"#o',
    ),
    note: tx(
      "**Light** delivers the energy and **chlorophyll** catches it. They are written at the arrow: light is energy, not a substance, and chlorophyll isn't used up.",
      "**Licht** liefert die Energie, **Chlorophyll** fängt sie ein. Beides steht am Pfeil: Licht ist Energie, kein Stoff, und Chlorophyll wird nicht verbraucht.",
    ),
    highlight: ["l"],
  },
];

const starchFrames: Frame[] = [
  { math: tx('"glucose"#z', '"Traubenzucker"#z'), note: tx("The leaf makes **glucose**. The plant uses it for energy and as material for growing.", "Das Blatt stellt **Traubenzucker** her. Die Pflanze nutzt ihn als Energie und als Baustoff zum Wachsen.") },
  {
    math: tx('"glucose"#z + "glucose"#z2 + "…"#d \\to#ar "starch"#s', '"Traubenzucker"#z + "Traubenzucker"#z2 + "…"#d \\to#ar "Stärke"#s'),
    note: tx("What isn't needed right away is linked into long chains: **starch**. Starch doesn't dissolve in water, so it's perfect for storage.", "Was nicht sofort gebraucht wird, verknüpft die Pflanze zu langen Ketten: **Stärke**. Stärke löst sich nicht in Wasser und eignet sich deshalb gut zum Speichern."),
  },
  {
    math: tx('"starch"#s : \\; "leaf, potato, grain"#x', '"Stärke"#s : \\; "Blatt, Kartoffel, Getreide"#x'),
    note: tx("Starch is stored in the leaves, but also in potato tubers and in grains of wheat or rice. That's why they're such good food for us.", "Stärke lagert in den Blättern, aber auch in Kartoffelknollen und in Getreidekörnern. Darum sind sie so gute Nahrung für uns."),
  },
  {
    math: tx('"starch"#s + "iodine solution"#i \\to#ar \\blob{"blue-black"#b}', '"Stärke"#s + "Iodlösung"#i \\to#ar \\blob{"blau-schwarz"#b}'),
    note: tx("The test for starch: **iodine solution** (yellow-brown) turns **blue-black** with starch. So starch in a leaf proves that it did photosynthesis.", "Der Nachweis für Stärke: **Iodlösung** (gelb-braun) färbt sich mit Stärke **blau-schwarz**. Stärke im Blatt beweist also, dass es Fotosynthese betrieben hat."),
    highlight: ["b"],
  },
];

const importance: Frame[] = [
  { math: tx('"oxygen"#o \\to#a "breathing"#b', '"Sauerstoff"#o \\to#a "Atmung"#b'), note: tx("The **oxygen** that humans and animals breathe comes from photosynthesis: from plants on land and from algae in the sea.", "Der **Sauerstoff**, den Menschen und Tiere atmen, stammt aus der Fotosynthese: von Pflanzen an Land und von Algen im Meer.") },
  {
    math: tx('"sun"#s \\to "grass"#g \\to "cow"#k \\to "human"#m', '"Sonne"#s \\to "Gras"#g \\to "Kuh"#k \\to "Mensch"#m'),
    note: tx("Every food chain starts with plants: they are the **producers**. Animals eat plants or animals that ate plants. The energy in every bite once came from the sun.", "Jede Nahrungskette beginnt mit Pflanzen: Sie sind die **Produzenten** (Erzeuger). Tiere fressen Pflanzen oder Tiere, die Pflanzen gefressen haben. Die Energie in jedem Bissen kam einmal von der Sonne."),
    highlight: ["g"],
  },
  {
    math: tx('"plant:"#p \\; "day"#d "and"#u "night"#n \\; "respiration"#r', '"Pflanze:"#p \\; "Tag"#d "und"#u "Nacht"#n \\; "Atmung"#r'),
    note: tx("Careful: plants are living things, so they **respire** too, day and night, and use oxygen. But in the light they make far more oxygen than they use.", "Vorsicht: Pflanzen sind Lebewesen, sie **atmen** also auch, Tag und Nacht, und verbrauchen Sauerstoff. Im Licht stellen sie aber viel mehr Sauerstoff her, als sie verbrauchen."),
  },
];

const checkNeeds = needsTask(createRng(11), { right: NEEDS.slice(0, 3), wrong: [NOT_NEEDED[0], NOT_NEEDED[1]] });
const checkStarch = starchTask(createRng(5), { stencil: "strip", variegated: false, order: ["covered", "lit"], stage: "foil" });
const checkChain = chainTask(createRng(2), CHAINS[0]);
const checkTerm = termTask(createRng(1), TERMS[0]);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("What does a plant live on?", "Wovon lebt eine Pflanze?"),
      blob: tx("Plants never eat, yet they grow huge. What's their secret?", "Pflanzen fressen nie und werden trotzdem riesig. Was ist ihr Geheimnis?"),
      body: tx(
        "Humans and animals have to eat. Plants don't: they **make their food themselves**. Around 1640 the doctor Jan Baptist van Helmont tested where a tree's mass comes from.",
        "Menschen und Tiere müssen essen. Pflanzen nicht: Sie **stellen ihre Nahrung selbst her**. Um 1640 hat der Arzt Jan Baptist van Helmont getestet, woher die Masse eines Baumes kommt.",
      ),
      frames: helmont,
    },
    {
      type: "widget",
      title: tx("The leaf factory", "Die Blattfabrik"),
      blob: tx("Switch things off and find out what the factory really needs!", "Schalte Dinge aus und finde heraus, was die Fabrik wirklich braucht!"),
      body: tx(
        "The leaf is the plant's food factory. Water comes up from the roots, carbon dioxide comes from the air, and light delivers the energy. The green pigment **chlorophyll** in the **chloroplasts** catches the light.",
        "Das Blatt ist die Nahrungsfabrik der Pflanze. Wasser kommt von den Wurzeln, Kohlenstoffdioxid aus der Luft, und das Licht liefert die Energie. Der grüne Farbstoff **Chlorophyll** in den **Chloroplasten** fängt das Licht ein.",
      ),
      widget: PhotoFactory,
    },
    {
      type: "explain",
      title: tx("The word equation", "Die Wortgleichung"),
      blob: tx("Let's write the factory down like a recipe.", "Schreiben wir die Fabrik auf wie ein Rezept."),
      frames: equation,
    },
    { type: "check", blob: tx("What goes into the factory? Pick carefully!", "Was geht in die Fabrik hinein? Wähl genau aus!"), exercise: checkNeeds },
    {
      type: "explain",
      title: tx("Sugar becomes starch", "Aus Zucker wird Stärke"),
      blob: tx("Sugar dissolves easily. So the plant packs it up!", "Zucker löst sich leicht. Also packt die Pflanze ihn ein!"),
      frames: starchFrames,
    },
    {
      type: "widget",
      title: tx("The starch test", "Der Stärkenachweis"),
      blob: tx("A real experiment! Watch which parts turn dark.", "Ein echter Versuch! Schau, welche Teile dunkel werden."),
      body: tx(
        "Is starch really only made in the light? We test it on a leaf that is partly covered with foil. Try a leaf with a white edge too.",
        "Entsteht Stärke wirklich nur im Licht? Wir testen es an einem Blatt, das teilweise mit Folie abgedeckt ist. Probier auch ein Blatt mit weißem Rand.",
      ),
      widget: PhotoStarchTest,
    },
    { type: "check", blob: tx("Now predict it yourself!", "Jetzt sag es selbst voraus!"), exercise: checkStarch },
    {
      type: "explain",
      title: tx("Important for all living things", "Wichtig für alle Lebewesen"),
      blob: tx("Every breath and every bite: thank a plant!", "Jeder Atemzug und jeder Bissen: Danke, Pflanze!"),
      frames: importance,
    },
    { type: "check", blob: tx("Where does the energy go? Follow it!", "Wohin fließt die Energie? Folge ihr!"), exercise: checkChain },
    { type: "check", blob: tx("Last one: the famous green word.", "Zum Schluss: das berühmte grüne Wort."), exercise: checkTerm },
  ],
  summary: [
    {
      title: tx("Photosynthesis", "Fotosynthese"),
      body: tx(
        "In their green leaves plants make glucose from water and carbon dioxide. Light delivers the energy, chlorophyll catches it. Oxygen is released.",
        "In ihren grünen Blättern stellen Pflanzen aus Wasser und Kohlenstoffdioxid Traubenzucker her. Licht liefert die Energie, Chlorophyll fängt sie ein. Sauerstoff wird frei.",
      ),
      examples: [tx('"water" + "carbon dioxide" \\\\ \\to "glucose" + "oxygen"', '"Wasser" + "Kohlenstoffdioxid" \\\\ \\to "Traubenzucker" + "Sauerstoff"')],
      tone: "rule",
    },
    {
      title: tx("Where from, where to?", "Woher, wohin?"),
      body: tx(
        "Water: from the soil via roots and stem. Carbon dioxide: from the air through the stomata. Light: from the sun. Oxygen: out through the stomata. Glucose: used or stored as starch.",
        "Wasser: aus dem Boden über Wurzeln und Sprossachse. Kohlenstoffdioxid: aus der Luft durch die Spaltöffnungen. Licht: von der Sonne. Sauerstoff: hinaus durch die Spaltöffnungen. Traubenzucker: wird genutzt oder als Stärke gespeichert.",
      ),
      tone: "rule",
    },
    {
      title: tx("The starch test", "Der Stärkenachweis"),
      body: tx(
        "Dark for 2 days, cover part of a leaf, light, boil, decolourise in hot alcohol, iodine. Only lit green parts turn blue-black.",
        "2 Tage dunkel, Blattteil abdecken, belichten, abkochen, in heißem Alkohol entfärben, Iod. Nur belichtete grüne Teile werden blau-schwarz.",
      ),
      examples: [tx('"starch" + "iodine" \\to "blue-black"', '"Stärke" + "Iod" \\to "blau-schwarz"')],
      tone: "tip",
    },
    {
      title: tx("Why it matters", "Warum das wichtig ist"),
      body: tx(
        "Photosynthesis gives us the oxygen we breathe and the food we eat. Plants are the producers at the start of every food chain.",
        "Die Fotosynthese liefert den Sauerstoff zum Atmen und unsere Nahrung. Pflanzen sind die Produzenten am Anfang jeder Nahrungskette.",
      ),
      examples: [tx('"sun" \\to "grass" \\to "cow" \\to "human"', '"Sonne" \\to "Gras" \\to "Kuh" \\to "Mensch"')],
      tone: "rule",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Plants don't take food from the soil (only water and minerals). Photosynthesis happens in green leaves, not in roots. Light is energy, not a substance. Plants respire too, day and night.",
        "Pflanzen nehmen keine Nahrung aus dem Boden auf (nur Wasser und Mineralstoffe). Fotosynthese findet in grünen Blättern statt, nicht in Wurzeln. Licht ist Energie, kein Stoff. Pflanzen atmen auch, Tag und Nacht.",
      ),
      tone: "warning",
    },
  ],
};
