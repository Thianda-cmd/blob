// Level 3 practice (Oberstufe): biomembranes and the fluid mosaic model, diffusion and osmosis,
// plasmolysis, passive and active transport, endo- and exocytosis, the endosymbiotic theory and
// resolution. Abitur style: apply, explain with mechanisms, read data, calculate.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { CellMassChart, CellUptakeChart } from "@/learn/biology/visuals/CellCharts";
import { CellMembrane } from "@/learn/biology/visuals/CellMembrane";
import { CellOsmosisCell, type OsmoCell, type OsmoSolution } from "@/learn/biology/visuals/CellOsmosisLab";
import { MEMBRANE } from "./data";
import { capT, choice, de, en, frame, join, matchMistake, mistakes, multi, orderMistake, q, visual, type Opt } from "./kit";

const L = (f: (l: "en" | "de") => string): Text => tx(f("en"), f("de"));
const n = (v: number, l: "en" | "de", digits = 4) => new Intl.NumberFormat(l === "de" ? "de-DE" : "en-GB", { maximumFractionDigits: digits, useGrouping: false }).format(v);
const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

// ---------------------------------------------------------------------------
// Osmosis: what happens to the cell?

const OUT = {
  plasmolysis: tx("Water leaves the vacuole and the protoplast pulls away from the cell wall (plasmolysis)", "Wasser strömt aus der Vakuole, und der Protoplast löst sich von der Zellwand (Plasmolyse)"),
  turgor: tx("Water flows in, the protoplast presses against the wall and the cell becomes turgid, but it doesn't burst", "Wasser strömt ein, der Protoplast drückt gegen die Wand, und die Zelle wird prall, platzt aber nicht"),
  burstPlant: tx("Water flows in until the cell bursts", "Wasser strömt ein, bis die Zelle platzt"),
  none: tx("No net flow of water: the cell stays as it is", "Kein Netto-Wasserstrom: Die Zelle bleibt, wie sie ist"),
  saltIn: tx("Salt flows into the cell and the cell swells", "Salz strömt in die Zelle, und die Zelle schwillt an"),
  haemolysis: tx("Water flows in, the cell swells and bursts (haemolysis)", "Wasser strömt ein, die Zelle schwillt an und platzt (Hämolyse)"),
  crenation: tx("Water flows out and the cell shrinks into a crumpled, spiky shape", "Wasser strömt aus, und die Zelle schrumpft zur Stechapfelform"),
  rbcPlasmolysis: tx("The protoplast pulls away from the cell wall (plasmolysis)", "Der Protoplast löst sich von der Zellwand (Plasmolyse)"),
};

const SAY = {
  backwards: [tx("Which side has more particles?", "Wo sind mehr Teilchen?"), tx("Water flows (net) towards the side with **more** dissolved particles. Compare the outside with the inside again.", "Wasser strömt netto zur Seite mit **mehr** gelösten Teilchen. Vergleich außen und innen noch einmal.")],
  saltMoves: [tx("The water moves, not the salt", "Das Wasser wandert, nicht das Salz"), tx("The membrane hardly lets ions through. In osmosis it's the water that moves.", "Die Membran lässt Ionen kaum durch. Bei der Osmose bewegt sich das Wasser.")],
  wallHolds: [tx("The wall holds", "Die Wand hält"), tx("The firm cell wall pushes back (wall pressure): plant cells become turgid but don't burst.", "Die feste Zellwand drückt dagegen (Wanddruck): Pflanzenzellen werden prall, platzen aber nicht.")],
  noWall: [tx("No wall to hold it", "Keine Wand, die hält"), tx("A red blood cell has no cell wall. Nothing pushes back against the water flowing in.", "Ein rotes Blutkörperchen hat keine Zellwand. Nichts hält dem einströmenden Wasser stand.")],
  rbcNoPlasmolysis: [tx("No wall, no plasmolysis", "Keine Wand, keine Plasmolyse"), tx("Plasmolysis means the protoplast leaves the wall. Red blood cells have no wall: they shrink as a whole.", "Plasmolyse heißt: Der Protoplast löst sich von der Wand. Rote Blutkörperchen haben keine Wand: Sie schrumpfen als Ganzes.")],
  isoMoves: [tx("Balanced", "Im Gleichgewicht"), tx("Same concentration inside and outside: water molecules move both ways equally, so there's no net flow.", "Innen und außen gleich konzentriert: Wassermoleküle wandern gleich oft in beide Richtungen, netto strömt nichts.")],
  notIso: [tx("Not balanced", "Nicht ausgeglichen"), tx("The concentrations inside and outside differ, so there is a net flow of water. Which way?", "Innen und außen sind unterschiedlich konzentriert, also gibt es einen Netto-Wasserstrom. In welche Richtung?")],
} as const;

type Case = { cell: OsmoCell; sol: OsmoSolution; solution: Text; opts: Opt[] };
const op = (text: Text, s?: readonly [Text, Text]): Opt => (s ? { text, title: s[0], say: s[1] } : { text });

function osmoCases(): Case[] {
  return [
    { cell: "plant", sol: "salt", solution: tx("a 10 % salt solution", "eine 10-prozentige Kochsalzlösung"), opts: [op(OUT.plasmolysis), op(OUT.turgor, SAY.backwards), op(OUT.saltIn, SAY.saltMoves), op(OUT.none, SAY.notIso)] },
    { cell: "plant", sol: "salt", solution: tx("a concentrated sucrose solution (1 mol/L)", "eine konzentrierte Saccharoselösung (1 mol/L)"), opts: [op(OUT.plasmolysis), op(OUT.turgor, SAY.backwards), op(OUT.burstPlant, SAY.backwards), op(OUT.none, SAY.notIso)] },
    { cell: "plant", sol: "water", solution: tx("distilled water", "destilliertes Wasser"), opts: [op(OUT.turgor), op(OUT.burstPlant, SAY.wallHolds), op(OUT.plasmolysis, SAY.backwards), op(OUT.none, SAY.notIso)] },
    { cell: "plant", sol: "iso", solution: tx("a solution exactly as concentrated as the cell sap", "eine Lösung, die genauso konzentriert ist wie der Zellsaft"), opts: [op(OUT.none), op(OUT.turgor, SAY.isoMoves), op(OUT.plasmolysis, SAY.isoMoves), op(OUT.burstPlant, SAY.isoMoves)] },
    { cell: "rbc", sol: "water", solution: tx("distilled water", "destilliertes Wasser"), opts: [op(OUT.haemolysis), op(OUT.turgor, SAY.noWall), op(OUT.crenation, SAY.backwards), op(OUT.none, SAY.notIso)] },
    { cell: "rbc", sol: "salt", solution: tx("a 3 % salt solution", "eine 3-prozentige Kochsalzlösung"), opts: [op(OUT.crenation), op(OUT.rbcPlasmolysis, SAY.rbcNoPlasmolysis), op(OUT.haemolysis, SAY.backwards), op(OUT.saltIn, SAY.saltMoves)] },
    { cell: "rbc", sol: "iso", solution: tx("a 0.9 % salt solution (physiological saline)", "eine 0,9-prozentige Kochsalzlösung (physiologische Kochsalzlösung)"), opts: [op(OUT.none), op(OUT.haemolysis, SAY.isoMoves), op(OUT.crenation, SAY.isoMoves), op(OUT.saltIn, SAY.saltMoves)] },
  ];
}

const TONIC: Record<OsmoSolution, Text> = { water: tx("hypotonic", "hypotonisch"), iso: tx("isotonic", "isotonisch"), salt: tx("hypertonic", "hypertonisch") };

function osmosisTask(rng: Rng, fixed?: number): Exercise {
  const cases = osmoCases();
  const C = fixed !== undefined ? cases[fixed] : rng.pick(cases);
  const { answer, mistakes: list } = choice(rng, C.opts);
  const who = C.cell === "plant" ? tx("Red onion epidermis cells", "Epidermiszellen der roten Zwiebel") : tx("Red blood cells", "Rote Blutkörperchen");
  return {
    instruction: tx("Osmosis: predict", "Osmose: Vorhersage"),
    text: tx(`${en(who)} are placed in **${en(C.solution)}**. What happens?`, `${de(who)} werden in **${de(C.solution)}** gelegt. Was passiert?`),
    answer,
    hint: tx("Compare the concentration of dissolved particles outside and inside. Water flows (net) towards the higher concentration. Does the cell have a wall?", "Vergleich die Konzentration gelöster Teilchen außen und innen. Wasser strömt netto zur höheren Konzentration. Hat die Zelle eine Wand?"),
    solution: [
      frame(join(q(tx("outside:", "außen:"), "a"), q(TONIC[C.sol], "t")), C.sol === "salt" ? tx("Outside there are more dissolved particles than inside: the solution is **hypertonic**.", "Außen sind mehr gelöste Teilchen als innen: Die Lösung ist **hypertonisch**.") : C.sol === "water" ? tx("Outside there are fewer dissolved particles than inside: the solution is **hypotonic**.", "Außen sind weniger gelöste Teilchen als innen: Die Lösung ist **hypotonisch**.") : tx("Inside and outside have the same concentration: **isotonic**.", "Innen und außen gleich konzentriert: **isotonisch**.")),
      frame(join(q(TONIC[C.sol], "t"), "\\Rightarrow", q(C.sol === "salt" ? tx("water out", "Wasser hinaus") : C.sol === "water" ? tx("water in", "Wasser hinein") : tx("no net flow", "kein Netto-Strom"), "w")), C.opts[0].text, ["w"]),
    ],
    mistakes: list,
  };
}

/** Which solution was it? (from a picture of the cell) */
function osmosisPictureTask(rng: Rng): Exercise {
  const pick = rng.pick([
    { cell: "plant" as OsmoCell, sol: "salt" as OsmoSolution },
    { cell: "rbc" as OsmoCell, sol: "water" as OsmoSolution },
    { cell: "rbc" as OsmoCell, sol: "salt" as OsmoSolution },
  ]);
  const right = TONIC[pick.sol];
  const opts: Opt[] = [{ text: capT(right) }];
  for (const s of ["water", "iso", "salt"] as OsmoSolution[]) {
    if (s === pick.sol) continue;
    opts.push({ text: capT(TONIC[s]), title: s === "iso" ? SAY.notIso[0] : SAY.backwards[0], say: s === "iso" ? tx("The cell clearly changed, so water must have flowed. In an isotonic solution nothing would happen.", "Die Zelle hat sich deutlich verändert, also muss Wasser geflossen sein. In isotonischer Lösung würde nichts passieren.") : SAY.backwards[1] });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  const what = pick.cell === "plant" ? tx("a red onion cell", "eine Zelle der roten Zwiebel") : tx("a red blood cell", "ein rotes Blutkörperchen");
  return {
    instruction: tx("Read the picture", "Deute das Bild"),
    text: tx(`This is ${en(what)} a few minutes after it was put into a solution. The arrows show the net water flow. Relative to the cell, the solution was …`, `Das ist ${de(what)} einige Minuten nach dem Einlegen in eine Lösung. Die Pfeile zeigen den Netto-Wasserstrom. Im Vergleich zur Zelle war die Lösung …`),
    visual: visual(CellOsmosisCell, { cell: pick.cell, solution: pick.sol, animate: false }),
    answer,
    hint: tx("Did water flow in or out? Water flows towards the side with more dissolved particles.", "Ist Wasser hinein- oder hinausgeflossen? Wasser strömt zur Seite mit mehr gelösten Teilchen."),
    solution: [
      frame(q(pick.sol === "water" ? tx("water flowed in", "Wasser ist eingeströmt") : tx("water flowed out", "Wasser ist ausgeströmt"), "w"), pick.cell === "plant" ? tx("The protoplast has pulled away from the wall: plasmolysis. Water has left the cell.", "Der Protoplast hat sich von der Wand gelöst: Plasmolyse. Wasser hat die Zelle verlassen.") : pick.sol === "water" ? tx("The cell has swollen and burst: water has flowed in.", "Die Zelle ist angeschwollen und geplatzt: Wasser ist eingeströmt.") : tx("The cell has shrunk and crumpled: water has flowed out.", "Die Zelle ist geschrumpft und geschrumpelt: Wasser ist ausgeströmt.")),
      frame(join(q(pick.sol === "water" ? tx("fewer particles outside", "außen weniger Teilchen") : tx("more particles outside", "außen mehr Teilchen"), "p"), "\\Rightarrow", q(right, "t")), tx(`So the solution was **${en(right)}**.`, `Die Lösung war also **${de(right)}**.`), ["t"]),
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Hyper, hypo, iso and the direction of water flow

function tonicityTask(rng: Rng): Exercise {
  const inside = rng.pick([0.2, 0.3, 0.4, 0.5]);
  const rel = rng.pick(["salt", "water", "salt", "water", "iso"] as OsmoSolution[]);
  const outside = rel === "iso" ? inside : rel === "salt" ? round(inside * rng.pick([1.5, 2, 3])) : round(inside * rng.pick([0.25, 0.5]));
  const conc = L((l) => (l === "en" ? `The cell sap contains ${n(inside, l)} mol/L of dissolved particles, the solution outside ${n(outside, l)} mol/L.` : `Der Zellsaft enthält ${n(inside, l)} mol/L gelöste Teilchen, die Außenlösung ${n(outside, l)} mol/L.`));
  if (rel !== "iso" && rng.chance(0.5)) {
    const toIn = rel === "water";
    const { answer, mistakes: list } = choice(rng, [
      { text: toIn ? tx("Net flow into the cell", "Netto in die Zelle hinein") : tx("Net flow out of the cell", "Netto aus der Zelle hinaus") },
      { text: toIn ? tx("Net flow out of the cell", "Netto aus der Zelle hinaus") : tx("Net flow into the cell", "Netto in die Zelle hinein"), title: tx("Classic trap", "Die klassische Falle"), say: tx("Water flows (net) towards the side with **more** dissolved particles, as if it wanted to dilute it.", "Wasser strömt netto zur Seite mit **mehr** gelösten Teilchen, als wollte es sie verdünnen.") },
      { text: tx("No water moves at all", "Es bewegt sich gar kein Wasser"), title: tx("Not balanced", "Nicht ausgeglichen"), say: SAY.notIso[1] },
      { text: tx("The dissolved particles flow through the membrane until both sides are equal", "Die gelösten Teilchen strömen durch die Membran, bis beide Seiten gleich sind"), title: SAY.saltMoves[0], say: tx("The membrane is semipermeable: water gets through easily, the dissolved particles hardly at all. So it's the water that moves.", "Die Membran ist semipermeabel: Wasser kommt leicht hindurch, die gelösten Teilchen kaum. Deshalb bewegt sich das Wasser.") },
    ]);
    return {
      instruction: tx("Direction of osmosis", "Richtung der Osmose"),
      text: tx(`${en(conc)} Which way does water flow?`, `${de(conc)} In welche Richtung strömt Wasser?`),
      answer,
      hint: tx("Water flows (net) from the hypotonic to the hypertonic side.", "Wasser strömt netto von der hypotonischen zur hypertonischen Seite."),
      solution: [frame(L((l) => `"${l === "en" ? "inside" : "innen"}"#i \\; ${n(inside, l)} \\quad "${l === "en" ? "outside" : "außen"}"#o \\; ${n(outside, l)}`), toIn ? tx("Inside is more concentrated (hypertonic to the outside).", "Innen ist es konzentrierter (hypertonisch gegenüber außen).") : tx("Outside is more concentrated (hypertonic to the cell).", "Außen ist es konzentrierter (hypertonisch gegenüber der Zelle).")), frame(q(toIn ? tx("water flows in", "Wasser strömt hinein") : tx("water flows out", "Wasser strömt hinaus"), "w"), tx("Water moves towards the higher concentration of dissolved particles.", "Wasser wandert zur höheren Konzentration gelöster Teilchen."), ["w"])],
      mistakes: list,
    };
  }
  const opts: Opt[] = [{ text: capT(TONIC[rel]) }];
  for (const s of ["water", "iso", "salt"] as OsmoSolution[]) {
    if (s === rel) continue;
    opts.push({
      text: capT(TONIC[s]),
      title: s === "iso" ? tx("Not equal", "Nicht gleich") : rel === "iso" ? tx("Equal", "Gleich") : tx("Mixed up", "Vertauscht"),
      say: s === "iso" ? tx("Isotonic means the same concentration on both sides. Compare the two numbers.", "Isotonisch heißt: auf beiden Seiten gleich konzentriert. Vergleich die beiden Zahlen.") : rel === "iso" ? tx("Both numbers are the same.", "Beide Zahlen sind gleich.") : tx("Hyper means over: more dissolved particles. Hypo means under: fewer. Which describes the outside solution?", "Hyper heißt über: mehr gelöste Teilchen. Hypo heißt unter: weniger. Was trifft auf die Außenlösung zu?"),
    });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Hypertonic, hypotonic or isotonic?", "Hypertonisch, hypotonisch oder isotonisch?"),
    text: tx(`${en(conc)} Compared with the cell sap, the outside solution is …`, `${de(conc)} Im Vergleich zum Zellsaft ist die Außenlösung …`),
    answer,
    hint: tx("hyper = more dissolved particles, hypo = fewer, iso = equal.", "hyper = mehr gelöste Teilchen, hypo = weniger, iso = gleich viel."),
    solution: [frame(L((l) => `${n(outside, l)} ${outside > inside ? ">" : outside < inside ? "<" : "="} ${n(inside, l)} \\Rightarrow "${l === "en" ? en(TONIC[rel]) : de(TONIC[rel])}"#r`), tx(`The outside solution is **${en(TONIC[rel])}**.`, `Die Außenlösung ist **${de(TONIC[rel])}**.`), ["r"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Transport across membranes

const T = {
  sd: tx("simple diffusion", "einfache Diffusion"),
  ch: tx("facilitated diffusion through a channel", "erleichterte Diffusion durch einen Kanal"),
  car: tx("facilitated diffusion via a carrier", "erleichterte Diffusion über einen Carrier"),
  osm: tx("osmosis", "Osmose"),
  pat: tx("primary active transport", "primär aktiver Transport"),
  sat: tx("secondary active transport", "sekundär aktiver Transport"),
  endo: tx("endocytosis", "Endocytose"),
  exo: tx("exocytosis", "Exocytose"),
};
type TKey = keyof typeof T;
const PROCESSES: { id: string; text: Text; type: TKey }[] = [
  { id: "o2", text: tx("O₂ moves from the blood into a muscle cell", "O₂ gelangt aus dem Blut in eine Muskelzelle"), type: "sd" },
  { id: "co2", text: tx("CO₂ leaves a cell through the lipid bilayer", "CO₂ verlässt eine Zelle durch die Lipiddoppelschicht"), type: "sd" },
  { id: "k", text: tx("K⁺ ions flow out of a nerve cell through open ion channels", "K⁺-Ionen strömen durch offene Ionenkanäle aus einer Nervenzelle"), type: "ch" },
  { id: "glut", text: tx("Glucose enters a red blood cell down its gradient via a transport protein", "Glucose gelangt ihrem Gefälle nach über ein Transportprotein in ein rotes Blutkörperchen"), type: "car" },
  { id: "aqua", text: tx("Water flows through aquaporins into a cell in distilled water", "Wasser strömt durch Aquaporine in eine Zelle in destilliertem Wasser"), type: "osm" },
  { id: "pump", text: tx("Na⁺ is pumped out of the cell using ATP", "Na⁺ wird unter ATP-Verbrauch aus der Zelle gepumpt"), type: "pat" },
  { id: "sglt", text: tx("In the small intestine glucose is taken up together with Na⁺, against its own gradient", "Im Dünndarm wird Glucose zusammen mit Na⁺ gegen ihr eigenes Gefälle aufgenommen"), type: "sat" },
  { id: "phago", text: tx("A macrophage engulfs a bacterium", "Eine Fresszelle umfließt ein Bakterium und nimmt es auf"), type: "endo" },
  { id: "gland", text: tx("A gland cell releases digestive enzymes from vesicles", "Eine Drüsenzelle gibt Verdauungsenzyme aus Vesikeln ab"), type: "exo" },
];
const TRANSPORT_SAY: Partial<Record<string, [Text, Text]>> = {
  "glut>pat": [tx("A carrier alone needs no energy", "Ein Carrier allein braucht keine Energie"), tx("Here glucose moves down its gradient: that is passive, even though a carrier helps.", "Hier wandert Glucose ihrem Gefälle nach: Das ist passiv, auch wenn ein Carrier hilft.")],
  "pump>ch": [tx("Against the gradient", "Gegen das Gefälle"), tx("Nothing flows against its gradient by itself. ATP is used here, so it's active.", "Gegen das Gefälle fließt nichts von allein. Hier wird ATP verbraucht, also ist es aktiv.")],
  "pump>car": [tx("Against the gradient", "Gegen das Gefälle"), tx("Facilitated diffusion only goes down the gradient. Pumping with ATP is active transport.", "Erleichterte Diffusion geht nur dem Gefälle nach. Pumpen mit ATP ist aktiver Transport.")],
  "gland>endo": [tx("In or out?", "Rein oder raus?"), tx("Endo means inwards, exo outwards. Here the enzymes leave the cell.", "Endo heißt hinein, exo hinaus. Hier verlassen die Enzyme die Zelle.")],
  "phago>exo": [tx("In or out?", "Rein oder raus?"), tx("Exo means outwards. The bacterium is taken in.", "Exo heißt hinaus. Das Bakterium wird aufgenommen.")],
  "o2>ch": [tx("Small and nonpolar", "Klein und unpolar"), tx("O₂ is small and nonpolar: it slips straight through the lipid bilayer, no channel needed.", "O₂ ist klein und unpolar: Es schlüpft direkt durch die Lipiddoppelschicht, ganz ohne Kanal.")],
  "co2>ch": [tx("Small and nonpolar", "Klein und unpolar"), tx("CO₂ is small and nonpolar: it crosses the lipid bilayer directly.", "CO₂ ist klein und unpolar: Es durchquert die Lipiddoppelschicht direkt.")],
  "sglt>pat": [tx("Where does the energy come from?", "Woher kommt die Energie?"), tx("No ATP is split at this carrier. The energy comes from the Na⁺ gradient that the sodium-potassium pump built up: secondary active.", "An diesem Carrier wird kein ATP gespalten. Die Energie stammt aus dem Na⁺-Gefälle, das die Natrium-Kalium-Pumpe aufgebaut hat: sekundär aktiv.")],
  "k>pat": [tx("Down the gradient", "Dem Gefälle nach"), tx("Through open channels ions only flow down their gradient. No ATP needed.", "Durch offene Kanäle fließen Ionen nur ihrem Gefälle nach. Kein ATP nötig.")],
  "aqua>pat": [tx("Osmosis is passive", "Osmose ist passiv"), tx("Water follows the concentration difference by itself. Osmosis needs no ATP.", "Wasser folgt dem Konzentrationsunterschied von selbst. Osmose braucht kein ATP.")],
};

function transportMatchTask(rng: Rng, fixed?: string[]): Exercise {
  const pool = rng.shuffle(PROCESSES);
  const chosen: typeof PROCESSES = [];
  for (const p of fixed ? fixed.map((id) => PROCESSES.find((x) => x.id === id)!) : pool) if (!chosen.some((c) => c.type === p.type) && chosen.length < 4) chosen.push(p);
  const used = new Set(chosen.map((c) => c.type));
  const extra = rng.pick((Object.keys(T) as TKey[]).filter((k) => !used.has(k)));
  const pairs = chosen.map((p) => [p.text, capT(T[p.type])] as [Text, Text]);
  const options = new Set([...chosen.map((c) => c.type), extra]);
  const list: Mistake[] = [];
  for (const p of chosen)
    for (const k of options) {
      const s = TRANSPORT_SAY[`${p.id}>${k}`];
      if (s && list.length < 4) list.push(matchMistake([[p.text, capT(T[k])]], s[0], s[1]));
    }
  return {
    instruction: tx("Transport across the membrane", "Transport durch die Membran"),
    text: tx("Match each process to the kind of transport. One kind is left over.", "Ordne jedem Vorgang die Transportform zu. Eine Transportform bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [capT(T[extra])] },
    hint: tx("Ask: down or against the gradient? Through the lipids, a channel or a carrier? Is ATP used? Are whole vesicles involved?", "Frag dich: mit oder gegen das Gefälle? Durch die Lipide, einen Kanal oder einen Carrier? Wird ATP verbraucht? Sind ganze Vesikel beteiligt?"),
    solution: chosen.map((p, i) => frame(q(T[p.type], `t${i}`), tx(`${en(p.text)}: ${en(T[p.type])}.`, `${de(p.text)}: ${de(T[p.type])}.`))),
    mistakes: list,
  };
}

type Experiment = { text: Text; right: TKey; wrong: [TKey, Text, Text][] };
const EXPERIMENTS: Experiment[] = [
  {
    text: tx("The uptake of substance X rises in proportion to its outside concentration, even at very high concentrations. A respiratory poison (cyanide) has no effect.", "Die Aufnahme von Stoff X steigt proportional zur Außenkonzentration, auch bei sehr hohen Konzentrationen. Ein Atmungsgift (Cyanid) hat keine Wirkung."),
    right: "sd",
    wrong: [
      ["car", tx("No saturation", "Keine Sättigung"), tx("Carriers can be saturated: the rate would level off. Here it keeps rising.", "Carrier lassen sich sättigen: Die Rate würde abflachen. Hier steigt sie immer weiter.")],
      ["pat", tx("No ATP needed", "Kein ATP nötig"), tx("Cyanide stops cellular respiration and with it ATP production. Since nothing changes, no ATP is involved.", "Cyanid stoppt die Zellatmung und damit die ATP-Bildung. Da sich nichts ändert, ist kein ATP beteiligt.")],
      ["endo", tx("Too small for vesicles", "Zu klein für Vesikel"), tx("Endocytosis needs energy and works with vesicles for big particles. Nothing hints at that here.", "Endocytose braucht Energie und arbeitet mit Vesikeln für große Partikel. Darauf deutet hier nichts hin.")],
    ],
  },
  {
    text: tx("The uptake of substance X rises at first, then levels off at a maximum, however high the outside concentration. Cyanide has no effect, and X never gets more concentrated inside than outside.", "Die Aufnahme von Stoff X steigt zunächst und erreicht dann ein Maximum, egal wie hoch die Außenkonzentration wird. Cyanid hat keine Wirkung, und X wird innen nie konzentrierter als außen."),
    right: "car",
    wrong: [
      ["sd", tx("Look at the maximum", "Schau auf das Maximum"), tx("Simple diffusion would keep rising with the concentration. A maximum means: all transport proteins are busy (saturation).", "Einfache Diffusion würde mit der Konzentration immer weiter steigen. Ein Maximum heißt: Alle Transportproteine sind besetzt (Sättigung).")],
      ["pat", tx("No ATP needed", "Kein ATP nötig"), tx("Cyanide has no effect and X isn't concentrated: so no energy is used. Passive, but with a carrier.", "Cyanid wirkt nicht, und X wird nicht angereichert: Es wird also keine Energie verbraucht. Passiv, aber mit Carrier.")],
      ["endo", tx("Molecules, not particles", "Moleküle, keine Partikel"), tx("Endocytosis takes in large particles in vesicles and needs energy. The saturation curve points to a carrier.", "Endocytose nimmt große Partikel in Vesikeln auf und braucht Energie. Die Sättigungskurve deutet auf einen Carrier.")],
    ],
  },
  {
    text: tx("Substance X becomes 30 times more concentrated inside the cell than outside. After cyanide is added, the uptake stops.", "Stoff X wird in der Zelle 30-mal stärker angereichert als außen. Nach Zugabe von Cyanid bricht die Aufnahme ab."),
    right: "pat",
    wrong: [
      ["car", tx("Against the gradient", "Gegen das Gefälle"), tx("Facilitated diffusion can only even out concentrations, never build up a 30-fold excess. That takes energy.", "Erleichterte Diffusion kann Konzentrationen nur ausgleichen, nie einen 30-fachen Überschuss aufbauen. Dafür braucht es Energie.")],
      ["sd", tx("Against the gradient", "Gegen das Gefälle"), tx("Diffusion runs down the gradient until both sides are equal. Here X is enriched, and cyanide stops it: ATP is needed.", "Diffusion läuft dem Gefälle nach, bis beide Seiten gleich sind. Hier wird X angereichert, und Cyanid stoppt es: ATP wird gebraucht.")],
      ["exo", tx("In, not out", "Rein, nicht raus"), tx("Exocytosis releases substances from the cell. Here X is taken up.", "Exocytose gibt Stoffe aus der Zelle ab. Hier wird X aufgenommen.")],
    ],
  },
  {
    text: tx("Under the microscope you see the cell membrane of an amoeba flow around a yeast cell. A little later the yeast cell lies inside the amoeba in a bubble.", "Unter dem Mikroskop siehst du, wie die Zellmembran einer Amöbe eine Hefezelle umfließt. Kurz darauf liegt die Hefezelle in einem Bläschen in der Amöbe."),
    right: "endo",
    wrong: [
      ["exo", tx("In or out?", "Rein oder raus?"), tx("Exo means outwards. Here something is taken in.", "Exo heißt hinaus. Hier wird etwas aufgenommen.")],
      ["car", tx("Far too big", "Viel zu groß"), tx("A whole yeast cell doesn't fit through any transport protein. Big particles are taken in by the membrane itself.", "Eine ganze Hefezelle passt durch kein Transportprotein. Große Partikel werden von der Membran selbst aufgenommen.")],
      ["sd", tx("Far too big", "Viel zu groß"), tx("Only small molecules can diffuse through the membrane. A cell is millions of times bigger.", "Nur kleine Moleküle diffundieren durch die Membran. Eine Zelle ist millionenfach größer.")],
    ],
  },
];

function experimentTask(rng: Rng): Exercise {
  const E = rng.pick(EXPERIMENTS);
  const { answer, mistakes: list } = choice(rng, [{ text: capT(T[E.right]) }, ...E.wrong.map(([k, title, say]) => ({ text: capT(T[k]), title, say }))]);
  return {
    instruction: tx("Which kind of transport?", "Welche Transportform?"),
    text: tx(`An experiment: ${en(E.text)} Which kind of transport is it?`, `Ein Versuch: ${de(E.text)} Um welche Transportform handelt es sich?`),
    answer,
    hint: tx("Saturation points to transport proteins; enrichment against the gradient and sensitivity to cyanide point to ATP.", "Sättigung deutet auf Transportproteine; Anreicherung gegen das Gefälle und Empfindlichkeit gegen Cyanid deuten auf ATP."),
    solution: [frame(q(T[E.right], "t"), E.right === "sd" ? tx("Rises without limit and needs no energy: **simple diffusion** through the lipid bilayer.", "Steigt ohne Grenze und braucht keine Energie: **einfache Diffusion** durch die Lipiddoppelschicht.") : E.right === "car" ? tx("Saturation, but no energy and no enrichment: **facilitated diffusion via a carrier**.", "Sättigung, aber keine Energie und keine Anreicherung: **erleichterte Diffusion über einen Carrier**.") : E.right === "pat" ? tx("Against the gradient and dependent on respiration (ATP): **active transport**.", "Gegen das Gefälle und abhängig von der Zellatmung (ATP): **aktiver Transport**.") : tx("The membrane engulfs a whole particle into a vesicle: **endocytosis** (phagocytosis).", "Die Membran umschließt ein ganzes Partikel in einem Vesikel: **Endocytose** (Phagocytose)."), ["t"])],
    mistakes: list,
  };
}

function uptakeGraphTask(rng: Rng): Exercise {
  const carrier = rng.pick(["A", "B"] as const);
  const other = carrier === "A" ? "B" : "A";
  const askCarrier = rng.chance(0.6);
  const { answer, mistakes: list } = choice(rng, askCarrier
    ? [
        { text: tx(`Curve ${carrier}: it levels off because all carriers are occupied (saturation)`, `Kurve ${carrier}: Sie flacht ab, weil alle Carrier besetzt sind (Sättigung)`) },
        { text: tx(`Curve ${other}: carriers can work faster and faster without limit`, `Kurve ${other}: Carrier können ohne Grenze immer schneller arbeiten`), title: tx("Carriers have a limit", "Carrier haben eine Grenze"), say: tx("There are only so many carriers, and each needs time per cycle. That's why the rate can't rise for ever.", "Es gibt nur begrenzt viele Carrier, und jeder braucht Zeit pro Durchgang. Deshalb kann die Rate nicht endlos steigen.") },
        { text: tx(`Curve ${carrier}: it levels off because the carriers run out of ATP`, `Kurve ${carrier}: Sie flacht ab, weil den Carriern das ATP ausgeht`), title: tx("No ATP involved", "Kein ATP beteiligt"), say: tx("Right curve, wrong reason. Facilitated diffusion uses no ATP: the carriers are simply all busy.", "Richtige Kurve, falscher Grund. Erleichterte Diffusion braucht kein ATP: Die Carrier sind einfach alle besetzt."), close: true },
        { text: tx(`Curve ${other}: it is a straight line, like everything a protein does`, `Kurve ${other}: Sie ist eine Gerade, wie alles, was ein Protein macht`), title: tx("Straight line: no proteins", "Gerade: keine Proteine"), say: tx("A rate that rises in proportion to the concentration without limit is typical of simple diffusion through the lipids.", "Eine Rate, die proportional zur Konzentration ohne Grenze steigt, ist typisch für einfache Diffusion durch die Lipide.") },
      ]
    : [
        { text: tx(`Curve ${other}: the rate rises in proportion to the concentration, without saturation`, `Kurve ${other}: Die Rate steigt proportional zur Konzentration, ohne Sättigung`) },
        { text: tx(`Curve ${carrier}: diffusion slows down when there is a lot of the substance`, `Kurve ${carrier}: Diffusion wird langsamer, wenn viel Stoff da ist`), title: tx("That's saturation", "Das ist Sättigung"), say: tx("Levelling off is the sign of saturated transport proteins. Simple diffusion keeps getting faster as the gradient grows.", "Abflachen ist das Zeichen für gesättigte Transportproteine. Einfache Diffusion wird mit größerem Gefälle immer schneller.") },
        { text: tx(`Curve ${carrier}: it starts off faster`, `Kurve ${carrier}: Sie startet schneller`), title: tx("Look at the shape", "Schau auf die Form"), say: tx("The steep start comes from the carriers. What matters is the shape: a straight line without a limit means simple diffusion.", "Der steile Anfang kommt von den Carriern. Entscheidend ist die Form: Eine Gerade ohne Grenze heißt einfache Diffusion.") },
        { text: tx(`Curve ${other}: because it uses ATP`, `Kurve ${other}: weil sie ATP verbraucht`), title: tx("Right curve, wrong reason", "Richtige Kurve, falscher Grund"), say: tx("Simple diffusion is passive: no ATP. It is the straight line because nothing can be saturated.", "Einfache Diffusion ist passiv: kein ATP. Sie ist die Gerade, weil nichts gesättigt werden kann."), close: true },
      ]);
  return {
    instruction: tx("Interpret the graph", "Werte das Diagramm aus"),
    text: askCarrier ? tx("The graph shows how fast two substances are taken up into a cell. Which curve shows transport via a **carrier**, and why?", "Das Diagramm zeigt, wie schnell zwei Stoffe in eine Zelle aufgenommen werden. Welche Kurve zeigt den Transport über einen **Carrier**, und warum?") : tx("The graph shows how fast two substances are taken up into a cell. Which curve shows **simple diffusion**, and why?", "Das Diagramm zeigt, wie schnell zwei Stoffe in eine Zelle aufgenommen werden. Welche Kurve zeigt **einfache Diffusion**, und warum?"),
    visual: visual(CellUptakeChart, { carrier }),
    answer,
    hint: tx("Which curve reaches a maximum? What could limit the rate?", "Welche Kurve erreicht ein Maximum? Was könnte die Rate begrenzen?"),
    solution: [
      frame(tx(`"carrier:"#a \\; "${carrier}"#c \\quad "diffusion:"#b \\; "${other}"#d`, `"Carrier:"#a \\; "${carrier}"#c \\quad "Diffusion:"#b \\; "${other}"#d`), tx(`Curve ${carrier} levels off: the carriers are saturated. Curve ${other} rises in a straight line: simple diffusion through the lipid bilayer.`, `Kurve ${carrier} flacht ab: Die Carrier sind gesättigt. Kurve ${other} steigt geradlinig: einfache Diffusion durch die Lipiddoppelschicht.`), [askCarrier ? "c" : "d"]),
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The sodium-potassium pump in numbers

function pumpTask(rng: Rng): Exercise {
  const v = rng.int(0, 4);
  const atp = rng.pick([5, 10, 20, 50, 100, 150, 200]);
  if (v === 0 || v === 1) {
    const na = v === 0;
    const value = na ? 3 * atp : 2 * atp;
    const answer: AnswerSpec = { kind: "number", value, unit: na ? tx("Na⁺ ions", "Na⁺-Ionen") : tx("K⁺ ions", "K⁺-Ionen") };
    const m = mistakes(answer);
    m.add({ kind: "number", value: na ? 2 * atp : 3 * atp }, tx("Sodium and potassium swapped", "Natrium und Kalium vertauscht"), tx("Memory trick: Na⁺ goes **out**, three at a time; K⁺ comes **in**, two at a time.", "Merkhilfe: Na⁺ geht **hinaus**, drei pro Zyklus; K⁺ kommt **hinein**, zwei pro Zyklus."));
    m.add({ kind: "number", value: atp }, tx("More than one per ATP", "Mehr als eins pro ATP"), tx("Each ATP drives one full cycle, and each cycle moves several ions.", "Jedes ATP treibt einen ganzen Zyklus an, und jeder Zyklus bewegt mehrere Ionen."));
    m.add({ kind: "number", value: 5 * atp }, tx("Only one kind", "Nur eine Sorte"), tx(`You added sodium and potassium. The question is only about ${na ? "Na⁺" : "K⁺"}.`, `Du hast Natrium und Kalium zusammengezählt. Gefragt ist nur nach ${na ? "Na⁺" : "K⁺"}.`));
    return {
      instruction: tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"),
      text: na ? tx(`A sodium-potassium pump splits ${atp} ATP molecules. How many Na⁺ ions does it transport out of the cell?`, `Eine Natrium-Kalium-Pumpe spaltet ${atp} ATP-Moleküle. Wie viele Na⁺-Ionen transportiert sie aus der Zelle?`) : tx(`A sodium-potassium pump splits ${atp} ATP molecules. How many K⁺ ions does it transport into the cell?`, `Eine Natrium-Kalium-Pumpe spaltet ${atp} ATP-Moleküle. Wie viele K⁺-Ionen transportiert sie in die Zelle?`),
      answer,
      hint: tx("Per ATP: 3 Na⁺ out, 2 K⁺ in.", "Pro ATP: 3 Na⁺ hinaus, 2 K⁺ hinein."),
      solution: [frame('1 "ATP" \\to 3 \\ce{Na+} , 2 \\ce{K+}', tx("One cycle per ATP: 3 Na⁺ out, 2 K⁺ in.", "Ein Zyklus pro ATP: 3 Na⁺ hinaus, 2 K⁺ hinein.")), frame(`${atp} \\cdot ${na ? 3 : 2} = ${value}#r`, tx(`So **${value}** ${na ? "Na⁺" : "K⁺"} ions.`, `Also **${value}** ${na ? "Na⁺" : "K⁺"}-Ionen.`), ["r"])],
      mistakes: m.list,
    };
  }
  if (v === 2) {
    const na = rng.pick([30, 60, 90, 300, 600, 900, 1200]);
    const value = na / 3;
    const answer: AnswerSpec = { kind: "number", value, unit: "ATP" };
    const m = mistakes(answer);
    m.add({ kind: "number", value: na / 2 }, tx("Sodium and potassium swapped", "Natrium und Kalium vertauscht"), tx("Each ATP moves **three** Na⁺ out (and two K⁺ in).", "Jedes ATP bewegt **drei** Na⁺ hinaus (und zwei K⁺ hinein)."));
    m.add({ kind: "number", value: na * 3 }, tx("Multiplied instead of divided", "Mal statt geteilt"), tx("One ATP is enough for three ions, so you need fewer ATP than ions.", "Ein ATP reicht für drei Ionen, also brauchst du weniger ATP als Ionen."));
    return {
      instruction: tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"),
      text: tx(`How many ATP molecules does a cell need to pump ${na} Na⁺ ions out with the sodium-potassium pump?`, `Wie viele ATP-Moleküle braucht eine Zelle, um mit der Natrium-Kalium-Pumpe ${na} Na⁺-Ionen hinauszupumpen?`),
      answer,
      hint: tx("Per ATP: 3 Na⁺ out.", "Pro ATP: 3 Na⁺ hinaus."),
      solution: [frame(`\\frac{${na}}{3} = ${value}#r`, tx(`3 Na⁺ per ATP: **${value} ATP**.`, `3 Na⁺ pro ATP: **${value} ATP**.`), ["r"])],
      mistakes: m.list,
    };
  }
  if (v === 3) {
    const cycles = rng.pick([10, 50, 100, 200, 500]);
    const answer: AnswerSpec = { kind: "number", value: cycles, unit: tx("positive charges", "positive Ladungen") };
    const m = mistakes(answer);
    m.add({ kind: "number", value: 5 * cycles }, tx("Net, not total", "Netto, nicht gesamt"), tx("Na⁺ out and K⁺ in cancel each other partly: 3 positive charges leave, 2 come in.", "Na⁺ hinaus und K⁺ hinein heben sich teilweise auf: 3 positive Ladungen gehen, 2 kommen."));
    m.add({ kind: "number", value: 3 * cycles }, tx("The K⁺ coming in", "Die einströmenden K⁺"), tx("Don't forget the 2 K⁺ that come in with each cycle.", "Vergiss nicht die 2 K⁺, die pro Zyklus hereinkommen."));
    return {
      instruction: tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"),
      text: tx(`The pump runs through ${cycles} cycles. How many positive charges does the cell lose **net** in the process?`, `Die Pumpe durchläuft ${cycles} Zyklen. Wie viele positive Ladungen verliert die Zelle dabei **netto**?`),
      answer,
      hint: tx("Per cycle: 3 positive charges out, 2 in.", "Pro Zyklus: 3 positive Ladungen hinaus, 2 hinein."),
      solution: [frame('3 - 2 = 1#r', tx("Per cycle the cell loses one positive charge net: the pump is electrogenic and makes the inside more negative.", "Pro Zyklus verliert die Zelle netto eine positive Ladung: Die Pumpe ist elektrogen und macht das Innere negativer."), ["r"]), frame(`${cycles} \\cdot 1 = ${cycles}#s`, tx(`So **${cycles}** positive charges.`, `Also **${cycles}** positive Ladungen.`), ["s"])],
      mistakes: m.list,
    };
  }
  const perSec = rng.pick([50, 100, 150]);
  const minutes = rng.pick([1, 2]);
  const value = 3 * perSec * 60 * minutes;
  const answer: AnswerSpec = { kind: "number", value, unit: tx("Na⁺ ions", "Na⁺-Ionen") };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 3 * perSec }, tx("Seconds and minutes", "Sekunden und Minuten"), tx(`That's per second. ${minutes === 1 ? "A minute has" : "Two minutes have"} ${60 * minutes} seconds.`, `Das ist pro Sekunde. ${minutes === 1 ? "Eine Minute hat" : "Zwei Minuten haben"} ${60 * minutes} Sekunden.`), true);
  m.add({ kind: "number", value: 2 * perSec * 60 * minutes }, tx("Sodium and potassium swapped", "Natrium und Kalium vertauscht"), tx("Three Na⁺ per cycle go out, two K⁺ come in.", "Pro Zyklus gehen drei Na⁺ hinaus, zwei K⁺ kommen herein."));
  m.add({ kind: "number", value: perSec * 60 * minutes }, tx("Cycles, not ions", "Zyklen, nicht Ionen"), tx("That's the number of cycles. Each one moves three Na⁺.", "Das ist die Zahl der Zyklen. Jeder bewegt drei Na⁺."));
  return {
    instruction: tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"),
    text: tx(`A single pump can run through about ${perSec} cycles per second. How many Na⁺ ions does it pump out of the cell in ${minutes === 1 ? "one minute" : "two minutes"}?`, `Eine einzelne Pumpe schafft etwa ${perSec} Zyklen pro Sekunde. Wie viele Na⁺-Ionen pumpt sie in ${minutes === 1 ? "einer Minute" : "zwei Minuten"} aus der Zelle?`),
    answer,
    hint: tx("Ions per cycle × cycles per second × seconds.", "Ionen pro Zyklus × Zyklen pro Sekunde × Sekunden."),
    solution: [frame(`3 \\cdot ${perSec} \\cdot ${60 * minutes} = ${value}#r`, tx(`**${value.toLocaleString("en-GB")}** Na⁺ ions.`, `**${value.toLocaleString("de-DE")}** Na⁺-Ionen.`), ["r"])],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Data: potato pieces in sucrose solutions

const CONCS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

function potatoTask(rng: Rng): Exercise {
  const c0 = rng.pick([0.23, 0.26, 0.27, 0.33, 0.34, 0.37, 0.24]);
  const k = rng.pick([38, 42, 46, 50]);
  const changes = CONCS.map((c) => round(k * (c0 - c) * (1 - 0.25 * (c - c0)), 1));
  const i = changes.findIndex((v) => v < 0);
  const [ca, cb, va, vb] = [CONCS[i - 1], CONCS[i], changes[i - 1], changes[i]];
  const value = round(ca + (va / (va - vb)) * (cb - ca), 3);
  if (rng.chance(0.3)) {
    const { answer, mistakes: list } = choice(rng, [
      { text: tx("There the sucrose solution is isotonic to the cell sap: no net flow of water", "Dort ist die Saccharoselösung isotonisch zum Zellsaft: kein Netto-Wasserstrom") },
      { text: tx("There the potato cells are dead", "Dort sind die Kartoffelzellen tot"), title: tx("Still alive", "Noch lebendig"), say: tx("The cells are fine: no mass change just means as much water flows in as out.", "Den Zellen geht es gut: Keine Massenänderung heißt nur, dass gleich viel Wasser hinein- wie hinausströmt.") },
      { text: tx("There the cells contain no dissolved particles", "Dort enthalten die Zellen keine gelösten Teilchen"), title: tx("Equal, not zero", "Gleich, nicht null"), say: tx("The cell sap is full of dissolved particles. At this point the inside and outside are just equally concentrated.", "Der Zellsaft ist voller gelöster Teilchen. An diesem Punkt sind innen und außen nur gleich konzentriert.") },
      { text: tx("There water molecules stop moving", "Dort bewegen sich keine Wassermoleküle mehr"), title: tx("They keep moving", "Sie bewegen sich weiter"), say: tx("Water molecules never stop moving. They just cross equally often in both directions.", "Wassermoleküle bewegen sich immer. Sie wandern nur gleich oft in beide Richtungen.") },
    ]);
    return {
      instruction: tx("Interpret the data", "Werte die Daten aus"),
      text: tx("Potato cylinders were weighed, left in sucrose solutions for an hour and weighed again. What does it mean where the curve crosses the zero line?", "Kartoffelzylinder wurden gewogen, eine Stunde in Saccharoselösungen gelegt und erneut gewogen. Was bedeutet der Punkt, an dem die Kurve die Nulllinie schneidet?"),
      visual: visual(CellMassChart, { concs: CONCS, changes }),
      answer,
      hint: tx("No change in mass: what does that say about the water flow?", "Keine Massenänderung: Was sagt das über den Wasserstrom?"),
      solution: [frame(q(tx("no mass change = isotonic", "keine Massenänderung = isotonisch"), "r"), tx("Below that concentration the pieces take up water (hypotonic outside), above it they lose water (hypertonic outside).", "Unterhalb dieser Konzentration nehmen die Stücke Wasser auf (außen hypotonisch), darüber geben sie Wasser ab (außen hypertonisch)."), ["r"])],
      mistakes: list,
    };
  }
  // tolerance is absolute for values below 1: ±0.015 mol/L when reading off the graph
  const answer: AnswerSpec = { kind: "number", value, unit: "mol/L", tolerance: 0.015 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: va < -vb ? cb : ca, tolerance: 0.001 }, tx("Between two measurements", "Zwischen zwei Messwerten"), tx("The zero lies between two measured points. Read where the line crosses zero (interpolate) instead of taking the nearest value.", "Der Nullpunkt liegt zwischen zwei Messpunkten. Lies ab, wo die Linie die Null schneidet (interpolieren), statt den nächsten Messwert zu nehmen."), true);
  m.add({ kind: "number", value: va < -vb ? ca : cb, tolerance: 0.001 }, tx("Between two measurements", "Zwischen zwei Messwerten"), tx("The zero lies between two measured points. Read where the line crosses zero (interpolate).", "Der Nullpunkt liegt zwischen zwei Messpunkten. Lies ab, wo die Linie die Null schneidet (interpolieren)."), true);
  return {
    instruction: tx("Find the isotonic point", "Bestimme die isotonische Konzentration"),
    text: tx("Potato cylinders were weighed, left in sucrose solutions for an hour and weighed again. At which sucrose concentration is the solution isotonic to the cell sap? Read it off as precisely as you can.", "Kartoffelzylinder wurden gewogen, eine Stunde in Saccharoselösungen gelegt und erneut gewogen. Bei welcher Saccharosekonzentration ist die Lösung isotonisch zum Zellsaft? Lies so genau wie möglich ab."),
    visual: visual(CellMassChart, { concs: CONCS, changes }),
    answer,
    hint: tx("Isotonic means: no net water flow, so no change in mass. Find where the curve crosses zero.", "Isotonisch heißt: kein Netto-Wasserstrom, also keine Massenänderung. Such die Stelle, an der die Kurve die Null kreuzt."),
    solution: [
      frame(L((l) => `${n(ca, l)} : ${va > 0 ? "+" : ""}${n(va, l, 1)} "%" \\quad ${n(cb, l)} : ${n(vb, l, 1)} "%"`), tx("The sign changes between these two concentrations.", "Zwischen diesen beiden Konzentrationen wechselt das Vorzeichen.")),
      frame(L((l) => `c \\approx ${n(ca, l)} + \\frac{${n(va, l, 1)}}{${n(round(va - vb, 1), l, 1)}} \\cdot ${n(0.1, l)} \\approx ${n(round(value, 2), l)}#r`), L((l) => (l === "en" ? `About **${n(round(value, 2), l)} mol/L**: here the potato neither gains nor loses water.` : `Etwa **${n(round(value, 2), l)} mol/L**: Hier nimmt die Kartoffel weder Wasser auf noch gibt sie welches ab.`)), ["r"]),
    ],
    mistakes: m.list,
  };
}

function massChangeTask(rng: Rng): Exercise {
  for (let t = 0; t < 20; t++) {
    const m1 = round(rng.int(320, 640) / 100, 2);
    const p = rng.pick([-18, -15, -12, -9, -7, 6, 8, 11, 14, 17]) + rng.int(0, 9) / 10;
    const m2 = round(m1 * (1 + p / 100), 2);
    const value = round(((m2 - m1) / m1) * 100, 1);
    if (Math.abs(value) < 2) continue;
    const answer: AnswerSpec = { kind: "number", value, unit: "%", tolerance: 0.03 };
    const m = mistakes(answer);
    m.add({ kind: "number", value: round(((m2 - m1) / m2) * 100, 2), tolerance: 0.005 }, tx("Divided by the wrong mass", "Durch die falsche Masse geteilt"), tx("The change is always measured against the **starting** mass.", "Die Änderung bezieht sich immer auf die **Anfangsmasse**."), true);
    m.add({ kind: "number", value: round(m2 - m1, 2), tolerance: 0.005 }, tx("That's in grams", "Das ist in Gramm"), tx("That's the change in grams. In percent: divide by the starting mass and multiply by 100.", "Das ist die Änderung in Gramm. In Prozent: durch die Anfangsmasse teilen und mal 100."));
    m.add({ kind: "number", value: round((m2 - m1) / m1, 4), tolerance: 0.01 }, tx("Times 100 missing", "Mal 100 fehlt"), tx("That's the share as a decimal. For percent, multiply by 100.", "Das ist der Anteil als Dezimalzahl. Für Prozent noch mal 100."), true);
    const gain = m2 > m1;
    return {
      instruction: tx("Change in mass", "Massenänderung"),
      text: L((l) => (l === "en" ? `A potato cylinder weighs ${n(m1, l, 2)} g. After an hour in a sucrose solution it weighs ${n(m2, l, 2)} g. Work out the change in mass in percent (with sign).` : `Ein Kartoffelzylinder wiegt ${n(m1, l, 2)} g. Nach einer Stunde in einer Saccharoselösung wiegt er ${n(m2, l, 2)} g. Berechne die Massenänderung in Prozent (mit Vorzeichen).`)),
      answer,
      hint: tx("Change in % = (final mass − starting mass) ÷ starting mass × 100.", "Änderung in % = (Endmasse − Anfangsmasse) : Anfangsmasse · 100."),
      solution: [
        frame(L((l) => `\\frac{${n(m2, l, 2)} - ${n(m1, l, 2)}}{${n(m1, l, 2)}} \\cdot 100 "%"`), tx("Difference divided by the starting mass.", "Differenz geteilt durch die Anfangsmasse.")),
        frame(L((l) => `= ${n(value, l, 1)}#r "%"`), gain ? tx("The piece took up water: the solution was hypotonic to the cell sap.", "Das Stück hat Wasser aufgenommen: Die Lösung war hypotonisch zum Zellsaft.") : tx("The piece lost water: the solution was hypertonic to the cell sap.", "Das Stück hat Wasser abgegeben: Die Lösung war hypertonisch zum Zellsaft."), ["r"]),
      ],
      mistakes: m.list,
    };
  }
  return pumpTask(rng);
}

// ---------------------------------------------------------------------------
// The endosymbiotic theory

const EVIDENCE: { id: string; text: Text; right: boolean; say?: Text }[] = [
  { id: "double", text: tx("They are surrounded by two membranes.", "Sie sind von zwei Membranen umgeben."), right: true },
  { id: "dna", text: tx("They have their own ring-shaped DNA.", "Sie besitzen eigene, ringförmige DNA."), right: true },
  { id: "ribo", text: tx("They have their own 70S ribosomes, like bacteria.", "Sie besitzen eigene 70S-Ribosomen wie Bakterien."), right: true },
  { id: "divide", text: tx("They only arise by dividing, never from scratch.", "Sie entstehen nur durch Teilung, nie neu."), right: true },
  { id: "size", text: tx("They are about the size of bacteria.", "Sie sind etwa so groß wie Bakterien."), right: true },
  { id: "everywhere", text: tx("They occur in almost all eukaryotic cells.", "Sie kommen in fast allen Eukaryotenzellen vor."), right: false, say: tx("True, but it says nothing about where they came from. Evidence must point to a bacterial origin.", "Stimmt zwar, sagt aber nichts über ihre Herkunft. Ein Beleg muss auf bakterielle Vorfahren hindeuten.") },
  { id: "alone", text: tx("They can survive outside the cell.", "Sie können außerhalb der Zelle weiterleben."), right: false, say: tx("Just the opposite: they gave most of their genes to the nucleus and can no longer live on their own.", "Gerade nicht: Sie haben die meisten Gene an den Zellkern abgegeben und sind allein nicht mehr lebensfähig.") },
  { id: "nucleus", text: tx("They contain a nucleus of their own.", "Sie enthalten einen eigenen Zellkern."), right: false, say: tx("Like bacteria, they have no nucleus, just a ring of DNA.", "Wie Bakterien haben sie keinen Kern, nur einen DNA-Ring.") },
  { id: "proteins", text: tx("They make all their proteins themselves.", "Sie stellen alle ihre Proteine selbst her."), right: false, say: tx("Most of their proteins are now made in the cytoplasm from genes in the nucleus and imported.", "Die meisten ihrer Proteine werden heute nach Genen im Zellkern im Zellplasma gebildet und importiert.") },
];

function evidenceTask(rng: Rng): Exercise {
  const rights = rng.shuffle(EVIDENCE.filter((x) => x.right)).slice(0, rng.int(3, 4));
  const wrongs = rng.shuffle(EVIDENCE.filter((x) => !x.right)).slice(0, 6 - rights.length);
  const organelle = rng.pick([tx("mitochondria", "Mitochondrien"), tx("chloroplasts", "Chloroplasten")]);
  const M = multi(rng, [...rights, ...wrongs].map((x) => ({ text: x.text, right: x.right, id: x.id })));
  const m = mistakes(M.answer);
  for (const w of wrongs) m.add({ kind: "multi", options: M.options, correct: [...M.correct, ...M.idx([w.id])].sort((a, b) => a - b) }, w.id === "everywhere" ? tx("True, but no evidence", "Wahr, aber kein Beleg") : tx("Not true", "Stimmt nicht"), w.say!);
  return {
    instruction: tx("Evidence for the endosymbiotic theory", "Belege für die Endosymbiontentheorie"),
    text: tx(`Which observations about **${en(organelle)}** support the endosymbiotic theory?`, `Welche Beobachtungen an **${de(organelle)}** stützen die Endosymbiontentheorie?`),
    answer: M.answer,
    hint: tx("Evidence means: something they share with bacteria, or something that reveals how they were taken up.", "Ein Beleg ist etwas, das sie mit Bakterien gemeinsam haben, oder etwas, das zeigt, wie sie aufgenommen wurden."),
    solution: [frame(tx('"double membrane, ring DNA," \\\\ "70S ribosomes, division, size"', '"Doppelmembran, Ring-DNA," \\\\ "70S-Ribosomen, Teilung, Größe"'), tx("All of these are like bacteria, or (double membrane) a trace of endocytosis.", "All das ist wie bei Bakterien oder (Doppelmembran) eine Spur der Endocytose."))],
    mistakes: m.list.slice(0, 4),
  };
}

const ENDO_STEPS: Text[] = [
  tx("A large host cell takes up an aerobic bacterium by endocytosis", "Eine große Wirtszelle nimmt ein aerobes Bakterium durch Endocytose auf"),
  tx("The bacterium is not digested and lives on inside a vesicle", "Das Bakterium wird nicht verdaut und lebt in einem Bläschen weiter"),
  tx("Both profit: ATP for the host, nutrients and protection for the bacterium", "Beide profitieren: ATP für den Wirt, Nährstoffe und Schutz für das Bakterium"),
  tx("Genes move into the nucleus: the bacterium becomes a mitochondrion", "Gene wandern in den Zellkern: Das Bakterium wird zum Mitochondrium"),
  tx("Later some of these cells take up a cyanobacterium: the chloroplast", "Später nehmen einige dieser Zellen ein Cyanobakterium auf: den Chloroplasten"),
];

function endoOrderTask(rng: Rng): Exercise {
  const drop = rng.pick([-1, -1, 2, 1]);
  const items = ENDO_STEPS.filter((_, i) => i !== drop);
  const list: Mistake[] = [orderMistake([ENDO_STEPS[4], ENDO_STEPS[0]], tx("Mitochondria came first", "Mitochondrien kamen zuerst"), tx("Plants have both organelles, animals only mitochondria. So the mitochondrion must be older: the chloroplast was added later.", "Pflanzen haben beide Organellen, Tiere nur Mitochondrien. Also muss das Mitochondrium älter sein: Der Chloroplast kam später dazu."))];
  if (drop !== 1) list.push(orderMistake([ENDO_STEPS[3], ENDO_STEPS[1]], tx("Survive first", "Erst überleben"), tx("Genes can only move into the nucleus after the bacterium has survived inside the host for a long time.", "Gene können erst in den Kern wandern, wenn das Bakterium lange im Wirt überlebt hat.")));
  return {
    instruction: tx("The endosymbiotic theory", "Die Endosymbiontentheorie"),
    text: tx("Put the steps of the endosymbiotic theory in order.", "Bring die Schritte der Endosymbiontentheorie in die richtige Reihenfolge."),
    answer: { kind: "order", items },
    hint: tx("First the uptake, then survival, then partnership and dependence. Which organelle do all eukaryotes have?", "Erst die Aufnahme, dann das Überleben, dann Partnerschaft und Abhängigkeit. Welches Organell haben alle Eukaryoten?"),
    solution: items.map((s, i) => frame(items.slice(0, i + 1).map((_, j) => `"${j + 1}."#n${j}`).join(" \\to "), s, [`n${i}`])),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// The biomembrane

const MEM_SAY: Record<string, [Text, Text]> = {
  "channel>carrier": [tx("Pore or pocket?", "Pore oder Tasche?"), tx("A carrier binds its substance in a pocket and changes shape. This protein has an open tunnel right through it.", "Ein Carrier bindet seinen Stoff in einer Tasche und ändert seine Form. Dieses Protein hat einen offenen Tunnel mittendurch.")],
  "carrier>channel": [tx("Pore or pocket?", "Pore oder Tasche?"), tx("A channel is an open tunnel. This protein holds a molecule in a pocket: it binds it and changes its shape.", "Ein Kanal ist ein offener Tunnel. Dieses Protein hält ein Molekül in einer Tasche: Es bindet es und ändert seine Form.")],
  "glyco>peripheral": [tx("Through or on top?", "Durch oder nur auf?"), tx("A peripheral protein only sits on the surface. This one spans the whole membrane and carries a sugar chain.", "Ein peripheres Protein sitzt nur an der Oberfläche. Dieses durchspannt die ganze Membran und trägt eine Zuckerkette.")],
  "peripheral>glyco": [tx("Through or on top?", "Durch oder nur auf?"), tx("Glycoproteins span the membrane and carry sugar chains outside. This one only sits on the inner surface.", "Glykoproteine durchspannen die Membran und tragen außen Zuckerketten. Dieses sitzt nur an der Innenseite.")],
  "sugar>glyco": [tx("Chain, not protein", "Kette, nicht Protein"), tx("The glycoprotein is the protein that carries a chain. The question is about the chains themselves.", "Das Glykoprotein ist das Protein, das eine Kette trägt. Gefragt sind die Ketten selbst.")],
  "heads>tails": [tx("Head or tail?", "Kopf oder Schwanz?"), tx("The tails are the lines inside the membrane. The question is about the round parts facing the water.", "Die Schwänze sind die Linien im Inneren der Membran. Gefragt sind die runden Teile, die zum Wasser zeigen.")],
  "tails>heads": [tx("Head or tail?", "Kopf oder Schwanz?"), tx("The heads are the round, polar parts facing the water. The question is about the lines inside.", "Die Köpfe sind die runden, polaren Teile am Wasser. Gefragt sind die Linien im Inneren.")],
  "cholesterol>tails": [tx("Not a fatty acid", "Kein Fettsäurerest"), tx("Fatty acid tails always come in pairs on a head. These small stiff molecules sit between them.", "Fettsäurereste kommen immer paarweise an einem Kopf. Diese kleinen steifen Moleküle sitzen dazwischen.")],
};

function membraneNameTask(rng: Rng): Exercise {
  const id = rng.pick(["channel", "carrier", "glyco", "peripheral", "cholesterol", "sugar", "heads", "tails"]);
  const P = MEMBRANE[id];
  const answer: AnswerSpec = { kind: "word", accept: P.accept, placeholder: tx("name", "Bezeichnung") };
  const m = mistakes(answer);
  for (const [key, [title, say]] of Object.entries(MEM_SAY)) {
    const [a, b] = key.split(">");
    if (a === id) m.add({ kind: "word", accept: MEMBRANE[b].accept }, title, say);
  }
  return {
    instruction: tx("The fluid mosaic model", "Das Flüssig-Mosaik-Modell"),
    text: tx("What is the component with the **?** called?", "Wie heißt der Bestandteil mit dem **?**?"),
    visual: visual(CellMembrane, { mode: "numbers", ask: id, show: [id], legend: "none" }),
    answer,
    hint: tx("Is it a lipid or a protein? Does it span the membrane, sit on it, or form a tunnel?", "Ist es ein Lipid oder ein Protein? Durchspannt es die Membran, sitzt es nur auf, oder bildet es einen Tunnel?"),
    solution: [frame(q(P.name, "n"), tx(`It's the **${en(P.name)}**: ${en(P.job)}.`, `**${de(P.name)}**: ${de(P.job)}.`), ["n"])],
    mistakes: m.list,
  };
}

function membraneMatchTask(rng: Rng): Exercise {
  const pool = ["heads", "tails", "channel", "carrier", "sugar", "cholesterol", "peripheral"];
  const keep = rng.pick([["channel", "carrier"], ["heads", "tails"], []]);
  const rest = rng.shuffle(pool.filter((x) => !keep.includes(x)));
  const used = rng.shuffle([...keep, ...rest.slice(0, 4 - keep.length)]);
  const extra = rest.find((x) => !used.includes(x))!;
  const pairs = used.map((id) => [capT(MEMBRANE[id].name), MEMBRANE[id].job] as [Text, Text]);
  const list: Mistake[] = [];
  if (used.includes("channel") && used.includes("carrier")) list.push(matchMistake([[capT(MEMBRANE.channel.name), MEMBRANE.carrier.job], [capT(MEMBRANE.carrier.name), MEMBRANE.channel.job]], tx("Channel and carrier swapped", "Kanal und Carrier vertauscht"), tx("A channel is an open pore. Binding a substance and changing shape is what a carrier does.", "Ein Kanal ist eine offene Pore. Einen Stoff binden und die Form ändern macht ein Carrier.")));
  if (used.includes("heads") && used.includes("tails")) list.push(matchMistake([[capT(MEMBRANE.heads.name), MEMBRANE.tails.job], [capT(MEMBRANE.tails.name), MEMBRANE.heads.job]], tx("Polar and nonpolar swapped", "Polar und unpolar vertauscht"), tx("Hydrophilic means water-loving: the heads face the water. The hydrophobic tails hide inside.", "Hydrophil heißt wasserliebend: Die Köpfe zeigen zum Wasser. Die hydrophoben Schwänze verstecken sich innen.")));
  return {
    instruction: tx("Components of the biomembrane", "Bestandteile der Biomembran"),
    text: tx("Match each component of the membrane to its feature. One feature is left over.", "Ordne jedem Bestandteil der Membran sein Merkmal zu. Ein Merkmal bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [MEMBRANE[extra].job] },
    hint: tx("Lipids: polar heads, nonpolar tails. Proteins: tunnel, pocket, surface. Sugars: outside only.", "Lipide: polare Köpfe, unpolare Schwänze. Proteine: Tunnel, Tasche, Oberfläche. Zucker: nur außen."),
    solution: used.map((id, i) => frame(join(q(MEMBRANE[id].name, `a${i}`)), tx(`${en(capT(MEMBRANE[id].name))}: ${en(MEMBRANE[id].job)}.`, `${de(MEMBRANE[id].name)}: ${de(MEMBRANE[id].job)}.`))),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Resolution

function resolutionTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const d = rng.pick([
      { nm: 25, what: tx("two ribosomes", "zwei Ribosomen") },
      { nm: 50, what: tx("two neighbouring nuclear pores", "zwei benachbarte Kernporen") },
      { nm: 8, what: tx("the two surfaces of a cell membrane", "die beiden Oberflächen einer Zellmembran") },
      { nm: 120, what: tx("two virus particles", "zwei Viruspartikel") },
      { nm: 1000, what: tx("two mitochondria", "zwei Mitochondrien") },
      { nm: 2000, what: tx("two bacteria", "zwei Bakterien") },
      { nm: 500, what: tx("two chloroplast grana", "zwei Grana eines Chloroplasten") },
    ]);
    const yes = d.nm >= 200;
    const dist = L((l) => (d.nm >= 1000 ? `${n(d.nm / 1000, l)} µm` : `${d.nm} nm`));
    const { answer, mistakes: list } = choice(rng, yes
      ? [
          { text: tx("Yes: the distance is larger than the resolution limit of about 0.2 µm", "Ja: Der Abstand ist größer als die Auflösungsgrenze von etwa 0,2 µm") },
          { text: tx("No: you always need an electron microscope for organelles", "Nein: Für Organellen braucht man immer ein Elektronenmikroskop"), title: tx("Compare with 0.2 µm", "Vergleich mit 0,2 µm"), say: tx("What counts is the distance compared with the resolution limit (about 0.2 µm), not the kind of object.", "Entscheidend ist der Abstand im Vergleich zur Auflösungsgrenze (etwa 0,2 µm), nicht die Art des Objekts.") },
          { text: tx("No: the light microscope only shows living cells", "Nein: Das Lichtmikroskop zeigt nur lebende Zellen"), title: tx("Not the point", "Nicht der Punkt"), say: tx("The light microscope shows dead specimens too. The question is about resolution.", "Das Lichtmikroskop zeigt auch tote Präparate. Die Frage ist die nach der Auflösung.") },
          { text: tx("Only at 5000× magnification", "Nur bei 5000-facher Vergrößerung"), title: tx("Empty magnification", "Leere Vergrößerung"), say: tx("A light microscope can't usefully go beyond about 1000×. And here 1000× is enough anyway.", "Ein Lichtmikroskop vergrößert nicht sinnvoll über etwa 1000-fach. Hier reicht das sowieso.") },
        ]
      : [
          { text: tx("No: the distance is below the resolution limit of about 0.2 µm", "Nein: Der Abstand liegt unter der Auflösungsgrenze von etwa 0,2 µm") },
          { text: tx("Yes: you just have to magnify enough", "Ja: Man muss nur stark genug vergrößern"), title: tx("Empty magnification", "Leere Vergrößerung"), say: tx("More magnification doesn't help: below about 0.2 µm the two points blur into one, however big the image gets.", "Mehr Vergrößerung hilft nicht: Unter etwa 0,2 µm verschwimmen die Punkte zu einem, egal wie groß das Bild wird.") },
          { text: tx("Yes: with oil immersion everything becomes visible", "Ja: Mit Ölimmersion wird alles sichtbar"), title: tx("Still about 0.2 µm", "Immer noch etwa 0,2 µm"), say: tx("Oil immersion helps to reach the limit of about 0.2 µm, but not to go far below it.", "Ölimmersion hilft, die Grenze von etwa 0,2 µm zu erreichen, aber nicht, weit darunter zu kommen.") },
          { text: tx("No: because the specimen would have to be dead", "Nein: weil das Präparat tot sein müsste"), title: tx("Right answer, wrong reason", "Richtige Antwort, falscher Grund"), say: tx("No is right, but the reason is the resolution limit of light, not whether the cells are alive.", "Nein stimmt, aber der Grund ist die Auflösungsgrenze des Lichts, nicht ob die Zellen leben."), close: true },
        ]);
    return {
      instruction: tx("Resolution", "Auflösungsvermögen"),
      text: tx(`${cap1(en(d.what))} are ${en(dist)} apart. Can a light microscope show them as two separate structures?`, `${cap1(de(d.what))} liegen ${de(dist)} auseinander. Kann ein Lichtmikroskop sie als zwei getrennte Strukturen zeigen?`),
      answer,
      hint: tx("Resolution of the light microscope: about 0.2 µm = 200 nm.", "Auflösung des Lichtmikroskops: etwa 0,2 µm = 200 nm."),
      solution: [frame(L((l) => `${d.nm >= 1000 ? `${n(d.nm / 1000, l)} "µm"` : `${d.nm} "nm"`} ${yes ? ">" : "<"} 200#r "nm"`), yes ? tx("Larger than the limit: **yes**, visible as two.", "Größer als die Grenze: **ja**, als zwei erkennbar.") : tx("Smaller than the limit: **no**, they blur into one. Only the electron microscope (about 0.1 nm) separates them.", "Kleiner als die Grenze: **nein**, sie verschwimmen zu einem. Erst das Elektronenmikroskop (etwa 0,1 nm) trennt sie."), ["r"])],
      mistakes: list,
    };
  }
  const v = rng.pick([
    { a: tx("electron microscope (0.1 nm)", "Elektronenmikroskop (0,1 nm)"), b: tx("light microscope (0.2 µm)", "Lichtmikroskop (0,2 µm)"), frac: tx('\\frac{200 "nm"}{0.1 "nm"}', '\\frac{200 "nm"}{0,1 "nm"}'), value: 2000, slip: 2, slipSay: tx("Convert first: 0.2 µm = 200 nm. Then compare with 0.1 nm.", "Erst umrechnen: 0,2 µm = 200 nm. Dann mit 0,1 nm vergleichen.") },
    { a: tx("light microscope (0.2 µm)", "Lichtmikroskop (0,2 µm)"), b: tx("naked eye (0.1 mm)", "bloßes Auge (0,1 mm)"), frac: tx('\\frac{100 "µm"}{0.2 "µm"}', '\\frac{100 "µm"}{0,2 "µm"}'), value: 500, slip: 0.5, slipSay: tx("Convert first: 0.1 mm = 100 µm. Then compare with 0.2 µm.", "Erst umrechnen: 0,1 mm = 100 µm. Dann mit 0,2 µm vergleichen.") },
    { a: tx("electron microscope (0.1 nm)", "Elektronenmikroskop (0,1 nm)"), b: tx("naked eye (0.1 mm)", "bloßes Auge (0,1 mm)"), frac: tx('\\frac{100000 "nm"}{0.1 "nm"}', '\\frac{100000 "nm"}{0,1 "nm"}'), value: 1000000, slip: 1, slipSay: tx("Convert first: 0.1 mm = 100,000 nm. Then compare with 0.1 nm.", "Erst umrechnen: 0,1 mm = 100.000 nm. Dann mit 0,1 nm vergleichen.") },
  ]);
  const answer: AnswerSpec = { kind: "number", value: v.value, unit: "×", tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: v.slip }, tx("Units not converted", "Einheiten nicht umgerechnet"), v.slipSay, true);
  m.add({ kind: "number", value: 1 / v.value, tolerance: 0.001 }, tx("Upside down", "Verkehrt herum"), tx("Better resolution means a smaller limit. Divide the bigger limit by the smaller one.", "Bessere Auflösung heißt kleinere Grenze. Teil die größere Grenze durch die kleinere."));
  return {
    instruction: tx("Resolution", "Auflösungsvermögen"),
    text: tx(`How many times finer is the resolution of the ${en(v.a)} than that of the ${en(v.b)}?`, `Wie viel Mal feiner ist das Auflösungsvermögen beim ${de(v.a)} als beim ${de(v.b).replace(/^bloßes/, "bloßen")}?`),
    answer,
    hint: tx("Bring both limits to the same unit, then divide.", "Bring beide Grenzen auf dieselbe Einheit und teile dann."),
    solution: [frame(join(v.frac, "=", L((l) => `${n(v.value, l)}#r`)), tx(`The limit is **${v.value.toLocaleString("en-GB")}** times smaller.`, `Die Grenze ist **${v.value.toLocaleString("de-DE")}**-mal kleiner.`), ["r"])],
    mistakes: m.list,
  };
}

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Explain (Abitur-style reasoning)

const WHY: { q: Text; opts: Opt[] }[] = [
  {
    q: tx("Lysosomes contain enzymes that work best at pH 5 and can break down almost anything. Why don't they digest the cell itself?", "Lysosomen enthalten Enzyme, die bei pH 5 am besten arbeiten und fast alles abbauen können. Warum verdauen sie nicht die Zelle selbst?"),
    opts: [
      { text: tx("The enzymes are enclosed by a membrane (compartmentalisation), and at the cytoplasm's pH of about 7 they hardly work", "Die Enzyme sind von einer Membran eingeschlossen (Kompartimentierung), und beim pH-Wert des Zellplasmas von etwa 7 arbeiten sie kaum") },
      { text: tx("The enzymes are used up after one reaction", "Die Enzyme werden nach einer Reaktion verbraucht"), title: tx("Enzymes aren't used up", "Enzyme werden nicht verbraucht"), say: tx("Enzymes are catalysts: they come out of each reaction unchanged. The protection comes from the membrane around them.", "Enzyme sind Katalysatoren: Sie gehen unverändert aus jeder Reaktion hervor. Der Schutz kommt von der Membran um sie herum.") },
      { text: tx("Lysosomes only exist in dead cells", "Lysosomen gibt es nur in toten Zellen"), title: tx("Part of living cells", "Teil lebender Zellen"), say: tx("Lysosomes work in living cells every day, recycling old parts.", "Lysosomen arbeiten jeden Tag in lebenden Zellen und recyceln alte Bestandteile.") },
      { text: tx("The cytoplasm is too cold for the enzymes", "Das Zellplasma ist zu kalt für die Enzyme"), title: tx("Same temperature", "Gleiche Temperatur"), say: tx("Inside and outside the lysosome have the same temperature. The difference is the pH and the membrane barrier.", "Innen und außen am Lysosom herrscht dieselbe Temperatur. Der Unterschied ist der pH-Wert und die Membranbarriere.") },
    ],
  },
  {
    q: tx("Why can oxygen and carbon dioxide cross a membrane without any transport protein, while Na⁺ ions can't?", "Warum gelangen Sauerstoff und Kohlenstoffdioxid ohne Transportprotein durch eine Membran, Na⁺-Ionen aber nicht?"),
    opts: [
      { text: tx("O₂ and CO₂ are small and nonpolar and pass the hydrophobic core; ions are charged and surrounded by water", "O₂ und CO₂ sind klein und unpolar und passieren das hydrophobe Innere; Ionen sind geladen und von einer Wasserhülle umgeben") },
      { text: tx("Na⁺ ions are much bigger than gas molecules", "Na⁺-Ionen sind viel größer als Gasmoleküle"), title: tx("Charge, not size", "Ladung, nicht Größe"), say: tx("A Na⁺ ion is tiny. The problem is its charge and water shell, which the hydrophobic interior rejects.", "Ein Na⁺-Ion ist winzig. Das Problem ist seine Ladung mit Wasserhülle, die das hydrophobe Innere abweist.") },
      { text: tx("Gases are pumped through with ATP", "Gase werden mit ATP hindurchgepumpt"), title: tx("Passive", "Passiv"), say: tx("O₂ and CO₂ diffuse passively, no ATP involved.", "O₂ und CO₂ diffundieren passiv, ganz ohne ATP.") },
      { text: tx("The membrane has holes that only gases fit through", "Die Membran hat Löcher, durch die nur Gase passen"), title: tx("No holes", "Keine Löcher"), say: tx("The lipid bilayer has no fixed holes. Small nonpolar molecules dissolve in the lipid layer and pass through it.", "Die Lipiddoppelschicht hat keine festen Löcher. Kleine unpolare Moleküle lösen sich in der Lipidschicht und durchqueren sie.") },
    ],
  },
  {
    q: tx("Why does a plant cell not burst in distilled water, although water keeps flowing in?", "Warum platzt eine Pflanzenzelle in destilliertem Wasser nicht, obwohl Wasser einströmt?"),
    opts: [
      { text: tx("The firm cell wall pushes back against the swelling protoplast (wall pressure balances turgor)", "Die feste Zellwand drückt gegen den schwellenden Protoplasten (Wanddruck gleicht den Turgor aus)") },
      { text: tx("The membrane stops letting water in", "Die Membran lässt kein Wasser mehr herein"), title: tx("The membrane stays open", "Die Membran bleibt durchlässig"), say: tx("The membrane stays permeable to water. The inflow stops because the wall builds up counter-pressure.", "Die Membran bleibt wasserdurchlässig. Der Einstrom endet, weil die Wand Gegendruck aufbaut.") },
      { text: tx("Plant cells pump the water out with contractile vacuoles", "Pflanzenzellen pumpen das Wasser mit pulsierenden Vakuolen hinaus"), title: tx("That's single-celled organisms", "Das machen Einzeller"), say: tx("Contractile vacuoles are found in freshwater single-celled organisms. Land plants rely on their wall.", "Pulsierende Vakuolen gibt es bei Einzellern im Süßwasser. Landpflanzen verlassen sich auf ihre Wand.") },
      { text: tx("Distilled water contains no particles that could get in", "Destilliertes Wasser enthält keine Teilchen, die eindringen könnten"), title: tx("Water does get in", "Wasser dringt sehr wohl ein"), say: tx("Water molecules do flow in, and that's exactly the point: the wall stops the cell from bursting.", "Wassermoleküle strömen sehr wohl ein, genau darum geht es: Die Wand verhindert das Platzen.") },
    ],
  },
  {
    q: tx("Why is plasmolysis used as a test for whether plant cells are alive?", "Warum nutzt man die Plasmolyse als Test, ob Pflanzenzellen leben?"),
    opts: [
      { text: tx("Only a living membrane is semipermeable; in dead cells it lets everything through and no plasmolysis happens", "Nur eine lebende Membran ist semipermeabel; bei toten Zellen lässt sie alles durch, und es kommt zu keiner Plasmolyse") },
      { text: tx("Dead cells have no vacuole", "Tote Zellen haben keine Vakuole"), title: tx("It's the membrane", "Es liegt an der Membran"), say: tx("The vacuole may still be there. What fails in dead cells is the selective permeability of the membrane.", "Die Vakuole kann noch da sein. Was bei toten Zellen versagt, ist die selektive Durchlässigkeit der Membran.") },
      { text: tx("Dead cells have no cell wall", "Tote Zellen haben keine Zellwand"), title: tx("The wall stays", "Die Wand bleibt"), say: tx("Cell walls stay after death (think of cork). It's the membrane that stops working.", "Zellwände bleiben nach dem Tod erhalten (denk an Kork). Es ist die Membran, die nicht mehr funktioniert.") },
      { text: tx("Plasmolysis needs ATP", "Plasmolyse braucht ATP"), title: tx("Osmosis is passive", "Osmose ist passiv"), say: tx("Osmosis is passive and needs no ATP. It needs an intact, semipermeable membrane.", "Osmose ist passiv und braucht kein ATP. Sie braucht eine intakte, semipermeable Membran.") },
    ],
  },
  {
    q: tx("Why do phospholipids in water arrange themselves into a bilayer all by themselves?", "Warum ordnen sich Phospholipide im Wasser ganz von selbst zu einer Doppelschicht an?"),
    opts: [
      { text: tx("The hydrophobic tails avoid water and turn towards each other; the hydrophilic heads face the water on both sides", "Die hydrophoben Schwänze meiden das Wasser und wenden sich einander zu; die hydrophilen Köpfe zeigen auf beiden Seiten zum Wasser") },
      { text: tx("The heads are hydrophobic and stick together in the middle", "Die Köpfe sind hydrophob und kleben in der Mitte zusammen"), title: tx("Heads love water", "Köpfe mögen Wasser"), say: tx("The other way round: the heads are hydrophilic and face the water, the tails are hydrophobic.", "Andersrum: Die Köpfe sind hydrophil und zeigen zum Wasser, die Schwänze sind hydrophob.") },
      { text: tx("Proteins pull them into place using ATP", "Proteine ziehen sie unter ATP-Verbrauch in Position"), title: tx("Self-assembly", "Selbstorganisation"), say: tx("No help needed: the bilayer forms by itself because of the polar and nonpolar parts.", "Keine Hilfe nötig: Die Doppelschicht bildet sich von selbst wegen der polaren und unpolaren Teile.") },
      { text: tx("They are held together by covalent bonds between the molecules", "Sie sind durch Atombindungen zwischen den Molekülen verbunden"), title: tx("Not bonded", "Nicht verbunden"), say: tx("The lipids aren't bonded to each other: that's why the membrane is fluid and they can drift sideways.", "Die Lipide sind nicht miteinander verbunden: Deshalb ist die Membran flüssig, und sie können seitlich wandern.") },
    ],
  },
  {
    q: tx("Why does a slipper animalcule in a pond need contractile vacuoles, while many marine single-celled organisms don't?", "Warum braucht ein Pantoffeltierchen im Teich pulsierende Vakuolen, viele Einzeller im Meer aber nicht?"),
    opts: [
      { text: tx("Pond water is hypotonic to its cytoplasm, so water keeps flowing in by osmosis and must be pumped out", "Teichwasser ist hypotonisch zu seinem Zellplasma, also strömt ständig Wasser durch Osmose ein und muss hinausgepumpt werden") },
      { text: tx("Pond water is hypertonic, so the cell has to take water in", "Teichwasser ist hypertonisch, also muss die Zelle Wasser aufnehmen"), title: tx("The other way round", "Andersrum"), say: tx("Fresh water contains far fewer dissolved particles than the cell: it is hypotonic, water flows in.", "Süßwasser enthält viel weniger gelöste Teilchen als die Zelle: Es ist hypotonisch, Wasser strömt ein.") },
      { text: tx("They digest food in them", "Sie verdauen darin Nahrung"), title: tx("That's food vacuoles", "Das machen Nahrungsvakuolen"), say: tx("Digestion happens in food vacuoles. Contractile vacuoles deal with water.", "Verdaut wird in Nahrungsvakuolen. Pulsierende Vakuolen kümmern sich um Wasser.") },
      { text: tx("Sea water is isotonic only because it is cold", "Meerwasser ist nur isotonisch, weil es kalt ist"), title: tx("Concentration, not temperature", "Konzentration, nicht Temperatur"), say: tx("Tonicity depends on the concentration of dissolved particles. Sea water is salty, close to isotonic for many marine cells.", "Die Tonizität hängt von der Konzentration gelöster Teilchen ab. Meerwasser ist salzig und für viele Meereszellen nahezu isotonisch.") },
    ],
  },
  {
    q: tx("Why is the electron microscope able to show ribosomes, but the light microscope isn't?", "Warum kann das Elektronenmikroskop Ribosomen zeigen, das Lichtmikroskop aber nicht?"),
    opts: [
      { text: tx("Electrons have a much shorter wavelength than light, so the resolution is about 0.1 nm instead of about 0.2 µm", "Elektronen haben eine viel kürzere Wellenlänge als Licht, deshalb liegt die Auflösung bei etwa 0,1 nm statt etwa 0,2 µm") },
      { text: tx("The electron microscope magnifies more", "Das Elektronenmikroskop vergrößert stärker"), title: tx("Resolution, not magnification", "Auflösung, nicht Vergrößerung"), say: tx("Magnifying alone gives no new details. What matters is the resolution, and it depends on the wavelength.", "Vergrößern allein bringt keine neuen Details. Entscheidend ist die Auflösung, und die hängt von der Wellenlänge ab.") },
      { text: tx("Ribosomes are destroyed by light", "Ribosomen werden durch Licht zerstört"), title: tx("Light doesn't harm them", "Licht schadet ihnen nicht"), say: tx("Ribosomes survive light just fine. They are simply smaller than the resolution limit of the light microscope.", "Ribosomen vertragen Licht problemlos. Sie sind einfach kleiner als die Auflösungsgrenze des Lichtmikroskops.") },
      { text: tx("Ribosomes only appear in the vacuum of the electron microscope", "Ribosomen entstehen erst im Vakuum des Elektronenmikroskops"), title: tx("They're always there", "Sie sind immer da"), say: tx("Ribosomes exist in every living cell. The vacuum is just a technical requirement.", "Ribosomen gibt es in jeder lebenden Zelle. Das Vakuum ist nur eine technische Voraussetzung.") },
    ],
  },
];

function whyTask(rng: Rng): Exercise {
  const W = rng.pick(WHY);
  const { answer, mistakes: list } = choice(rng, W.opts);
  return {
    instruction: tx("Give the reason", "Begründe"),
    text: W.q,
    answer,
    hint: tx("Think about the mechanism: particles, membranes, concentrations, energy.", "Denk an den Mechanismus: Teilchen, Membranen, Konzentrationen, Energie."),
    solution: [frame(q(tx("reason", "Begründung"), "g"), W.opts[0].text, ["g"])],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------

export function generate3(rng: Rng): Exercise {
  const shapes: [number, (r: Rng) => Exercise][] = [
    [3, (r) => osmosisTask(r)],
    [1, osmosisPictureTask],
    [2, tonicityTask],
    [2, (r) => transportMatchTask(r)],
    [2, experimentTask],
    [1, uptakeGraphTask],
    [2, pumpTask],
    [2, potatoTask],
    [1, massChangeTask],
    [2, evidenceTask],
    [1, endoOrderTask],
    [1, membraneNameTask],
    [1, membraneMatchTask],
    [2, resolutionTask],
    [2, whyTask],
  ];
  const total = shapes.reduce((s, [w]) => s + w, 0);
  let r = rng.int(1, total);
  for (const [w, f] of shapes) {
    r -= w;
    if (r <= 0) return f(rng);
  }
  return osmosisTask(rng);
}

export const l3 = { osmosisTask, transportMatchTask, evidenceTask };
