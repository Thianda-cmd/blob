"use client";

// Level 2 (Fortgeschritten, Klasse 7–10): the balanced equation, chloroplasts in the palisade
// tissue, photosynthesis as an energy conversion, limiting factors (light, CO2, temperature) and
// how to read their graphs, the Elodea experiment, cellular respiration as the opposite process
// and the compensation point.

import { tx, type Text } from "@/i18n/text";
import { decText } from "@/learn/chemistry/format";
import { PhotoDayNight } from "@/learn/biology/visuals/PhotoDayNight";
import { PhotoElodea } from "@/learn/biology/visuals/PhotoElodea";
import { LEAF_SECTION_PARTS, PhotoLeafSection, PhotoLeafSectionExplore } from "@/learn/biology/visuals/PhotoLeafSection";
import { PhotoLimitingLab, PhotoNetGraph, PhotoRateGraph, type Factor, type RateCurve } from "@/learn/biology/visuals/PhotoRate";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { cap, choice, de, en, mistakes, q, reasonFrames, some, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// 1. Balancing the equations

const PHOTO_EQ = "CO2 + H2O -> C6H12O6 + O2";
const RESP_EQ = "C6H12O6 + O2 -> CO2 + H2O";

function balanceTask(resp: boolean): Exercise {
  const answer: AnswerSpec = resp ? { kind: "balance", equation: RESP_EQ, coefficients: [1, 6, 6, 6] } : { kind: "balance", equation: PHOTO_EQ, coefficients: [6, 6, 1, 6] };
  const eq = resp ? RESP_EQ : PHOTO_EQ;
  const m = mistakes(answer);
  const c = (list: number[]): AnswerSpec => ({ kind: "balance", equation: eq, coefficients: list });
  if (resp) {
    m.add(c([1, 9, 6, 6]), tx("Glucose has oxygen too", "Glucose enthält auch Sauerstoff"), tx("You balanced the oxygen as if glucose had none. $\\ce{C6H12O6}$ brings 6 O atoms itself, so fewer $\\ce{O2}$ are needed.", "Du hast den Sauerstoff so ausgeglichen, als hätte Glucose keinen. $\\ce{C6H12O6}$ bringt selbst 6 O-Atome mit, also braucht es weniger $\\ce{O2}$."));
    m.add(c([1, 12, 6, 6]), tx("Atoms vs molecules", "Atome oder Moleküle?"), tx("12 is the number of O **atoms** you still need. But each $\\ce{O2}$ molecule brings two of them.", "12 ist die Zahl der O-**Atome**, die noch fehlen. Jedes $\\ce{O2}$-Molekül bringt aber gleich zwei mit."));
    m.add(c([1, 1, 6, 6]), tx("Oxygen not balanced", "Sauerstoff nicht ausgeglichen"), tx("Carbon and hydrogen fit, nice! Now count the O atoms on both sides: right $6 \\cdot 2 + 6 = 18$.", "Kohlenstoff und Wasserstoff passen, stark! Zähl jetzt die O-Atome auf beiden Seiten: rechts $6 \\cdot 2 + 6 = 18$."));
  } else {
    m.add(c([6, 6, 1, 9]), tx("Glucose has oxygen too", "Glucose enthält auch Sauerstoff"), tx("Left there are 18 O atoms. But glucose keeps 6 of them, so only 12 are left for $\\ce{O2}$.", "Links sind 18 O-Atome. Davon stecken aber 6 in der Glucose, für $\\ce{O2}$ bleiben nur 12."));
    m.add(c([6, 6, 1, 12]), tx("Atoms vs molecules", "Atome oder Moleküle?"), tx("12 O **atoms** are left for oxygen, right. But each $\\ce{O2}$ molecule holds two of them.", "Für den Sauerstoff bleiben 12 O-**Atome**, richtig. Jedes $\\ce{O2}$-Molekül enthält aber gleich zwei davon."));
    m.add(c([6, 6, 1, 1]), tx("Oxygen not balanced", "Sauerstoff nicht ausgeglichen"), tx("Carbon and hydrogen fit, nice! Now count the O atoms: left $6 \\cdot 2 + 6 = 18$.", "Kohlenstoff und Wasserstoff passen, stark! Zähl jetzt die O-Atome: links $6 \\cdot 2 + 6 = 18$."));
    m.add(c([6, 12, 1, 6]), tx("Too much water", "Zu viel Wasser"), tx("Glucose has 12 H atoms, and each $\\ce{H2O}$ brings 2. So 6 water molecules are enough.", "Glucose hat 12 H-Atome, jedes $\\ce{H2O}$ bringt 2 mit. Also reichen 6 Wassermoleküle."));
  }
  return {
    instruction: tx("Balance the equation", "Gleiche die Reaktionsgleichung aus"),
    text: resp
      ? tx("Cellular respiration: glucose reacts with oxygen to form carbon dioxide and water.", "Zellatmung: Glucose reagiert mit Sauerstoff zu Kohlenstoffdioxid und Wasser.")
      : tx("Photosynthesis: carbon dioxide and water react to form glucose and oxygen.", "Fotosynthese: Kohlenstoffdioxid und Wasser reagieren zu Glucose und Sauerstoff."),
    answer,
    hint: resp
      ? tx("Start with carbon (6 in glucose), then hydrogen, oxygen last.", "Fang mit dem Kohlenstoff an (6 in der Glucose), dann Wasserstoff, Sauerstoff zum Schluss.")
      : tx("Glucose has 6 C and 12 H. Balance C and H first, oxygen last.", "Glucose hat 6 C und 12 H. Gleiche erst C und H aus, Sauerstoff zum Schluss."),
    solution: resp
      ? [
          { math: "\\ce{C6H12O6 + O2 -> 6CO2 + 6H2O}", note: tx("6 C in glucose need 6 $\\ce{CO2}$; 12 H need 6 $\\ce{H2O}$.", "6 C in der Glucose brauchen 6 $\\ce{CO2}$, 12 H brauchen 6 $\\ce{H2O}$.") },
          { math: "\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O}", note: tx("Right: $6 \\cdot 2 + 6 = 18$ O. Glucose brings 6, so 12 O atoms are missing: 6 $\\ce{O2}$.", "Rechts: $6 \\cdot 2 + 6 = 18$ O. Glucose bringt 6 mit, es fehlen 12 O-Atome: 6 $\\ce{O2}$.") },
        ]
      : [
          { math: "\\ce{6CO2 + 6H2O -> C6H12O6 + O2}", note: tx("Glucose has 6 C (so 6 $\\ce{CO2}$) and 12 H (so 6 $\\ce{H2O}$).", "Glucose hat 6 C (also 6 $\\ce{CO2}$) und 12 H (also 6 $\\ce{H2O}$).") },
          { math: "\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}", note: tx("Left: $6 \\cdot 2 + 6 = 18$ O. Glucose keeps 6, 12 are left: 6 $\\ce{O2}$.", "Links: $6 \\cdot 2 + 6 = 18$ O. Die Glucose behält 6, 12 bleiben übrig: 6 $\\ce{O2}$.") },
        ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 2. How many molecules? (scaling the equation)

type Species = "co2" | "h2o" | "o2" | "glucose";
const NAME: Record<Species, Text> = {
  co2: tx("carbon dioxide", "Kohlenstoffdioxid"),
  h2o: tx("water", "Wasser"),
  o2: tx("oxygen", "Sauerstoff"),
  glucose: tx("glucose", "Glucose"),
};
const FORMULA: Record<Species, string> = { co2: "CO2", h2o: "H2O", o2: "O2", glucose: "C6H12O6" };

function countTask(rng: Rng): Exercise {
  const resp = rng.chance(0.3);
  const fromGlucose = rng.chance(0.6);
  let given: Species;
  let asked: Species;
  let n: number;
  let value: number;
  if (fromGlucose) {
    given = "glucose";
    asked = rng.pick<Species>(["co2", "h2o", "o2"]);
    n = rng.int(2, 12);
    value = 6 * n;
  } else {
    given = rng.pick<Species>(["co2", "h2o", "o2"]);
    asked = rng.chance(0.6) ? "glucose" : rng.pick<Species>(["co2", "h2o", "o2"].filter((s) => s !== given) as Species[]);
    n = 6 * rng.int(2, 10);
    value = asked === "glucose" ? n / 6 : n;
  }
  const verbIn = (s: Species) => (resp ? s === "glucose" || s === "o2" : s === "co2" || s === "h2o");
  const proc = resp ? tx("cellular respiration", "Zellatmung") : tx("photosynthesis", "Fotosynthese");
  const role = (s: Species, l: "en" | "de") => (verbIn(s) ? (l === "en" ? "used" : "verbraucht") : l === "en" ? "made" : "gebildet");
  const answer: AnswerSpec = { kind: "number", value, unit: tx("molecules", "Moleküle") };
  const m = mistakes(answer);
  if (fromGlucose) {
    m.add({ kind: "number", value: n }, tx("Factor 6 missing", "Faktor 6 fehlt"), tx(`Per glucose molecule it's **6** molecules of ${en(NAME[asked])}. So ${n} glucose need ${n} times 6.`, `Pro Glucose-Molekül sind es **6** Moleküle ${de(NAME[asked])}. Bei ${n} Glucose also ${n}-mal 6.`));
    m.add({ kind: "number", value: 12 * n }, tx("Atoms, not molecules", "Atome statt Moleküle"), tx("You counted atoms (12 H or 12 O). The coefficient in the equation counts **molecules**: 6 per glucose.", "Du hast Atome gezählt (12 H oder 12 O). Die Zahl vor der Formel zählt **Moleküle**: 6 pro Glucose."));
    m.add({ kind: "number", value: 6 }, tx("For one glucose only", "Nur für eine Glucose"), tx(`6 is right for **one** glucose molecule. Here there are ${n}.`, `6 gilt für **ein** Glucose-Molekül. Hier sind es ${n}.`));
  } else if (asked === "glucose") {
    m.add({ kind: "number", value: n * 6 }, tx("Multiplied instead of divided", "Mal statt geteilt"), tx("It takes **6** molecules per glucose. So you divide by 6.", "Für **ein** Glucose-Molekül braucht man 6 Moleküle. Also musst du durch 6 teilen."));
    m.add({ kind: "number", value: n }, tx("Not one to one", "Nicht eins zu eins"), tx("The ratio isn't 1 : 1. Look at the coefficients: 6 to 1.", "Das Verhältnis ist nicht 1 : 1. Schau auf die Koeffizienten: 6 zu 1."));
  } else {
    m.add({ kind: "number", value: n / 6 }, tx("Divided by mistake", "Versehentlich geteilt"), tx(`${cap(en(NAME[given]))} and ${en(NAME[asked])} both have the coefficient 6: the ratio is 1 : 1.`, `${de(NAME[given])} und ${de(NAME[asked])} haben beide den Koeffizienten 6: Das Verhältnis ist 1 : 1.`));
    m.add({ kind: "number", value: n * 6 }, tx("Multiplied by mistake", "Versehentlich multipliziert"), tx("Both have the coefficient 6, so the numbers are equal.", "Beide haben den Koeffizienten 6, die Zahlen sind also gleich."));
  }
  const eqMath = resp ? "\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O}" : "\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}";
  return {
    instruction: tx("Use the equation", "Rechne mit der Gleichung"),
    text: tx(
      `In ${en(proc)}, ${n} molecules of ${en(NAME[given])} are ${role(given, "en")}. How many molecules of ${en(NAME[asked])} are ${role(asked, "en")}?`,
      `Bei der ${de(proc)} werden ${n} Moleküle ${de(NAME[given])} ${role(given, "de")}. Wie viele Moleküle ${de(NAME[asked])} werden dabei ${role(asked, "de")}?`,
    ),
    math: eqMath,
    answer,
    hint: tx("Compare the two coefficients in the equation.", "Vergleiche die beiden Koeffizienten in der Gleichung."),
    solution: [
      { math: eqMath, note: tx(`Ratio ${en(NAME[given])} : ${en(NAME[asked])} = ${given === "glucose" ? 1 : 6} : ${asked === "glucose" ? 1 : 6}.`, `Verhältnis ${de(NAME[given])} : ${de(NAME[asked])} = ${given === "glucose" ? 1 : 6} : ${asked === "glucose" ? 1 : 6}.`) },
      { math: `${n} \\ce{${FORMULA[given]}} \\to \\blob{${value}#v} \\ce{${FORMULA[asked]}}`, note: tx(`So **${value}** molecules of ${en(NAME[asked])}.`, `Also **${value}** Moleküle ${de(NAME[asked])}.`), highlight: ["v"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 3. Limiting factors in a graph

const FACTOR: Record<Factor | "water", Text> = {
  light: tx("Light intensity", "Lichtintensität"),
  co2: tx("CO₂ concentration", "CO₂-Konzentration"),
  temp: tx("Temperature", "Temperatur"),
  water: tx("Water supply", "Wasserversorgung"),
};

function graphTask(rng: Rng, fixed?: { diff: "co2" | "temp"; at: "A" | "B"; swap: boolean }): Exercise {
  const diff = fixed?.diff ?? rng.pick<"co2" | "temp">(["co2", "temp"]);
  const curves: RateCurve[] =
    diff === "co2"
      ? (() => {
          const hi = rng.pick([0.1, 0.12, 0.15]);
          return [
            { co2: hi, temp: 30, label: tx(`${en(decText(hi))} % CO₂`, `${de(decText(hi))} % CO₂`) },
            { co2: 0.04, temp: 30, label: tx(`${en(decText(0.04))} % CO₂`, `${de(decText(0.04))} % CO₂`) },
          ];
        })()
      : (() => {
          const lo = rng.pick([15, 20]);
          return [
            { co2: 0.15, temp: 30, label: "30 °C" },
            { co2: 0.15, temp: lo, label: `${lo} °C` },
          ];
        })();
  const lowA = rng.int(6, 10);
  const highB = rng.int(80, 95);
  const swap = fixed?.swap ?? rng.chance(0.5);
  const nameA = swap ? "B" : "A";
  const nameB = swap ? "A" : "B";
  const at = fixed?.at ?? rng.pick<"A" | "B">(["A", "B"]);
  const askRising = (at === "A") !== swap;
  const asked = askRising ? nameA : nameB;
  const rightF: Factor = askRising ? "light" : diff;
  const same = diff === "co2" ? tx(`both at ${curves[0].temp} °C`, `beide bei ${curves[0].temp} °C`) : tx(`both at ${en(decText(0.15))} % CO₂`, `beide bei ${de(decText(0.15))} % CO₂`);
  const opts: Opt[] = [{ text: FACTOR[rightF] }];
  const others = (["light", "co2", "temp"] as Factor[]).filter((f) => f !== rightF);
  for (const f of others) {
    let say: Text;
    let title: Text;
    if (f === "light") {
      title = tx("The curve is flat here", "Die Kurve ist hier flach");
      say = tx(`At ${asked} the curve has levelled off: more light doesn't raise the rate any more. Which curve lies higher, and why?`, `Bei ${asked} ist die Kurve abgeflacht: Mehr Licht steigert die Rate nicht mehr. Welche Kurve liegt höher, und warum?`);
    } else if (askRising) {
      title = tx("Still rising", "Die Kurve steigt noch");
      say = tx(`At ${asked} both curves still lie on top of each other and rise with the light. ${en(FACTOR[f])} makes no difference yet.`, `Bei ${asked} liegen beide Kurven noch übereinander und steigen mit dem Licht. ${de(FACTOR[f])} macht hier noch keinen Unterschied.`);
    } else {
      title = tx("Check what differs", "Prüf, was sich unterscheidet");
      say = tx(`The two curves are ${en(same)}. ${en(FACTOR[f])} can't be what makes the difference.`, `Die beiden Kurven sind ${de(same)}. ${de(FACTOR[f])} kann den Unterschied also nicht machen.`);
    }
    opts.push({ text: FACTOR[f], title, say });
  }
  opts.push({ text: FACTOR.water, title: tx("Not shown here", "Hier nicht untersucht"), say: tx("Water isn't changed in this experiment. Look at what differs between the curves and where the curve is flat.", "Wasser wird in diesem Versuch nicht verändert. Schau, was sich zwischen den Kurven unterscheidet und wo die Kurve flach ist.") });
  const { answer, mistakes: list } = choice(rng, opts);
  const points = [
    { curve: 1, light: lowA, label: nameA },
    { curve: 1, light: highB, label: nameB },
  ];
  return {
    instruction: tx("Read the graph", "Werte das Diagramm aus"),
    text: tx(
      `The graph shows the rate of photosynthesis of a plant against light intensity (${en(same)}). **Which factor limits the rate at point ${asked}?**`,
      `Das Diagramm zeigt die Fotosyntheserate einer Pflanze in Abhängigkeit von der Lichtintensität (${de(same)}). **Welcher Faktor begrenzt die Rate im Punkt ${asked}?**`,
    ),
    visual: visual(PhotoRateGraph, { curves, points }),
    answer,
    hint: tx("Is the curve still rising at this point, or is it flat? And what differs between the two curves?", "Steigt die Kurve an dieser Stelle noch, oder ist sie flach? Und was unterscheidet die beiden Kurven?"),
    solution: askRising
      ? reasonFrames(
          tx(`${asked}: rising`, `${asked}: ansteigend`),
          tx("Here the curve rises steeply and both curves lie together: more light means more photosynthesis.", "Hier steigt die Kurve steil an, und beide Kurven liegen übereinander: Mehr Licht heißt mehr Fotosynthese."),
          tx("light", "Licht"),
          tx("So **light intensity** is the limiting factor at this point.", "Also ist die **Lichtintensität** hier der begrenzende Faktor."),
        )
      : reasonFrames(
          tx(`${asked}: flat`, `${asked}: flach`),
          tx(`Here more light doesn't help. But the other curve, with more ${diff === "co2" ? "CO₂" : "warmth"}, lies higher.`, `Hier hilft mehr Licht nicht mehr. Die andere Kurve mit ${diff === "co2" ? "mehr CO₂" : "höherer Temperatur"} liegt aber höher.`),
          diff === "co2" ? "CO₂" : tx("temperature", "Temperatur"),
          tx(`So **${en(FACTOR[diff]).toLowerCase()}** is the limiting factor at ${asked}.`, `Also ist die **${de(FACTOR[diff])}** im Punkt ${asked} der begrenzende Faktor.`),
        ),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 4. Limiting factor in a real situation

type Scene = { text: Text; f: Factor };
const SCENES: Scene[] = [
  { f: "co2", text: tx("A greenhouse on a sunny summer day at 25 °C, with normal air (0.04 % CO₂). Even when it gets brighter, the tomatoes don't photosynthesise any faster.", "Ein Gewächshaus an einem sonnigen Sommertag bei 25 °C, mit normaler Luft (0,04 % CO₂). Selbst wenn es heller wird, betreiben die Tomaten nicht schneller Fotosynthese.") },
  { f: "light", text: tx("A winter morning in a greenhouse: it is still twilight, heated to 20 °C, and the air is enriched with CO₂.", "Ein Wintermorgen im Gewächshaus: Es dämmert noch, es ist auf 20 °C geheizt, und die Luft ist mit CO₂ angereichert.") },
  { f: "temp", text: tx("A clear, sunny spring morning with frost: 2 °C, lots of light, normal air.", "Ein klarer, sonniger Frühlingsmorgen mit Frost: 2 °C, viel Licht, normale Luft.") },
  { f: "light", text: tx("A fern on the floor of a dense beech wood in summer. It is warm and the air is normal.", "Ein Farn am Boden eines dichten Buchenwaldes im Sommer. Es ist warm, die Luft ist normal.") },
  { f: "co2", text: tx("Elodea in an aquarium with a bright lamp right next to it and warm water. The water hasn't been changed for weeks and contains hardly any CO₂.", "Wasserpest in einem Aquarium mit einer hellen Lampe direkt daneben und warmem Wasser. Das Wasser wurde wochenlang nicht gewechselt und enthält kaum noch CO₂.") },
  { f: "temp", text: tx("A greenhouse on a heatwave day: 44 °C inside, bright sun, CO₂ added.", "Ein Gewächshaus an einem Hitzetag: drinnen 44 °C, pralle Sonne, CO₂ zugesetzt.") },
  { f: "temp", text: tx("An unheated greenhouse in winter at 6 °C, with strong plant lamps and CO₂ enrichment.", "Ein ungeheiztes Gewächshaus im Winter bei 6 °C, mit starken Pflanzenlampen und CO₂-Begasung.") },
  { f: "light", text: tx("A houseplant at the far end of a dark hallway, at 21 °C room temperature.", "Eine Zimmerpflanze am Ende eines dunklen Flurs bei 21 °C Raumtemperatur.") },
];

const SCENE_SAY: Record<string, [Text, Text]> = {
  "co2>light": [tx("There's light enough", "Licht ist genug da"), tx("It's already bright and getting brighter doesn't help. What is still only at its normal, low level?", "Es ist schon hell, und mehr Licht bringt nichts. Was ist noch auf dem normalen, niedrigen Stand?")],
  "co2>temp": [tx("It's warm enough", "Warm genug"), tx("25 °C suits most plants well. Look for what is in short supply.", "25 °C passen den meisten Pflanzen gut. Such, was knapp ist.")],
  "light>co2": [tx("CO₂ is plentiful", "CO₂ ist reichlich da"), tx("There's plenty of CO₂. What's missing in the twilight or in the shade?", "CO₂ ist reichlich vorhanden. Was fehlt in der Dämmerung oder im Schatten?")],
  "light>temp": [tx("It's warm enough", "Warm genug"), tx("The temperature is fine. What is in short supply where the plant stands?", "Die Temperatur passt. Was ist dort, wo die Pflanze steht, knapp?")],
  "temp>light": [tx("There's light enough", "Licht ist genug da"), tx("There's lots of light here. Think about how fast enzymes work when it's very cold or very hot.", "Licht ist reichlich da. Überleg, wie schnell Enzyme arbeiten, wenn es sehr kalt oder sehr heiß ist.")],
  "temp>co2": [tx("CO₂ is not the problem", "CO₂ ist nicht das Problem"), tx("There is enough CO₂. But at this temperature the enzymes of photosynthesis can't work well.", "CO₂ ist genug da. Aber bei dieser Temperatur können die Enzyme der Fotosynthese nicht gut arbeiten.")],
};

function sceneTask(rng: Rng): Exercise {
  const s = rng.pick(SCENES);
  const { answer, mistakes: list } = choice(rng, [
    { text: FACTOR[s.f] },
    ...(["light", "co2", "temp"] as Factor[]).filter((f) => f !== s.f).map((f) => ({ text: FACTOR[f], title: SCENE_SAY[`${s.f}>${f}`][0], say: SCENE_SAY[`${s.f}>${f}`][1] })),
  ]);
  return {
    instruction: tx("Find the limiting factor", "Finde den begrenzenden Faktor"),
    text: tx(`${en(s.text)} **Which factor limits photosynthesis most?**`, `${de(s.text)} **Welcher Faktor begrenzt die Fotosynthese am stärksten?**`),
    answer,
    hint: tx("Go through light, CO₂ and temperature: which one is far from ideal?", "Geh Licht, CO₂ und Temperatur durch: Was ist weit vom Idealwert entfernt?"),
    solution: reasonFrames(
      FACTOR[s.f],
      tx("The factor in shortest supply sets the rate (minimum factor). Raising the others wouldn't help.", "Der Faktor, der am knappsten ist, bestimmt die Rate (Minimumfaktor). Die anderen zu erhöhen, brächte nichts."),
      tx("limiting", "begrenzend"),
      tx(`**${en(FACTOR[s.f])}** is limiting here.`, `Hier begrenzt die **${de(FACTOR[s.f])}**.`),
    ),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 5. Photosynthesis, respiration or both?

type Which = 0 | 1 | 2 | 3;
const WHICH: Text[] = [tx("Photosynthesis", "Fotosynthese"), tx("Cellular respiration", "Zellatmung"), tx("Both", "Beide"), tx("Neither", "Keine von beiden")];
const FEATURES: { text: Text; w: Which; say?: Partial<Record<Which, Text>> }[] = [
  { text: tx("takes place in the chloroplasts", "findet in den Chloroplasten statt"), w: 0 },
  { text: tx("takes place in the mitochondria", "findet in den Mitochondrien statt"), w: 1, say: { 2: tx("Mitochondria are the power stations of the cell: that's respiration. Photosynthesis happens in chloroplasts.", "Mitochondrien sind die Kraftwerke der Zelle: Dort läuft die Zellatmung. Die Fotosynthese findet in Chloroplasten statt.") } },
  { text: tx("only runs in the light", "läuft nur im Licht ab"), w: 0, say: { 2: tx("Respiration doesn't need light: it runs day and night.", "Die Zellatmung braucht kein Licht: Sie läuft Tag und Nacht.") } },
  {
    text: tx("runs in plant cells at night", "läuft nachts in Pflanzenzellen ab"),
    w: 1,
    say: {
      3: tx("Ah, the myth that plants don't respire! They do, day and night, in their mitochondria. Only photosynthesis stops at night.", "Ah, der Mythos, dass Pflanzen nicht atmen! Sie tun es, Tag und Nacht, in ihren Mitochondrien. Nur die Fotosynthese ruht nachts."),
      0: tx("Without light there's no photosynthesis. What keeps running at night is respiration.", "Ohne Licht keine Fotosynthese. Was nachts weiterläuft, ist die Zellatmung."),
    },
  },
  { text: tx("uses up oxygen", "verbraucht Sauerstoff"), w: 1, say: { 0: tx("Photosynthesis **releases** oxygen. It's used by respiration.", "Die Fotosynthese **setzt** Sauerstoff **frei**. Verbraucht wird er bei der Zellatmung.") } },
  { text: tx("releases oxygen", "setzt Sauerstoff frei"), w: 0, say: { 1: tx("Respiration **uses** oxygen to break down glucose.", "Die Zellatmung **verbraucht** Sauerstoff, um Glucose abzubauen.") } },
  { text: tx("uses up carbon dioxide", "verbraucht Kohlenstoffdioxid"), w: 0, say: { 1: tx("Respiration **releases** CO₂, as when you breathe out.", "Die Zellatmung **setzt** CO₂ **frei**, wie beim Ausatmen.") } },
  { text: tx("releases carbon dioxide", "setzt Kohlenstoffdioxid frei"), w: 1, say: { 0: tx("Photosynthesis **takes in** CO₂ to build sugar.", "Die Fotosynthese **nimmt** CO₂ **auf**, um Zucker aufzubauen.") } },
  { text: tx("builds up glucose", "baut Glucose auf"), w: 0 },
  { text: tx("breaks down glucose and releases usable energy", "baut Glucose ab und setzt nutzbare Energie frei"), w: 1, say: { 0: tx("Photosynthesis stores energy in glucose. Releasing it is the job of respiration.", "Die Fotosynthese speichert Energie in Glucose. Sie freizusetzen ist Aufgabe der Zellatmung.") } },
  {
    text: tx("takes place in the leaf cells of a plant", "findet in den Blattzellen einer Pflanze statt"),
    w: 2,
    say: { 0: tx("Photosynthesis, yes. But leaf cells also respire: they have mitochondria like all plant cells.", "Fotosynthese, ja. Aber Blattzellen atmen auch: Sie haben wie alle Pflanzenzellen Mitochondrien.") },
  },
  { text: tx("takes place in the root cells of a plant", "findet in den Wurzelzellen einer Pflanze statt"), w: 1, say: { 2: tx("Roots are in the dark and have no chloroplasts: no photosynthesis there. But they respire.", "Wurzeln sind im Dunkeln und haben keine Chloroplasten: Dort gibt es keine Fotosynthese. Atmen tun sie aber."), 0: tx("Roots are in the dark and have no chloroplasts. Photosynthesis doesn't happen in roots.", "Wurzeln sind im Dunkeln und haben keine Chloroplasten. In Wurzeln findet keine Fotosynthese statt.") } },
  { text: tx("takes place in the muscle cells of a human", "findet in den Muskelzellen eines Menschen statt"), w: 1 },
  { text: tx("converts energy from one form into another", "wandelt Energie von einer Form in eine andere um"), w: 2 },
  { text: tx("stores light energy as chemical energy", "speichert Lichtenergie als chemische Energie"), w: 0 },
  { text: tx("needs light as a raw material, like water", "braucht Licht als Ausgangsstoff, wie Wasser"), w: 3, say: { 0: tx("Careful: light is energy, not a substance. It isn't a raw material, it drives the reaction.", "Vorsicht: Licht ist Energie, kein Stoff. Es ist kein Ausgangsstoff, es treibt die Reaktion an.") } },
];

function whichTask(rng: Rng): Exercise {
  const f = rng.pick(FEATURES);
  const order = rng.shuffle([0, 1, 2, 3] as Which[]);
  const options = order.map((w) => WHICH[w]);
  const correct = order.indexOf(f.w);
  const list: Mistake[] = [];
  const fallback: Record<Which, Text> = {
    0: tx("Photosynthesis: in chloroplasts, only in light, builds glucose and releases oxygen. Does that fit here?", "Fotosynthese: in Chloroplasten, nur im Licht, baut Glucose auf und setzt Sauerstoff frei. Passt das hier?"),
    1: tx("Respiration: in mitochondria, always, uses glucose and oxygen. Does that fit here?", "Zellatmung: in Mitochondrien, immer, verbraucht Glucose und Sauerstoff. Passt das hier?"),
    2: tx("Both? Check whether the other process really does this too.", "Beide? Prüf, ob der andere Vorgang das wirklich auch tut."),
    3: tx("Neither? At least one of the two processes does exactly this.", "Keiner? Mindestens einer der beiden Vorgänge tut genau das."),
  };
  order.forEach((w, at) => {
    if (w !== f.w) list.push({ when: { kind: "choice", options, correct: at }, title: f.say?.[w] ? tx("Mixed up", "Verwechselt") : tx("Check again", "Prüf noch mal"), say: f.say?.[w] ?? fallback[w] });
  });
  const where = [tx("chloroplasts, light", "Chloroplasten, Licht"), tx("mitochondria, always", "Mitochondrien, immer"), tx("both", "beide"), tx("neither", "keine")];
  return {
    instruction: tx("Photosynthesis or respiration?", "Fotosynthese oder Zellatmung?"),
    text: tx(`Which process **${en(f.text)}**?`, `Welcher Vorgang **${de(f.text)}**?`),
    answer: { kind: "choice", options, correct },
    hint: tx("Photosynthesis: chloroplasts, only in light, builds glucose. Respiration: mitochondria, in every living cell, always, breaks glucose down.", "Fotosynthese: Chloroplasten, nur im Licht, baut Glucose auf. Zellatmung: Mitochondrien, in jeder lebenden Zelle, immer, baut Glucose ab."),
    solution: [
      { math: tx('"photosynthesis:" \\; "chloroplasts, light" \\\\ "respiration:" \\; "mitochondria, always"', '"Fotosynthese:" \\; "Chloroplasten, Licht" \\\\ "Zellatmung:" \\; "Mitochondrien, immer"'), note: tx("Photosynthesis builds glucose up in the light; respiration breaks it down in every living cell, day and night.", "Die Fotosynthese baut im Licht Glucose auf, die Zellatmung baut sie in jeder lebenden Zelle ab, Tag und Nacht.") },
      { math: q(where[f.w], "a"), note: tx(`So: **${en(WHICH[f.w])}**.`, `Also: **${de(WHICH[f.w])}**.`), highlight: ["a"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 6. The Elodea experiment

type Exp = { ask: Text; right: Text; short: Text; ans: Text; why: Text; wrong: Opt[] };
const EXPS: Exp[] = [
  {
    ask: tx("Which gas makes up most of the bubbles that rise from the cut stem?", "Aus welchem Gas bestehen die Bläschen, die am Stängel aufsteigen, hauptsächlich?"),
    right: tx("Oxygen", "Sauerstoff"),
    short: tx("bubbles", "Bläschen"),
    ans: tx("oxygen", "Sauerstoff"),
    why: tx("Oxygen is made by photosynthesis and leaves the plant as bubbles. You can show it with a glowing splint.", "Sauerstoff entsteht bei der Fotosynthese und verlässt die Pflanze als Bläschen. Nachweis: Glimmspanprobe."),
    wrong: [
      { text: tx("Carbon dioxide", "Kohlenstoffdioxid"), title: tx("CO₂ is used up", "CO₂ wird verbraucht"), say: tx("Carbon dioxide is taken **in** by photosynthesis. The gas given off in the light is oxygen.", "Kohlenstoffdioxid wird bei der Fotosynthese **aufgenommen**. Das Gas, das im Licht frei wird, ist Sauerstoff.") },
      { text: tx("Water vapour", "Wasserdampf"), title: tx("Under water?", "Unter Wasser?"), say: tx("The plant is under water: no water vapour bubbles form there. The bubbles come from photosynthesis.", "Die Pflanze ist unter Wasser: Dort bilden sich keine Wasserdampfbläschen. Die Bläschen stammen aus der Fotosynthese.") },
      { text: tx("Nitrogen", "Stickstoff"), title: tx("Not from the plant", "Nicht von der Pflanze"), say: tx("Nitrogen isn't produced by the plant. The bubbles grow with the light: it's the product of photosynthesis.", "Stickstoff stellt die Pflanze nicht her. Die Bläschen nehmen mit dem Licht zu: Es ist ein Produkt der Fotosynthese.") },
    ],
  },
  {
    ask: tx("Why is a cuvette of water placed between the lamp and the beaker?", "Warum steht eine Küvette mit Wasser zwischen Lampe und Becherglas?"),
    right: tx("It absorbs the heat, so only the light intensity changes", "Sie hält die Wärme ab, damit sich nur die Lichtintensität ändert"),
    short: tx("heat filter", "Wärmefilter"),
    ans: tx("only light changes", "nur Licht ändert sich"),
    why: tx("A lamp gives off heat. Without the filter the water would warm up when the lamp comes closer, and you couldn't tell whether light or warmth changed the rate.", "Eine Lampe gibt Wärme ab. Ohne Filter würde sich das Wasser erwärmen, wenn die Lampe näher kommt, und man wüsste nicht, ob Licht oder Wärme die Rate verändert hat."),
    wrong: [
      { text: tx("It gives the plant extra water", "Sie liefert der Pflanze zusätzliches Wasser"), title: tx("The plant is in water", "Die Pflanze ist im Wasser"), say: tx("Elodea is already in water. The cuvette keeps the lamp's heat away: a fair test changes only one factor.", "Die Wasserpest steht schon im Wasser. Die Küvette hält die Wärme der Lampe ab: Bei einem fairen Versuch ändert man nur einen Faktor.") },
      { text: tx("It makes the light brighter", "Sie macht das Licht heller"), title: tx("It's about heat", "Es geht um Wärme"), say: tx("Water doesn't brighten the light. It soaks up the heat, so the temperature stays constant.", "Wasser macht das Licht nicht heller. Es fängt die Wärme ab, damit die Temperatur gleich bleibt.") },
      { text: tx("It supplies CO₂", "Sie liefert CO₂"), title: tx("Separate from the plant", "Getrennt von der Pflanze"), say: tx("The cuvette isn't connected to the beaker. It filters out the heat of the lamp.", "Die Küvette ist nicht mit dem Becherglas verbunden. Sie filtert die Wärme der Lampe heraus.") },
    ],
  },
  {
    ask: tx("Why is some sodium hydrogen carbonate dissolved in the water?", "Warum löst man etwas Natriumhydrogencarbonat im Wasser?"),
    right: tx("It releases CO₂, so CO₂ doesn't become the limiting factor", "Es setzt CO₂ frei, damit CO₂ nicht zum begrenzenden Faktor wird"),
    short: tx("hydrogen carbonate", "Hydrogencarbonat"),
    ans: tx("more CO₂", "mehr CO₂"),
    why: tx("In water there is only a little CO₂. The salt supplies more, so the bubble count depends on the light only.", "Im Wasser ist nur wenig CO₂. Das Salz liefert mehr, damit die Bläschenzahl nur vom Licht abhängt."),
    wrong: [
      { text: tx("It releases oxygen for the plant", "Es liefert Sauerstoff für die Pflanze"), title: tx("CO₂, not O₂", "CO₂, nicht O₂"), say: tx("The salt releases **carbon dioxide**, a raw material of photosynthesis.", "Das Salz setzt **Kohlenstoffdioxid** frei, einen Ausgangsstoff der Fotosynthese.") },
      { text: tx("It feeds the plant minerals", "Es versorgt die Pflanze mit Mineralstoffen"), title: tx("Think of the carbon", "Denk an den Kohlenstoff"), say: tx("Hydrogen carbonate contains carbon: it is a source of CO₂, the raw material for sugar.", "Hydrogencarbonat enthält Kohlenstoff: Es ist eine CO₂-Quelle, der Rohstoff für Zucker.") },
      { text: tx("It makes the bubbles bigger and easier to count", "Es macht die Bläschen größer und leichter zählbar"), title: tx("It's a raw material", "Es ist ein Rohstoff"), say: tx("It doesn't change the bubbles themselves. It gives the plant more CO₂.", "Es verändert nicht die Bläschen selbst. Es gibt der Pflanze mehr CO₂.") },
    ],
  },
  {
    ask: tx("In this experiment you change the distance of the lamp. What is the independent variable?", "In diesem Versuch veränderst du den Abstand der Lampe. Was ist die unabhängige Variable?"),
    right: tx("The light intensity (distance of the lamp)", "Die Lichtintensität (Abstand der Lampe)"),
    short: tx("what you change", "was du veränderst"),
    ans: tx("light intensity", "Lichtintensität"),
    why: tx("The independent variable is what you change on purpose: here the light intensity, by moving the lamp.", "Die unabhängige Variable veränderst du gezielt: hier die Lichtintensität, indem du die Lampe verschiebst."),
    wrong: [
      { text: tx("The number of bubbles per minute", "Die Zahl der Bläschen pro Minute"), title: tx("That's what you measure", "Das misst du"), say: tx("The bubbles are what you **measure**: the dependent variable. What do you change on purpose?", "Die Bläschen **misst** du: Das ist die abhängige Variable. Was veränderst du gezielt?") },
      { text: tx("The temperature of the water", "Die Temperatur des Wassers"), title: tx("Kept constant", "Wird konstant gehalten"), say: tx("The temperature is kept the same on purpose (heat filter). It's a controlled variable.", "Die Temperatur hält man absichtlich gleich (Wärmefilter). Sie ist eine Kontrollvariable.") },
      { text: tx("The kind of plant", "Die Pflanzenart"), title: tx("Kept the same", "Bleibt gleich"), say: tx("You use the same sprig all the time. What do you change?", "Du nimmst die ganze Zeit denselben Spross. Was veränderst du?") },
    ],
  },
  {
    ask: tx("The lamp is moved from 10 cm to 30 cm away. What do you observe?", "Die Lampe wird von 10 cm auf 30 cm Abstand gerückt. Was beobachtest du?"),
    right: tx("Fewer bubbles, because the light intensity falls", "Weniger Bläschen, weil die Lichtintensität sinkt"),
    short: tx("10 cm → 30 cm", "10 cm → 30 cm"),
    ans: tx("fewer bubbles", "weniger Bläschen"),
    why: tx("The further away the lamp, the less light reaches the plant. Less light means less photosynthesis, so fewer bubbles.", "Je weiter die Lampe weg ist, desto weniger Licht erreicht die Pflanze. Weniger Licht heißt weniger Fotosynthese, also weniger Bläschen."),
    wrong: [
      { text: tx("More bubbles, because the plant gets cooler", "Mehr Bläschen, weil die Pflanze kühler wird"), title: tx("Heat filter", "Wärmefilter"), say: tx("Thanks to the heat filter the temperature stays the same. What changes is the light.", "Dank des Wärmefilters bleibt die Temperatur gleich. Was sich ändert, ist das Licht.") },
      { text: tx("The same number: light doesn't matter", "Gleich viele: Licht spielt keine Rolle"), title: tx("Light drives it", "Licht treibt sie an"), say: tx("Light is the energy source of photosynthesis. Less light, less photosynthesis.", "Licht ist die Energiequelle der Fotosynthese. Weniger Licht, weniger Fotosynthese.") },
      { text: tx("No bubbles at all, the plant starts to respire instead", "Gar keine Bläschen, die Pflanze atmet stattdessen"), title: tx("Respiration runs anyway", "Atmung läuft sowieso"), say: tx("Respiration runs all the time anyway. At 30 cm there's still light, just less: fewer bubbles.", "Die Zellatmung läuft sowieso immer. Bei 30 cm ist noch Licht da, nur weniger: weniger Bläschen.") },
    ],
  },
  {
    ask: tx("Why do you count for several minutes and take the mean?", "Warum zählst du mehrere Minuten lang und bildest den Mittelwert?"),
    right: tx("To even out random errors in single counts", "Um zufällige Fehler einzelner Zählungen auszugleichen"),
    short: tx("several counts", "mehrere Zählungen"),
    ans: tx("even out errors", "Fehler ausgleichen"),
    why: tx("Single counts vary by chance. The mean of several measurements is more reliable.", "Einzelne Zählungen schwanken zufällig. Der Mittelwert mehrerer Messungen ist zuverlässiger."),
    wrong: [
      { text: tx("So the plant gets used to the light", "Damit sich die Pflanze ans Licht gewöhnt"), title: tx("It's about the data", "Es geht um die Daten"), say: tx("A short wait before counting is good, but repeating counts is about **reliable data**.", "Vor dem Zählen kurz zu warten ist gut, aber das Wiederholen sorgt für **zuverlässige Messwerte**.") },
      { text: tx("To get a bigger number", "Um eine größere Zahl zu bekommen"), title: tx("Not the point", "Darum geht es nicht"), say: tx("The mean isn't bigger than the single values. It evens out random ups and downs.", "Der Mittelwert ist nicht größer als die Einzelwerte. Er gleicht zufällige Schwankungen aus.") },
      { text: tx("Because the bubbles contain different gases", "Weil die Bläschen verschiedene Gase enthalten"), title: tx("Same gas", "Dasselbe Gas"), say: tx("The bubbles are mostly oxygen anyway. Repeating is about reducing random errors.", "Die Bläschen sind sowieso vor allem Sauerstoff. Wiederholen verringert zufällige Fehler.") },
    ],
  },
];

function expTask(rng: Rng): Exercise {
  const e = rng.pick(EXPS);
  const { answer, mistakes: list } = choice(rng, [{ text: e.right }, ...e.wrong]);
  return {
    instruction: tx("The Elodea experiment", "Der Wasserpest-Versuch"),
    text: tx(`Elodea (pondweed) is lit by a lamp and gives off bubbles. ${en(e.ask)}`, `Eine Wasserpest wird mit einer Lampe beleuchtet und gibt Bläschen ab. ${de(e.ask)}`),
    answer,
    hint: tx("A fair experiment changes one factor and keeps all others the same.", "In einem fairen Versuch veränderst du einen Faktor und hältst alle anderen gleich."),
    solution: reasonFrames(e.short, e.why, e.ans, tx(`**${en(e.right)}.**`, `**${de(e.right)}.**`)),
    mistakes: list,
  };
}

function meanTask(rng: Rng): Exercise {
  const d = rng.pick([10, 15, 20, 25, 30, 40]);
  const base = Math.max(6, Math.round(45 * ((10 / d) ** 2 / ((10 / d) ** 2 + 0.3))));
  let a = base + rng.int(-3, 3);
  let b = base + rng.int(-3, 3);
  const target = rng.int(0, 1);
  let c = 3 * (base + target) - a - b;
  if (Math.abs(c - base) > 2) {
    a = base - 1;
    b = base + 2;
    c = 3 * (base + target) - a - b;
  }
  const mean = (a + b + c) / 3;
  const answer: AnswerSpec = { kind: "number", value: mean, unit: tx("bubbles/min", "Bläschen/min") };
  const m = mistakes(answer);
  m.add({ kind: "number", value: a + b + c }, tx("Divide by 3", "Durch 3 teilen"), tx("That's the sum. The mean is the sum divided by the number of counts.", "Das ist die Summe. Der Mittelwert ist die Summe geteilt durch die Zahl der Zählungen."));
  m.add({ kind: "number", value: (a + b + c) / 2, tolerance: 0.01 }, tx("Three counts", "Drei Zählungen"), tx("There are three counts, so divide by 3.", "Es sind drei Zählungen, also durch 3 teilen."));
  return {
    instruction: tx("Evaluate the measurement", "Werte die Messung aus"),
    text: tx(`Elodea, lamp at ${d} cm: you count ${a}, ${b} and ${c} bubbles in three successive minutes. Calculate the mean.`, `Wasserpest, Lampe in ${d} cm Abstand: Du zählst in drei aufeinanderfolgenden Minuten ${a}, ${b} und ${c} Bläschen. Berechne den Mittelwert.`),
    answer,
    hint: tx("Add the three counts and divide by the number of counts.", "Addiere die drei Werte und teile durch die Anzahl der Werte."),
    solution: [
      { math: `\\frac{${a} + ${b} + ${c}}{3}`, note: tx("Mean = sum of the values divided by their number.", "Mittelwert = Summe der Werte geteilt durch ihre Anzahl.") },
      { math: `\\frac{${a + b + c}}{3} = \\blob{${mean}#v}`, note: tx(`On average **${mean}** bubbles per minute.`, `Im Mittel **${mean}** Bläschen pro Minute.`), highlight: ["v"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// 7. The compensation point

function compReadTask(rng: Rng): Exercise {
  const comp = rng.pick([1, 1.5, 2, 2.5, 3, 4]);
  const resp = rng.pick([10, 15, 20]);
  const answer: AnswerSpec = { kind: "number", value: comp, unit: "klx", tolerance: 0.25 / comp };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 0 }, tx("Where it crosses zero", "Wo sie die Null kreuzt"), tx("At 0 klx the plant only respires. The compensation point is where the curve crosses the **zero line**.", "Bei 0 klx atmet die Pflanze nur. Der Kompensationspunkt liegt dort, wo die Kurve die **Nulllinie** schneidet."));
  m.add({ kind: "number", value: resp }, tx("Wrong axis", "Falsche Achse"), tx("That's a value on the vertical axis. The compensation point is a **light intensity**: read it on the horizontal axis.", "Das ist ein Wert auf der senkrechten Achse. Der Kompensationspunkt ist eine **Lichtintensität**: Lies sie auf der waagerechten Achse ab."));
  return {
    instruction: tx("Read the compensation point", "Lies den Kompensationspunkt ab"),
    text: tx("The graph shows the net oxygen release of a plant (photosynthesis minus respiration). At which light intensity is the compensation point?", "Das Diagramm zeigt die Netto-Sauerstoffabgabe einer Pflanze (Fotosynthese minus Zellatmung). Bei welcher Lichtintensität liegt der Kompensationspunkt?"),
    visual: visual(PhotoNetGraph, { comp, resp }),
    answer,
    hint: tx("At the compensation point the plant gives off as much oxygen as it uses: net release zero.", "Am Kompensationspunkt gibt die Pflanze so viel Sauerstoff ab, wie sie verbraucht: Die Netto-Abgabe ist null."),
    solution: [
      { math: tx('"photosynthesis" = "respiration"', '"Fotosynthese" = "Zellatmung"'), note: tx("At the compensation point both are equal, so the net release is zero.", "Am Kompensationspunkt sind beide gleich groß, die Netto-Abgabe ist also null.") },
      { math: tx(`"compensation point:" \\; \\blob{${en(decText(comp))}#v} "klx"`, `"Kompensationspunkt:" \\; \\blob{${de(decText(comp))}#v} "klx"`), note: tx(`The curve crosses the zero line at **${en(decText(comp))} klx**.`, `Die Kurve schneidet die Nulllinie bei **${de(decText(comp))} klx**.`), highlight: ["v"] },
    ],
    mistakes: m.list,
  };
}

type CompQ = { ask: Text; right: Text; short: Text; ans: Text; wrong: Opt[] };
const COMPQ: CompQ[] = [
  {
    ask: tx("The light intensity is **below** the compensation point. What does the plant do overall?", "Die Lichtintensität liegt **unter** dem Kompensationspunkt. Was macht die Pflanze insgesamt?"),
    right: tx("It takes in oxygen and gives off carbon dioxide", "Sie nimmt Sauerstoff auf und gibt Kohlenstoffdioxid ab"),
    short: tx("below the point", "unter dem Punkt"),
    ans: tx("O₂ in, CO₂ out", "O₂ rein, CO₂ raus"),
    wrong: [
      { text: tx("It gives off oxygen and takes in carbon dioxide", "Sie gibt Sauerstoff ab und nimmt Kohlenstoffdioxid auf"), title: tx("Respiration wins here", "Hier überwiegt die Atmung"), say: tx("Below the compensation point respiration uses more oxygen than photosynthesis makes. So the plant takes oxygen in.", "Unter dem Kompensationspunkt verbraucht die Zellatmung mehr Sauerstoff, als die Fotosynthese herstellt. Also nimmt die Pflanze Sauerstoff auf.") },
      { text: tx("It does no photosynthesis at all", "Sie betreibt gar keine Fotosynthese"), title: tx("There is some", "Es gibt etwas"), say: tx("There is light, so some photosynthesis runs. It's just weaker than respiration.", "Es ist Licht da, also läuft etwas Fotosynthese. Sie ist nur schwächer als die Zellatmung.") },
      { text: tx("It stops respiring", "Sie hört auf zu atmen"), title: tx("Respiration never stops", "Atmung hört nie auf"), say: tx("A living plant respires all the time, in light and dark.", "Eine lebende Pflanze atmet die ganze Zeit, im Hellen wie im Dunkeln.") },
    ],
  },
  {
    ask: tx("What is true **at** the compensation point?", "Was gilt **am** Kompensationspunkt?"),
    right: tx("Photosynthesis makes exactly as much oxygen as respiration uses", "Die Fotosynthese erzeugt genau so viel Sauerstoff, wie die Zellatmung verbraucht"),
    short: tx("at the point", "am Punkt"),
    ans: tx("both equal", "beide gleich"),
    wrong: [
      { text: tx("Photosynthesis and respiration both stop", "Fotosynthese und Zellatmung kommen zum Stillstand"), title: tx("Both are running", "Beide laufen"), say: tx("Both processes run. They just cancel each other out, so no net gas exchange is visible.", "Beide Vorgänge laufen. Sie heben sich nur gegenseitig auf, deshalb sieht man keinen Netto-Gasaustausch.") },
      { text: tx("Photosynthesis is at its maximum", "Die Fotosynthese ist maximal"), title: tx("Low light", "Wenig Licht"), say: tx("The compensation point lies at low light. The maximum is reached much later, where the curve levels off.", "Der Kompensationspunkt liegt bei wenig Licht. Das Maximum kommt viel später, wo die Kurve abflacht.") },
      { text: tx("The plant only respires", "Die Pflanze atmet nur"), title: tx("That's in the dark", "Das ist im Dunkeln"), say: tx("Only respiring happens in complete darkness. At the compensation point photosynthesis runs too.", "Nur Atmung gibt es bei völliger Dunkelheit. Am Kompensationspunkt läuft auch Fotosynthese.") },
    ],
  },
  {
    ask: tx("Shade plants (like ferns on the forest floor) have a lower compensation point than sun plants. Why is this an advantage for them?", "Schattenpflanzen (wie Farne am Waldboden) haben einen niedrigeren Kompensationspunkt als Sonnenpflanzen. Warum ist das für sie ein Vorteil?"),
    right: tx("They gain more from photosynthesis than respiration uses even in dim light", "Schon bei wenig Licht gewinnen sie mehr durch Fotosynthese, als die Zellatmung verbraucht"),
    short: tx("low point", "niedriger Punkt"),
    ans: tx("plus in dim light", "Plus bei wenig Licht"),
    wrong: [
      { text: tx("They don't need to respire in the shade", "Im Schatten müssen sie nicht atmen"), title: tx("All plants respire", "Alle Pflanzen atmen"), say: tx("Every plant respires. Shade plants simply respire little, so a little light is enough to outweigh it.", "Jede Pflanze atmet. Schattenpflanzen atmen nur wenig, deshalb reicht schon wenig Licht, um das auszugleichen.") },
      { text: tx("They can do photosynthesis without light", "Sie können ohne Licht Fotosynthese betreiben"), title: tx("Light is always needed", "Licht braucht es immer"), say: tx("No plant does photosynthesis without light. Shade plants manage with **less** light.", "Keine Pflanze betreibt Fotosynthese ohne Licht. Schattenpflanzen kommen mit **weniger** Licht aus.") },
      { text: tx("They can take up more CO₂ at night", "Sie können nachts mehr CO₂ aufnehmen"), title: tx("It's about light", "Es geht um Licht"), say: tx("The compensation point is a light intensity. A low one means: a positive balance already in dim light.", "Der Kompensationspunkt ist eine Lichtintensität. Ein niedriger heißt: schon bei schwachem Licht eine positive Bilanz.") },
    ],
  },
];

function compTask(rng: Rng, c = rng.pick(COMPQ)): Exercise {
  const { answer, mistakes: list } = choice(rng, [{ text: c.right }, ...c.wrong]);
  return {
    instruction: tx("The compensation point", "Der Kompensationspunkt"),
    text: c.ask,
    answer,
    hint: tx("Photosynthesis makes oxygen, respiration uses oxygen, day and night. Compare the two.", "Die Fotosynthese erzeugt Sauerstoff, die Zellatmung verbraucht ihn, Tag und Nacht. Vergleiche beide."),
    solution: reasonFrames(
      c.short,
      tx("Respiration runs all the time. Whether the plant gives off oxygen overall depends on which process is stronger.", "Die Zellatmung läuft immer. Ob die Pflanze insgesamt Sauerstoff abgibt, hängt davon ab, welcher Vorgang stärker ist."),
      c.ans,
      tx(`**${en(c.right)}.**`, `**${de(c.right)}.**`),
    ),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 8. The leaf cross-section

const LEAF_IDS = ["palisade", "spongy", "stoma", "upper", "cuticle", "bundle", "air", "lower", "chloro"];
const leafName = (id: string) => LEAF_SECTION_PARTS.find((p) => p.id === id)!.label;
const leafInfo = (id: string) => LEAF_SECTION_PARTS.find((p) => p.id === id)!.info!;
const LEAF_THE: Record<string, Text> = {
  palisade: tx("That's the palisade tissue", "Das ist das Palisadengewebe"),
  spongy: tx("That's the spongy tissue", "Das ist das Schwammgewebe"),
  stoma: tx("That's a stoma with its two guard cells", "Das ist eine Spaltöffnung mit ihren zwei Schließzellen"),
  upper: tx("That's the upper epidermis", "Das ist die obere Epidermis"),
  cuticle: tx("That's the cuticle", "Das ist die Cuticula"),
  bundle: tx("That's a vascular bundle (a vein)", "Das ist ein Leitbündel (eine Blattader)"),
  air: tx("Those are the air spaces", "Das sind die Interzellularen (Lufträume)"),
  lower: tx("That's the lower epidermis", "Das ist die untere Epidermis"),
  chloro: tx("That's a chloroplast", "Das ist ein Chloroplast"),
};

function leafTask(rng: Rng): Exercise {
  const id = rng.pick(LEAF_IDS);
  const pool = LEAF_IDS.filter((x) => x !== id && !(id === "upper" && x === "lower") && !(id === "lower" && x === "upper"));
  const wrong = some(rng, pool, 3);
  const special: Record<string, Text> = {
    "palisade>spongy": tx("Look at the shape: these cells are tall and packed tightly, right under the top. That's where most chloroplasts are.", "Schau auf die Form: Diese Zellen sind hoch und dicht gepackt, direkt unter der Oberseite. Dort liegen die meisten Chloroplasten."),
    "spongy>palisade": tx("These cells are loose and round, with air spaces between them. The tall, packed ones are higher up.", "Diese Zellen liegen locker und rundlich, mit Lufträumen dazwischen. Die hohen, dicht gepackten liegen weiter oben."),
    "upper>cuticle": tx("The cuticle is the thin wax film **on** the cells. The marked part is a layer of cells.", "Die Cuticula ist der dünne Wachsfilm **auf** den Zellen. Markiert ist eine Zellschicht."),
    "cuticle>upper": tx("The marked part is the thin film on top of the cells, not a layer of cells.", "Markiert ist der dünne Film auf den Zellen, keine Zellschicht."),
  };
  const opts: Opt[] = [
    { text: tx(cap(en(leafName(id))), de(leafName(id))) },
    ...wrong.map((w) => ({
      text: tx(cap(en(leafName(w))), de(leafName(w))),
      title: tx("Another part", "Ein anderer Teil"),
      say: special[`${id}>${w}`] ?? tx(`The ${en(leafName(w))}: ${en(leafInfo(w)).charAt(0).toLowerCase()}${en(leafInfo(w)).slice(1)} Look again where the **?** points.`, `${de(leafName(w))}: ${de(leafInfo(w))} Schau noch mal, worauf das **?** zeigt.`),
    })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Inside the leaf", "Im Blattinneren"),
    text: tx("What is the part marked with **?** called?", "Wie heißt der mit **?** markierte Teil?"),
    visual: visual(PhotoLeafSection, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("From top to bottom: cuticle, upper epidermis, palisade tissue, spongy tissue with air spaces, lower epidermis with stomata.", "Von oben nach unten: Cuticula, obere Epidermis, Palisadengewebe, Schwammgewebe mit Lufträumen, untere Epidermis mit Spaltöffnungen."),
    solution: [{ math: q(leafName(id), "n"), note: tx(`${en(LEAF_THE[id])}. ${en(leafInfo(id))}`, `${de(LEAF_THE[id])}. ${de(leafInfo(id))}`), highlight: ["n"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 9. True or false (level 2)

const TRUE2: Text[] = [
  tx("In photosynthesis light energy is converted into chemical energy.", "Bei der Fotosynthese wird Lichtenergie in chemische Energie umgewandelt."),
  tx("Plants carry out cellular respiration in their mitochondria, day and night.", "Pflanzen betreiben in ihren Mitochondrien Zellatmung, Tag und Nacht."),
  tx("At the compensation point photosynthesis and respiration are equally strong.", "Am Kompensationspunkt sind Fotosynthese und Zellatmung gleich stark."),
  tx("The factor in shortest supply limits the rate of photosynthesis.", "Der Faktor, der am knappsten ist, begrenzt die Fotosyntheserate."),
  tx("Most chloroplasts of a leaf are in the palisade tissue.", "Die meisten Chloroplasten eines Blattes liegen im Palisadengewebe."),
];
const FALSE2: Opt[] = [
  { text: tx("Plant cells have no mitochondria, because they have chloroplasts.", "Pflanzenzellen haben keine Mitochondrien, weil sie Chloroplasten haben."), title: tx("Plants have both", "Pflanzen haben beides"), say: tx("A classic! Plant cells have chloroplasts **and** mitochondria. They need respiration to use the energy in glucose.", "Ein Klassiker! Pflanzenzellen haben Chloroplasten **und** Mitochondrien. Sie brauchen die Zellatmung, um die Energie der Glucose zu nutzen.") },
  { text: tx("Plants only respire at night.", "Pflanzen atmen nur nachts."), title: tx("Day and night", "Tag und Nacht"), say: tx("Respiration runs all the time. During the day you just don't notice it because photosynthesis is stronger.", "Die Zellatmung läuft immer. Tagsüber merkt man sie nur nicht, weil die Fotosynthese stärker ist.") },
  { text: tx("In photosynthesis energy is released.", "Bei der Fotosynthese wird Energie freigesetzt."), title: tx("Energy is stored", "Energie wird gespeichert"), say: tx("Photosynthesis **stores** light energy in glucose. Releasing it is the job of respiration.", "Die Fotosynthese **speichert** Lichtenergie in Glucose. Freigesetzt wird sie bei der Zellatmung.") },
  { text: tx("More light always increases the rate of photosynthesis.", "Mehr Licht steigert die Fotosyntheserate immer."), title: tx("Only up to a point", "Nur bis zu einem Punkt"), say: tx("Only while light is the limiting factor. Then the curve levels off: CO₂ or temperature limits.", "Nur solange Licht der begrenzende Faktor ist. Dann flacht die Kurve ab: CO₂ oder Temperatur begrenzen.") },
  { text: tx("Photosynthesis is fastest at 50 °C.", "Bei 50 °C ist die Fotosynthese am schnellsten."), title: tx("Too hot", "Zu heiß"), say: tx("At such temperatures the enzymes are damaged. Most plants have their optimum between about 25 and 35 °C.", "Bei solchen Temperaturen werden die Enzyme geschädigt. Die meisten Pflanzen haben ihr Optimum zwischen etwa 25 und 35 °C.") },
  { text: tx("Light is a raw material of photosynthesis, just like water.", "Licht ist ein Ausgangsstoff der Fotosynthese, genau wie Wasser."), title: tx("Light is energy", "Licht ist Energie"), say: tx("Light isn't a substance. It provides the energy and is written above the arrow.", "Licht ist kein Stoff. Es liefert die Energie und steht über dem Pfeil.") },
  { text: tx("Most photosynthesis happens in the roots.", "Die meiste Fotosynthese findet in den Wurzeln statt."), title: tx("Roots are in the dark", "Wurzeln sind im Dunkeln"), say: tx("Roots have no chloroplasts and get no light. Photosynthesis happens in the leaves, mostly in the palisade tissue.", "Wurzeln haben keine Chloroplasten und bekommen kein Licht. Fotosynthese findet in den Blättern statt, vor allem im Palisadengewebe.") },
];

function statementTask(rng: Rng): Exercise {
  const right = rng.pick(TRUE2);
  const { answer, mistakes: list } = choice(rng, [{ text: right }, ...some(rng, FALSE2, 3)]);
  return {
    instruction: tx("True or false?", "Richtig oder falsch?"),
    text: tx("Which statement is **true**?", "Welche Aussage ist **richtig**?"),
    answer,
    hint: tx("Think of the equation, of respiration and of the limiting factor.", "Denk an die Reaktionsgleichung, an die Zellatmung und an den begrenzenden Faktor."),
    solution: [{ math: q(tx("true", "richtig"), "a"), note: tx(`**${en(right)}** The others are common mix-ups.`, `**${de(right)}** Die anderen sind verbreitete Irrtümer.`), highlight: ["a"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// 10. Matching: photosynthesis and respiration

const MATCH_PAIRS: [Text, Text][] = [
  [tx("Site of photosynthesis", "Ort der Fotosynthese"), tx("chloroplasts", "Chloroplasten")],
  [tx("Site of respiration", "Ort der Zellatmung"), tx("mitochondria", "Mitochondrien")],
  [tx("Raw materials of photosynthesis", "Ausgangsstoffe der Fotosynthese"), tx("carbon dioxide and water", "Kohlenstoffdioxid und Wasser")],
  [tx("Raw materials of respiration", "Ausgangsstoffe der Zellatmung"), tx("glucose and oxygen", "Glucose und Sauerstoff")],
  [tx("Energy in photosynthesis", "Energie bei der Fotosynthese"), tx("light energy is stored", "Lichtenergie wird gespeichert")],
  [tx("Energy in respiration", "Energie bei der Zellatmung"), tx("usable energy is released", "nutzbare Energie wird frei")],
];

function matchTask(rng: Rng, pick?: number[]): Exercise {
  const idx = pick ?? some(rng, [0, 1, 2, 3, 4, 5], 4);
  const pairs = idx.map((i) => MATCH_PAIRS[i]);
  const has = (i: number) => idx.includes(i);
  const m: Mistake[] = [];
  if (has(0) && has(1)) m.push({ when: { kind: "match", pairs: [[MATCH_PAIRS[1][0], MATCH_PAIRS[0][1]]] }, title: tx("Plants have mitochondria", "Pflanzen haben Mitochondrien"), say: tx("Respiration takes place in the mitochondria, in plant cells too. Chloroplasts are for photosynthesis.", "Die Zellatmung läuft in den Mitochondrien ab, auch in Pflanzenzellen. Chloroplasten sind für die Fotosynthese da.") });
  if (has(2) && has(3)) m.push({ when: { kind: "match", pairs: [[MATCH_PAIRS[2][0], MATCH_PAIRS[3][1]]] }, title: tx("Swapped round", "Vertauscht"), say: tx("Photosynthesis **builds** glucose from CO₂ and water. Respiration uses glucose and oxygen.", "Die Fotosynthese **baut** Glucose aus CO₂ und Wasser **auf**. Die Zellatmung verbraucht Glucose und Sauerstoff.") });
  if (has(4) && has(5)) m.push({ when: { kind: "match", pairs: [[MATCH_PAIRS[4][0], MATCH_PAIRS[5][1]]] }, title: tx("Stored, not released", "Gespeichert, nicht frei"), say: tx("Photosynthesis **stores** energy in glucose; respiration releases it again.", "Die Fotosynthese **speichert** Energie in Glucose, die Zellatmung setzt sie wieder frei.") });
  const distractors = rng.chance(0.5) ? [tx("nucleus", "Zellkern")] : [tx("glucose and carbon dioxide", "Glucose und Kohlenstoffdioxid")];
  return {
    instruction: tx("Match them up", "Ordne zu"),
    text: tx("Photosynthesis and cellular respiration: give each card its partner.", "Fotosynthese und Zellatmung: Gib jeder Karte ihren Partner."),
    answer: { kind: "match", pairs, distractors },
    hint: tx("Respiration is photosynthesis backwards, but in another organelle.", "Die Zellatmung ist die umgekehrte Fotosynthese, nur in einem anderen Organell."),
    solution: [
      { math: "\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}", note: tx("Photosynthesis in the chloroplasts: light energy is stored in glucose.", "Fotosynthese in den Chloroplasten: Lichtenergie wird in Glucose gespeichert.") },
      { math: "\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O}", note: tx("Respiration in the mitochondria: glucose is broken down and usable energy is released.", "Zellatmung in den Mitochondrien: Glucose wird abgebaut, nutzbare Energie wird frei.") },
    ],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  const r = rng.int(0, 23);
  if (r < 2) return balanceTask(rng.chance(0.35));
  if (r < 5) return countTask(rng);
  if (r < 8) return graphTask(rng);
  if (r < 10) return sceneTask(rng);
  if (r < 13) return whichTask(rng);
  if (r < 15) return expTask(rng);
  if (r < 16) return meanTask(rng);
  if (r < 18) return compReadTask(rng);
  if (r < 19) return compTask(rng);
  if (r < 20) return leafTask(rng);
  if (r < 22) return statementTask(rng);
  return matchTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const equationFrames: Frame[] = [
  {
    math: tx('"carbon dioxide"#c + "water"#w \\\\ \\to#ar "glucose"#z + "oxygen"#o', '"Kohlenstoffdioxid"#c + "Wasser"#w \\\\ \\to#ar "Glucose"#z + "Sauerstoff"#o'),
    note: tx("You know the word equation. Chemists start with carbon dioxide and call the sugar **glucose**.", "Die Wortgleichung kennst du. In der Chemie beginnt man mit Kohlenstoffdioxid und nennt den Zucker **Glucose** (Traubenzucker)."),
  },
  {
    math: "\\ce{CO2}#c + \\ce{H2O}#w \\\\ \\to#ar \\ce{C6H12O6}#z + \\ce{O2}#o",
    note: tx("Now with formulas. Glucose is $\\ce{C6H12O6}$: 6 carbon, 12 hydrogen and 6 oxygen atoms.", "Jetzt mit Formeln. Glucose ist $\\ce{C6H12O6}$: 6 Kohlenstoff-, 12 Wasserstoff- und 6 Sauerstoffatome."),
  },
  {
    math: "6#k1 \\ce{CO2}#c + 6#k2 \\ce{H2O}#w \\\\ \\to#ar \\ce{C6H12O6}#z + 6#k3 \\ce{O2}#o",
    note: tx("Balance it: 6 C need 6 $\\ce{CO2}$, 12 H need 6 $\\ce{H2O}$, and 6 $\\ce{O2}$ are released.", "Ausgleichen: 6 C brauchen 6 $\\ce{CO2}$, 12 H brauchen 6 $\\ce{H2O}$, und 6 $\\ce{O2}$ werden frei."),
    highlight: ["k1", "k2", "k3"],
  },
  {
    math: '"C:" \\; 6 = 6 \\quad "H:" \\; 12 = 12 \\quad "O:" \\; 18 = 18',
    note: tx("Check: left $6 \\cdot 2 + 6 = 18$ O atoms, right $6 + 6 \\cdot 2 = 18$. Every atom is still there, only rearranged.", "Probe: links $6 \\cdot 2 + 6 = 18$ O-Atome, rechts $6 + 6 \\cdot 2 = 18$. Jedes Atom ist noch da, nur neu angeordnet."),
  },
  {
    math: tx('6 \\ce{CO2}#c + 6 \\ce{H2O}#w \\\\ \\to#ar \\; \\blob{"light energy"#l} \\\\ \\ce{C6H12O6}#z + 6 \\ce{O2}#o', '6 \\ce{CO2}#c + 6 \\ce{H2O}#w \\\\ \\to#ar \\; \\blob{"Lichtenergie"#l} \\\\ \\ce{C6H12O6}#z + 6 \\ce{O2}#o'),
    note: tx("Light energy goes at the arrow: it isn't a substance. Photosynthesis is an **energy conversion**: light energy becomes chemical energy, stored in glucose.", "Die Lichtenergie steht am Pfeil: Sie ist kein Stoff. Fotosynthese ist eine **Energieumwandlung**: Aus Lichtenergie wird chemische Energie, gespeichert in der Glucose."),
    highlight: ["l"],
  },
];

const limitingFrames: Frame[] = [
  {
    math: tx('"light"#l , \\; \\ce{CO2}#c , \\; "temperature"#t', '"Licht"#l , \\; \\ce{CO2}#c , \\; "Temperatur"#t'),
    note: tx("Three outside factors decide how fast photosynthesis runs: **light intensity**, **CO₂ concentration** and **temperature**.", "Drei äußere Faktoren bestimmen, wie schnell die Fotosynthese läuft: **Lichtintensität**, **CO₂-Konzentration** und **Temperatur**."),
  },
  {
    math: tx('"rate"#r \\to "the scarcest factor"#m', '"Rate"#r \\to "der knappste Faktor"#m'),
    note: tx("**Principle of the limiting factor** (minimum factor): the factor in shortest supply sets the rate. Like a barrel that can only be filled up to its shortest stave.", "**Prinzip des begrenzenden Faktors** (Minimumfaktor): Der Faktor, der am knappsten ist, bestimmt die Rate. Wie bei einer Tonne, die man nur bis zur kürzesten Daube füllen kann."),
    highlight: ["m"],
  },
  {
    math: tx('"dim light:"#a \\; "more" \\ce{CO2} \\to "no effect"#b', '"wenig Licht:"#a \\; "mehr" \\ce{CO2} \\to "keine Wirkung"#b'),
    note: tx("In dim light more CO₂ doesn't help: light is limiting. Only more light raises the rate. The curve rises.", "Bei wenig Licht hilft mehr CO₂ nicht: Licht begrenzt. Nur mehr Licht steigert die Rate. Die Kurve steigt."),
  },
  {
    math: tx('"bright light:"#a \\; "more light" \\to "no effect"#b \\\\ "more" \\ce{CO2} \\to "rate rises"#c', '"viel Licht:"#a \\; "mehr Licht" \\to "keine Wirkung"#b \\\\ "mehr" \\ce{CO2} \\to "Rate steigt"#c'),
    note: tx("In bright light the curve levels off: now CO₂ or temperature limits. Raising that factor lifts the whole plateau. That's why greenhouses are enriched with CO₂.", "Bei viel Licht flacht die Kurve ab: Jetzt begrenzen CO₂ oder Temperatur. Erhöht man diesen Faktor, steigt das ganze Plateau. Deshalb begast man Gewächshäuser mit CO₂."),
    highlight: ["c"],
  },
  {
    math: tx('"above" 35 "°C"#a \\to "enzymes damaged"#b', '"über" 35 "°C"#a \\to "Enzyme geschädigt"#b'),
    note: tx("Temperature acts on the enzymes: warmer is faster up to an optimum (about 25 to 35 °C for many plants). Above that the enzymes are damaged and the rate drops sharply.", "Die Temperatur wirkt auf die Enzyme: Wärmer ist schneller, bis zu einem Optimum (bei vielen Pflanzen etwa 25 bis 35 °C). Darüber werden die Enzyme geschädigt, die Rate fällt stark ab."),
  },
];

const respFrames: Frame[] = [
  {
    math: "6#a \\ce{CO2}#c + 6#b \\ce{H2O}#w \\to#ar \\ce{C6H12O6}#z + 6#d \\ce{O2}#o",
    note: tx("Photosynthesis **builds up** glucose and stores energy in it.", "Die Fotosynthese **baut** Glucose **auf** und speichert darin Energie."),
  },
  {
    math: "\\ce{C6H12O6}#z + 6#d \\ce{O2}#o \\to#ar 6#a \\ce{CO2}#c + 6#b \\ce{H2O}#w",
    note: tx("**Cellular respiration** is the reverse: glucose is broken down with oxygen into carbon dioxide and water.", "Die **Zellatmung** ist der umgekehrte Weg: Glucose wird mit Sauerstoff zu Kohlenstoffdioxid und Wasser abgebaut."),
  },
  {
    math: tx('\\ce{C6H12O6}#z + 6#d \\ce{O2}#o \\to#ar 6#a \\ce{CO2}#c + 6#b \\ce{H2O}#w + \\blob{"energy"#e}', '\\ce{C6H12O6}#z + 6#d \\ce{O2}#o \\to#ar 6#a \\ce{CO2}#c + 6#b \\ce{H2O}#w + \\blob{"Energie"#e}'),
    note: tx("The stored energy is released and used for life processes. This happens in the **mitochondria** of every living cell, in plants too, day and night.", "Die gespeicherte Energie wird frei und für Lebensvorgänge genutzt. Das geschieht in den **Mitochondrien** jeder lebenden Zelle, auch bei Pflanzen, Tag und Nacht."),
    highlight: ["e"],
  },
  {
    math: tx('"photosynthesis:"#p \\; "chloroplasts, light"#a \\\\ "respiration:"#q \\; "mitochondria, always"#b', '"Fotosynthese:"#p \\; "Chloroplasten, Licht"#a \\\\ "Zellatmung:"#q \\; "Mitochondrien, immer"#b'),
    note: tx("So a green leaf in the light does both at once. Whether it gives off oxygen overall depends on which process is stronger.", "Ein grünes Blatt im Licht macht also beides gleichzeitig. Ob es insgesamt Sauerstoff abgibt, hängt davon ab, welcher Vorgang stärker ist."),
  },
];

const checkBalance = balanceTask(false);
const checkGraph = graphTask(createRng(4), { diff: "co2", at: "B", swap: false });
const checkNight = compTask(createRng(9), COMPQ[0]);
const checkMatch = matchTask(createRng(3), [0, 1, 2, 3]);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("The chemical equation", "Die Reaktionsgleichung"),
      blob: tx("Time to speak chemistry! Count the atoms with me.", "Zeit für Chemie! Zähl die Atome mit mir."),
      frames: equationFrames,
    },
    { type: "check", blob: tx("Your turn: balance it yourself.", "Du bist dran: Gleiche selbst aus."), exercise: checkBalance },
    {
      type: "widget",
      title: tx("Where in the leaf?", "Wo im Blatt?"),
      blob: tx("Let's slice a leaf open. Tap the parts!", "Wir schneiden ein Blatt auf. Tipp die Teile an!"),
      body: tx(
        "Photosynthesis takes place in the **chloroplasts**. Most of them sit in the **palisade tissue**, right under the clear upper epidermis where the light falls. CO₂ gets in through the **stomata** and spreads through the air spaces; water comes through the veins.",
        "Die Fotosynthese läuft in den **Chloroplasten** ab. Die meisten sitzen im **Palisadengewebe**, direkt unter der durchsichtigen oberen Epidermis, wo das Licht ankommt. CO₂ gelangt durch die **Spaltöffnungen** hinein und verteilt sich in den Interzellularen, Wasser kommt über die Leitbündel.",
      ),
      widget: PhotoLeafSectionExplore,
    },
    {
      type: "widget",
      title: tx("The Elodea experiment", "Der Wasserpest-Versuch"),
      blob: tx("Bubbles you can count! Move the lamp and watch.", "Bläschen zum Zählen! Verschieb die Lampe und schau zu."),
      body: tx(
        "Elodea (Wasserpest) is a water plant. In the light it gives off oxygen bubbles from its cut stem. The number of bubbles per minute is a measure of the **rate of photosynthesis**. Record values at different distances.",
        "Die Wasserpest ist eine Wasserpflanze. Im Licht gibt sie an der Schnittstelle des Stängels Sauerstoffbläschen ab. Die Bläschen pro Minute sind ein Maß für die **Fotosyntheserate**. Notiere Messwerte bei verschiedenen Abständen.",
      ),
      widget: PhotoElodea,
    },
    {
      type: "explain",
      title: tx("The limiting factor", "Der begrenzende Faktor"),
      blob: tx("The weakest link decides. Let's see why.", "Das schwächste Glied entscheidet. Schauen wir, warum."),
      frames: limitingFrames,
    },
    {
      type: "widget",
      title: tx("The limiting factor lab", "Das Faktorenlabor"),
      blob: tx("Push the sliders and find out what's holding the plant back!", "Schieb die Regler und finde heraus, was die Pflanze bremst!"),
      body: tx(
        "The curve shows the rate of photosynthesis against light intensity. Change CO₂ and temperature and watch the curve. Pin a curve to compare. The cards show what a little more of each factor would bring.",
        "Die Kurve zeigt die Fotosyntheserate in Abhängigkeit von der Lichtintensität. Verändere CO₂ und Temperatur und beobachte die Kurve. Merk dir eine Kurve zum Vergleich. Die Karten zeigen, was ein bisschen mehr von jedem Faktor bringen würde.",
      ),
      widget: PhotoLimitingLab,
    },
    { type: "check", blob: tx("A classic exam graph. What holds the plant back at B?", "Ein klassisches Prüfungsdiagramm. Was bremst die Pflanze bei B?"), exercise: checkGraph },
    {
      type: "explain",
      title: tx("Cellular respiration: the opposite", "Zellatmung: das Gegenstück"),
      blob: tx("Plants breathe too. Watch the equation turn around!", "Pflanzen atmen auch. Schau, wie sich die Gleichung umdreht!"),
      frames: respFrames,
    },
    {
      type: "widget",
      title: tx("Day and night", "Tag und Nacht"),
      blob: tx("Play a whole day and watch the gases!", "Spiel einen ganzen Tag ab und beobachte die Gase!"),
      body: tx(
        "During the day photosynthesis and respiration run side by side. The light intensity at which both are equally strong is called the **compensation point**: there the plant gives off as much oxygen as it uses.",
        "Tagsüber laufen Fotosynthese und Zellatmung nebeneinander. Die Lichtintensität, bei der beide gleich stark sind, heißt **Kompensationspunkt**: Dort gibt die Pflanze so viel Sauerstoff ab, wie sie verbraucht.",
      ),
      widget: PhotoDayNight,
    },
    { type: "check", blob: tx("Dim light, what now?", "Schwaches Licht, was nun?"), exercise: checkNight },
    { type: "check", blob: tx("Last one: sort out the two processes.", "Zum Schluss: Bring die beiden Vorgänge auseinander."), exercise: checkMatch },
  ],
  summary: [
    {
      title: tx("Equation of photosynthesis", "Reaktionsgleichung der Fotosynthese"),
      body: tx(
        "In the chloroplasts (mostly in the palisade tissue) light energy is converted into chemical energy and stored in glucose.",
        "In den Chloroplasten (vor allem im Palisadengewebe) wird Lichtenergie in chemische Energie umgewandelt und in Glucose gespeichert.",
      ),
      examples: ["\\ce{6CO2 + 6H2O -> C6H12O6 + 6O2}", tx('"light energy" \\to "chemical energy"', '"Lichtenergie" \\to "chemische Energie"')],
      tone: "rule",
    },
    {
      title: tx("Cellular respiration", "Zellatmung"),
      body: tx(
        "The opposite process: in the mitochondria of every living cell, plants included, day and night. It releases usable energy.",
        "Der Gegenprozess: in den Mitochondrien jeder lebenden Zelle, auch bei Pflanzen, Tag und Nacht. Dabei wird nutzbare Energie frei.",
      ),
      examples: [tx('\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O} + "energy"', '\\ce{C6H12O6 + 6O2 -> 6CO2 + 6H2O} + "Energie"')],
      tone: "rule",
    },
    {
      title: tx("Limiting factor", "Begrenzender Faktor"),
      body: tx(
        "Light intensity, CO₂ concentration and temperature affect the rate. The factor in shortest supply limits it (minimum factor).",
        "Lichtintensität, CO₂-Konzentration und Temperatur beeinflussen die Rate. Der knappste Faktor begrenzt sie (Minimumfaktor).",
      ),
      tone: "rule",
    },
    {
      title: tx("Reading graphs", "Diagramme lesen"),
      body: tx(
        "Rising part: light limits. Plateau: CO₂ or temperature limits; a higher curve with more CO₂ shows that CO₂ was limiting. Above about 35 °C the rate falls (enzymes damaged).",
        "Ansteigender Teil: Licht begrenzt. Plateau: CO₂ oder Temperatur begrenzen; liegt die Kurve mit mehr CO₂ höher, war CO₂ begrenzend. Über etwa 35 °C sinkt die Rate (Enzyme geschädigt).",
      ),
      tone: "tip",
    },
    {
      title: tx("Compensation point", "Kompensationspunkt"),
      body: tx(
        "The light intensity at which photosynthesis and respiration are equally strong: no net gas exchange. Below it the plant takes in O₂ overall.",
        "Die Lichtintensität, bei der Fotosynthese und Zellatmung gleich stark sind: kein Netto-Gasaustausch. Darunter nimmt die Pflanze insgesamt O₂ auf.",
      ),
      examples: [tx('"photosynthesis" = "respiration"', '"Fotosynthese" = "Zellatmung"')],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Plants have mitochondria and respire day and night. Light is energy, not a raw material. More light only helps while light is the limiting factor.",
        "Pflanzen haben Mitochondrien und atmen Tag und Nacht. Licht ist Energie, kein Ausgangsstoff. Mehr Licht hilft nur, solange Licht der begrenzende Faktor ist.",
      ),
      tone: "warning",
    },
  ],
};
