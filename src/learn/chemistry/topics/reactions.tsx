"use client";

import type { ComponentType } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { REACTIONS } from "../balancing-core";
import { dec } from "../format";
import { EnergyDiagram, ReactionsEnergy, type EnergyKind } from "../visuals/ReactionsEnergy";
import { PROCESSES, ReactionsSorter } from "../visuals/ReactionsSorter";

// ---------------------------------------------------------------------------
// Helpers: bilingual display sources, word equations, choices with mistakes

/** Build a display source in both languages: m(r => `"${r(name)}" + …`). */
const m = (build: (r: (t: Text) => string, l: "en" | "de") => string): Text => txMap((_, l) => build((t) => resolveText(t, l), l));

/** Quoted word for display maths, optionally keyed. */
const w = (r: (t: Text) => string, t: Text, key?: string) => `"${r(t)}"${key ? `#${key} ` : ""}`;

/** A word equation as display source: "iron"#s0 + "sulfur"#s1 -> "iron sulfide"#s2. */
function wordEq(left: Text[], right: Text[], opts: { keys?: boolean; rightOf?: Text[] } = {}): Text {
  const keys = opts.keys ?? true;
  return m((r) => {
    const side = (list: Text[], o: number) => list.map((s, i) => w(r, s, keys ? `s${o + i}` : undefined)).join(" + ");
    return `${side(left, 0)} -> ${side(right, left.length)}`;
  });
}

/** Plain-text word equation for options and task text: "copper + oxygen → copper oxide". */
const plainEq = (left: Text[], right: Text[]): Text => m((r) => `${left.map(r).join(" + ")} → ${right.map(r).join(" + ")}`);

/** Options in random order; returns the options, the index of the right one and each tagged option's index. */
function arrange<T extends string>(rng: Rng, items: { tag: T; text: Text }[]) {
  const order = rng.shuffle(items);
  const index = (tag: T) => order.findIndex((o) => o.tag === tag);
  return { options: order.map((o) => o.text), index };
}

const choiceMistake = (options: Text[], i: number, title: Text, say: Text, close = false): Mistake => ({ when: { kind: "choice", options, correct: i }, title, say, close });
const multiMistake = (options: Text[], picked: number[], title: Text, say: Text, close = false): Mistake => ({
  when: { kind: "multi", options, correct: [...picked].sort((a, b) => a - b) },
  title,
  say,
  close,
});

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

/** Keep only multi mistakes that differ from the right set and from each other. */
function cleanMulti(right: number[], list: Mistake[]): Mistake[] {
  const out: Mistake[] = [];
  for (const x of list) {
    if (x.when.kind !== "multi" || !x.when.correct.length || sameSet(x.when.correct, right)) continue;
    if (out.some((o) => o.when.kind === "multi" && x.when.kind === "multi" && sameSet(o.when.correct, x.when.correct))) continue;
    out.push(x);
  }
  return out;
}

/** Options of a select-all list read better without the full stop (they're joined with commas in the solution). */
const noDot = (t: Text): Text => (typeof t === "string" ? t.replace(/\.$/, "") : tx(t.en.replace(/\.$/, ""), t.de.replace(/\.$/, "")));

/** A sentence in quotation marks: „…“ in German, “…” in English. */
const quote = (s: string, l: "en" | "de") => (l === "de" ? `„${s.replace(/\.$/, "")}“` : `“${s.replace(/\.$/, "")}”`);

const PHYS = tx("physical change", "physikalischer Vorgang");
const CHEM = tx("chemical reaction", "chemische Reaktion");
const EXO = tx("exothermic", "exotherm");
const ENDO = tx("endothermic", "endotherm");

// ---------------------------------------------------------------------------
// Substances (names in both languages)

const N = {
  copper: tx("copper", "Kupfer"),
  oxygen: tx("oxygen", "Sauerstoff"),
  air: tx("air", "Luft"),
  copperOxide: tx("copper oxide", "Kupferoxid"),
  magnesium: tx("magnesium", "Magnesium"),
  magnesiumOxide: tx("magnesium oxide", "Magnesiumoxid"),
  iron: tx("iron", "Eisen"),
  ironOxide: tx("iron oxide", "Eisenoxid"),
  zinc: tx("zinc", "Zink"),
  hydrochloric: tx("hydrochloric acid", "Salzsäure"),
  zincChloride: tx("zinc chloride", "Zinkchlorid"),
  hydrogen: tx("hydrogen", "Wasserstoff"),
  water: tx("water", "Wasser"),
  silverOxide: tx("silver oxide", "Silberoxid"),
  silver: tx("silver", "Silber"),
  calciumCarbonate: tx("calcium carbonate", "Calciumcarbonat"),
  calciumOxide: tx("calcium oxide", "Calciumoxid"),
  carbonDioxide: tx("carbon dioxide", "Kohlenstoffdioxid"),
  sodium: tx("sodium", "Natrium"),
  chlorine: tx("chlorine", "Chlor"),
  sodiumChloride: tx("sodium chloride", "Natriumchlorid"),
  methane: tx("methane", "Methan"),
  sulfur: tx("sulfur", "Schwefel"),
  ironSulfide: tx("iron sulfide", "Eisensulfid"),
  carbon: tx("carbon", "Kohlenstoff"),
  zincSulfide: tx("zinc sulfide", "Zinksulfid"),
  copperSulfide: tx("copper sulfide", "Kupfersulfid"),
  aluminium: tx("aluminium", "Aluminium"),
  aluminiumOxide: tx("aluminium oxide", "Aluminiumoxid"),
  mercuryOxide: tx("mercury oxide", "Quecksilberoxid"),
  mercury: tx("mercury", "Quecksilber"),
};

// ---------------------------------------------------------------------------
// Level 1: physical change or chemical reaction?

function physOrChem(rng: Rng): Exercise {
  const pr = rng.pick(PROCESSES);
  const options = [PHYS, CHEM];
  const right = pr.chem ? 1 : 0;
  const mistakes: Mistake[] = [
    pr.chem
      ? choiceMistake(
          options,
          0,
          tx("There is a new substance", "Da entsteht ein neuer Stoff"),
          txMap((t, l) => `${t("Look again at what's there afterwards:", "Schau noch mal, was danach da ist:")} ${resolveText(pr.why, l)}`),
        )
      : choiceMistake(
          options,
          1,
          pr.looks ? tx("Looks can deceive", "Der Schein trügt") : tx("No new substance", "Kein neuer Stoff"),
          txMap((t, l) =>
            pr.looks
              ? `${t("Bubbles, light or heat can fool you. Ask: is there a new substance?", "Blasen, Licht oder Wärme können täuschen. Frag dich: Gibt es einen neuen Stoff?")} ${resolveText(pr.why, l)}`
              : `${t("Ask yourself: is there a new substance afterwards?", "Frag dich: Ist danach ein neuer Stoff da?")} ${resolveText(pr.why, l)}`,
          ),
        ),
  ];
  return {
    instruction: tx("Physical or chemical?", "Physikalisch oder chemisch?"),
    text: pr.what,
    answer: { kind: "choice", options, correct: right },
    hint: tx("Only one thing decides: is there a **new substance** with new properties afterwards?", "Nur eins entscheidet: Ist danach ein **neuer Stoff** mit neuen Eigenschaften da?"),
    solution: [
      { math: m((r) => w(r, tx("new substance?", "neuer Stoff?"), "q")), note: pr.what },
      {
        math: m((r) => `${w(r, tx("new substance?", "neuer Stoff?"), "q")} \\quad ${w(r, pr.chem ? tx("yes", "ja") : tx("no", "nein"), "a")} => ${w(r, pr.chem ? CHEM : PHYS, "z")}`),
        note: pr.why,
        highlight: ["z"],
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 1: exothermic or endothermic?

type EnergyCase = { what: Text; exo: boolean; spark?: boolean; why: Text };

const ENERGY_CASES: EnergyCase[] = [
  { what: tx("A candle burns.", "Eine Kerze brennt."), exo: true, spark: true, why: tx("Once lit, it gives off light and heat by itself.", "Einmal angezündet, gibt sie von selbst Licht und Wärme ab.") },
  { what: tx("Natural gas burns on the stove.", "Erdgas verbrennt am Gasherd."), exo: true, spark: true, why: tx("The flame heats the pan: energy is released.", "Die Flamme heizt den Topf: Energie wird frei.") },
  { what: tx("Magnesium ribbon burns with a dazzling light.", "Magnesiumband verbrennt mit grellem Licht."), exo: true, spark: true, why: tx("Light and heat are released.", "Licht und Wärme werden frei.") },
  { what: tx("Iron and sulfur are heated once; the mixture glows on by itself.", "Eisen und Schwefel werden kurz erhitzt, das Gemisch glüht von selbst weiter."), exo: true, spark: true, why: tx("It keeps glowing without a burner: energy is released.", "Es glüht ohne Brenner weiter: Energie wird frei.") },
  { what: tx("A hand warmer: iron powder rusts inside the pad and it gets warm.", "Ein Handwärmer: Eisenpulver rostet im Kissen und es wird warm."), exo: true, why: tx("The pad warms your hands: energy is released.", "Das Kissen wärmt die Hände: Energie wird frei.") },
  { what: tx("A mixture of hydrogen and oxygen explodes with a bang.", "Ein Gemisch aus Wasserstoff und Sauerstoff explodiert mit einem Knall."), exo: true, spark: true, why: tx("Heat, light and a bang: lots of energy is released.", "Wärme, Licht und ein Knall: Viel Energie wird frei.") },
  { what: tx("Zinc reacts with hydrochloric acid and the test tube gets warm.", "Zink reagiert mit Salzsäure und das Reagenzglas wird warm."), exo: true, why: tx("The tube gets warm: energy is released.", "Das Glas wird warm: Energie wird frei.") },
  { what: tx("Wood burns in a campfire.", "Holz verbrennt im Lagerfeuer."), exo: true, spark: true, why: tx("The fire gives off heat and light.", "Das Feuer gibt Wärme und Licht ab.") },
  { what: tx("Water is split into hydrogen and oxygen by an electric current.", "Wasser wird durch elektrischen Strom in Wasserstoff und Sauerstoff zerlegt."), exo: false, why: tx("It only runs while the current flows: energy goes in the whole time.", "Sie läuft nur, solange Strom fließt: Es wird ständig Energie zugeführt.") },
  { what: tx("Silver oxide is heated and breaks down into silver and oxygen.", "Silberoxid wird erhitzt und zerfällt in Silber und Sauerstoff."), exo: false, why: tx("Stop heating and it stops: it needs energy all the time.", "Hörst du auf zu erhitzen, stoppt sie: Sie braucht ständig Energie.") },
  { what: tx("Limestone is heated strongly and turns into quicklime (lime burning).", "Kalkstein wird stark erhitzt und wird zu Branntkalk (Kalkbrennen)."), exo: false, why: tx("The kiln has to stay at about 900 °C the whole time.", "Der Ofen muss die ganze Zeit etwa 900 °C heiß bleiben.") },
  { what: tx("Plants make glucose from carbon dioxide and water using sunlight.", "Pflanzen bilden mit Sonnenlicht Glucose aus Kohlenstoffdioxid und Wasser."), exo: false, why: tx("Photosynthesis needs light energy all the time.", "Die Fotosynthese braucht ständig Lichtenergie.") },
  { what: tx("Blue copper sulfate crystals are heated and turn white as water is driven off.", "Blaue Kupfersulfat-Kristalle werden erhitzt und werden weiß, weil Wasser entweicht."), exo: false, why: tx("Without the burner nothing happens: energy has to go in.", "Ohne Brenner passiert nichts: Energie muss hineingesteckt werden.") },
  { what: tx("Baking soda is heated and gives off carbon dioxide.", "Natron wird erhitzt und gibt Kohlenstoffdioxid ab."), exo: false, why: tx("It only breaks down while it's being heated.", "Es zerfällt nur, solange es erhitzt wird.") },
];

function exoEndo(rng: Rng): Exercise {
  const c = rng.pick(ENERGY_CASES);
  const options = [EXO, ENDO];
  const right = c.exo ? 0 : 1;
  const mistakes: Mistake[] = [
    c.exo
      ? c.spark
        ? choiceMistake(
            options,
            1,
            tx("The start push isn't the point", "Der Startschubs zählt nicht"),
            tx(
              "Ooh, classic trap! It needs a spark or flame to **start**, true. But that's only the activation energy. Once it runs, it releases far more energy than it took.",
              "Die klassische Falle! Zum **Starten** braucht sie einen Funken oder eine Flamme, stimmt. Das ist aber nur die Aktivierungsenergie. Läuft sie erst, gibt sie viel mehr Energie ab, als sie gebraucht hat.",
            ),
          )
        : choiceMistake(
            options,
            1,
            tx("Which way does the energy go?", "In welche Richtung fließt die Energie?"),
            txMap((t, l) => `${t("Think about where the energy goes.", "Überleg, wohin die Energie fließt.")} ${resolveText(c.why, l)}`),
          )
      : choiceMistake(
          options,
          0,
          tx("Energy goes in, not out", "Energie geht rein, nicht raus"),
          txMap((t, l) => `${t("Hmm, does it give off energy by itself? Look again:", "Hm, gibt sie von selbst Energie ab? Schau noch mal:")} ${resolveText(c.why, l)}`),
        ),
  ];
  const flow = c.exo
    ? m((r) => `${w(r, tx("reaction", "Reaktion"), "a")} -> ${w(r, tx("energy to the surroundings", "Energie an die Umgebung"), "b")}`)
    : m((r) => `${w(r, tx("energy from outside", "Energie von außen"), "b")} -> ${w(r, tx("reaction", "Reaktion"), "a")}`);
  return {
    instruction: tx("Exothermic or endothermic?", "Exotherm oder endotherm?"),
    text: c.what,
    answer: { kind: "choice", options, correct: right },
    hint: tx("Is energy released to the surroundings while it runs, or does it have to be supplied the whole time?", "Wird beim Ablauf Energie an die Umgebung abgegeben, oder muss ständig Energie zugeführt werden?"),
    solution: [
      { math: flow, note: c.why },
      {
        math: m((r, l) => `${resolveText(flow, l)} \\quad => ${w(r, c.exo ? EXO : ENDO, "z")}`),
        note: c.exo
          ? c.spark
            ? tx("Energy flows **out**: exothermic. The spark or flame at the start is just the activation energy.", "Energie fließt **heraus**: exotherm. Funke oder Flamme am Anfang sind nur die Aktivierungsenergie.")
            : tx("Energy flows **out**: exothermic.", "Energie fließt **heraus**: exotherm.")
          : tx("Energy has to flow **in** the whole time: endothermic.", "Energie muss ständig **hineinfließen**: endotherm."),
        highlight: ["z"],
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Word equations from the curated reactions: reactants and products

function sidesOf(words: Text) {
  const split = (s: string) => {
    const [l, r] = s.split(" → ");
    return { left: l.split(" + "), right: r.split(" + ") };
  };
  const en = split(resolveText(words, "en"));
  const de = split(resolveText(words, "de"));
  return { left: en.left.map((x, i) => tx(x, de.left[i])), right: en.right.map((x, i) => tx(x, de.right[i])) };
}

const SIMPLE = REACTIONS.filter((r) => !/[(]/.test(resolveText(r.words, "en")) && r.coefs.length >= 3);

function reactantsProducts(rng: Rng): Exercise {
  const rx = rng.pick(SIMPLE);
  const { left, right } = sidesOf(rx.words);
  const askProducts = rng.chance(0.5);
  const all = [...left.map((t, i) => ({ t, side: 0, i })), ...right.map((t, i) => ({ t, side: 1, i: left.length + i }))];
  const order = rng.shuffle(all);
  const options = order.map((o) => o.t);
  const want = askProducts ? 1 : 0;
  const correct = order.map((o, i) => (o.side === want ? i : -1)).filter((i) => i >= 0);
  const others = order.map((o, i) => (o.side !== want ? i : -1)).filter((i) => i >= 0);
  const mistakes = cleanMulti(correct, [
    multiMistake(
      options,
      others,
      tx("Other side of the arrow", "Andere Seite vom Pfeil"),
      askProducts
        ? tx("Those are the reactants: the substances you start with, left of the arrow. The products are what's **new**.", "Das sind die Edukte: die Stoffe, mit denen alles anfängt, links vom Pfeil. Die Produkte sind das, was **neu** entsteht.")
        : tx("Those are the products: what forms, right of the arrow. The reactants are what you **start** with.", "Das sind die Produkte: was entsteht, rechts vom Pfeil. Die Edukte sind die Stoffe, mit denen du **anfängst**."),
    ),
    multiMistake(
      options,
      order.map((_, i) => i),
      tx("Not all of them", "Nicht alle"),
      tx("Every substance is either a reactant **or** a product. The arrow splits them: left or right?", "Jeder Stoff ist entweder Edukt **oder** Produkt. Der Pfeil trennt sie: links oder rechts?"),
    ),
  ]);
  const eq = wordEq(left, right);
  const keys = (side: number) => all.filter((o) => o.side === side).map((o) => `s${o.i}`);
  return {
    instruction: askProducts ? tx("Pick all the products", "Wähle alle Produkte") : tx("Pick all the reactants", "Wähle alle Edukte"),
    text: txMap((t, l) => `${t("Word equation:", "Wortgleichung:")} ${resolveText(rx.words, l)}`),
    answer: { kind: "multi", options, correct },
    hint: tx("Reactants stand **left** of the arrow, products **right** of it.", "Edukte stehen **links** vom Pfeil, Produkte **rechts** davon."),
    solution: [
      { math: eq, note: tx("Read it: the arrow means **react to form**.", "Lies sie: Der Pfeil bedeutet **reagieren zu**.") },
      { math: eq, highlight: keys(0), note: tx("Left of the arrow: the **reactants** (starting substances).", "Links vom Pfeil: die **Edukte** (Ausgangsstoffe).") },
      { math: eq, highlight: keys(1), note: tx("Right of the arrow: the **products** (new substances).", "Rechts vom Pfeil: die **Produkte** (neue Stoffe).") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 1: which of these are chemical reactions? (select all)

function whichReactions(rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const chem = rng.shuffle(PROCESSES.filter((p) => p.chem)).slice(0, rng.int(2, 3));
    const phys = rng.shuffle(PROCESSES.filter((p) => !p.chem)).slice(0, 5 - chem.length);
    if (!phys.some((p) => p.looks) && tries < 19) continue;
    const order = rng.shuffle([...chem, ...phys]);
    const options = order.map((p) => noDot(p.what));
    const correct = order.map((p, i) => (p.chem ? i : -1)).filter((i) => i >= 0);
    const looks = order.map((p, i) => (p.looks ? i : -1)).filter((i) => i >= 0);
    const fire = order.map((p, i) => (p.chem && p.fire ? i : -1)).filter((i) => i >= 0);
    const mistakes = cleanMulti(correct, [
      multiMistake(
        options,
        [...correct, ...looks],
        tx("Fooled by bubbles or light", "Von Blasen oder Licht getäuscht"),
        tx(
          "Nearly! But bubbles, light or heat alone are no proof. Boiling water bubbles and a light bulb glows, and still no new substance forms.",
          "Fast! Aber Blasen, Licht oder Wärme allein sind kein Beweis. Kochendes Wasser blubbert und eine Glühlampe leuchtet, trotzdem entsteht kein neuer Stoff.",
        ),
      ),
      ...(fire.length && fire.length < correct.length
        ? [
            multiMistake(
              options,
              fire,
              tx("Not every reaction burns", "Nicht jede Reaktion brennt"),
              tx("You picked the ones with fire or glow. But slow changes like rusting or milk going sour make new substances too.", "Du hast die mit Feuer oder Glühen gewählt. Aber auch langsame Vorgänge wie Rosten oder sauer werdende Milch bilden neue Stoffe."),
            ),
          ]
        : []),
    ]);
    return {
      instruction: tx("Pick all chemical reactions", "Wähle alle chemischen Reaktionen"),
      answer: { kind: "multi", options, correct },
      hint: tx("For each one ask: is there a **new substance** afterwards?", "Frag bei jedem: Ist danach ein **neuer Stoff** da?"),
      solution: [
        { math: m((r) => w(r, tx("new substance?", "neuer Stoff?"), "q")), note: tx("Go through them one by one: new substance, yes or no?", "Geh sie einzeln durch: neuer Stoff, ja oder nein?") },
        {
          math: m((r) => `${w(r, tx("new substance", "neuer Stoff"), "q")} => ${w(r, CHEM, "z")}`),
          highlight: ["z"],
          note: txMap((t, l) => `${t("Reactions:", "Reaktionen:")} ${chem.map((p) => quote(resolveText(p.what, l), l)).join(", ")}`),
        },
        {
          math: m((r) => `${w(r, tx("same substance", "gleicher Stoff"), "q")} => ${w(r, PHYS, "z")}`),
          highlight: ["z"],
          note: txMap((t, l) => `${t("Physical changes:", "Physikalische Vorgänge:")} ${phys.map((p) => quote(resolveText(p.what, l), l)).join(", ")}`),
        },
      ],
      mistakes,
    };
  }
  return physOrChem(rng);
}

// ---------------------------------------------------------------------------
// Level 2: which word equation fits the experiment?

type Scene = { story: Text; left: Text[]; right: Text[]; air?: boolean; wrongGas?: { at: number; gas: Text; say: Text } };

const SCENES: Scene[] = [
  { story: tx("Copper sheet is heated in the air. It turns black: copper oxide forms.", "Kupferblech wird an der Luft erhitzt. Es wird schwarz: Kupferoxid entsteht."), left: [N.copper, N.oxygen], right: [N.copperOxide], air: true },
  { story: tx("Magnesium ribbon burns in the air with a dazzling light. A white powder is left: magnesium oxide.", "Magnesiumband verbrennt an der Luft mit grellem Licht. Zurück bleibt ein weißes Pulver: Magnesiumoxid."), left: [N.magnesium, N.oxygen], right: [N.magnesiumOxide], air: true },
  { story: tx("Iron wool burns in the air and glows. A blue-black solid forms: iron oxide.", "Eisenwolle verbrennt an der Luft und glüht. Es entsteht ein blauschwarzer Feststoff: Eisenoxid."), left: [N.iron, N.oxygen], right: [N.ironOxide], air: true },
  {
    story: tx("Zinc is put into hydrochloric acid. It fizzes, and the gas burns with a squeaky pop: hydrogen. Zinc chloride stays dissolved.", "Zink wird in Salzsäure gegeben. Es sprudelt, und das Gas verbrennt mit einem Knall: Wasserstoff. Zinkchlorid bleibt gelöst."),
    left: [N.zinc, N.hydrochloric],
    right: [N.zincChloride, N.hydrogen],
    wrongGas: { at: 1, gas: N.oxygen, say: tx("A squeaky pop is the test for **hydrogen**. Oxygen would make a glowing splint flare up.", "Ein Knall bei der Knallgasprobe zeigt **Wasserstoff**. Sauerstoff würde einen glimmenden Span aufflammen lassen.") },
  },
  { story: tx("Hydrogen burns in the air. Droplets of water form on a cold glass held above the flame.", "Wasserstoff verbrennt an der Luft. An einem kalten Glas über der Flamme bilden sich Wassertröpfchen."), left: [N.hydrogen, N.oxygen], right: [N.water], air: true },
  {
    story: tx("Silver oxide is heated strongly. Silver is left, and a glowing splint held in the gas flares up.", "Silberoxid wird stark erhitzt. Silber bleibt zurück, und ein glimmender Holzspan flammt im Gas auf."),
    left: [N.silverOxide],
    right: [N.silver, N.oxygen],
    wrongGas: { at: 1, gas: N.hydrogen, say: tx("A glowing splint flaring up is the test for **oxygen**. Hydrogen would give a squeaky pop.", "Ein aufflammender Glimmspan zeigt **Sauerstoff**. Wasserstoff würde mit einem Knall verbrennen.") },
  },
  { story: tx("Limestone (calcium carbonate) is heated strongly. Quicklime (calcium oxide) and carbon dioxide form.", "Kalkstein (Calciumcarbonat) wird stark erhitzt. Es entstehen Branntkalk (Calciumoxid) und Kohlenstoffdioxid."), left: [N.calciumCarbonate], right: [N.calciumOxide, N.carbonDioxide] },
  { story: tx("Hot sodium is held in chlorine gas. It burns, and white crystals form: sodium chloride.", "Heißes Natrium wird in Chlorgas gehalten. Es verbrennt, und weiße Kristalle entstehen: Natriumchlorid."), left: [N.sodium, N.chlorine], right: [N.sodiumChloride] },
  { story: tx("Natural gas (methane) burns on the stove. Carbon dioxide and water vapour form.", "Erdgas (Methan) verbrennt am Gasherd. Es entstehen Kohlenstoffdioxid und Wasserdampf."), left: [N.methane, N.oxygen], right: [N.carbonDioxide, N.water], air: true },
  { story: tx("Iron powder and sulfur are heated together. The mixture glows and iron sulfide forms.", "Eisenpulver und Schwefel werden zusammen erhitzt. Das Gemisch glüht auf und Eisensulfid entsteht."), left: [N.iron, N.sulfur], right: [N.ironSulfide] },
  { story: tx("Charcoal (carbon) glows in the barbecue. Carbon dioxide forms.", "Holzkohle (Kohlenstoff) verglüht im Grill. Es entsteht Kohlenstoffdioxid."), left: [N.carbon, N.oxygen], right: [N.carbonDioxide], air: true },
  { story: tx("An electric current splits water. Two gases bubble up: hydrogen and oxygen.", "Elektrischer Strom zerlegt Wasser. Zwei Gase perlen auf: Wasserstoff und Sauerstoff."), left: [N.water], right: [N.hydrogen, N.oxygen] },
];

function whichWordEquation(rng: Rng): Exercise {
  const sc = rng.pick(SCENES);
  type Tag = "ok" | "reversed" | "air" | "noReactant" | "noProduct" | "gas";
  const items: { tag: Tag; text: Text }[] = [
    { tag: "ok", text: plainEq(sc.left, sc.right) },
    { tag: "reversed", text: plainEq(sc.right, sc.left) },
  ];
  const extra: { tag: Tag; text: Text }[] = [];
  if (sc.air) extra.push({ tag: "air", text: plainEq(sc.left.map((s) => (s === N.oxygen ? N.air : s)), sc.right) });
  if (sc.left.length > 1) extra.push({ tag: "noReactant", text: plainEq(sc.left.slice(0, 1), sc.right) });
  if (sc.right.length > 1) extra.push({ tag: "noProduct", text: plainEq(sc.left, sc.right.slice(0, 1)) });
  if (sc.wrongGas) extra.push({ tag: "gas", text: plainEq(sc.left, sc.right.map((s, i) => (i === sc.wrongGas!.at ? sc.wrongGas!.gas : s))) });
  items.push(...rng.shuffle(extra).slice(0, 2));
  const { options, index } = arrange(rng, items);
  const say: Record<Tag, [Text, Text]> = {
    ok: [tx("", ""), tx("", "")],
    reversed: [
      tx("Arrow the wrong way", "Pfeil falsch herum"),
      tx("That's backwards! The arrow points from the starting substances to the new ones. What did you start with?", "Andersrum! Der Pfeil zeigt von den Ausgangsstoffen zu den neuen Stoffen. Womit hat alles angefangen?"),
    ],
    air: [
      tx("Air isn't a reactant", "Luft ist kein Edukt"),
      tx("Air is a mixture, not one substance. Only the **oxygen** in the air takes part, so that's what goes into the equation.", "Luft ist ein Gemisch, kein einzelner Stoff. Nur der **Sauerstoff** der Luft reagiert mit, und der gehört in die Gleichung."),
    ],
    noReactant: [
      tx("A reactant is missing", "Ein Edukt fehlt"),
      tx("Something's missing on the left. The product can only contain what was there before: which substance reacts too?", "Links fehlt etwas. Im Produkt kann nur stecken, was vorher schon da war: Welcher Stoff reagiert noch mit?"),
    ],
    noProduct: [
      tx("A product is missing", "Ein Produkt fehlt"),
      tx("Read the experiment again: more than one new substance forms.", "Lies den Versuch noch mal: Es entsteht mehr als ein neuer Stoff."),
    ],
    gas: [tx("Check the gas test", "Prüf den Gasnachweis"), sc.wrongGas?.say ?? tx("", "")],
  };
  const mistakes = items.filter((i) => i.tag !== "ok").map((i) => choiceMistake(options, index(i.tag), say[i.tag][0], say[i.tag][1]));
  const eq = wordEq(sc.left, sc.right);
  return {
    instruction: tx("Pick the right word equation", "Wähle die passende Wortgleichung"),
    text: sc.story,
    answer: { kind: "choice", options, correct: index("ok") },
    hint: sc.air
      ? tx("Starting substances left, new substances right. And air is a mixture: what in it reacts?", "Ausgangsstoffe links, neue Stoffe rechts. Und Luft ist ein Gemisch: Was davon reagiert?")
      : tx("Starting substances left, new substances right. Which substances does the experiment mention?", "Ausgangsstoffe links, neue Stoffe rechts. Welche Stoffe kommen im Versuch vor?"),
    solution: [
      { math: m((r) => sc.left.map((s, i) => w(r, s, `s${i}`)).join(" + ")), note: tx("First the reactants: what do you start with?", "Zuerst die Edukte: Womit fängst du an?") },
      { math: eq, highlight: sc.right.map((_, i) => `s${sc.left.length + i}`), note: tx("Then the arrow and the new substances, the products.", "Dann der Pfeil und die neuen Stoffe, die Produkte.") },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 2: name the product of a metal and a non-metal

type Metal = { en: string; de: string; with: string[] };
const METALS: Metal[] = [
  { en: "sodium", de: "Natrium", with: ["Cl", "Br", "S"] },
  { en: "magnesium", de: "Magnesium", with: ["O", "S", "Cl"] },
  { en: "calcium", de: "Calcium", with: ["O", "Cl"] },
  { en: "zinc", de: "Zink", with: ["O", "S", "Cl"] },
  { en: "aluminium", de: "Aluminium", with: ["O", "Br", "I", "Cl"] },
  { en: "potassium", de: "Kalium", with: ["Cl", "Br", "I"] },
  { en: "lithium", de: "Lithium", with: ["O", "Cl"] },
];
const NONMETALS: Record<string, { name: Text; ide: Text; ate?: Text }> = {
  O: { name: tx("oxygen", "Sauerstoff"), ide: tx("oxide", "oxid") },
  S: { name: tx("sulfur", "Schwefel"), ide: tx("sulfide", "sulfid"), ate: tx("sulfate", "sulfat") },
  Cl: { name: tx("chlorine", "Chlor"), ide: tx("chloride", "chlorid"), ate: tx("chlorate", "chlorat") },
  Br: { name: tx("bromine", "Brom"), ide: tx("bromide", "bromid"), ate: tx("bromate", "bromat") },
  I: { name: tx("iodine", "Iod"), ide: tx("iodide", "iodid"), ate: tx("iodate", "iodat") },
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

function nameProduct(rng: Rng): Exercise {
  const metal = rng.pick(METALS);
  const nm = NONMETALS[rng.pick(metal.with)];
  const M = tx(metal.en, metal.de);
  const de = (t: Text) => resolveText(t, "de");
  const en = (t: Text) => resolveText(t, "en");
  const product = tx(`${metal.en} ${en(nm.ide)}`, `${metal.de}${de(nm.ide)}`);
  const accept: Text[] = [product];
  if (metal.en === "aluminium") accept.push(`aluminum ${en(nm.ide)}`);
  const example = nm === NONMETALS.O ? NONMETALS.Cl : NONMETALS.O;
  const mistakes: Mistake[] = [
    {
      when: { kind: "word", accept: [tx(`${metal.en} ${en(nm.name)}`, `${metal.de}${de(nm.name).toLowerCase()}`)] },
      title: tx("The -ide ending", "Die Endung -id"),
      say: tx(
        `Nearly! In the name of the product, the non-metal gets the ending **-ide**. For example, ${en(example.name)} becomes ${en(example.ide)}.`,
        `Fast! Im Namen des Produkts bekommt das Nichtmetall die Endung **-id**. Aus ${de(example.name)} wird zum Beispiel ${cap(de(example.ide))}.`,
      ),
      close: true,
    },
    {
      when: { kind: "word", accept: [M] },
      title: tx("That's a reactant", "Das ist ein Edukt"),
      say: tx("That's a substance you started with. The product is a **new** substance made from both elements.", "Das ist ein Stoff, mit dem du angefangen hast. Das Produkt ist ein **neuer** Stoff aus beiden Elementen."),
    },
  ];
  if (nm.ate) {
    mistakes.push({
      when: { kind: "word", accept: [tx(`${metal.en} ${en(nm.ate)}`, `${metal.de}${de(nm.ate)}`)] },
      title: tx("-ate means extra oxygen", "-at heißt: mit Sauerstoff"),
      say: tx(
        "The ending **-ate** means there's oxygen in it too (like sulfate, $\\ce{SO4^2-}$). Here only the two elements react, so it gets a different ending.",
        "Die Endung **-at** heißt: Da steckt noch Sauerstoff drin (wie bei Sulfat, $\\ce{SO4^2-}$). Hier reagieren nur die beiden Elemente, also passt eine andere Endung.",
      ),
    });
  }
  return {
    instruction: tx("Name the product", "Benenne das Produkt"),
    math: m((r) => `${w(r, tx(cap(metal.en), metal.de))} + ${w(r, tx(cap(en(nm.name)), de(nm.name)))} -> ?`),
    answer: { kind: "word", accept, placeholder: tx("name of the product", "Name des Produkts") },
    hint: tx("Metal name first, then the non-metal with the ending **-ide** (oxygen → oxide).", "Erst der Metallname, dann das Nichtmetall mit der Endung **-id** (Sauerstoff → oxid)."),
    solution: [
      { math: m((r) => `${w(r, tx(cap(metal.en), metal.de), "a")} + ${w(r, tx(cap(en(nm.name)), de(nm.name)), "b")} -> "?"#c `), note: tx("A metal and a non-metal react: a salt forms.", "Ein Metall und ein Nichtmetall reagieren: Es entsteht ein Salz.") },
      {
        math: m((r) => `${w(r, tx(cap(metal.en), metal.de), "a")} + ${w(r, tx(cap(en(nm.name)), de(nm.name)), "b")} -> ${w(r, tx(cap(en(product)), de(product)), "c")}`),
        highlight: ["c"],
        note: tx(`Metal name + non-metal with **-ide**: ${en(nm.name)} → ${en(nm.ide)}.`, `Metallname + Nichtmetall mit **-id**: ${de(nm.name)} → ${de(nm.ide)}.`),
      },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 2/3: law of conservation of mass

type MassRx = { left: Text[]; right: Text[]; m: number[]; ks: number[]; closed?: boolean };
const MASS: MassRx[] = [
  { left: [N.iron, N.sulfur], right: [N.ironSulfide], m: [7, 4, 11], ks: [0.5, 1, 2, 3] },
  { left: [N.zinc, N.sulfur], right: [N.zincSulfide], m: [6.5, 3.2, 9.7], ks: [1, 2] },
  { left: [N.copper, N.sulfur], right: [N.copperSulfide], m: [6.4, 1.6, 8], ks: [0.5, 1, 2] },
  { left: [N.magnesium, N.oxygen], right: [N.magnesiumOxide], m: [2.4, 1.6, 4], ks: [1, 2, 3, 0.5] },
  { left: [N.carbon, N.oxygen], right: [N.carbonDioxide], m: [3, 8, 11], ks: [1, 2, 0.5], closed: true },
  { left: [N.hydrogen, N.oxygen], right: [N.water], m: [1, 8, 9], ks: [2, 3, 4], closed: true },
  { left: [N.aluminium, N.oxygen], right: [N.aluminiumOxide], m: [5.4, 4.8, 10.2], ks: [0.5, 1, 2] },
  { left: [N.calciumCarbonate], right: [N.calciumOxide, N.carbonDioxide], m: [10, 5.6, 4.4], ks: [1, 2, 5], closed: true },
  { left: [N.silverOxide], right: [N.silver, N.oxygen], m: [23.2, 21.6, 1.6], ks: [0.5, 1, 2], closed: true },
  { left: [N.mercuryOxide], right: [N.mercury, N.oxygen], m: [21.7, 20.1, 1.6], ks: [1, 2], closed: true },
];

const r2 = (v: number) => Math.round(v * 100) / 100;
const g = (v: number, l: "en" | "de") => dec(v, l, 2);

function massTask(rng: Rng, level: Level): Exercise {
  const rx = rng.pick(level === 3 ? MASS : MASS.filter((x) => x.left.length === 2));
  const k = rng.pick(rx.ks);
  const ms = rx.m.map((x) => r2(x * k));
  const names = [...rx.left, ...rx.right];
  const synth = rx.left.length === 2;
  // Unknown: in a synthesis the product (L2) or a reactant; in a decomposition one of the products.
  const unknown = synth ? (level === 2 && rng.chance(0.55) ? 2 : rng.pick([0, 1])) : rng.pick([1, 2]);
  const value = ms[unknown];
  const known = [0, 1, 2].filter((i) => i !== unknown);
  const where = rx.closed ? tx(" in a closed vessel", " in einem geschlossenen Gefäß") : tx("", "");
  const text = txMap((t, l) => {
    const n = (i: number) => resolveText(names[i], l);
    const gg = (i: number) => `${g(ms[i], l)} g`;
    const W = resolveText(where, l);
    if (synth && unknown === 2) return t(`${gg(0)} of ${n(0)} react completely with ${gg(1)} of ${n(1)}${W}. How much ${n(2)} forms?`, `${gg(0)} ${n(0)} reagieren${W} vollständig mit ${gg(1)} ${n(1)}. Wie viel ${n(2)} entsteht?`);
    if (synth) {
      const o = unknown === 0 ? 1 : 0;
      return t(`${gg(o)} of ${n(o)} react completely${W} and form ${gg(2)} of ${n(2)}. How much ${n(unknown)} has reacted?`, `${gg(o)} ${n(o)} reagieren${W} vollständig und bilden ${gg(2)} ${n(2)}. Wie viel ${n(unknown)} hat reagiert?`);
    }
    const o = unknown === 1 ? 2 : 1;
    return t(`${gg(0)} of ${n(0)} are heated${W} and break down completely. ${gg(o)} of ${n(o)} form. How much ${n(unknown)} forms?`, `${gg(0)} ${n(0)} werden${W} erhitzt und zerfallen vollständig. Es entstehen ${gg(o)} ${n(o)}. Wie viel ${n(unknown)} entsteht?`);
  });

  const mistakes: Mistake[] = [];
  const addM = (v: number, title: Text, say: Text) => {
    v = r2(v);
    if (v <= 0 || Math.abs(v - value) < 1e-6 || mistakes.some((x) => x.when.kind === "number" && Math.abs(x.when.value - v) < 1e-6)) return;
    mistakes.push({ when: { kind: "number", value: v, tolerance: 0.001, unit: "g" }, title, say });
  };
  const nm = (i: number) => names[i];
  if (synth && unknown === 2) {
    addM(Math.abs(ms[0] - ms[1]), tx("Subtracted instead of added", "Subtrahiert statt addiert"), tx("You subtracted, but nothing gets lost: **all** the atoms of both reactants end up in the product. So their masses add up.", "Du hast subtrahiert, aber nichts geht verloren: **Alle** Atome beider Edukte stecken im Produkt. Also addieren sich ihre Massen."));
    addM(ms[0], tx("Only one reactant counted", "Nur ein Edukt gezählt"), txMap((t, l) => t(`The product contains **both** reactants: ${resolveText(nm(0), l)} and ${resolveText(nm(1), l)}. Both masses count.`, `Im Produkt stecken **beide** Edukte: ${resolveText(nm(0), l)} und ${resolveText(nm(1), l)}. Beide Massen zählen.`)));
  } else if (synth) {
    const o = unknown === 0 ? 1 : 0;
    addM(ms[o] + ms[2], tx("Added instead of subtracted", "Addiert statt subtrahiert"), txMap((t, l) => t(`Ah, you added. But the product (${resolveText(nm(2), l)}) already **contains** the ${resolveText(nm(o), l)}. What's missing is the difference.`, `Ah, du hast addiert. Aber im Produkt (${resolveText(nm(2), l)}) **steckt** ${resolveText(nm(o), l)} schon drin. Was fehlt, ist die Differenz.`)));
    addM(ms[2], tx("That's the product", "Das ist das Produkt"), tx("That's the mass of the product. The question asks how much of one reactant reacted.", "Das ist die Masse des Produkts. Gefragt ist, wie viel von einem Edukt reagiert hat."));
  } else {
    const o = unknown === 1 ? 2 : 1;
    addM(ms[0] + ms[o], tx("Added instead of subtracted", "Addiert statt subtrahiert"), txMap((t, l) => t(`You added. But both products together weigh exactly as much as the reactant (${resolveText(nm(0), l)}) at the start. The missing one is what's left over.`, `Du hast addiert. Aber beide Produkte zusammen wiegen genau so viel wie das Edukt (${resolveText(nm(0), l)}) am Anfang. Das fehlende Produkt ist der Rest.`)));
    addM(ms[0], tx("That's the starting mass", "Das ist die Ausgangsmasse"), tx("That's the mass you started with. It splits up between **both** products.", "Das ist die Masse am Anfang. Sie verteilt sich auf **beide** Produkte."));
  }

  const before = tx("before", "vorher");
  const after = tx("after", "nachher");
  const sumLine = m((_, l) => {
    const side = (idx: number[]) => idx.map((i) => (i === unknown ? "m#x " : `${g(ms[i], l)}#n${i} "g"#u${i} `)).join(" + ");
    return synth ? `${side([0, 1])} = ${side([2])}` : `${side([0])} = ${side([1, 2])}`;
  });
  const solved = m((_, l) => {
    const [a, b] = known;
    const total = synth ? (unknown === 2 ? null : 2) : 0;
    if (total === null) return `m#x = ${g(ms[a], l)}#n${a} "g"#u${a} + ${g(ms[b], l)}#n${b} "g"#u${b} = ${g(value, l)}#v "g"#uv`;
    const other = known.find((i) => i !== total)!;
    return `m#x = ${g(ms[total], l)}#n${total} "g"#u${total} - ${g(ms[other], l)}#n${other} "g"#u${other} = ${g(value, l)}#v "g"#uv`;
  });
  return {
    instruction: tx("Use the law of conservation of mass", "Nutze das Gesetz von der Erhaltung der Masse"),
    text,
    answer: { kind: "number", value, tolerance: 0.001, unit: "g" },
    hint: tx("Total mass before = total mass after. Atoms are only rearranged.", "Gesamtmasse vorher = Gesamtmasse nachher. Die Atome werden nur umgruppiert."),
    solution: [
      { math: m((r) => `m_{${w(r, before)}} = m_{${w(r, after)}}`), note: tx("Nothing gets lost and nothing is added: the total mass stays the same.", "Nichts geht verloren und nichts kommt dazu: Die Gesamtmasse bleibt gleich.") },
      { math: sumLine, note: txMap((t, l) => `${t("Write it down for", "Aufgeschrieben für")} ${resolveText(plainEq(rx.left, rx.right), l)}.`) },
      { math: solved, highlight: ["v"], note: txMap((t, l) => `${t("So", "Also")} ${g(value, l)} g ${resolveText(names[unknown], l)}.`) },
    ],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Level 2/3: energy diagrams

const diagram = (props: Record<string, unknown>) => ({ component: EnergyDiagram as unknown as ComponentType<Record<string, unknown>>, props });

function diagramKind(rng: Rng): Exercise {
  const kind: EnergyKind = rng.chance(0.5) ? "exo" : "endo";
  const options = [EXO, ENDO];
  const right = kind === "exo" ? 0 : 1;
  return {
    instruction: tx("Read the energy diagram", "Lies das Energiediagramm"),
    text: tx("Is the reaction in this energy diagram exothermic or endothermic?", "Ist die Reaktion in diesem Energiediagramm exotherm oder endotherm?"),
    visual: diagram({ kind }),
    answer: { kind: "choice", options, correct: right },
    hint: tx("Compare the levels: are the products higher or lower than the reactants?", "Vergleiche die Stufen: Liegen die Produkte höher oder tiefer als die Edukte?"),
    solution: [
      {
        math: kind === "exo" ? m((r) => `E_{${w(r, tx("products", "Produkte"))}} < E_{${w(r, tx("reactants", "Edukte"))}}`) : m((r) => `E_{${w(r, tx("products", "Produkte"))}} > E_{${w(r, tx("reactants", "Edukte"))}}`),
        note: kind === "exo" ? tx("The products sit **lower** than the reactants.", "Die Produkte liegen **tiefer** als die Edukte.") : tx("The products sit **higher** than the reactants.", "Die Produkte liegen **höher** als die Edukte."),
      },
      {
        math: m((r) => `${w(r, kind === "exo" ? tx("energy is released", "Energie wird frei") : tx("energy is taken in", "Energie wird aufgenommen"))} => ${w(r, kind === "exo" ? EXO : ENDO, "z")}`),
        highlight: ["z"],
        note: kind === "exo" ? tx("The difference ΔE goes to the surroundings: **exothermic**.", "Den Unterschied ΔE gibt die Reaktion an die Umgebung ab: **exotherm**.") : tx("The difference ΔE comes from the surroundings: **endothermic**.", "Den Unterschied ΔE nimmt die Reaktion aus der Umgebung auf: **endotherm**."),
      },
    ],
    mistakes: [
      choiceMistake(
        options,
        1 - right,
        tx("Look at start and end", "Schau auf Anfang und Ende"),
        tx("The hill in the middle doesn't decide it, that's the activation energy. Compare where the curve **starts** and where it **ends**.", "Der Berg in der Mitte entscheidet das nicht, das ist die Aktivierungsenergie. Vergleich, wo die Kurve **anfängt** und wo sie **endet**."),
      ),
    ],
  };
}

function diagramArrow(rng: Rng): Exercise {
  const kind: EnergyKind = rng.chance(0.5) ? "exo" : "endo";
  const eaFirst = rng.chance(0.5);
  const labels = { ea: eaFirst ? "A" : "B", de: eaFirst ? "B" : "A" };
  const askEa = rng.chance(0.6);
  const options = [tx("arrow A", "Pfeil A"), tx("arrow B", "Pfeil B")];
  const want = askEa ? labels.ea : labels.de;
  const right = want === "A" ? 0 : 1;
  return {
    instruction: tx("Read the energy diagram", "Lies das Energiediagramm"),
    text: askEa ? tx("Which arrow shows the **activation energy**?", "Welcher Pfeil zeigt die **Aktivierungsenergie**?") : tx("Which arrow shows the energy that is released or taken in (**ΔE**)?", "Welcher Pfeil zeigt die Energie, die frei oder aufgenommen wird (**ΔE**)?"),
    visual: diagram({ kind, labels }),
    answer: { kind: "choice", options, correct: right },
    hint: askEa ? tx("The activation energy is the start push: from the reactants up to the top of the hill.", "Die Aktivierungsenergie ist der Startschubs: von den Edukten bis hoch zum Gipfel.") : tx("ΔE compares the start and the end: reactants versus products.", "ΔE vergleicht Anfang und Ende: Edukte mit Produkten."),
    solution: [
      { math: m((r) => `E_A: ${w(r, tx("reactants", "Edukte"))} -> ${w(r, tx("top of the hill", "Gipfel"))}`), note: txMap((t) => `${t("The activation energy goes from the reactants up to the top:", "Die Aktivierungsenergie reicht von den Edukten bis zum Gipfel:")} ${t("arrow", "Pfeil")} ${labels.ea}.`) },
      { math: m((r) => `\\Delta E: ${w(r, tx("reactants", "Edukte"))} -> ${w(r, tx("products", "Produkte"))}`), note: txMap((t) => `${t("ΔE is the difference between reactants and products:", "ΔE ist der Unterschied zwischen Edukten und Produkten:")} ${t("arrow", "Pfeil")} ${labels.de}.`) },
    ],
    mistakes: [
      choiceMistake(
        options,
        1 - right,
        askEa ? tx("That's ΔE", "Das ist ΔE") : tx("That's the activation energy", "Das ist die Aktivierungsenergie"),
        askEa
          ? tx("That arrow compares the reactants with the products: that's ΔE. The activation energy is the **hill**: from the reactants up to the top.", "Dieser Pfeil vergleicht Edukte und Produkte: Das ist ΔE. Die Aktivierungsenergie ist der **Berg**: von den Edukten bis zum Gipfel.")
          : tx("That arrow goes up the hill: that's the activation energy, the start push. ΔE only compares the start and end levels.", "Dieser Pfeil geht den Berg hinauf: Das ist die Aktivierungsenergie, der Startschubs. ΔE vergleicht nur Anfangs- und Endstufe."),
      ),
    ],
  };
}

function diagramCatalyst(rng: Rng): Exercise {
  const kind: EnergyKind = rng.chance(0.5) ? "exo" : "endo";
  const catFirst = rng.chance(0.5);
  const tags: [string, string] = catFirst ? ["2", "1"] : ["1", "2"];
  const options = [tx("curve 1", "Kurve 1"), tx("curve 2", "Kurve 2")];
  const right = catFirst ? 0 : 1;
  return {
    instruction: tx("Read the energy diagram", "Lies das Energiediagramm"),
    text: tx("The same reaction once with and once without a catalyst. Which curve shows the reaction **with** a catalyst?", "Dieselbe Reaktion einmal mit und einmal ohne Katalysator. Welche Kurve zeigt die Reaktion **mit** Katalysator?"),
    visual: diagram({ kind, tags, catalyst: true }),
    answer: { kind: "choice", options, correct: right },
    hint: tx("What does a catalyst change: the hill, or the levels at the start and end?", "Was verändert ein Katalysator: den Berg oder die Stufen am Anfang und Ende?"),
    solution: [
      { math: m((r) => `E_A ${w(r, tx("with catalyst", "mit Katalysator"))} < E_A ${w(r, tx("without", "ohne"))}`), note: tx("A catalyst lowers the activation energy: the hill gets lower.", "Ein Katalysator senkt die Aktivierungsenergie: Der Berg wird niedriger.") },
      { math: m((r) => `\\Delta E ${w(r, tx("stays the same", "bleibt gleich"))}`), note: txMap((t) => `${t("Start and end stay where they are. The lower hill is", "Anfang und Ende bleiben, wo sie sind. Der niedrigere Berg ist")} ${t("curve", "Kurve")} ${catFirst ? "1" : "2"}.`) },
    ],
    mistakes: [
      choiceMistake(
        options,
        1 - right,
        tx("The catalyst lowers the hill", "Der Katalysator senkt den Berg"),
        tx("The other way round! A catalyst doesn't add energy, it opens an easier path. So its hill is the **lower** one.", "Andersrum! Ein Katalysator bringt keine Energie mit, er öffnet einen leichteren Weg. Sein Berg ist also der **niedrigere**."),
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 2: synthesis or decomposition?

const KIND_TASKS = REACTIONS.filter((r) => (r.kind === "synthesis" || r.kind === "metal-oxygen") ? r.eq.split("->")[1].split(" + ").length === 1 : r.kind === "decomposition");

function synthesisOrAnalysis(rng: Rng): Exercise {
  const rx = rng.pick(KIND_TASKS);
  const { left, right } = sidesOf(rx.words);
  const synth = right.length === 1;
  const options = [tx("Synthesis: substances combine into one", "Synthese: Stoffe vereinigen sich zu einem"), tx("Decomposition: one substance breaks down", "Analyse: Ein Stoff wird zerlegt")];
  const eq = wordEq(left, right);
  return {
    instruction: tx("Synthesis or decomposition?", "Synthese oder Analyse?"),
    text: rx.words,
    answer: { kind: "choice", options, correct: synth ? 0 : 1 },
    hint: tx("Count: how many substances on the left, how many on the right?", "Zähl: Wie viele Stoffe stehen links, wie viele rechts?"),
    solution: [
      {
        math: eq,
        highlight: left.map((_, i) => `s${i}`),
        note: synth ? tx(`Left: ${left.length} reactants.`, `Links: ${left.length} Edukte.`) : tx("Left: only **one** reactant.", "Links: nur **ein** Edukt."),
      },
      {
        math: eq,
        highlight: right.map((_, i) => `s${left.length + i}`),
        note: synth
          ? tx("Right: **one** product. Several substances combine into one: a **synthesis**.", "Rechts: **ein** Produkt. Mehrere Stoffe vereinigen sich zu einem: eine **Synthese**.")
          : tx(`Right: ${right.length} products. One substance breaks down: a **decomposition** (analysis).`, `Rechts: ${right.length} Produkte. Ein Stoff wird zerlegt: eine **Analyse** (Zerlegung).`),
      },
    ],
    mistakes: [
      choiceMistake(
        options,
        synth ? 1 : 0,
        tx("Look at the arrow's direction", "Achte auf die Pfeilrichtung"),
        synth
          ? tx("Here several substances on the left turn into **one** product. That's building something up, not breaking it down.", "Hier werden mehrere Stoffe links zu **einem** Produkt. Das ist Aufbauen, nicht Zerlegen.")
          : tx("Here **one** substance on the left splits into several. That's breaking down, not building up.", "Hier zerfällt **ein** Stoff links in mehrere. Das ist Zerlegen, nicht Aufbauen."),
      ),
    ],
  };
}

// ---------------------------------------------------------------------------
// Level 3: catalysts (select all), reverse reactions, energy amounts, activation energy

const CAT_TRUE: Text[] = [
  tx("It lowers the activation energy.", "Er senkt die Aktivierungsenergie."),
  tx("It is still there, unchanged, after the reaction.", "Er liegt nach der Reaktion unverändert vor."),
  tx("It makes the reaction run faster.", "Er beschleunigt die Reaktion."),
  tx("Enzymes in your body are catalysts too.", "Enzyme in deinem Körper sind auch Katalysatoren."),
];
const CAT_FALSE: { text: Text; title: Text; say: Text }[] = [
  {
    text: tx("It changes how much energy the reaction releases (ΔE).", "Er verändert, wie viel Energie die Reaktion abgibt (ΔE)."),
    title: tx("ΔE stays the same", "ΔE bleibt gleich"),
    say: tx("Picture the energy diagram: with a catalyst only the hill gets lower. Reactants and products stay at the same levels, so ΔE doesn't change.", "Denk an das Energiediagramm: Mit Katalysator wird nur der Berg niedriger. Edukte und Produkte bleiben auf ihren Stufen, also ändert sich ΔE nicht."),
  },
  {
    text: tx("It supplies the energy the reaction needs.", "Er liefert die Energie, die die Reaktion braucht."),
    title: tx("No energy from the catalyst", "Keine Energie vom Katalysator"),
    say: tx("A catalyst doesn't bring energy along. It opens an easier way with a lower hill.", "Ein Katalysator bringt keine Energie mit. Er öffnet einen leichteren Weg mit einem niedrigeren Berg."),
  },
  {
    text: tx("It is used up during the reaction.", "Er wird bei der Reaktion verbraucht."),
    title: tx("Not used up", "Wird nicht verbraucht"),
    say: tx("A catalyst comes out unchanged: a catalyst like manganese dioxide can be filtered off after the reaction and used again.", "Ein Katalysator kommt unverändert wieder heraus: Einen Katalysator wie Braunstein kannst du nach der Reaktion abfiltrieren und wieder benutzen."),
  },
  {
    text: tx("It turns an endothermic reaction into an exothermic one.", "Er macht aus einer endothermen Reaktion eine exotherme."),
    title: tx("Exo or endo stays", "Exo oder endo bleibt"),
    say: tx("Exo or endo depends on the energy of the reactants and products. A catalyst doesn't touch those levels, only the hill in between.", "Ob exo oder endo, hängt an der Energie von Edukten und Produkten. Die verändert ein Katalysator nicht, nur den Berg dazwischen."),
  },
  {
    text: tx("It raises the activation energy so the reaction runs more safely.", "Er erhöht die Aktivierungsenergie, damit die Reaktion sicherer abläuft."),
    title: tx("Lower, not higher", "Niedriger, nicht höher"),
    say: tx("The other way round: a catalyst **lowers** the hill. That's why the reaction starts more easily and runs faster.", "Andersrum: Ein Katalysator **senkt** den Berg. Darum springt die Reaktion leichter an und läuft schneller."),
  },
];

function catalystMulti(rng: Rng): Exercise {
  const trues = rng.shuffle([0, 1, 2, 3]).slice(0, rng.int(2, 3));
  const falses = rng.shuffle([0, 1, 2, 3, 4]).slice(0, 5 - trues.length);
  const items = rng.shuffle([...trues.map((i) => ({ t: true, i })), ...falses.map((i) => ({ t: false, i }))]);
  const options = items.map((x) => noDot(x.t ? CAT_TRUE[x.i] : CAT_FALSE[x.i].text));
  const correct = items.map((x, k) => (x.t ? k : -1)).filter((k) => k >= 0);
  const list: Mistake[] = items
    .map((x, k) => ({ x, k }))
    .filter(({ x }) => !x.t)
    .map(({ x, k }) => multiMistake(options, [...correct, k], CAT_FALSE[x.i].title, CAT_FALSE[x.i].say));
  const unchanged = items.findIndex((x) => x.t && x.i === 1);
  if (unchanged >= 0 && correct.length > 1) {
    list.push(
      multiMistake(
        options,
        correct.filter((k) => k !== unchanged),
        tx("One more is true", "Eins stimmt noch"),
        tx("Almost! What happens to the catalyst itself? A catalyst like manganese dioxide can be filtered off after the reaction, as good as new.", "Fast! Was passiert mit dem Katalysator selbst? Einen Katalysator wie Braunstein kannst du nach der Reaktion abfiltrieren, wie neu."),
        true,
      ),
    );
  }
  return {
    instruction: tx("Pick all true statements", "Wähle alle richtigen Aussagen"),
    text: tx("What's true about a catalyst?", "Was stimmt für einen Katalysator?"),
    answer: { kind: "multi", options, correct },
    hint: tx("Picture the energy diagram with and without a catalyst. What changes, and what stays?", "Stell dir das Energiediagramm mit und ohne Katalysator vor. Was ändert sich, was bleibt?"),
    solution: [
      { math: m((r) => `E_A ${w(r, tx("with catalyst", "mit Katalysator"))} < E_A ${w(r, tx("without", "ohne"))}`), note: tx("A catalyst lowers the hill, so the reaction starts more easily and runs faster.", "Ein Katalysator senkt den Berg, also springt die Reaktion leichter an und läuft schneller.") },
      { math: m((r) => `\\Delta E ${w(r, tx("stays the same", "bleibt gleich"))}`), note: tx("The levels of reactants and products don't move. The catalyst isn't used up and adds no energy.", "Die Stufen von Edukten und Produkten bleiben. Der Katalysator wird nicht verbraucht und liefert keine Energie.") },
    ],
    mistakes: cleanMulti(correct, list),
  };
}

type Reverse = { fact: Text; question: Text; kj: number; forwardExo: boolean; fwd: [Text[], Text[]] };
const REVERSES: Reverse[] = [
  {
    fact: tx("When 18 g of water form from hydrogen and oxygen, 286 kJ are released.", "Bilden sich 18 g Wasser aus Wasserstoff und Sauerstoff, werden 286 kJ frei."),
    question: tx("What's true for splitting 18 g of water into hydrogen and oxygen?", "Was gilt für die Zerlegung von 18 g Wasser in Wasserstoff und Sauerstoff?"),
    kj: 286,
    forwardExo: true,
    fwd: [[N.hydrogen, N.oxygen], [N.water]],
  },
  {
    fact: tx("When 24.3 g of magnesium burn to magnesium oxide, 602 kJ are released.", "Verbrennen 24,3 g Magnesium zu Magnesiumoxid, werden 602 kJ frei."),
    question: tx("What's true for splitting the 40.3 g of magnesium oxide back into magnesium and oxygen?", "Was gilt, wenn man die 40,3 g Magnesiumoxid wieder in Magnesium und Sauerstoff zerlegt?"),
    kj: 602,
    forwardExo: true,
    fwd: [[N.magnesium, N.oxygen], [N.magnesiumOxide]],
  },
  {
    fact: tx("Breaking down 100 g of limestone (calcium carbonate) into calcium oxide and carbon dioxide takes 178 kJ.", "Um 100 g Kalkstein (Calciumcarbonat) in Calciumoxid und Kohlenstoffdioxid zu zerlegen, braucht man 178 kJ."),
    question: tx("What's true when calcium oxide and carbon dioxide react back into 100 g of calcium carbonate?", "Was gilt, wenn Calciumoxid und Kohlenstoffdioxid wieder zu 100 g Calciumcarbonat reagieren?"),
    kj: 178,
    forwardExo: false,
    fwd: [[N.calciumCarbonate], [N.calciumOxide, N.carbonDioxide]],
  },
];

function reverseEnergy(rng: Rng): Exercise {
  const c = rng.pick(REVERSES);
  const E = c.kj;
  const backExo = !c.forwardExo;
  type Tag = "ok" | "same" | "less" | "cat";
  const items: { tag: Tag; text: Text }[] = [
    { tag: "ok", text: backExo ? tx(`${E} kJ are released: exothermic.`, `Es werden ${E} kJ frei: exotherm.`) : tx(`The reaction needs ${E} kJ: endothermic.`, `Die Reaktion braucht ${E} kJ: endotherm.`) },
    { tag: "same", text: backExo ? tx(`The reaction needs ${E} kJ too: endothermic.`, `Die Reaktion braucht auch ${E} kJ: endotherm.`) : tx(`${E} kJ are released here too: exothermic.`, `Auch hier werden ${E} kJ frei: exotherm.`) },
    { tag: "less", text: backExo ? tx(`Less than ${E} kJ are released.`, `Es werden weniger als ${E} kJ frei.`) : tx(`The reaction needs less than ${E} kJ.`, `Die Reaktion braucht weniger als ${E} kJ.`) },
    { tag: "cat", text: tx("With a catalyst, no energy is involved at all.", "Mit Katalysator wird gar keine Energie umgesetzt.") },
  ];
  const { options, index } = arrange(rng, items);
  const mistakes = [
    choiceMistake(options, index("same"), tx("The energy flow turns round", "Der Energiefluss dreht sich um"), tx("Backwards, everything turns round: what was released going forwards has to be put back in, and the other way round.", "Rückwärts dreht sich alles um: Was hinwärts frei wurde, muss rückwärts wieder hineingesteckt werden, und umgekehrt.")),
    choiceMistake(options, index("less"), tx("Exactly the same amount", "Genau gleich viel"), tx("The substances at the start and end have fixed energies. Backwards, the difference is exactly the same, just in the other direction.", "Die Stoffe am Anfang und am Ende haben feste Energien. Rückwärts ist der Unterschied genau gleich groß, nur in die andere Richtung.")),
    choiceMistake(options, index("cat"), tx("A catalyst keeps ΔE", "Ein Katalysator ändert ΔE nicht"), tx("A catalyst only lowers the hill. How much energy is released or taken in (ΔE) stays the same.", "Ein Katalysator senkt nur den Berg. Wie viel Energie frei oder aufgenommen wird (ΔE), bleibt gleich.")),
  ];
  const [L, R] = c.fwd;
  const fwdLine = m((r) => `${L.map((s) => w(r, s)).join(" + ")} -> ${R.map((s) => w(r, s)).join(" + ")} \\quad ${w(r, c.forwardExo ? tx(`${E} kJ released`, `${E} kJ frei`) : tx(`${E} kJ needed`, `${E} kJ nötig`), "e")}`);
  const backLine = m((r) => `${R.map((s) => w(r, s)).join(" + ")} -> ${L.map((s) => w(r, s)).join(" + ")} \\quad ${w(r, backExo ? tx(`${E} kJ released`, `${E} kJ frei`) : tx(`${E} kJ needed`, `${E} kJ nötig`), "e")}`);
  return {
    instruction: tx("Think about the energy", "Denk an die Energie"),
    text: txMap((_, l) => `${resolveText(c.fact, l)} ${resolveText(c.question, l)}`),
    answer: { kind: "choice", options, correct: index("ok") },
    hint: tx("Forwards and backwards, the energy difference is the same size. Only the direction changes.", "Hin und zurück ist der Energieunterschied gleich groß. Nur die Richtung ändert sich."),
    solution: [
      { math: fwdLine, note: c.forwardExo ? tx("Forwards: exothermic.", "Hinwärts: exotherm.") : tx("Forwards: endothermic.", "Hinwärts: endotherm.") },
      { math: backLine, highlight: ["e"], note: tx("Backwards: the same amount of energy, in the other direction.", "Rückwärts: dieselbe Energiemenge, nur in die andere Richtung.") },
    ],
    mistakes,
  };
}

type Fuel = { name: Text; grams: number; kj: number; fs: number[] };
const FUELS: Fuel[] = [
  { name: N.carbon, grams: 12, kj: 393, fs: [2, 3, 5, 0.5] },
  { name: N.hydrogen, grams: 2, kj: 286, fs: [2, 3, 5, 10] },
  { name: N.methane, grams: 16, kj: 890, fs: [2, 3, 0.5] },
  { name: N.magnesium, grams: 24.3, kj: 602, fs: [2, 3] },
];

function energyAmount(rng: Rng): Exercise {
  const f = rng.pick(FUELS);
  const k = rng.pick(f.fs);
  const mass = r2(f.grams * k);
  const value = r2(f.kj * k);
  const mistakes: Mistake[] = [];
  const addM = (v: number, title: Text, say: Text) => {
    v = r2(v);
    if (Math.abs(v - value) < 1e-6 || mistakes.some((x) => x.when.kind === "number" && Math.abs(x.when.value - v) < 1e-6)) return;
    mistakes.push({ when: { kind: "number", value: v, tolerance: 0.002, unit: "kJ" }, title, say });
  };
  addM(
    f.kj,
    tx("Energy doesn't stay the same", "Die Energie bleibt nicht gleich"),
    txMap((t, l) => t(`That's the energy for ${dec(f.grams, l)} g. The energy depends on the amount: twice the mass, twice the energy.`, `Das ist die Energie für ${dec(f.grams, l)} g. Die Energie hängt von der Menge ab: doppelte Masse, doppelte Energie.`)),
  );
  addM(f.kj / k, tx("Divided instead of multiplied", "Geteilt statt malgenommen"), txMap((t, l) => t(`Check the direction: ${dec(mass, l)} g is ${k > 1 ? "more" : "less"} than ${dec(f.grams, l)} g, so the energy has to get ${k > 1 ? "bigger" : "smaller"}.`, `Prüf die Richtung: ${dec(mass, l)} g ist ${k > 1 ? "mehr" : "weniger"} als ${dec(f.grams, l)} g, also muss die Energie ${k > 1 ? "größer" : "kleiner"} werden.`)));
  return {
    instruction: tx("Work out the energy", "Berechne die Energie"),
    text: txMap((t, l) => {
      const n = resolveText(f.name, l);
      return t(`Burning ${dec(f.grams, l)} g of ${n} releases ${f.kj} kJ. How much energy is released when ${dec(mass, l)} g of ${n} burn?`, `Verbrennen ${dec(f.grams, l)} g ${n}, werden ${f.kj} kJ frei. Wie viel Energie wird frei, wenn ${dec(mass, l)} g ${n} verbrennen?`);
    }),
    answer: { kind: "number", value, tolerance: 0.002, unit: "kJ" },
    hint: tx("Twice the mass releases twice the energy: the energy is proportional to the amount.", "Doppelte Masse, doppelte Energie: Die Energie ist proportional zur Menge."),
    solution: [
      { math: m((r, l) => `${dec(f.grams, l)}#a ${w(r, tx(`g ${resolveText(f.name, "en")}`, `g ${resolveText(f.name, "de")}`), "ua")} \\to ${f.kj}#e ${w(r, tx("kJ released", "kJ frei"), "ue")}`), note: tx("Start from what you know.", "Fang mit dem an, was du weißt.") },
      { math: m((_, l) => `${dec(mass, l)} : ${dec(f.grams, l)} = ${dec(k, l)}`), note: txMap((t, l) => t(`The new mass is ${dec(k, l)} times as much.`, `Die neue Masse ist ${dec(k, l)}-mal so groß.`)) },
      { math: m((r, l) => `${dec(k, l)} \\cdot ${f.kj} = ${dec(value, l)}#v ${w(r, tx("kJ released", "kJ frei"), "ue")}`), highlight: ["v"], note: tx("So the energy is that many times as big too.", "Also ist auch die Energie so viel Mal so groß.") },
    ],
    mistakes,
  };
}

type Why = { q: Text; ok: Text; wrong: { text: Text; title: Text; say: Text }[]; note: Text };
const WHYS: Why[] = [
  {
    q: tx("A candle doesn't light itself, although burning is exothermic. Why?", "Eine Kerze zündet sich nicht von selbst an, obwohl Verbrennen exotherm ist. Warum?"),
    ok: tx("The reaction first needs the activation energy, which the match supplies.", "Die Reaktion braucht zuerst die Aktivierungsenergie, die das Streichholz liefert."),
    note: tx("Even exothermic reactions need a start push over the energy hill: the activation energy.", "Auch exotherme Reaktionen brauchen einen Startschubs über den Energieberg: die Aktivierungsenergie."),
    wrong: [
      { text: tx("Burning is endothermic at first and only becomes exothermic later.", "Verbrennen ist erst endotherm und wird später exotherm."), title: tx("Start push, not endothermic", "Startschubs, nicht endotherm"), say: tx("Exo or endo is about the whole reaction: start compared with end. The start push is the activation energy, that doesn't make it endothermic.", "Exo oder endo betrifft die ganze Reaktion: Anfang verglichen mit Ende. Der Startschubs ist die Aktivierungsenergie, das macht sie nicht endotherm.") },
      { text: tx("There isn't enough oxygen in the air.", "In der Luft ist nicht genug Sauerstoff."), title: tx("Oxygen is there", "Sauerstoff ist da"), say: tx("Air is about one fifth oxygen: plenty for a candle. Something else is missing, a push to get started.", "Luft besteht zu etwa einem Fünftel aus Sauerstoff: genug für eine Kerze. Es fehlt etwas anderes, ein Schubs zum Starten.") },
      { text: tx("Wax doesn't contain any energy.", "Wachs enthält keine Energie."), title: tx("Wax is full of energy", "Wachs steckt voller Energie"), say: tx("Wax stores lots of chemical energy: once lit, a candle burns for hours.", "Wachs speichert viel chemische Energie: Einmal angezündet, brennt eine Kerze stundenlang.") },
    ],
  },
  {
    q: tx("Hydrogen and oxygen can be mixed without anything happening. A small spark makes the mixture explode. What does the spark do?", "Wasserstoff und Sauerstoff kann man mischen, ohne dass etwas passiert. Ein kleiner Funke bringt das Gemisch zur Explosion. Was macht der Funke?"),
    ok: tx("It supplies the activation energy.", "Er liefert die Aktivierungsenergie."),
    note: tx("The spark gives the first particles the push over the hill. The reaction then releases far more energy by itself.", "Der Funke gibt den ersten Teilchen den Schubs über den Berg. Danach setzt die Reaktion selbst viel mehr Energie frei."),
    wrong: [
      { text: tx("It supplies all the energy of the explosion.", "Er liefert die ganze Energie der Explosion."), title: tx("The energy comes from the reaction", "Die Energie kommt aus der Reaktion"), say: tx("The spark is tiny compared with the bang. The energy of the explosion comes from the reaction itself: it's exothermic.", "Der Funke ist winzig im Vergleich zum Knall. Die Energie der Explosion stammt aus der Reaktion selbst: Sie ist exotherm.") },
      { text: tx("It acts as a catalyst.", "Er wirkt als Katalysator."), title: tx("Not a catalyst", "Kein Katalysator"), say: tx("A catalyst lowers the hill and is a substance that comes out unchanged. The spark doesn't lower anything, it gives the particles the push over the hill.", "Ein Katalysator ist ein Stoff, der den Berg senkt und unverändert herauskommt. Der Funke senkt nichts, er gibt den Teilchen den Schubs über den Berg.") },
      { text: tx("It makes the reaction endothermic.", "Er macht die Reaktion endotherm."), title: tx("Still exothermic", "Immer noch exotherm"), say: tx("A bang, heat and light: lots of energy is released, so the reaction is exothermic. The spark only starts it.", "Knall, Wärme und Licht: Es wird viel Energie frei, die Reaktion ist also exotherm. Der Funke startet sie nur.") },
    ],
  },
  {
    q: tx("In a car's catalytic converter, harmful exhaust gases react at much lower temperatures than without it. Why?", "Im Autokatalysator reagieren schädliche Abgase schon bei viel niedrigeren Temperaturen als ohne ihn. Warum?"),
    ok: tx("The catalyst lowers the activation energy.", "Der Katalysator senkt die Aktivierungsenergie."),
    note: tx("A lower hill means the particles need less energy to react, so the reaction runs at lower temperatures.", "Ein niedrigerer Berg heißt: Die Teilchen brauchen weniger Energie zum Reagieren, also läuft die Reaktion schon bei niedrigeren Temperaturen."),
    wrong: [
      { text: tx("The catalyst heats up the exhaust gases.", "Der Katalysator heizt die Abgase auf."), title: tx("A catalyst doesn't heat", "Ein Katalysator heizt nicht"), say: tx("A catalyst doesn't supply heat. It offers a way over a lower hill.", "Ein Katalysator liefert keine Wärme. Er bietet einen Weg über einen niedrigeren Berg.") },
      { text: tx("The catalyst is used up and turns into harmless gases.", "Der Katalysator wird verbraucht und zu harmlosen Gasen."), title: tx("Not used up", "Wird nicht verbraucht"), say: tx("A catalyst isn't used up: the precious metals in the converter work for years.", "Ein Katalysator wird nicht verbraucht: Die Edelmetalle im Autokatalysator arbeiten jahrelang.") },
      { text: tx("The catalyst makes the reaction release more energy.", "Der Katalysator sorgt dafür, dass mehr Energie frei wird."), title: tx("ΔE stays the same", "ΔE bleibt gleich"), say: tx("How much energy is released (ΔE) doesn't change with a catalyst. Only the hill gets lower.", "Wie viel Energie frei wird (ΔE), ändert ein Katalysator nicht. Nur der Berg wird niedriger.") },
    ],
  },
  {
    q: tx("Hydrogen peroxide breaks down very slowly into water and oxygen. Add a pinch of manganese dioxide and it fizzes strongly. Afterwards the manganese dioxide is all still there. What is it?", "Wasserstoffperoxid zerfällt nur sehr langsam in Wasser und Sauerstoff. Mit einer Spatelspitze Braunstein schäumt es heftig. Danach ist der Braunstein noch vollständig da. Was ist er?"),
    ok: tx("A catalyst", "Ein Katalysator"),
    note: tx("It speeds the reaction up and comes out unchanged: that's exactly what a catalyst does.", "Er beschleunigt die Reaktion und kommt unverändert heraus: genau das macht ein Katalysator."),
    wrong: [
      { text: tx("A reactant", "Ein Edukt"), title: tx("Not used up", "Nicht verbraucht"), say: tx("A reactant would be used up. But the manganese dioxide is still all there afterwards.", "Ein Edukt würde verbraucht. Der Braunstein ist danach aber noch vollständig da.") },
      { text: tx("A product", "Ein Produkt"), title: tx("It was there from the start", "Er war von Anfang an da"), say: tx("The products are water and oxygen. The manganese dioxide was there from the start.", "Die Produkte sind Wasser und Sauerstoff. Der Braunstein war von Anfang an da.") },
      { text: tx("An energy source", "Eine Energiequelle"), title: tx("No energy from it", "Keine Energie von ihm"), say: tx("Manganese dioxide doesn't supply energy. It lowers the activation energy, so the reaction runs faster.", "Braunstein liefert keine Energie. Er senkt die Aktivierungsenergie, darum läuft die Reaktion schneller.") },
    ],
  },
];

function activationWhy(rng: Rng): Exercise {
  const c = rng.pick(WHYS);
  const items = [{ tag: "ok", text: c.ok }, ...c.wrong.map((x, i) => ({ tag: `w${i}`, text: x.text }))];
  const { options, index } = arrange(rng, items);
  return {
    instruction: tx("Activation energy and catalysts", "Aktivierungsenergie und Katalysator"),
    text: c.q,
    answer: { kind: "choice", options, correct: index("ok") },
    hint: tx("Think of the energy hill: what gets the particles over it, and what makes it lower?", "Denk an den Energieberg: Was bringt die Teilchen hinüber, und was macht ihn niedriger?"),
    solution: [
      { math: m((r) => `E_A = ${w(r, tx("start push over the hill", "Startschubs über den Berg"), "a")}`), note: c.note },
      { math: m((r) => `${w(r, tx("catalyst", "Katalysator"), "c")} \\to ${w(r, tx("lower hill", "niedrigerer Berg"), "a")}`), note: tx("A catalyst lowers the hill and is not used up.", "Ein Katalysator senkt den Berg und wird nicht verbraucht.") },
    ],
    mistakes: c.wrong.map((x, i) => choiceMistake(options, index(`w${i}`), x.title, x.say)),
  };
}

// ---------------------------------------------------------------------------

function generate(level: Level, rng: Rng): Exercise {
  const r = rng.next();
  if (level === 1) {
    if (r < 0.3) return physOrChem(rng);
    if (r < 0.55) return exoEndo(rng);
    if (r < 0.8) return reactantsProducts(rng);
    return whichReactions(rng);
  }
  if (level === 2) {
    if (r < 0.24) return whichWordEquation(rng);
    if (r < 0.44) return nameProduct(rng);
    if (r < 0.66) return massTask(rng, 2);
    if (r < 0.74) return diagramKind(rng);
    if (r < 0.84) return diagramArrow(rng);
    return synthesisOrAnalysis(rng);
  }
  if (r < 0.2) return catalystMulti(rng);
  if (r < 0.36) return reverseEnergy(rng);
  if (r < 0.54) return energyAmount(rng);
  if (r < 0.7) return activationWhy(rng);
  if (r < 0.8) return diagramCatalyst(rng);
  return massTask(rng, 3);
}

// ---------------------------------------------------------------------------
// Lesson

const iceFrames: Frame[] = [
  { math: m((r) => `${w(r, tx("ice", "Eis"), "a")} -> ${w(r, tx("water", "Wasser"), "b")}`), note: tx("Ice melts. Before and after: water. Only the **state of matter** changes.", "Eis schmilzt. Vorher und nachher: Wasser. Nur der **Aggregatzustand** ändert sich.") },
  { math: "\\ce{H2O(s) -> H2O(l)}", note: tx("The particles stay water molecules, they just move more freely. That's a **physical change**.", "Die Teilchen bleiben Wassermoleküle, sie bewegen sich nur freier. Das ist ein **physikalischer Vorgang**.") },
  {
    math: m((r) => `${w(r, N.magnesium, "c")} + ${w(r, N.oxygen, "d")} -> ${w(r, N.magnesiumOxide, "e")}`),
    note: tx("Magnesium burns with a dazzling white light. A white powder is left: **magnesium oxide**.", "Magnesium verbrennt mit grellem weißem Licht. Zurück bleibt ein weißes Pulver: **Magnesiumoxid**."),
  },
  {
    math: m((r) => `${w(r, N.magnesium, "c")} + ${w(r, N.oxygen, "d")} -> ${w(r, N.magnesiumOxide, "e")}`),
    highlight: ["e"],
    note: tx("Shiny metal became white powder: a **new substance** with new properties. That's a **chemical reaction**.", "Aus glänzendem Metall wurde weißes Pulver: ein **neuer Stoff** mit neuen Eigenschaften. Das ist eine **chemische Reaktion**."),
  },
];

const signFrames: Frame[] = [
  { math: m((r) => `${w(r, N.iron, "a")} + ${w(r, N.sulfur, "b")}`), note: tx("Grey iron powder and yellow sulfur. Just mixed, a magnet can still pull the iron out.", "Graues Eisenpulver und gelber Schwefel. Nur gemischt zieht ein Magnet das Eisen noch heraus.") },
  {
    math: m((r) => `${w(r, N.iron, "a")} + ${w(r, N.sulfur, "b")} -> ${w(r, N.ironSulfide, "c")}`),
    highlight: ["c"],
    note: tx("Heat it briefly: the mixture glows on by itself and turns into a grey-black solid, **iron sulfide**. New substance: **substances change**.", "Kurz erhitzt glüht das Gemisch von selbst weiter und wird zu einem grauschwarzen Feststoff, **Eisensulfid**. Neuer Stoff: **Stoffumwandlung**."),
  },
  {
    math: m((r) => `${w(r, N.iron, "a")} + ${w(r, N.sulfur, "b")} -> ${w(r, N.ironSulfide, "c")} \\quad ${w(r, tx("| exothermic", "| exotherm"), "x")}`),
    highlight: ["x"],
    note: tx("And it glows and gets hot: energy is released. **Energy changes** too. Two substances become one: a **synthesis**.", "Und es glüht und wird heiß: Energie wird frei. Also auch **Energieumwandlung**. Aus zwei Stoffen wird einer: eine **Synthese**."),
  },
  {
    math: m((r) => [tx("colour", "Farbe"), tx("gas", "Gas"), tx("light, heat", "Licht, Wärme"), tx("precipitate", "Niederschlag")].map((s, i) => w(r, s, `h${i}`)).join(" \\quad ")),
    note: tx("Clues you can see: a new colour, gas bubbles, light or heat, a solid settling out. But clues are no proof: only a **new substance** counts.", "Hinweise, die du sehen kannst: neue Farbe, Gasbläschen, Licht oder Wärme, ein ausfallender Feststoff. Aber Hinweise sind kein Beweis: Es zählt nur der **neue Stoff**."),
  },
];

const wordFrames: Frame[] = [
  { math: m((r) => `${w(r, N.copper, "a")} + ${w(r, N.oxygen, "b")}`), note: tx("Copper is heated in the air. It reacts with the **oxygen** in the air.", "Kupfer wird an der Luft erhitzt. Es reagiert mit dem **Sauerstoff** der Luft.") },
  { math: m((r) => `${w(r, N.copper, "a")} + ${w(r, N.oxygen, "b")} -> ${w(r, N.copperOxide, "c")}`), note: tx("A black layer forms: copper oxide.", "Es bildet sich eine schwarze Schicht: Kupferoxid.") },
  { math: m((r) => `${w(r, N.copper, "a")} + ${w(r, N.oxygen, "b")} -> ${w(r, N.copperOxide, "c")}`), highlight: ["a", "b"], note: tx("Left of the arrow: the **reactants**, the substances you start with.", "Links vom Pfeil: die **Edukte**, die Ausgangsstoffe.") },
  { math: m((r) => `${w(r, N.copper, "a")} + ${w(r, N.oxygen, "b")} -> ${w(r, N.copperOxide, "c")}`), highlight: ["c"], note: tx("Right of the arrow: the **product**, the new substance.", "Rechts vom Pfeil: das **Produkt**, der neue Stoff.") },
  {
    math: m((r) => `${w(r, N.copper, "a")} + ${w(r, N.oxygen, "b")} -> ${w(r, N.copperOxide, "c")}`),
    highlight: ["b"],
    note: tx("Read: copper and oxygen react to form copper oxide. Write **oxygen**, not air: air is a mixture, only its oxygen reacts.", "Gelesen: Kupfer und Sauerstoff reagieren zu Kupferoxid. Schreib **Sauerstoff**, nicht Luft: Luft ist ein Gemisch, nur ihr Sauerstoff reagiert."),
  },
];

const massFrames: Frame[] = [
  { math: m((r) => `7#a "g"#ga ${w(r, N.iron, "ea")} + 4#b "g"#gb ${w(r, N.sulfur, "eb")}`), note: tx("In a closed test tube, 7 g of iron react completely with 4 g of sulfur.", "In einem geschlossenen Reagenzglas reagieren 7 g Eisen vollständig mit 4 g Schwefel.") },
  { math: m((r) => `7#a "g"#ga ${w(r, N.iron, "ea")} + 4#b "g"#gb ${w(r, N.sulfur, "eb")} -> 11#c "g"#gc ${w(r, N.ironSulfide, "ec")}`), highlight: ["c"], note: tx("Afterwards there are 11 g of iron sulfide. $7 + 4 = 11$: no mass lost, none gained.", "Danach sind es 11 g Eisensulfid. $7 + 4 = 11$: Keine Masse ist verloren gegangen oder dazugekommen.") },
  { math: "\\ce{Fe + S -> FeS}", note: tx("Why? Atoms aren't destroyed or created, they're only **rearranged**. The same atoms means the same mass.", "Warum? Atome werden weder vernichtet noch erschaffen, sie werden nur **umgruppiert**. Gleiche Atome heißt gleiche Masse.") },
  {
    math: m((r) => `${w(r, tx("charcoal", "Holzkohle"), "a")} + ${w(r, N.oxygen, "b")} -> ${w(r, N.carbonDioxide, "c")}`),
    highlight: ["c"],
    note: tx("In an open grill only a little ash is left. Nothing vanished: the carbon dioxide escaped into the air. That's why it only works in a **closed** vessel.", "Im offenen Grill bleibt nur wenig Asche übrig. Verschwunden ist nichts: Das Kohlenstoffdioxid ist in die Luft entwichen. Deshalb klappt die Probe nur im **geschlossenen** Gefäß."),
  },
];

const energyFrames: Frame[] = [
  {
    math: wordEq([N.methane, N.oxygen], [N.carbonDioxide, N.water]),
    note: tx("Natural gas burns on the stove. A reaction with oxygen is a **combustion**.", "Erdgas verbrennt am Gasherd. Eine Reaktion mit Sauerstoff ist eine **Verbrennung**."),
  },
  {
    math: m((r, l) => `${resolveText(wordEq([N.methane, N.oxygen], [N.carbonDioxide, N.water]), l)} \\quad ${w(r, tx("| exothermic", "| exotherm"), "x")}`),
    highlight: ["x"],
    note: tx("The flame heats the pan: energy is released to the surroundings. **Exothermic**.", "Die Flamme heizt den Topf: Energie wird an die Umgebung abgegeben. **Exotherm**."),
  },
  {
    math: m((r, l) => `${resolveText(wordEq([N.calciumCarbonate], [N.calciumOxide, N.carbonDioxide]), l)} \\quad ${w(r, tx("| endothermic", "| endotherm"), "x")}`),
    highlight: ["x"],
    note: tx("Lime burning: limestone only breaks down while it's heated strongly. Stop heating and it stops: **endothermic**. One substance breaks into several: an **analysis** (decomposition).", "Kalkbrennen: Kalkstein zerfällt nur, solange er stark erhitzt wird. Hörst du auf, stoppt die Reaktion: **endotherm**. Ein Stoff zerfällt in mehrere: eine **Analyse** (Zerlegung)."),
  },
];

// Lesson checks

const dryIceOptions = [PHYS, CHEM];
const dryIce: Exercise = {
  instruction: tx("Physical or chemical?", "Physikalisch oder chemisch?"),
  text: tx("Dry ice is solid carbon dioxide. At room temperature it turns straight into carbon dioxide gas, with white fog all around.", "Trockeneis ist festes Kohlenstoffdioxid. Bei Raumtemperatur wird es direkt zu gasförmigem Kohlenstoffdioxid, rundherum wabert weißer Nebel."),
  answer: { kind: "choice", options: dryIceOptions, correct: 0 },
  hint: tx("Compare before and after: which substance is it?", "Vergleich vorher und nachher: Welcher Stoff ist es?"),
  solution: [
    { math: "\\ce{CO2(s) -> CO2(g)}", note: tx("Before: carbon dioxide. After: carbon dioxide. The same substance.", "Vorher: Kohlenstoffdioxid. Nachher: Kohlenstoffdioxid. Derselbe Stoff.") },
    { math: m((r) => `\\ce{CO2(s) -> CO2(g)} \\quad => ${w(r, PHYS, "z")}`), highlight: ["z"], note: tx("Only the state of matter changes (sublimation): a physical change.", "Nur der Aggregatzustand ändert sich (Sublimation): ein physikalischer Vorgang.") },
  ],
  mistakes: [
    choiceMistake(
      dryIceOptions,
      1,
      tx("Looks can deceive", "Der Schein trügt"),
      tx("The fog looks spectacular! But the gas is the same substance as the solid: carbon dioxide. Only the state of matter changes.", "Der Nebel sieht spektakulär aus! Aber das Gas ist derselbe Stoff wie der Feststoff: Kohlenstoffdioxid. Nur der Aggregatzustand ändert sich."),
    ),
  ],
};

const mgProduct: Exercise = {
  instruction: tx("Name the product", "Benenne das Produkt"),
  math: m((r) => `${w(r, tx("Magnesium", "Magnesium"))} + ${w(r, tx("Oxygen", "Sauerstoff"))} -> ?`),
  answer: { kind: "word", accept: [N.magnesiumOxide], placeholder: tx("name of the product", "Name des Produkts") },
  hint: tx("Metal + oxygen gives a metal **oxide**.", "Metall + Sauerstoff ergibt ein Metall**oxid**."),
  solution: [
    { math: m((r) => `${w(r, tx("Magnesium", "Magnesium"), "a")} + ${w(r, tx("Oxygen", "Sauerstoff"), "b")} -> "?"#c `), note: tx("A metal reacts with oxygen.", "Ein Metall reagiert mit Sauerstoff.") },
    { math: m((r) => `${w(r, tx("Magnesium", "Magnesium"), "a")} + ${w(r, tx("Oxygen", "Sauerstoff"), "b")} -> ${w(r, tx("Magnesium oxide", "Magnesiumoxid"), "c")}`), highlight: ["c"], note: tx("Metal name + **oxide**: magnesium oxide.", "Metallname + **oxid**: Magnesiumoxid.") },
  ],
  mistakes: [
    { when: { kind: "word", accept: [tx("magnesium oxygen", "Magnesiumsauerstoff")] }, title: tx("The -ide ending", "Die Endung -id"), say: tx("Nearly! In the product's name, oxygen gets the ending **-ide**: chlorine becomes chloride, sulfur becomes sulfide, and oxygen…?", "Fast! Im Namen des Produkts bekommt der Sauerstoff die Endung **-id**: Aus Chlor wird Chlorid, aus Schwefel Sulfid, und aus Sauerstoff …?"), close: true },
    { when: { kind: "word", accept: [N.magnesium] }, title: tx("That's a reactant", "Das ist ein Edukt"), say: tx("Magnesium is what you started with. The product is the **new** substance made from magnesium and oxygen.", "Mit Magnesium hast du angefangen. Das Produkt ist der **neue** Stoff aus Magnesium und Sauerstoff.") },
    { when: { kind: "word", accept: [tx("magnesium sulfide", "Magnesiumsulfid")] }, title: tx("Wrong partner", "Falscher Partner"), say: tx("Sulfide comes from sulfur. Here magnesium reacts with **oxygen**.", "Sulfid kommt von Schwefel. Hier reagiert Magnesium mit **Sauerstoff**.") },
  ],
};

const mgMass: Exercise = {
  instruction: tx("Use the law of conservation of mass", "Nutze das Gesetz von der Erhaltung der Masse"),
  text: tx("2.4 g of magnesium burn completely. 4.0 g of magnesium oxide form. How much oxygen has reacted?", "2,4 g Magnesium verbrennen vollständig. Es entstehen 4,0 g Magnesiumoxid. Wie viel Sauerstoff hat reagiert?"),
  answer: { kind: "number", value: 1.6, tolerance: 0.001, unit: "g" },
  hint: tx("Magnesium + oxygen = magnesium oxide, also in grams.", "Magnesium + Sauerstoff = Magnesiumoxid, auch in Gramm."),
  solution: [
    { math: tx('2.4#a "g" + m#x = 4.0#c "g"', '2,4#a "g" + m#x = 4,0#c "g"'), note: tx("Mass before = mass after.", "Masse vorher = Masse nachher.") },
    { math: tx('m#x = 4.0#c "g" - 2.4#a "g"', 'm#x = 4,0#c "g" - 2,4#a "g"'), note: tx("The oxygen is the difference.", "Der Sauerstoff ist die Differenz.") },
    { math: tx('m#x = 1.6#v "g"', 'm#x = 1,6#v "g"'), highlight: ["v"], note: tx("1.6 g of oxygen from the air are now bound in the oxide. That's why burnt magnesium is **heavier**.", "1,6 g Sauerstoff aus der Luft stecken jetzt im Oxid. Darum ist verbranntes Magnesium **schwerer**.") },
  ],
  mistakes: [
    { when: { kind: "number", value: 6.4, tolerance: 0.001, unit: "g" }, title: tx("Added instead of subtracted", "Addiert statt subtrahiert"), say: tx("Ah, you added both masses. But the 4.0 g of magnesium oxide already **contain** the magnesium. The oxygen is what's missing: the difference.", "Ah, du hast beide Massen addiert. Aber in den 4,0 g Magnesiumoxid **steckt** das Magnesium schon drin. Der Sauerstoff ist, was fehlt: die Differenz.") },
    { when: { kind: "number", value: 4, tolerance: 0.001, unit: "g" }, title: tx("That's the product", "Das ist das Produkt"), say: tx("4.0 g is the magnesium oxide. Asked is only the oxygen that reacted.", "4,0 g ist das Magnesiumoxid. Gefragt ist nur der Sauerstoff, der reagiert hat.") },
  ],
};

const catOptions = [
  tx("It lowers the activation energy", "Er senkt die Aktivierungsenergie"),
  tx("It is still there, unchanged, after the reaction", "Er liegt nach der Reaktion unverändert vor"),
  tx("It changes how much energy is released (ΔE)", "Er verändert, wie viel Energie frei wird (ΔE)"),
  tx("It makes the reaction run faster", "Er beschleunigt die Reaktion"),
  tx("It supplies the energy the reaction needs", "Er liefert die Energie, die die Reaktion braucht"),
];
const catCheck: Exercise = {
  instruction: tx("Pick all true statements", "Wähle alle richtigen Aussagen"),
  text: tx("What does a catalyst do?", "Was macht ein Katalysator?"),
  answer: { kind: "multi", options: catOptions, correct: [0, 1, 3] },
  hint: tx("Drag the catalyst into the diagram again: what changes, and what stays the same?", "Zieh den Katalysator noch mal ins Diagramm: Was ändert sich, was bleibt gleich?"),
  solution: [
    { math: m((r) => `E_A ${w(r, tx("with catalyst", "mit Katalysator"))} < E_A ${w(r, tx("without", "ohne"))}`), note: tx("The hill gets lower, so the reaction starts more easily and runs faster.", "Der Berg wird niedriger, also springt die Reaktion leichter an und läuft schneller.") },
    { math: m((r) => `\\Delta E ${w(r, tx("stays the same", "bleibt gleich"))}`), note: tx("Reactants and products keep their energy. The catalyst isn't used up and supplies no energy.", "Edukte und Produkte behalten ihre Energie. Der Katalysator wird nicht verbraucht und liefert keine Energie.") },
  ],
  mistakes: [
    multiMistake(catOptions, [0, 1, 2, 3], CAT_FALSE[0].title, CAT_FALSE[0].say),
    multiMistake(catOptions, [0, 1, 3, 4], CAT_FALSE[1].title, CAT_FALSE[1].say),
    multiMistake(catOptions, [0, 3], tx("One more is true", "Eins stimmt noch"), tx("Almost! What happens to the catalyst itself? A catalyst like manganese dioxide can be filtered off after the reaction, as good as new.", "Fast! Was passiert mit dem Katalysator selbst? Einen Katalysator wie Braunstein kannst du nach der Reaktion abfiltrieren, wie neu."), true),
  ],
};

const reactions: Topic = {
  ...topicMeta("reactions"),
  summary: [
    {
      title: tx("Chemical reaction", "Chemische Reaktion"),
      body: tx(
        "New substances with new properties form (**substances change**), and energy is released or taken in (**energy changes**). If only the state or shape changes, it's a physical change.",
        "Es entstehen neue Stoffe mit neuen Eigenschaften (**Stoffumwandlung**), und Energie wird abgegeben oder aufgenommen (**Energieumwandlung**). Ändern sich nur Aggregatzustand oder Form, ist es ein physikalischer Vorgang.",
      ),
      examples: ["\\ce{Fe + S -> FeS}", "\\ce{H2O(s) -> H2O(l)}"],
      tone: "rule",
    },
    {
      title: tx("Word equation", "Wortgleichung"),
      body: tx("Reactants on the left, products on the right. Read the arrow as **react to form**.", "Edukte links, Produkte rechts. Den Pfeil liest du als **reagieren zu**."),
      examples: [m((r) => `${w(r, tx("reactants", "Edukte"))} -> ${w(r, tx("products", "Produkte"))}`), wordEq([N.copper, N.oxygen], [N.copperOxide], { keys: false })],
      tone: "rule",
    },
    {
      title: tx("Conservation of mass", "Erhaltung der Masse"),
      body: tx("In a closed vessel the total mass stays the same: atoms are only rearranged.", "In einem geschlossenen Gefäß bleibt die Gesamtmasse gleich: Die Atome werden nur umgruppiert."),
      examples: [m((r) => `m_{${w(r, tx("reactants", "Edukte"))}} = m_{${w(r, tx("products", "Produkte"))}}`), m((r) => `7 "g" ${w(r, N.iron)} + 4 "g" ${w(r, N.sulfur)} -> 11 "g" ${w(r, N.ironSulfide)}`)],
      tone: "rule",
    },
    {
      title: tx("Exothermic and endothermic", "Exotherm und endotherm"),
      body: tx(
        "**Exothermic**: energy is released, the products sit lower. **Endothermic**: energy is taken in, the products sit higher, you have to keep supplying energy.",
        "**Exotherm**: Energie wird frei, die Produkte liegen tiefer. **Endotherm**: Energie wird aufgenommen, die Produkte liegen höher, du musst ständig Energie zuführen.",
      ),
      examples: [m((r) => `\\ce{2Mg + O2 -> 2MgO} \\quad ${w(r, tx("exothermic", "exotherm"))}`), m((r) => `\\ce{CaCO3 -> CaO + CO2} \\quad ${w(r, tx("endothermic", "endotherm"))}`)],
      tone: "tip",
    },
    {
      title: tx("Activation energy and catalysts", "Aktivierungsenergie und Katalysator"),
      body: tx(
        "Most reactions need a start push over the energy hill: the activation energy $E_A$. A catalyst lowers $E_A$, speeds the reaction up and is not used up. ΔE stays the same.",
        "Die meisten Reaktionen brauchen einen Startschubs über den Energieberg: die Aktivierungsenergie $E_A$. Ein Katalysator senkt $E_A$, beschleunigt die Reaktion und wird nicht verbraucht. ΔE bleibt gleich.",
      ),
      examples: [m((r) => `E_A ${w(r, tx("with catalyst", "mit Katalysator"))} < E_A ${w(r, tx("without", "ohne"))}`)],
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx(
        "Light, heat or bubbles alone are no proof: a glowing bulb and boiling water make no new substance. And needing a spark to start doesn't make a reaction endothermic.",
        "Licht, Wärme oder Blasen allein sind kein Beweis: Eine leuchtende Glühlampe und kochendes Wasser bilden keinen neuen Stoff. Und eine Reaktion, die zum Starten einen Funken braucht, ist deshalb noch nicht endotherm.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("New substance or not?", "Neuer Stoff oder nicht?"),
      blob: tx("Chemistry is all about substances changing. Let's see what really counts!", "In Chemie geht's darum, wie sich Stoffe verändern. Schauen wir, worauf es wirklich ankommt!"),
      body: tx("Whenever something changes, ask one question: **is there a new substance afterwards?**", "Wenn sich etwas verändert, stell dir eine Frage: **Ist danach ein neuer Stoff da?**"),
      frames: iceFrames,
    },
    {
      type: "widget",
      title: tx("Physical or chemical?", "Physikalisch oder chemisch?"),
      blob: tx("Your turn to judge! New substance: yes or no?", "Jetzt urteilst du! Neuer Stoff: ja oder nein?"),
      body: tx("Sort each process. Careful: bubbles, light or heat can fool you. Only a **new substance** proves a reaction.", "Sortiere jeden Vorgang. Vorsicht: Blasen, Licht oder Wärme können täuschen. Nur ein **neuer Stoff** beweist eine Reaktion."),
      widget: ReactionsSorter,
    },
    { type: "check", blob: tx("A foggy one. Don't let it fool you!", "Eine neblige Sache. Lass dich nicht täuschen!"), exercise: dryIce },
    {
      type: "explain",
      title: tx("Two features of every reaction", "Zwei Kennzeichen jeder Reaktion"),
      blob: tx("Two features, always together. Let's watch iron and sulfur!", "Zwei Kennzeichen, immer zusammen. Schauen wir Eisen und Schwefel zu!"),
      body: tx(
        "Every chemical reaction has two features: **substances change** (new substances form) and **energy changes** (energy is released or taken in).",
        "Jede chemische Reaktion hat zwei Kennzeichen: **Stoffumwandlung** (neue Stoffe entstehen) und **Energieumwandlung** (Energie wird abgegeben oder aufgenommen).",
      ),
      frames: signFrames,
    },
    {
      type: "explain",
      title: tx("Reactants, products and the word equation", "Edukte, Produkte und die Wortgleichung"),
      blob: tx("Chemists write reactions like a short sentence. Here's how!", "Chemiker schreiben Reaktionen wie einen kurzen Satz. So geht's!"),
      body: tx(
        "The starting substances (**reactants**) go on the left, the new substances (**products**) on the right. The arrow means **react to form**.",
        "Die Ausgangsstoffe (**Edukte**) stehen links, die neuen Stoffe (**Produkte**) rechts. Der Pfeil bedeutet **reagieren zu**.",
      ),
      frames: wordFrames,
    },
    { type: "check", blob: tx("Metal plus oxygen. What do you call the product?", "Metall plus Sauerstoff. Wie heißt das Produkt?"), exercise: mgProduct },
    {
      type: "explain",
      title: tx("Law of conservation of mass", "Gesetz von der Erhaltung der Masse"),
      blob: tx("Does anything get lost in a reaction? Onto the scales!", "Geht bei einer Reaktion etwas verloren? Ab auf die Waage!"),
      body: tx(
        "In a **closed** vessel the scales show the same mass before and after the reaction. Atoms don't vanish and don't appear out of nowhere.",
        "In einem **geschlossenen** Gefäß zeigt die Waage vor und nach der Reaktion dieselbe Masse. Atome verschwinden nicht und kommen nicht aus dem Nichts.",
      ),
      frames: massFrames,
    },
    { type: "check", blob: tx("Magnesium gets heavier when it burns. How much heavier?", "Magnesium wird beim Verbrennen schwerer. Wie viel?"), exercise: mgMass },
    {
      type: "explain",
      title: tx("Exothermic and endothermic", "Exotherm und endotherm"),
      blob: tx("Every reaction moves energy around. The question is: out or in?", "Bei jeder Reaktion wird Energie umgesetzt. Die Frage ist: raus oder rein?"),
      body: tx(
        "**Exothermic**: energy is released to the surroundings, as heat or light. **Endothermic**: energy is taken in from the surroundings, you have to keep supplying it.",
        "**Exotherm**: Energie wird an die Umgebung abgegeben, als Wärme oder Licht. **Endotherm**: Energie wird aus der Umgebung aufgenommen, du musst sie ständig zuführen.",
      ),
      frames: energyFrames,
    },
    {
      type: "widget",
      title: tx("The energy hill and the catalyst", "Der Energieberg und der Katalysator"),
      blob: tx("Push the particles over the energy hill! Then drag in the catalyst.", "Schubs die Teilchen über den Energieberg! Dann zieh den Katalysator rein."),
      body: tx(
        "Even exothermic reactions need a start push, like the spark on a gas stove: the **activation energy** $E_A$. A **catalyst** lowers the hill. It speeds the reaction up and isn't used up.",
        "Auch exotherme Reaktionen brauchen einen Startschubs, wie den Funken am Gasherd: die **Aktivierungsenergie** $E_A$. Ein **Katalysator** senkt den Berg. Er beschleunigt die Reaktion und wird dabei nicht verbraucht.",
      ),
      widget: ReactionsEnergy,
    },
    { type: "check", blob: tx("Last one! What does a catalyst really do?", "Die letzte! Was macht ein Katalysator wirklich?"), exercise: catCheck },
  ],
  generate,
};

export default reactions;
