// Level 3 (Experte, Oberstufe) practice: exponential and logistic growth, density factors,
// r and K strategies, Lotka-Volterra, competition and niches, interactions, the nitrogen
// cycle, the lake through the year, primary production and succession.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { EcoNitrogenCyclePicture, NITROGEN } from "@/learn/biology/visuals/EcoCycles";
import { GrowthChart, logT } from "@/learn/biology/visuals/EcoGrowth";
import { EcoLakeProfile, type SeasonId } from "@/learn/biology/visuals/EcoLake";
import { EcoPredatorPreyPicture } from "@/learn/biology/visuals/EcoPredatorPrey";
import { cap, capT, choice, de, en, join, mistakes, numMath, numText, pickN, q, visual } from "./kit";

// ---------------------------------------------------------------------------
// Exponential growth

const GROWERS: { who: Text; unit: Text; unitShort: string; td: number[] }[] = [
  { who: tx("bacteria in a nutrient solution", "Bakterien in einer Nährlösung"), unit: tx("minutes", "Minuten"), unitShort: "min", td: [20, 30] },
  { who: tx("yeast cells in sugar water", "Hefezellen in Zuckerwasser"), unit: tx("hours", "Stunden"), unitShort: "h", td: [2, 3] },
  { who: tx("duckweed plants on a pond", "Wasserlinsen auf einem Teich"), unit: tx("days", "Tage"), unitShort: "d", td: [2, 4] },
  { who: tx("aphids on a rose bush", "Blattläuse an einem Rosenstrauch"), unit: tx("days", "Tage"), unitShort: "d", td: [3, 5] },
];

export function expGrowthTask(rng: Rng, fixed?: { g: number; n0: number; td: number; k: number }): Exercise {
  const g = GROWERS[fixed?.g ?? rng.int(0, GROWERS.length - 1)];
  const n0 = fixed?.n0 ?? rng.pick([50, 100, 200, 250, 500]);
  const td = fixed?.td ?? rng.pick(g.td);
  const k = fixed?.k ?? rng.int(3, 6);
  const t = k * td;
  const value = n0 * 2 ** k;
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: n0 * 2 * k }, tx("Linear instead of exponential", "Linear statt exponentiell"), tx(`You multiplied by 2 · ${k}. But the population doubles ${k} times in a row: 2 · 2 · … = 2^${k}.`, `Du hast mit 2 · ${k} multipliziert. Die Population verdoppelt sich aber ${k}-mal hintereinander: 2 · 2 · … = 2^${k}.`));
  m.add({ kind: "number", value: n0 * (1 + k) }, tx("Added instead of doubled", "Addiert statt verdoppelt"), tx("You added the starting number each time. In exponential growth the population doubles each time, so it grows faster and faster.", "Du hast jedes Mal die Startzahl addiert. Beim exponentiellen Wachstum verdoppelt sich der Bestand jedes Mal, er wächst also immer schneller."));
  m.add({ kind: "number", value: n0 * 2 ** (k - 1) }, tx("One doubling missing", "Eine Verdopplung fehlt"), tx(`${t} ${en(g.unit)} ÷ ${td} ${en(g.unit)} = ${k} doublings. Count again.`, `${t} ${de(g.unit)} : ${td} ${de(g.unit)} = ${k} Verdopplungen. Zähl noch mal.`), true);
  m.add({ kind: "number", value: n0 * 2 ** k + n0 }, tx("Start added twice", "Start doppelt gezählt"), tx(`N(t) = N₀ · 2^${k} already contains the starting population. Don't add it again.`, `N(t) = N₀ · 2^${k} enthält den Anfangsbestand schon. Du musst ihn nicht noch mal addieren.`), true);
  return {
    instruction: tx("Calculate exponential growth", "Berechne exponentielles Wachstum"),
    text: tx(
      `${cap(en(g.who))} double every ${td} ${en(g.unit)}. At the start there are ${en(numText(n0))}. How many are there after ${t} ${en(g.unit)}, if growth is unlimited?`,
      `${cap(de(g.who))} verdoppeln sich alle ${td} ${de(g.unit)}. Am Anfang sind es ${de(numText(n0))}. Wie viele sind es nach ${t} ${de(g.unit)}, wenn das Wachstum unbegrenzt ist?`,
    ),
    answer,
    hint: tx("N(t) = N₀ · 2^(t/t_D). First work out how many doublings there are.", "N(t) = N₀ · 2^(t/t_D). Rechne zuerst aus, wie viele Verdopplungen es sind."),
    solution: [
      { math: `N(t) = N_0 \\cdot 2^{\\frac{t}{t_D}}`, note: tx(`Doublings: ${t} ÷ ${td} = ${k}.`, `Verdopplungen: ${t} : ${td} = ${k}.`) },
      { math: tx(`N = ${n0} \\cdot 2^${k} = ${en(numMath(value))}#r`, `N = ${n0} \\cdot 2^${k} = ${de(numMath(value))}#r`), note: tx(`After ${t} ${en(g.unit)} there are **${en(numText(value))}**.`, `Nach ${t} ${de(g.unit)} sind es **${de(numText(value))}**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

export function doublingTimeTask(rng: Rng): Exercise {
  const n0 = rng.pick([100, 200, 300, 500]);
  const k = rng.int(3, 6);
  const td = rng.pick([15, 20, 30, 40]);
  const t = k * td;
  const n = n0 * 2 ** k;
  const answer: AnswerSpec = { kind: "number", value: td, unit: "min", tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: k }, tx("That's the number of doublings", "Das ist die Zahl der Verdopplungen"), tx(`Right, it doubled ${k} times. Now divide the time by it.`, `Richtig, es gab ${k} Verdopplungen. Teile jetzt die Zeit dadurch.`), true);
  m.add({ kind: "number", value: Math.round((t / 2 ** k) * 100) / 100, tolerance: 0.01 }, tx("Divided by the factor", "Durch den Faktor geteilt"), tx(`The population grew by the factor ${2 ** k} = 2^${k}. Divide the time by the number of doublings (${k}), not by the factor.`, `Die Population wuchs um den Faktor ${2 ** k} = 2^${k}. Teile die Zeit durch die Zahl der Verdopplungen (${k}), nicht durch den Faktor.`));
  return {
    instruction: tx("Find the doubling time", "Bestimme die Verdopplungszeit"),
    text: tx(`A culture of bacteria grows from ${en(numText(n0))} to ${en(numText(n))} cells in ${t} minutes (exponential growth). What is the doubling time?`, `Eine Bakterienkultur wächst in ${t} Minuten von ${de(numText(n0))} auf ${de(numText(n))} Zellen (exponentielles Wachstum). Wie groß ist die Verdopplungszeit?`),
    answer,
    hint: tx("By what factor did it grow? Write it as a power of 2.", "Um welchen Faktor ist sie gewachsen? Schreib ihn als Zweierpotenz."),
    solution: [
      { math: tx(`\\frac{${en(numMath(n))}}{${n0}} = ${2 ** k} = 2^${k}`, `\\frac{${de(numMath(n))}}{${n0}} = ${2 ** k} = 2^${k}`), note: tx(`The population doubled ${k} times.`, `Die Population hat sich ${k}-mal verdoppelt.`) },
      { math: `t_D = \\frac{${t} "min"}{${k}} = ${td}#r "min"`, note: tx(`Doubling time: **${td} min**.`, `Verdopplungszeit: **${td} min**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Logistic growth

function logistic(rng: Rng) {
  const K = rng.pick([400, 500, 600, 800]);
  const r = rng.pick([0.5, 0.6, 0.7, 0.8]);
  return { K, r, n0: 10, T: 20, yMax: 1000, yStep: 200, xStep: 5 };
}

export function logisticReadTask(rng: Rng): Exercise {
  const L = logistic(rng);
  const askHalf = rng.chance(0.45);
  const value = askHalf ? L.K / 2 : L.K;
  const answer: AnswerSpec = { kind: "number", value, tolerance: 25 / value };
  const m = mistakes(answer);
  if (askHalf) {
    m.add({ kind: "number", value: L.K }, tx("That's the capacity", "Das ist die Kapazität"), tx("At K the growth comes to a stop. The growth per time unit is largest halfway up: at K/2.", "Bei K kommt das Wachstum zum Stillstand. Der Zuwachs pro Zeiteinheit ist auf halber Höhe am größten: bei K/2."));
  } else {
    m.add({ kind: "number", value: L.K / 2 }, tx("That's K/2", "Das ist K/2"), tx("That's where growth is fastest. The capacity K is the level the curve flattens out at.", "Dort ist das Wachstum am schnellsten. Die Kapazität K ist der Wert, auf dem die Kurve abflacht."));
  }
  return {
    instruction: tx("Read the logistic growth curve", "Lies die logistische Wachstumskurve ab"),
    text: askHalf
      ? tx("The graph shows the logistic growth of a population. At about which population size is the growth per time unit largest?", "Das Diagramm zeigt das logistische Wachstum einer Population. Bei welcher Populationsgröße ist der Zuwachs pro Zeiteinheit etwa am größten?")
      : tx("The graph shows the logistic growth of a population. How large is the carrying capacity K?", "Das Diagramm zeigt das logistische Wachstum einer Population. Wie groß ist die Kapazität K?"),
    visual: visual(GrowthChart, { n0: L.n0, r: L.r, K: L.K, T: L.T, yMax: L.yMax, yStep: L.yStep, xStep: L.xStep, show: "log" as const }),
    answer,
    hint: askHalf ? tx("Where is the curve steepest?", "Wo ist die Kurve am steilsten?") : tx("Where does the curve level off?", "Wo flacht die Kurve ab?"),
    solution: [
      { math: tx(`K \\approx ${L.K}#k`, `K \\approx ${L.K}#k`), note: tx("The curve levels off at the carrying capacity K.", "Die Kurve flacht bei der Kapazität K ab.") },
      ...(askHalf ? [{ math: tx(`\\frac{K}{2} \\approx ${L.K / 2}#r`, `\\frac{K}{2} \\approx ${L.K / 2}#r`), note: tx("The curve is steepest (inflection point) at K/2: there is the largest growth per time unit.", "Am steilsten ist die Kurve (Wendepunkt) bei K/2: Dort ist der Zuwachs pro Zeiteinheit am größten."), highlight: ["r"] }] : []),
    ],
    mistakes: m.list,
  };
}

export function logisticPointTask(rng: Rng): Exercise {
  const L = logistic(rng);
  const tHalf = logT(L.n0, L.r, L.K, L.K / 2);
  const tLow = logT(L.n0, L.r, L.K, L.K * 0.08);
  const tHigh = logT(L.n0, L.r, L.K, L.K * 0.97);
  const kinds = rng.shuffle(["low", "half", "high"] as const);
  const pts = kinds.map((k, i) => ({ k, t: k === "low" ? tLow : k === "half" ? tHalf : Math.min(L.T - 1, tHigh + 1), label: ["A", "B", "C"][i] }));
  const ask = rng.pick(["half", "high"] as const);
  const options = pts.map((p) => tx(`Point ${p.label}`, `Punkt ${p.label}`));
  const correct = pts.findIndex((p) => p.k === ask);
  const say: Record<"low" | "half" | "high", [Text, Text]> = {
    low: [tx("Still few individuals", "Noch wenige Individuen"), tx("At the start there are few individuals, so the increase per time unit is still small.", "Am Anfang gibt es wenige Individuen, deshalb ist der Zuwachs pro Zeiteinheit noch klein.")],
    half: [tx("That's the steepest point", "Das ist die steilste Stelle"), tx("At K/2 the curve is steepest: there the population grows fastest. Resources don't limit it much yet.", "Bei K/2 ist die Kurve am steilsten: Dort wächst die Population am schnellsten. Die Ressourcen bremsen noch wenig.")],
    high: [tx("Big isn't fast", "Groß heißt nicht schnell"), tx("The population is largest there, but resources are short: it hardly grows any more. Look for the steepest point.", "Dort ist die Population am größten, aber die Ressourcen sind knapp: Sie wächst kaum noch. Such die steilste Stelle.")],
  };
  const list: Mistake[] = pts.filter((p) => p.k !== ask).map((p) => ({ when: { kind: "choice", options, correct: pts.indexOf(p) }, title: say[p.k][0], say: say[p.k][1] }));
  return {
    instruction: tx("Logistic growth: phases", "Logistisches Wachstum: Phasen"),
    text:
      ask === "half"
        ? tx("At which point does the population grow fastest (largest increase per time unit)?", "An welchem Punkt wächst die Population am schnellsten (größter Zuwachs pro Zeiteinheit)?")
        : tx("At which point is the population close to the carrying capacity, so that births and deaths almost balance?", "An welchem Punkt ist die Population nahe der Kapazität, sodass sich Geburten und Todesfälle fast ausgleichen?"),
    visual: visual(GrowthChart, { n0: L.n0, r: L.r, K: L.K, T: L.T, yMax: L.yMax, yStep: L.yStep, xStep: L.xStep, show: "log" as const, points: pts.map((p) => ({ t: p.t, label: p.label })), kLine: true }),
    answer: { kind: "choice", options, correct },
    hint: tx("Growth per time unit = steepness of the curve.", "Zuwachs pro Zeiteinheit = Steigung der Kurve."),
    solution: [{ math: join(q(options[correct], "p"), "\\Rightarrow#r", q(ask === "half" ? tx("N = K/2, steepest", "N = K/2, am steilsten") : tx("N ≈ K, stationary phase", "N ≈ K, stationäre Phase"), "a")), note: say[ask][1], highlight: ["a"] }],
    mistakes: list,
  };
}

export function curveShapeTask(rng: Rng): Exercise {
  const L = logistic(rng);
  const expLetter = rng.pick(["A", "B"]);
  const askExp = rng.chance(0.5);
  const options = [tx("Curve A", "Kurve A"), tx("Curve B", "Kurve B")];
  const expIdx = expLetter === "A" ? 0 : 1;
  const correct = askExp ? expIdx : 1 - expIdx;
  return {
    instruction: tx("Exponential or logistic?", "Exponentiell oder logistisch?"),
    text: askExp
      ? tx("Which curve shows **unlimited (exponential)** growth?", "Welche Kurve zeigt **unbegrenztes (exponentielles)** Wachstum?")
      : tx("Which curve shows growth **limited by resources (logistic)**?", "Welche Kurve zeigt **durch Ressourcen begrenztes (logistisches)** Wachstum?"),
    visual: visual(GrowthChart, { n0: L.n0, r: L.r, K: L.K, T: L.T, yMax: L.yMax, yStep: L.yStep, xStep: L.xStep, show: "both" as const, names: { exp: expLetter, log: expLetter === "A" ? "B" : "A" } }),
    answer: { kind: "choice", options, correct },
    hint: tx("J-shape or S-shape?", "J-Form oder S-Form?"),
    solution: [{ math: tx('"exponential:"#e \\; "J-curve" \\quad "logistic:"#l \\; "S-curve"', '"exponentiell:"#e \\; "J-Kurve" \\quad "logistisch:"#l \\; "S-Kurve"'), note: tx("Unlimited growth gets steeper and steeper (J). Limited growth levels off at K (S).", "Unbegrenztes Wachstum wird immer steiler (J). Begrenztes Wachstum flacht bei K ab (S).") }],
    mistakes: [
      {
        when: { kind: "choice", options, correct: 1 - correct },
        title: tx("J or S?", "J oder S?"),
        say: tx("Exponential growth keeps getting steeper (J-curve). Logistic growth slows down and levels off at the capacity K (S-curve).", "Exponentielles Wachstum wird immer steiler (J-Kurve). Logistisches Wachstum wird langsamer und flacht bei der Kapazität K ab (S-Kurve)."),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Density-dependent or density-independent?

const DEP: Text[] = [
  tx("lack of food", "Nahrungsmangel"),
  tx("an infectious disease spreading", "die Ausbreitung einer Infektionskrankheit"),
  tx("competition for nesting sites", "Konkurrenz um Nistplätze"),
  tx("predators", "Fressfeinde"),
  tx("stress from crowding", "Stress durch Gedränge"),
  tx("parasites", "Parasitenbefall"),
];
const INDEP: Text[] = [tx("a hard frost", "ein strenger Frost"), tx("a flood", "ein Hochwasser"), tx("a summer drought", "eine Dürre im Sommer"), tx("a hailstorm", "ein Hagelsturm"), tx("a cold, wet spring", "ein kalter, nasser Frühling")];
const DD: Text[] = [tx("Density-dependent", "Dichteabhängig"), tx("Density-independent", "Dichteunabhängig")];

export function densityTask(rng: Rng): Exercise {
  const dep = rng.chance(0.55);
  const item = rng.pick(dep ? DEP : INDEP);
  const answer: AnswerSpec = { kind: "choice", options: DD, correct: dep ? 0 : 1 };
  return {
    instruction: tx("Density-dependent or not?", "Dichteabhängig oder nicht?"),
    text: tx(`Is **${en(item)}** a density-dependent or a density-independent factor?`, `**${cap(de(item))}**: dichteabhängiger oder dichteunabhängiger Faktor?`),
    answer,
    hint: tx("Does it hit a crowded population harder than a sparse one?", "Trifft es eine dichte Population stärker als eine dünne?"),
    solution: [
      {
        math: join(q(capT(item), "i"), "\\Rightarrow#r", q(DD[dep ? 0 : 1], "d")),
        note: dep
          ? tx("The denser the population, the stronger it acts: **density-dependent**. Such factors regulate the population around K.", "Je dichter die Population, desto stärker wirkt es: **dichteabhängig**. Solche Faktoren regulieren die Population um K.")
          : tx("It hits every individual regardless of how many there are: **density-independent** (mostly weather).", "Es trifft jedes Individuum, egal wie viele es gibt: **dichteunabhängig** (meist Witterung)."),
        highlight: ["d"],
      },
    ],
    mistakes: [
      dep
        ? { when: { kind: "choice", options: DD, correct: 1 }, title: tx("More crowding, more effect", "Mehr Gedränge, mehr Wirkung"), say: tx("In a dense population food runs out sooner, diseases spread faster, predators find prey more easily. So it depends on density.", "In einer dichten Population wird Nahrung schneller knapp, Krankheiten breiten sich schneller aus, Fressfeinde finden leichter Beute. Es hängt also von der Dichte ab.") }
        : { when: { kind: "choice", options: DD, correct: 0 }, title: tx("Weather doesn't count", "Das Wetter zählt nicht"), say: tx("Frost, floods or drought hit sparse and dense populations alike: the same share dies. That's density-independent.", "Frost, Hochwasser oder Dürre treffen dünne und dichte Populationen gleich: Es stirbt derselbe Anteil. Das ist dichteunabhängig.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// r and K strategies

const K_TRAITS: Text[] = [tx("few offspring", "wenige Nachkommen"), tx("intensive parental care", "intensive Brutpflege"), tx("long life span", "lange Lebensdauer"), tx("late sexual maturity", "späte Geschlechtsreife"), tx("population stays close to K", "Population bleibt nahe K")];
const R_TRAITS: Text[] = [tx("many offspring", "viele Nachkommen"), tx("little or no parental care", "wenig oder keine Brutpflege"), tx("short life span", "kurze Lebensdauer"), tx("early sexual maturity", "frühe Geschlechtsreife"), tx("colonises new habitats quickly", "besiedelt neue Lebensräume schnell")];

export function rkTraitsTask(rng: Rng): Exercise {
  const askK = rng.chance(0.6);
  const right = pickN(rng, askK ? K_TRAITS : R_TRAITS, 3);
  const wrong = pickN(rng, askK ? R_TRAITS : K_TRAITS, 3);
  if (askK && !wrong.includes(R_TRAITS[0])) wrong[0] = R_TRAITS[0];
  if (!askK && !wrong.includes(K_TRAITS[1])) wrong[0] = K_TRAITS[1];
  const items = rng.shuffle([...right.map((t) => ({ t, ok: true })), ...wrong.map((t) => ({ t, ok: false }))]);
  const options = items.map((x) => capT(x.t));
  const correct = items.map((x, i) => (x.ok ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const many = items.findIndex((x) => x.t === R_TRAITS[0]);
  const care = items.findIndex((x) => x.t === K_TRAITS[1]);
  if (!askK && care >= 0) m.add({ kind: "multi", options, correct: [...correct, care].sort((a, b) => a - b) }, tx("r strategists invest little", "r-Strategen investieren wenig"), tx("r strategists put their energy into many offspring, not into caring for a few.", "r-Strategen stecken ihre Energie in viele Nachkommen, nicht in die Pflege weniger."));
  if (askK && many >= 0) m.add({ kind: "multi", options, correct: [...correct, many].sort((a, b) => a - b) }, tx("K strategists have FEW offspring", "K-Strategen haben WENIGE Nachkommen"), tx("K strategists invest a lot in few offspring (parental care). Many offspring with little care is the r strategy.", "K-Strategen investieren viel in wenige Nachkommen (Brutpflege). Viele Nachkommen mit wenig Fürsorge sind die r-Strategie."));
  return {
    instruction: tx("r or K strategy", "r- oder K-Strategie"),
    text: askK ? tx("Which traits are typical of **K strategists**? Select all.", "Welche Merkmale sind typisch für **K-Strategen**? Wähle alle aus.") : tx("Which traits are typical of **r strategists**? Select all.", "Welche Merkmale sind typisch für **r-Strategen**? Wähle alle aus."),
    answer,
    hint: tx("r stands for the growth rate (reproduce fast), K for the capacity (stay near the limit).", "r steht für die Wachstumsrate (schnell vermehren), K für die Kapazität (nahe der Grenze bleiben)."),
    solution: [
      { math: tx('"r:"#r \\; "many offspring, short life"#a', '"r:"#r \\; "viele Nachkommen, kurzes Leben"#a'), note: tx("r strategists: many offspring, little care, short life, early maturity, quick colonisers (e.g. aphids, voles).", "r-Strategen: viele Nachkommen, wenig Brutpflege, kurzes Leben, früh geschlechtsreif, schnelle Besiedler (z. B. Blattläuse, Feldmäuse).") },
      { math: tx('"K:"#r \\; "few offspring, long life"#a', '"K:"#r \\; "wenige Nachkommen, langes Leben"#a'), note: tx("K strategists: few offspring, lots of care, long life, late maturity, population near K (e.g. elephants, humans).", "K-Strategen: wenige Nachkommen, viel Brutpflege, langes Leben, spät geschlechtsreif, Population nahe K (z. B. Elefant, Mensch).") },
    ],
    mistakes: m.list.slice(0, 3),
  };
}

const R_SPECIES: Text[] = [tx("the common vole", "die Feldmaus"), tx("the aphid", "die Blattlaus"), tx("the house fly", "die Stubenfliege"), tx("the dandelion", "der Löwenzahn"), tx("the water flea", "der Wasserfloh")];
const K_SPECIES: Text[] = [tx("the African elephant", "der Afrikanische Elefant"), tx("the golden eagle", "der Steinadler"), tx("the gorilla", "der Gorilla"), tx("the blue whale", "der Blauwal"), tx("the beech", "die Buche")];
const RK: Text[] = [tx("r strategist", "r-Stratege"), tx("K strategist", "K-Stratege")];

export function rkSpeciesTask(rng: Rng): Exercise {
  const isR = rng.chance(0.5);
  const sp = rng.pick(isR ? R_SPECIES : K_SPECIES);
  const answer: AnswerSpec = { kind: "choice", options: RK, correct: isR ? 0 : 1 };
  return {
    instruction: tx("r or K strategist?", "r- oder K-Stratege?"),
    text: tx(`Is ${en(sp)} more of an r strategist or a K strategist?`, `Ist ${de(sp)} eher ein r-Stratege oder ein K-Stratege?`),
    answer,
    hint: tx("Many offspring and short life, or few offspring and long life?", "Viele Nachkommen und kurzes Leben, oder wenige Nachkommen und langes Leben?"),
    solution: [{ math: join(q(capT(sp), "s"), "\\Rightarrow#r", q(RK[isR ? 0 : 1], "k")), note: isR ? tx("Many offspring, fast reproduction, short life: **r strategist**.", "Viele Nachkommen, schnelle Vermehrung, kurzes Leben: **r-Stratege**.") : tx("Few offspring, long life, lots of care or long development: **K strategist**.", "Wenige Nachkommen, langes Leben, viel Brutpflege oder lange Entwicklung: **K-Stratege**."), highlight: ["k"] }],
    mistakes: [
      isR
        ? { when: { kind: "choice", options: RK, correct: 1 }, title: tx("Look at the offspring", "Schau auf die Nachkommen"), say: tx("It has very many offspring in a short time and lives only briefly: that's the r strategy.", "Es hat in kurzer Zeit sehr viele Nachkommen und lebt nur kurz: Das ist die r-Strategie.") }
        : { when: { kind: "choice", options: RK, correct: 0 }, title: tx("Few, but well cared for", "Wenige, aber gut versorgt"), say: tx("It has few offspring, lives long and matures late. K strategists don't have many offspring.", "Es hat wenige Nachkommen, lebt lange und wird spät geschlechtsreif. K-Strategen haben keine vielen Nachkommen.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// Lotka-Volterra

const LV_RULES: Text[] = [
  tx("1st rule (periodic oscillation)", "1. Regel (periodische Schwankung)"),
  tx("2nd rule (constant mean values)", "2. Regel (Konstanz der Mittelwerte)"),
  tx("3rd rule (disturbance of the mean values)", "3. Regel (Störung der Mittelwerte)"),
  tx("None: the statement is wrong", "Keine: Die Aussage ist falsch"),
];
const LV_STATEMENTS: { s: Text; rule: number; wrongAs?: number; why?: Text }[] = [
  { s: tx("The numbers of predator and prey oscillate periodically; the predator maxima follow the prey maxima with a delay.", "Die Individuenzahlen von Räuber und Beute schwanken periodisch; die Maxima der Räuber folgen phasenverzögert auf die der Beute."), rule: 0 },
  { s: tx("Over a long time the average numbers of predator and prey stay constant.", "Über lange Zeit bleiben die Mittelwerte der Individuenzahlen von Räuber und Beute konstant."), rule: 1 },
  { s: tx("If predator and prey are reduced by the same proportion, the prey population recovers faster.", "Werden Räuber und Beute gleich stark dezimiert, erholt sich die Beutepopulation schneller."), rule: 2 },
  { s: tx("The prey population's maximum always comes before the predator's.", "Das Maximum der Beutepopulation liegt immer vor dem der Räuberpopulation."), rule: 0 },
  { s: tx("After a pesticide kills predators and prey equally, the predators increase first.", "Nachdem ein Insektizid Räuber und Beute gleichermaßen getötet hat, nehmen zuerst die Räuber zu."), rule: 3, wrongAs: 2, why: tx("Rule 3 says the opposite: the PREY recovers first, because there are hardly any predators left to eat it.", "Die 3. Regel sagt das Gegenteil: Die BEUTE erholt sich zuerst, weil kaum noch Räuber da sind, die sie fressen.") },
  { s: tx("The predator maxima come before the prey maxima.", "Die Maxima der Räuber liegen zeitlich vor denen der Beute."), rule: 3, wrongAs: 0, why: tx("Classic trap: the prey peaks first. Only then can the predators multiply.", "Klassische Falle: Die Beute hat ihr Maximum zuerst. Erst dann können sich die Räuber vermehren.") },
];

export function lvRuleTask(rng: Rng, idx?: number): Exercise {
  const st = LV_STATEMENTS[idx ?? rng.int(0, LV_STATEMENTS.length - 1)];
  const answer: AnswerSpec = { kind: "choice", options: LV_RULES, correct: st.rule };
  const list: Mistake[] = [];
  if (st.rule === 3 && st.wrongAs !== undefined) list.push({ when: { kind: "choice", options: LV_RULES, correct: st.wrongAs }, title: tx("Read it closely", "Lies genau"), say: st.why! });
  if (st.rule === 0) list.push({ when: { kind: "choice", options: LV_RULES, correct: 1 }, title: tx("Oscillation, not mean", "Schwankung, nicht Mittelwert"), say: tx("This is about the up and down and the delay of the curves: rule 1. Rule 2 is about the mean values.", "Hier geht es um das Auf und Ab und die Verzögerung der Kurven: 1. Regel. Die 2. Regel betrifft die Mittelwerte.") });
  if (st.rule === 1) list.push({ when: { kind: "choice", options: LV_RULES, correct: 2 }, title: tx("Undisturbed", "Ungestört"), say: tx("Rule 3 is about a disturbance (decimation). Here nothing is disturbed: the means just stay the same, rule 2.", "Die 3. Regel betrifft eine Störung (Dezimierung). Hier wird nichts gestört: Die Mittelwerte bleiben einfach gleich, 2. Regel.") });
  if (st.rule === 2) list.push({ when: { kind: "choice", options: LV_RULES, correct: 3 }, title: tx("It's true!", "Das stimmt!"), say: tx("After an equal decimation the prey does recover first: that's exactly rule 3.", "Nach gleich starker Dezimierung erholt sich tatsächlich zuerst die Beute: Das ist genau die 3. Regel.") });
  return {
    instruction: tx("Lotka-Volterra rules", "Lotka-Volterra-Regeln"),
    text: tx(`Which Lotka-Volterra rule does this statement describe? **${en(st.s)}**`, `Welche Lotka-Volterra-Regel beschreibt diese Aussage? **${de(st.s)}**`),
    answer,
    hint: tx("1: oscillation with delay. 2: constant means. 3: after equal decimation the prey recovers first.", "1: Schwankung mit Verzögerung. 2: konstante Mittelwerte. 3: Nach gleich starker Dezimierung erholt sich die Beute zuerst."),
    solution: [{ math: q(LV_RULES[st.rule], "r"), note: st.why ?? tx("Compare with the three rules: oscillation, constant means, faster recovery of the prey.", "Vergleich mit den drei Regeln: Schwankung, konstante Mittelwerte, schnellere Erholung der Beute."), highlight: ["r"] }],
    mistakes: list,
  };
}

export function lvDecimationTask(rng: Rng): Exercise {
  const cutAt = rng.pick([6, 8, 10, 12]);
  const prey0 = rng.pick([50, 60, 70]);
  const pred0 = rng.pick([10, 12, 15]);
  const ask = rng.pick(["first", "pred"] as const);
  const opts =
    ask === "first"
      ? [
          { text: tx("The prey recovers first.", "Die Beute erholt sich zuerst.") },
          { text: tx("The predators recover first.", "Die Räuber erholen sich zuerst."), title: tx("Prey first", "Erst die Beute"), say: tx("The predators need food before they can multiply. With hardly any predators left, the prey can grow almost freely: rule 3.", "Die Räuber brauchen erst Nahrung, bevor sie sich vermehren. Bei kaum noch Räubern wächst die Beute fast ungehindert: 3. Regel.") },
          { text: tx("Both recover at the same speed.", "Beide erholen sich gleich schnell."), title: tx("Not at the same speed", "Nicht gleich schnell"), say: tx("Look at the graph after the dashed line: the prey curve rises at once, the predator curve keeps falling for a while.", "Schau auf das Diagramm nach der gestrichelten Linie: Die Beutekurve steigt sofort, die Räuberkurve fällt noch eine Weile.") },
          { text: tx("Neither recovers: both die out.", "Keine erholt sich: Beide sterben aus."), title: tx("They recover", "Sie erholen sich"), say: tx("In the model both populations recover and keep oscillating around the same mean values.", "Im Modell erholen sich beide Populationen und schwanken weiter um dieselben Mittelwerte.") },
        ]
      : [
          { text: tx("They keep decreasing for a while, because there is still too little prey.", "Sie nehmen noch eine Weile weiter ab, weil es noch zu wenig Beute gibt.") },
          { text: tx("They increase immediately, because there is less competition.", "Sie nehmen sofort zu, weil es weniger Konkurrenz gibt."), title: tx("Food is the limit", "Die Nahrung begrenzt"), say: tx("For the predators the prey is the limiting factor. Right after the decimation there is too little of it.", "Für die Räuber ist die Beute der begrenzende Faktor. Direkt nach der Dezimierung gibt es davon zu wenig.") },
          { text: tx("They stay exactly the same.", "Sie bleiben genau gleich."), title: tx("Look at the curve", "Schau auf die Kurve"), say: tx("Follow the predator curve right after the dashed line: it keeps going down.", "Folge der Räuberkurve direkt nach der gestrichelten Linie: Sie geht weiter nach unten.") },
        ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Interpret the decimation", "Deute die Dezimierung"),
    text:
      ask === "first"
        ? tx("At the dashed line a pesticide reduces predators and prey to 30 % each. Which population recovers first?", "An der gestrichelten Linie dezimiert ein Pflanzenschutzmittel Räuber und Beute jeweils auf 30 %. Welche Population erholt sich zuerst?")
        : tx("At the dashed line predators and prey are reduced to 30 % each. What happens to the predators right afterwards?", "An der gestrichelten Linie werden Räuber und Beute jeweils auf 30 % dezimiert. Was passiert direkt danach mit den Räubern?"),
    visual: visual(EcoPredatorPreyPicture, { prey0, pred0, T: 30, cutAt, keep: 0.3, legend: true }),
    answer,
    hint: tx("What does each population need to grow again?", "Was braucht jede Population, um wieder zu wachsen?"),
    solution: [
      { math: tx('"prey"#b \\uparrow \\quad "predators"#r \\downarrow', '"Beute"#b \\uparrow \\quad "Räuber"#r \\downarrow'), note: tx("Few predators: the prey grows almost unchecked. Few prey: the predators first keep decreasing.", "Wenige Räuber: Die Beute wächst fast ungebremst. Wenig Beute: Die Räuber nehmen zunächst weiter ab.") },
      { math: tx('"3rd Lotka-Volterra rule"#l', '"3. Lotka-Volterra-Regel"#l'), note: tx("After an equal decimation the prey recovers faster than the predators.", "Nach gleich starker Dezimierung erholt sich die Beute schneller als der Räuber.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Competition and niches

const COMP_CASES: { text: Text; right: Text; wrong: [Text, Text, Text][] }[] = [
  {
    text: tx(
      "Gause kept two species of slipper animalcule (Paramecium aurelia and P. caudatum) separately: both grew logistically. In a mixed culture with the same food, P. caudatum died out. How do you explain this?",
      "Gause hielt zwei Pantoffeltierchen-Arten (Paramecium aurelia und P. caudatum) getrennt: Beide wuchsen logistisch. In einer Mischkultur mit derselben Nahrung starb P. caudatum aus. Wie erklärst du das?",
    ),
    right: tx("Competitive exclusion: two species with the same niche cannot coexist permanently.", "Konkurrenzausschluss: Zwei Arten mit derselben Nische können nicht dauerhaft koexistieren."),
    wrong: [
      [tx("P. aurelia ate P. caudatum.", "P. aurelia hat P. caudatum gefressen."), tx("No predator here", "Kein Räuber hier"), tx("Both eat the same bacteria; nobody eats the other. They compete for food.", "Beide fressen dieselben Bakterien; keiner frisst den anderen. Sie konkurrieren um Nahrung.")],
      [tx("P. caudatum can't survive in a culture dish.", "P. caudatum kann in einer Kulturschale nicht überleben."), tx("It survived alone", "Allein überlebte es"), tx("Kept on its own it grew well. It only died out when the competitor was there.", "Allein wuchs es gut. Es starb erst aus, als der Konkurrent dazukam.")],
      [tx("It was a density-independent factor such as the temperature.", "Es war ein dichteunabhängiger Faktor wie die Temperatur."), tx("Same conditions", "Gleiche Bedingungen"), tx("Conditions were the same as in the separate cultures. The difference was the competitor.", "Die Bedingungen waren dieselben wie in den getrennten Kulturen. Der Unterschied war der Konkurrent.")],
    ],
  },
  {
    text: tx(
      "Cormorants and shags fish along the same coast. Cormorants catch mostly flatfish and shrimps near the bottom, shags mostly sand eels and herring in open water. What does this show?",
      "Kormoran und Krähenscharbe fischen an derselben Küste. Der Kormoran fängt vor allem Plattfische und Garnelen am Grund, die Krähenscharbe vor allem Sandaale und Heringe im freien Wasser. Was zeigt das?",
    ),
    right: tx("Avoiding competition by niche differentiation", "Konkurrenzvermeidung durch Einnischung"),
    wrong: [
      [tx("Competitive exclusion: one species will die out", "Konkurrenzausschluss: Eine Art wird aussterben"), tx("Different niches", "Verschiedene Nischen"), tx("Their niches differ (food, depth), so they avoid competition and can coexist.", "Ihre Nischen unterscheiden sich (Nahrung, Tiefe), deshalb vermeiden sie Konkurrenz und können koexistieren.")],
      [tx("Symbiosis between the two bird species", "Symbiose zwischen den beiden Vogelarten"), tx("No mutual benefit", "Kein gegenseitiger Nutzen"), tx("They don't help each other; they simply use different resources.", "Sie helfen sich nicht; sie nutzen einfach verschiedene Ressourcen.")],
      [tx("Intraspecific competition", "Intraspezifische Konkurrenz"), tx("Two species", "Zwei Arten"), tx("Intraspecific means within one species. Here there are two species.", "Intraspezifisch heißt innerhalb einer Art. Hier sind es zwei Arten.")],
    ],
  },
  {
    text: tx(
      "Great tits search for food mostly on the ground and on thick branches, blue tits on thin twigs at the outer edge of the crown, coal tits in the needles of conifers. What does this show?",
      "Kohlmeisen suchen ihre Nahrung vor allem am Boden und an dicken Ästen, Blaumeisen an dünnen Zweigen am Kronenrand, Tannenmeisen in den Nadeln von Nadelbäumen. Was zeigt das?",
    ),
    right: tx("Avoiding competition by niche differentiation", "Konkurrenzvermeidung durch Einnischung"),
    wrong: [
      [tx("Competitive exclusion: one species will die out", "Konkurrenzausschluss: Eine Art wird aussterben"), tx("Different niches", "Verschiedene Nischen"), tx("Each species uses a different part of the tree, so they hardly compete and can coexist.", "Jede Art nutzt einen anderen Teil des Baums, deshalb konkurrieren sie kaum und können koexistieren.")],
      [tx("Intraspecific competition", "Intraspezifische Konkurrenz"), tx("Several species", "Mehrere Arten"), tx("These are three different species: that would be interspecific, and they avoid it.", "Das sind drei verschiedene Arten: Das wäre interspezifisch, und sie vermeiden es.")],
      [tx("Predator and prey relationship", "Räuber-Beute-Beziehung"), tx("No one eats the other", "Keiner frisst den anderen"), tx("The tits don't eat each other: they share the food in the tree.", "Die Meisen fressen sich nicht gegenseitig: Sie teilen sich die Nahrung im Baum.")],
    ],
  },
];

export function competitionTask(rng: Rng): Exercise {
  const c = rng.pick(COMP_CASES);
  const { answer, mistakes: list } = choice(rng, [{ text: c.right }, ...c.wrong.map(([text, title, say]) => ({ text, title, say }))]);
  return {
    instruction: tx("Competition and niche", "Konkurrenz und Nische"),
    text: c.text,
    answer,
    hint: tx("Same niche → one wins. Different niches → they can live side by side.", "Gleiche Nische → einer gewinnt. Verschiedene Nischen → sie können nebeneinander leben."),
    solution: [{ math: q(c.right, "r"), note: tx("Competitive exclusion principle (Gause): species with identical niches cannot coexist. Niche differentiation avoids competition.", "Konkurrenzausschlussprinzip (Gause): Arten mit gleicher Nische können nicht koexistieren. Einnischung vermeidet Konkurrenz.") }],
    mistakes: list,
  };
}

const INTRA: Text[] = [tx("Two male red deer fight over females.", "Zwei Rothirsche kämpfen um Weibchen."), tx("Young beeches in a dense stand compete for light.", "Junge Buchen in einem dichten Bestand ringen um Licht."), tx("Blackbirds defend territories against other blackbirds.", "Amseln verteidigen ihr Revier gegen andere Amseln.")];
const INTER: Text[] = [tx("Fox and buzzard hunt the same voles.", "Fuchs und Mäusebussard jagen dieselben Feldmäuse."), tx("Great tits and nuthatches compete for tree holes.", "Kohlmeisen und Kleiber konkurrieren um Baumhöhlen."), tx("Nettles and grass compete for nitrogen in the soil.", "Brennnesseln und Gras konkurrieren um Stickstoff im Boden.")];
const II: Text[] = [tx("Intraspecific competition", "Intraspezifische Konkurrenz"), tx("Interspecific competition", "Interspezifische Konkurrenz")];

export function intraInterTask(rng: Rng): Exercise {
  const intra = rng.chance(0.5);
  const s = rng.pick(intra ? INTRA : INTER);
  const answer: AnswerSpec = { kind: "choice", options: II, correct: intra ? 0 : 1 };
  return {
    instruction: tx("Intra- or interspecific?", "Intra- oder interspezifisch?"),
    text: s,
    answer,
    hint: tx("intra = within (one species), inter = between (different species).", "intra = innerhalb (einer Art), inter = zwischen (verschiedenen Arten)."),
    solution: [{ math: q(II[intra ? 0 : 1], "r"), note: intra ? tx("Individuals of the same species compete: **intraspecific**. It is density-dependent and limits the population to K.", "Individuen derselben Art konkurrieren: **intraspezifisch**. Sie ist dichteabhängig und begrenzt die Population auf K.") : tx("Different species compete for the same resource: **interspecific**.", "Verschiedene Arten konkurrieren um dieselbe Ressource: **interspezifisch**."), highlight: ["r"] }],
    mistakes: [{ when: { kind: "choice", options: II, correct: intra ? 1 : 0 }, title: tx("intra or inter?", "intra oder inter?"), say: intra ? tx("Both belong to the same species: intra (within).", "Beide gehören zur selben Art: intra (innerhalb).") : tx("These are two different species: inter (between).", "Das sind zwei verschiedene Arten: inter (zwischen).") }],
  };
}

const INTERACTIONS: { name: Text; ex: Text }[] = [
  { name: tx("Symbiosis (+/+)", "Symbiose (+/+)"), ex: tx("lichen: fungus and alga", "Flechte: Pilz und Alge") },
  { name: tx("Parasitism (+/−)", "Parasitismus (+/−)"), ex: tx("tapeworm in the gut of a fox", "Bandwurm im Darm eines Fuchses") },
  { name: tx("Commensalism (+/0)", "Kommensalismus (+/0)"), ex: tx("barnacles on a whale's skin", "Seepocken auf der Haut eines Wals") },
  { name: tx("Competition (−/−)", "Konkurrenz (−/−)"), ex: tx("great tit and nuthatch: tree holes", "Kohlmeise und Kleiber: Baumhöhlen") },
  { name: tx("Predation (+/−)", "Räuber-Beute (+/−)"), ex: tx("lynx hunts roe deer", "Luchs erlegt Reh") },
];

export function interactionMatchTask(rng: Rng): Exercise {
  const picked = pickN(rng, INTERACTIONS, 4);
  const pairs = picked.map((p) => [p.name, p.ex] as [Text, Text]);
  const list: Mistake[] = [];
  const has = (k: number) => picked.includes(INTERACTIONS[k]);
  if (has(1) && has(4)) list.push({ when: { kind: "match", pairs: [[INTERACTIONS[1].name, INTERACTIONS[4].ex]] }, title: tx("Parasite or predator?", "Parasit oder Räuber?"), say: tx("A parasite lives on or in its host and usually keeps it alive. The lynx kills its prey: predation.", "Ein Parasit lebt auf oder in seinem Wirt und lässt ihn meist leben. Der Luchs tötet seine Beute: Räuber-Beute.") });
  if (has(0) && has(2)) list.push({ when: { kind: "match", pairs: [[INTERACTIONS[0].name, INTERACTIONS[2].ex]] }, title: tx("Who profits?", "Wer profitiert?"), say: tx("The whale gets nothing from the barnacles (0): commensalism. In a lichen both partners profit.", "Der Wal hat von den Seepocken nichts (0): Kommensalismus. In der Flechte profitieren beide Partner.") });
  return {
    instruction: tx("Match the interactions", "Ordne die Wechselbeziehungen zu"),
    text: tx("Match each interaction with an example.", "Ordne jeder Wechselbeziehung ein Beispiel zu."),
    answer: { kind: "match", pairs },
    hint: tx("+ = profits, − = harmed, 0 = not affected.", "+ = Vorteil, − = Nachteil, 0 = nicht betroffen."),
    solution: pairs.map((p, i) => ({ math: join(q(p[0], `a${i}`), "\\to", q(p[1], `b${i}`)), note: tx(`${en(p[0])}: ${en(p[1])}.`, `${de(p[0])}: ${de(p[1])}.`) })),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Nitrogen cycle

const N_STEPS: { name: Text; conv: Text; who: Text }[] = [
  { name: tx("Nitrogen fixation", "Stickstofffixierung"), conv: tx("N₂ → NH₄⁺", "N₂ → NH₄⁺"), who: tx("nodule bacteria (rhizobia) in legumes", "Knöllchenbakterien (Rhizobien) in Schmetterlingsblütlern") },
  { name: tx("Ammonification", "Ammonifikation"), conv: tx("proteins, urea → NH₄⁺", "Proteine, Harnstoff → NH₄⁺"), who: tx("decomposers (bacteria, fungi)", "Destruenten (Bakterien, Pilze)") },
  { name: tx("Nitrification", "Nitrifikation"), conv: tx("NH₄⁺ → NO₂⁻ → NO₃⁻", "NH₄⁺ → NO₂⁻ → NO₃⁻"), who: tx("Nitrosomonas and Nitrobacter (aerobic)", "Nitrosomonas und Nitrobacter (aerob)") },
  { name: tx("Denitrification", "Denitrifikation"), conv: tx("NO₃⁻ → N₂", "NO₃⁻ → N₂"), who: tx("denitrifying bacteria (anaerobic)", "denitrifizierende Bakterien (anaerob)") },
];

export function nitrogenMatchTask(rng: Rng, who?: boolean): Exercise {
  const byWho = who ?? rng.chance(0.5);
  const pairs = N_STEPS.map((s) => [s.name, byWho ? s.who : s.conv] as [Text, Text]);
  const list: Mistake[] = [
    { when: { kind: "match", pairs: [[N_STEPS[2].name, byWho ? N_STEPS[3].who : N_STEPS[3].conv]] }, title: tx("Nitri- or denitri-?", "Nitri- oder Denitri-?"), say: tx("Nitrification MAKES nitrate (with oxygen). Denitrification breaks nitrate DOWN to N₂ (without oxygen).", "Nitrifikation BILDET Nitrat (mit Sauerstoff). Denitrifikation baut Nitrat zu N₂ AB (ohne Sauerstoff).") },
    { when: { kind: "match", pairs: [[N_STEPS[1].name, byWho ? N_STEPS[2].who : N_STEPS[2].conv]] }, title: tx("Ammonium comes first", "Erst kommt Ammonium"), say: tx("Ammonification produces ammonium (NH₄⁺) from dead matter. Turning it into nitrate is the next step, nitrification.", "Ammonifikation erzeugt aus toter Biomasse Ammonium (NH₄⁺). Die Umwandlung in Nitrat ist der nächste Schritt, die Nitrifikation.") },
  ];
  return {
    instruction: tx("Nitrogen cycle: match", "Stickstoffkreislauf: Zuordnung"),
    text: byWho ? tx("Match each process with the organisms that carry it out.", "Ordne jedem Vorgang die Lebewesen zu, die ihn durchführen.") : tx("Match each process with the conversion it carries out.", "Ordne jedem Vorgang die Umwandlung zu, die dabei stattfindet."),
    answer: { kind: "match", pairs, distractors: byWho ? [tx("plants (with light energy)", "Pflanzen (mit Lichtenergie)")] : [tx("NO₃⁻ → proteins", "NO₃⁻ → Proteine")] },
    hint: tx("Order of the cycle: N₂ → NH₄⁺ → NO₂⁻ → NO₃⁻ → back to N₂.", "Reihenfolge im Kreislauf: N₂ → NH₄⁺ → NO₂⁻ → NO₃⁻ → zurück zu N₂."),
    solution: N_STEPS.map((s, i) => ({ math: join(q(s.name, `a${i}`), "\\to", q(byWho ? s.who : s.conv, `b${i}`)), note: tx(`${en(s.name)}: ${en(s.conv)}, by ${en(s.who)}.`, `${de(s.name)}: ${de(s.conv)}, durch ${de(s.who)}.`) })),
    mistakes: list,
  };
}

const N_CONFUSE: Record<string, string[]> = {
  fixation: ["denitrification", "ammonification", "uptake"],
  uptake: ["fixation", "nitrification", "feeding"],
  feeding: ["uptake", "death", "ammonification"],
  death: ["ammonification", "feeding", "denitrification"],
  ammonification: ["nitrification", "death", "fixation"],
  nitrification: ["denitrification", "ammonification", "fixation"],
  denitrification: ["nitrification", "fixation", "uptake"],
};

export function nitrogenPictureTask(rng: Rng): Exercise {
  const p = rng.pick(NITROGEN);
  const wrong = N_CONFUSE[p.id].map((id) => NITROGEN.find((x) => x.id === id)!);
  const say = (w: (typeof NITROGEN)[number]): [Text, Text] => {
    if ((p.id === "nitrification" && w.id === "denitrification") || (p.id === "denitrification" && w.id === "nitrification"))
      return [tx("Nitri- or denitri-?", "Nitri- oder Denitri-?"), tx("Nitrification turns ammonium into nitrate. Denitrification turns nitrate back into N₂ gas.", "Nitrifikation macht aus Ammonium Nitrat. Denitrifikation macht aus Nitrat wieder N₂-Gas.")];
    if ((p.id === "fixation" && w.id === "denitrification") || (p.id === "denitrification" && w.id === "fixation"))
      return [tx("Check the direction", "Achte auf die Richtung"), tx("Fixation takes N₂ OUT of the air, denitrification gives N₂ BACK to the air.", "Fixierung holt N₂ AUS der Luft, Denitrifikation gibt N₂ an die Luft ZURÜCK.")];
    return [tx("Another process", "Ein anderer Vorgang"), tx(`Look where the arrow starts and ends. ${en(w.name)}: ${en(w.text)}`, `Schau, wo der Pfeil startet und endet. ${de(w.name)}: ${de(w.text)}`)];
  };
  const { answer, mistakes: list } = choice(rng, [{ text: p.name }, ...wrong.map((w) => ({ text: w.name, title: say(w)[0], say: say(w)[1] }))]);
  return {
    instruction: tx("Name the process in the nitrogen cycle", "Benenne den Vorgang im Stickstoffkreislauf"),
    text: tx("Which process does the arrow marked **?** show?", "Welchen Vorgang zeigt der mit **?** markierte Pfeil?"),
    visual: visual(EcoNitrogenCyclePicture, { ask: p.id }),
    answer,
    hint: tx("Which substance is at the start of the arrow, which at its end?", "Welcher Stoff steht am Anfang des Pfeils, welcher am Ende?"),
    solution: [{ math: q(p.name, "p"), note: p.text, highlight: ["p"] }],
    mistakes: list,
  };
}

const N_WHY: { q: Text; right: Text; wrong: [Text, Text, Text][] }[] = [
  {
    q: tx("Why do farmers grow clover or lupins as \"green manure\" and then plough them in?", "Warum bauen Landwirte Klee oder Lupinen als „Gründünger“ an und pflügen sie danach unter?"),
    right: tx("Nodule bacteria in their roots fix nitrogen from the air; the soil is enriched with nitrogen.", "Knöllchenbakterien in ihren Wurzeln binden Luftstickstoff; der Boden wird mit Stickstoff angereichert."),
    wrong: [
      [tx("Clover takes nitrogen out of the soil, so weeds grow less.", "Klee entzieht dem Boden Stickstoff, deshalb wachsen weniger Unkräuter."), tx("It adds nitrogen", "Er fügt Stickstoff hinzu"), tx("Legumes ADD nitrogen thanks to their nodule bacteria.", "Schmetterlingsblütler FÜGEN dank ihrer Knöllchenbakterien Stickstoff hinzu.")],
      [tx("Clover makes nitrate by photosynthesis.", "Klee stellt durch Fotosynthese Nitrat her."), tx("Photosynthesis makes sugar", "Fotosynthese macht Zucker"), tx("Photosynthesis makes glucose, not nitrate. The nitrogen comes from the air via the nodule bacteria.", "Fotosynthese bildet Glucose, kein Nitrat. Der Stickstoff kommt über die Knöllchenbakterien aus der Luft.")],
      [tx("Ploughing in removes the nitrogen from the soil.", "Durch das Unterpflügen wird dem Boden Stickstoff entzogen."), tx("The other way round", "Umgekehrt"), tx("Ploughing in adds the plants' nitrogen to the soil; decomposers release it as ammonium.", "Durch das Unterpflügen kommt der Stickstoff der Pflanzen in den Boden; Destruenten setzen ihn als Ammonium frei.")],
    ],
  },
  {
    q: tx("Why is nitrogen lost from waterlogged soils?", "Warum geht in staunassen Böden Stickstoff verloren?"),
    right: tx("Without oxygen, denitrifying bacteria turn nitrate into N₂, which escapes into the air.", "Ohne Sauerstoff wandeln denitrifizierende Bakterien Nitrat in N₂ um, das in die Luft entweicht."),
    wrong: [
      [tx("Nitrifying bacteria work especially well without oxygen.", "Nitrifizierende Bakterien arbeiten ohne Sauerstoff besonders gut."), tx("Nitrification needs oxygen", "Nitrifikation braucht Sauerstoff"), tx("Nitrification is aerobic: it needs oxygen. Without oxygen denitrification takes over.", "Nitrifikation ist aerob: Sie braucht Sauerstoff. Ohne Sauerstoff übernimmt die Denitrifikation.")],
      [tx("The water dissolves the N₂ from the air.", "Das Wasser löst den N₂ aus der Luft."), tx("Wrong direction", "Falsche Richtung"), tx("That would add nitrogen, not lose it. Nitrogen is lost as N₂ through denitrification.", "Das würde Stickstoff hinzufügen, nicht entfernen. Verloren geht er als N₂ durch Denitrifikation.")],
      [tx("Nodule bacteria release the nitrogen.", "Knöllchenbakterien geben den Stickstoff ab."), tx("They fix nitrogen", "Sie binden Stickstoff"), tx("Nodule bacteria fix nitrogen; they take it out of the air.", "Knöllchenbakterien binden Stickstoff; sie holen ihn aus der Luft.")],
    ],
  },
];

export function nitrogenWhyTask(rng: Rng): Exercise {
  const Q = rng.pick(N_WHY);
  const { answer, mistakes: list } = choice(rng, [{ text: Q.right }, ...Q.wrong.map(([text, title, say]) => ({ text, title, say }))]);
  return {
    instruction: tx("Explain with the nitrogen cycle", "Erkläre mit dem Stickstoffkreislauf"),
    text: Q.q,
    answer,
    hint: tx("Fixation: N₂ in. Denitrification: N₂ out, only without oxygen.", "Fixierung: N₂ hinein. Denitrifikation: N₂ hinaus, nur ohne Sauerstoff."),
    solution: [{ math: tx('\\ce{N2 -> NH4+ -> NO2- -> NO3- -> N2}', '\\ce{N2 -> NH4+ -> NO2- -> NO3- -> N2}'), note: Q.right }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The lake through the year

const SEASON_NAME: Record<SeasonId, Text> = {
  spring: tx("Spring circulation", "Frühjahrszirkulation"),
  summer: tx("Summer stagnation", "Sommerstagnation"),
  autumn: tx("Autumn circulation", "Herbstzirkulation"),
  winter: tx("Winter stagnation", "Winterstagnation"),
};

export function lakeProfileTask(rng: Rng): Exercise {
  const id = rng.pick(["summer", "winter", "spring", "autumn"] as SeasonId[]);
  const opts: SeasonId[] = ["spring", "summer", "autumn", "winter"];
  const say: Partial<Record<SeasonId, [Text, Text]>> = {
    summer: [tx("Look at the surface", "Schau auf die Oberfläche"), tx("In summer the surface is warm (about 20 °C) and there is a thermocline. Here that's missing.", "Im Sommer ist die Oberfläche warm (etwa 20 °C) und es gibt eine Sprungschicht. Die fehlt hier.")],
    winter: [tx("Inverse layering?", "Umgekehrte Schichtung?"), tx("In winter the coldest water (0 °C, ice) is at the top and 4 °C at the bottom.", "Im Winter liegt das kälteste Wasser (0 °C, Eis) oben und 4 °C am Grund.")],
    spring: [tx("Circulation?", "Zirkulation?"), tx("During circulation the temperature is (almost) the same from top to bottom.", "Bei einer Zirkulation ist die Temperatur von oben bis unten (fast) gleich.")],
    autumn: [tx("Circulation?", "Zirkulation?"), tx("During circulation the temperature is (almost) the same from top to bottom.", "Bei einer Zirkulation ist die Temperatur von oben bis unten (fast) gleich.")],
  };
  // spring and autumn look alike in a profile: don't offer both
  const shown = id === "spring" ? opts.filter((o) => o !== "autumn") : id === "autumn" ? opts.filter((o) => o !== "spring") : opts.filter((o) => o !== (rng.chance(0.5) ? "spring" : "autumn"));
  const { answer, mistakes: list } = choice(rng, [{ text: SEASON_NAME[id] }, ...shown.filter((o) => o !== id).map((o) => ({ text: SEASON_NAME[o], title: say[o]![0], say: say[o]![1] }))]);
  const hints: Record<SeasonId, Text> = {
    summer: tx("Warm on top, thermocline, about 4 °C and little oxygen at the bottom: **summer stagnation**.", "Oben warm, Sprungschicht, unten etwa 4 °C und wenig Sauerstoff: **Sommerstagnation**."),
    winter: tx("0 °C under the ice, 4 °C at the bottom (inverse stratification): **winter stagnation**.", "0 °C unter dem Eis, 4 °C am Grund (umgekehrte Schichtung): **Winterstagnation**."),
    spring: tx("About 4 °C everywhere, oxygen everywhere: the lake is mixed, **spring circulation**.", "Überall etwa 4 °C, überall Sauerstoff: Der See wird durchmischt, **Frühjahrszirkulation**."),
    autumn: tx("Same temperature everywhere (above 4 °C), oxygen everywhere: **autumn circulation**.", "Überall gleiche Temperatur (über 4 °C), überall Sauerstoff: **Herbstzirkulation**."),
  };
  return {
    instruction: tx("Read the lake profile", "Deute das Seeprofil"),
    text: tx("The graph shows temperature and oxygen in a deep lake in Central Europe. Which state of the year does it show?", "Das Diagramm zeigt Temperatur und Sauerstoff in einem tiefen See in Mitteleuropa. Welchen Zustand im Jahresverlauf zeigt es?"),
    visual: visual(EcoLakeProfile, { id }),
    answer,
    hint: tx("Is the temperature the same at all depths (circulation) or layered (stagnation)? Warm or ice-cold at the top?", "Ist die Temperatur in allen Tiefen gleich (Zirkulation) oder geschichtet (Stagnation)? Oben warm oder eiskalt?"),
    solution: [{ math: q(SEASON_NAME[id], "s"), note: hints[id], highlight: ["s"] }],
    mistakes: list,
  };
}

const LAKE_QS: { q: Text; right: Text; wrong: [Text, Text, Text][] }[] = [
  {
    q: tx("Why is there little oxygen in the deep water of a lake at the end of summer?", "Warum ist das Tiefenwasser eines Sees am Ende des Sommers sauerstoffarm?"),
    right: tx("Decomposers use up oxygen there, and because of the stable layering no new oxygen gets down.", "Destruenten verbrauchen dort Sauerstoff, und wegen der stabilen Schichtung gelangt kein neuer Sauerstoff nach unten."),
    wrong: [
      [tx("Warm water holds less oxygen.", "Warmes Wasser kann weniger Sauerstoff lösen."), tx("The deep water is cold", "Das Tiefenwasser ist kalt"), tx("True for the warm surface, but the deep water is only about 4 to 5 °C. The cause is consumption without mixing.", "Das gilt für die warme Oberfläche, aber das Tiefenwasser hat nur etwa 4 bis 5 °C. Die Ursache ist Verbrauch ohne Durchmischung.")],
      [tx("The algae in the deep water use up the oxygen by photosynthesis.", "Die Algen im Tiefenwasser verbrauchen den Sauerstoff durch Fotosynthese."), tx("Photosynthesis makes oxygen", "Fotosynthese bildet Sauerstoff"), tx("Photosynthesis releases oxygen, and it's too dark down there for it anyway.", "Fotosynthese setzt Sauerstoff frei, und in der Tiefe ist es dafür ohnehin zu dunkel.")],
      [tx("The ice cover stops oxygen getting in.", "Die Eisdecke verhindert, dass Sauerstoff hineinkommt."), tx("No ice in summer", "Im Sommer gibt es kein Eis"), tx("In summer there's no ice. The thermocline separates the layers.", "Im Sommer gibt es kein Eis. Die Sprungschicht trennt die Schichten.")],
    ],
  },
  {
    q: tx("Why does a lake freeze from the top and not from the bottom?", "Warum friert ein See von oben und nicht vom Grund her zu?"),
    right: tx("Water is densest at 4 °C. Colder water is lighter and stays on top, where it freezes; ice floats.", "Wasser hat bei 4 °C die größte Dichte. Kälteres Wasser ist leichter, bleibt oben und gefriert dort; Eis schwimmt."),
    wrong: [
      [tx("Cold water is always heavier than warm water.", "Kaltes Wasser ist immer schwerer als warmes."), tx("The density anomaly", "Die Dichteanomalie"), tx("Below 4 °C water gets LIGHTER again. That's the density anomaly of water.", "Unter 4 °C wird Wasser wieder LEICHTER. Das ist die Dichteanomalie des Wassers.")],
      [tx("The sun warms the bottom.", "Die Sonne erwärmt den Grund."), tx("It's about density", "Es geht um die Dichte"), tx("In winter the sun hardly warms the deep water. The reason is the density anomaly.", "Im Winter erwärmt die Sonne das Tiefenwasser kaum. Der Grund ist die Dichteanomalie.")],
      [tx("Fish keep the bottom water warm.", "Fische halten das Tiefenwasser warm."), tx("Fish are cold-blooded", "Fische sind wechselwarm"), tx("Fish don't heat the water. The 4 °C layer at the bottom comes from the density anomaly.", "Fische heizen das Wasser nicht. Die 4-°C-Schicht am Grund kommt von der Dichteanomalie.")],
    ],
  },
  {
    q: tx("What is the significance of the circulation in spring and autumn?", "Welche Bedeutung haben die Zirkulationen im Frühjahr und Herbst?"),
    right: tx("Oxygen reaches the deep water and minerals from the bottom come up to the surface.", "Sauerstoff gelangt ins Tiefenwasser, und Mineralstoffe vom Grund kommen an die Oberfläche."),
    wrong: [
      [tx("The lake warms up evenly to 20 °C.", "Der See erwärmt sich gleichmäßig auf 20 °C."), tx("Mixing at the same temperature", "Mischung bei gleicher Temperatur"), tx("Circulation happens when the whole lake has the same temperature, around 4 °C, not 20 °C.", "Zirkulation passiert, wenn der ganze See gleich temperiert ist, um 4 °C, nicht 20 °C.")],
      [tx("The layers become especially stable.", "Die Schichten werden besonders stabil."), tx("That's stagnation", "Das ist Stagnation"), tx("Stable layers are the stagnation in summer and winter. Circulation means mixing.", "Stabile Schichten sind die Stagnation im Sommer und Winter. Zirkulation heißt Durchmischung.")],
      [tx("All the algae sink to the bottom and die.", "Alle Algen sinken auf den Grund und sterben."), tx("Look at the benefit", "Schau auf den Nutzen"), tx("Mixing brings minerals up, which actually lets algae grow in spring (algal bloom).", "Die Durchmischung bringt Mineralstoffe nach oben, die im Frühjahr sogar das Algenwachstum fördern (Algenblüte).")],
    ],
  },
];

export function lakeWhyTask(rng: Rng): Exercise {
  const Q = rng.pick(LAKE_QS);
  const { answer, mistakes: list } = choice(rng, [{ text: Q.right }, ...Q.wrong.map(([text, title, say]) => ({ text, title, say }))]);
  return {
    instruction: tx("The lake through the year", "Der See im Jahresverlauf"),
    text: Q.q,
    answer,
    hint: tx("Water is densest at 4 °C. Layers only mix when the density is the same everywhere.", "Wasser hat bei 4 °C die größte Dichte. Schichten mischen sich nur, wenn die Dichte überall gleich ist."),
    solution: [{ math: tx('"densest at"#d \\; 4 "°C"#t', '"größte Dichte bei"#d \\; 4 "°C"#t'), note: Q.right }],
    mistakes: list,
  };
}

export function lakeBottomTask(rng: Rng): Exercise {
  const depth = rng.pick([15, 20, 25, 30, 40]);
  const answer: AnswerSpec = { kind: "number", value: 4, unit: "°C", tolerance: 0.1 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 0 }, tx("Only at the top", "Nur oben"), tx("0 °C is only right under the ice. The densest water, at 4 °C, sinks to the bottom.", "0 °C hat nur das Wasser direkt unter dem Eis. Das dichteste Wasser mit 4 °C sinkt zum Grund."));
  m.add({ kind: "number", value: -4 }, tx("Water isn't that cold", "So kalt wird Wasser nicht"), tx("Liquid water at the bottom is above 0 °C. The densest water has 4 °C.", "Flüssiges Wasser am Grund ist über 0 °C. Das dichteste Wasser hat 4 °C."));
  return {
    instruction: tx("Density anomaly", "Dichteanomalie"),
    text: tx(`A ${depth} m deep lake is frozen over in January. What temperature does the water have at the bottom?`, `Ein ${depth} m tiefer See ist im Januar zugefroren. Welche Temperatur hat das Wasser am Grund?`),
    answer,
    hint: tx("At which temperature is water densest?", "Bei welcher Temperatur hat Wasser die größte Dichte?"),
    solution: [{ math: `4#r "°C"`, note: tx("Water is densest at 4 °C, so this water collects at the bottom. Above it lies colder, lighter water and the ice.", "Wasser hat bei 4 °C die größte Dichte und sammelt sich deshalb am Grund. Darüber liegt kälteres, leichteres Wasser und das Eis."), highlight: ["r"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Primary production and efficiency

export function nppTask(rng: Rng, fixed?: { gpp: number; rPct: number }): Exercise {
  const gpp = fixed?.gpp ?? rng.pick([20000, 24000, 30000, 36000, 40000]);
  const rPct = fixed?.rPct ?? rng.pick([40, 45, 50, 55, 60]);
  const resp = (gpp * rPct) / 100;
  const npp = gpp - resp;
  const answer: AnswerSpec = { kind: "number", value: npp, unit: "kJ", tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: resp }, tx("That's the respiration", "Das ist die Atmung"), tx("That's what the plants use up themselves. The net primary production is what's left over.", "Das verbrauchen die Pflanzen selbst. Die Nettoprimärproduktion ist das, was übrig bleibt."));
  m.add({ kind: "number", value: gpp + resp }, tx("Subtract, don't add", "Abziehen, nicht addieren"), tx("Respiration uses up energy: NPP = GPP − R.", "Die Atmung verbraucht Energie: NPP = BPP − R."));
  m.add({ kind: "number", value: gpp * 0.1 }, tx("Not the 10 % rule", "Nicht die 10-%-Regel"), tx("The 10 % rule is about passing energy on to consumers. Here you subtract the plants' own respiration.", "Die 10-%-Regel betrifft die Weitergabe an Konsumenten. Hier ziehst du die Atmung der Pflanzen selbst ab."));
  return {
    instruction: tx("Calculate the net primary production", "Berechne die Nettoprimärproduktion"),
    text: tx(
      `The plants of a meadow fix ${en(numText(gpp))} kJ per m² and year by photosynthesis (gross primary production). They use ${rPct} % of it for their own cellular respiration. How large is the net primary production?`,
      `Die Pflanzen einer Wiese binden pro m² und Jahr ${de(numText(gpp))} kJ durch Fotosynthese (Bruttoprimärproduktion). ${rPct} % davon verbrauchen sie für ihre eigene Zellatmung. Wie groß ist die Nettoprimärproduktion?`,
    ),
    answer,
    hint: tx("NPP = GPP − respiration of the producers.", "NPP = BPP − Zellatmung der Produzenten."),
    solution: [
      { math: tx(`R = ${rPct} "%" \\cdot ${en(numMath(gpp))} = ${en(numMath(resp))} "kJ"`, `R = ${rPct} "%" \\cdot ${de(numMath(gpp))} = ${de(numMath(resp))} "kJ"`), note: tx("First the respiration of the plants.", "Zuerst die Atmung der Pflanzen.") },
      { math: tx('"NPP"#n = "GPP"#b - R#r', '"NPP"#n = "BPP"#b - R#r'), note: tx("Net = gross minus respiration.", "Netto = brutto minus Atmung.") },
      { math: tx(`${en(numMath(gpp))} - ${en(numMath(resp))} = ${en(numMath(npp))}#res "kJ"`, `${de(numMath(gpp))} - ${de(numMath(resp))} = ${de(numMath(npp))}#res "kJ"`), note: tx(`Net primary production: **${en(numText(npp))} kJ** per m² and year. That's the food available to all consumers.`, `Nettoprimärproduktion: **${de(numText(npp))} kJ** pro m² und Jahr. Das steht allen Konsumenten als Nahrung zur Verfügung.`), highlight: ["res"] },
    ],
    mistakes: m.list,
  };
}

export function ecoEfficiencyTask(rng: Rng): Exercise {
  const npp = rng.pick([8000, 10000, 12000, 15000, 20000]);
  const pct = rng.pick([4, 5, 8, 12, 15]);
  const c1 = (npp * pct) / 100;
  const answer: AnswerSpec = { kind: "number", value: pct, unit: "%", tolerance: 0.02 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 100 - pct }, tx("That's the loss", "Das ist der Verlust"), tx("That's the share NOT passed on. Efficiency is the share that arrives at the next level.", "Das ist der Anteil, der NICHT weitergegeben wird. Die Effizienz ist der Anteil, der auf der nächsten Stufe ankommt."));
  m.add({ kind: "number", value: Math.round((npp / c1) * 100) / 100, tolerance: 0.02 }, tx("Upside down", "Verkehrt herum"), tx("Efficiency = higher level ÷ lower level · 100 %.", "Effizienz = höhere Stufe : niedrigere Stufe · 100 %."));
  m.add({ kind: "number", value: pct / 100, tolerance: 0.02 }, tx("Times 100 missing", "Mal 100 fehlt"), tx("As a percentage, multiply the decimal by 100.", "In Prozent musst du die Dezimalzahl noch mal 100 nehmen."), true);
  return {
    instruction: tx("Calculate the ecological efficiency", "Berechne die ökologische Effizienz"),
    text: tx(
      `In a forest the net primary production is ${en(numText(npp))} kJ per m² and year. The primary consumers build up ${en(numText(c1))} kJ of it. What is the ecological efficiency from producers to primary consumers?`,
      `In einem Wald beträgt die Nettoprimärproduktion ${de(numText(npp))} kJ pro m² und Jahr. Die Konsumenten 1. Ordnung bauen davon ${de(numText(c1))} kJ auf. Wie groß ist die ökologische Effizienz von den Produzenten zu den Konsumenten 1. Ordnung?`,
    ),
    answer,
    hint: tx("Efficiency = energy of the higher level ÷ energy of the lower level · 100 %.", "Effizienz = Energie der höheren Stufe : Energie der niedrigeren Stufe · 100 %."),
    solution: [
      { math: tx(`\\frac{${en(numMath(c1))}}{${en(numMath(npp))}} \\cdot 100 "%" = ${pct}#r "%"`, `\\frac{${de(numMath(c1))}}{${de(numMath(npp))}} \\cdot 100 "%" = ${pct}#r "%"`), note: tx(`Ecological efficiency: **${pct} %**. Typical values lie between about 5 and 20 %.`, `Ökologische Effizienz: **${pct} %**. Typische Werte liegen etwa zwischen 5 und 20 %.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Succession

const SUCC: Text[] = [
  tx("Lichens and mosses on bare rock", "Flechten und Moose auf nacktem Gestein"),
  tx("Grasses and herbs", "Gräser und Kräuter"),
  tx("Shrubs such as elder and bramble", "Sträucher wie Holunder und Brombeere"),
  tx("Pioneer trees such as birch and pine", "Pionierbäume wie Birke und Kiefer"),
  tx("Climax community: beech forest", "Klimaxgesellschaft: Buchenwald"),
];

export function successionOrderTask(rng: Rng): Exercise {
  const start = rng.int(0, 1);
  const items = SUCC.slice(start);
  const list: Mistake[] = [];
  if (items.includes(SUCC[3])) list.push({ when: { kind: "order", items: [SUCC[3], SUCC[2]] }, title: tx("Trees come late", "Bäume kommen spät"), say: tx("Trees need deeper soil, which only forms over time. Shrubs come before the pioneer trees.", "Bäume brauchen tieferen Boden, der sich erst mit der Zeit bildet. Sträucher kommen vor den Pionierbäumen.") });
  list.push({ when: { kind: "order", items: [SUCC[4], SUCC[3]] }, title: tx("Pioneers first", "Erst die Pioniere"), say: tx("Beech is a shade-tolerant tree of the final stage. Light-loving pioneer trees such as birch come first.", "Die Buche ist ein schattenverträglicher Baum der Endstufe. Zuerst kommen lichtliebende Pionierbäume wie die Birke.") });
  if (start === 0) list.push({ when: { kind: "order", items: [SUCC[1], SUCC[0]] }, title: tx("Soil first", "Erst der Boden"), say: tx("On bare rock there is no soil yet. Lichens and mosses weather the rock and form the first humus.", "Auf nacktem Gestein gibt es noch keinen Boden. Flechten und Moose verwittern das Gestein und bilden den ersten Humus.") });
  return {
    instruction: tx("Order the stages of succession", "Ordne die Stadien der Sukzession"),
    text: start === 0 ? tx("A glacier has retreated and left bare rock. Put the stages of this primary succession in order.", "Ein Gletscher hat sich zurückgezogen und nacktes Gestein hinterlassen. Ordne die Stadien dieser primären Sukzession.") : tx("A field is no longer farmed. Put the stages of this secondary succession in order.", "Ein Acker wird nicht mehr bewirtschaftet. Ordne die Stadien dieser sekundären Sukzession."),
    answer: { kind: "order", items },
    hint: tx("Soil and shade build up step by step. Undemanding, light-loving species come first.", "Boden und Schatten nehmen Schritt für Schritt zu. Anspruchslose, lichtliebende Arten kommen zuerst."),
    solution: items.map((it, i) => ({ math: q(it, `s${i}`), note: i === items.length - 1 ? tx("The stable final stage: the climax community, in Central Europe usually beech forest.", "Die stabile Endstufe: die Klimaxgesellschaft, in Mitteleuropa meist ein Buchenwald.") : i === 0 ? tx("Pioneers: undemanding, light-loving, fast to spread.", "Pioniere: anspruchslos, lichtliebend, breiten sich schnell aus.") : tx("Soil, shade and diversity increase.", "Boden, Schatten und Vielfalt nehmen zu.") })),
    mistakes: list,
  };
}

const PRIMARY: Text[] = [tx("bare ground left by a retreating glacier", "Gletschervorfeld nach dem Rückzug des Eises"), tx("a new volcanic island", "eine neue Vulkaninsel"), tx("a newly formed sand dune", "eine neu entstandene Sanddüne"), tx("the rock floor of a disused quarry", "der Felsboden eines stillgelegten Steinbruchs")];
const SECONDARY: Text[] = [tx("an abandoned field", "ein aufgegebener Acker"), tx("a clear-felled area of forest", "eine Kahlschlagfläche im Wald"), tx("a meadow that is no longer mown", "eine Wiese, die nicht mehr gemäht wird"), tx("an area after a forest fire", "eine Fläche nach einem Waldbrand")];
const PS: Text[] = [tx("Primary succession", "Primäre Sukzession"), tx("Secondary succession", "Sekundäre Sukzession")];

export function successionTypeTask(rng: Rng): Exercise {
  const prim = rng.chance(0.5);
  const s = rng.pick(prim ? PRIMARY : SECONDARY);
  const answer: AnswerSpec = { kind: "choice", options: PS, correct: prim ? 0 : 1 };
  return {
    instruction: tx("Primary or secondary succession?", "Primäre oder sekundäre Sukzession?"),
    text: tx(`Living things settle on **${en(s)}**. What kind of succession is this?`, `Lebewesen besiedeln **${de(s)}**. Welche Art von Sukzession ist das?`),
    answer,
    hint: tx("Is there already soil with seeds and roots, or does everything start on bare ground?", "Ist schon Boden mit Samen und Wurzeln da, oder beginnt alles auf nacktem Untergrund?"),
    solution: [{ math: q(PS[prim ? 0 : 1], "r"), note: prim ? tx("No soil yet: pioneers start from scratch. **Primary succession**.", "Noch kein Boden: Pioniere fangen bei null an. **Primäre Sukzession**.") : tx("Soil, seeds and roots are already there, so it goes faster: **secondary succession**.", "Boden, Samen und Wurzeln sind schon da, deshalb geht es schneller: **sekundäre Sukzession**."), highlight: ["r"] }],
    mistakes: [
      prim
        ? { when: { kind: "choice", options: PS, correct: 1 }, title: tx("No soil yet", "Noch kein Boden"), say: tx("Here there is no soil at all yet. Succession that starts on bare ground is primary.", "Hier gibt es noch gar keinen Boden. Sukzession auf nacktem Untergrund ist primär.") }
        : { when: { kind: "choice", options: PS, correct: 0 }, title: tx("The soil is still there", "Der Boden ist noch da"), say: tx("The soil with seeds and roots survived the disturbance. That's secondary succession.", "Der Boden mit Samen und Wurzeln hat die Störung überstanden. Das ist sekundäre Sukzession.") },
    ],
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  const k = rng.int(0, 19);
  switch (k) {
    case 0:
      return expGrowthTask(rng);
    case 1:
      return doublingTimeTask(rng);
    case 2:
      return logisticReadTask(rng);
    case 3:
      return logisticPointTask(rng);
    case 4:
      return curveShapeTask(rng);
    case 5:
      return densityTask(rng);
    case 6:
      return rkTraitsTask(rng);
    case 7:
      return rkSpeciesTask(rng);
    case 8:
      return lvRuleTask(rng);
    case 9:
      return lvDecimationTask(rng);
    case 10:
      return competitionTask(rng);
    case 11:
      return intraInterTask(rng);
    case 12:
      return interactionMatchTask(rng);
    case 13:
      return nitrogenMatchTask(rng);
    case 14:
      return nitrogenPictureTask(rng);
    case 15:
      return nitrogenWhyTask(rng);
    case 16:
      return rng.chance(0.5) ? lakeProfileTask(rng) : lakeWhyTask(rng);
    case 17:
      return rng.chance(0.7) ? nppTask(rng) : lakeBottomTask(rng);
    case 18:
      return ecoEfficiencyTask(rng);
    default:
      return rng.chance(0.5) ? successionOrderTask(rng) : successionTypeTask(rng);
  }
}

