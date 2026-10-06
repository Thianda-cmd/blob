// Level 2 (Fortgeschritten) practice: abiotic and biotic factors, relationships, tolerance
// curves, indicator plants, energy flow with the 10 % rule, carbon cycle, predator and prey,
// niche and biodiversity.

import { tx, type Text } from "@/i18n/text";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Mistake } from "@/learn/types";
import { CARBON, EcoCarbonCyclePicture } from "@/learn/biology/visuals/EcoCycles";
import { EcoPredatorPreyPicture } from "@/learn/biology/visuals/EcoPredatorPrey";
import { ToleranceChart, crossings } from "@/learn/biology/visuals/EcoTolerance";
import { cap, capT, choice, de, en, join, mistakes, numMath, numText, pickN, q, visual } from "./kit";

// ---------------------------------------------------------------------------
// Abiotic or biotic?

const ABIOTIC: Text[] = [
  tx("the temperature of the water", "die Temperatur des Wassers"),
  tx("the light on the forest floor", "das Licht am Waldboden"),
  tx("the pH value of the soil", "der pH-Wert des Bodens"),
  tx("the wind on the coast", "der Wind an der Küste"),
  tx("the salt content of the sea", "der Salzgehalt im Meer"),
  tx("the amount of rain", "die Niederschlagsmenge"),
  tx("the oxygen content of a lake", "der Sauerstoffgehalt im See"),
  tx("frost in winter", "Frost im Winter"),
  tx("the minerals in the soil", "der Mineralstoffgehalt des Bodens"),
];
const BIOTIC: Text[] = [
  tx("predators", "Fressfeinde"),
  tx("pathogens such as viruses and bacteria", "Krankheitserreger wie Viren und Bakterien"),
  tx("competitors for food", "Konkurrenten um Nahrung"),
  tx("parasites such as ticks", "Parasiten wie Zecken"),
  tx("pollinators such as bees", "Bestäuber wie Bienen"),
  tx("prey animals", "Beutetiere"),
  tx("fungi living together with tree roots", "Pilze, die mit Baumwurzeln zusammenleben"),
];
const AB: Text[] = [tx("Abiotic factor", "Abiotischer Faktor"), tx("Biotic factor", "Biotischer Faktor")];

export function factorTask(rng: Rng): Exercise {
  const biotic = rng.chance(0.45);
  const item = rng.pick(biotic ? BIOTIC : ABIOTIC);
  const answer: AnswerSpec = { kind: "choice", options: AB, correct: biotic ? 1 : 0 };
  const tiny = biotic && /bacteria|fungi/.test(en(item));
  const list: Mistake[] = [
    biotic
      ? {
          when: { kind: "choice", options: AB, correct: 0 },
          title: tx("Living things", "Lebewesen"),
          say: tiny
            ? tx("Even microbes and fungi are living things. Everything that comes from other organisms is a biotic factor.", "Auch Mikroben und Pilze sind Lebewesen. Alles, was von anderen Lebewesen ausgeht, ist ein biotischer Faktor.")
            : tx("These are living things. Influences from other organisms are biotic factors.", "Das sind Lebewesen. Einflüsse durch andere Lebewesen sind biotische Faktoren."),
        }
      : {
          when: { kind: "choice", options: AB, correct: 1 },
          title: tx("Not alive", "Nicht lebendig"),
          say: tx("This is a physical or chemical condition, not a living thing: an abiotic factor (a = not, bios = life).", "Das ist eine physikalische oder chemische Bedingung, kein Lebewesen: ein abiotischer Faktor (a = nicht, bios = Leben)."),
        },
  ];
  return {
    instruction: tx("Abiotic or biotic?", "Abiotisch oder biotisch?"),
    text: tx(`**${cap(en(item))}**: abiotic or biotic factor?`, `**${cap(de(item))}**: abiotischer oder biotischer Faktor?`),
    answer,
    hint: tx("Abiotic: non-living conditions (physical, chemical). Biotic: influences from other living things.", "Abiotisch: unbelebte Bedingungen (physikalisch, chemisch). Biotisch: Einflüsse durch andere Lebewesen."),
    solution: [
      { math: join(q(capT(item), "i"), "\\Rightarrow#r", q(AB[biotic ? 1 : 0], "f")), note: biotic ? tx("It comes from living things: **biotic**.", "Es geht von Lebewesen aus: **biotisch**.") : tx("It is a non-living condition: **abiotic**.", "Es ist eine unbelebte Bedingung: **abiotisch**."), highlight: ["f"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Relationships between species

type Rel = "competition" | "predation" | "parasitism" | "symbiosis";
const REL_NAME: Record<Rel, Text> = {
  competition: tx("Competition", "Konkurrenz"),
  predation: tx("Predator and prey", "Räuber-Beute-Beziehung"),
  parasitism: tx("Parasitism", "Parasitismus"),
  symbiosis: tx("Symbiosis", "Symbiose"),
};
const RELS: Rel[] = ["competition", "predation", "parasitism", "symbiosis"];

const CASES: { rel: Rel; text: Text }[] = [
  { rel: "parasitism", text: tx("A tick sucks blood from a roe deer for several days.", "Eine Zecke saugt mehrere Tage lang Blut an einem Reh.") },
  { rel: "parasitism", text: tx("A tapeworm lives in the gut of a fox and absorbs digested food.", "Ein Bandwurm lebt im Darm eines Fuchses und nimmt verdaute Nahrung auf.") },
  { rel: "parasitism", text: tx("Mistletoe grows on an apple tree and taps its water and minerals.", "Eine Mistel wächst auf einem Apfelbaum und zapft sein Wasser und seine Mineralstoffe an.") },
  { rel: "parasitism", text: tx("Fleas live in the spines of a hedgehog and suck its blood.", "Flöhe leben zwischen den Stacheln eines Igels und saugen sein Blut.") },
  { rel: "symbiosis", text: tx("In a lichen, algae supply a fungus with sugar; the fungus gives water, minerals and protection.", "In einer Flechte versorgen Algen einen Pilz mit Zucker; der Pilz liefert Wasser, Mineralstoffe und Schutz.") },
  { rel: "symbiosis", text: tx("Fungal threads wrap around the roots of a beech: the tree gets water and minerals, the fungus gets sugar.", "Pilzfäden umhüllen die Wurzeln einer Buche: Der Baum erhält Wasser und Mineralstoffe, der Pilz Zucker.") },
  { rel: "symbiosis", text: tx("Nodule bacteria in clover roots fix nitrogen from the air; the clover feeds them sugar.", "Knöllchenbakterien in Kleewurzeln binden Luftstickstoff; der Klee versorgt sie mit Zucker.") },
  { rel: "symbiosis", text: tx("Ants protect aphids from ladybirds and in return lick their sweet honeydew.", "Ameisen schützen Blattläuse vor Marienkäfern und lecken dafür ihren süßen Honigtau.") },
  { rel: "competition", text: tx("Fox and common buzzard both hunt voles on the same meadow.", "Fuchs und Mäusebussard jagen beide Feldmäuse auf derselben Wiese.") },
  { rel: "competition", text: tx("Young beeches and oaks grow side by side and struggle for light.", "Junge Buchen und Eichen wachsen nebeneinander und ringen um Licht.") },
  { rel: "competition", text: tx("Great tits and nuthatches both need tree holes for nesting, but there are only a few.", "Kohlmeisen und Kleiber brauchen beide Baumhöhlen zum Brüten, davon gibt es aber nur wenige.") },
  { rel: "competition", text: tx("Dandelion and grass take water and minerals from the same soil.", "Löwenzahn und Gras nehmen Wasser und Mineralstoffe aus demselben Boden auf.") },
  { rel: "predation", text: tx("A lynx stalks and kills a roe deer.", "Ein Luchs schleicht sich an ein Reh an und erlegt es.") },
  { rel: "predation", text: tx("A pike catches and eats a roach.", "Ein Hecht fängt ein Rotauge und frisst es.") },
  { rel: "predation", text: tx("A ladybird eats about 50 aphids a day.", "Ein Marienkäfer frisst täglich etwa 50 Blattläuse.") },
  { rel: "predation", text: tx("A sparrowhawk hunts great tits at the edge of the forest.", "Ein Sperber jagt Kohlmeisen am Waldrand.") },
];

const REL_SAY: Partial<Record<`${Rel}>${Rel}`, [Text, Text]>> = {
  "parasitism>predation": [tx("The host stays alive", "Der Wirt überlebt"), tx("A parasite usually doesn't kill its host: it lives on or in it and uses it for a long time. A predator kills its prey.", "Ein Parasit tötet seinen Wirt meist nicht: Er lebt auf oder in ihm und nutzt ihn lange aus. Ein Räuber tötet seine Beute.")],
  "parasitism>symbiosis": [tx("Only one profits", "Nur einer profitiert"), tx("Only one side profits here, the other is harmed. In a symbiosis both partners profit.", "Hier hat nur einer einen Vorteil, der andere wird geschädigt. Bei einer Symbiose profitieren beide.")],
  "parasitism>competition": [tx("Not the same resource", "Nicht dieselbe Ressource"), tx("Competitors use the same scarce resource. Here one lives at the cost of the other: parasitism.", "Konkurrenten nutzen dieselbe knappe Ressource. Hier lebt einer auf Kosten des anderen: Parasitismus.")],
  "symbiosis>parasitism": [tx("Both profit", "Beide profitieren"), tx("Look again: both partners get something. That's a symbiosis, not parasitism.", "Schau noch mal: Beide Partner bekommen etwas. Das ist eine Symbiose, kein Parasitismus.")],
  "symbiosis>competition": [tx("They help each other", "Sie helfen sich"), tx("Competitors fight over the same resource. These partners help each other: symbiosis.", "Konkurrenten streiten um dieselbe Ressource. Diese Partner helfen sich gegenseitig: Symbiose.")],
  "symbiosis>predation": [tx("Nobody gets eaten", "Keiner wird gefressen"), tx("Nobody gets eaten here, both profit: symbiosis.", "Hier wird keiner gefressen, beide profitieren: Symbiose.")],
  "competition>predation": [tx("Nobody eats the other", "Keiner frisst den anderen"), tx("Neither eats the other. Both want the same resource: competition.", "Keiner frisst den anderen. Beide wollen dieselbe Ressource: Konkurrenz.")],
  "competition>symbiosis": [tx("Both lose", "Beide haben Nachteile"), tx("Living side by side isn't a symbiosis. They take the same scarce resource away from each other: competition.", "Nebeneinander leben ist noch keine Symbiose. Sie nehmen sich gegenseitig dieselbe knappe Ressource weg: Konkurrenz.")],
  "competition>parasitism": [tx("Same resource", "Dieselbe Ressource"), tx("Nobody lives on or in the other. Both use the same resource: competition.", "Keiner lebt auf oder in dem anderen. Beide nutzen dieselbe Ressource: Konkurrenz.")],
  "predation>parasitism": [tx("The prey dies", "Die Beute stirbt"), tx("The prey is killed and eaten: predator and prey. A parasite keeps its host alive.", "Die Beute wird getötet und gefressen: Räuber und Beute. Ein Parasit lässt seinen Wirt meist leben.")],
  "predation>competition": [tx("One eats the other", "Einer frisst den anderen"), tx("Here one eats the other: predator and prey.", "Hier frisst einer den anderen: Räuber und Beute.")],
  "predation>symbiosis": [tx("Only one profits", "Nur einer profitiert"), tx("The prey certainly doesn't profit. One eats the other: predator and prey.", "Die Beute hat sicher keinen Vorteil. Einer frisst den anderen: Räuber und Beute.")],
};

export function relationTask(rng: Rng, c = rng.pick(CASES)): Exercise {
  const others = RELS.filter((r) => r !== c.rel);
  const { answer, mistakes: list } = choice(rng, [
    { text: REL_NAME[c.rel] },
    ...others.map((o) => {
      const s = REL_SAY[`${c.rel}>${o}`]!;
      return { text: REL_NAME[o], title: s[0], say: s[1] };
    }),
  ]);
  const sign: Record<Rel, string> = { competition: "(-/-)", predation: "(+/-)", parasitism: "(+/-)", symbiosis: "(+/+)" };
  return {
    instruction: tx("Name the relationship", "Benenne die Beziehung"),
    text: c.text,
    answer,
    hint: tx("Who profits, who is harmed? Is anyone killed? Do both use the same resource?", "Wer hat einen Vorteil, wer einen Nachteil? Wird jemand getötet? Nutzen beide dieselbe Ressource?"),
    solution: [
      {
        math: join(q(REL_NAME[c.rel], "r"), sign[c.rel]),
        note:
          c.rel === "symbiosis"
            ? tx("Both partners profit (+/+): **symbiosis**.", "Beide Partner haben einen Vorteil (+/+): **Symbiose**.")
            : c.rel === "parasitism"
              ? tx("The parasite profits, the host is harmed but usually survives (+/−): **parasitism**.", "Der Parasit profitiert, der Wirt wird geschädigt, überlebt aber meist (+/−): **Parasitismus**.")
              : c.rel === "predation"
                ? tx("The predator kills and eats its prey (+/−): **predator and prey**.", "Der Räuber tötet und frisst seine Beute (+/−): **Räuber-Beute-Beziehung**.")
                : tx("Both need the same scarce resource and take it from each other (−/−): **competition**.", "Beide brauchen dieselbe knappe Ressource und nehmen sie sich gegenseitig weg (−/−): **Konkurrenz**."),
        highlight: ["r"],
      },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Tolerance curves

export type Factor = { name: Text; unit: string; organism: Text; xMin: number; xMax: number; step: number; curves: { min: number; opt: number; max: number }[] };

function makeFactor(rng: Rng): Factor {
  const k = rng.int(0, 2);
  if (k === 0) {
    const min = rng.pick([0, 5]);
    const opt = min + rng.pick([10, 15, 20]);
    const max = Math.min(40, opt + rng.pick([5, 10, 15]));
    return { name: tx("temperature in °C", "Temperatur in °C"), unit: "°C", organism: rng.pick([tx("a fish species", "eine Fischart"), tx("a snail species", "eine Schneckenart"), tx("a beetle species", "eine Käferart")]), xMin: 0, xMax: 40, step: 5, curves: [{ min, opt, max }] };
  }
  if (k === 1) {
    const min = rng.pick([3, 4, 5]);
    const opt = min + rng.pick([2, 3]);
    const max = Math.min(10, opt + rng.pick([1, 2, 3]));
    return { name: tx("pH value of the soil", "pH-Wert des Bodens"), unit: "", organism: rng.pick([tx("a plant species", "eine Pflanzenart"), tx("a moss species", "eine Moosart")]), xMin: 2, xMax: 10, step: 1, curves: [{ min, opt, max }] };
  }
  const min = rng.pick([0, 5, 10]);
  const opt = min + rng.pick([10, 15]);
  const max = Math.min(40, opt + rng.pick([5, 10]));
  return { name: tx("salt content in ‰", "Salzgehalt in ‰"), unit: "‰", organism: rng.pick([tx("a crab species", "eine Krebsart"), tx("a mussel species", "eine Muschelart")]), xMin: 0, xMax: 40, step: 5, curves: [{ min, opt, max }] };
}

const unitText = (f: Factor) => (f.unit ? ` ${f.unit}` : "");

export function toleranceReadTask(rng: Rng, fixed?: { f: Factor; ask: "opt" | "range" | "min" | "max" }): Exercise {
  const f = fixed?.f ?? makeFactor(rng);
  const c = f.curves[0];
  const ask = fixed?.ask ?? rng.pick(["opt", "range", "min", "max"] as const);
  const value = ask === "opt" ? c.opt : ask === "range" ? c.max - c.min : ask === "min" ? c.min : c.max;
  const answer: AnswerSpec = { kind: "number", value, tolerance: (f.step * 0.3) / Math.max(1, value), unit: f.unit || undefined };
  const m = mistakes(answer);
  if (ask === "range") {
    m.add({ kind: "number", value: c.max }, tx("Only the maximum", "Nur das Maximum"), tx("That's only the upper limit. The range of tolerance runs from the minimum to the maximum: subtract them.", "Das ist nur die obere Grenze. Der Toleranzbereich reicht vom Minimum bis zum Maximum: Zieh sie voneinander ab."));
    m.add({ kind: "number", value: c.opt - c.min }, tx("Up to the optimum only", "Nur bis zum Optimum"), tx("The range of tolerance doesn't end at the optimum. It runs all the way to the maximum.", "Der Toleranzbereich endet nicht beim Optimum. Er reicht bis zum Maximum."));
  }
  if (ask === "opt") {
    m.add({ kind: "number", value: (c.min + c.max) / 2 }, tx("Not simply the middle", "Nicht einfach die Mitte"), tx("The optimum is where the curve is highest. That isn't always the middle of the range.", "Das Optimum liegt dort, wo die Kurve am höchsten ist. Das ist nicht immer die Mitte des Bereichs."), true);
    m.add({ kind: "number", value: c.max }, tx("That's the maximum", "Das ist das Maximum"), tx("At the maximum the curve hits zero: the organism dies there. The optimum is the top of the curve.", "Beim Maximum erreicht die Kurve null: Dort stirbt das Lebewesen. Das Optimum ist der Gipfel der Kurve."));
  }
  if (ask === "min") m.add({ kind: "number", value: c.max }, tx("Other end", "Anderes Ende"), tx("That's the upper limit. The minimum is where the curve starts on the left.", "Das ist die obere Grenze. Das Minimum ist dort, wo die Kurve links beginnt."));
  if (ask === "max") m.add({ kind: "number", value: c.min }, tx("Other end", "Anderes Ende"), tx("That's the lower limit. The maximum is where the curve ends on the right.", "Das ist die untere Grenze. Das Maximum ist dort, wo die Kurve rechts endet."));
  const what: Record<typeof ask, [Text, Text]> = {
    opt: [tx("At which value is the optimum?", "Bei welchem Wert liegt das Optimum?"), tx("The optimum is the top of the curve.", "Das Optimum ist der Gipfel der Kurve.")],
    range: [tx("How wide is the range of tolerance?", "Wie groß ist der Toleranzbereich?"), tx("Range of tolerance = maximum − minimum.", "Toleranzbereich = Maximum − Minimum.")],
    min: [tx("Where is the minimum?", "Wo liegt das Minimum?"), tx("The minimum is the lowest value at which the organism can still survive.", "Das Minimum ist der niedrigste Wert, bei dem das Lebewesen gerade noch überlebt.")],
    max: [tx("Where is the maximum?", "Wo liegt das Maximum?"), tx("The maximum is the highest value at which the organism can still survive.", "Das Maximum ist der höchste Wert, bei dem das Lebewesen gerade noch überlebt.")],
  };
  return {
    instruction: tx("Read the tolerance curve", "Lies die Toleranzkurve ab"),
    text: tx(`Tolerance curve of ${en(f.organism)} for the factor ${en(f.name).replace(/ in .*$/, "")}. ${en(what[ask][0])}`, `Toleranzkurve ${de(f.organism).replace(/^eine/, "einer")} für den Faktor ${de(f.name).replace(/ in .*$/, "").replace(/ des Bodens$/, "")}. ${de(what[ask][0])}`),
    visual: visual(ToleranceChart, { curves: f.curves, xMin: f.xMin, xMax: f.xMax, xStep: f.step, xName: f.name }),
    answer,
    hint: what[ask][1],
    solution:
      ask === "range"
        ? [
            { math: tx(`"min" = ${c.min}${unitText(f) ? ` "${f.unit}"` : ""} \\quad "max" = ${c.max}${unitText(f) ? ` "${f.unit}"` : ""}`, `"Min" = ${c.min}${unitText(f) ? ` "${f.unit}"` : ""} \\quad "Max" = ${c.max}${unitText(f) ? ` "${f.unit}"` : ""}`), note: tx("Read off where the curve starts and ends.", "Lies ab, wo die Kurve beginnt und endet.") },
            { math: tx(`${c.max} - ${c.min} = ${value}#r${unitText(f) ? ` "${f.unit}"` : ""}`, `${c.max} - ${c.min} = ${value}#r${unitText(f) ? ` "${f.unit}"` : ""}`), note: tx(`The range of tolerance is **${value}${unitText(f)}** wide.`, `Der Toleranzbereich ist **${value}${unitText(f)}** groß.`), highlight: ["r"] },
          ]
        : [{ math: tx(`"${ask === "opt" ? "optimum" : ask === "min" ? "minimum" : "maximum"}" = ${value}#r${unitText(f) ? ` "${f.unit}"` : ""}`, `"${ask === "opt" ? "Optimum" : ask === "min" ? "Minimum" : "Maximum"}" = ${value}#r${unitText(f) ? ` "${f.unit}"` : ""}`), note: what[ask][1], highlight: ["r"] }],
    mistakes: m.list,
  };
}

const LETTERS = ["A", "B", "C", "D"];

export function toleranceZoneTask(rng: Rng): Exercise {
  const f = makeFactor(rng);
  const c = f.curves[0];
  // four points: optimum, pessimum (near a limit), outside the range, in between
  const lowSide = rng.chance(0.5) && c.opt - c.min >= 2 * f.step;
  const pess = lowSide ? c.min + (c.opt - c.min) * 0.12 : c.max - (c.max - c.opt) * 0.12;
  const outside = c.max + f.step <= f.xMax ? c.max + f.step * 0.6 : c.min - f.step * 0.6;
  const mid = crossings(c, 0.6)[lowSide ? 1 : 0];
  const pts = rng.shuffle([
    { kind: "opt" as const, x: c.opt },
    { kind: "pess" as const, x: pess },
    { kind: "out" as const, x: outside },
    { kind: "mid" as const, x: mid },
  ]).map((p, i) => ({ ...p, label: LETTERS[i] }));
  const askKind = rng.pick(["opt", "pess", "out"] as const);
  const options = pts.map((p) => tx(`Point ${p.label}`, `Punkt ${p.label}`));
  const correct = pts.findIndex((p) => p.kind === askKind);
  const say: Record<"opt" | "pess" | "out" | "mid", [Text, Text]> = {
    opt: [tx("That's the optimum", "Das ist das Optimum"), tx("There the curve is at its highest: the organism thrives and reproduces best.", "Dort ist die Kurve am höchsten: Dem Lebewesen geht es am besten, es vermehrt sich am stärksten.")],
    pess: [tx("That's the pessimum", "Das ist das Pessimum"), tx("Close to a limit the organism only just survives and can't reproduce: pessimum.", "Nahe einer Grenze überlebt das Lebewesen gerade noch, pflanzt sich aber nicht fort: Pessimum.")],
    out: [tx("Outside the range", "Außerhalb des Bereichs"), tx("There the curve is at zero: outside the range of tolerance the organism dies.", "Dort ist die Kurve bei null: Außerhalb des Toleranzbereichs stirbt das Lebewesen.")],
    mid: [tx("Fine, but not best", "Gut, aber nicht am besten"), tx("There it lives well, but it's neither the best value nor close to a limit.", "Dort lebt es gut, aber das ist weder der beste Wert noch nahe an einer Grenze.")],
  };
  const list: Mistake[] = pts
    .map((p, i) => (p.kind === askKind ? null : { when: { kind: "choice" as const, options, correct: i }, title: say[p.kind][0], say: say[p.kind][1] }))
    .filter((x): x is NonNullable<typeof x> => !!x);
  const question: Record<typeof askKind, Text> = {
    opt: tx("At which point does the species thrive and reproduce best?", "An welchem Punkt geht es der Art am besten, sodass sie sich am stärksten vermehrt?"),
    pess: tx("At which point does the species survive but cannot reproduce?", "An welchem Punkt überlebt die Art zwar, kann sich aber nicht fortpflanzen?"),
    out: tx("At which point can the species not survive?", "An welchem Punkt kann die Art nicht überleben?"),
  };
  const zoneName: Record<typeof askKind, Text> = { opt: tx("optimum", "Optimum"), pess: tx("pessimum", "Pessimum"), out: tx("outside the range of tolerance", "außerhalb des Toleranzbereichs") };
  return {
    instruction: tx("Optimum, pessimum or outside?", "Optimum, Pessimum oder außerhalb?"),
    text: tx(`Tolerance curve of ${en(f.organism)}. ${en(question[askKind])}`, `Toleranzkurve ${de(f.organism).replace(/^eine/, "einer")}. ${de(question[askKind])}`),
    visual: visual(ToleranceChart, { curves: f.curves, xMin: f.xMin, xMax: f.xMax, xStep: f.step, xName: f.name, points: pts.map((p) => ({ x: p.x, label: p.label })) }),
    answer: { kind: "choice", options, correct },
    hint: tx("Optimum: top of the curve. Pessimum: close to the minimum or maximum, curve very low. Outside: the curve is at zero.", "Optimum: Gipfel der Kurve. Pessimum: nahe Minimum oder Maximum, Kurve sehr niedrig. Außerhalb: Kurve bei null."),
    solution: [{ math: join(q(tx(`point ${pts[correct].label}`, `Punkt ${pts[correct].label}`), "p"), "\\Rightarrow#r", q(zoneName[askKind], "z")), note: say[askKind][1], highlight: ["z"] }],
    mistakes: list,
  };
}

export function stenoTask(rng: Rng): Exercise {
  const opt1 = rng.pick([10, 15, 20]);
  const narrow = { min: opt1 - 5, opt: opt1, max: opt1 + 5 };
  const opt2 = rng.pick([15, 20, 25].filter((o) => o !== opt1));
  const wide = { min: Math.max(0, opt2 - 15), opt: opt2, max: Math.min(40, opt2 + rng.pick([10, 15])) };
  const narrowFirst = rng.chance(0.5);
  const curves = narrowFirst ? [{ ...narrow, label: "A" }, { ...wide, label: "B" }] : [{ ...wide, label: "A" }, { ...narrow, label: "B" }];
  const askSteno = rng.chance(0.5);
  const options = [tx("Species A", "Art A"), tx("Species B", "Art B")];
  const correct = askSteno === narrowFirst ? 0 : 1;
  const word = askSteno ? tx("stenothermal (stenoecious)", "stenotherm (stenök)") : tx("eurythermal (euryoecious)", "eurytherm (euryök)");
  const list: Mistake[] = [
    {
      when: { kind: "choice", options, correct: 1 - correct },
      title: tx("Narrow or wide?", "Eng oder weit?"),
      say: askSteno
        ? tx("Steno means narrow: look for the species that only tolerates a small range of temperatures. The height of the curve doesn't matter.", "Steno heißt eng: Such die Art, die nur einen kleinen Temperaturbereich verträgt. Die Höhe der Kurve spielt keine Rolle.")
        : tx("Eury means wide: look for the species that tolerates a large range of temperatures, from minimum to maximum.", "Eury heißt weit: Such die Art, die einen großen Temperaturbereich verträgt, vom Minimum bis zum Maximum."),
    },
  ];
  return {
    instruction: tx("Stenoecious or euryoecious?", "Stenök oder euryök?"),
    text: tx(`The graph shows the tolerance curves of two fish species for temperature. Which species is **${en(word)}**?`, `Das Diagramm zeigt die Toleranzkurven zweier Fischarten für die Temperatur. Welche Art ist **${de(word)}**?`),
    visual: visual(ToleranceChart, { curves, xMin: 0, xMax: 40, xStep: 5, xName: tx("temperature in °C", "Temperatur in °C") }),
    answer: { kind: "choice", options, correct },
    hint: tx("Steno = narrow, eury = wide. Compare the width of the curves from minimum to maximum.", "Steno = eng, eury = weit. Vergleich die Breite der Kurven vom Minimum bis zum Maximum."),
    solution: [
      { math: tx(`"range A:" \\; ${curves[0].max - curves[0].min} "°C" \\quad "range B:" \\; ${curves[1].max - curves[1].min} "°C"`, `"Bereich A:" \\; ${curves[0].max - curves[0].min} "°C" \\quad "Bereich B:" \\; ${curves[1].max - curves[1].min} "°C"`), note: tx("Compare the ranges of tolerance.", "Vergleich die Toleranzbereiche.") },
      { math: join(q(options[correct], "s"), "\\Rightarrow#r", q(word, "w")), note: askSteno ? tx("The narrower range of tolerance: **stenothermal**.", "Der engere Toleranzbereich: **stenotherm**.") : tx("The wider range of tolerance: **eurythermal**.", "Der weitere Toleranzbereich: **eurytherm**."), highlight: ["w"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Indicator plants

type Site = "nitrogen" | "acid" | "wet" | "lime";
const SITE: Record<Site, Text> = {
  nitrogen: tx("soil rich in nitrogen", "stickstoffreicher Boden"),
  acid: tx("acidic, nutrient-poor soil", "saurer, nährstoffarmer Boden"),
  wet: tx("wet soil", "nasser Boden"),
  lime: tx("soil rich in lime (calcium)", "kalkreicher Boden"),
};
const INDICATORS: { name: Text; site: Site }[] = [
  { name: tx("stinging nettle", "Brennnessel"), site: "nitrogen" },
  { name: tx("ground elder", "Giersch"), site: "nitrogen" },
  { name: tx("elder", "Schwarzer Holunder"), site: "nitrogen" },
  { name: tx("heather", "Heidekraut"), site: "acid" },
  { name: tx("bilberry", "Heidelbeere"), site: "acid" },
  { name: tx("marsh marigold", "Sumpfdotterblume"), site: "wet" },
  { name: tx("cuckooflower", "Wiesenschaumkraut"), site: "wet" },
  { name: tx("liverleaf (hepatica)", "Leberblümchen"), site: "lime" },
  { name: tx("pasque flower", "Küchenschelle"), site: "lime" },
];

export function indicatorTask(rng: Rng): Exercise {
  const p = rng.pick(INDICATORS);
  const others = (Object.keys(SITE) as Site[]).filter((s) => s !== p.site);
  const { answer, mistakes: list } = choice(rng, [
    { text: capT(SITE[p.site]) },
    ...others.map((s) => ({ text: capT(SITE[s]), title: tx("Another site", "Ein anderer Standort"), say: tx(`For ${en(SITE[s])} other plants are typical. The ${en(p.name)} shows: ${en(SITE[p.site])}.`, `Für ${de(SITE[s])} sind andere Pflanzen typisch. ${de(p.name)} zeigt: ${de(SITE[p.site])}.`) })),
  ]);
  return {
    instruction: tx("Read the indicator plant", "Deute die Zeigerpflanze"),
    text: tx(`Lots of **${en(p.name)}** grows in one place. What does this indicator plant tell you about the site?`, `An einer Stelle wächst sehr viel **${de(p.name)}**. Was verrät diese Zeigerpflanze über den Standort?`),
    answer,
    hint: tx("Indicator plants have a narrow range of tolerance for one soil factor.", "Zeigerpflanzen haben für einen Bodenfaktor einen engen Toleranzbereich."),
    solution: [{ math: join(q(capT(p.name), "p"), "\\Rightarrow#r", q(SITE[p.site], "s")), note: tx(`The ${en(p.name)} indicates **${en(SITE[p.site])}**.`, `${de(p.name)} zeigt **${de(SITE[p.site])}** an.`), highlight: ["s"] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Energy flow: the 10 % rule

const LEVEL: Text[] = [tx("producers", "Produzenten"), tx("primary consumers", "Konsumenten 1. Ordnung"), tx("secondary consumers", "Konsumenten 2. Ordnung"), tx("tertiary consumers", "Konsumenten 3. Ordnung")];

export function energyForwardTask(rng: Rng, e0 = rng.pick([10000, 20000, 30000, 50000, 80000, 120000, 6000, 4000]), n = rng.int(1, 3)): Exercise {
  const value = e0 / 10 ** n;
  const answer: AnswerSpec = { kind: "number", value, unit: "kJ", tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: e0 * 0.9 ** n }, tx("90 % passed on?", "90 % weitergegeben?"), tx("It's the other way round: only about 10 % reach the next level, about 90 % are lost (mostly as heat).", "Umgekehrt: Nur etwa 10 % kommen auf der nächsten Stufe an, rund 90 % gehen verloren (vor allem als Wärme)."));
  m.add({ kind: "number", value: e0 / 10 ** (n + 1) }, tx("One step too many", "Ein Schritt zu viel"), tx(`From the producers to the ${en(LEVEL[n])} there are ${n} step${n > 1 ? "s" : ""}. Did you count the producers as a step too?`, `Von den Produzenten bis zu den ${de(LEVEL[n])} sind es ${n} Schritt${n > 1 ? "e" : ""}. Hast du die Produzenten als Schritt mitgezählt?`), true);
  if (n > 1) m.add({ kind: "number", value: e0 / 10 ** (n - 1) }, tx("One step missing", "Ein Schritt fehlt"), tx("Go level by level: each step up keeps only 10 %.", "Geh Stufe für Stufe vor: Bei jedem Schritt nach oben bleiben nur 10 %."), true);
  if (n > 1) m.add({ kind: "number", value: e0 * 0.1 * n }, tx("10 % of 10 %", "10 % von 10 %"), tx("Each step takes 10 % of the level below, not of the producers again. Divide by 10 at every step.", "Jeder Schritt nimmt 10 % der Stufe darunter, nicht wieder der Produzenten. Teile bei jedem Schritt durch 10."));
  const steps = Array.from({ length: n + 1 }, (_, i) => e0 / 10 ** i);
  return {
    instruction: tx("Use the 10 % rule", "Rechne mit der 10-%-Regel"),
    text: tx(
      `The producers of an ecosystem store ${en(numText(e0))} kJ of energy per square metre and year. How much energy reaches the **${en(LEVEL[n])}**, according to the 10 % rule?`,
      `Die Produzenten eines Ökosystems speichern pro Quadratmeter und Jahr ${de(numText(e0))} kJ Energie. Wie viel Energie kommt nach der 10-%-Regel bei den **${de(LEVEL[n])}** an?`,
    ),
    answer,
    hint: tx("Only about 10 % of the energy reaches the next level: divide by 10 at each step.", "Nur etwa 10 % der Energie kommen auf der nächsten Stufe an: Teile bei jedem Schritt durch 10."),
    solution: [
      { math: tx(steps.map((v, i) => `${en(numMath(v))}#v${i}`).join(" \\to "), steps.map((v, i) => `${de(numMath(v))}#v${i}`).join(" \\to ")), note: tx("Divide by 10 at each step.", "Bei jedem Schritt durch 10 teilen.") },
      { math: tx(`${en(numMath(value))}#v${n} "kJ"`, `${de(numMath(value))}#v${n} "kJ"`), note: tx(`The ${en(LEVEL[n])} get about **${en(numText(value))} kJ**. The rest is mostly released as heat by cellular respiration.`, `Bei den ${de(LEVEL[n])} kommen etwa **${de(numText(value))} kJ** an. Der Rest wird vor allem bei der Zellatmung als Wärme abgegeben.`), highlight: [`v${n}`] },
    ],
    mistakes: m.list,
  };
}

export function energyBackwardTask(rng: Rng): Exercise {
  const x = rng.pick([5, 8, 10, 20, 25, 40, 50, 60]);
  const n = rng.int(2, 3);
  const value = x * 10 ** n;
  const animal = n === 2 ? rng.pick([tx("a pike (2nd order)", "ein Hecht (2. Ordnung)"), tx("a tawny owl (2nd order)", "ein Waldkauz (2. Ordnung)"), tx("a fox (2nd order)", "ein Fuchs (2. Ordnung)")]) : rng.pick([tx("a sparrowhawk (3rd order)", "ein Sperber (3. Ordnung)"), tx("a white stork (3rd order)", "ein Weißstorch (3. Ordnung)"), tx("an osprey (3rd order)", "ein Fischadler (3. Ordnung)")]);
  const answer: AnswerSpec = { kind: "number", value, unit: "kJ", tolerance: 0.001 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: x * 10 ** (n - 1) }, tx("One level short", "Eine Stufe zu wenig"), tx(`A consumer of the ${n}${n === 2 ? "nd" : "rd"} order is ${n} steps above the producers. Multiply by 10 for each step.`, `Ein Konsument ${n}. Ordnung steht ${n} Stufen über den Produzenten. Für jede Stufe mal 10.`), true);
  m.add({ kind: "number", value: x * 10 ** (n + 1) }, tx("One level too many", "Eine Stufe zu viel"), tx("Count the steps between the levels, not the levels themselves.", "Zähl die Schritte zwischen den Stufen, nicht die Stufen selbst."), true);
  m.add({ kind: "number", value: x / 10 ** n }, tx("Wrong direction", "Falsche Richtung"), tx("Going down the pyramid there is MORE energy: the producers need much more than the top predator gets. Multiply instead of dividing.", "Nach unten wird die Energie MEHR: Die Produzenten brauchen viel mehr, als beim Endkonsumenten ankommt. Multipliziere statt zu teilen."));
  return {
    instruction: tx("Work backwards with the 10 % rule", "Rechne mit der 10-%-Regel rückwärts"),
    text: tx(
      `In a food chain, ${en(animal)} takes in ${x} kJ of energy with its food. How much energy must the producers at the start of the chain have stored for this (10 % rule)?`,
      `In einer Nahrungskette nimmt ${de(animal)} mit der Nahrung ${x} kJ Energie auf. Wie viel Energie mussten die Produzenten am Anfang der Kette dafür speichern (10-%-Regel)?`,
    ),
    answer,
    hint: tx("Going down one level, there is 10 times as much energy.", "Eine Stufe tiefer gibt es zehnmal so viel Energie."),
    solution: [
      { math: tx(`${x} "kJ" \\cdot 10^${n}`, `${x} "kJ" \\cdot 10^${n}`), note: tx(`${n} steps down, ten times as much each time.`, `${n} Stufen nach unten, jedes Mal zehnmal so viel.`) },
      { math: tx(`= ${en(numMath(value))}#r "kJ"`, `= ${de(numMath(value))}#r "kJ"`), note: tx(`The producers needed about **${en(numText(value))} kJ**.`, `Die Produzenten brauchten etwa **${de(numText(value))} kJ**.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

export function efficiencyTask(rng: Rng): Exercise {
  const lower = rng.pick([2000, 4000, 5000, 8000, 10000, 20000]);
  const pct = rng.pick([5, 8, 9, 11, 12, 15]);
  const upper = (lower * pct) / 100;
  const answer: AnswerSpec = { kind: "number", value: pct, unit: "%", tolerance: 0.02 };
  const m = mistakes(answer);
  m.add({ kind: "number", value: 100 - pct }, tx("That's the loss", "Das ist der Verlust"), tx("That's the share that is lost. The question asks what share is passed on.", "Das ist der Anteil, der verloren geht. Gefragt ist der Anteil, der weitergegeben wird."));
  m.add({ kind: "number", value: Math.round((lower / upper) * 100) / 100, tolerance: 0.02 }, tx("Upside down", "Verkehrt herum"), tx("Divide the energy of the higher level by that of the lower level: part ÷ whole.", "Teile die Energie der höheren Stufe durch die der niedrigeren: Teil ÷ Ganzes."));
  m.add({ kind: "number", value: pct / 100, tolerance: 0.02 }, tx("Times 100 missing", "Mal 100 fehlt"), tx("That's the share as a decimal. As a percentage, multiply by 100.", "Das ist der Anteil als Dezimalzahl. In Prozent musst du noch mal 100 rechnen."), true);
  const pair = rng.pick([
    [tx("the grass of a meadow", "das Gras einer Wiese"), tx("the grasshoppers", "die Heuschrecken")],
    [tx("the algae of a pond", "die Algen eines Teiches"), tx("the water fleas", "die Wasserflöhe")],
    [tx("the voles", "die Feldmäuse"), tx("the buzzards", "die Mäusebussarde")],
    [tx("the caterpillars", "die Raupen"), tx("the great tits", "die Kohlmeisen")],
  ]);
  return {
    instruction: tx("Calculate the transfer efficiency", "Berechne den Anteil, der weitergegeben wird"),
    text: tx(
      `${cap(en(pair[0]))} contain ${en(numText(lower))} kJ. ${cap(en(pair[1]))} that feed on them build up ${en(numText(upper))} kJ of it. What percentage of the energy is passed on?`,
      `${cap(de(pair[0]))} ${/^die /.test(de(pair[0])) ? "enthalten" : "enthält"} ${de(numText(lower))} kJ. ${cap(de(pair[1]))}, die sich davon ernähren, bauen davon ${de(numText(upper))} kJ auf. Wie viel Prozent der Energie werden weitergegeben?`,
    ),
    answer,
    hint: tx("Share = energy of the higher level ÷ energy of the lower level · 100 %.", "Anteil = Energie der höheren Stufe : Energie der niedrigeren Stufe · 100 %."),
    solution: [
      { math: tx(`\\frac{${en(numMath(upper))} "kJ"}{${en(numMath(lower))} "kJ"} \\cdot 100 "%"`, `\\frac{${de(numMath(upper))} "kJ"}{${de(numMath(lower))} "kJ"} \\cdot 100 "%"`), note: tx("Higher level divided by lower level.", "Höhere Stufe geteilt durch niedrigere Stufe.") },
      { math: `= ${pct}#r "%"`, note: tx(`**${pct} %** are passed on: close to the 10 % rule.`, `**${pct} %** werden weitergegeben: nahe an der 10-%-Regel.`), highlight: ["r"] },
    ],
    mistakes: m.list,
  };
}

const ENERGY_QS: { q: Text; right: Text; wrong: Opt3 }[] = [
  {
    q: tx("Which statement about energy and matter in an ecosystem is correct?", "Welche Aussage über Energie und Stoffe im Ökosystem stimmt?"),
    right: tx("Energy flows through the ecosystem, matter cycles.", "Energie fließt durch das Ökosystem, Stoffe kreisen."),
    wrong: [
      [tx("Decomposers recycle the energy and give it back to the plants.", "Destruenten recyceln die Energie und geben sie den Pflanzen zurück."), tx("Energy is not recycled", "Energie wird nicht recycelt"), tx("Decomposers return minerals, not energy. The energy leaves as heat and must keep coming from the sun.", "Destruenten geben Mineralstoffe zurück, keine Energie. Die Energie geht als Wärme verloren und muss ständig von der Sonne kommen.")],
      [tx("Matter flows through, energy cycles.", "Stoffe fließen durch, Energie kreist."), tx("Swapped round", "Vertauscht"), tx("It's the other way round: matter is reused again and again, energy is lost as heat.", "Genau umgekehrt: Stoffe werden immer wieder genutzt, Energie geht als Wärme verloren.")],
      [tx("Both energy and matter are lost step by step.", "Energie und Stoffe gehen Stufe für Stufe verloren."), tx("Matter stays", "Stoffe bleiben"), tx("Atoms don't disappear: decomposers return them to the soil and air. Only energy is lost as heat.", "Atome verschwinden nicht: Destruenten geben sie an Boden und Luft zurück. Nur Energie geht als Wärme verloren.")],
    ],
  },
  {
    q: tx("Where does most of the energy taken in with the food go?", "Wohin geht der größte Teil der Energie, die ein Tier mit der Nahrung aufnimmt?"),
    right: tx("It is used in cellular respiration and given off as heat.", "Er wird bei der Zellatmung genutzt und als Wärme abgegeben."),
    wrong: [
      [tx("It is built into body mass.", "Er wird in Körpermasse eingebaut."), tx("Only a small part", "Nur ein kleiner Teil"), tx("Only about 10 % ends up in body mass. Most is used for movement and body heat.", "Nur etwa 10 % landen in der Körpermasse. Das meiste wird für Bewegung und Körperwärme genutzt.")],
      [tx("It goes back into the soil and is taken up by plants again.", "Er geht zurück in den Boden und wird von Pflanzen wieder aufgenommen."), tx("Energy is not recycled", "Energie wird nicht recycelt"), tx("Plants take up minerals from the soil, but their energy comes only from light.", "Pflanzen nehmen Mineralstoffe aus dem Boden auf, ihre Energie kommt aber nur aus dem Licht.")],
      [tx("It is turned into oxygen.", "Er wird in Sauerstoff umgewandelt."), tx("Oxygen isn't energy", "Sauerstoff ist keine Energie"), tx("Animals use up oxygen in respiration; they don't make it from energy.", "Tiere verbrauchen Sauerstoff bei der Zellatmung; sie stellen ihn nicht aus Energie her.")],
    ],
  },
  {
    q: tx("Why are there only a few animals at the top of a food pyramid?", "Warum gibt es an der Spitze einer Nahrungspyramide nur wenige Tiere?"),
    right: tx("At each level about 90 % of the energy is lost, so little is left at the top.", "Auf jeder Stufe gehen etwa 90 % der Energie verloren, oben bleibt wenig übrig."),
    wrong: [
      [tx("Predators reproduce badly because they are big.", "Räuber vermehren sich schlecht, weil sie groß sind."), tx("It's about energy", "Es geht um Energie"), tx("Their size isn't the reason. There simply isn't enough energy left at the top to feed many of them.", "Die Größe ist nicht der Grund. Oben ist einfach nicht genug Energie übrig, um viele zu ernähren.")],
      [tx("The decomposers eat most of the predators.", "Die Destruenten fressen die meisten Räuber."), tx("Decomposers eat the dead", "Destruenten nutzen Totes"), tx("Decomposers break down dead remains; they don't hunt predators.", "Destruenten bauen tote Reste ab; sie jagen keine Räuber.")],
      [tx("The plants don't get enough light.", "Die Pflanzen bekommen zu wenig Licht."), tx("Look at the steps", "Schau auf die Stufen"), tx("The plants have plenty of energy. It's lost on the way up, at every step.", "Die Pflanzen haben viel Energie. Sie geht auf dem Weg nach oben verloren, bei jedem Schritt.")],
    ],
  },
];
type Opt3 = [Text, Text, Text][];

export function energyStatementTask(rng: Rng): Exercise {
  const Q = rng.pick(ENERGY_QS);
  const { answer, mistakes: list } = choice(rng, [{ text: Q.right }, ...Q.wrong.map(([text, title, say]) => ({ text, title, say }))]);
  return {
    instruction: tx("Energy flow", "Energiefluss"),
    text: Q.q,
    answer,
    hint: tx("Energy comes from the sun and leaves as heat. Matter is reused.", "Energie kommt von der Sonne und geht als Wärme verloren. Stoffe werden wiederverwendet."),
    solution: [{ math: tx('"energy flows,"#e \\; "matter cycles"#s', '"Energie fließt,"#e \\; "Stoffe kreisen"#s'), note: Q.right }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Carbon cycle

const CARBON_CONFUSE: Partial<Record<string, string[]>> = {
  photosynthesis: ["resp-plants", "decomposition", "feeding"],
  "resp-plants": ["photosynthesis", "resp-animals", "decomposition"],
  "resp-animals": ["resp-plants", "photosynthesis", "combustion"],
  feeding: ["photosynthesis", "death", "resp-animals"],
  death: ["decomposition", "feeding", "fossil"],
  decomposition: ["death", "resp-plants", "combustion"],
  fossil: ["death", "decomposition", "combustion"],
  combustion: ["fossil", "resp-animals", "decomposition"],
};

export function carbonPictureTask(rng: Rng): Exercise {
  const p = rng.pick(CARBON);
  const wrong = CARBON_CONFUSE[p.id]!.map((id) => CARBON.find((c) => c.id === id)!);
  const sayFor = (w: (typeof CARBON)[number]): Text =>
    w.id === "photosynthesis" || p.id === "photosynthesis"
      ? tx("Check the direction of the arrow: in photosynthesis CO₂ goes from the air INTO the plant.", "Achte auf die Pfeilrichtung: Bei der Fotosynthese geht CO₂ aus der Luft IN die Pflanze.")
      : tx(`Look where the arrow starts and where it ends. ${en(w.name)}: ${en(w.text)}`, `Schau, wo der Pfeil startet und wo er endet. ${de(w.name)}: ${de(w.text)}`);
  const { answer, mistakes: list } = choice(rng, [{ text: p.name }, ...wrong.map((w) => ({ text: w.name, title: tx("Another process", "Ein anderer Vorgang"), say: sayFor(w) }))]);
  return {
    instruction: tx("Name the process in the carbon cycle", "Benenne den Vorgang im Kohlenstoffkreislauf"),
    text: tx("Which process does the arrow marked **?** show?", "Welchen Vorgang zeigt der mit **?** markierte Pfeil?"),
    visual: visual(EcoCarbonCyclePicture, { ask: p.id }),
    answer,
    hint: tx("Where does the arrow start, where does it end? Is CO₂ taken from the air or released into it?", "Wo startet der Pfeil, wo endet er? Wird CO₂ der Luft entzogen oder an sie abgegeben?"),
    solution: [{ math: q(p.name, "p"), note: tx(`${en(p.text)} ${p.effect ? en(p.effect) : ""}`, `${de(p.text)} ${p.effect ? de(p.effect) : ""}`), highlight: ["p"] }],
    mistakes: list,
  };
}

const RELEASE: Text[] = [
  tx("cellular respiration of animals", "Zellatmung der Tiere"),
  tx("cellular respiration of plants", "Zellatmung der Pflanzen"),
  tx("decomposition by bacteria and fungi", "Zersetzung durch Bakterien und Pilze"),
  tx("burning natural gas", "Verbrennen von Erdgas"),
  tx("a forest fire", "ein Waldbrand"),
];
const BIND: Text[] = [tx("photosynthesis of trees", "Fotosynthese der Bäume"), tx("photosynthesis of algae", "Fotosynthese der Algen")];
const NEITHER: Text[] = [tx("formation of coal over millions of years", "Entstehung von Kohle über Jahrmillionen"), tx("a hare eating clover", "ein Hase frisst Klee")];

export function carbonMultiTask(rng: Rng, lesson = false): Exercise {
  const askRelease = lesson || rng.chance(0.65);
  const rel = pickN(rng, RELEASE, 3);
  const plantResp = RELEASE[1];
  if (askRelease && !rel.includes(plantResp) && (lesson || rng.chance(0.6))) rel[0] = plantResp;
  const items = rng.shuffle([...rel.map((t) => ({ t, k: "rel" as const })), ...pickN(rng, BIND, askRelease ? 1 : 2).map((t) => ({ t, k: "bind" as const })), { t: rng.pick(NEITHER), k: "none" as const }]);
  const options = items.map((x) => capT(x.t));
  const correct = items.map((x, i) => (x.k === (askRelease ? "rel" : "bind") ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  const idx = (t: Text) => items.findIndex((x) => x.t === t);
  if (askRelease) {
    if (idx(plantResp) >= 0)
      m.add({ kind: "multi", options, correct: correct.filter((i) => i !== idx(plantResp)) }, tx("Plants respire too", "Pflanzen atmen auch"), tx("Plants don't only do photosynthesis: they respire day and night and give off CO₂.", "Pflanzen betreiben nicht nur Fotosynthese: Sie atmen Tag und Nacht und geben dabei CO₂ ab."));
    const bindIdx = items.map((x, i) => (x.k === "bind" ? i : -1)).filter((i) => i >= 0);
    m.add({ kind: "multi", options, correct: [...correct, ...bindIdx].sort((a, b) => a - b) }, tx("Photosynthesis takes CO₂ in", "Fotosynthese nimmt CO₂ auf"), tx("Photosynthesis uses CO₂ from the air: it takes it out, it doesn't give it off.", "Die Fotosynthese verbraucht CO₂ aus der Luft: Sie entzieht es, statt es abzugeben."));
  } else {
    const respIdx = items.map((x, i) => (x.k === "rel" && /respiration/.test(en(x.t)) ? i : -1)).filter((i) => i >= 0);
    if (respIdx.length) m.add({ kind: "multi", options, correct: [...correct, ...respIdx].sort((a, b) => a - b) }, tx("Respiration releases CO₂", "Zellatmung setzt CO₂ frei"), tx("Cellular respiration breaks down glucose and gives off CO₂: it's the opposite of photosynthesis.", "Bei der Zellatmung wird Glucose abgebaut und CO₂ abgegeben: Sie ist das Gegenstück zur Fotosynthese."));
  }
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: askRelease ? tx("Which processes **release CO₂** into the air?", "Welche Vorgänge **geben CO₂** an die Luft ab?") : tx("Which processes **take CO₂ out** of the air?", "Welche Vorgänge **entziehen** der Luft **CO₂**?"),
    answer,
    hint: tx("Photosynthesis binds CO₂. Respiration (of all living things), decomposition and burning release it.", "Fotosynthese bindet CO₂. Zellatmung (aller Lebewesen), Zersetzung und Verbrennung setzen es frei."),
    solution: [
      { math: tx('"binds CO₂:"#b \\; "photosynthesis"#p', '"bindet CO₂:"#b \\; "Fotosynthese"#p'), note: tx("Only photosynthesis takes CO₂ out of the air.", "Nur die Fotosynthese entzieht der Luft CO₂.") },
      { math: tx('"releases CO₂:"#b \\; "respiration, decomposition, burning"#p', '"setzt CO₂ frei:"#b \\; "Zellatmung, Zersetzung, Verbrennung"#p'), note: tx("All living things respire, decomposers too. Burning releases CO₂ quickly.", "Alle Lebewesen atmen, auch die Destruenten. Verbrennung setzt CO₂ schnell frei.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Predator and prey

export function predatorCurveTask(rng: Rng): Exercise {
  const predLetter = rng.pick(["A", "B"] as const);
  const prey0 = rng.pick([40, 50, 60, 70, 80]);
  const pred0 = rng.pick([10, 12, 15, 25, 30]);
  const askPred = rng.chance(0.6);
  const options = [tx("Curve A", "Kurve A"), tx("Curve B", "Kurve B")];
  const predIdx = predLetter === "A" ? 0 : 1;
  const correct = askPred ? predIdx : 1 - predIdx;
  const list: Mistake[] = [
    {
      when: { kind: "choice", options, correct: 1 - correct },
      title: askPred ? tx("The predator comes later", "Der Räuber kommt später") : tx("The prey comes first", "Die Beute kommt zuerst"),
      say: tx(
        "The prey peaks first: only when there is lots of prey can the predators raise more young. So the predator curve follows the prey curve with a delay.",
        "Die Beute hat ihr Maximum zuerst: Erst wenn es viel Beute gibt, können die Räuber mehr Junge großziehen. Die Räuberkurve folgt der Beutekurve deshalb zeitversetzt.",
      ),
    },
  ];
  return {
    instruction: tx("Predator or prey?", "Räuber oder Beute?"),
    text: askPred ? tx("The graph shows a predator and its prey over many years. Which curve shows the **predator**?", "Das Diagramm zeigt einen Räuber und seine Beute über viele Jahre. Welche Kurve zeigt den **Räuber**?") : tx("The graph shows a predator and its prey over many years. Which curve shows the **prey**?", "Das Diagramm zeigt einen Räuber und seine Beute über viele Jahre. Welche Kurve zeigt die **Beute**?"),
    visual: visual(EcoPredatorPreyPicture, { prey0, pred0, letters: true, predLetter, T: 30 }),
    answer: { kind: "choice", options, correct },
    hint: tx("Which curve rises first? The other one follows it.", "Welche Kurve steigt zuerst an? Die andere folgt ihr."),
    solution: [
      { math: tx('"prey"#b \\uparrow \\to "predator"#r \\uparrow', '"Beute"#b \\uparrow \\to "Räuber"#r \\uparrow'), note: tx("First the prey increases, then the predator (it needs the food first).", "Zuerst nimmt die Beute zu, danach der Räuber (er braucht erst das Futter).") },
      { math: join(q(options[correct], "c"), "\\Rightarrow#e", q(askPred ? tx("predator", "Räuber") : tx("prey", "Beute"), "w")), note: askPred ? tx(`Curve ${predLetter} follows the other with a delay: the **predator**.`, `Kurve ${predLetter} folgt der anderen zeitversetzt: der **Räuber**.`) : tx(`Curve ${predLetter === "A" ? "B" : "A"} peaks first: the **prey**.`, `Kurve ${predLetter === "A" ? "B" : "A"} hat ihr Maximum zuerst: die **Beute**.`), highlight: ["w"] },
    ],
    mistakes: list,
  };
}

const CYCLE: Text[] = [
  tx("There is a lot of prey.", "Es gibt viele Beutetiere."),
  tx("The predators find plenty of food and raise many young.", "Die Räuber finden reichlich Nahrung und ziehen viele Junge groß."),
  tx("Many predators eat many prey animals: the prey decreases.", "Viele Räuber fressen viele Beutetiere: Die Beute nimmt ab."),
  tx("The predators find too little food and decrease.", "Die Räuber finden zu wenig Nahrung und nehmen ab."),
  tx("With few predators left, the prey recovers.", "Bei wenigen Räubern erholt sich die Beute."),
];

const SHORT: Text[] = [
  tx("lots of prey", "viel Beute"),
  tx("predators ↑", "Räuber ↑"),
  tx("prey ↓", "Beute ↓"),
  tx("predators ↓", "Räuber ↓"),
  tx("prey ↑", "Beute ↑"),
];

export function cycleOrderTask(rng: Rng): Exercise {
  const start = rng.int(0, 4);
  const items = Array.from({ length: 4 }, (_, i) => CYCLE[(start + i) % 5]);
  const list: Mistake[] = [];
  const has = (k: number) => items.includes(CYCLE[k]);
  if (has(2) && has(3)) list.push({ when: { kind: "order", items: [CYCLE[3], CYCLE[2]] }, title: tx("Predators react later", "Räuber reagieren später"), say: tx("The predators only decrease once the prey has become scarce. First the prey decreases, then the predators.", "Die Räuber nehmen erst ab, wenn die Beute knapp geworden ist. Erst nimmt die Beute ab, dann die Räuber.") });
  if (has(0) && has(1)) list.push({ when: { kind: "order", items: [CYCLE[1], CYCLE[0]] }, title: tx("Food first", "Erst das Futter"), say: tx("Predators can only raise many young when there is plenty of prey. The prey comes first.", "Räuber können erst viele Junge großziehen, wenn es viel Beute gibt. Die Beute kommt zuerst.") });
  if (has(4) && has(0)) list.push({ when: { kind: "order", items: [CYCLE[0], CYCLE[4]] }, title: tx("Recovery comes first", "Erst die Erholung"), say: tx("The prey has to recover before there is a lot of it again.", "Die Beute muss sich erst erholen, bevor es wieder viele Beutetiere gibt.") });
  return {
    instruction: tx("Order the predator-prey cycle", "Ordne den Räuber-Beute-Zyklus"),
    text: tx(`Put the events in order. The cycle starts with: **${en(items[0])}**`, `Bring die Ereignisse in die richtige Reihenfolge. Der Zyklus beginnt mit: **${de(items[0])}**`),
    answer: { kind: "order", items },
    hint: tx("The predators always react to the prey with a delay.", "Die Räuber reagieren immer zeitversetzt auf die Beute."),
    solution: items.map((it, i) => ({ math: join(...items.slice(0, i + 1).flatMap((x, j) => (j ? ["\\to", q(SHORT[CYCLE.indexOf(x)], `s${j}`)] : [q(SHORT[CYCLE.indexOf(x)], `s${j}`)]))), note: it, highlight: [`s${i}`] })),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Niche and biodiversity

export function nicheTask(rng: Rng): Exercise {
  const { answer, mistakes: list } = choice(rng, [
    { text: tx("All the demands a species makes on its environment and its relationships with other living things", "Alle Ansprüche einer Art an ihre Umwelt und ihre Beziehungen zu anderen Lebewesen") },
    { text: tx("The place where a species lives", "Der Ort, an dem eine Art lebt"), title: tx("Job, not address", "Beruf, nicht Adresse"), say: tx("The place is the habitat (its \"address\"). The niche is its \"job\": what it eats, when and where it is active, what it needs.", "Der Ort ist der Lebensraum (die „Adresse“). Die Nische ist ihr „Beruf“: was sie frisst, wann und wo sie aktiv ist, was sie braucht.") },
    { text: tx("A sheltered hiding place, e.g. a tree hole", "Ein geschütztes Versteck, z. B. eine Baumhöhle"), title: tx("Not the everyday meaning", "Nicht die Alltagsbedeutung"), say: tx("In everyday language a niche is a nook. In ecology it means how a species fits into its ecosystem.", "Im Alltag ist eine Nische eine Ecke. In der Ökologie meint sie, wie eine Art in ihr Ökosystem eingebunden ist.") },
    { text: tx("The number of individuals in an area", "Die Zahl der Individuen in einem Gebiet"), title: tx("That's population density", "Das ist die Populationsdichte"), say: tx("That's the population density. The niche describes demands and relationships.", "Das ist die Populationsdichte. Die Nische beschreibt Ansprüche und Beziehungen.") },
  ]);
  return {
    instruction: tx("Ecological niche", "Ökologische Nische"),
    text: tx("What does the **ecological niche** of a species mean?", "Was versteht man unter der **ökologischen Nische** einer Art?"),
    answer,
    hint: tx("A niche is a species' \"job\" in the ecosystem, not its \"address\".", "Eine Nische ist der „Beruf“ einer Art im Ökosystem, nicht ihre „Adresse“."),
    solution: [{ math: tx('"niche"#n = "job"#b , "not address"#a', '"Nische"#n = "Beruf"#b , "nicht Adresse"#a'), note: tx("The niche is the sum of all demands on the environment and all relationships: food, time of activity, temperature, nesting sites.", "Die Nische ist die Gesamtheit aller Umweltansprüche und Beziehungen: Nahrung, Aktivitätszeit, Temperatur, Brutplätze.") }],
    mistakes: list,
  };
}

const GOOD: Text[] = [
  tx("planting hedges between fields", "Hecken zwischen Feldern pflanzen"),
  tx("flower strips at the edge of fields", "Blühstreifen am Ackerrand anlegen"),
  tx("leaving dead wood in the forest", "Totholz im Wald liegen lassen"),
  tx("restoring straightened streams", "begradigte Bäche renaturieren"),
  tx("mowing meadows only twice a year", "Wiesen nur zweimal im Jahr mähen"),
];
const BAD: [Text, Text][] = [
  [tx("growing only one crop on huge fields", "nur eine Feldfrucht auf riesigen Flächen anbauen"), tx("A monoculture offers food and shelter for very few species.", "Eine Monokultur bietet nur sehr wenigen Arten Nahrung und Unterschlupf.")],
  [tx("fertilising meadows heavily", "Wiesen stark düngen"), tx("More fertiliser helps a few nitrogen-loving plants, and they crowd out many others.", "Viel Dünger hilft wenigen stickstoffliebenden Pflanzen, und die verdrängen viele andere.")],
  [tx("sealing land with concrete", "Flächen versiegeln (betonieren)"), tx("Sealed land is lost as a habitat.", "Versiegelte Flächen gehen als Lebensraum verloren.")],
  [tx("draining bogs", "Moore trockenlegen"), tx("Bog species are highly specialised (stenoecious) and disappear when it dries out.", "Moorarten sind hoch spezialisiert (stenök) und verschwinden, wenn es trocken wird.")],
];

export function biodiversityTask(rng: Rng): Exercise {
  const good = pickN(rng, GOOD, 3);
  const bad = pickN(rng, BAD, 2);
  const items = rng.shuffle([...good.map((t) => ({ t, ok: true, why: null as Text | null })), ...bad.map(([t, why]) => ({ t, ok: false, why }))]);
  const options = items.map((x) => capT(x.t));
  const correct = items.map((x, i) => (x.ok ? i : -1)).filter((i) => i >= 0);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.ok && x.why) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("That harms diversity", "Das schadet der Vielfalt"), x.why);
  });
  return {
    instruction: tx("Biodiversity", "Biodiversität"),
    text: tx("Which measures **increase biodiversity**? Select all.", "Welche Maßnahmen **fördern die Biodiversität**? Wähle alle aus."),
    answer,
    hint: tx("More different habitats and niches mean more species.", "Mehr verschiedene Lebensräume und Nischen bedeuten mehr Arten."),
    solution: [{ math: tx('"more niches"#n \\Rightarrow "more species"#a', '"mehr Nischen"#n \\Rightarrow "mehr Arten"#a'), note: tx("Hedges, flower strips, dead wood and natural streams create new habitats and niches.", "Hecken, Blühstreifen, Totholz und naturnahe Bäche schaffen neue Lebensräume und Nischen.") }],
    mistakes: m.list.slice(0, 4),
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  const k = rng.int(0, 14);
  switch (k) {
    case 0:
      return factorTask(rng);
    case 1:
      return relationTask(rng);
    case 2:
      return toleranceReadTask(rng);
    case 3:
      return toleranceZoneTask(rng);
    case 4:
      return stenoTask(rng);
    case 5:
      return indicatorTask(rng);
    case 6:
      return energyForwardTask(rng);
    case 7:
      return energyBackwardTask(rng);
    case 8:
      return efficiencyTask(rng);
    case 9:
      return energyStatementTask(rng);
    case 10:
      return carbonPictureTask(rng);
    case 11:
      return carbonMultiTask(rng);
    case 12:
      return predatorCurveTask(rng);
    case 13:
      return rng.chance(0.5) ? cycleOrderTask(rng) : nicheTask(rng);
    default:
      return biodiversityTask(rng);
  }
}
