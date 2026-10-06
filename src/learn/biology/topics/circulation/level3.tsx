"use client";

// Level 3 (Experte, Oberstufe): haemoglobin and the oxygen dissociation curve (cooperative
// binding, Bohr effect, fetal haemoglobin, myoglobin), the cardiac cycle with pressures and
// valves, the conduction system and the ECG, cardiac output, blood pressure and its
// regulation, and the rhesus factor.

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { HeartBloodTest, type BloodGroup } from "@/learn/biology/visuals/HeartBlood";
import { HeartCycleChart, HeartCycleWidget, PHASES, type Phase } from "@/learn/biology/visuals/HeartCycle";
import { HeartConduction, HeartConductionWidget, HeartEcgStrip } from "@/learn/biology/visuals/HeartEcg";
import { HeartOutputWidget } from "@/learn/biology/visuals/HeartOutput";
import { HeartO2Chart, HeartOxygenWidget, saturation, type CurveKind } from "@/learn/biology/visuals/HeartOxygen";
import { answerFrames, choice, de, en, mistakes, multi, multiFrames, num, orderFrames, q, visual, type Opt } from "./data";

// ---------------------------------------------------------------------------
// Reading the oxygen dissociation curve

const sat = (p: number, pH = 7.4) => Math.round(saturation(p, "adult", pH));

function o2ReadTask(rng: Rng): Exercise {
  const shifted = rng.chance(0.4);
  const pH = shifted ? rng.pick([7.2, 7.6]) : 7.4;
  const p = rng.pick(shifted ? [20, 30, 40, 50] : [20, 30, 40, 50, 60, 80]);
  const value = sat(p, pH);
  const tol = 4 / value;
  const answer: AnswerSpec = { kind: "number", value, tolerance: tol, unit: "%" };
  const m = mistakes(answer);
  if (shifted) {
    const normal = sat(p);
    if (Math.abs(normal - value) > 6) m.add({ kind: "number", value: normal, tolerance: 3 / normal }, tx("Wrong curve", "Falsche Kurve"), tx(`You read the curve for normal blood (pH 7.4). The question asks for the curve at pH ${en(num(pH))}.`, `Du hast die Kurve für normales Blut (pH 7,4) abgelesen. Gefragt ist die Kurve bei pH ${de(num(pH))}.`));
  }
  if (Math.abs(p - value) > 6) m.add({ kind: "number", value: p }, tx("That's the x value", "Das ist der x-Wert"), tx("That's the partial pressure on the x-axis. Go up to the curve and then across to the y-axis.", "Das ist der Partialdruck auf der x-Achse. Geh senkrecht hoch bis zur Kurve und dann waagerecht zur y-Achse."));
  m.add({ kind: "number", value: 100 - value, tolerance: 3 / Math.max(1, 100 - value) }, tx("The other part", "Der andere Teil"), tx("That's the share of haemoglobin **without** oxygen. The y-axis shows the saturation, the loaded share.", "Das ist der Anteil des Hämoglobins **ohne** Sauerstoff. Die y-Achse zeigt die Sättigung, also den beladenen Anteil."));
  const curves = shifted
    ? [{ kind: "adult" as const, pH, label: tx(`pH ${en(num(pH))}`, `pH ${de(num(pH))}`) }, { kind: "adult" as const, color: "var(--ink-3)", dashed: true, width: 2, label: tx("pH 7.4", "pH 7,4") }]
    : [{ kind: "adult" as const }];
  return {
    instruction: tx("Read the curve", "Lies die Kurve ab"),
    text: shifted
      ? tx(`The graph shows the oxygen dissociation curve at pH 7.4 (dashed) and at pH ${en(num(pH))}. Read off: how many percent of the haemoglobin is loaded with oxygen at an O₂ partial pressure of **${p} mmHg** and **pH ${en(num(pH))}**?`, `Die Grafik zeigt die Sauerstoffbindungskurve bei pH 7,4 (gestrichelt) und bei pH ${de(num(pH))}. Lies ab: Wie viel Prozent des Hämoglobins sind bei einem O₂-Partialdruck von **${p} mmHg** und **pH ${de(num(pH))}** mit Sauerstoff beladen?`)
      : tx(`Read off the oxygen dissociation curve: how many percent of the haemoglobin is loaded with oxygen at an O₂ partial pressure of **${p} mmHg**?`, `Lies aus der Sauerstoffbindungskurve ab: Wie viel Prozent des Hämoglobins sind bei einem O₂-Partialdruck von **${p} mmHg** mit Sauerstoff beladen?`),
    visual: visual(HeartO2Chart, { curves }),
    answer,
    hint: tx(`Start at ${p} mmHg on the x-axis, go up to the curve, then across to the y-axis.`, `Starte bei ${p} mmHg auf der x-Achse, geh hoch bis zur Kurve und dann waagerecht zur y-Achse.`),
    solution: [
      { math: tx(`"partial pressure:" ${p}#p "mmHg"`, `"Partialdruck:" ${p}#p "mmHg"`), note: tx("Find the partial pressure on the x-axis.", "Such den Partialdruck auf der x-Achse.") },
      { math: tx(`"saturation" \\approx ${value}#s "%"`, `"Sättigung" \\approx ${value}#s "%"`), note: tx(`Up to the curve and across: about ${value} %. (Readings within a few percent count.)`, `Hoch zur Kurve und waagerecht hinüber: etwa ${value} %. (Ablesewerte auf wenige Prozent genau zählen.)`), highlight: ["s"] },
    ],
    mistakes: m.list,
  };
}

function o2ReleaseTask(rng: Rng): Exercise {
  const a = rng.pick([96, 97, 98]);
  const b = rng.pick([75, 70, 65, 60, 50, 40, 30, 25]);
  const litres = rng.pick([1, 1, 5]);
  const value = 2 * (a - b) * litres;
  const answer: AnswerSpec = { kind: "number", value, tolerance: 0.01, unit: "ml" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 2 * b * litres }, tx("That's what stays bound", "Das bleibt gebunden"), tx("That's the oxygen still bound in the tissue. Released is the **difference** between lungs and tissue.", "Das ist der Sauerstoff, der im Gewebe noch gebunden bleibt. Abgegeben wird die **Differenz** zwischen Lunge und Gewebe."));
  m.add({ kind: "number", value: 2 * a * litres }, tx("That's what was loaded", "Das wurde beladen"), tx("That's what the blood took up in the lungs. Not all of it is released in the tissue.", "So viel hat das Blut in der Lunge aufgenommen. Im Gewebe wird aber nicht alles abgegeben."));
  m.add({ kind: "number", value: a - b }, tx("Percentage points, not ml", "Prozentpunkte, keine ml"), tx(`${a - b} is the difference in percentage points. Convert it: ${a - b} % of 200 ml.`, `${a - b} ist die Differenz in Prozentpunkten. Rechne sie um: ${a - b} % von 200 ml.`));
  if (litres > 1) m.add({ kind: "number", value: 2 * (a - b) }, tx("Per litre only", "Nur pro Liter"), tx(`That's for one litre. The heart pumps ${litres} litres per minute.`, `Das gilt für einen Liter. Das Herz pumpt ${litres} Liter pro Minute.`), true);
  return {
    instruction: tx("Oxygen release", "Sauerstoffabgabe"),
    text: litres === 1
      ? tx(`Fully saturated, 1 l of blood binds about 200 ml of oxygen. In the lungs the haemoglobin is ${a} % saturated, in a working muscle only ${b} %. How many ml of oxygen does **1 l of blood** release in the muscle?`, `Vollständig gesättigt bindet 1 l Blut etwa 200 ml Sauerstoff. In der Lunge ist das Hämoglobin zu ${a} % gesättigt, im arbeitenden Muskel nur noch zu ${b} %. Wie viel ml Sauerstoff gibt **1 l Blut** im Muskel ab?`)
      : tx(`Fully saturated, 1 l of blood binds about 200 ml of oxygen. Saturation is ${a} % in the lungs and ${b} % in the tissues. The heart pumps **5 l of blood per minute**. How many ml of oxygen are released per minute?`, `Vollständig gesättigt bindet 1 l Blut etwa 200 ml Sauerstoff. Die Sättigung beträgt in der Lunge ${a} %, im Gewebe ${b} %. Das Herz pumpt **5 l Blut pro Minute**. Wie viel ml Sauerstoff werden pro Minute abgegeben?`),
    answer,
    hint: tx("Released = (saturation in the lungs − saturation in the tissue) × 200 ml per litre.", "Abgegeben = (Sättigung Lunge − Sättigung Gewebe) · 200 ml pro Liter."),
    solution: [
      { math: tx(`${a} "%" - ${b} "%" = ${a - b}#d "%"`, `${a} "%" - ${b} "%" = ${a - b}#d "%"`), note: tx("The difference in saturation is released.", "Die Differenz der Sättigung wird abgegeben.") },
      { math: tx(`${a - b}#d "%" \\cdot 200 "ml" = ${2 * (a - b)}#e "ml"`, `${a - b}#d "%" \\cdot 200 "ml" = ${2 * (a - b)}#e "ml"`), note: tx("Per litre of blood.", "Pro Liter Blut.") },
      ...(litres > 1 ? [{ math: tx(`${2 * (a - b)}#e "ml" \\cdot 5 = ${value}#r "ml"`, `${2 * (a - b)}#e "ml" \\cdot 5 = ${value}#r "ml"`), note: tx(`Five litres per minute: **${value} ml** oxygen per minute.`, `Fünf Liter pro Minute: **${value} ml** Sauerstoff pro Minute.`), highlight: ["r"] }] : []),
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Bohr effect, fetal haemoglobin, myoglobin

const RIGHT_SHIFT: Text[] = [tx("More CO₂ in the blood", "Mehr CO₂ im Blut"), tx("Falling pH", "Sinkender pH-Wert"), tx("Rising temperature", "Steigende Temperatur")];
const LEFT_SHIFT: Text[] = [tx("Less CO₂ in the blood", "Weniger CO₂ im Blut"), tx("Rising pH", "Steigender pH-Wert"), tx("Falling temperature", "Sinkende Temperatur")];

function bohrTask(rng: Rng): Exercise {
  const v = rng.int(0, 3);
  if (v === 0) {
    const askRight = rng.chance(0.7);
    const yes = askRight ? RIGHT_SHIFT : LEFT_SHIFT;
    const no = askRight ? LEFT_SHIFT : RIGHT_SHIFT;
    const pickYes = rng.shuffle(yes).slice(0, rng.int(2, 3));
    const pickNo = rng.shuffle(no).slice(0, 3);
    const M = multi(rng, [...pickYes.map((t) => ({ text: t, ok: true })), ...pickNo.map((t) => ({ text: t, ok: false }))]);
    const m = mistakes(M.answer);
    m.add({ kind: "multi", options: M.options, correct: M.pick((x) => !x.ok) }, tx("Exactly the other way round", "Genau umgekehrt"), askRight ? tx("You described a **left** shift. Think of a working muscle: lots of CO₂, acidic, warm. There the curve shifts to the right.", "Du hast eine **Links**verschiebung beschrieben. Denk an den arbeitenden Muskel: viel CO₂, sauer, warm. Dort verschiebt sich die Kurve nach rechts.") : tx("You described a **right** shift. In the lungs CO₂ is breathed off and the pH rises: the curve shifts to the left.", "Du hast eine **Rechts**verschiebung beschrieben. In der Lunge wird CO₂ abgeatmet und der pH-Wert steigt: Die Kurve verschiebt sich nach links."));
    const pH = askRight ? en(RIGHT_SHIFT[1]) : en(LEFT_SHIFT[1]);
    const hasPh = pickYes.some((t) => en(t) === pH);
    if (hasPh) m.add({ kind: "multi", options: M.options, correct: M.pick((x) => (x.ok && en(x.text) !== pH) || en(x.text) === (askRight ? en(LEFT_SHIFT[1]) : en(RIGHT_SHIFT[1]))) }, tx("pH direction", "Richtung des pH-Werts"), tx("More CO₂ makes the blood more acidic: the pH **falls**. Low pH = right shift.", "Mehr CO₂ macht das Blut saurer: Der pH-Wert **sinkt**. Niedriger pH = Rechtsverschiebung."));
    return {
      instruction: tx("Select all that apply", "Wähle alle passenden aus"),
      text: askRight ? tx("Which changes shift the oxygen dissociation curve of haemoglobin to the **right**?", "Welche Veränderungen verschieben die Sauerstoffbindungskurve des Hämoglobins nach **rechts**?") : tx("Which changes shift the oxygen dissociation curve of haemoglobin to the **left**?", "Welche Veränderungen verschieben die Sauerstoffbindungskurve des Hämoglobins nach **links**?"),
      answer: M.answer,
      hint: tx("Right shift = conditions in a working muscle: CO₂, acid, heat.", "Rechtsverschiebung = Bedingungen im arbeitenden Muskel: CO₂, Säure, Wärme."),
      solution: multiFrames(askRight ? tx("right shift:", "Rechtsverschiebung:") : tx("left shift:", "Linksverschiebung:"), pickYes, askRight ? tx("Bohr effect: CO₂ and H⁺ ions lower haemoglobin's affinity for O₂, as does heat.", "Bohr-Effekt: CO₂ und H⁺-Ionen senken die O₂-Affinität des Hämoglobins, Wärme ebenso.") : tx("Little CO₂, a high pH and cold raise the affinity: haemoglobin binds O₂ more tightly.", "Wenig CO₂, ein hoher pH-Wert und Kälte erhöhen die Affinität: Hämoglobin bindet O₂ fester.")),
      mistakes: m.list,
    };
  }
  const B: { q: Text; opts: Opt[]; why: Text }[] = [
    {
      q: tx("In a working muscle the CO₂ concentration rises and the pH falls. How does the oxygen dissociation curve change there?", "Im arbeitenden Muskel steigt die CO₂-Konzentration und der pH-Wert sinkt. Wie verändert sich dort die Sauerstoffbindungskurve?"),
      opts: [
        { text: tx("It shifts to the right: haemoglobin releases more O₂.", "Sie verschiebt sich nach rechts: Hämoglobin gibt mehr O₂ ab.") },
        { text: tx("It shifts to the left: haemoglobin releases more O₂.", "Sie verschiebt sich nach links: Hämoglobin gibt mehr O₂ ab."), title: tx("Left and right swapped", "Links und rechts vertauscht"), say: tx("A left shift means **higher** affinity: haemoglobin would hold on to its oxygen. More release needs a right shift.", "Linksverschiebung heißt **höhere** Affinität: Hämoglobin würde den Sauerstoff festhalten. Mehr Abgabe braucht eine Rechtsverschiebung.") },
        { text: tx("It shifts to the right: haemoglobin binds O₂ more tightly.", "Sie verschiebt sich nach rechts: Hämoglobin bindet O₂ fester."), title: tx("Right = lower affinity", "Rechts = geringere Affinität"), say: tx("At the same partial pressure a right-shifted curve shows a **lower** saturation: the binding is weaker.", "Bei gleichem Partialdruck zeigt die nach rechts verschobene Kurve eine **niedrigere** Sättigung: Die Bindung ist schwächer.") },
        { text: tx("It stays the same; only the partial pressure changes.", "Sie bleibt gleich, nur der Partialdruck ändert sich."), title: tx("That's the Bohr effect", "Das ist der Bohr-Effekt"), say: tx("CO₂ and H⁺ ions change haemoglobin's shape and lower its affinity: the curve itself moves (Bohr effect).", "CO₂ und H⁺-Ionen verändern die Form des Hämoglobins und senken seine Affinität: Die Kurve selbst verschiebt sich (Bohr-Effekt).") },
      ],
      why: tx("Bohr effect: more CO₂ and a lower pH shift the curve to the right. The muscle gets extra oxygen exactly where it is working.", "Bohr-Effekt: Mehr CO₂ und ein niedrigerer pH-Wert verschieben die Kurve nach rechts. Der Muskel bekommt genau dort mehr Sauerstoff, wo er arbeitet."),
    },
    {
      q: tx("In the lung capillaries CO₂ diffuses out of the blood. What does this mean for oxygen loading?", "In den Lungenkapillaren diffundiert CO₂ aus dem Blut. Was bedeutet das für die Sauerstoffaufnahme?"),
      opts: [
        { text: tx("The pH rises, the curve shifts left: haemoglobin takes up O₂ more easily.", "Der pH-Wert steigt, die Kurve verschiebt sich nach links: Hämoglobin nimmt O₂ leichter auf.") },
        { text: tx("The pH falls, the curve shifts right: haemoglobin takes up O₂ more easily.", "Der pH-Wert sinkt, die Kurve verschiebt sich nach rechts: Hämoglobin nimmt O₂ leichter auf."), title: tx("Less CO₂, less acid", "Weniger CO₂, weniger Säure"), say: tx("When CO₂ leaves, less carbonic acid is formed: the pH **rises**, and the curve shifts to the left.", "Wenn CO₂ das Blut verlässt, entsteht weniger Kohlensäure: Der pH-Wert **steigt** und die Kurve verschiebt sich nach links.") },
        { text: tx("Nothing: CO₂ and O₂ don't influence each other.", "Nichts, CO₂ und O₂ beeinflussen sich nicht."), title: tx("They do influence each other", "Sie beeinflussen sich doch"), say: tx("That's exactly the Bohr effect: CO₂ and pH change how tightly haemoglobin binds O₂.", "Genau das ist der Bohr-Effekt: CO₂ und pH-Wert verändern, wie fest Hämoglobin O₂ bindet.") },
      ],
      why: tx("Less CO₂, higher pH: left shift, higher affinity. That helps loading in the lungs; in the tissues the right shift helps unloading.", "Weniger CO₂, höherer pH-Wert: Linksverschiebung, höhere Affinität. Das erleichtert die Beladung in der Lunge, im Gewebe erleichtert die Rechtsverschiebung die Abgabe."),
    },
    {
      q: tx("What does a right shift of the curve mean?", "Was bedeutet eine Rechtsverschiebung der Kurve?"),
      opts: [
        { text: tx("At the same partial pressure the saturation is lower: the O₂ affinity has decreased.", "Bei gleichem Partialdruck ist die Sättigung niedriger: Die O₂-Affinität ist gesunken.") },
        { text: tx("At the same partial pressure the saturation is higher: the O₂ affinity has increased.", "Bei gleichem Partialdruck ist die Sättigung höher: Die O₂-Affinität ist gestiegen."), title: tx("Look at one x value", "Schau auf einen x-Wert"), say: tx("Pick one partial pressure and go up: the right-shifted curve lies **lower** there. Less saturation = lower affinity.", "Nimm einen Partialdruck und geh senkrecht hoch: Die nach rechts verschobene Kurve liegt dort **tiefer**. Weniger Sättigung = geringere Affinität.") },
        { text: tx("Haemoglobin can bind more O₂ molecules in total.", "Hämoglobin kann insgesamt mehr O₂-Moleküle binden."), title: tx("Still four", "Weiterhin vier"), say: tx("Each haemoglobin still binds at most four O₂. Only how tightly it binds them changes.", "Jedes Hämoglobin bindet weiterhin höchstens vier O₂. Nur wie fest es sie bindet, ändert sich.") },
      ],
      why: tx("The half-saturation pressure P50 rises: haemoglobin needs a higher partial pressure for the same loading.", "Der Halbsättigungsdruck P50 steigt: Hämoglobin braucht einen höheren Partialdruck für dieselbe Beladung."),
    },
  ];
  const Q = B[v - 1];
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("Bohr effect", "Bohr-Effekt"),
    text: Q.q,
    answer,
    hint: tx("Right shift: lower affinity, more O₂ released. Caused by more CO₂, lower pH, higher temperature.", "Rechtsverschiebung: geringere Affinität, mehr O₂-Abgabe. Ursache: mehr CO₂, niedrigerer pH-Wert, höhere Temperatur."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

const CURVE_ASK: Record<CurveKind, Text> = { myo: tx("to **myoglobin**", "zum **Myoglobin**"), fetal: tx("to **fetal haemoglobin**", "zum **fetalen Hämoglobin**"), adult: tx("to **adult haemoglobin**", "zum **Hämoglobin des Erwachsenen**") };
const LETTERS = ["A", "B", "C"];

function hbTypesTask(rng: Rng): Exercise {
  const v = rng.int(0, 3);
  if (v === 0) {
    const kinds: CurveKind[] = ["myo", "fetal", "adult"];
    const letterOf = rng.shuffle([0, 1, 2]);
    const ask = rng.pick(kinds);
    const options = LETTERS.map((l) => tx(`Curve ${l}`, `Kurve ${l}`));
    const correct = letterOf[kinds.indexOf(ask)];
    const answer: AnswerSpec = { kind: "choice", options, correct };
    const list: Mistake[] = [];
    const confuse: Record<CurveKind, CurveKind[]> = { myo: ["fetal"], fetal: ["adult", "myo"], adult: ["fetal"] };
    for (const c of confuse[ask])
      list.push({
        when: { kind: "choice", options, correct: letterOf[kinds.indexOf(c)] },
        title: tx("Look at shape and position", "Achte auf Form und Lage"),
        say:
          ask === "myo"
            ? tx("Myoglobin has only one subunit, so no cooperative binding: its curve is not S-shaped but hyperbolic, and it lies furthest left.", "Myoglobin hat nur eine Untereinheit, also keine kooperative Bindung: Seine Kurve ist nicht S-förmig, sondern hyperbolisch, und liegt ganz links.")
            : ask === "fetal"
              ? tx("Fetal haemoglobin binds O₂ more tightly than the mother's: it lies **left** of the adult curve, but it is still S-shaped.", "Fetales Hämoglobin bindet O₂ stärker als das der Mutter: Es liegt **links** von der Kurve des Erwachsenen, ist aber weiterhin S-förmig.")
              : tx("Adult haemoglobin has the lowest affinity of the three: its S-shaped curve lies furthest **right**.", "Hämoglobin eines Erwachsenen hat von den dreien die geringste Affinität: Seine S-förmige Kurve liegt am weitesten **rechts**."),
      });
    return {
      instruction: tx("Identify the curve", "Ordne die Kurve zu"),
      text: tx(`The graph shows the binding curves of myoglobin, fetal haemoglobin and adult haemoglobin. Which curve belongs ${en(CURVE_ASK[ask])}?`, `Die Grafik zeigt die Bindungskurven von Myoglobin, fetalem Hämoglobin und Hämoglobin eines Erwachsenen. Welche Kurve gehört ${de(CURVE_ASK[ask])}?`),
      visual: visual(HeartO2Chart, { curves: kinds.map((k, i) => ({ kind: k, label: LETTERS[letterOf[i]] })) }),
      answer,
      hint: tx("The further left, the higher the affinity. Only one curve is not S-shaped.", "Je weiter links, desto höher die Affinität. Nur eine Kurve ist nicht S-förmig."),
      solution: [
        { math: tx('"myoglobin" > "fetal Hb" > "adult Hb"', '"Myoglobin" > "fetales Hb" > "Hb Erwachsener"'), note: tx("Order of affinity, from left to right in the graph.", "Reihenfolge der Affinität, von links nach rechts in der Grafik.") },
        { math: q(options[correct], "a"), note: ask === "myo" ? tx("Myoglobin: hyperbolic, furthest left.", "Myoglobin: hyperbolisch, ganz links.") : ask === "fetal" ? tx("Fetal haemoglobin: S-shaped, left of the adult curve.", "Fetales Hämoglobin: S-förmig, links von der Kurve des Erwachsenen.") : tx("Adult haemoglobin: S-shaped, furthest right.", "Hämoglobin des Erwachsenen: S-förmig, am weitesten rechts."), highlight: ["a"] },
      ],
      mistakes: list,
    };
  }
  const B: { q: Text; opts: Opt[]; why: Text }[] = [
    {
      q: tx("Why is the binding curve of myoglobin hyperbolic and not S-shaped?", "Warum ist die Bindungskurve von Myoglobin hyperbolisch und nicht S-förmig?"),
      opts: [
        { text: tx("Myoglobin has only one subunit, so there is no cooperative binding.", "Myoglobin hat nur eine Untereinheit, deshalb gibt es keine kooperative Bindung.") },
        { text: tx("Myoglobin contains no iron.", "Myoglobin enthält kein Eisen."), title: tx("It has a haem group", "Es hat eine Häm-Gruppe"), say: tx("Myoglobin also binds O₂ at an iron ion in its haem group. The difference is the number of subunits.", "Auch Myoglobin bindet O₂ an einem Eisen-Ion in seiner Häm-Gruppe. Der Unterschied ist die Zahl der Untereinheiten.") },
        { text: tx("Myoglobin binds four O₂ molecules that help each other.", "Myoglobin bindet vier O₂-Moleküle, die sich gegenseitig helfen."), title: tx("That's haemoglobin", "Das ist Hämoglobin"), say: tx("That's haemoglobin's cooperative binding, which causes the S-shape. Myoglobin binds just one O₂.", "Das ist die kooperative Bindung des Hämoglobins, die die S-Form erzeugt. Myoglobin bindet nur ein O₂.") },
      ],
      why: tx("Without cooperativity every binding site is independent: the curve rises steeply right from the start (hyperbola).", "Ohne Kooperativität ist jede Bindungsstelle unabhängig: Die Kurve steigt gleich zu Beginn steil an (Hyperbel)."),
    },
    {
      q: tx("Why is it an advantage that fetal haemoglobin has a higher O₂ affinity than the mother's?", "Warum ist es ein Vorteil, dass fetales Hämoglobin eine höhere O₂-Affinität hat als das der Mutter?"),
      opts: [
        { text: tx("In the placenta it can take over oxygen from the mother's haemoglobin.", "In der Plazenta kann es Sauerstoff vom Hämoglobin der Mutter übernehmen.") },
        { text: tx("It releases oxygen more easily in the tissues of the fetus.", "Es gibt im Gewebe des Fetus leichter Sauerstoff ab."), title: tx("Higher affinity = holds tighter", "Höhere Affinität = hält fester"), say: tx("Higher affinity means it binds **more tightly**. The point is loading: it pulls O₂ away from the mother's blood.", "Höhere Affinität heißt, es bindet **fester**. Der Vorteil liegt bei der Beladung: Es zieht der Mutter den Sauerstoff ab.") },
        { text: tx("The fetus already breathes with its own lungs.", "Der Fetus atmet schon mit seiner eigenen Lunge."), title: tx("No breathing yet", "Noch keine Atmung"), say: tx("Before birth the lungs are filled with fluid. All oxygen comes through the placenta.", "Vor der Geburt sind die Lungen mit Flüssigkeit gefüllt. Der ganze Sauerstoff kommt über die Plazenta.") },
      ],
      why: tx("At the low partial pressures in the placenta the fetal curve (left shifted) is still higher: oxygen moves from mother to child.", "Bei den niedrigen Partialdrücken in der Plazenta liegt die fetale Kurve (nach links verschoben) noch höher: Sauerstoff geht von der Mutter auf das Kind über."),
    },
    {
      q: tx("What is the job of myoglobin in muscle cells?", "Welche Aufgabe hat Myoglobin in den Muskelzellen?"),
      opts: [
        { text: tx("It stores O₂ and releases it only at very low partial pressure, e.g. during hard work.", "Es speichert O₂ und gibt ihn erst bei sehr niedrigem Partialdruck ab, z. B. bei starker Belastung.") },
        { text: tx("It carries O₂ in the blood from the lungs to the muscle.", "Es transportiert O₂ im Blut von der Lunge zum Muskel."), title: tx("That's haemoglobin", "Das macht Hämoglobin"), say: tx("Transport in the blood is haemoglobin's job. Myoglobin sits inside the muscle cells.", "Den Transport im Blut übernimmt Hämoglobin. Myoglobin sitzt in den Muskelzellen.") },
        { text: tx("It releases O₂ already at a high partial pressure.", "Es gibt O₂ schon bei hohem Partialdruck ab."), title: tx("It holds on tight", "Es hält fest"), say: tx("Myoglobin's curve lies far left: it stays almost fully loaded until the partial pressure gets very low.", "Die Kurve von Myoglobin liegt weit links: Es bleibt fast voll beladen, bis der Partialdruck sehr niedrig wird.") },
      ],
      why: tx("Myoglobin takes O₂ from haemoglobin and keeps it as a reserve for times when the supply runs short.", "Myoglobin übernimmt O₂ vom Hämoglobin und hält ihn als Reserve für Zeiten, in denen der Nachschub knapp wird."),
    },
  ];
  const Q = B[v - 1];
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("Haemoglobin and myoglobin", "Hämoglobin und Myoglobin"),
    text: Q.q,
    answer,
    hint: tx("Four subunits that help each other: S-shape. Further left: higher affinity.", "Vier Untereinheiten, die sich helfen: S-Form. Weiter links: höhere Affinität."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Cardiac cycle

const PHASE_NAME = (p: Phase) => PHASES[p].name;
const PHASE_DESCRIPTIONS: Record<Phase, Text[]> = {
  1: [
    tx("All valves are shut and the pressure in the ventricle rises steeply.", "Alle Klappen sind geschlossen, der Druck in der Kammer steigt steil an."),
    tx("The ventricle muscle tenses, but the volume stays the same.", "Die Kammermuskulatur spannt sich an, das Volumen bleibt aber gleich."),
    tx("It begins right after the AV valves shut (first heart sound).", "Sie beginnt direkt nach dem Schließen der Segelklappen (erster Herzton)."),
  ],
  2: [
    tx("The semilunar valves are open and the ventricle volume decreases.", "Die Taschenklappen sind offen, das Kammervolumen nimmt ab."),
    tx("The ventricular pressure reaches its maximum of about 120 mmHg.", "Der Kammerdruck erreicht sein Maximum von etwa 120 mmHg."),
  ],
  3: [
    tx("All valves are shut and the pressure in the ventricle falls steeply.", "Alle Klappen sind geschlossen, der Druck in der Kammer fällt steil ab."),
    tx("It begins right after the semilunar valves shut (second heart sound).", "Sie beginnt direkt nach dem Schließen der Taschenklappen (zweiter Herzton)."),
  ],
  4: [
    tx("The AV valves are open and the ventricle volume increases.", "Die Segelklappen sind offen, das Kammervolumen nimmt zu."),
    tx("At the end of this phase the atria contract.", "Am Ende dieser Phase ziehen sich die Vorhöfe zusammen."),
  ],
};
const VALVE_WHY: Record<Phase, Text> = {
  1: tx("At X the ventricle is in isovolumetric contraction: all valves are shut.", "Bei X ist die Kammer in der Anspannungsphase: Alle Klappen sind geschlossen."),
  2: tx("At X blood is being ejected: only the semilunar valves are open.", "Bei X wird Blut ausgeworfen: Nur die Taschenklappen sind offen."),
  3: tx("At X the ventricle is in isovolumetric relaxation: all valves are shut.", "Bei X ist die Kammer in der Entspannungsphase: Alle Klappen sind geschlossen."),
  4: tx("At X the ventricle is filling: only the AV valves are open.", "Bei X füllt sich die Kammer: Nur die Segelklappen sind offen."),
};
function phaseTrap(right: Phase, picked: Phase): { title: Text; say: Text } {
  const key = `${right}>${picked}`;
  const T: Record<string, [Text, Text]> = {
    "1>2": [tx("Nothing gets out yet", "Noch kommt nichts raus"), tx("As long as the ventricular pressure is below the aortic pressure, the semilunar valves stay shut: no ejection yet.", "Solange der Kammerdruck unter dem Aortendruck liegt, bleiben die Taschenklappen zu: Noch wird nichts ausgeworfen.")],
    "1>3": [tx("Rising, not falling", "Steigend, nicht fallend"), tx("In both phases all valves are shut. But here the ventricle contracts and the pressure **rises**: that's the start of systole.", "In beiden Phasen sind alle Klappen zu. Hier kontrahiert die Kammer aber, der Druck **steigt**: Das ist der Beginn der Systole.")],
    "3>1": [tx("Falling, not rising", "Fallend, nicht steigend"), tx("In both phases all valves are shut. But here the ventricle relaxes and the pressure **falls**: that's the start of diastole.", "In beiden Phasen sind alle Klappen zu. Hier erschlafft die Kammer aber, der Druck **fällt**: Das ist der Beginn der Diastole.")],
    "3>4": [tx("Not filling yet", "Noch keine Füllung"), tx("The AV valves only open when the ventricular pressure has fallen below the atrial pressure. Until then the volume stays the same.", "Die Segelklappen öffnen erst, wenn der Kammerdruck unter den Vorhofdruck gefallen ist. Bis dahin bleibt das Volumen gleich.")],
    "2>1": [tx("Valves already open", "Klappen schon offen"), tx("Blood is already leaving: the semilunar valves are open. That's ejection.", "Es fließt schon Blut hinaus: Die Taschenklappen sind offen. Das ist die Austreibung.")],
    "4>3": [tx("Valves already open", "Klappen schon offen"), tx("Blood is already flowing in through the open AV valves: that's filling.", "Es strömt schon Blut durch die offenen Segelklappen ein: Das ist die Füllung.")],
  };
  const t = T[key];
  return t ? { title: t[0], say: t[1] } : { title: tx("Check the valves", "Prüf die Klappen"), say: tx("Ask two questions: which valves are open, and does the pressure or volume change?", "Stell zwei Fragen: Welche Klappen sind offen, und ändert sich Druck oder Volumen?") };
}

function cyclePhaseTask(rng: Rng): Exercise {
  const fromChart = rng.chance(0.5);
  const order = rng.shuffle([1, 2, 3, 4] as Phase[]);
  if (fromChart) {
    const times: Record<Phase, number[]> = { 1: [0.22, 0.235], 2: [0.28, 0.33, 0.38, 0.44, 0.48], 3: [0.53, 0.55], 4: [0.05, 0.1, 0.15, 0.64, 0.7, 0.76] };
    const p = rng.pick([1, 2, 3, 4, 2, 4] as Phase[]);
    const t = rng.pick(times[p]);
    const askValves = rng.chance(0.4);
    if (askValves) {
      const V: Text[] = [tx("Only the AV valves (Segelklappen)", "Nur die Segelklappen"), tx("Only the semilunar valves (Taschenklappen)", "Nur die Taschenklappen"), tx("None: all valves are shut", "Keine: Alle Klappen sind geschlossen"), tx("Both kinds", "Beide Arten")];
      const right = p === 4 ? 0 : p === 2 ? 1 : 2;
      const ord = rng.shuffle([0, 1, 2, 3]);
      const options = ord.map((i) => V[i]);
      const answer: AnswerSpec = { kind: "choice", options, correct: ord.indexOf(right) };
      const list: Mistake[] = [{ when: { kind: "choice", options, correct: ord.indexOf(3) }, title: tx("Never both", "Nie beide"), say: tx("AV and semilunar valves are never open at the same time: blood would rush straight from the atrium into the aorta.", "Segel- und Taschenklappen sind nie gleichzeitig offen: Sonst flösse das Blut direkt vom Vorhof in die Aorta.") }];
      if (p === 1 || p === 3) list.push({ when: { kind: "choice", options, correct: ord.indexOf(p === 1 ? 1 : 0) }, title: tx("Look at the volume", "Schau aufs Volumen"), say: tx("At X the ventricle volume doesn't change. So no valve is open: blood can neither leave nor enter.", "Bei X ändert sich das Kammervolumen nicht. Also ist keine Klappe offen: Blut kann weder hinaus noch hinein.") });
      if (p === 2) list.push({ when: { kind: "choice", options, correct: ord.indexOf(0) }, title: tx("Volume falls", "Volumen sinkt"), say: tx("At X the ventricle volume falls and the pressure is high: blood leaves through the semilunar valves.", "Bei X sinkt das Kammervolumen und der Druck ist hoch: Blut verlässt die Kammer durch die Taschenklappen.") });
      if (p === 4) list.push({ when: { kind: "choice", options, correct: ord.indexOf(1) }, title: tx("Volume rises", "Volumen steigt"), say: tx("At X the ventricle fills: blood flows in from the atrium through the AV valves.", "Bei X füllt sich die Kammer: Blut strömt aus dem Vorhof durch die Segelklappen ein.") });
      return {
        instruction: tx("Read the cardiac cycle", "Lies den Herzzyklus ab"),
        text: tx("The diagram shows the ECG, the pressures in the left ventricle (red), aorta (purple) and left atrium (blue) and the ventricle volume (grey). Which heart valves of the left heart are **open** at time **X**?", "Das Diagramm zeigt EKG, die Drücke in linker Kammer (rot), Aorta (lila) und linkem Vorhof (blau) sowie das Kammervolumen (grau). Welche Herzklappen des linken Herzens sind zum Zeitpunkt **X** **geöffnet**?"),
        visual: visual(HeartCycleChart, { mark: t, letters: true }),
        answer,
        hint: tx("A valve is open when the pressure in front of it is higher than behind it. Is the volume changing?", "Eine Klappe ist offen, wenn der Druck vor ihr höher ist als dahinter. Ändert sich das Volumen?"),
        solution: answerFrames(V[right], VALVE_WHY[p], { math: q(PHASE_NAME(p), "p"), note: PHASES[p].text }),
        mistakes: list,
      };
    }
    const options = order.map(PHASE_NAME);
    const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(p) };
    const list: Mistake[] = order
      .filter((x) => x !== p)
      .map((x) => ({ when: { kind: "choice", options, correct: order.indexOf(x) } as AnswerSpec, ...phaseTrap(p, x) }));
    return {
      instruction: tx("Read the cardiac cycle", "Lies den Herzzyklus ab"),
      text: tx("The diagram shows the ECG, the pressures in the left ventricle (red), aorta (purple) and left atrium (blue) and the ventricle volume (grey). In which phase is the heart at time **X**?", "Das Diagramm zeigt EKG, die Drücke in linker Kammer (rot), Aorta (lila) und linkem Vorhof (blau) sowie das Kammervolumen (grau). In welcher Phase befindet sich das Herz zum Zeitpunkt **X**?"),
      visual: visual(HeartCycleChart, { mark: t, letters: true }),
      answer,
      hint: tx("Is the volume changing? Is the ventricular pressure above the aortic pressure or below the atrial pressure?", "Ändert sich das Volumen? Liegt der Kammerdruck über dem Aortendruck oder unter dem Vorhofdruck?"),
      solution: answerFrames(PHASE_NAME(p), PHASES[p].text),
      mistakes: list.slice(0, 3),
    };
  }
  const p = rng.pick([1, 2, 3, 4] as Phase[]);
  const d = rng.pick(PHASE_DESCRIPTIONS[p]);
  const options = order.map(PHASE_NAME);
  const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(p) };
  const list: Mistake[] = order.filter((x) => x !== p).map((x) => ({ when: { kind: "choice", options, correct: order.indexOf(x) } as AnswerSpec, ...phaseTrap(p, x) }));
  return {
    instruction: tx("Phases of the cardiac cycle", "Phasen des Herzzyklus"),
    text: tx(`Which phase of the cardiac cycle is described? **${en(d)}**`, `Welche Phase des Herzzyklus wird beschrieben? **${de(d)}**`),
    answer,
    hint: tx("Systole: isovolumetric contraction, ejection. Diastole: isovolumetric relaxation, filling.", "Systole: Anspannungs- und Austreibungsphase. Diastole: Entspannungs- und Füllungsphase."),
    solution: answerFrames(PHASE_NAME(p), PHASES[p].text),
    mistakes: list.slice(0, 3),
  };
}

const VALVE_EVENTS: Text[] = [tx("AV valves shut", "Segelklappen schließen"), tx("Semilunar valves open", "Taschenklappen öffnen"), tx("Semilunar valves shut", "Taschenklappen schließen"), tx("AV valves open", "Segelklappen öffnen")];

function cycleOrderTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const start = rng.int(0, 3);
    const ps = [0, 1, 2, 3].map((i) => (((start + i) % 4) + 1) as Phase);
    const items = ps.map(PHASE_NAME);
    const has = (a: Phase, b: Phase) => ps.indexOf(a) < ps.indexOf(b);
    const list: Mistake[] = [];
    if (has(1, 2)) list.push({ when: { kind: "order", items: [PHASE_NAME(2), PHASE_NAME(1)] }, title: tx("Tension before ejection", "Erst Anspannung, dann Austreibung"), say: tx("The ventricle first has to build up pressure with all valves shut. Only when it exceeds the aortic pressure does ejection start.", "Die Kammer muss erst bei geschlossenen Klappen Druck aufbauen. Erst wenn er den Aortendruck übersteigt, beginnt die Austreibung.") });
    if (has(3, 4)) list.push({ when: { kind: "order", items: [PHASE_NAME(4), PHASE_NAME(3)] }, title: tx("Relax before filling", "Erst Entspannung, dann Füllung"), say: tx("After ejection the pressure first has to fall below the atrial pressure, with all valves shut. Only then do the AV valves open.", "Nach der Austreibung muss der Druck erst bei geschlossenen Klappen unter den Vorhofdruck fallen. Dann öffnen sich die Segelklappen.") });
    return {
      instruction: tx("Order the phases", "Ordne die Phasen"),
      text: tx(`Put the four phases of the cardiac cycle in order, starting with the **${en(items[0]).toLowerCase()}** phase.`, `Bring die vier Phasen des Herzzyklus in die richtige Reihenfolge. Beginne mit der **${de(items[0])}**.`),
      answer: { kind: "order", items },
      hint: tx("Systole: tension, then ejection. Diastole: relaxation, then filling.", "Systole: Anspannung, dann Austreibung. Diastole: Entspannung, dann Füllung."),
      solution: orderFrames(items, ps.map((p) => PHASES[p].text)),
      mistakes: list,
    };
  }
  const start = rng.int(0, 3);
  const idx = [0, 1, 2, 3].map((i) => (start + i) % 4);
  const items = idx.map((i) => VALVE_EVENTS[i]);
  const list: Mistake[] = [];
  const pos = (i: number) => idx.indexOf(i);
  if (pos(0) < pos(1)) list.push({ when: { kind: "order", items: [VALVE_EVENTS[1], VALVE_EVENTS[0]] }, title: tx("Never both open", "Nie beide offen"), say: tx("If the semilunar valves opened before the AV valves shut, both would be open at once. First the AV valves shut, then the pressure rises, then the semilunar valves open.", "Öffneten die Taschenklappen, bevor die Segelklappen schließen, wären beide gleichzeitig offen. Erst schließen die Segelklappen, dann steigt der Druck, dann öffnen die Taschenklappen.") });
  if (pos(2) < pos(3)) list.push({ when: { kind: "order", items: [VALVE_EVENTS[3], VALVE_EVENTS[2]] }, title: tx("Never both open", "Nie beide offen"), say: tx("First the semilunar valves shut (second heart sound), then the pressure falls, then the AV valves open.", "Erst schließen die Taschenklappen (zweiter Herzton), dann fällt der Druck, dann öffnen die Segelklappen.") });
  return {
    instruction: tx("Valve events in order", "Klappenereignisse ordnen"),
    text: tx(`Put the valve events of one heartbeat in order, starting with **${en(items[0])}**.`, `Bring die Klappenereignisse eines Herzschlags in die richtige Reihenfolge. Beginne mit: **${de(items[0])}**.`),
    answer: { kind: "order", items },
    hint: tx("Between two events there's always a phase with all valves shut.", "Zwischen zwei Ereignissen liegt immer eine Phase, in der alle Klappen zu sind."),
    solution: orderFrames(items, idx.map((i) => [tx("First heart sound: isovolumetric contraction begins.", "Erster Herzton: Die Anspannungsphase beginnt."), tx("Ventricular pressure exceeds aortic pressure: ejection.", "Kammerdruck übersteigt Aortendruck: Austreibung."), tx("Second heart sound: isovolumetric relaxation begins.", "Zweiter Herzton: Die Entspannungsphase beginnt."), tx("Ventricular pressure below atrial pressure: filling.", "Kammerdruck unter Vorhofdruck: Füllung.")][i])),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Conduction system and ECG

const CONDUCTION: { name: Text; note: Text }[] = [
  { name: tx("Sinus node", "Sinusknoten"), note: tx("The sinus node in the wall of the right atrium excites itself: the pacemaker.", "Der Sinusknoten in der Wand des rechten Vorhofs erregt sich selbst: der Schrittmacher.") },
  { name: tx("Atrial muscle", "Vorhofmuskulatur"), note: tx("The excitation spreads over both atria (P wave).", "Die Erregung breitet sich über beide Vorhöfe aus (P-Welle).") },
  { name: tx("AV node", "AV-Knoten"), note: tx("The AV node delays it by about 0.1 s (PQ segment).", "Der AV-Knoten verzögert sie um etwa 0,1 s (PQ-Strecke).") },
  { name: tx("Bundle of His", "His-Bündel"), note: tx("The bundle of His passes it through the valve plane into the septum.", "Das His-Bündel leitet sie durch die Ventilebene in die Scheidewand.") },
  { name: tx("Bundle branches", "Tawara-Schenkel"), note: tx("Right and left bundle branches run down to the apex.", "Rechter und linker Tawara-Schenkel laufen zur Herzspitze.") },
  { name: tx("Purkinje fibres", "Purkinje-Fasern"), note: tx("The Purkinje fibres spread it into the ventricle muscle.", "Die Purkinje-Fasern verteilen sie in die Kammermuskulatur.") },
  { name: tx("Ventricular muscle", "Kammermuskulatur"), note: tx("The ventricles are excited and contract (QRS complex).", "Die Kammern sind erregt und kontrahieren (QRS-Komplex).") },
];

function conductionOrderTask(rng: Rng, all = false): Exercise {
  const keep = all ? CONDUCTION.map((_, i) => i) : CONDUCTION.map((_, i) => i).filter((i) => i === 0 || rng.chance(0.75));
  const ids = keep.length >= 4 ? keep : [0, 2, 3, 5];
  const items = ids.map((i) => CONDUCTION[i].name);
  const has = (i: number) => ids.includes(i);
  const list: Mistake[] = [];
  if (has(0) && has(2)) list.push({ when: { kind: "order", items: [CONDUCTION[2].name, CONDUCTION[0].name] }, title: tx("The sinus node sets the pace", "Der Sinusknoten gibt den Takt vor"), say: tx("The sinus node is the primary pacemaker: everything starts there. The AV node is only the relay station.", "Der Sinusknoten ist der primäre Schrittmacher: Dort beginnt alles. Der AV-Knoten ist nur die Umschaltstelle.") });
  if (has(3) && has(4)) list.push({ when: { kind: "order", items: [CONDUCTION[4].name, CONDUCTION[3].name] }, title: tx("Bundle, then branches", "Erst Bündel, dann Schenkel"), say: tx("The bundle of His is the trunk; it splits into the two bundle branches (Tawara-Schenkel).", "Das His-Bündel ist der Stamm, es teilt sich in die beiden Tawara-Schenkel.") });
  if (has(4) && has(5)) list.push({ when: { kind: "order", items: [CONDUCTION[5].name, CONDUCTION[4].name] }, title: tx("Purkinje fibres are the ends", "Purkinje-Fasern sind die Enden"), say: tx("The Purkinje fibres are the fine end branches in the ventricle walls, after the bundle branches.", "Die Purkinje-Fasern sind die feinen Endverzweigungen in der Kammerwand, nach den Tawara-Schenkeln.") });
  return {
    instruction: tx("Conduction of the excitation", "Erregungsleitung"),
    text: tx("Put the stations of the excitation in the heart in order.", "Bring die Stationen der Erregung im Herzen in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("From the right atrium via the AV node down the septum to the apex and into the ventricle walls.", "Vom rechten Vorhof über den AV-Knoten in der Scheidewand zur Herzspitze und in die Kammerwände."),
    solution: orderFrames(items, ids.map((i) => CONDUCTION[i].note)),
    mistakes: list,
  };
}

type CondPart = "sa" | "avnode" | "his" | "tawara" | "purkinje";
const COND_PART: Record<CondPart, Text> = { sa: CONDUCTION[0].name, avnode: CONDUCTION[2].name, his: CONDUCTION[3].name, tawara: CONDUCTION[4].name, purkinje: CONDUCTION[5].name };
const COND_WHY: Record<CondPart, Text> = {
  sa: tx("In the wall of the right atrium near the superior vena cava: the sinus node.", "In der Wand des rechten Vorhofs nahe der oberen Hohlvene: der Sinusknoten."),
  avnode: tx("At the border between atria and ventricles, near the septum: the AV node.", "An der Grenze zwischen Vorhöfen und Kammern, nahe der Scheidewand: der AV-Knoten."),
  his: tx("The short trunk through the valve plane into the septum: the bundle of His.", "Der kurze Stamm durch die Ventilebene in die Scheidewand: das His-Bündel."),
  tawara: tx("The two branches running down the septum: the bundle branches.", "Die beiden Äste, die in der Scheidewand nach unten laufen: die Tawara-Schenkel."),
  purkinje: tx("The fine fibres in the ventricle walls: the Purkinje fibres.", "Die feinen Fasern in den Kammerwänden: die Purkinje-Fasern."),
};

function conductionPictureTask(rng: Rng): Exercise {
  const id = rng.pick(Object.keys(COND_PART) as CondPart[]);
  const others = (Object.keys(COND_PART) as CondPart[]).filter((x) => x !== id);
  const opts: Opt[] = [{ text: COND_PART[id] }, ...rng.shuffle(others).slice(0, 3).map((o) => ({ text: COND_PART[o], title: tx("Follow the path", "Folge dem Weg"), say: tx("Follow the excitation: sinus node (right atrium) → AV node (valve plane) → bundle of His → bundle branches (septum) → Purkinje fibres (walls).", "Folge der Erregung: Sinusknoten (rechter Vorhof) → AV-Knoten (Ventilebene) → His-Bündel → Tawara-Schenkel (Scheidewand) → Purkinje-Fasern (Kammerwände).") }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("The conduction system", "Das Erregungsleitungssystem"),
    text: tx("What is the structure marked **?** called?", "Wie heißt die mit **?** markierte Struktur?"),
    visual: visual(HeartConduction, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx("The heart is drawn from the front: the right atrium is on the left of the picture.", "Das Herz ist von vorn gezeichnet: Der rechte Vorhof ist links im Bild."),
    solution: answerFrames(COND_PART[id], COND_WHY[id]),
    mistakes: list,
  };
}

const WAVES: { id: "P" | "PQ" | "QRS" | "T"; name: Text; event: Text }[] = [
  { id: "P", name: tx("P wave", "P-Welle"), event: tx("excitation of the atria", "Erregung der Vorhöfe") },
  { id: "PQ", name: tx("PQ segment", "PQ-Strecke"), event: tx("delay in the AV node", "Verzögerung im AV-Knoten") },
  { id: "QRS", name: tx("QRS complex", "QRS-Komplex"), event: tx("excitation of the ventricles", "Erregung der Kammern") },
  { id: "T", name: tx("T wave", "T-Welle"), event: tx("recovery of the ventricles", "Erregungsrückbildung der Kammern") },
];
const WAVE_DISTRACT: Text[] = [tx("closing of the heart valves", "Schließen der Herzklappen"), tx("recovery of the atria (clearly visible)", "Erregungsrückbildung der Vorhöfe (gut sichtbar)")];

function ecgTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const pick = rng.shuffle(WAVES).slice(0, rng.int(3, 4));
    const pairs = pick.map((w) => [w.name, w.event] as [Text, Text]);
    const distractors = [rng.pick(WAVE_DISTRACT)];
    const list: Mistake[] = [];
    const P = pick.find((w) => w.id === "P");
    const QRS = pick.find((w) => w.id === "QRS");
    const T = pick.find((w) => w.id === "T");
    if (P && QRS) list.push({ when: { kind: "match", pairs: [[P.name, QRS.event], [QRS.name, P.event]] }, title: tx("Atria come first", "Die Vorhöfe kommen zuerst"), say: tx("The excitation starts in the atria: the small P wave. The big QRS complex is the ventricles with their large muscle mass.", "Die Erregung beginnt in den Vorhöfen: die kleine P-Welle. Der große QRS-Komplex sind die Kammern mit ihrer großen Muskelmasse.") });
    if (T && en(distractors[0]).startsWith("recovery of the atria")) list.push({ when: { kind: "match", pairs: [[T.name, distractors[0]]] }, title: tx("Hidden atria", "Versteckte Vorhöfe"), say: tx("The atria recover during the QRS complex and are hidden by it. The T wave is the ventricles' recovery.", "Die Vorhöfe bilden ihre Erregung während des QRS-Komplexes zurück und werden davon verdeckt. Die T-Welle ist die Rückbildung der Kammern.") });
    if (QRS && en(distractors[0]).startsWith("closing")) list.push({ when: { kind: "match", pairs: [[QRS.name, distractors[0]]] }, title: tx("Electrical, not mechanical", "Elektrisch, nicht mechanisch"), say: tx("The ECG records electrical excitation, not valve movements. You hear the valves as heart sounds.", "Das EKG zeichnet die elektrische Erregung auf, keine Klappenbewegungen. Die Klappen hörst du als Herztöne.") });
    return {
      instruction: tx("Reading an ECG", "Das EKG deuten"),
      text: tx("Match each part of the ECG with what happens in the heart. One description fits none.", "Ordne jedem Abschnitt des EKG zu, was im Herzen passiert. Eine Beschreibung passt zu keinem."),
      answer: { kind: "match", pairs, distractors },
      hint: tx("P: atria. QRS: ventricles. T: ventricles return to rest.", "P: Vorhöfe. QRS: Kammern. T: Kammern kehren zur Ruhe zurück."),
      solution: pairs.map(([a, b], i) => ({ math: tx(`"${en(a)}"#a${i} \\to "${en(b)}"#b${i}`, `"${de(a)}"#a${i} \\to "${de(b)}"#b${i}`), note: tx(`${en(a)}: ${en(b)}.`, `${de(a)}: ${de(b)}.`) }) as Frame),
      mistakes: list,
    };
  }
  const w = rng.pick(WAVES);
  const opts: Opt[] = [
    { text: capFirst(w.event) },
    ...WAVES.filter((x) => x.id !== w.id).map((x) => ({ text: capFirst(x.event), title: tx("Another part", "Ein anderer Abschnitt"), say: tx("In order: P (atria) → PQ (AV node delay) → QRS (ventricles) → T (ventricles recover). Where is the marker?", "Der Reihe nach: P (Vorhöfe) → PQ (Verzögerung im AV-Knoten) → QRS (Kammern) → T (Rückbildung der Kammern). Wo sitzt die Markierung?") })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Reading an ECG", "Das EKG deuten"),
    text: tx("What does the marked part of the ECG show?", "Was zeigt der markierte Abschnitt des EKG?"),
    visual: visual(HeartEcgStrip, { rr: 0.8, beats: 3, mark: w.id }),
    answer,
    hint: tx("Small bump first, then the delay, then the big spike, then a broad wave.", "Erst ein kleiner Hügel, dann die Pause, dann die große Zacke, dann eine breite Welle."),
    solution: answerFrames(w.name, tx(`${en(w.name)}: ${en(w.event)}.`, `${de(w.name)}: ${de(w.event)}.`)),
    mistakes: list,
  };
}
const capFirst = (t: Text): Text => tx(en(t).charAt(0).toUpperCase() + en(t).slice(1), de(t).charAt(0).toUpperCase() + de(t).slice(1));

function ecgRateTask(rng: Rng): Exercise {
  const v = rng.int(0, 2);
  if (v === 0) {
    const mm = rng.pick([12, 15, 20, 25, 30]);
    const rr = mm / 25;
    const hr = Math.round(60 / rr);
    const answer: AnswerSpec = { kind: "number", value: hr, tolerance: 0.01, unit: "/min" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: 60 / mm, tolerance: 0.02 }, tx("Millimetres are not seconds", "Millimeter sind keine Sekunden"), tx(`First convert the distance into time: ${mm} mm at 25 mm per second.`, `Rechne den Abstand zuerst in eine Zeit um: ${mm} mm bei 25 mm pro Sekunde.`));
    m.add({ kind: "number", value: rr * 60, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("You multiplied the RR interval by 60. Beats per minute = 60 s **divided by** the time per beat.", "Du hast den RR-Abstand mit 60 malgenommen. Schläge pro Minute = 60 s **geteilt durch** die Zeit pro Schlag."));
    m.add({ kind: "number", value: rr, tolerance: 0.01 }, tx("That's the RR interval", "Das ist der RR-Abstand"), tx("That's the time between two beats. How many of them fit into 60 seconds?", "Das ist die Zeit zwischen zwei Schlägen. Wie viele davon passen in 60 Sekunden?"), true);
    return {
      instruction: tx("Heart rate from the ECG", "Herzfrequenz aus dem EKG"),
      text: tx(`The ECG is written at a paper speed of 25 mm/s. Two R peaks are **${mm} mm** apart. Calculate the heart rate.`, `Das EKG wird mit einem Papiervorschub von 25 mm/s geschrieben. Zwei R-Zacken liegen **${mm} mm** auseinander. Berechne die Herzfrequenz.`),
      visual: visual(HeartEcgStrip, { rr, beats: 3, mmPerBeat: true }),
      answer,
      hint: tx("RR in s = distance ÷ 25 mm/s. Heart rate = 60 s ÷ RR.", "RR in s = Abstand : 25 mm/s. Herzfrequenz = 60 s : RR."),
      solution: [
        { math: tx(`"RR interval" = \\frac{${mm} "mm"}{25 "mm/s"} = ${en(num(rr))}#r "s"`, `"RR-Abstand" = \\frac{${mm} "mm"}{25 "mm/s"} = ${de(num(rr))}#r "s"`), note: tx("Convert the distance into time.", "Rechne den Abstand in eine Zeit um.") },
        { math: tx(`"HR" = \\frac{60 "s"}{${en(num(rr))}#r "s"} = ${hr}#h "/min"`, `"HF" = \\frac{60 "s"}{${de(num(rr))}#r "s"} = ${hr}#h "/min"`), note: tx(`So the heart beats **${hr} times per minute**.`, `Das Herz schlägt also **${hr}-mal pro Minute**.`), highlight: ["h"] },
      ],
      mistakes: m.list,
    };
  }
  if (v === 1) {
    const rr = rng.pick([0.4, 0.5, 0.6, 0.75, 0.8, 1, 1.2]);
    const hr = Math.round(60 / rr);
    const answer: AnswerSpec = { kind: "number", value: hr, tolerance: 0.01, unit: "/min" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: rr * 60, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("Beats per minute = 60 s **divided by** the time per beat.", "Schläge pro Minute = 60 s **geteilt durch** die Zeit pro Schlag."));
    m.add({ kind: "number", value: 1 / rr, tolerance: 0.01 }, tx("Per second", "Pro Sekunde"), tx("That's beats per **second**. The heart rate is given per minute.", "Das sind Schläge pro **Sekunde**. Die Herzfrequenz gibt man pro Minute an."), true);
    return {
      instruction: tx("Heart rate from the ECG", "Herzfrequenz aus dem EKG"),
      text: tx(`In an ECG two R peaks are **${en(num(rr))} s** apart. What is the heart rate?`, `In einem EKG liegen zwei R-Zacken **${de(num(rr))} s** auseinander. Wie hoch ist die Herzfrequenz?`),
      answer,
      hint: tx("How many times does the interval fit into 60 seconds?", "Wie oft passt der Abstand in 60 Sekunden?"),
      solution: [{ math: tx(`"HR" = \\frac{60 "s"}{${en(num(rr))} "s"} = ${hr}#h "/min"`, `"HF" = \\frac{60 "s"}{${de(num(rr))} "s"} = ${hr}#h "/min"`), note: tx(`**${hr} beats per minute**.${hr > 100 ? " Above 100 at rest would be a tachycardia." : hr < 60 ? " Below 60 at rest: a bradycardia, normal for trained athletes." : ""}`, `**${hr} Schläge pro Minute**.${hr > 100 ? " Über 100 in Ruhe wäre eine Tachykardie." : hr < 60 ? " Unter 60 in Ruhe: eine Bradykardie, bei Trainierten normal." : ""}`), highlight: ["h"] }],
      mistakes: m.list,
    };
  }
  const hr = rng.pick([50, 60, 75, 80, 100, 120, 150]);
  const rr = 60 / hr;
  const answer: AnswerSpec = { kind: "number", value: rr, tolerance: 0.01, unit: "s" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: hr / 60, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("That's beats per second. You need the time **per** beat: 60 s divided by the number of beats.", "Das sind Schläge pro Sekunde. Gesucht ist die Zeit **pro** Schlag: 60 s geteilt durch die Zahl der Schläge."));
  return {
    instruction: tx("RR interval", "RR-Abstand"),
    text: tx(`A heart beats **${hr} times per minute** at a steady rhythm. How many seconds apart are two R peaks in the ECG?`, `Ein Herz schlägt gleichmäßig **${hr}-mal pro Minute**. Wie viele Sekunden liegen im EKG zwischen zwei R-Zacken?`),
    answer,
    hint: tx("60 seconds are shared among all the beats.", "60 Sekunden verteilen sich auf alle Schläge."),
    solution: [{ math: tx(`"RR interval" = \\frac{60 "s"}{${hr}} = ${en(num(rr, 3))}#r "s"`, `"RR-Abstand" = \\frac{60 "s"}{${hr}} = ${de(num(rr, 3))}#r "s"`), note: tx(`Two R peaks are **${en(num(rr, 3))} s** apart.`, `Zwei R-Zacken liegen **${de(num(rr, 3))} s** auseinander.`), highlight: ["r"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Cardiac output

type Ctx = { en: string; de: string; sv: number[]; hr: number[] };
const CONTEXTS: Ctx[] = [
  { en: "An adult at rest", de: "Ein Erwachsener in Ruhe", sv: [60, 65, 70, 75, 80], hr: [60, 65, 70, 72, 75, 80] },
  { en: "A trained endurance athlete at rest", de: "Eine trainierte Ausdauersportlerin in Ruhe", sv: [90, 100, 110], hr: [45, 50, 55] },
  { en: "A student jogging", de: "Ein Schüler beim Joggen", sv: [90, 100, 110], hr: [130, 140, 150, 160] },
  { en: "A cyclist at full power", de: "Eine Radfahrerin bei Höchstleistung", sv: [140, 150, 160, 180], hr: [170, 180, 190] },
];

export function hmvTask(rng: Rng, fixed?: { ctx: Ctx; sv: number; hr: number; ask: "hmv" | "sv" | "hr" }): Exercise {
  const ctx = fixed?.ctx ?? rng.pick(CONTEXTS);
  const sv = fixed?.sv ?? rng.pick(ctx.sv);
  const hr = fixed?.hr ?? rng.pick(ctx.hr);
  const ml = sv * hr;
  const l = ml / 1000;
  const ask = fixed?.ask ?? rng.pick(["hmv", "hmv", "sv", "hr"] as const);
  if (!fixed && ask !== "hmv" && (sv * hr) % 100 !== 0) return hmvTask(rng, { ctx, sv: Math.round(sv / 10) * 10, hr: Math.round(hr / 10) * 10, ask });
  if (ask === "hmv") {
    const answer: AnswerSpec = { kind: "number", value: l, tolerance: 0.01, unit: "l/min" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: ml, tolerance: 0.001 }, tx("Millilitres, not litres", "Milliliter statt Liter"), tx(`That's the result in ml per minute. The box asks for litres: 1000 ml = 1 l.`, `Das ist das Ergebnis in ml pro Minute. Gefragt sind Liter: 1000 ml = 1 l.`), true);
    m.add({ kind: "number", value: sv / hr, tolerance: 0.01 }, tx("Divided instead", "Geteilt statt mal"), tx("Cardiac output = stroke volume **times** heart rate: every beat adds one stroke volume.", "Herzminutenvolumen = Schlagvolumen **mal** Herzfrequenz: Jeder Schlag fügt ein Schlagvolumen hinzu."));
    m.add({ kind: "number", value: sv + hr, tolerance: 0.01 }, tx("Added", "Addiert"), tx("Stroke volume and heart rate have different units; they are multiplied, not added.", "Schlagvolumen und Herzfrequenz haben verschiedene Einheiten, sie werden multipliziert, nicht addiert."));
    return {
      instruction: tx("Calculate the cardiac output", "Berechne das Herzminutenvolumen"),
      text: tx(`${ctx.en} has a stroke volume of **${sv} ml** and a heart rate of **${hr} beats per minute**. Calculate the cardiac output in litres per minute.`, `${ctx.de} hat ein Schlagvolumen von **${sv} ml** und eine Herzfrequenz von **${hr} Schlägen pro Minute**. Berechne das Herzminutenvolumen in Litern pro Minute.`),
      answer,
      hint: tx("Cardiac output = stroke volume × heart rate. Then convert ml into l.", "HMV = Schlagvolumen · Herzfrequenz. Dann ml in l umrechnen."),
      solution: [
        { math: tx(`"CO" = ${sv}#a "ml" \\cdot ${hr}#b "/min"`, `"HMV" = ${sv}#a "ml" \\cdot ${hr}#b "/min"`), note: tx("Stroke volume times heart rate.", "Schlagvolumen mal Herzfrequenz.") },
        { math: tx(`"CO" = ${ml}#c "ml/min" = ${en(num(l, 3))}#r "l/min"`, `"HMV" = ${ml}#c "ml/min" = ${de(num(l, 3))}#r "l/min"`), note: tx(`Divide by 1000: **${en(num(l, 3))} l per minute**.`, `Durch 1000 teilen: **${de(num(l, 3))} l pro Minute**.`), highlight: ["r"] },
      ],
      mistakes: m.list,
    };
  }
  if (ask === "sv") {
    const answer: AnswerSpec = { kind: "number", value: sv, tolerance: 0.01, unit: "ml" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: l / hr, tolerance: 0.01 }, tx("Still in litres", "Noch in Litern"), tx("That's the stroke volume in litres. Convert it into millilitres.", "Das ist das Schlagvolumen in Litern. Rechne es in Milliliter um."), true);
    m.add({ kind: "number", value: l * hr, tolerance: 0.01 }, tx("Multiplied instead", "Mal statt geteilt"), tx("Stroke volume = cardiac output **divided by** heart rate.", "Schlagvolumen = Herzminutenvolumen **geteilt durch** Herzfrequenz."));
    return {
      instruction: tx("Calculate the stroke volume", "Berechne das Schlagvolumen"),
      text: tx(`${ctx.en} has a cardiac output of **${en(num(l, 3))} l/min** at a heart rate of **${hr} per minute**. What is the stroke volume in ml?`, `${ctx.de} hat ein Herzminutenvolumen von **${de(num(l, 3))} l/min** bei einer Herzfrequenz von **${hr} pro Minute**. Wie groß ist das Schlagvolumen in ml?`),
      answer,
      hint: tx("Convert l into ml first, then divide by the heart rate.", "Rechne erst l in ml um, dann teile durch die Herzfrequenz."),
      solution: [
        { math: tx(`${en(num(l, 3))} "l/min" = ${ml}#c "ml/min"`, `${de(num(l, 3))} "l/min" = ${ml}#c "ml/min"`), note: tx("First into millilitres.", "Zuerst in Milliliter.") },
        { math: tx(`"stroke volume" = \\frac{${ml}#c "ml/min"}{${hr} "/min"} = ${sv}#r "ml"`, `"Schlagvolumen" = \\frac{${ml}#c "ml/min"}{${hr} "/min"} = ${sv}#r "ml"`), note: tx(`Each beat ejects **${sv} ml**.`, `Jeder Schlag wirft **${sv} ml** aus.`), highlight: ["r"] },
      ],
      mistakes: m.list,
    };
  }
  const answer: AnswerSpec = { kind: "number", value: hr, tolerance: 0.01, unit: "/min" };
  const m = mistakes(answer);
  m.add({ kind: "number", value: l / sv, tolerance: 0.01 }, tx("Units mixed", "Einheiten gemischt"), tx("Use the same unit: convert the litres into millilitres before dividing.", "Nimm dieselbe Einheit: Rechne die Liter vor dem Teilen in Milliliter um."));
  m.add({ kind: "number", value: sv / ml, tolerance: 0.01 }, tx("Upside down", "Verkehrt herum"), tx("Heart rate = cardiac output **divided by** stroke volume.", "Herzfrequenz = Herzminutenvolumen **geteilt durch** Schlagvolumen."));
  return {
    instruction: tx("Calculate the heart rate", "Berechne die Herzfrequenz"),
    text: tx(`${ctx.en} has a cardiac output of **${en(num(l, 3))} l/min** and a stroke volume of **${sv} ml**. What is the heart rate?`, `${ctx.de} hat ein Herzminutenvolumen von **${de(num(l, 3))} l/min** und ein Schlagvolumen von **${sv} ml**. Wie hoch ist die Herzfrequenz?`),
    answer,
    hint: tx("Heart rate = cardiac output ÷ stroke volume (both in ml).", "Herzfrequenz = HMV : Schlagvolumen (beides in ml)."),
    solution: [
      { math: tx(`"HR" = \\frac{${ml} "ml/min"}{${sv} "ml"} = ${hr}#r "/min"`, `"HF" = \\frac{${ml} "ml/min"}{${sv} "ml"} = ${hr}#r "/min"`), note: tx(`**${hr} beats per minute**.`, `**${hr} Schläge pro Minute**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Blood pressure and its regulation

const BP_QUESTIONS: { q: Text; opts: Opt[]; why: Text }[] = [
  {
    q: tx("A blood pressure of 120/80 mmHg is measured. What does the 80 stand for?", "Gemessen wird ein Blutdruck von 120/80 mmHg. Wofür steht die 80?"),
    opts: [
      { text: tx("The pressure in the arteries during diastole (the lowest value)", "Den Druck in den Arterien während der Diastole (niedrigster Wert)") },
      { text: tx("The pressure in the arteries during systole", "Den Druck in den Arterien während der Systole"), title: tx("That's the 120", "Das ist die 120"), say: tx("The higher value, 120, is the systolic pressure when the ventricles eject.", "Der höhere Wert, 120, ist der systolische Druck, wenn die Kammern auswerfen.") },
      { text: tx("A pulse of 80 beats per minute", "Einen Puls von 80 Schlägen pro Minute"), title: tx("Pressure, not pulse", "Druck, nicht Puls"), say: tx("Both numbers are pressures in mmHg. The pulse is measured separately.", "Beide Zahlen sind Drücke in mmHg. Der Puls wird extra gemessen.") },
      { text: tx("The pressure in the veins", "Den Druck in den Venen"), title: tx("Arterial pressure", "Arterieller Druck"), say: tx("Blood pressure is measured in an artery (upper arm). The pressure in veins is far lower.", "Blutdruck misst man in einer Arterie (Oberarm). In Venen ist der Druck viel niedriger.") },
    ],
    why: tx("Systolic/diastolic: the arterial pressure swings between about 120 mmHg (systole) and 80 mmHg (diastole).", "Systolisch/diastolisch: Der Druck in den Arterien schwankt zwischen etwa 120 mmHg (Systole) und 80 mmHg (Diastole)."),
  },
  {
    q: tx("When you stand up quickly, the blood pressure drops briefly. How does the body react?", "Beim schnellen Aufstehen sinkt der Blutdruck kurz. Wie reagiert der Körper?"),
    opts: [
      { text: tx("Pressoreceptors report it; the sympathetic nervous system raises the heart rate and narrows the vessels.", "Pressorezeptoren melden es, der Sympathikus erhöht die Herzfrequenz und verengt die Gefäße.") },
      { text: tx("The parasympathetic system slows the heart down.", "Der Parasympathikus verlangsamt den Herzschlag."), title: tx("Wrong direction", "Falsche Richtung"), say: tx("Slowing the heart would lower the pressure even more. To raise it, the sympathetic system speeds the heart up.", "Ein langsamerer Herzschlag würde den Druck noch weiter senken. Um ihn zu heben, beschleunigt der Sympathikus das Herz.") },
      { text: tx("The vessels widen so more blood can flow.", "Die Gefäße erweitern sich, damit mehr Blut fließen kann."), title: tx("Wider vessels, lower pressure", "Weite Gefäße, niedriger Druck"), say: tx("Wider vessels lower the pressure further. They narrow to raise it.", "Weitere Gefäße senken den Druck noch mehr. Sie verengen sich, um ihn zu erhöhen.") },
      { text: tx("Nothing: blood pressure isn't regulated.", "Nichts, der Blutdruck wird nicht geregelt."), title: tx("It is regulated", "Er wird geregelt"), say: tx("Blood pressure is controlled in a feedback loop: pressoreceptors, circulatory centre, autonomic nerves.", "Der Blutdruck wird in einem Regelkreis gesteuert: Pressorezeptoren, Kreislaufzentrum, vegetative Nerven.") },
    ],
    why: tx("Negative feedback: less stretch → circulatory centre in the medulla → sympathetic nervous system: heart rate and force up, vessels narrower → pressure rises again.", "Negative Rückkopplung: weniger Dehnung → Kreislaufzentrum im verlängerten Mark → Sympathikus: Herzfrequenz und Kraft steigen, Gefäße werden enger → Druck steigt wieder."),
  },
  {
    q: tx("Where are the pressoreceptors that measure blood pressure?", "Wo sitzen die Pressorezeptoren, die den Blutdruck messen?"),
    opts: [
      { text: tx("In the walls of the aortic arch and the carotid arteries", "In der Wand von Aortenbogen und Halsschlagadern") },
      { text: tx("In the sinus node", "Im Sinusknoten"), title: tx("That's the pacemaker", "Das ist der Schrittmacher"), say: tx("The sinus node sets the heartbeat. The pressure sensors sit in the walls of large arteries.", "Der Sinusknoten gibt den Herzschlag vor. Die Drucksensoren sitzen in der Wand großer Arterien.") },
      { text: tx("In the circulatory centre of the brain", "Im Kreislaufzentrum des Gehirns"), title: tx("That's the control centre", "Das ist die Schaltzentrale"), say: tx("The circulatory centre in the medulla evaluates the signals. Measuring happens in the arterial walls.", "Das Kreislaufzentrum im verlängerten Mark wertet die Meldungen aus. Gemessen wird in den Arterienwänden.") },
    ],
    why: tx("They register how much the vessel wall is stretched and report it to the circulatory centre.", "Sie registrieren, wie stark die Gefäßwand gedehnt wird, und melden es an das Kreislaufzentrum."),
  },
  {
    q: tx("Which part of the nervous system slows the heartbeat?", "Welcher Teil des Nervensystems verlangsamt den Herzschlag?"),
    opts: [
      { text: tx("The parasympathetic system (vagus nerve)", "Der Parasympathikus (Vagusnerv)") },
      { text: tx("The sympathetic system", "Der Sympathikus"), title: tx("That's the accelerator", "Das ist das Gaspedal"), say: tx("The sympathetic system speeds the heart up (fight or flight). The brake is the parasympathetic vagus nerve.", "Der Sympathikus beschleunigt das Herz (Kampf oder Flucht). Die Bremse ist der Parasympathikus mit dem Vagusnerv.") },
      { text: tx("The bundle of His", "Das His-Bündel"), title: tx("That's conduction", "Das ist Erregungsleitung"), say: tx("The bundle of His conducts the excitation inside the heart. It doesn't set the rate.", "Das His-Bündel leitet die Erregung im Herzen weiter. Es bestimmt nicht das Tempo.") },
    ],
    why: tx("The vagus nerve acts on the sinus node and lowers the heart rate.", "Der Vagusnerv wirkt auf den Sinusknoten und senkt die Herzfrequenz."),
  },
];
const BP_LOOP: Text[] = [
  tx("Blood pressure falls", "Blutdruck sinkt"),
  tx("Pressoreceptors register less stretch", "Pressorezeptoren melden weniger Dehnung"),
  tx("Circulatory centre in the medulla", "Kreislaufzentrum im verlängerten Mark"),
  tx("Sympathetic nervous system activated", "Sympathikus wird aktiviert"),
  tx("Heart beats faster, vessels narrow", "Herz schlägt schneller, Gefäße verengen sich"),
  tx("Blood pressure rises again", "Blutdruck steigt wieder"),
];

function bpTask(rng: Rng): Exercise {
  if (rng.chance(0.3)) {
    const items = BP_LOOP;
    return {
      instruction: tx("Regulation of blood pressure", "Regelung des Blutdrucks"),
      text: tx("Put the steps of the feedback loop in order.", "Bring die Schritte des Regelkreises in die richtige Reihenfolge."),
      answer: { kind: "order", items },
      hint: tx("Sensor → control centre → nerve → effector → result.", "Fühler → Regelzentrum → Nerv → Stellglied → Ergebnis."),
      solution: orderFrames(items, [tx("A disturbance: the pressure drops.", "Eine Störung: Der Druck sinkt."), tx("The sensors in the arterial walls notice it.", "Die Fühler in den Arterienwänden bemerken es."), tx("The control centre compares with the target value.", "Das Regelzentrum vergleicht mit dem Sollwert."), tx("It activates the sympathetic system.", "Es aktiviert den Sympathikus."), tx("Effectors: heart and vessels.", "Stellglieder: Herz und Gefäße."), tx("Negative feedback: the deviation is corrected.", "Negative Rückkopplung: Die Abweichung wird ausgeglichen.")]),
      mistakes: [
        { when: { kind: "order", items: [BP_LOOP[2], BP_LOOP[1]] }, title: tx("Measure first", "Erst messen"), say: tx("The centre can only react to what the receptors report. Sensors come before the control centre.", "Das Zentrum kann nur auf das reagieren, was die Rezeptoren melden. Der Fühler kommt vor dem Regelzentrum.") },
        { when: { kind: "order", items: [BP_LOOP[4], BP_LOOP[3]] }, title: tx("Nerve before effect", "Erst Nerv, dann Wirkung"), say: tx("Heart and vessels change because the sympathetic nerves tell them to.", "Herz und Gefäße ändern sich, weil die Sympathikus-Nerven sie dazu anregen.") },
      ],
    };
  }
  const Q = rng.pick(BP_QUESTIONS);
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("Blood pressure", "Blutdruck"),
    text: Q.q,
    answer,
    hint: tx("Systolic/diastolic; sensors in the artery walls; sympathetic = accelerator, parasympathetic = brake.", "Systolisch/diastolisch, Fühler in den Arterienwänden, Sympathikus = Gas, Parasympathikus = Bremse."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Rhesus factor

const RH_QUESTIONS: { q: Text; opts: Opt[]; why: Text }[] = [
  {
    q: tx("A rhesus-negative woman is pregnant for the first time with a rhesus-positive child. She has never had a blood transfusion. Is this first child at risk?", "Eine rhesus-negative Frau ist zum ersten Mal schwanger, das Kind ist rhesus-positiv. Sie hat nie eine Bluttransfusion bekommen. Ist dieses erste Kind gefährdet?"),
    opts: [
      { text: tx("Usually not: she has no anti-D antibodies yet; she only forms them after contact, e.g. at birth.", "Meist nicht: Sie hat noch keine Anti-D-Antikörper und bildet sie erst nach Kontakt, z. B. bei der Geburt.") },
      { text: tx("Yes: rhesus-negative people always have anti-D in their plasma.", "Ja: Rhesus-negative Menschen haben immer Anti-D im Plasma."), title: tx("Unlike AB0", "Anders als bei AB0"), say: tx("That's true for anti-A and anti-B, but not for anti-D. Rhesus antibodies only form after contact with D antigen (sensitisation).", "Das gilt für Anti-A und Anti-B, aber nicht für Anti-D. Rhesus-Antikörper entstehen erst nach Kontakt mit dem Antigen D (Sensibilisierung).") },
      { text: tx("Yes: the child's antibodies attack the mother.", "Ja: Die Antikörper des Kindes greifen die Mutter an."), title: tx("Other way round", "Umgekehrt"), say: tx("The danger comes from the **mother's** antibodies crossing the placenta into the child.", "Die Gefahr geht von den Antikörpern der **Mutter** aus, die durch die Plazenta ins Kind gelangen.") },
    ],
    why: tx("At birth the child's Rh+ cells reach the mother's blood: she is sensitised and forms anti-D (and memory cells). The first child is usually born before that matters.", "Bei der Geburt gelangen Rh+-Blutkörperchen des Kindes in das Blut der Mutter: Sie wird sensibilisiert und bildet Anti-D (und Gedächtniszellen). Das erste Kind ist dann meist schon geboren."),
  },
  {
    q: tx("Same woman, second pregnancy, again a rhesus-positive child, no prophylaxis. What can happen?", "Dieselbe Frau, zweite Schwangerschaft, wieder ein rhesus-positives Kind, keine Prophylaxe. Was kann passieren?"),
    opts: [
      { text: tx("Her anti-D antibodies cross the placenta and destroy the child's red blood cells.", "Ihre Anti-D-Antikörper gelangen durch die Plazenta und zerstören die roten Blutkörperchen des Kindes.") },
      { text: tx("Nothing: the antibodies only act in the mother's own blood.", "Nichts, die Antikörper wirken nur im Blut der Mutter."), title: tx("They cross the placenta", "Sie passieren die Plazenta"), say: tx("Anti-D are small IgG antibodies: they cross the placenta and reach the child.", "Anti-D sind kleine IgG-Antikörper: Sie passieren die Plazenta und erreichen das Kind.") },
      { text: tx("The mother's red blood cells clump.", "Die roten Blutkörperchen der Mutter verklumpen."), title: tx("Her cells have no D", "Ihre Zellen haben kein D"), say: tx("The mother is rhesus-negative: her cells carry no D antigen, so anti-D doesn't harm them.", "Die Mutter ist rhesus-negativ: Ihre Blutkörperchen tragen kein Antigen D, also schadet Anti-D ihnen nicht.") },
    ],
    why: tx("Rhesus incompatibility: the child's red cells are destroyed (anaemia, jaundice).", "Rhesus-Unverträglichkeit: Die roten Blutkörperchen des Kindes werden zerstört (Blutarmut, Gelbsucht)."),
  },
  {
    q: tx("A rhesus-positive mother is pregnant with a rhesus-negative child. Is there a risk of rhesus incompatibility?", "Eine rhesus-positive Mutter ist mit einem rhesus-negativen Kind schwanger. Droht eine Rhesus-Unverträglichkeit?"),
    opts: [
      { text: tx("No: the child's cells carry no D antigen, so the mother forms no anti-D against them.", "Nein: Die Blutkörperchen des Kindes tragen kein Antigen D, die Mutter bildet also kein Anti-D gegen sie.") },
      { text: tx("Yes: any rhesus difference between mother and child is dangerous.", "Ja: Jeder Rhesus-Unterschied zwischen Mutter und Kind ist gefährlich."), title: tx("Only one combination", "Nur eine Kombination"), say: tx("Only a rhesus-negative mother with a rhesus-positive child is a problem: she can form anti-D against the child's D antigen.", "Nur eine rhesus-negative Mutter mit einem rhesus-positiven Kind ist ein Problem: Sie kann Anti-D gegen das Antigen D des Kindes bilden.") },
    ],
    why: tx("A rhesus-positive mother has the D antigen herself and never forms anti-D.", "Eine rhesus-positive Mutter trägt das Antigen D selbst und bildet nie Anti-D."),
  },
  {
    q: tx("Why does a rhesus-negative mother receive an anti-D injection around birth?", "Warum bekommt eine rhesus-negative Mutter rund um die Geburt eine Anti-D-Spritze?"),
    opts: [
      { text: tx("The injected antibodies remove the child's Rh+ cells before her immune system forms its own anti-D and memory cells.", "Die gespritzten Antikörper beseitigen die Rh+-Zellen des Kindes, bevor ihr Immunsystem eigenes Anti-D und Gedächtniszellen bildet.") },
      { text: tx("It vaccinates her so that she forms lots of her own anti-D.", "Sie impft die Mutter, damit sie viel eigenes Anti-D bildet."), title: tx("Exactly not", "Genau das nicht"), say: tx("Her own anti-D and memory cells are what must be avoided. The injection is a passive immunisation that prevents it.", "Eigenes Anti-D und Gedächtniszellen sollen gerade verhindert werden. Die Spritze ist eine passive Immunisierung, die das verhindert.") },
      { text: tx("It turns the mother rhesus-positive.", "Sie macht die Mutter rhesus-positiv."), title: tx("Genes don't change", "Die Gene ändern sich nicht"), say: tx("Her rhesus factor is genetic and stays negative. The injection only clears the child's cells from her blood.", "Ihr Rhesusfaktor ist erblich und bleibt negativ. Die Spritze entfernt nur die kindlichen Zellen aus ihrem Blut.") },
    ],
    why: tx("Anti-D prophylaxis prevents sensitisation, so later pregnancies stay safe.", "Die Anti-D-Prophylaxe verhindert die Sensibilisierung, sodass spätere Schwangerschaften sicher bleiben."),
  },
];

function rhesusTask(rng: Rng): Exercise {
  if (rng.chance(0.25)) {
    const father = rng.pick(["DD", "Dd"] as const);
    const value = father === "DD" ? 100 : 50;
    const answer: AnswerSpec = { kind: "number", value, tolerance: 0.01, unit: "%" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: 75 }, tx("Not a 3:1 cross", "Kein 3:1"), tx("75 % would need two heterozygous parents. The mother is dd: she can only pass on d.", "75 % gäbe es nur bei zwei mischerbigen Eltern. Die Mutter ist dd und kann nur d weitergeben."));
    m.add({ kind: "number", value: father === "DD" ? 50 : 100 }, father === "DD" ? tx("Homozygous father", "Reinerbiger Vater") : tx("Heterozygous father", "Mischerbiger Vater"), father === "DD" ? tx("A DD father can only pass on D, so every child gets D from him.", "Ein DD-Vater kann nur D weitergeben, also bekommt jedes Kind von ihm ein D.") : tx("A Dd father passes on D or d with equal chance: half the children are dd.", "Ein Dd-Vater gibt D oder d mit gleicher Wahrscheinlichkeit weiter: Die Hälfte der Kinder ist dd."));
    return {
      instruction: tx("Inheritance of the rhesus factor", "Vererbung des Rhesusfaktors"),
      text: tx(`Rhesus-positive (D) is dominant over rhesus-negative (d). The mother is rhesus-negative (dd), the father is **${father}**. What is the probability that a child is rhesus-positive?`, `Rhesus-positiv (D) ist dominant über rhesus-negativ (d). Die Mutter ist rhesus-negativ (dd), der Vater ist **${father}**. Mit welcher Wahrscheinlichkeit ist ein Kind rhesus-positiv?`),
      answer,
      hint: tx("The mother always passes on d. What can the father pass on?", "Die Mutter gibt immer d weiter. Was kann der Vater weitergeben?"),
      solution: [
        { math: tx(`"mother dd" \\times "father ${father}"`, `"Mutter dd" \\times "Vater ${father}"`), note: tx("Mother dd: all her egg cells carry d.", "Mutter dd: Alle ihre Eizellen tragen d.") },
        { math: tx(`\\Rightarrow "children: ${father === "DD" ? "Dd, Dd" : "Dd, dd"}" \\Rightarrow ${value}#r "%"`, `\\Rightarrow "Kinder: ${father === "DD" ? "Dd, Dd" : "Dd, dd"}" \\Rightarrow ${value}#r "%"`), note: tx(`**${value} %** of the children are expected to be rhesus-positive (Dd) and at risk if the mother is sensitised.`, `**${value} %** der Kinder sind zu erwarten rhesus-positiv (Dd) und gefährdet, falls die Mutter sensibilisiert ist.`), highlight: ["r"] },
      ],
      mistakes: m.list,
    };
  }
  const Q = rng.pick(RH_QUESTIONS);
  const { answer, mistakes: list } = choice(rng, Q.opts);
  return {
    instruction: tx("Rhesus factor", "Rhesusfaktor"),
    text: Q.q,
    answer,
    hint: tx("Anti-D is only formed after contact with D antigen. Danger: rhesus-negative mother, rhesus-positive child, from the second pregnancy on.", "Anti-D entsteht erst nach Kontakt mit dem Antigen D. Gefahr: rhesus-negative Mutter, rhesus-positives Kind, ab der zweiten Schwangerschaft."),
    solution: answerFrames(Q.opts[0].text, Q.why),
    mistakes: list,
  };
}

function rhTestTask(rng: Rng): Exercise {
  const g = rng.pick(["A", "B", "AB", "0"] as BloodGroup[]);
  const rh = rng.chance(0.7);
  const label = (x: BloodGroup, r: boolean) => tx(`${x} Rh${r ? "+" : "−"}`, `${x} Rh${r ? "+" : "−"}`.replace("Rh−", "rh−"));
  const inverse: Record<BloodGroup, BloodGroup> = { A: "B", B: "A", AB: "0", "0": "AB" };
  const opts: Opt[] = [
    { text: label(g, rh) },
    { text: label(g, !rh), title: tx("Read the anti-D field", "Lies das Feld Anti-D"), say: tx("Clumping with anti-D means the D antigen is present: rhesus-positive. A smooth field means rhesus-negative.", "Verklumpung mit Anti-D heißt: Antigen D ist vorhanden, also rhesus-positiv. Ein glattes Feld heißt rhesus-negativ.") },
    { text: label(inverse[g], rh), title: tx("Read the other way round", "Umgekehrt gelesen"), say: tx("Clumping in a field means: this antigen **is** present.", "Verklumpung in einem Feld heißt: Dieses Antigen **ist** vorhanden.") },
    { text: label(inverse[g], !rh), title: tx("All fields reversed", "Alle Felder umgekehrt"), say: tx("You read every field the wrong way round. Clumping = antigen present.", "Du hast jedes Feld umgekehrt gelesen. Verklumpung = Antigen vorhanden.") },
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Blood group test", "Blutgruppentest"),
    text: tx("A drop of blood was mixed with the test sera anti-A, anti-B and anti-D. Which blood group and rhesus factor does the person have?", "Ein Tropfen Blut wurde mit den Testseren Anti-A, Anti-B und Anti-D gemischt. Welche Blutgruppe und welchen Rhesusfaktor hat die Person?"),
    visual: visual(HeartBloodTest, { group: g, rh }),
    answer,
    hint: tx("Clumping = this antigen is on the red cells. Anti-D tests for the rhesus factor.", "Verklumpung = dieses Antigen sitzt auf den roten Blutkörperchen. Anti-D testet den Rhesusfaktor."),
    solution: answerFrames(tx(`blood group ${g}, rhesus-${rh ? "positive" : "negative"}`, `Blutgruppe ${g}, rhesus-${rh ? "positiv" : "negativ"}`), rh ? tx("Clumping with anti-D: antigen D present, rhesus-positive.", "Verklumpung mit Anti-D: Antigen D vorhanden, rhesus-positiv.") : tx("No clumping with anti-D: no antigen D, rhesus-negative.", "Keine Verklumpung mit Anti-D: kein Antigen D, rhesus-negativ.")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate3(rng: Rng): Exercise {
  switch (rng.int(0, 15)) {
    case 0:
      return o2ReadTask(rng);
    case 1:
      return o2ReleaseTask(rng);
    case 2:
      return bohrTask(rng);
    case 3:
      return hbTypesTask(rng);
    case 4:
    case 5:
      return cyclePhaseTask(rng);
    case 6:
      return cycleOrderTask(rng);
    case 7:
      return rng.chance(0.6) ? conductionOrderTask(rng) : conductionPictureTask(rng);
    case 8:
      return ecgTask(rng);
    case 9:
      return ecgRateTask(rng);
    case 10:
    case 11:
      return hmvTask(rng);
    case 12:
      return bpTask(rng);
    case 13:
      return rhesusTask(rng);
    case 14:
      return rhTestTask(rng);
    default:
      return rng.chance(0.5) ? bohrTask(rng) : cyclePhaseTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const hbFrames: Frame[] = [
  { math: tx('"haemoglobin:"#h \\; 2 \\alpha + 2 \\beta', '"Hämoglobin:"#h \\; 2 \\alpha + 2 \\beta'), note: tx("Haemoglobin is a protein of four subunits (two α and two β chains). Each carries a haem group with an iron ion (Fe²⁺) that binds one O₂.", "Hämoglobin ist ein Protein aus vier Untereinheiten (zwei α- und zwei β-Ketten). Jede trägt eine Häm-Gruppe mit einem Eisen-Ion (Fe²⁺), an das ein O₂ bindet.") },
  { math: "\\ce{Hb + 4O2 <=> Hb(O2)4}", note: tx("So one haemoglobin binds up to four O₂. The binding is reversible: O₂ is bound in the lungs and released in the tissues.", "Ein Hämoglobin bindet also bis zu vier O₂. Die Bindung ist umkehrbar: In der Lunge wird O₂ gebunden, im Gewebe abgegeben.") },
  { math: tx('"1st O"_2 "bound"#a \\Rightarrow "affinity rises"#b', '"1. O"_2 "gebunden"#a \\Rightarrow "Affinität steigt"#b'), note: tx("**Cooperative binding**: once one subunit has bound O₂, the shape of the whole molecule changes and the others bind O₂ more easily. That's why the binding curve is **S-shaped (sigmoid)**.", "**Kooperative Bindung**: Hat eine Untereinheit O₂ gebunden, ändert sich die Form des ganzen Moleküls, und die anderen binden O₂ leichter. Deshalb ist die Bindungskurve **S-förmig (sigmoid)**."), highlight: ["b"] },
  { math: tx('"lungs:" 100 "mmHg" \\to 97 "%" \\quad "tissue:" 40 "mmHg" \\to 75 "%"', '"Lunge:" 100 "mmHg" \\to 97 "%" \\quad "Gewebe:" 40 "mmHg" \\to 75 "%"'), note: tx("In the lungs (high O₂ partial pressure) haemoglobin is almost fully saturated. In the tissues saturation drops to about 75 %. On the steep part of the curve a small drop in pressure releases a lot of O₂.", "In der Lunge (hoher O₂-Partialdruck) ist Hämoglobin fast vollständig gesättigt. Im Gewebe sinkt die Sättigung auf etwa 75 %. Im steilen Teil der Kurve setzt schon ein kleiner Druckabfall viel O₂ frei.") },
];

const cycleFrames: Frame[] = [
  { math: tx('"systole:"#s \\; "isovolumetric contraction"#a \\to "ejection"#b', '"Systole:"#s \\; "Anspannungsphase"#a \\to "Austreibungsphase"#b'), note: tx("Systole: first **isovolumetric contraction** (all valves shut, pressure rises), then **ejection** (semilunar valves open, blood flows out).", "Systole: zuerst die **Anspannungsphase** (alle Klappen zu, der Druck steigt), dann die **Austreibungsphase** (Taschenklappen offen, Blut strömt aus).") },
  { math: tx('"diastole:"#d \\; "isovolumetric relaxation"#c \\to "filling"#e', '"Diastole:"#d \\; "Entspannungsphase"#c \\to "Füllungsphase"#e'), note: tx("Diastole: first **isovolumetric relaxation** (all valves shut, pressure falls), then **filling** (AV valves open, the ventricle fills).", "Diastole: zuerst die **Entspannungsphase** (alle Klappen zu, der Druck fällt), dann die **Füllungsphase** (Segelklappen offen, die Kammer füllt sich).") },
  { math: tx('"valve open" \\Leftrightarrow "p"_"before" > "p"_"behind"', '"Klappe offen" \\Leftrightarrow "p"_"davor" > "p"_"dahinter"'), note: tx("Valves move passively, only by pressure differences: a valve opens when the pressure in front of it is higher than behind it.", "Klappen bewegen sich passiv, nur durch Druckunterschiede: Eine Klappe öffnet sich, wenn der Druck vor ihr höher ist als hinter ihr.") },
  { math: tx('"heart sounds:" \\; "1st: AV valves shut" \\quad "2nd: semilunar valves shut"', '"Herztöne:" \\; "1.: Segelklappen zu" \\quad "2.: Taschenklappen zu"'), note: tx("The two heart sounds mark the borders: the first starts systole, the second starts diastole.", "Die beiden Herztöne markieren die Grenzen: Der erste beginnt die Systole, der zweite die Diastole.") },
];

const bpFrames: Frame[] = [
  { math: tx('"blood pressure:"#b \\; 120#s / 80#d "mmHg"', '"Blutdruck:"#b \\; 120#s / 80#d "mmHg"'), note: tx("Blood pressure is given as systolic/diastolic: 120/80 mmHg means the arterial pressure swings between 120 (systole) and 80 mmHg (diastole). Elastic arteries smooth the swings (windkessel function).", "Blutdruck gibt man als systolisch/diastolisch an: 120/80 mmHg heißt, der Druck in den Arterien schwankt zwischen 120 (Systole) und 80 mmHg (Diastole). Die elastischen Arterien dämpfen die Schwankungen (Windkesselfunktion).") },
  { math: tx('"pressure falls"#a \\to "pressoreceptors"#p \\to "circulatory centre"#z', '"Druck sinkt"#a \\to "Pressorezeptoren"#p \\to "Kreislaufzentrum"#z'), note: tx("**Pressoreceptors** in the aortic arch and carotid arteries measure how much the wall is stretched and report to the **circulatory centre** in the medulla oblongata.", "**Pressorezeptoren** in Aortenbogen und Halsschlagadern messen die Dehnung der Gefäßwand und melden sie an das **Kreislaufzentrum** im verlängerten Mark.") },
  { math: tx('"sympathetic:"#s \\; "HR up, vessels narrow"#x', '"Sympathikus:"#s \\; "HF steigt, Gefäße eng"#x'), note: tx("If the pressure is too low, the **sympathetic** system speeds up the heart, strengthens each beat and narrows the arterioles: the pressure rises.", "Ist der Druck zu niedrig, beschleunigt der **Sympathikus** das Herz, verstärkt jeden Schlag und verengt die Arteriolen: Der Druck steigt.") },
  { math: tx('"parasympathetic (vagus):"#v \\; "HR down"#y', '"Parasympathikus (Vagus):"#v \\; "HF sinkt"#y'), note: tx("If it is too high, the **parasympathetic** vagus nerve brakes the heart. A feedback loop with **negative feedback**.", "Ist er zu hoch, bremst der **Parasympathikus** über den Vagusnerv das Herz. Ein Regelkreis mit **negativer Rückkopplung**.") },
  { math: tx('"over" 140/90 "mmHg:" \\; "high blood pressure"#h', '"über" 140/90 "mmHg:" \\; "Bluthochdruck"#h'), note: tx("Permanently above 140/90 mmHg is called **hypertension**. It damages vessels and the heart.", "Dauerhaft über 140/90 mmHg spricht man von **Bluthochdruck** (Hypertonie). Er schädigt Gefäße und Herz.") },
];

const rhFrames: Frame[] = [
  { math: tx('"Rh+:"#p \\; "antigen D" \\quad "rh−:"#n \\; "no antigen D"', '"Rh+:"#p \\; "Antigen D" \\quad "rh−:"#n \\; "kein Antigen D"'), note: tx("Besides AB0 there is the **rhesus factor**: whoever carries antigen D on the red blood cells is **rhesus-positive** (about 85 % in Europe), otherwise **rhesus-negative**.", "Neben AB0 gibt es den **Rhesusfaktor**: Wer das Antigen D auf den roten Blutkörperchen trägt, ist **rhesus-positiv** (etwa 85 % in Europa), sonst **rhesus-negativ**.") },
  { math: tx('"rh−" + "Rh+ blood" \\to "anti-D"#a', '"rh−" + "Rh+-Blut" \\to "Anti-D"#a'), note: tx("Unlike AB0, a rhesus-negative person has **no** anti-D from birth. It forms only after Rh+ blood enters the body (**sensitisation**), together with memory cells.", "Anders als bei AB0 hat ein rhesus-negativer Mensch **nicht** von Geburt an Anti-D. Er bildet es erst, wenn Rh+-Blut in seinen Körper gelangt (**Sensibilisierung**), zusammen mit Gedächtniszellen.") },
  { math: tx('"1st child Rh+:" \\; "mother forms anti-D"#a', '"1. Kind Rh+:" \\; "Mutter bildet Anti-D"#a'), note: tx("A rhesus-negative mother with a rhesus-positive child: at birth the child's blood enters her circulation and she forms anti-D. The first child is usually not harmed.", "Eine rhesus-negative Mutter mit einem rhesus-positiven Kind: Bei der Geburt gelangt kindliches Blut in ihren Kreislauf, sie bildet Anti-D. Dem ersten Kind schadet das meist nicht mehr.") },
  { math: tx('"2nd child Rh+:" \\; "anti-D destroys its red cells"#b', '"2. Kind Rh+:" \\; "Anti-D zerstört seine Blutkörperchen"#b'), note: tx("In the next pregnancy with a rhesus-positive child her anti-D antibodies (IgG) cross the placenta and destroy the child's red blood cells: **rhesus incompatibility**.", "In der nächsten Schwangerschaft mit einem rhesus-positiven Kind gelangen ihre Anti-D-Antikörper (IgG) durch die Plazenta und zerstören die roten Blutkörperchen des Kindes: **Rhesus-Unverträglichkeit**.") },
  { math: tx('"anti-D prophylaxis"#c', '"Anti-D-Prophylaxe"#c'), note: tx("That's why rhesus-negative mothers get anti-D injections (in pregnancy and after birth). They remove the child's Rh+ cells before the mother forms her own antibodies.", "Deshalb bekommen rhesus-negative Mütter Anti-D gespritzt (in der Schwangerschaft und nach der Geburt). Es beseitigt die Rh+-Zellen des Kindes, bevor die Mutter selbst Antikörper bildet.") },
];

const checkBohr = (() => {
  const ex = bohrTask(createRng(11));
  return ex;
})();
const checkPhase = (() => {
  const order: Phase[] = [2, 1, 4, 3];
  const options = order.map(PHASE_NAME);
  const answer: AnswerSpec = { kind: "choice", options, correct: order.indexOf(1) };
  const ex: Exercise = {
    instruction: tx("Phases of the cardiac cycle", "Phasen des Herzzyklus"),
    text: tx("In which phase are **all valves shut** while the pressure in the ventricle **rises** steeply?", "In welcher Phase sind **alle Klappen geschlossen**, während der Druck in der Kammer steil **ansteigt**?"),
    answer,
    hint: tx("All valves shut: two phases. Which of them belongs to systole?", "Alle Klappen zu: Das sind zwei Phasen. Welche davon gehört zur Systole?"),
    solution: answerFrames(PHASE_NAME(1), PHASES[1].text),
    mistakes: order.filter((x) => x !== 1).map((x) => ({ when: { kind: "choice", options, correct: order.indexOf(x) } as AnswerSpec, ...phaseTrap(1, x) })),
  };
  return ex;
})();
const checkHmv = hmvTask(createRng(1), { ctx: CONTEXTS[0], sv: 70, hr: 70, ask: "hmv" });
const checkRh = (() => {
  const Q = RH_QUESTIONS[1];
  const { answer, mistakes: list } = choice(createRng(5), Q.opts);
  const ex: Exercise = { instruction: tx("Rhesus factor", "Rhesusfaktor"), text: Q.q, answer, hint: tx("Who forms the antibodies, and where do they go?", "Wer bildet die Antikörper, und wohin gelangen sie?"), solution: answerFrames(Q.opts[0].text, Q.why), mistakes: list };
  return ex;
})();

// Make sure the Bohr check is the muscle question (choice), whatever the seed picks.
const bohrCheck: Exercise = checkBohr.answer.kind === "choice" && en(checkBohr.text ?? "").includes("working muscle") ? checkBohr : (() => {
  const r = createRng(7);
  for (let i = 0; i < 50; i++) {
    const e = bohrTask(r);
    if (e.answer.kind === "choice" && en(e.text ?? "").includes("working muscle")) return e;
  }
  return checkBohr;
})();


export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Haemoglobin and cooperative binding", "Hämoglobin und kooperative Bindung"),
      blob: tx("Four seats for oxygen, and they help each other!", "Vier Plätze für Sauerstoff, und die helfen sich gegenseitig!"),
      body: tx("Almost all oxygen in the blood is carried by haemoglobin in the red blood cells.", "Fast der gesamte Sauerstoff im Blut wird vom Hämoglobin in den roten Blutkörperchen transportiert."),
      frames: hbFrames,
    },
    {
      type: "widget",
      title: tx("The oxygen dissociation curve", "Die Sauerstoffbindungskurve"),
      blob: tx("Push the CO₂ slider and watch how much more oxygen the muscle gets!", "Schieb den CO₂-Regler und schau, wie viel mehr Sauerstoff der Muskel bekommt!"),
      body: tx(
        "The curve shows what percentage of haemoglobin is loaded with oxygen at a given O₂ partial pressure. **Bohr effect**: more CO₂ and a lower pH (as in a working muscle) shift the curve to the **right**. Haemoglobin then binds O₂ less tightly and releases more, exactly where it is needed. **Fetal haemoglobin** and **myoglobin** (the O₂ store in muscle) lie to the left: they bind O₂ more tightly.",
        "Die Kurve zeigt, wie viel Prozent des Hämoglobins bei einem bestimmten O₂-Partialdruck mit Sauerstoff beladen sind. **Bohr-Effekt**: Mehr CO₂ und ein niedrigerer pH-Wert (wie im arbeitenden Muskel) verschieben die Kurve nach **rechts**. Hämoglobin bindet O₂ dann schwächer und gibt mehr ab, genau dort, wo er gebraucht wird. **Fetales Hämoglobin** und **Myoglobin** (der O₂-Speicher im Muskel) liegen links: Sie binden O₂ fester.",
      ),
      widget: HeartOxygenWidget,
    },
    { type: "check", blob: tx("What happens in a muscle that works hard?", "Was passiert in einem Muskel, der hart arbeitet?"), exercise: bohrCheck },
    {
      type: "explain",
      title: tx("The cardiac cycle", "Der Herzzyklus"),
      blob: tx("Four phases, two pairs of valves, and everything runs on pressure alone!", "Vier Phasen, zwei Klappenpaare, und alles läuft nur über Druck!"),
      body: tx("Each heartbeat has a systole (contraction) and a diastole (relaxation), each with two phases.", "Jeder Herzschlag besteht aus Systole (Kontraktion) und Diastole (Erschlaffung) mit je zwei Phasen."),
      frames: cycleFrames,
    },
    {
      type: "widget",
      title: tx("Pressures and volume during one heartbeat", "Drücke und Volumen bei einem Herzschlag"),
      blob: tx("Read the curves like a detective story: who has the higher pressure right now?", "Lies die Kurven wie einen Krimi: Wer hat gerade den höheren Druck?"),
      body: tx(
        "Scrub through one heartbeat (0.8 s at 75 beats per minute). Top: the ECG; middle: the pressures in the left ventricle, aorta and left atrium; bottom: the ventricle volume. Where pressure curves cross, valves open or shut.",
        "Fahr mit dem Regler durch einen Herzschlag (0,8 s bei 75 Schlägen pro Minute). Oben das EKG, in der Mitte die Drücke in linker Kammer, Aorta und linkem Vorhof, unten das Kammervolumen. Wo sich Druckkurven kreuzen, öffnen oder schließen Klappen.",
      ),
      widget: HeartCycleWidget,
    },
    { type: "check", blob: tx("All valves shut, pressure rising: which phase?", "Alle Klappen zu, Druck steigt: Welche Phase?"), exercise: checkPhase },
    {
      type: "widget",
      title: tx("The heart's own pacemaker", "Der Schrittmacher des Herzens"),
      blob: tx("A built-in pacemaker: your heart doesn't even need the brain for its beat.", "Ein eingebauter Schrittmacher: Für seinen Takt braucht dein Herz nicht einmal das Gehirn."),
      body: tx(
        "The heart beats by itself (**autorhythmicity**): special heart muscle cells form and conduct excitation. The **sinus node** sets the pace. The excitation spreads over the atria to the **AV node**, which delays it briefly, then through the **bundle of His** and the **bundle branches** (Tawara-Schenkel) in the septum to the apex and via the **Purkinje fibres** into the ventricle muscle. The **ECG** records this excitation from the skin.",
        "Das Herz schlägt von selbst (**Autorhythmie**): Spezialisierte Herzmuskelzellen bilden und leiten Erregungen. Der **Sinusknoten** gibt den Takt vor. Die Erregung läuft über die Vorhöfe zum **AV-Knoten**, der sie kurz verzögert, dann durch das **His-Bündel** und die **Tawara-Schenkel** in der Scheidewand zur Herzspitze und über die **Purkinje-Fasern** in die Kammermuskulatur. Das **EKG** misst diese Erregung an der Hautoberfläche.",
      ),
      widget: HeartConductionWidget,
    },
    {
      type: "widget",
      title: tx("Cardiac output", "Das Herzminutenvolumen"),
      blob: tx("Calculate along: how many litres does an athlete manage?", "Rechne mit: Wie viele Liter schafft ein Sportler?"),
      body: tx(
        "The **cardiac output** (CO) is the volume of blood one ventricle ejects per minute: CO = stroke volume × heart rate. At rest that's about 70 ml × 70/min ≈ 4.9 l/min, roughly all your blood once a minute.",
        "Das **Herzminutenvolumen** (HMV) ist das Blutvolumen, das eine Kammer pro Minute auswirft: HMV = Schlagvolumen · Herzfrequenz. In Ruhe sind das etwa 70 ml · 70/min ≈ 4,9 l/min, also ungefähr dein ganzes Blut einmal pro Minute.",
      ),
      widget: HeartOutputWidget,
    },
    { type: "check", blob: tx("Your turn. Watch the units!", "Jetzt du. Achte auf die Einheiten!"), exercise: checkHmv },
    {
      type: "explain",
      title: tx("Blood pressure and its regulation", "Blutdruck und seine Regelung"),
      blob: tx("Your body regulates blood pressure like a thermostat regulates the heating.", "Dein Körper regelt den Blutdruck wie ein Thermostat die Heizung."),
      frames: bpFrames,
    },
    {
      type: "explain",
      title: tx("The rhesus factor", "Der Rhesusfaktor"),
      blob: tx("Rhesus is named after the rhesus monkeys in which the factor was discovered.", "Rhesus heißt der Faktor nach den Rhesusaffen, bei denen er entdeckt wurde."),
      frames: rhFrames,
    },
    { type: "check", blob: tx("A classic Abitur scenario. Think it through step by step.", "Ein klassisches Abi-Szenario. Denk es Schritt für Schritt durch."), exercise: checkRh },
  ],
  summary: [
    {
      title: tx("Haemoglobin and the O₂ curve", "Hämoglobin und O₂-Bindungskurve"),
      body: tx("4 subunits, each with a haem group (Fe²⁺): up to 4 O₂. Cooperative binding makes the curve sigmoid. Lungs (100 mmHg): about 97 %; tissue at rest (40 mmHg): about 75 %.", "4 Untereinheiten mit je einer Häm-Gruppe (Fe²⁺): bis zu 4 O₂. Kooperative Bindung macht die Kurve sigmoid. Lunge (100 mmHg): etwa 97 %, Gewebe in Ruhe (40 mmHg): etwa 75 %."),
      examples: ["\\ce{Hb + 4O2 <=> Hb(O2)4}"],
      tone: "rule",
    },
    {
      title: tx("Shifts of the curve", "Verschiebungen der Kurve"),
      body: tx("Bohr effect: more CO₂, lower pH, higher temperature → right shift: lower affinity, more O₂ released in the tissue. Left shift = higher affinity: fetal haemoglobin, myoglobin (hyperbolic, one subunit, O₂ store).", "Bohr-Effekt: mehr CO₂, niedrigerer pH-Wert, höhere Temperatur → Rechtsverschiebung: geringere Affinität, mehr O₂-Abgabe im Gewebe. Linksverschiebung = höhere Affinität: fetales Hämoglobin, Myoglobin (hyperbolisch, eine Untereinheit, O₂-Speicher)."),
      tone: "rule",
    },
    {
      title: tx("Cardiac cycle", "Herzzyklus"),
      body: tx("Valves open passively by pressure difference. During isovolumetric contraction and relaxation all valves are shut and the volume stays constant.", "Klappen öffnen passiv nach dem Druckunterschied. In Anspannungs- und Entspannungsphase sind alle Klappen zu, das Volumen bleibt konstant."),
      examples: [tx('"systole:" \\; "isovol. contraction" \\to "ejection"', '"Systole:" \\; "Anspannung" \\to "Austreibung"'), tx('"diastole:" \\; "isovol. relaxation" \\to "filling"', '"Diastole:" \\; "Entspannung" \\to "Füllung"')],
      tone: "rule",
    },
    {
      title: tx("Conduction and ECG", "Erregungsleitung und EKG"),
      body: tx("P: atria excited · PQ: delay in the AV node · QRS: ventricles excited · T: ventricles recover.", "P: Erregung der Vorhöfe · PQ: Verzögerung im AV-Knoten · QRS: Erregung der Kammern · T: Erregungsrückbildung der Kammern."),
      examples: [tx('"sinus node" \\to "AV node" \\to "His" \\\\ \\to "bundle branches" \\to "Purkinje"', '"Sinusknoten" \\to "AV-Knoten" \\to "His-Bündel" \\\\ \\to "Tawara-Schenkel" \\to "Purkinje-Fasern"')],
      tone: "rule",
    },
    {
      title: tx("Cardiac output", "Herzminutenvolumen"),
      body: tx("Watch the units: 1000 ml = 1 l. Heart rate from the ECG: HR = 60 s ÷ RR interval (at 25 mm/s: RR in s = mm ÷ 25).", "Achte auf die Einheiten: 1000 ml = 1 l. Herzfrequenz aus dem EKG: HF = 60 s : RR-Abstand (bei 25 mm/s: RR in s = mm : 25)."),
      examples: [tx('"CO" = "SV" \\cdot "HR"', '"HMV" = "SV" \\cdot "HF"'), tx('70 "ml" \\cdot 70 "/min" = 4900 "ml/min" \\approx 4.9 "l/min"', '70 "ml" \\cdot 70 "/min" = 4900 "ml/min" \\approx 4,9 "l/min"')],
      tone: "tip",
    },
    {
      title: tx("Blood pressure and rhesus", "Blutdruck und Rhesus"),
      body: tx("120/80 mmHg = systolic/diastolic. Regulated by pressoreceptors, circulatory centre, sympathetic (up) and parasympathetic (down). Rhesus: danger only for an rh− mother with an Rh+ child, from the second pregnancy on; prevented by anti-D prophylaxis.", "120/80 mmHg = systolisch/diastolisch. Geregelt über Pressorezeptoren, Kreislaufzentrum, Sympathikus (hoch) und Parasympathikus (runter). Rhesus: Gefahr nur bei rh−-Mutter mit Rh+-Kind, ab der zweiten Schwangerschaft; Schutz durch die Anti-D-Prophylaxe."),
      tone: "warning",
    },
  ],
};
