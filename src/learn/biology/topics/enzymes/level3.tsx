"use client";

// Enzymes, level 3 (Oberstufe): Michaelis-Menten kinetics (vmax, KM as a measure of affinity,
// reading and calculating values), competitive, non-competitive (allosteric) and irreversible
// inhibition, cofactors and coenzymes, allosteric regulation and end-product inhibition,
// induced fit, enzyme names.

import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { EnzymeMMGraph, EnzymeTable } from "@/learn/biology/visuals/EnzymeCharts";
import { EnzymeFeedback, EnzymePathway } from "@/learn/biology/visuals/EnzymeFeedback";
import { EnzymeInhibition } from "@/learn/biology/visuals/EnzymeFigures";
import { EnzymeKinetics } from "@/learn/biology/visuals/EnzymeKinetics";
import { EnzymeLockKey } from "@/learn/biology/visuals/EnzymeLockKey";
import { dec } from "@/learn/chemistry/format";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { choice, mistakes, mm, multi, PICK, PICK_ALL, RATE, MMOL, visual, weighted, type Opt, type Stmt } from "./data";

const mmolT = (l: Locale) => (l === "de" ? "mmol/l" : "mmol/L");
const rateT = (l: Locale) => (l === "de" ? "µmol/(l·min)" : "µmol/(L·min)");
const f2 = (v: number, l: Locale) => dec(v, l, 2);
const sameItem = (a: Text, b: Text) => JSON.stringify(a) === JSON.stringify(b);

const COMP: Text = tx("competitive inhibition", "kompetitive Hemmung");
const NONCOMP: Text = tx("non-competitive (allosteric) inhibition", "nicht-kompetitive (allosterische) Hemmung");
const IRREV: Text = tx("irreversible inhibition", "irreversible Hemmung");
const KM_TRAP: Text = tx("Small KM, high affinity", "Kleines KM, hohe Affinität");

// ---------------------------------------------------------------------------
// Michaelis-Menten: calculate v

const K_CASES: { num: number; den: number; kms: number[] }[] = [
  { num: 1, den: 1, kms: [0.5, 1, 2, 4, 5] },
  { num: 3, den: 1, kms: [0.5, 1, 2, 4] },
  { num: 4, den: 1, kms: [0.5, 1, 2.5] },
  { num: 9, den: 1, kms: [0.5, 1, 2] },
  { num: 1, den: 3, kms: [3, 6] },
  { num: 1, den: 4, kms: [2, 4] },
];

function mmCalcTask(rng: Rng): Exercise {
  const kc = rng.pick(K_CASES);
  const km = rng.pick(kc.kms);
  const vmax = rng.pick([40, 60, 80, 100, 120, 200]);
  const s = (km * kc.num) / kc.den;
  const v = mm(s, vmax, km);
  const right: AnswerSpec = { kind: "number", value: v, tolerance: 0.01, unit: RATE };
  const m = mistakes(right);
  m.add({ kind: "number", value: (vmax * s) / km }, tx("[S] missing below the line", "[S] im Nenner vergessen"), tx("In the denominator it's $K_M + [S]$, not just $K_M$. Without $[S]$ you could even get more than $v_{max}$.", "Im Nenner steht $K_M + [S]$, nicht nur $K_M$. Ohne $[S]$ könntest du sogar mehr als $v_{max}$ herausbekommen."));
  m.add({ kind: "number", value: (vmax * km) / (km + s) }, tx("KM and [S] swapped", "KM und [S] vertauscht"), tx("On top it's $v_{max} \\cdot [S]$, not $v_{max} \\cdot K_M$. Check which value goes where.", "Im Zähler steht $v_{max} \\cdot [S]$, nicht $v_{max} \\cdot K_M$. Prüf, welcher Wert wohin gehört."));
  m.add({ kind: "number", value: vmax / 2 }, tx("Half only at [S] = KM", "Halb nur bei [S] = KM"), tx("$v = \\frac{1}{2} v_{max}$ only holds when $[S] = K_M$. Here $[S]$ is different, so put the numbers into the equation.", "$v = \\frac{1}{2} v_{max}$ gilt nur, wenn $[S] = K_M$ ist. Hier ist $[S]$ anders, also setz die Zahlen in die Gleichung ein."));
  m.add({ kind: "number", value: vmax }, tx("vmax is never quite reached", "vmax wird nie ganz erreicht"), tx("$v_{max}$ is only approached at very high $[S]$. Work out $v$ with the equation.", "$v_{max}$ wird nur bei sehr hohem $[S]$ annähernd erreicht. Rechne $v$ mit der Gleichung aus."));
  return {
    instruction: tx("Calculate the rate", "Berechne die Geschwindigkeit"),
    text: txMap((tt, l) =>
      tt(
        `An enzyme has $v_{max} = ${vmax}$ ${rateT(l)} and $K_M = ${f2(km, l)}$ ${mmolT(l)}. How fast is the reaction at a substrate concentration of ${f2(s, l)} ${mmolT(l)}?`,
        `Ein Enzym hat $v_{max} = ${vmax}$ ${rateT(l)} und $K_M = ${f2(km, l)}$ ${mmolT(l)}. Wie schnell ist die Reaktion bei einer Substratkonzentration von ${f2(s, l)} ${mmolT(l)}?`,
      ),
    ),
    answer: right,
    hint: tx("Use $v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}$.", "Nutze $v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}$."),
    solution: [
      { math: "v =#e \\frac{v_{max} \\cdot [S]}{K_M + [S]}", note: tx("The Michaelis-Menten equation.", "Die Michaelis-Menten-Gleichung.") },
      { math: txMap((_, l) => `v =#e \\frac{${vmax} \\cdot ${f2(s, l)}}{${f2(km, l)} + ${f2(s, l)}}`), note: tx("Put in the values (both concentrations in the same unit).", "Werte einsetzen (beide Konzentrationen in derselben Einheit).") },
      { math: txMap((_, l) => `v =#e ${f2(v, l)}`), note: txMap((tt, l) => tt(`So **${f2(v, l)} ${rateT(l)}**: that's ${Math.round((100 * v) / vmax)} % of $v_{max}$.`, `Also **${f2(v, l)} ${rateT(l)}**: Das sind ${Math.round((100 * v) / vmax)} % von $v_{max}$.`)) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Reading the graph: KM or vmax

function graphScale(km: number, vmax: number) {
  const small = km <= 2.5;
  return { xMax: small ? 10 : 20, xStep: small ? 1 : 2, yMax: vmax <= 50 ? vmax + 10 : vmax + 20, yStep: vmax <= 60 ? 10 : 20 };
}

function readGraphTask(rng: Rng): Exercise {
  const vmax = rng.pick([40, 50, 60, 80, 100]);
  const km = rng.pick([0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
  const sc = graphScale(km, vmax);
  if (rng.chance(0.65)) {
    const right: AnswerSpec = { kind: "number", value: km, tolerance: 0.1, unit: MMOL };
    const m = mistakes(right);
    m.add({ kind: "number", value: vmax / 2 }, tx("That's the rate", "Das ist die Geschwindigkeit"), tx("You found $\\frac{1}{2} v_{max}$ on the y-axis, good! Now go across to the curve and **down** to the x-axis: $K_M$ is a substrate concentration.", "Du hast $\\frac{1}{2} v_{max}$ auf der y-Achse gefunden, gut! Jetzt geh waagerecht zur Kurve und dann **senkrecht nach unten** zur x-Achse: $K_M$ ist eine Substratkonzentration."));
    m.add({ kind: "number", value: vmax }, tx("That's vmax", "Das ist vmax"), tx("That's the maximum rate. $K_M$ is the substrate concentration at **half** of it.", "Das ist die Maximalgeschwindigkeit. $K_M$ ist die Substratkonzentration bei der **Hälfte** davon."));
    return {
      instruction: tx("Read off KM", "Lies KM ab"),
      text: tx("The dashed line marks $v_{max}$. Determine the Michaelis constant $K_M$ from the graph.", "Die gestrichelte Linie zeigt $v_{max}$. Bestimme die Michaelis-Konstante $K_M$ aus dem Diagramm."),
      visual: visual(EnzymeMMGraph, { curves: [{ vmax, km }], ...sc, asymptote: vmax }),
      answer: right,
      hint: tx("Halve $v_{max}$, go across to the curve, then down to the x-axis.", "Halbiere $v_{max}$, geh waagerecht zur Kurve und dann senkrecht nach unten."),
      solution: [
        { math: txMap((_, l) => `\\frac{1}{2} v_{max} = \\frac{1}{2} \\cdot ${vmax} = ${f2(vmax / 2, l)}`), note: tx("First halve the maximum rate.", "Zuerst die Maximalgeschwindigkeit halbieren.") },
        { math: txMap((_, l) => `K_M = ${f2(km, l)} "${mmolT(l)}"`), note: tx("At this rate the curve is above this substrate concentration: that's $K_M$.", "Bei dieser Geschwindigkeit liegt die Kurve über dieser Substratkonzentration: Das ist $K_M$.") },
      ],
      mistakes: m.list,
    };
  }
  const right: AnswerSpec = { kind: "number", value: vmax, tolerance: 0.08, unit: RATE };
  const m = mistakes(right);
  m.add({ kind: "number", value: vmax / 2 }, tx("That's half", "Das ist die Hälfte"), tx("That's half the maximum rate. $v_{max}$ is the value the curve approaches at very high $[S]$.", "Das ist die halbe Maximalgeschwindigkeit. $v_{max}$ ist der Wert, dem sich die Kurve bei sehr hohem $[S]$ nähert."));
  m.add({ kind: "number", value: km }, tx("That's KM", "Das ist KM"), tx("That's a substrate concentration on the x-axis. $v_{max}$ is a rate: read it on the y-axis.", "Das ist eine Substratkonzentration auf der x-Achse. $v_{max}$ ist eine Geschwindigkeit: Lies sie auf der y-Achse ab."));
  const xMax = Math.max(20, km * 20);
  return {
    instruction: tx("Estimate vmax", "Schätze vmax ab"),
    text: tx("Estimate the maximum rate $v_{max}$ of this enzyme from the graph.", "Schätze die Maximalgeschwindigkeit $v_{max}$ dieses Enzyms aus dem Diagramm ab."),
    visual: visual(EnzymeMMGraph, { curves: [{ vmax, km }], xMax, xStep: xMax / 10, yMax: sc.yMax, yStep: sc.yStep }),
    answer: right,
    hint: tx("Which value does the curve level off at?", "Auf welchen Wert läuft die Kurve zu?"),
    solution: [{ math: txMap((_, l) => `v_{max} \\approx ${vmax} "${rateT(l)}"`), note: tx("At high substrate concentrations the curve flattens out and approaches this value: all enzymes are saturated.", "Bei hohen Substratkonzentrationen flacht die Kurve ab und nähert sich diesem Wert: Alle Enzyme sind gesättigt.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Table of measurements

function tableTask(rng: Rng): Exercise {
  const vmax = rng.pick([40, 50, 60, 80, 100, 120]);
  const km = rng.pick([0.5, 1, 2, 4]);
  if (rng.chance(0.7)) {
    const factors = [0.25, 0.5, 1, 2, 4, 8, 20];
    const rows: [number, number][] = factors.map((f) => [km * f, Math.round(mm(km * f, vmax, km) * 10) / 10]);
    const right: AnswerSpec = { kind: "number", value: km, tolerance: 0.02, unit: MMOL };
    const m = mistakes(right);
    m.add({ kind: "number", value: vmax / 2 }, tx("That's the rate", "Das ist die Geschwindigkeit"), tx("You found the row with $\\frac{1}{2} v_{max}$, good! $K_M$ is the **substrate concentration** in that column.", "Du hast die Spalte mit $\\frac{1}{2} v_{max}$ gefunden, gut! $K_M$ ist die **Substratkonzentration** in dieser Spalte."));
    m.add({ kind: "number", value: km * 20 }, tx("KM isn't at the end", "KM liegt nicht am Ende"), tx("At the highest concentration the enzyme is almost saturated. $K_M$ is where the rate is **half** of $v_{max}$.", "Bei der höchsten Konzentration ist das Enzym fast gesättigt. $K_M$ liegt dort, wo die Geschwindigkeit **halb** so groß ist wie $v_{max}$."));
    m.add({ kind: "number", value: km * 2 }, tx("Look for exactly half", "Genau die Hälfte suchen"), tx("Close: look for the column where $v$ is **exactly** half of $v_{max}$.", "Knapp daneben: Such die Spalte, in der $v$ **genau** die Hälfte von $v_{max}$ ist."), true);
    return {
      instruction: tx("Determine KM", "Bestimme KM"),
      text: txMap((tt, l) =>
        tt(
          `Initial rates of an enzyme reaction were measured at different substrate concentrations. At very high substrate concentration the rate approaches $v_{max} = ${vmax}$ ${rateT(l)}. Determine $K_M$.`,
          `Die Anfangsgeschwindigkeit einer Enzymreaktion wurde bei verschiedenen Substratkonzentrationen gemessen. Bei sehr hoher Substratkonzentration nähert sich die Geschwindigkeit $v_{max} = ${vmax}$ ${rateT(l)}. Bestimme $K_M$.`,
        ),
      ),
      visual: visual(EnzymeTable, { head: [tx("[S] in mmol/L", "[S] in mmol/l"), tx("v in µmol/(L·min)", "v in µmol/(l·min)")], rows, digits: [3, 1] as [number, number] }),
      answer: right,
      hint: tx("$K_M$ is the substrate concentration at which $v = \\frac{1}{2} v_{max}$.", "$K_M$ ist die Substratkonzentration, bei der $v = \\frac{1}{2} v_{max}$ ist."),
      solution: [
        { math: txMap((_, l) => `\\frac{1}{2} v_{max} = ${f2(vmax / 2, l)}`), note: tx("Half the maximum rate.", "Die halbe Maximalgeschwindigkeit.") },
        { math: txMap((_, l) => `v = ${f2(vmax / 2, l)} \\Rightarrow [S] = ${f2(km, l)} \\Rightarrow K_M = ${f2(km, l)} "${mmolT(l)}"`), note: tx("This rate belongs to this substrate concentration: that's $K_M$.", "Diese Geschwindigkeit gehört zu dieser Substratkonzentration: Das ist $K_M$.") },
      ],
      mistakes: m.list,
    };
  }
  // vmax from one measurement and KM
  const kc = rng.pick(K_CASES.filter((k) => k.kms.includes(km) || k.num === 3));
  const kmUse = kc.kms.includes(km) ? km : kc.kms[0];
  const s = (kmUse * kc.num) / kc.den;
  const v = mm(s, vmax, kmUse);
  const right: AnswerSpec = { kind: "number", value: vmax, tolerance: 0.01, unit: RATE };
  const m = mistakes(right);
  m.add({ kind: "number", value: v }, tx("That's the measured rate", "Das ist die gemessene Geschwindigkeit"), tx("That's $v$ at this one concentration. $v_{max}$ is bigger: solve the equation for $v_{max}$.", "Das ist $v$ bei dieser einen Konzentration. $v_{max}$ ist größer: Stell die Gleichung nach $v_{max}$ um."));
  m.add({ kind: "number", value: 2 * v }, tx("Doubling only works at KM", "Verdoppeln nur bei KM"), tx("$v_{max} = 2v$ only works if $[S] = K_M$. Here you need the full equation.", "$v_{max} = 2v$ gilt nur, wenn $[S] = K_M$ ist. Hier brauchst du die ganze Gleichung."));
  m.add({ kind: "number", value: (v * s) / (kmUse + s) }, tx("Equation solved the wrong way", "Falsch umgestellt"), tx("Solved for $v_{max}$ you get $v_{max} = \\frac{v \\cdot (K_M + [S])}{[S]}$.", "Nach $v_{max}$ umgestellt: $v_{max} = \\frac{v \\cdot (K_M + [S])}{[S]}$."));
  return {
    instruction: tx("Calculate vmax", "Berechne vmax"),
    text: txMap((tt, l) =>
      tt(
        `An enzyme has $K_M = ${f2(kmUse, l)}$ ${mmolT(l)}. At $[S] = ${f2(s, l)}$ ${mmolT(l)} the measured rate is $v = ${f2(v, l)}$ ${rateT(l)}. Calculate $v_{max}$.`,
        `Ein Enzym hat $K_M = ${f2(kmUse, l)}$ ${mmolT(l)}. Bei $[S] = ${f2(s, l)}$ ${mmolT(l)} misst man $v = ${f2(v, l)}$ ${rateT(l)}. Berechne $v_{max}$.`,
      ),
    ),
    answer: right,
    hint: tx("Solve $v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}$ for $v_{max}$.", "Stell $v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}$ nach $v_{max}$ um."),
    solution: [
      { math: "v_{max} = \\frac{v \\cdot (K_M + [S])}{[S]}", note: tx("Solve the Michaelis-Menten equation for $v_{max}$.", "Die Michaelis-Menten-Gleichung nach $v_{max}$ umstellen.") },
      { math: txMap((_, l) => `v_{max} = \\frac{${f2(v, l)} \\cdot (${f2(kmUse, l)} + ${f2(s, l)})}{${f2(s, l)}} = ${vmax}`), note: txMap((tt, l) => tt(`So $v_{max}$ = **${vmax} ${rateT(l)}**.`, `Also $v_{max}$ = **${vmax} ${rateT(l)}**.`)) },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Which inhibition does the graph show?

function inhibitionGraphTask(rng: Rng): Exercise {
  const vmax = rng.pick([60, 80, 100]);
  const km = rng.pick([1, 2, 2.5]);
  const comp = rng.chance(0.5);
  const f = rng.pick([2, 3, 4]);
  const r = rng.pick([0.4, 0.5, 0.6]);
  const inh = comp ? { vmax, km: km * f } : { vmax: vmax * r, km };
  const c = choice(rng, [
    { text: comp ? COMP : NONCOMP },
    comp
      ? { text: NONCOMP, title: tx("Look at vmax", "Schau auf vmax"), say: tx("Both curves head for the **same** $v_{max}$: the inhibitor can be outcompeted by lots of substrate. Only $K_M$ has risen. That's competitive.", "Beide Kurven laufen auf **dasselbe** $v_{max}$ zu: Viel Substrat verdrängt den Hemmstoff. Nur $K_M$ ist gestiegen. Das ist kompetitiv.") }
      : { text: COMP, title: tx("Look at vmax", "Schau auf vmax"), say: tx("With a competitive inhibitor the curve would still reach the same $v_{max}$. Here $v_{max}$ is lower and $K_M$ stays the same: non-competitive.", "Bei kompetitiver Hemmung würde die Kurve noch dasselbe $v_{max}$ erreichen. Hier ist $v_{max}$ niedriger und $K_M$ bleibt gleich: nicht-kompetitiv.") },
    { text: tx("more enzyme was added", "es wurde mehr Enzym zugegeben"), title: tx("More enzyme raises vmax", "Mehr Enzym erhöht vmax"), say: tx("More enzyme would make curve 2 **higher**, not lower or flatter.", "Mehr Enzym würde Kurve 2 **höher** machen, nicht niedriger oder flacher.") },
  ]);
  return {
    instruction: tx("Identify the inhibition", "Bestimme die Art der Hemmung"),
    text: tx("Curve 1: enzyme without inhibitor. Curve 2: the same enzyme with an inhibitor. Which kind of inhibition is this?", "Kurve 1: Enzym ohne Hemmstoff. Kurve 2: dasselbe Enzym mit Hemmstoff. Um welche Art der Hemmung handelt es sich?"),
    visual: visual(EnzymeMMGraph, { curves: [{ vmax, km, label: "1" }, { ...inh, label: "2", dashed: true }], xMax: 40, xStep: 5, yMax: vmax + 20, yStep: 20 }),
    answer: c.answer,
    hint: tx("Compare $v_{max}$ (where the curves level off) and $K_M$ (at half of $v_{max}$).", "Vergleich $v_{max}$ (worauf die Kurven zulaufen) und $K_M$ (bei der Hälfte von $v_{max}$)."),
    solution: comp
      ? [
          { math: tx('v_{max} "unchanged", \\; K_M "increased"', 'v_{max} "gleich", \\; K_M "größer"'), note: tx("Same $v_{max}$, larger $K_M$: the inhibitor competes with the substrate for the active site.", "Gleiches $v_{max}$, größeres $K_M$: Der Hemmstoff konkurriert mit dem Substrat um das aktive Zentrum.") },
          { math: tx('"competitive inhibition"', '"kompetitive Hemmung"'), note: tx("With enough substrate the substrate wins, so $v_{max}$ is still reached. You just need more substrate for half of it.", "Bei genug Substrat setzt sich das Substrat durch, $v_{max}$ wird also noch erreicht. Man braucht nur mehr Substrat für die Hälfte davon.") },
        ]
      : [
          { math: tx('v_{max} "decreased", \\; K_M "unchanged"', 'v_{max} "kleiner", \\; K_M "gleich"'), note: tx("Lower $v_{max}$, same $K_M$: some of the enzyme molecules are put out of action.", "Kleineres $v_{max}$, gleiches $K_M$: Ein Teil der Enzymmoleküle fällt aus.") },
          { math: tx('"non-competitive inhibition"', '"nicht-kompetitive Hemmung"'), note: tx("The inhibitor binds outside the active site (allosteric site) and deforms it. More substrate doesn't help.", "Der Hemmstoff bindet außerhalb des aktiven Zentrums (allosterisches Zentrum) und verformt es. Mehr Substrat hilft nicht.") },
        ],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Statements about inhibition (multi)

const COMP_STMTS: Stmt[] = [
  { ok: true, text: tx("The inhibitor is similar in structure to the substrate.", "Der Hemmstoff ist dem Substrat strukturähnlich.") },
  { ok: true, text: tx("The inhibitor binds in the active site.", "Der Hemmstoff bindet im aktiven Zentrum.") },
  { ok: true, text: tx("KM increases.", "KM steigt."), title: tx("KM does rise", "KM steigt sehr wohl"), say: tx("This one is true: you need more substrate to reach half of $v_{max}$.", "Die stimmt: Man braucht mehr Substrat, um die Hälfte von $v_{max}$ zu erreichen.") },
  { ok: true, text: tx("vmax stays the same.", "vmax bleibt gleich."), title: tx("vmax is still reached", "vmax wird noch erreicht"), say: tx("This one is true: with a lot of substrate the inhibitor is outcompeted.", "Die stimmt: Bei sehr viel Substrat wird der Hemmstoff verdrängt.") },
  { ok: true, text: tx("A high substrate concentration can cancel the effect.", "Eine hohe Substratkonzentration hebt die Wirkung auf.") },
  { ok: false, text: tx("vmax decreases.", "vmax sinkt."), title: tx("That's non-competitive", "Das ist nicht-kompetitiv"), say: tx("A falling $v_{max}$ is the sign of **non-competitive** inhibition. Competitive inhibitors can be outcompeted, so $v_{max}$ stays.", "Ein sinkendes $v_{max}$ ist das Kennzeichen der **nicht-kompetitiven** Hemmung. Kompetitive Hemmstoffe werden verdrängt, $v_{max}$ bleibt.") },
  { ok: false, text: tx("The inhibitor binds at the allosteric site.", "Der Hemmstoff bindet am allosterischen Zentrum."), title: tx("That's allosteric", "Das ist allosterisch"), say: tx("Binding at the allosteric site is non-competitive. A competitive inhibitor sits in the active site.", "Binden am allosterischen Zentrum ist nicht-kompetitiv. Ein kompetitiver Hemmstoff sitzt im aktiven Zentrum.") },
  { ok: false, text: tx("KM decreases.", "KM sinkt."), title: tx("KM rises", "KM steigt"), say: tx("A smaller $K_M$ would mean higher affinity. The inhibitor makes it harder for the substrate, so $K_M$ rises.", "Ein kleineres $K_M$ hieße höhere Affinität. Der Hemmstoff macht es dem Substrat schwerer, $K_M$ steigt also.") },
  { ok: false, text: tx("The inhibitor is used up in the reaction.", "Der Hemmstoff wird bei der Reaktion verbraucht."), title: tx("It isn't converted", "Er wird nicht umgesetzt"), say: tx("A competitive inhibitor is not converted. It binds reversibly and leaves again unchanged.", "Ein kompetitiver Hemmstoff wird nicht umgesetzt. Er bindet reversibel und löst sich unverändert wieder.") },
];
const NON_STMTS: Stmt[] = [
  { ok: true, text: tx("The inhibitor binds outside the active site.", "Der Hemmstoff bindet außerhalb des aktiven Zentrums.") },
  { ok: true, text: tx("The shape of the active site changes.", "Die Form des aktiven Zentrums verändert sich.") },
  { ok: true, text: tx("vmax decreases.", "vmax sinkt."), title: tx("vmax does fall", "vmax sinkt sehr wohl"), say: tx("This one is true: the enzymes holding an inhibitor are out of action.", "Die stimmt: Die Enzyme, an denen ein Hemmstoff sitzt, fallen aus.") },
  { ok: true, text: tx("KM stays the same.", "KM bleibt gleich.") },
  { ok: true, text: tx("More substrate can't cancel the effect.", "Mehr Substrat hebt die Wirkung nicht auf.") },
  { ok: false, text: tx("The inhibitor is similar in structure to the substrate.", "Der Hemmstoff ist dem Substrat strukturähnlich."), title: tx("That's competitive", "Das ist kompetitiv"), say: tx("Structural similarity is the hallmark of **competitive** inhibitors. A non-competitive inhibitor binds elsewhere and doesn't have to look like the substrate.", "Strukturähnlichkeit ist das Kennzeichen **kompetitiver** Hemmstoffe. Ein nicht-kompetitiver Hemmstoff bindet woanders und muss dem Substrat nicht ähneln.") },
  { ok: false, text: tx("KM increases, vmax stays the same.", "KM steigt, vmax bleibt gleich."), title: tx("That's competitive", "Das ist kompetitiv"), say: tx("That's the pattern of **competitive** inhibition. Non-competitive: $v_{max}$ falls, $K_M$ stays.", "Das ist das Muster der **kompetitiven** Hemmung. Nicht-kompetitiv: $v_{max}$ sinkt, $K_M$ bleibt.") },
  { ok: false, text: tx("Lots of substrate pushes the inhibitor out of the active site.", "Viel Substrat verdrängt den Hemmstoff aus dem aktiven Zentrum."), title: tx("Not in the active site", "Nicht im aktiven Zentrum"), say: tx("The inhibitor doesn't sit in the active site at all, so the substrate can't push it out.", "Der Hemmstoff sitzt gar nicht im aktiven Zentrum, also kann ihn das Substrat nicht verdrängen.") },
];

function statementsTask(rng: Rng): Exercise {
  const comp = rng.chance(0.5);
  const nTrue = rng.int(2, 3);
  const m = multi(rng, comp ? COMP_STMTS : NON_STMTS, nTrue, 5 - nTrue);
  return {
    instruction: PICK_ALL,
    text: comp ? tx("Which statements are true for **competitive** inhibition?", "Welche Aussagen gelten für die **kompetitive** Hemmung?") : tx("Which statements are true for **non-competitive (allosteric)** inhibition?", "Welche Aussagen gelten für die **nicht-kompetitive (allosterische)** Hemmung?"),
    answer: m.answer,
    hint: comp ? tx("Inhibitor and substrate compete for the same site.", "Hemmstoff und Substrat konkurrieren um dieselbe Stelle.") : tx("The inhibitor binds elsewhere and deforms the enzyme.", "Der Hemmstoff bindet woanders und verformt das Enzym."),
    solution: [
      comp
        ? { math: tx('"competitive:" \\; K_M "↑" \\quad v_{max} "unchanged"', '"kompetitiv:" \\; K_M "↑" \\quad v_{max} "gleich"'), note: tx("Similar to the substrate, binds in the active site, outcompeted by lots of substrate: $K_M$ rises, $v_{max}$ stays.", "Substratähnlich, bindet im aktiven Zentrum, wird von viel Substrat verdrängt: $K_M$ steigt, $v_{max}$ bleibt.") }
        : { math: tx('"non-competitive:" \\; v_{max} "↓" \\quad K_M "unchanged"', '"nicht-kompetitiv:" \\; v_{max} "↓" \\quad K_M "gleich"'), note: tx("Binds at the allosteric site and deforms the active site: $v_{max}$ falls, $K_M$ stays, more substrate doesn't help.", "Bindet am allosterischen Zentrum und verformt das aktive Zentrum: $v_{max}$ sinkt, $K_M$ bleibt, mehr Substrat hilft nicht.") },
    ],
    mistakes: m.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Cases: which kind of inhibition?

type Kind = "comp" | "non" | "irr";
const KIND_TEXT: Record<Kind, Text> = { comp: COMP, non: NONCOMP, irr: IRREV };
type Case = { text: Text; kind: Kind; why: Text; trap?: { kind: Kind; title: Text; say: Text } };

const CASES: Case[] = [
  {
    text: tx("Malonate is very similar to succinate and blocks the enzyme succinate dehydrogenase. With lots of succinate the enzyme works almost normally again.", "Malonat ist dem Succinat sehr ähnlich und blockiert das Enzym Succinat-Dehydrogenase. Bei viel Succinat arbeitet das Enzym fast wieder normal."),
    kind: "comp",
    why: tx("Similar structure, reversed by lots of substrate: competitive.", "Ähnliche Struktur, durch viel Substrat aufhebbar: kompetitiv."),
    trap: { kind: "irr", title: tx("It can be reversed", "Es ist aufhebbar"), say: tx("With lots of substrate the enzyme works again, so the inhibitor can't be bound for good.", "Bei viel Substrat arbeitet das Enzym wieder, der Hemmstoff kann also nicht dauerhaft gebunden sein.") },
  },
  {
    text: tx("In methanol poisoning, doctors give ethanol. Both compete for the active site of alcohol dehydrogenase, so less toxic formaldehyde is made.", "Bei einer Methanolvergiftung gibt man Ethanol. Beide konkurrieren um das aktive Zentrum der Alkohol-Dehydrogenase, so entsteht weniger giftiges Formaldehyd."),
    kind: "comp",
    why: tx("Two similar molecules competing for the same active site: competitive.", "Zwei ähnliche Moleküle konkurrieren um dasselbe aktive Zentrum: kompetitiv."),
    trap: { kind: "non", title: tx("Same active site", "Gleiches aktives Zentrum"), say: tx("Ethanol binds in the **active site** itself, not at a second site. That's competition.", "Ethanol bindet im **aktiven Zentrum** selbst, nicht an einer zweiten Stelle. Das ist Konkurrenz.") },
  },
  {
    text: tx("Sulfonamides (antibiotics) look like para-aminobenzoic acid, the substrate of a bacterial enzyme for making folic acid, and bind to its active site.", "Sulfonamide (Antibiotika) ähneln der p-Aminobenzoesäure, dem Substrat eines bakteriellen Enzyms der Folsäuresynthese, und binden an dessen aktives Zentrum."),
    kind: "comp",
    why: tx("Substrate look-alike in the active site: competitive.", "Substratähnlich, im aktiven Zentrum: kompetitiv."),
    trap: { kind: "non", title: tx("In the active site", "Im aktiven Zentrum"), say: tx("Sulfonamides look like the substrate and bind in the active site itself: that's competition, not an allosteric effect.", "Sulfonamide ähneln dem Substrat und binden im aktiven Zentrum selbst: Das ist Konkurrenz, kein allosterischer Effekt.") },
  },
  {
    text: tx("Mercury ions (Hg²⁺) bind firmly to the SH groups of cysteine in many enzymes. Even after removing the free mercury, the enzymes stay inactive.", "Quecksilber-Ionen (Hg²⁺) binden fest an die SH-Gruppen des Cysteins vieler Enzyme. Auch nach Entfernen des freien Quecksilbers bleiben die Enzyme inaktiv."),
    kind: "irr",
    why: tx("Firm, permanent binding of a heavy metal: irreversible.", "Feste, dauerhafte Bindung eines Schwermetalls: irreversibel."),
    trap: { kind: "non", title: tx("Permanent", "Dauerhaft"), say: tx("The binding is permanent: the enzymes stay inactive even when the inhibitor is gone. That's irreversible.", "Die Bindung ist dauerhaft: Die Enzyme bleiben inaktiv, auch wenn der Hemmstoff weg ist. Das ist irreversibel.") },
  },
  {
    text: tx("Lead ions (Pb²⁺) bind to the SH groups of an enzyme and change its folded structure for good.", "Blei-Ionen (Pb²⁺) binden an die SH-Gruppen eines Enzyms und verändern seine Raumstruktur dauerhaft."),
    kind: "irr",
    why: tx("Heavy metal, permanent change: irreversible.", "Schwermetall, dauerhafte Veränderung: irreversibel."),
    trap: { kind: "non", title: tx("For good", "Dauerhaft"), say: tx("Lead changes the structure **for good**. That's what makes it irreversible, wherever it binds.", "Blei verändert die Struktur **dauerhaft**. Das macht die Hemmung irreversibel, egal wo es bindet.") },
  },
  {
    text: tx("The insecticide parathion (E 605) binds covalently to the active site of acetylcholinesterase and blocks it permanently.", "Das Insektizid Parathion (E 605) bindet kovalent an das aktive Zentrum der Acetylcholinesterase und blockiert es dauerhaft."),
    kind: "irr",
    why: tx("Covalent, permanent: irreversible, even though it binds in the active site.", "Kovalent und dauerhaft: irreversibel, obwohl es im aktiven Zentrum bindet."),
    trap: { kind: "comp", title: tx("Permanent, not competing", "Dauerhaft statt Konkurrenz"), say: tx("It does bind in the active site, but covalently and for good. More substrate can't push it out: irreversible.", "Es bindet zwar im aktiven Zentrum, aber kovalent und dauerhaft. Mehr Substrat kann es nicht verdrängen: irreversibel.") },
  },
  {
    text: tx("Penicillin binds permanently to the enzyme bacteria use to build their cell wall.", "Penicillin bindet dauerhaft an das Enzym, mit dem Bakterien ihre Zellwand aufbauen."),
    kind: "irr",
    why: tx("Permanent binding: irreversible.", "Dauerhafte Bindung: irreversibel."),
    trap: { kind: "comp", title: tx("Permanent, not competing", "Dauerhaft statt Konkurrenz"), say: tx("Penicillin does resemble the enzyme's substrate, but it binds for good. More substrate can't push it out: irreversible.", "Penicillin ähnelt zwar dem Substrat des Enzyms, bindet aber dauerhaft. Mehr Substrat kann es nicht verdrängen: irreversibel.") },
  },
  {
    text: tx("ATP binds to phosphofructokinase at a site outside the active site and lowers its activity. More substrate doesn't cancel the effect.", "ATP bindet an die Phosphofructokinase an einer Stelle außerhalb des aktiven Zentrums und senkt ihre Aktivität. Mehr Substrat hebt die Wirkung nicht auf."),
    kind: "non",
    why: tx("Outside the active site, not cancelled by substrate: allosteric (non-competitive).", "Außerhalb des aktiven Zentrums, nicht durch Substrat aufhebbar: allosterisch (nicht-kompetitiv)."),
    trap: { kind: "comp", title: tx("Not in the active site", "Nicht im aktiven Zentrum"), say: tx("Competitive inhibitors bind in the active site and can be outcompeted. ATP binds elsewhere, and more substrate doesn't help.", "Kompetitive Hemmstoffe binden im aktiven Zentrum und lassen sich verdrängen. ATP bindet woanders, mehr Substrat hilft nicht.") },
  },
  {
    text: tx("Isoleucine, the end product of a five-step pathway, binds reversibly to a regulatory site of the first enzyme, threonine deaminase, and switches it off.", "Isoleucin, das Endprodukt einer fünfstufigen Synthesekette, bindet reversibel an ein Regulationszentrum des ersten Enzyms, der Threonin-Desaminase, und schaltet es ab."),
    kind: "non",
    why: tx("Binds at a regulatory (allosteric) site: allosteric inhibition, here as end-product inhibition.", "Bindet an ein Regulationszentrum (allosterisch): allosterische Hemmung, hier als Endprodukthemmung."),
    trap: { kind: "comp", title: tx("End product ≠ substrate", "Endprodukt ≠ Substrat"), say: tx("Isoleucine doesn't look like threonine and doesn't bind in the active site. It binds at the regulatory site: allosteric.", "Isoleucin ähnelt dem Threonin nicht und bindet nicht im aktiven Zentrum. Es bindet am Regulationszentrum: allosterisch.") },
  },
  {
    text: tx("An inhibitor lowers vmax, but KM stays the same. After dialysis (removing the inhibitor) the enzyme works normally again.", "Ein Hemmstoff senkt vmax, KM bleibt gleich. Nach einer Dialyse (der Hemmstoff wird entfernt) arbeitet das Enzym wieder normal."),
    kind: "non",
    why: tx("vmax down, KM unchanged, reversible: non-competitive.", "vmax sinkt, KM gleich, reversibel: nicht-kompetitiv."),
    trap: { kind: "irr", title: tx("It's reversible", "Es ist reversibel"), say: tx("After dialysis the enzyme works again, so the binding wasn't permanent.", "Nach der Dialyse arbeitet das Enzym wieder, die Bindung war also nicht dauerhaft.") },
  },
  {
    text: tx("An inhibitor raises KM, but at very high substrate concentration the reaction still reaches the same vmax.", "Ein Hemmstoff erhöht KM, aber bei sehr hoher Substratkonzentration erreicht die Reaktion noch dasselbe vmax."),
    kind: "comp",
    why: tx("KM up, vmax unchanged: competitive.", "KM steigt, vmax gleich: kompetitiv."),
    trap: { kind: "non", title: tx("vmax is unchanged", "vmax bleibt gleich"), say: tx("Non-competitive inhibitors lower $v_{max}$. Here $v_{max}$ is still reached: competitive.", "Nicht-kompetitive Hemmstoffe senken $v_{max}$. Hier wird $v_{max}$ noch erreicht: kompetitiv.") },
  },
  {
    text: tx("After an enzyme was treated with an inhibitor and the inhibitor was removed by dialysis, the activity stays low.", "Ein Enzym wird mit einem Hemmstoff behandelt. Auch nachdem der Hemmstoff durch Dialyse entfernt wurde, bleibt die Aktivität gering."),
    kind: "irr",
    why: tx("Stays inhibited after removal: irreversible.", "Bleibt nach dem Entfernen gehemmt: irreversibel."),
    trap: { kind: "non", title: tx("Not reversible", "Nicht reversibel"), say: tx("Non-competitive inhibitors bind reversibly: after dialysis the enzyme would work again. Here it doesn't.", "Nicht-kompetitive Hemmstoffe binden reversibel: Nach der Dialyse würde das Enzym wieder arbeiten. Hier tut es das nicht.") },
  },
];

function caseTask(rng: Rng): Exercise {
  const cs = rng.pick(CASES);
  const order: Kind[] = [cs.kind, ...(["comp", "non", "irr"] as Kind[]).filter((k) => k !== cs.kind)];
  const opts: Opt[] = order.map((k) => (k === cs.kind ? { text: KIND_TEXT[k] } : cs.trap && cs.trap.kind === k ? { text: KIND_TEXT[k], title: cs.trap.title, say: cs.trap.say } : { text: KIND_TEXT[k] }));
  const c = choice(rng, opts);
  return {
    instruction: tx("Classify the inhibition", "Ordne die Hemmung ein"),
    text: cs.text,
    answer: c.answer,
    hint: tx("Where does the inhibitor bind, and can it be undone (by substrate or by removing the inhibitor)?", "Wo bindet der Hemmstoff, und lässt sich die Hemmung aufheben (durch Substrat oder durch Entfernen des Hemmstoffs)?"),
    solution: [{ math: txMap((_, l) => `"${resolveText(KIND_TEXT[cs.kind], l)}"`), note: cs.why }],
    mistakes: c.mistakes,
  };
}

// ---------------------------------------------------------------------------
// Numbers: what happens to vmax and KM?

function changeTask(rng: Rng): Exercise {
  const kind = rng.pick(["irr", "comp", "enzyme", "enzymeKm"] as const);
  const vmax = rng.pick([60, 80, 100, 120, 150, 200]);
  const km = rng.pick([0.5, 1, 2, 4]);
  if (kind === "irr") {
    const p = rng.pick([20, 25, 40, 50, 60, 75]);
    const value = (vmax * (100 - p)) / 100;
    const right: AnswerSpec = { kind: "number", value, unit: RATE };
    const m = mistakes(right);
    m.add({ kind: "number", value: (vmax * p) / 100 }, tx("That's the lost part", "Das ist der verlorene Teil"), tx(`${p} % of the enzymes are out of action. You worked out their share, but the ones **left** set the new $v_{max}$.`, `${p} % der Enzyme fallen aus. Du hast ihren Anteil ausgerechnet, das neue $v_{max}$ bestimmen aber die **übrigen**.`));
    m.add({ kind: "number", value: vmax }, tx("vmax does fall", "vmax sinkt sehr wohl"), tx("Irreversibly inhibited enzymes are gone for good. Fewer working enzymes means a lower $v_{max}$.", "Irreversibel gehemmte Enzyme fallen dauerhaft aus. Weniger arbeitende Enzyme heißt kleineres $v_{max}$."));
    return {
      instruction: tx("Calculate the new vmax", "Berechne das neue vmax"),
      text: txMap((tt, l) =>
        tt(
          `A solution of an enzyme has $v_{max} = ${vmax}$ ${rateT(l)}. Lead ions inactivate ${p} % of the enzyme molecules irreversibly. What is $v_{max}$ now?`,
          `Eine Enzymlösung hat $v_{max} = ${vmax}$ ${rateT(l)}. Blei-Ionen inaktivieren ${p} % der Enzymmoleküle irreversibel. Wie groß ist $v_{max}$ jetzt?`,
        ),
      ),
      answer: right,
      hint: tx("$v_{max}$ is proportional to the number of working enzyme molecules.", "$v_{max}$ ist proportional zur Zahl der arbeitenden Enzymmoleküle."),
      solution: [{ math: txMap((_, l) => `v_{max} = ${vmax} \\cdot ${f2((100 - p) / 100, l)} = ${f2(value, l)}`), note: txMap((tt, l) => tt(`${100 - p} % of the enzymes still work: **${f2(value, l)} ${rateT(l)}**. $K_M$ of the remaining enzymes is unchanged.`, `${100 - p} % der Enzyme arbeiten noch: **${f2(value, l)} ${rateT(l)}**. $K_M$ der übrigen Enzyme bleibt gleich.`)) }],
      mistakes: m.list,
    };
  }
  if (kind === "comp") {
    const f = rng.pick([2, 3, 4]);
    const right: AnswerSpec = { kind: "number", value: vmax, unit: RATE };
    const m = mistakes(right);
    m.add({ kind: "number", value: vmax / f }, tx("vmax stays with competition", "vmax bleibt bei Konkurrenz"), tx(`Competitive inhibition only raises $K_M$. At very high $[S]$ the substrate outcompetes the inhibitor, so $v_{max}$ doesn't shrink by the factor ${f}.`, `Kompetitive Hemmung erhöht nur $K_M$. Bei sehr hohem $[S]$ verdrängt das Substrat den Hemmstoff, $v_{max}$ schrumpft also nicht um den Faktor ${f}.`));
    m.add({ kind: "number", value: vmax / 2 }, tx("Not half", "Nicht die Hälfte"), tx("Half of $v_{max}$ is reached at $K_M$. The question is about the maximum rate.", "Die Hälfte von $v_{max}$ wird bei $K_M$ erreicht. Gefragt ist die Maximalgeschwindigkeit."));
    return {
      instruction: tx("Think it through", "Denk es durch"),
      text: txMap((tt, l) =>
        tt(
          `Without inhibitor an enzyme has $v_{max} = ${vmax}$ ${rateT(l)} and $K_M = ${f2(km, l)}$ ${mmolT(l)}. A competitive inhibitor raises $K_M$ to ${f2(km * f, l)} ${mmolT(l)}. Which maximum rate does the reaction reach with the inhibitor at very high substrate concentration?`,
          `Ohne Hemmstoff hat ein Enzym $v_{max} = ${vmax}$ ${rateT(l)} und $K_M = ${f2(km, l)}$ ${mmolT(l)}. Ein kompetitiver Hemmstoff erhöht $K_M$ auf ${f2(km * f, l)} ${mmolT(l)}. Welche Maximalgeschwindigkeit erreicht die Reaktion mit Hemmstoff bei sehr hoher Substratkonzentration?`,
        ),
      ),
      answer: right,
      hint: tx("Who wins the competition when there is a huge excess of substrate?", "Wer gewinnt die Konkurrenz, wenn riesig viel Substrat da ist?"),
      solution: [{ math: tx('"competitive:" \\; v_{max} "unchanged"', '"kompetitiv:" \\; v_{max} "gleich"'), note: txMap((tt, l) => tt(`At very high $[S]$ the substrate outcompetes the inhibitor: $v_{max}$ stays **${vmax} ${rateT(l)}**. Only $K_M$ has risen.`, `Bei sehr hohem $[S]$ verdrängt das Substrat den Hemmstoff: $v_{max}$ bleibt **${vmax} ${rateT(l)}**. Nur $K_M$ ist gestiegen.`)) }],
      mistakes: m.list,
    };
  }
  const factor = rng.pick([2, 3]);
  if (kind === "enzyme") {
    const right: AnswerSpec = { kind: "number", value: vmax * factor, unit: RATE };
    const m = mistakes(right);
    m.add({ kind: "number", value: vmax }, tx("More enzyme, more vmax", "Mehr Enzym, größeres vmax"), tx(`${factor} times as many enzymes means ${factor} times as many active sites working at the same time: $v_{max}$ grows by the same factor.`, `${factor}-mal so viele Enzyme heißt ${factor}-mal so viele aktive Zentren, die gleichzeitig arbeiten: $v_{max}$ wächst um denselben Faktor.`));
    m.add({ kind: "number", value: vmax / factor }, tx("The other way round", "Andersrum"), tx("More enzyme makes the reaction faster, not slower.", "Mehr Enzym macht die Reaktion schneller, nicht langsamer."));
    return {
      instruction: tx("Calculate the new vmax", "Berechne das neue vmax"),
      text: txMap((tt, l) =>
        tt(
          `An enzyme solution has $v_{max} = ${vmax}$ ${rateT(l)} and $K_M = ${f2(km, l)}$ ${mmolT(l)}. You use ${factor} times the amount of enzyme. What is $v_{max}$ now?`,
          `Eine Enzymlösung hat $v_{max} = ${vmax}$ ${rateT(l)} und $K_M = ${f2(km, l)}$ ${mmolT(l)}. Du setzt die ${factor}-fache Enzymmenge ein. Wie groß ist $v_{max}$ jetzt?`,
        ),
      ),
      answer: right,
      hint: tx("$v_{max}$ is reached when every active site is busy.", "$v_{max}$ wird erreicht, wenn jedes aktive Zentrum beschäftigt ist."),
      solution: [{ math: `v_{max} = ${vmax} \\cdot ${factor} = ${vmax * factor}`, note: tx("$v_{max}$ is proportional to the amount of enzyme. $K_M$ doesn't change: it is a property of each enzyme molecule.", "$v_{max}$ ist proportional zur Enzymmenge. $K_M$ ändert sich nicht: Es ist eine Eigenschaft jedes einzelnen Enzymmoleküls.") }],
      mistakes: m.list,
    };
  }
  const right: AnswerSpec = { kind: "number", value: km, tolerance: 0.01, unit: MMOL };
  const m = mistakes(right);
  m.add({ kind: "number", value: km * factor }, tx("KM doesn't depend on the amount", "KM hängt nicht von der Menge ab"), tx("$K_M$ describes how well one enzyme molecule binds its substrate. More molecules don't change that.", "$K_M$ beschreibt, wie gut ein Enzymmolekül sein Substrat bindet. Mehr Moleküle ändern daran nichts."));
  m.add({ kind: "number", value: km / factor }, tx("KM doesn't depend on the amount", "KM hängt nicht von der Menge ab"), tx("More enzyme raises $v_{max}$, but the affinity, and so $K_M$, stays the same.", "Mehr Enzym erhöht $v_{max}$, aber die Affinität und damit $K_M$ bleibt gleich."));
  return {
    instruction: tx("Think it through", "Denk es durch"),
    text: txMap((tt, l) =>
      tt(
        `An enzyme solution has $v_{max} = ${vmax}$ ${rateT(l)} and $K_M = ${f2(km, l)}$ ${mmolT(l)}. You use ${factor} times the amount of enzyme. What is $K_M$ now?`,
        `Eine Enzymlösung hat $v_{max} = ${vmax}$ ${rateT(l)} und $K_M = ${f2(km, l)}$ ${mmolT(l)}. Du setzt die ${factor}-fache Enzymmenge ein. Wie groß ist $K_M$ jetzt?`,
      ),
    ),
    answer: right,
    hint: tx("Does one enzyme molecule bind its substrate better when there are more of them?", "Bindet ein Enzymmolekül sein Substrat besser, wenn mehr davon da sind?"),
    solution: [{ math: txMap((_, l) => `K_M = ${f2(km, l)} "${mmolT(l)}"`), note: tx("$K_M$ is a property of the enzyme (its affinity), independent of the amount of enzyme. Only $v_{max}$ grows.", "$K_M$ ist eine Eigenschaft des Enzyms (seine Affinität), unabhängig von der Enzymmenge. Nur $v_{max}$ wächst.") }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Affinity

function affinityTask(rng: Rng): Exercise {
  const kms = rng.shuffle([0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]).slice(0, 2);
  const [a, b] = kms;
  const better = a < b ? 0 : 1;
  if (rng.chance(0.4)) {
    const vmax = rng.pick([60, 80, 100]);
    const kmA = rng.pick([0.5, 1]);
    const kmB = kmA * rng.pick([4, 6]);
    const first = rng.chance(0.5);
    const curves = first ? [{ vmax, km: kmA, label: "1" }, { vmax, km: kmB, label: "2" }] : [{ vmax, km: kmB, label: "1" }, { vmax, km: kmA, label: "2" }];
    const right = first ? 0 : 1;
    const options = [tx("enzyme 1", "Enzym 1"), tx("enzyme 2", "Enzym 2"), tx("both the same", "beide gleich")];
    return {
      instruction: tx("Compare the affinity", "Vergleiche die Affinität"),
      text: tx("Both enzymes convert the same substrate and have the same $v_{max}$. Which one has the higher affinity for the substrate?", "Beide Enzyme setzen dasselbe Substrat um und haben dasselbe $v_{max}$. Welches hat die höhere Affinität zum Substrat?"),
      visual: visual(EnzymeMMGraph, { curves, xMax: 20, xStep: 2, yMax: vmax + 20, yStep: 20, asymptote: vmax }),
      answer: { kind: "choice", options, correct: right },
      hint: tx("Which one reaches half of $v_{max}$ at a lower substrate concentration?", "Welches erreicht die Hälfte von $v_{max}$ schon bei geringerer Substratkonzentration?"),
      solution: [{ math: tx(`"enzyme ${right + 1}:" "smaller" K_M`, `"Enzym ${right + 1}:" "kleineres" K_M`), note: tx("The steeper curve reaches half of $v_{max}$ at a smaller $[S]$: smaller $K_M$, higher affinity.", "Die steilere Kurve erreicht die Hälfte von $v_{max}$ schon bei kleinerem $[S]$: kleineres $K_M$, höhere Affinität.") }],
      mistakes: [
        { when: { kind: "choice", options, correct: 1 - right }, title: KM_TRAP, say: tx("Careful, classic trap! This curve needs **more** substrate for half of $v_{max}$: larger $K_M$, so **lower** affinity.", "Vorsicht, klassische Falle! Diese Kurve braucht **mehr** Substrat für die Hälfte von $v_{max}$: größeres $K_M$, also **geringere** Affinität.") },
        { when: { kind: "choice", options, correct: 2 }, title: tx("Same vmax, different KM", "Gleiches vmax, anderes KM"), say: tx("The same $v_{max}$ doesn't mean the same affinity. Compare the substrate concentration at half of $v_{max}$.", "Gleiches $v_{max}$ heißt nicht gleiche Affinität. Vergleich die Substratkonzentration bei der Hälfte von $v_{max}$.") },
      ],
    };
  }
  const options = [tx("enzyme A", "Enzym A"), tx("enzyme B", "Enzym B"), tx("both the same", "beide gleich"), tx("can't be said without vmax", "ohne vmax nicht entscheidbar")];
  return {
    instruction: tx("Compare the affinity", "Vergleiche die Affinität"),
    text: txMap((tt, l) =>
      tt(
        `Two enzymes convert the same substrate. Enzyme A has $K_M = ${f2(a, l)}$ ${mmolT(l)}, enzyme B has $K_M = ${f2(b, l)}$ ${mmolT(l)}. Which one has the higher affinity for the substrate?`,
        `Zwei Enzyme setzen dasselbe Substrat um. Enzym A hat $K_M = ${f2(a, l)}$ ${mmolT(l)}, Enzym B hat $K_M = ${f2(b, l)}$ ${mmolT(l)}. Welches hat die höhere Affinität zum Substrat?`,
      ),
    ),
    answer: { kind: "choice", options, correct: better },
    hint: tx("$K_M$ is the substrate concentration needed for half the maximum rate.", "$K_M$ ist die Substratkonzentration, die für die halbe Maximalgeschwindigkeit nötig ist."),
    solution: [{ math: txMap((tt, l) => `K_M "(${tt("enzyme", "Enzym")} ${better ? "B" : "A"})" = ${f2(Math.min(a, b), l)} < ${f2(Math.max(a, b), l)}`), note: tx("The enzyme with the **smaller** $K_M$ already reaches half its maximum rate at a low substrate concentration: it binds its substrate more tightly, higher affinity.", "Das Enzym mit dem **kleineren** $K_M$ erreicht schon bei wenig Substrat die halbe Maximalgeschwindigkeit: Es bindet sein Substrat fester, höhere Affinität.") }],
    mistakes: [
      { when: { kind: "choice", options, correct: 1 - better }, title: KM_TRAP, say: tx("Classic trap! A **larger** $K_M$ means you need more substrate for half of $v_{max}$: that's **lower** affinity.", "Die klassische Falle! Ein **größeres** $K_M$ heißt, man braucht mehr Substrat für die Hälfte von $v_{max}$: Das ist eine **geringere** Affinität.") },
      { when: { kind: "choice", options, correct: 3 }, title: tx("KM is enough", "KM reicht aus"), say: tx("Affinity is read from $K_M$ alone. $v_{max}$ depends on the amount of enzyme and says nothing about how tightly the substrate binds.", "Die Affinität liest man allein an $K_M$ ab. $v_{max}$ hängt von der Enzymmenge ab und sagt nichts darüber, wie fest das Substrat bindet.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// End-product inhibition

function feedbackTask(rng: Rng): Exercise {
  const steps = rng.int(3, 5);
  const end = "ABCDEF"[steps];
  const kind = rng.pick(["which", "use", "why", "type"] as const);
  const pic = visual(EnzymePathway, { steps, feedback: kind !== "which" });
  const intro = tx(`In this metabolic pathway A is turned into the end product ${end} in ${steps} steps.`, `In dieser Stoffwechselkette wird A in ${steps} Schritten zum Endprodukt ${end} umgesetzt.`);
  const join = (q: Text) => txMap((_, l) => `${resolveText(intro, l)} ${resolveText(q, l)}`);
  if (kind === "which") {
    const options = rng.shuffle(Array.from({ length: steps }, (_, i) => `E${i + 1}`));
    const at = (e: number) => options.indexOf(`E${e}`);
    const ms: Mistake[] = [
      { when: { kind: "choice", options, correct: at(steps) }, title: tx("At the start, not the end", "Am Anfang, nicht am Ende"), say: tx(`E${steps} sits right before ${end}, but blocking it would leave all the intermediates piling up. The end product inhibits the **first** enzyme of the pathway.`, `E${steps} liegt direkt vor ${end}, aber dann würden sich alle Zwischenprodukte anstauen. Das Endprodukt hemmt das **erste** Enzym der Kette.`) },
    ];
    if (steps >= 4) ms.push({ when: { kind: "choice", options, correct: at(2) }, title: tx("At the very start", "Ganz am Anfang"), say: tx("Inhibition works best at the very first step: then no intermediates are made in vain.", "Am wirksamsten ist die Hemmung beim allerersten Schritt: Dann entstehen keine Zwischenprodukte umsonst.") });
    return {
      instruction: tx("Find the inhibited enzyme", "Finde das gehemmte Enzym"),
      text: join(tx(`The pathway is regulated by end-product inhibition. Which enzyme does ${end} usually inhibit?`, `Die Kette wird durch Endprodukthemmung reguliert. Welches Enzym hemmt ${end} in der Regel?`)),
      visual: pic,
      answer: { kind: "choice", options, correct: at(1) },
      hint: tx("Where would you put the brake so that nothing is made in vain?", "Wo würdest du bremsen, damit nichts umsonst hergestellt wird?"),
      solution: [{ math: tx(`${end} \\to "E1 (first enzyme)"`, `${end} \\to "E1 (erstes Enzym)"`), note: tx("The end product inhibits the **first** enzyme of the pathway allosterically. So no intermediates pile up, and material and energy are saved.", "Das Endprodukt hemmt das **erste** Enzym der Kette allosterisch. So stauen sich keine Zwischenprodukte an, und Stoff und Energie werden gespart.") }],
      mistakes: ms,
    };
  }
  if (kind === "use") {
    const c = choice(rng, [
      { text: tx("E1 is inhibited less and the pathway runs faster.", "E1 wird weniger gehemmt, und die Kette läuft schneller.") },
      { text: tx("E1 is inhibited more and the pathway slows down.", "E1 wird stärker gehemmt, und die Kette wird langsamer."), title: tx("Less end product, less brake", "Weniger Endprodukt, weniger Bremse"), say: tx(`If the cell uses up a lot of ${end}, less ${end} is left to bind to E1. The brake loosens.`, `Verbraucht die Zelle viel ${end}, bleibt weniger ${end} übrig, das an E1 binden kann. Die Bremse löst sich.`) },
      { text: tx("The enzymes are used up faster.", "Die Enzyme werden schneller verbraucht."), title: USED_UP_T, say: tx("Enzymes aren't used up. What changes is how strongly E1 is inhibited.", "Enzyme werden nicht verbraucht. Was sich ändert, ist, wie stark E1 gehemmt wird.") },
      { text: tx("Nothing changes.", "Es ändert sich nichts.") },
    ]);
    return {
      instruction: PICK,
      text: join(tx(`${end} inhibits E1 (dashed arrow). Suddenly the cell uses a lot of ${end}. What happens?`, `${end} hemmt E1 (gestrichelter Pfeil). Plötzlich verbraucht die Zelle viel ${end}. Was passiert?`)),
      visual: pic,
      answer: c.answer,
      hint: tx(`How much ${end} is left to bind to E1?`, `Wie viel ${end} bleibt übrig, um an E1 zu binden?`),
      solution: [{ math: tx(`${end} "↓" \\Rightarrow "inhibition of E1 ↓" \\Rightarrow "production ↑"`, `${end} "↓" \\Rightarrow "Hemmung von E1 ↓" \\Rightarrow "Produktion ↑"`), note: tx("Negative feedback: less end product, less inhibition, more production. The pathway adapts to what the cell needs.", "Negative Rückkopplung: weniger Endprodukt, weniger Hemmung, mehr Produktion. Die Kette passt sich dem Bedarf der Zelle an.") }],
      mistakes: c.mistakes,
    };
  }
  if (kind === "why") {
    const c = choice(rng, [
      { text: tx("So no intermediates are made in vain: material and energy are saved.", "Damit keine Zwischenprodukte umsonst entstehen: Stoff und Energie werden gespart.") },
      { text: tx("Because only the first enzyme has an active site.", "Weil nur das erste Enzym ein aktives Zentrum hat."), title: tx("Every enzyme has one", "Jedes Enzym hat eins"), say: tx("Every enzyme has an active site. The first one is chosen because blocking it stops the whole pathway right at the start.", "Jedes Enzym hat ein aktives Zentrum. Das erste wird gewählt, weil seine Hemmung die ganze Kette gleich am Anfang stoppt.") },
      { text: tx(`Because ${end} looks like A, the substrate of E1.`, `Weil ${end} dem Substrat A von E1 ähnelt.`), title: tx("Not competitive", "Nicht kompetitiv"), say: tx("The end product usually looks nothing like the first substrate. It binds at the allosteric site, not in the active site.", "Das Endprodukt ähnelt dem ersten Substrat meist gar nicht. Es bindet am allosterischen Zentrum, nicht im aktiven Zentrum.") },
      { text: tx("Because the first enzyme is the fastest.", "Weil das erste Enzym das schnellste ist.") },
    ]);
    return {
      instruction: PICK,
      text: join(tx(`Why does ${end} inhibit the first enzyme, and not the last one?`, `Warum hemmt ${end} das erste Enzym und nicht das letzte?`)),
      visual: pic,
      answer: c.answer,
      hint: tx("What would happen to B, C, … if only the last enzyme were blocked?", "Was würde mit B, C, … passieren, wenn nur das letzte Enzym blockiert wäre?"),
      solution: [{ math: tx('"brake at the start" \\Rightarrow "no waste"', '"Bremse am Anfang" \\Rightarrow "keine Verschwendung"'), note: tx("If the last enzyme were blocked, the intermediates would still be made and pile up. Blocking the first step saves material and energy.", "Wäre das letzte Enzym blockiert, entstünden die Zwischenprodukte trotzdem und würden sich anstauen. Die Hemmung des ersten Schritts spart Stoff und Energie.") }],
      mistakes: c.mistakes,
    };
  }
  const c = choice(rng, [
    { text: tx("allosteric inhibition (negative feedback)", "allosterische Hemmung (negative Rückkopplung)") },
    { text: COMP, title: tx("End product ≠ substrate", "Endprodukt ≠ Substrat"), say: tx(`${end} usually doesn't look like A and doesn't bind in the active site of E1. It binds at the allosteric site.`, `${end} ähnelt A meist nicht und bindet nicht im aktiven Zentrum von E1. Es bindet am allosterischen Zentrum.`) },
    { text: IRREV, title: tx("It's reversible", "Sie ist reversibel"), say: tx(`The inhibition has to stop again when ${end} is used up. So the binding must be reversible.`, `Die Hemmung muss wieder aufhören, wenn ${end} verbraucht ist. Die Bindung muss also reversibel sein.`) },
  ]);
  return {
    instruction: PICK,
    text: join(tx(`${end} inhibits E1 (dashed arrow) and the inhibition stops again when ${end} is used up. What kind of inhibition is this usually?`, `${end} hemmt E1 (gestrichelter Pfeil), und die Hemmung hört wieder auf, wenn ${end} verbraucht ist. Um welche Art der Hemmung handelt es sich meist?`)),
    visual: pic,
    answer: c.answer,
    hint: tx("Where does the end product bind, and is the binding permanent?", "Wo bindet das Endprodukt, und ist die Bindung dauerhaft?"),
    solution: [{ math: tx('"end product" \\to "allosteric site of E1"', '"Endprodukt" \\to "allosterisches Zentrum von E1"'), note: tx("The end product binds reversibly at the allosteric site of the first enzyme and changes its shape: allosteric inhibition, a negative feedback.", "Das Endprodukt bindet reversibel am allosterischen Zentrum des ersten Enzyms und verändert dessen Form: allosterische Hemmung, eine negative Rückkopplung.") }],
    mistakes: c.mistakes,
  };
}
const USED_UP_T: Text = tx("Not used up", "Wird nicht verbraucht");

// ---------------------------------------------------------------------------
// Cofactors (match)

const CF = {
  nad: { l: "$\\ce{NAD+}$", r: tx("carries hydrogen (electrons)", "überträgt Wasserstoff (Elektronen)") },
  atp: { l: "ATP", r: tx("transfers phosphate groups (energy)", "überträgt Phosphatgruppen (Energie)") },
  coa: { l: tx("coenzyme A", "Coenzym A"), r: tx("carries acetyl groups", "überträgt Acetylgruppen") },
  mg: { l: "$\\ce{Mg^2+}$", r: tx("metal ion as a cofactor", "Metallion als Cofaktor") },
  apo: { l: tx("apoenzyme", "Apoenzym"), r: tx("protein part of an enzyme without its cofactor", "Proteinteil eines Enzyms ohne Cofaktor") },
  holo: { l: tx("holoenzyme", "Holoenzym"), r: tx("active enzyme: apoenzyme plus cofactor", "aktives Enzym: Apoenzym plus Cofaktor") },
  pros: { l: tx("prosthetic group", "prosthetische Gruppe"), r: tx("cofactor bound tightly, e.g. FAD or haem", "fest gebundener Cofaktor, z. B. FAD oder Häm") },
  vit: { l: tx("vitamins", "Vitamine"), r: tx("raw material for many coenzymes", "Ausgangsstoffe vieler Coenzyme") },
};
type CFKey = keyof typeof CF;
const CF_WRONG: { l: CFKey; r: CFKey; title: Text; say: Text }[] = [
  { l: "nad", r: "atp", title: tx("NAD⁺ carries hydrogen", "NAD⁺ trägt Wasserstoff"), say: tx("$\\ce{NAD+}$ takes up hydrogen and becomes NADH. Phosphate groups are ATP's job.", "$\\ce{NAD+}$ nimmt Wasserstoff auf und wird zu NADH. Phosphatgruppen sind der Job von ATP.") },
  { l: "atp", r: "nad", title: tx("ATP carries phosphate", "ATP trägt Phosphat"), say: tx("ATP gives off a phosphate group (ATP → ADP + P). Hydrogen is carried by $\\ce{NAD+}$.", "ATP gibt eine Phosphatgruppe ab (ATP → ADP + P). Wasserstoff überträgt $\\ce{NAD+}$.") },
  { l: "apo", r: "holo", title: tx("Apo is only the protein", "Apo ist nur das Protein"), say: tx("The apoenzyme is the protein part on its own. Only with the cofactor does it become the active holoenzyme.", "Das Apoenzym ist der Proteinteil allein. Erst mit dem Cofaktor wird es zum aktiven Holoenzym.") },
  { l: "holo", r: "apo", title: tx("Holo is complete", "Holo ist komplett"), say: tx("Holo means whole: the holoenzyme is the complete, active enzyme with its cofactor.", "Holo heißt ganz: Das Holoenzym ist das vollständige, aktive Enzym mit Cofaktor.") },
];

function cofactorTask(rng: Rng): Exercise {
  const keys = rng.shuffle(Object.keys(CF) as CFKey[]).slice(0, 4);
  const rest = (Object.keys(CF) as CFKey[]).filter((k) => !keys.includes(k));
  const extra = rng.pick(rest);
  const pairs: [Text, Text][] = keys.map((k) => [CF[k].l, CF[k].r]);
  const rights = [...keys, extra];
  const ms: Mistake[] = CF_WRONG.filter((w) => keys.includes(w.l) && rights.includes(w.r)).map((w) => ({ when: { kind: "match", pairs: [[CF[w.l].l, CF[w.r].r]] }, title: w.title, say: w.say }));
  return {
    instruction: tx("Match the pairs", "Ordne zu"),
    text: tx("Match each term with its role.", "Ordne jedem Begriff seine Rolle zu."),
    answer: { kind: "match", pairs, distractors: [CF[extra].r] },
    hint: tx("Apo = only the protein, holo = whole. NAD⁺ carries hydrogen, ATP phosphate.", "Apo = nur das Protein, Holo = ganz. NAD⁺ trägt Wasserstoff, ATP Phosphat."),
    solution: [
      { math: tx('"apoenzyme" + "cofactor" \\to "holoenzyme"', '"Apoenzym" + "Cofaktor" \\to "Holoenzym"'), note: txMap((_, l) => pairs.map(([a, b]) => `**${resolveText(a, l)}**: ${resolveText(b, l)}.`).join(" ")) },
    ],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Enzyme names

type Name = { name: Text; accept: Text[]; does: Text; wrong?: { word: Text; title: Text; say: Text }[] };
const NAMES: Name[] = [
  {
    name: tx("pyruvate decarboxylase", "Pyruvat-Decarboxylase"),
    accept: [tx("pyruvate decarboxylase", "Pyruvat-Decarboxylase")],
    does: tx("splits CO₂ off pyruvate in alcoholic fermentation, without transferring hydrogen", "spaltet bei der alkoholischen Gärung CO₂ vom Pyruvat ab, ohne Wasserstoff zu übertragen"),
    wrong: [{ word: tx("pyruvate dehydrogenase", "Pyruvat-Dehydrogenase"), title: tx("No hydrogen here", "Hier kein Wasserstoff"), say: tx("Dehydrogenases remove hydrogen. Splitting off CO₂ is a decarboxylation.", "Dehydrogenasen entziehen Wasserstoff. CO₂ abspalten ist eine Decarboxylierung.") }],
  },
  {
    name: tx("lactate dehydrogenase", "Lactat-Dehydrogenase"),
    accept: [tx("lactate dehydrogenase", "Lactat-Dehydrogenase"), "Laktat-Dehydrogenase", "LDH"],
    does: tx("removes hydrogen from lactate (and passes it on to NAD⁺)", "entzieht dem Lactat Wasserstoff (und gibt ihn an NAD⁺ weiter)"),
    wrong: [{ word: tx("lactase", "Laktase"), title: tx("Lactose, not lactate", "Lactose, nicht Lactat"), say: tx("Lactase splits milk sugar (lactose). Here the substrate is lactate and the reaction removes hydrogen.", "Laktase spaltet Milchzucker (Lactose). Hier ist das Substrat Lactat, und die Reaktion entzieht Wasserstoff.") }],
  },
  { name: tx("maltase", "Maltase"), accept: [tx("maltase", "Maltase")], does: tx("splits maltose into two glucose molecules", "spaltet Maltose in zwei Glucosemoleküle") },
  { name: tx("urease", "Urease"), accept: [tx("urease", "Urease")], does: tx("splits urea (Latin urea)", "spaltet Harnstoff (lateinisch urea)") },
  {
    name: tx("glucose 6-phosphatase", "Glucose-6-Phosphatase"),
    accept: [tx("glucose 6-phosphatase", "Glucose-6-Phosphatase"), tx("glucose-6-phosphatase", "Glucose-6-phosphatase")],
    does: tx("splits the phosphate group off glucose 6-phosphate", "spaltet die Phosphatgruppe vom Glucose-6-phosphat ab"),
  },
  {
    name: tx("succinate dehydrogenase", "Succinat-Dehydrogenase"),
    accept: [tx("succinate dehydrogenase", "Succinat-Dehydrogenase")],
    does: tx("removes hydrogen from succinate", "entzieht dem Succinat Wasserstoff"),
    wrong: [{ word: tx("succinate decarboxylase", "Succinat-Decarboxylase"), title: tx("Hydrogen, not CO₂", "Wasserstoff, nicht CO₂"), say: tx("Removing hydrogen is a dehydrogenation, not a decarboxylation.", "Wasserstoff entziehen ist eine Dehydrierung, keine Decarboxylierung.") }],
  },
  { name: tx("DNA polymerase", "DNA-Polymerase"), accept: [tx("DNA polymerase", "DNA-Polymerase")], does: tx("links nucleotides together into a DNA strand", "verknüpft Nucleotide zu einem DNA-Strang") },
  { name: tx("DNA ligase", "DNA-Ligase"), accept: [tx("DNA ligase", "DNA-Ligase")], does: tx("joins two pieces of DNA", "verbindet zwei DNA-Stücke miteinander") },
];

function namingTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const q = rng.pick(NAMES);
    const right: AnswerSpec = { kind: "word", accept: q.accept };
    const m = mistakes(right);
    for (const w of q.wrong ?? []) m.add({ kind: "word", accept: [w.word] }, w.title, w.say);
    return {
      instruction: tx("Name the enzyme", "Benenne das Enzym"),
      text: txMap((tt, l) => tt(`An enzyme ${resolveText(q.does, l)}. What is it called?`, `Ein Enzym ${resolveText(q.does, l)}. Wie heißt es?`)),
      answer: right,
      hint: tx("Substrate + kind of reaction + -ase.", "Substrat + Reaktionsart + -ase."),
      solution: [{ math: txMap((_, l) => `"${resolveText(q.name, l)}"`), note: tx("Enzyme names are built from the substrate, the kind of reaction and the ending -ase.", "Enzymnamen setzen sich aus dem Substrat, der Reaktionsart und der Endung -ase zusammen.") }],
      mistakes: m.list,
    };
  }
  const chosen = rng.shuffle(NAMES).slice(0, 4);
  const pairs: [Text, Text][] = chosen.map((q) => [q.name, q.does]);
  const ms: Mistake[] = [];
  const ldh = chosen.find((q) => resolveText(q.name, "en") === "lactate dehydrogenase");
  const pdc = chosen.find((q) => resolveText(q.name, "en") === "pyruvate decarboxylase");
  if (ldh && pdc) ms.push({ when: { kind: "match", pairs: [[ldh.name, pdc.does]] }, title: tx("Dehydrogenase removes hydrogen", "Dehydrogenase entzieht Wasserstoff"), say: tx("De-hydrogen-ase: takes hydrogen away. Splitting off CO₂ is the job of a de-carboxyl-ase.", "De-hydrogen-ase: nimmt Wasserstoff weg. CO₂ abspalten ist der Job einer De-carboxyl-ase.") });
  const pol = chosen.find((q) => resolveText(q.name, "en") === "DNA polymerase");
  const lig = chosen.find((q) => resolveText(q.name, "en") === "DNA ligase");
  if (pol && lig) ms.push({ when: { kind: "match", pairs: [[pol.name, lig.does]] }, title: tx("Polymerase builds chains", "Polymerase baut Ketten"), say: tx("A polymerase builds a polymer from single nucleotides. Joining finished pieces is a ligase (ligare = to bind).", "Eine Polymerase baut aus einzelnen Nucleotiden ein Polymer. Fertige Stücke verbinden ist eine Ligase (ligare = verbinden).") });
  return {
    instruction: tx("Match the pairs", "Ordne zu"),
    text: tx("Match each enzyme with the reaction it catalyses.", "Ordne jedem Enzym die Reaktion zu, die es katalysiert."),
    answer: { kind: "match", pairs },
    hint: tx("Read the names: substrate first, then the kind of reaction.", "Lies die Namen: zuerst das Substrat, dann die Reaktionsart."),
    solution: [{ math: tx('"substrate" + "reaction" + "-ase"', '"Substrat" + "Reaktion" + "-ase"'), note: txMap((_, l) => chosen.map((q) => `**${resolveText(q.name, l)}** ${resolveText(q.does, l)}.`).join(" ")) }],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// Order: induced fit, feedback

const FIT = [
  tx("The substrate approaches the active site.", "Das Substrat nähert sich dem aktiven Zentrum."),
  tx("The substrate binds loosely.", "Das Substrat bindet locker."),
  tx("The enzyme changes shape and closes around the substrate.", "Das Enzym ändert seine Form und umschließt das Substrat."),
  tx("The transition state is stabilised and the substrate reacts.", "Der Übergangszustand wird stabilisiert, das Substrat reagiert."),
  tx("The products leave and the enzyme returns to its starting shape.", "Die Produkte lösen sich, das Enzym nimmt seine Ausgangsform an."),
];
const LOOP = [
  tx("The end product builds up in the cell.", "Das Endprodukt reichert sich in der Zelle an."),
  tx("It binds at the allosteric site of the first enzyme.", "Es bindet am allosterischen Zentrum des ersten Enzyms."),
  tx("The active site of the first enzyme is deformed.", "Das aktive Zentrum des ersten Enzyms verformt sich."),
  tx("Less end product is made.", "Es wird weniger Endprodukt gebildet."),
  tx("As the end product is used up, the inhibition eases.", "Wird das Endprodukt verbraucht, lässt die Hemmung nach."),
];

function orderTask(rng: Rng): Exercise {
  const fit = rng.chance(0.5);
  const all = fit ? FIT : LOOP;
  const drop = rng.int(0, 2);
  const items = drop === 1 ? all.slice(1) : drop === 2 ? all.slice(0, -1) : all;
  const wrong = fit
    ? [{ items: [FIT[2], FIT[1]], title: tx("Binding comes first", "Erst die Bindung"), say: tx("That's the core of induced fit: the change of shape is **induced** by binding. So the substrate binds first.", "Das ist der Kern von Induced Fit: Die Formänderung wird durch die Bindung **ausgelöst**. Also bindet das Substrat zuerst.") }]
    : [
        { items: [LOOP[2], LOOP[1]], title: tx("Bind first, then deform", "Erst binden, dann verformen"), say: tx("The active site is deformed **because** the end product binds at the allosteric site. Binding comes first.", "Das aktive Zentrum verformt sich, **weil** das Endprodukt am allosterischen Zentrum bindet. Die Bindung kommt zuerst.") },
        { items: [LOOP[3], LOOP[2]], title: tx("Cause before effect", "Ursache vor Wirkung"), say: tx("Less end product is made because the first enzyme has been switched off. That comes first.", "Es entsteht weniger Endprodukt, weil das erste Enzym abgeschaltet wurde. Das kommt zuerst.") },
      ];
  const ms: Mistake[] = wrong.filter((w) => w.items.every((it) => items.some((x) => sameItem(x, it)))).map((w) => ({ when: { kind: "order", items: w.items }, title: w.title, say: w.say }));
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: fit ? tx("Put the steps of catalysis according to the induced fit model in order.", "Bring die Schritte der Katalyse nach dem Induced-Fit-Modell in die richtige Reihenfolge.") : tx("Put the steps of end-product inhibition in order.", "Bring die Schritte der Endprodukthemmung in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: fit ? tx("In induced fit the substrate itself triggers the change of shape.", "Beim Induced Fit löst das Substrat selbst die Formänderung aus.") : tx("Think of it as a loop: too much end product, then less production, then less end product.", "Denk an einen Regelkreis: zu viel Endprodukt, dann weniger Produktion, dann weniger Endprodukt."),
    solution: fit
      ? [{ math: tx('"bind" \\to "change shape" \\to "react" \\to "release"', '"binden" \\to "Form ändern" \\to "reagieren" \\to "lösen"'), note: tx("The substrate binds, the enzyme changes shape around it (induced fit), the transition state is stabilised, then the products leave.", "Das Substrat bindet, das Enzym ändert seine Form darum herum (Induced Fit), der Übergangszustand wird stabilisiert, dann lösen sich die Produkte.") }]
      : [{ math: tx('"end product" "↑" \\to "E1 inhibited" \\to "end product" "↓" \\to "inhibition" "↓"', '"Endprodukt" "↑" \\to "E1 gehemmt" \\to "Endprodukt" "↓" \\to "Hemmung" "↓"'), note: tx("A negative feedback loop: the end product switches off its own production and releases the brake when it is used up.", "Eine negative Rückkopplung: Das Endprodukt schaltet seine eigene Herstellung ab und löst die Bremse, wenn es verbraucht wird.") }],
    mistakes: ms,
  };
}

// ---------------------------------------------------------------------------
// The drawing: which inhibition?

function drawingTask(rng: Rng): Exercise {
  const kind = rng.pick(["competitive", "allosteric"] as const);
  if (rng.chance(0.5)) {
    const c = choice(rng, [
      { text: kind === "competitive" ? COMP : NONCOMP },
      kind === "competitive"
        ? { text: NONCOMP, title: tx("Where does it sit?", "Wo sitzt er?"), say: tx("The inhibitor sits right in the active site and looks like the substrate: that's competitive.", "Der Hemmstoff sitzt direkt im aktiven Zentrum und ähnelt dem Substrat: Das ist kompetitiv.") }
        : { text: COMP, title: tx("Where does it sit?", "Wo sitzt er?"), say: tx("The inhibitor sits at a second site, not in the active site. The active site is deformed: non-competitive (allosteric).", "Der Hemmstoff sitzt an einer zweiten Stelle, nicht im aktiven Zentrum. Das aktive Zentrum ist verformt: nicht-kompetitiv (allosterisch).") },
      { text: IRREV },
    ]);
    return {
      instruction: tx("Interpret the model", "Deute das Modell"),
      text: tx("Which kind of inhibition does the model drawing show?", "Welche Art der Hemmung zeigt die Modellzeichnung?"),
      visual: visual(EnzymeInhibition, { kind, mode: "plain" }),
      answer: c.answer,
      hint: tx("Look where the inhibitor binds and whether the active site still has its shape.", "Schau, wo der Hemmstoff bindet und ob das aktive Zentrum noch seine Form hat."),
      solution: [
        kind === "competitive"
          ? { math: tx('"inhibitor in the active site"', '"Hemmstoff im aktiven Zentrum"'), note: tx("The inhibitor resembles the substrate and occupies the active site: competitive inhibition. The substrate has to wait.", "Der Hemmstoff ähnelt dem Substrat und besetzt das aktive Zentrum: kompetitive Hemmung. Das Substrat muss warten.") }
          : { math: tx('"inhibitor at the allosteric site"', '"Hemmstoff am allosterischen Zentrum"'), note: tx("The inhibitor binds at the allosteric site and deforms the active site: the substrate doesn't fit any more. Non-competitive (allosteric) inhibition.", "Der Hemmstoff bindet am allosterischen Zentrum und verformt das aktive Zentrum: Das Substrat passt nicht mehr. Nicht-kompetitive (allosterische) Hemmung.") },
      ],
      mistakes: c.mistakes,
    };
  }
  const ask = kind === "allosteric" ? rng.pick(["allosteric", "inhibitor", "active"]) : rng.pick(["inhibitor", "substrate"]);
  const names: Record<string, Text> = { active: tx("active site", "aktives Zentrum"), allosteric: tx("allosteric site", "allosterisches Zentrum"), inhibitor: tx("inhibitor", "Hemmstoff"), substrate: tx("substrate", "Substrat") };
  const confuse: Record<string, Record<string, { title: Text; say: Text }>> = {
    allosteric: { active: { title: tx("The other site", "Die andere Stelle"), say: tx("The active site is the pocket at the top where the substrate should bind. The marked site is the second, regulatory one.", "Das aktive Zentrum ist die Tasche oben, in die das Substrat soll. Die markierte Stelle ist die zweite, regulierende.") } },
    active: { allosteric: { title: tx("The other site", "Die andere Stelle"), say: tx("The allosteric site is at the bottom, where the inhibitor sits. The marked pocket is where the substrate should bind.", "Das allosterische Zentrum ist unten, wo der Hemmstoff sitzt. Die markierte Tasche ist die, in die das Substrat soll.") } },
    inhibitor: { substrate: { title: tx("Look at the shape", "Schau auf die Form"), say: tx("The substrate is the yellow molecule that can't get in. The marked molecule is blocking the enzyme.", "Das Substrat ist das gelbe Molekül, das nicht hineinkommt. Das markierte Molekül blockiert das Enzym.") } },
    substrate: { inhibitor: { title: tx("Look at the shape", "Schau auf die Form"), say: tx("The inhibitor is the one sitting in the active site. The marked molecule is waiting outside: the substrate.", "Der Hemmstoff sitzt im aktiven Zentrum. Das markierte Molekül wartet draußen: das Substrat.") } },
  };
  const others = Object.keys(names).filter((k) => k !== ask);
  const c = choice(rng, [{ text: names[ask] }, ...others.map((k) => ({ text: names[k], ...(confuse[ask]?.[k] ?? {}) }))]);
  return {
    instruction: tx("Name the part", "Benenne das Teil"),
    text: tx("What is marked with ? in the model drawing?", "Was ist in der Modellzeichnung mit ? markiert?"),
    visual: visual(EnzymeInhibition, { kind, mode: "numbers", ask, show: [ask], legend: "none" }),
    answer: c.answer,
    hint: tx("Substrate in yellow, inhibitor in colour, the enzyme in blue.", "Substrat in Gelb, Hemmstoff farbig, das Enzym in Blau."),
    solution: [{ math: txMap((_, l) => `"${resolveText(names[ask], l)}"`), note: kind === "allosteric" ? tx("An allosteric inhibitor binds at the allosteric site and deforms the active site.", "Ein allosterischer Hemmstoff bindet am allosterischen Zentrum und verformt das aktive Zentrum.") : tx("A competitive inhibitor occupies the active site; the substrate has to wait.", "Ein kompetitiver Hemmstoff besetzt das aktive Zentrum, das Substrat muss warten.") }],
    mistakes: c.mistakes,
  };
}

export function generate3(rng: Rng): Exercise {
  return weighted(rng, [
    [1.3, () => mmCalcTask(rng)],
    [1.2, () => readGraphTask(rng)],
    [1.1, () => tableTask(rng)],
    [1.2, () => inhibitionGraphTask(rng)],
    [1.0, () => statementsTask(rng)],
    [1.3, () => caseTask(rng)],
    [1.1, () => changeTask(rng)],
    [1.0, () => affinityTask(rng)],
    [1.1, () => feedbackTask(rng)],
    [0.9, () => cofactorTask(rng)],
    [0.9, () => namingTask(rng)],
    [0.8, () => orderTask(rng)],
    [0.8, () => drawingTask(rng)],
  ]);
}

// ---------------------------------------------------------------------------
// Lesson

const kmCheck: Exercise = (() => {
  const right: AnswerSpec = { kind: "number", value: 3, tolerance: 0.1, unit: MMOL };
  const m = mistakes(right);
  m.add({ kind: "number", value: 30 }, tx("That's the rate", "Das ist die Geschwindigkeit"), tx("30 is half of $v_{max}$, good! Now go across to the curve and **down** to the x-axis: $K_M$ is a concentration.", "30 ist die Hälfte von $v_{max}$, gut! Jetzt geh waagerecht zur Kurve und **senkrecht nach unten**: $K_M$ ist eine Konzentration."));
  m.add({ kind: "number", value: 60 }, tx("That's vmax", "Das ist vmax"), tx("60 is $v_{max}$. $K_M$ is the substrate concentration at **half** of it.", "60 ist $v_{max}$. $K_M$ ist die Substratkonzentration bei der **Hälfte** davon."));
  m.add({ kind: "number", value: 20 }, tx("KM isn't at the end", "KM liegt nicht am Ende"), tx("At the end of the axis the enzyme is nearly saturated. $K_M$ belongs to half the maximum rate.", "Am Ende der Achse ist das Enzym fast gesättigt. $K_M$ gehört zur halben Maximalgeschwindigkeit."));
  return {
    instruction: tx("Read off KM", "Lies KM ab"),
    text: tx("The dashed line marks $v_{max} = 60$ µmol/(L·min). Determine $K_M$.", "Die gestrichelte Linie zeigt $v_{max} = 60$ µmol/(l·min). Bestimme $K_M$."),
    visual: visual(EnzymeMMGraph, { curves: [{ vmax: 60, km: 3 }], xMax: 20, xStep: 2, yMax: 80, yStep: 10, asymptote: 60 }),
    answer: right,
    hint: tx("Halve $v_{max}$, go across to the curve, then straight down.", "Halbiere $v_{max}$, geh waagerecht zur Kurve und dann senkrecht nach unten."),
    solution: [
      { math: "\\frac{1}{2} v_{max} = 30", note: tx("Half of 60 is 30.", "Die Hälfte von 60 ist 30.") },
      { math: tx('v = 30 \\Rightarrow K_M = 3 "mmol/L"', 'v = 30 \\Rightarrow K_M = 3 "mmol/l"'), note: tx("The curve reaches 30 above $[S] = 3$ mmol/L: that's $K_M$.", "Die Kurve erreicht 30 über $[S] = 3$ mmol/l: Das ist $K_M$.") },
    ],
    mistakes: m.list,
  };
})();

const inhibCheck = choice(createRng(9), [
  { text: COMP },
  { text: NONCOMP, title: tx("Look at vmax", "Schau auf vmax"), say: tx("Both curves head for the **same** $v_{max}$. Only $K_M$ has risen: competitive.", "Beide Kurven laufen auf **dasselbe** $v_{max}$ zu. Nur $K_M$ ist gestiegen: kompetitiv.") },
  { text: IRREV, title: tx("vmax is still reached", "vmax wird noch erreicht"), say: tx("With irreversible inhibition some enzymes are lost for good, so $v_{max}$ would fall. Here it doesn't.", "Bei irreversibler Hemmung fallen Enzyme dauerhaft aus, $v_{max}$ würde also sinken. Hier tut es das nicht.") },
]);

const feedbackCheck = (() => {
  const options = ["E1", "E2", "E3", "E4"];
  return {
    instruction: PICK,
    text: tx("In this pathway A becomes the end product E in four steps. E regulates its own production by end-product inhibition. Which enzyme does it inhibit?", "In dieser Kette wird A in vier Schritten zum Endprodukt E. E reguliert seine eigene Herstellung durch Endprodukthemmung. Welches Enzym hemmt es?"),
    visual: visual(EnzymePathway, { steps: 4 }),
    answer: { kind: "choice", options, correct: 0 } as AnswerSpec,
    hint: tx("Where does the brake save the most?", "Wo spart die Bremse am meisten?"),
    solution: [{ math: tx('E \\to "E1 (first enzyme)"', 'E \\to "E1 (erstes Enzym)"'), note: tx("The end product inhibits the **first** enzyme allosterically. Then no intermediates are made in vain.", "Das Endprodukt hemmt das **erste** Enzym allosterisch. Dann entstehen keine Zwischenprodukte umsonst.") }],
    mistakes: [
      { when: { kind: "choice", options, correct: 3 } as AnswerSpec, title: tx("At the start, not the end", "Am Anfang, nicht am Ende"), say: tx("E4 sits right before E, but then B, C and D would pile up. The brake works at the **first** step.", "E4 liegt direkt vor E, aber dann würden sich B, C und D anstauen. Die Bremse sitzt am **ersten** Schritt.") },
      { when: { kind: "choice", options, correct: 1 } as AnswerSpec, title: tx("At the very start", "Ganz am Anfang"), say: tx("Close! The brake works best at the very first step, so not even B is made in vain.", "Fast! Am besten bremst man beim allerersten Schritt, dann entsteht nicht mal B umsonst.") },
    ],
  } satisfies Exercise;
})();

export const level3: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("How fast does an enzyme work?", "Wie schnell arbeitet ein Enzym?"),
      blob: tx("Time for some real enzyme kinetics!", "Zeit für echte Enzymkinetik!"),
      body: tx(
        "If you measure the initial rate $v$ of an enzyme reaction at different substrate concentrations $[S]$, you get a saturation curve. Leonor Michaelis and Maud Menten described it mathematically in 1913.",
        "Misst man die Anfangsgeschwindigkeit $v$ einer Enzymreaktion bei verschiedenen Substratkonzentrationen $[S]$, erhält man eine Sättigungskurve. Leonor Michaelis und Maud Menten haben sie 1913 mathematisch beschrieben.",
      ),
      frames: [
        { math: "v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}", note: tx("The **Michaelis-Menten equation**: $v_{max}$ is the maximum rate, $K_M$ the Michaelis constant.", "Die **Michaelis-Menten-Gleichung**: $v_{max}$ ist die Maximalgeschwindigkeit, $K_M$ die Michaelis-Konstante.") },
        { math: tx('[S] "≫" K_M \\Rightarrow v \\approx v_{max}', '[S] "≫" K_M \\Rightarrow v \\approx v_{max}'), note: tx("With a lot of substrate $K_M$ hardly matters in the denominator: $v$ approaches $v_{max}$. Nearly all enzymes are in the ES complex (saturation).", "Bei sehr viel Substrat fällt $K_M$ im Nenner kaum ins Gewicht: $v$ nähert sich $v_{max}$. Fast alle Enzyme liegen als ES-Komplex vor (Sättigung).") },
        { math: "[S] = K_M \\Rightarrow v = \\frac{v_{max} \\cdot K_M}{K_M + K_M} = \\frac{1}{2} v_{max}", note: tx("Put in $[S] = K_M$ and $v$ is exactly half of $v_{max}$. That's the definition: **$K_M$ is the substrate concentration at half the maximum rate**.", "Setzt man $[S] = K_M$ ein, ist $v$ genau halb so groß wie $v_{max}$. Das ist die Definition: **$K_M$ ist die Substratkonzentration bei halbmaximaler Geschwindigkeit**.") },
        { math: tx('v_{max} \\sim "amount of enzyme" \\quad K_M: "constant"', 'v_{max} \\sim "Enzymmenge" \\quad K_M: "konstant"'), note: tx("$K_M$ is a concentration (e.g. in mmol/L) and a property of the enzyme. $v_{max}$ depends on how much enzyme there is: twice the enzyme, twice $v_{max}$.", "$K_M$ ist eine Konzentration (z. B. in mmol/l) und eine Eigenschaft des Enzyms. $v_{max}$ hängt von der Enzymmenge ab: doppelt so viel Enzym, doppeltes $v_{max}$.") },
      ],
    },
    {
      type: "widget",
      title: tx("The Michaelis-Menten diagram", "Das Michaelis-Menten-Diagramm"),
      blob: tx("Find KM yourself, then bring in an inhibitor!", "Find KM selbst und hol dann einen Hemmstoff dazu!"),
      body: tx(
        "Move $[S]$ and read off $v$. With the guide lines you find $K_M$ at $\\frac{1}{2} v_{max}$. Then switch on an inhibitor: which value changes, $v_{max}$ or $K_M$?",
        "Verschieb $[S]$ und lies $v$ ab. Mit den Hilfslinien findest du $K_M$ bei $\\frac{1}{2} v_{max}$. Dann schalte einen Hemmstoff zu: Welcher Wert ändert sich, $v_{max}$ oder $K_M$?",
      ),
      widget: EnzymeKinetics,
    },
    {
      type: "explain",
      title: tx("KM: a measure of affinity", "KM: ein Maß für die Affinität"),
      blob: tx("Small number, big attraction!", "Kleine Zahl, große Anziehung!"),
      body: tx(
        "The smaller $K_M$, the less substrate an enzyme needs to reach half its maximum rate. It binds its substrate more tightly: it has a **higher affinity**.",
        "Je kleiner $K_M$, desto weniger Substrat braucht ein Enzym, um die halbe Maximalgeschwindigkeit zu erreichen. Es bindet sein Substrat fester: Es hat eine **höhere Affinität**.",
      ),
      frames: [
        { math: tx('"small" K_M \\Rightarrow "high affinity"', '"kleines" K_M \\Rightarrow "hohe Affinität"'), note: tx("Small $K_M$: half saturated with little substrate, high affinity.", "Kleines $K_M$: schon bei wenig Substrat halb gesättigt, hohe Affinität.") },
        { math: tx('"hexokinase:" \\; K_M \\approx 0.1 "mmol/L"', '"Hexokinase:" \\; K_M \\approx 0,1 "mmol/l"'), note: tx("Example glucose: hexokinase in muscle and nerve cells has a $K_M$ of about 0.1 mmol/L.", "Beispiel Glucose: Die Hexokinase in Muskel- und Nervenzellen hat ein $K_M$ von etwa 0,1 mmol/l.") },
        {
          math: tx('"hexokinase:" \\; K_M \\approx 0.1 "mmol/L" \\\\ "glucokinase:" \\; K_M \\approx 10 "mmol/L"', '"Hexokinase:" \\; K_M \\approx 0,1 "mmol/l" \\\\ "Glucokinase:" \\; K_M \\approx 10 "mmol/l"'),
          note: tx("Glucokinase in the liver catalyses the same reaction, but its $K_M$ is about 10 mmol/L: a much lower affinity.", "Die Glucokinase der Leber katalysiert dieselbe Reaktion, ihr $K_M$ liegt aber bei etwa 10 mmol/l: eine viel geringere Affinität."),
        },
        {
          math: tx('"blood:" \\; 5 "mmol/L" \\Rightarrow "hexokinase saturated"', '"Blut:" \\; 5 "mmol/l" \\Rightarrow "Hexokinase gesättigt"'),
          note: tx("At normal blood sugar (about 5 mmol/L) hexokinase works almost at $v_{max}$, so cells always get glucose. Glucokinase only gets going when there is a lot of glucose, after a meal: then the liver stores it.", "Bei normalem Blutzucker (etwa 5 mmol/l) arbeitet die Hexokinase fast mit $v_{max}$, Zellen bekommen also immer Glucose. Die Glucokinase legt erst richtig los, wenn viel Glucose da ist, etwa nach dem Essen: Dann speichert die Leber sie."),
        },
      ],
    },
    { type: "check", blob: tx("Your turn: read it off.", "Du bist dran: Lies ab."), exercise: kmCheck },
    {
      type: "widget",
      title: tx("Induced fit and inhibitors in the model", "Induced Fit und Hemmstoffe im Modell"),
      blob: tx("Enzymes are more flexible than a lock!", "Enzyme sind beweglicher als ein Schloss!"),
      body: tx(
        "The lock and key model is a rigid picture. In 1958 Koshland extended it to the **induced fit model**: the substrate itself brings the active site into its fitting shape. Compare the two models, then try the inhibitors.",
        "Das Schlüssel-Schloss-Modell ist ein starres Bild. Koshland erweiterte es 1958 zum **Induced-Fit-Modell**: Erst das Substrat bringt das aktive Zentrum in seine passende Form. Vergleich beide Modelle und probier dann die Hemmstoffe aus.",
      ),
      widget: () => <EnzymeLockKey level={3} />,
    },
    {
      type: "explain",
      title: tx("Three kinds of inhibition", "Drei Arten der Hemmung"),
      blob: tx("Not all inhibitors work the same way.", "Nicht alle Hemmstoffe wirken gleich."),
      frames: [
        {
          math: tx('"competitive:" \\; K_M "↑" \\quad v_{max} "unchanged"', '"kompetitiv:" \\; K_M "↑" \\quad v_{max} "gleich"'),
          note: tx("**Competitive inhibition**: the inhibitor is similar to the substrate and competes for the active site. Lots of substrate pushes it out: $v_{max}$ stays, $K_M$ rises. Example: malonate inhibits succinate dehydrogenase.", "**Kompetitive Hemmung**: Der Hemmstoff ist dem Substrat strukturähnlich und konkurriert um das aktive Zentrum. Viel Substrat verdrängt ihn: $v_{max}$ bleibt, $K_M$ steigt. Beispiel: Malonat hemmt die Succinat-Dehydrogenase."),
        },
        {
          math: tx('"non-competitive:" \\; v_{max} "↓" \\quad K_M "unchanged"', '"nicht-kompetitiv:" \\; v_{max} "↓" \\quad K_M "gleich"'),
          note: tx("**Non-competitive (allosteric) inhibition**: the inhibitor binds at the allosteric site and deforms the active site. More substrate doesn't help: $v_{max}$ falls, $K_M$ stays (school model).", "**Nicht-kompetitive (allosterische) Hemmung**: Der Hemmstoff bindet am allosterischen Zentrum und verformt das aktive Zentrum. Mehr Substrat hilft nicht: $v_{max}$ sinkt, $K_M$ bleibt (Schulmodell)."),
        },
        {
          math: tx('\\ce{Hg^2+}, \\ce{Pb^2+} \\to "SH groups" \\Rightarrow "irreversible"', '\\ce{Hg^2+}, \\ce{Pb^2+} \\to "SH-Gruppen" \\Rightarrow "irreversibel"'),
          note: tx("**Irreversible inhibition**: the inhibitor binds firmly and for good. Heavy metal ions such as $\\ce{Hg^2+}$ or $\\ce{Pb^2+}$ bind to the SH groups of cysteine and change the folded structure. Those enzymes are lost: $v_{max}$ falls.", "**Irreversible Hemmung**: Der Hemmstoff bindet fest und dauerhaft. Schwermetallionen wie $\\ce{Hg^2+}$ oder $\\ce{Pb^2+}$ binden an die SH-Gruppen des Cysteins und verändern die Raumstruktur. Diese Enzyme fallen aus: $v_{max}$ sinkt."),
        },
        {
          math: tx('"methanol vs. ethanol" \\to "ADH"', '"Methanol gegen Ethanol" \\to "ADH"'),
          note: tx("In practice: in methanol poisoning doctors give ethanol. It competes with methanol for the active site of alcohol dehydrogenase (ADH), so less toxic formaldehyde forms.", "Anwendung: Bei einer Methanolvergiftung gibt man Ethanol. Es konkurriert mit Methanol um das aktive Zentrum der Alkohol-Dehydrogenase (ADH), so entsteht weniger giftiges Formaldehyd."),
        },
      ],
    },
    {
      type: "check",
      blob: tx("Read the curves like an examiner.", "Lies die Kurven wie ein Prüfer."),
      exercise: {
        instruction: tx("Identify the inhibition", "Bestimme die Art der Hemmung"),
        text: tx("Curve 1: enzyme without inhibitor. Curve 2: with inhibitor. Which kind of inhibition is it?", "Kurve 1: Enzym ohne Hemmstoff. Kurve 2: mit Hemmstoff. Um welche Art der Hemmung handelt es sich?"),
        visual: visual(EnzymeMMGraph, { curves: [{ vmax: 80, km: 2, label: "1" }, { vmax: 80, km: 8, label: "2", dashed: true }], xMax: 40, xStep: 5, yMax: 100, yStep: 20 }),
        answer: inhibCheck.answer,
        hint: tx("Do both curves head for the same maximum?", "Laufen beide Kurven auf dasselbe Maximum zu?"),
        solution: [
          { math: tx('v_{max} "unchanged", \\; K_M: 2 \\to 8 "mmol/L"', 'v_{max} "gleich", \\; K_M: 2 \\to 8 "mmol/l"'), note: tx("Same $v_{max}$, larger $K_M$: competitive inhibition. With enough substrate the inhibitor is pushed out.", "Gleiches $v_{max}$, größeres $K_M$: kompetitive Hemmung. Bei genug Substrat wird der Hemmstoff verdrängt.") },
        ],
        mistakes: inhibCheck.mistakes,
      },
    },
    {
      type: "explain",
      title: tx("Cofactors and coenzymes", "Cofaktoren und Coenzyme"),
      blob: tx("Many enzymes need a little helper.", "Viele Enzyme brauchen einen kleinen Helfer."),
      body: tx("Many enzymes only work with a non-protein helper: a **cofactor**.", "Viele Enzyme arbeiten nur mit einem Helfer, der kein Protein ist: einem **Cofaktor**."),
      frames: [
        { math: tx('"apoenzyme" + "cofactor" \\to "holoenzyme"', '"Apoenzym" + "Cofaktor" \\to "Holoenzym"'), note: tx("The protein part is the **apoenzyme**. Only with the cofactor does the active **holoenzyme** form.", "Der Proteinteil heißt **Apoenzym**. Erst mit dem Cofaktor entsteht das aktive **Holoenzym**.") },
        { math: "\\ce{Mg^2+} \\quad \\ce{Zn^2+} \\quad \\ce{Fe^2+}", note: tx("Cofactors can be **metal ions**, for example $\\ce{Mg^2+}$ in many enzymes that use ATP, or $\\ce{Zn^2+}$ in carbonic anhydrase.", "Cofaktoren können **Metallionen** sein, zum Beispiel $\\ce{Mg^2+}$ bei vielen Enzymen, die ATP umsetzen, oder $\\ce{Zn^2+}$ in der Carboanhydrase.") },
        { math: "\\ce{NAD+ + 2H -> NADH + H+}", note: tx("Organic cofactors are **coenzymes**. $\\ce{NAD+}$ takes up hydrogen (electrons) and passes it on elsewhere. It is changed in the process and has to be regenerated: a **cosubstrate**.", "Organische Cofaktoren heißen **Coenzyme**. $\\ce{NAD+}$ nimmt Wasserstoff (Elektronen) auf und gibt ihn an anderer Stelle wieder ab. Es wird dabei verändert und muss regeneriert werden: ein **Cosubstrat**.") },
        { math: "\\ce{ATP -> ADP + P}", note: tx("**ATP** transfers phosphate groups and so provides energy for many reactions. Many coenzymes are made from **vitamins**: $\\ce{NAD+}$ from niacin (vitamin B3), FAD from riboflavin (B2).", "**ATP** überträgt Phosphatgruppen und liefert so Energie für viele Reaktionen. Viele Coenzyme werden aus **Vitaminen** gebildet: $\\ce{NAD+}$ aus Niacin (Vitamin B3), FAD aus Riboflavin (B2).") },
        { math: tx('"tightly bound:" \\; "prosthetic group (FAD, haem)"', '"fest gebunden:" \\; "prosthetische Gruppe (FAD, Häm)"'), note: tx("A cofactor that stays tightly bound to the enzyme is a **prosthetic group**, e.g. FAD or haem.", "Ein Cofaktor, der fest am Enzym gebunden bleibt, heißt **prosthetische Gruppe**, z. B. FAD oder Häm.") },
      ],
    },
    {
      type: "widget",
      title: tx("End-product inhibition", "Endprodukthemmung"),
      blob: tx("A pathway that regulates itself. Clever!", "Eine Kette, die sich selbst regelt. Clever!"),
      body: tx(
        "Many pathways are controlled at their **first** enzyme. It is an **allosteric enzyme**: besides the active site it has an allosteric site where an effector binds. In **end-product inhibition** (feedback inhibition) this effector is the end product of the pathway. Example: isoleucine inhibits threonine deaminase, the first of five enzymes from threonine to isoleucine (simplified here to three).",
        "Viele Stoffwechselwege werden an ihrem **ersten** Enzym gesteuert. Es ist ein **allosterisches Enzym**: Neben dem aktiven Zentrum hat es ein allosterisches Zentrum, an dem ein Effektor bindet. Bei der **Endprodukthemmung** (Feedback-Hemmung) ist dieser Effektor das Endprodukt der Kette. Beispiel: Isoleucin hemmt die Threonin-Desaminase, das erste von fünf Enzymen auf dem Weg von Threonin zu Isoleucin (hier vereinfacht mit drei).",
      ),
      widget: EnzymeFeedback,
    },
    {
      type: "explain",
      title: tx("How enzymes get their names", "Wie Enzyme ihre Namen bekommen"),
      blob: tx("Once you know the code, the names explain themselves.", "Kennst du den Code, erklären sich die Namen von selbst."),
      frames: [
        { math: tx('"substrate" + "reaction" + "-ase"', '"Substrat" + "Reaktion" + "-ase"'), note: tx("Systematic enzyme names are made of the substrate, the kind of reaction and the ending -ase.", "Systematische Enzymnamen bestehen aus dem Substrat, der Reaktionsart und der Endung -ase.") },
        { math: tx('"lactate" + "dehydrogen" + "ase"', '"Lactat" + "Dehydrogen" + "ase"'), note: tx("Lactate **dehydrogenase** removes hydrogen from lactate (and passes it to $\\ce{NAD+}$).", "Lactat-**Dehydrogenase** entzieht dem Lactat Wasserstoff (und gibt ihn an $\\ce{NAD+}$ weiter).") },
        { math: tx('"pyruvate" + "decarboxyl" + "ase"', '"Pyruvat" + "Decarboxyl" + "ase"'), note: tx("Pyruvate **decarboxylase** splits CO₂ off pyruvate (alcoholic fermentation).", "Pyruvat-**Decarboxylase** spaltet vom Pyruvat CO₂ ab (alkoholische Gärung).") },
        { math: tx('"DNA" + "polymer" + "ase"', '"DNA" + "Polymer" + "ase"'), note: tx("DNA **polymerase** links nucleotides into DNA. Old trivial names without -ase still exist too: pepsin, trypsin, lysozyme.", "DNA-**Polymerase** verknüpft Nucleotide zu DNA. Daneben gibt es alte Trivialnamen ohne -ase: Pepsin, Trypsin, Lysozym.") },
      ],
    },
    { type: "check", blob: tx("Last one: where does the brake go?", "Die letzte: Wo sitzt die Bremse?"), exercise: feedbackCheck },
  ],
  summary: [
    {
      title: tx("Michaelis-Menten", "Michaelis-Menten"),
      body: tx(
        "$v_{max}$: maximum rate when all enzymes are saturated. $K_M$: substrate concentration at **half** the maximum rate. $v_{max}$ grows with the amount of enzyme, $K_M$ doesn't.",
        "$v_{max}$: Maximalgeschwindigkeit, wenn alle Enzyme gesättigt sind. $K_M$: Substratkonzentration bei **halber** Maximalgeschwindigkeit. $v_{max}$ wächst mit der Enzymmenge, $K_M$ nicht.",
      ),
      examples: ["v = \\frac{v_{max} \\cdot [S]}{K_M + [S]}", "[S] = K_M \\Rightarrow v = \\frac{1}{2} v_{max}"],
      tone: "rule",
    },
    {
      title: tx("KM and affinity", "KM und Affinität"),
      body: tx("**Small $K_M$ = high affinity**: the enzyme is half saturated with little substrate. Hexokinase (about 0.1 mmol/L) binds glucose much more tightly than glucokinase (about 10 mmol/L).", "**Kleines $K_M$ = hohe Affinität**: Das Enzym ist schon bei wenig Substrat halb gesättigt. Hexokinase (etwa 0,1 mmol/l) bindet Glucose viel fester als Glucokinase (etwa 10 mmol/l)."),
      tone: "rule",
    },
    {
      title: tx("Inhibition", "Hemmung"),
      body: tx(
        "**Competitive**: substrate look-alike in the active site, $K_M$ rises, $v_{max}$ unchanged, overcome by lots of substrate. **Non-competitive (allosteric)**: binds at the allosteric site, $v_{max}$ falls, $K_M$ unchanged. **Irreversible**: permanent, e.g. heavy metal ions at SH groups.",
        "**Kompetitiv**: substratähnlich, im aktiven Zentrum, $K_M$ steigt, $v_{max}$ bleibt, durch viel Substrat aufhebbar. **Nicht-kompetitiv (allosterisch)**: bindet am allosterischen Zentrum, $v_{max}$ sinkt, $K_M$ bleibt. **Irreversibel**: dauerhaft, z. B. Schwermetallionen an SH-Gruppen.",
      ),
      examples: [tx('"competitive:" K_M "↑" \\quad "non-competitive:" v_{max} "↓"', '"kompetitiv:" K_M "↑" \\quad "nicht-kompetitiv:" v_{max} "↓"')],
      tone: "rule",
    },
    {
      title: tx("Cofactors", "Cofaktoren"),
      body: tx(
        "Apoenzyme + cofactor = holoenzyme. Cofactors: metal ions ($\\ce{Mg^2+}$, $\\ce{Zn^2+}$) or coenzymes ($\\ce{NAD+}$ carries hydrogen, ATP phosphate groups, coenzyme A acetyl groups), often made from vitamins.",
        "Apoenzym + Cofaktor = Holoenzym. Cofaktoren: Metallionen ($\\ce{Mg^2+}$, $\\ce{Zn^2+}$) oder Coenzyme ($\\ce{NAD+}$ überträgt Wasserstoff, ATP Phosphatgruppen, Coenzym A Acetylgruppen), oft aus Vitaminen gebildet.",
      ),
      examples: ["\\ce{NAD+ + 2H -> NADH + H+}"],
      tone: "rule",
    },
    {
      title: tx("Regulation and models", "Regulation und Modelle"),
      body: tx(
        "**End-product inhibition**: the end product inhibits the **first** enzyme of its pathway allosterically (negative feedback). **Induced fit**: the active site adapts to the substrate when it binds. Names: substrate + reaction + -ase.",
        "**Endprodukthemmung**: Das Endprodukt hemmt das **erste** Enzym seiner Kette allosterisch (negative Rückkopplung). **Induced Fit**: Das aktive Zentrum passt sich beim Binden an das Substrat an. Namen: Substrat + Reaktion + -ase.",
      ),
      tone: "tip",
    },
    {
      title: tx("Typical mistakes", "Typische Fehler"),
      body: tx(
        "A **larger** $K_M$ means **lower** affinity! Don't read $K_M$ at the end of the curve but at $\\frac{1}{2} v_{max}$, and on the x-axis. Competitive changes $K_M$, non-competitive changes $v_{max}$.",
        "Ein **größeres** $K_M$ heißt **geringere** Affinität! $K_M$ nicht am Kurvenende ablesen, sondern bei $\\frac{1}{2} v_{max}$, und zwar auf der x-Achse. Kompetitiv ändert $K_M$, nicht-kompetitiv ändert $v_{max}$.",
      ),
      tone: "warning",
    },
  ],
};
