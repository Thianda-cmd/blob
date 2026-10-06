"use client";

// Level 2 (Fortgeschritten, Klasse 7–9): plant families and their flowers (crucifers, mint family,
// pea family, rose family, daisy family, grasses), reading and writing floral formulas, a simple
// floral diagram, and identifying families with a key.

import { tx, type Text } from "@/i18n/text";
import { DiversityFamilies, DiversityFlower, FAMILY_FACTS, flowerParts, type FamilyId } from "@/learn/biology/visuals/DiversityFlowers";
import { DiversityDiagramPicture, DiversityFormulaBuilder, DiversityFormulaPicture, formulaPlain, type DiagramId } from "@/learn/biology/visuals/DiversityFormula";
import { DiversityFamilyKey, DiversityKeyTable, FAMILY_KEY, keyPath } from "@/learn/biology/visuals/DiversityKey";
import type { DrawingProps } from "@/learn/biology/Figure";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { Exercise, LevelLesson, Mistake } from "@/learn/types";
import { FAMILIES, FAMILY_CONFUSE, FAMILY_FEATURES, FAMILY_FRUIT, FAMILY_SHORT, FAMILY_SIGN, PLANT_EXAMPLES, familySay, type FamilyAll, type PlantExample } from "./data";
import { capT, choice, de, en, join, multi, pickSome, q, visual, type MultiOpt, type Opt } from "./kit";

/** "zu den Kreuzblütlern" */
const DAT_DE: Record<FamilyAll, string> = {
  brassicaceae: "Kreuzblütlern",
  lamiaceae: "Lippenblütlern",
  fabaceae: "Schmetterlingsblütlern",
  rosaceae: "Rosengewächsen",
  asteraceae: "Korbblütlern",
  poaceae: "Süßgräsern",
  liliaceae: "Liliengewächsen",
};
const famName = (f: FamilyAll) => capT(FAMILY_SHORT[f]);

/** A flower drawing at task size. */
export function DiversityFlowerPicture(props: DrawingProps & { family?: FamilyId }) {
  return (
    <div className="mx-auto w-full max-w-[480px]">
      <DiversityFlower {...props} />
    </div>
  );
}

function familyOpts(right: FamilyAll, wrong: FamilyAll[], special?: Partial<Record<FamilyAll, [Text, Text]>>): Opt[] {
  return [{ text: famName(right) }, ...wrong.map((w) => {
    const [title, say] = special?.[w] ?? familySay(right, w);
    return { text: famName(w), title, say };
  })];
}

function familySolution(f: FamilyAll, clue: Text) {
  return [
    { math: q(clue, "c"), note: tx(`Typical of the ${en(FAMILY_SHORT[f])}: ${en(FAMILY_SIGN[f])}.`, `Typisch für die ${de(FAMILY_SHORT[f])}: ${de(FAMILY_SIGN[f])}.`) },
    { math: join(q(clue, "c"), "\\Rightarrow#r", q(famName(f), "ans")), note: tx(`So: **${en(FAMILY_SHORT[f])}**.`, `Also: **${de(FAMILY_SHORT[f])}**.`), highlight: ["ans"] },
  ];
}

// ---------------------------------------------------------------------------
// Family from features

function featuresTask(rng: Rng, fixed?: FamilyId, fixedFeatures?: number[]): Exercise {
  const f = fixed ?? rng.pick(FAMILIES);
  const F = FAMILY_FEATURES[f];
  const idx = fixedFeatures ?? [rng.int(0, F.key - 1), ...pickSome(rng, F.list.map((_, i) => i).filter((i) => i >= 0), 3)].filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
  const feats = idx.map((i) => F.list[i]);
  const wrong = pickSome(rng, FAMILY_CONFUSE[f].slice(0, 4), 3);
  const { answer, mistakes } = choice(rng, familyOpts(f, wrong));
  return {
    instruction: tx("Which family?", "Welche Familie?"),
    text: tx(`A plant shows these features: **${en(feats[0])}**; **${en(feats[1])}**. Which family does it belong to?`, `Eine Pflanze zeigt diese Merkmale: **${de(feats[0])}**; **${de(feats[1])}**. Zu welcher Familie gehört sie?`),
    answer,
    hint: tx("Look for the feature that only one family has: a cross, lips, a keel, a head, a stalk with nodes?", "Such das Merkmal, das nur eine Familie hat: ein Kreuz, Lippen, ein Schiffchen, ein Körbchen, ein Halm mit Knoten?"),
    solution: familySolution(f, feats[0]),
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Family of a plant you know

function exampleTask(rng: Rng, fixed?: PlantExample): Exercise {
  const p = fixed ?? rng.pick(PLANT_EXAMPLES);
  const pool = FAMILY_CONFUSE[p.family].filter((x) => x !== p.trap?.family);
  const wrong = [...(p.trap ? [p.trap.family] : []), ...pickSome(rng, pool.slice(0, 4), 3)].slice(0, 3);
  const special: Partial<Record<FamilyAll, [Text, Text]>> = p.trap ? { [p.trap.family]: [p.trap.title, p.trap.say] } : {};
  const { answer, mistakes } = choice(rng, familyOpts(p.family, wrong, special));
  return {
    instruction: tx("Sort the plant", "Ordne die Pflanze ein"),
    text: tx(`**${cap1(en(p.name))}**: which plant family does it belong to?`, `**${de(p.name)}**: Zu welcher Pflanzenfamilie gehört diese Pflanze?`),
    answer,
    hint: tx("Picture its flower and its fruit. Which family's blueprint fits?", "Stell dir Blüte und Frucht vor. Zu welcher Familie passt der Bauplan?"),
    solution: [{ math: join(q(capT(p.name), "p"), "\\Rightarrow#r", q(famName(p.family), "ans")), note: tx(`${cap1(en(p.name))} belongs to the **${en(FAMILY_SHORT[p.family])}**: ${en(FAMILY_SIGN[p.family])}.`, `${de(p.name)} gehört zu den **${DAT_DE[p.family]}**: ${de(FAMILY_SIGN[p.family])}.`), highlight: ["ans"] }],
    mistakes,
  };
}
const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------------------
// Floral formulas

type FF = { code: string; family: FamilyAll; plant: Text; diagram?: DiagramId };
const FORMULAS: FF[] = [
  { code: "*K4C4A2+4G(2)o", family: "brassicaceae", plant: tx("oilseed rape", "Raps"), diagram: "brassicaceae" },
  { code: "vK(5)C(2+3)A2+2G(2)o", family: "lamiaceae", plant: tx("dead-nettle", "Taubnessel"), diagram: "lamiaceae" },
  { code: "vK(5)C1+2+(2)A(9)+1G1o", family: "fabaceae", plant: tx("pea", "Erbse"), diagram: "fabaceae" },
  { code: "*K5C5AxG1m", family: "rosaceae", plant: tx("cherry", "Kirsche"), diagram: "rosaceae" },
  { code: "*P3+3A3+3G(3)o", family: "liliaceae", plant: tx("tulip", "Tulpe"), diagram: "liliaceae" },
];

const FORMULA_SAY: Partial<Record<string, [Text, Text]>> = {
  "fabaceae>lamiaceae": [tx("Both zygomorphic", "Beide zygomorph"), tx("Both start with ↓. But C1+2+(2) describes one standard, two wings and a keel of two fused petals, and A(9)+1 the stamen tube.", "Beide beginnen mit ↓. Aber C1+2+(2) beschreibt eine Fahne, zwei Flügel und ein Schiffchen aus zwei verwachsenen Blättern, A(9)+1 die Staubblattröhre.")],
  "lamiaceae>fabaceae": [tx("Both zygomorphic", "Beide zygomorph"), tx("Both start with ↓. But C(2+3) means all petals fused into two lips, 2 above and 3 below, and A2+2 gives only 4 stamens.", "Beide beginnen mit ↓. Aber C(2+3) heißt: alle Kronblätter zu zwei Lippen verwachsen, 2 oben und 3 unten, und A2+2 ergibt nur 4 Staubblätter.")],
  "brassicaceae>rosaceae": [tx("Fours, not fives", "Vier, nicht fünf"), tx("K4 C4: everything in fours, and A2+4 is the typical 2 short and 4 long stamens.", "K4 C4: alles vierzählig, und A2+4 sind die typischen 2 kurzen und 4 langen Staubblätter.")],
  "rosaceae>brassicaceae": [tx("Count again", "Zähl noch mal"), tx("K5 C5 and A∞: five petals and very many stamens. A crucifer would have K4 C4 A2+4.", "K5 C5 und A∞: fünf Kronblätter und sehr viele Staubblätter. Ein Kreuzblütler hätte K4 C4 A2+4.")],
  "liliaceae>brassicaceae": [tx("P for perianth", "P wie Perigon"), tx("P means calyx and corolla look the same. P3+3 A3+3 G(3): everything in threes.", "P heißt: Kelch und Krone sehen gleich aus. P3+3 A3+3 G(3): alles dreizählig.")],
  "liliaceae>rosaceae": [tx("P for perianth", "P wie Perigon"), tx("P means calyx and corolla look the same. P3+3 A3+3 G(3): everything in threes.", "P heißt: Kelch und Krone sehen gleich aus. P3+3 A3+3 G(3): alles dreizählig.")],
};

function formulaFamilyTask(rng: Rng, fixed?: FF): Exercise {
  const F = fixed ?? rng.pick(FORMULAS);
  const others = FORMULAS.map((x) => x.family).filter((x) => x !== F.family);
  const wrong = pickSome(rng, others, 3);
  const special: Partial<Record<FamilyAll, [Text, Text]>> = {};
  for (const w of wrong) if (FORMULA_SAY[`${F.family}>${w}`]) special[w] = FORMULA_SAY[`${F.family}>${w}`];
  const { answer, mistakes } = choice(rng, familyOpts(F.family, wrong, special));
  return {
    instruction: tx("Read the floral formula", "Blütenformel lesen"),
    text: tx("Which family has this floral formula?", "Zu welcher Familie gehört diese Blütenformel?"),
    visual: visual(DiversityFormulaPicture, { code: F.code }),
    answer,
    hint: tx("Symmetry first (✱ or ↓), then count the parts: fours, fives or threes? Brackets mean fused.", "Zuerst die Symmetrie (✱ oder ↓), dann zählen: vier-, fünf- oder dreizählig? Klammern heißen verwachsen."),
    solution: [
      { math: q(formulaPlain(F.code), "f"), note: tx(`${en(FAMILY_SIGN[F.family])}: that's what the formula says.`, `${de(FAMILY_SIGN[F.family])}: Das steht in der Formel.`) },
      { math: join(q(formulaPlain(F.code), "f"), "\\Rightarrow#r", q(famName(F.family), "ans")), note: tx(`The formula of the ${en(FAMILY_SHORT[F.family])} (here: ${en(F.plant)}).`, `Die Formel der ${de(FAMILY_SHORT[F.family])} (hier: ${de(F.plant)}).`), highlight: ["ans"] },
    ],
    mistakes,
  };
}

type Whorl = "K" | "C" | "P" | "A" | "G";
const WHORL_NAME: Record<Whorl, Text> = {
  K: tx("sepals", "Kelchblätter"),
  C: tx("petals", "Kronblätter"),
  P: tx("tepals", "Blütenhüllblätter"),
  A: tx("stamens", "Staubblätter"),
  G: tx("carpels", "Fruchtblätter"),
};
type Count = { code: string; plant: Text; whorl: Whorl; value: number; wrong: [number, Text, Text][] };

const groupsSay = (s: string): [Text, Text] => [tx("Add up the groups", "Gruppen zusammenzählen"), tx(`${s} means two groups. Add them up.`, `${s} heißt: zwei Gruppen. Zähl sie zusammen.`)];
const plusSay = (s: string): [Text, Text] => [tx("+ is not a digit", "Das + ist keine Ziffer"), tx(`The + separates groups: ${s} is a sum, not a two-digit number.`, `Das + trennt Gruppen: ${s} ist eine Summe, keine zweistellige Zahl.`)];
const carpelSay: [Text, Text] = [tx("One ovary, several carpels", "Ein Fruchtknoten, mehrere Fruchtblätter"), tx("The brackets show that the carpels are fused into one ovary. The question asks for the carpels.", "Die Klammer zeigt: Die Fruchtblätter sind zu einem Fruchtknoten verwachsen. Gefragt sind die Fruchtblätter.")];

const COUNTS: Count[] = [
  { code: "*K4C4A2+4G(2)o", plant: tx("oilseed rape", "Raps"), whorl: "A", value: 6, wrong: [[2, ...groupsSay("A2+4")], [4, ...groupsSay("A2+4")], [24, ...plusSay("A2+4")]] },
  { code: "*K4C4A2+4G(2)o", plant: tx("oilseed rape", "Raps"), whorl: "G", value: 2, wrong: [[1, ...carpelSay]] },
  { code: "*K4C4A2+4G(2)o", plant: tx("oilseed rape", "Raps"), whorl: "C", value: 4, wrong: [] },
  { code: "vK(5)C(2+3)A2+2G(2)o", plant: tx("dead-nettle", "Taubnessel"), whorl: "C", value: 5, wrong: [[2, tx("Two lips, more petals", "Zwei Lippen, mehr Kronblätter"), tx("There are two lips, but C(2+3) says 2 + 3 fused petals.", "Es gibt zwei Lippen, aber C(2+3) heißt: 2 + 3 verwachsene Kronblätter.")], [1, tx("Fused isn't one", "Verwachsen heißt nicht eins"), tx("The brackets only mean the petals are fused. You still count all of them.", "Die Klammer heißt nur, dass die Kronblätter verwachsen sind. Gezählt werden trotzdem alle.")], [23, ...plusSay("C(2+3)")]] },
  { code: "vK(5)C(2+3)A2+2G(2)o", plant: tx("dead-nettle", "Taubnessel"), whorl: "A", value: 4, wrong: [[2, ...groupsSay("A2+2")], [22, ...plusSay("A2+2")]] },
  { code: "vK(5)C(2+3)A2+2G(2)o", plant: tx("dead-nettle", "Taubnessel"), whorl: "G", value: 2, wrong: [[4, tx("Chambers aren't carpels", "Kammern sind keine Fruchtblätter"), tx("The ovary has 4 chambers (it splits into 4 nutlets), but it is made of 2 carpels: G(2).", "Der Fruchtknoten hat 4 Kammern (er zerfällt in 4 Nüsschen), besteht aber aus 2 Fruchtblättern: G(2).")], [1, ...carpelSay]] },
  { code: "vK(5)C(2+3)A2+2G(2)o", plant: tx("dead-nettle", "Taubnessel"), whorl: "K", value: 5, wrong: [[1, tx("Fused isn't one", "Verwachsen heißt nicht eins"), tx("K(5): five sepals, fused into a tube. Count all five.", "K(5): fünf Kelchblätter, zu einer Röhre verwachsen. Zähl alle fünf.")]] },
  { code: "vK(5)C1+2+(2)A(9)+1G1o", plant: tx("pea", "Erbse"), whorl: "C", value: 5, wrong: [[3, tx("The brackets count too", "Die Klammer zählt mit"), tx("(2) stands for the 2 fused keel petals: 1 + 2 + 2.", "(2) steht für die 2 verwachsenen Schiffchenblätter: 1 + 2 + 2.")], [4, tx("The keel has two petals", "Das Schiffchen hat zwei Blätter"), tx("The keel looks like one petal, but (2) says it is two fused petals.", "Das Schiffchen sieht aus wie ein Blatt, aber (2) sagt: zwei verwachsene Kronblätter.")]] },
  { code: "vK(5)C1+2+(2)A(9)+1G1o", plant: tx("pea", "Erbse"), whorl: "A", value: 10, wrong: [[9, tx("The free one is missing", "Das freie fehlt"), tx("A(9)+1: 9 fused stamens plus 1 free one.", "A(9)+1: 9 verwachsene plus 1 freies Staubblatt.")], [91, ...plusSay("A(9)+1")]] },
  { code: "vK(5)C1+2+(2)A(9)+1G1o", plant: tx("pea", "Erbse"), whorl: "K", value: 5, wrong: [[1, tx("Fused isn't one", "Verwachsen heißt nicht eins"), tx("K(5): five fused sepals.", "K(5): fünf verwachsene Kelchblätter.")]] },
  { code: "*K5C5AxG1m", plant: tx("cherry", "Kirsche"), whorl: "C", value: 5, wrong: [] },
  { code: "*K5C5AxG1m", plant: tx("cherry", "Kirsche"), whorl: "G", value: 1, wrong: [] },
  { code: "*P3+3A3+3G(3)o", plant: tx("tulip", "Tulpe"), whorl: "P", value: 6, wrong: [[3, tx("Two circles", "Zwei Kreise"), tx("P3+3: two circles of 3 tepals each.", "P3+3: zwei Kreise mit je 3 Blütenhüllblättern.")], [33, ...plusSay("P3+3")]] },
  { code: "*P3+3A3+3G(3)o", plant: tx("tulip", "Tulpe"), whorl: "A", value: 6, wrong: [[3, ...groupsSay("A3+3")], [33, ...plusSay("A3+3")]] },
  { code: "*P3+3A3+3G(3)o", plant: tx("tulip", "Tulpe"), whorl: "G", value: 3, wrong: [[1, ...carpelSay]] },
  { code: "*K5C5A5+5G(5)o", plant: tx("cranesbill", "Storchschnabel"), whorl: "A", value: 10, wrong: [[5, ...groupsSay("A5+5")], [55, ...plusSay("A5+5")]] },
  { code: "*K5C5A5+5G(5)o", plant: tx("cranesbill", "Storchschnabel"), whorl: "G", value: 5, wrong: [[1, ...carpelSay]] },
];

function countTask(rng: Rng, fixed?: Count): Exercise {
  const c = fixed ?? rng.pick(COUNTS);
  const list: Mistake[] = c.wrong.filter(([v]) => v !== c.value).map(([v, title, say]) => ({ when: { kind: "number", value: v }, title, say }));
  const W = WHORL_NAME[c.whorl];
  return {
    instruction: tx("Count from the formula", "Zähl in der Blütenformel"),
    text: tx(`The floral formula of the ${en(c.plant)}. How many **${en(W)}** does one flower have?`, `Die Blütenformel: ${de(c.plant)}. Wie viele **${de(W)}** hat eine Blüte?`),
    visual: visual(DiversityFormulaPicture, { code: c.code }),
    answer: { kind: "number", value: c.value, label: W },
    hint: tx(`Find the letter ${c.whorl}. Add up all groups behind it; brackets only mean "fused".`, `Such den Buchstaben ${c.whorl}. Zähl alle Gruppen dahinter zusammen; Klammern heißen nur „verwachsen“.`),
    solution: [{ math: join(q(formulaPlain(c.code), "f")), note: tx(`Behind ${c.whorl}: ${c.value} ${en(W)} in total.`, `Hinter ${c.whorl}: zusammen ${c.value} ${de(W)}.`) }, { math: `${c.value}#ans`, note: tx(`One flower has **${c.value}** ${en(W)}.`, `Eine Blüte hat **${c.value}** ${de(W)}.`), highlight: ["ans"] }],
    mistakes: list,
  };
}

type Sym = { q: Text; right: Text; wrong: Opt[] };
const SYMBOLS: Sym[] = [
  {
    q: tx("What does ✱ at the start of a floral formula mean?", "Was bedeutet ✱ am Anfang einer Blütenformel?"),
    right: tx("The flower is radial: it has several planes of symmetry.", "Die Blüte ist radiärsymmetrisch: Sie hat mehrere Symmetrieebenen."),
    wrong: [
      { text: tx("The flower is zygomorphic: it has one plane of symmetry.", "Die Blüte ist zygomorph: Sie hat nur eine Symmetrieebene."), title: tx("That's the arrow", "Das ist der Pfeil"), say: tx("Zygomorphic flowers get ↓. The star stands for radial flowers, like a star with many axes.", "Zygomorphe Blüten bekommen ↓. Der Stern steht für radiäre Blüten, wie ein Stern mit vielen Achsen.") },
      { text: tx("The flower has very many stamens.", "Die Blüte hat sehr viele Staubblätter."), title: tx("That's ∞", "Das ist ∞"), say: tx("Many stamens are written A∞. The star is about symmetry.", "Viele Staubblätter schreibt man A∞. Der Stern betrifft die Symmetrie.") },
      { text: tx("The petals are fused.", "Die Kronblätter sind verwachsen."), title: tx("That's brackets", "Das sind Klammern"), say: tx("Fused parts get brackets, like C(5). The star is about symmetry.", "Verwachsene Teile bekommen Klammern, wie C(5). Der Stern betrifft die Symmetrie.") },
    ],
  },
  {
    q: tx("What do the brackets in K(5) mean?", "Was bedeutet die Klammer in K(5)?"),
    right: tx("The 5 sepals are fused together.", "Die 5 Kelchblätter sind miteinander verwachsen."),
    wrong: [
      { text: tx("There are about 5 sepals.", "Es sind ungefähr 5 Kelchblätter."), title: tx("Brackets mean fused", "Klammer heißt verwachsen"), say: tx("Formulas are exact. Brackets mean that the parts have grown together.", "Blütenformeln sind genau. Die Klammer heißt: Die Teile sind miteinander verwachsen.") },
      { text: tx("There are 5 circles of sepals.", "Es gibt 5 Kreise mit Kelchblättern."), title: tx("Brackets mean fused", "Klammer heißt verwachsen"), say: tx("Circles are separated by +, like A2+4. Brackets mean fused.", "Kreise trennt man mit +, wie bei A2+4. Klammern heißen verwachsen.") },
      { text: tx("The sepals fall off early.", "Die Kelchblätter fallen früh ab."), title: tx("Brackets mean fused", "Klammer heißt verwachsen"), say: tx("A floral formula only shows number, fusion, symmetry and position. Brackets mean fused.", "Eine Blütenformel zeigt nur Zahl, Verwachsung, Symmetrie und Stellung. Klammern heißen verwachsen.") },
    ],
  },
  {
    q: tx("What does A∞ mean?", "Was bedeutet A∞?"),
    right: tx("Many stamens, too many to count.", "Viele Staubblätter, zu viele zum Zählen."),
    wrong: [
      { text: tx("No stamens at all.", "Gar keine Staubblätter."), title: tx("∞ is a lot", "∞ ist ganz viel"), say: tx("No stamens would be A0. ∞ stands for many.", "Keine Staubblätter wären A0. ∞ steht für viele.") },
      { text: tx("The stamens are fused.", "Die Staubblätter sind verwachsen."), title: tx("∞ is a number", "∞ ist eine Anzahl"), say: tx("Fused would need brackets. ∞ says how many: lots.", "Verwachsen bräuchte eine Klammer. ∞ sagt, wie viele: sehr viele.") },
      { text: tx("The stamens are very long.", "Die Staubblätter sind sehr lang."), title: tx("∞ is a number", "∞ ist eine Anzahl"), say: tx("A formula counts, it doesn't measure. ∞ means many.", "Eine Blütenformel zählt, sie misst nicht. ∞ heißt viele.") },
    ],
  },
  {
    q: tx("What does the letter C stand for?", "Wofür steht der Buchstabe C?"),
    right: tx("The corolla: the petals", "Die Krone: die Kronblätter"),
    wrong: [
      { text: tx("The calyx: the sepals", "Den Kelch: die Kelchblätter"), title: tx("K comes first", "K kommt zuerst"), say: tx("The calyx is K (Latin calyx, German Kelch). C stands for corolla, the crown of petals.", "Der Kelch ist K (Kalyx). C steht für die Corolla, die Krone aus Kronblättern.") },
      { text: tx("The carpels", "Die Fruchtblätter"), title: tx("Carpels are G", "Fruchtblätter sind G"), say: tx("Carpels are G (gynoecium). C is the corolla.", "Fruchtblätter sind G (Gynoeceum). C ist die Krone.") },
      { text: tx("The stamens", "Die Staubblätter"), title: tx("Stamens are A", "Staubblätter sind A"), say: tx("Stamens are A (androecium). C is the corolla.", "Staubblätter sind A (Androeceum). C ist die Krone.") },
    ],
  },
  {
    q: tx("What does the letter G stand for?", "Wofür steht der Buchstabe G?"),
    right: tx("The carpels (they form the ovary)", "Die Fruchtblätter (sie bilden den Fruchtknoten)"),
    wrong: [
      { text: tx("The stamens", "Die Staubblätter"), title: tx("Stamens are A", "Staubblätter sind A"), say: tx("Stamens are A. G comes from gynoecium, the female part: the carpels.", "Staubblätter sind A. G kommt von Gynoeceum, dem weiblichen Teil: den Fruchtblättern.") },
      { text: tx("The whole flower", "Die ganze Blüte"), title: tx("One part only", "Nur ein Teil"), say: tx("Every letter stands for one circle of parts. G is the carpels.", "Jeder Buchstabe steht für einen Kreis von Blütenteilen. G sind die Fruchtblätter.") },
      { text: tx("The sepals", "Die Kelchblätter"), title: tx("Sepals are K", "Kelchblätter sind K"), say: tx("Sepals are K. G is the carpels.", "Kelchblätter sind K. G sind die Fruchtblätter.") },
    ],
  },
  {
    q: tx("What does a P in a floral formula mean (as in the tulip)?", "Was bedeutet ein P in einer Blütenformel (wie bei der Tulpe)?"),
    right: tx("A perianth: calyx and corolla look the same.", "Eine Blütenhülle (Perigon): Kelch und Krone sehen gleich aus."),
    wrong: [
      { text: tx("The petals are pink.", "Die Kronblätter sind rosa."), title: tx("No colours", "Keine Farben"), say: tx("A formula says nothing about colour. P is used when you can't tell sepals and petals apart.", "Eine Blütenformel sagt nichts über Farben. P nimmt man, wenn sich Kelch- und Kronblätter nicht unterscheiden.") },
      { text: tx("The flower has pollen.", "Die Blüte hat Pollen."), title: tx("Pollen is in A", "Pollen steckt in A"), say: tx("Pollen is made in the stamens, A. P is the perianth.", "Pollen bilden die Staubblätter, A. P ist die Blütenhülle.") },
      { text: tx("The flower has no petals.", "Die Blüte hat keine Kronblätter."), title: tx("It has tepals", "Sie hat Blütenhüllblätter"), say: tx("The tulip has 6 colourful tepals. They are just all alike, so they are written P3+3.", "Die Tulpe hat 6 bunte Blütenhüllblätter. Sie sehen nur alle gleich aus, deshalb schreibt man P3+3.") },
    ],
  },
  {
    q: tx("A line under the number of the carpels means …", "Ein Strich unter der Zahl der Fruchtblätter bedeutet …"),
    right: tx("the ovary is superior (above the other parts).", "der Fruchtknoten ist oberständig (über den anderen Blütenteilen)."),
    wrong: [
      { text: tx("the ovary is inferior (below the other parts).", "der Fruchtknoten ist unterständig (unter den anderen Blütenteilen)."), title: tx("Upside down", "Genau andersherum"), say: tx("Think of the line as the flower base: the ovary sits above it, so it's superior. Inferior gets a line over the number.", "Stell dir den Strich als Blütenboden vor: Der Fruchtknoten sitzt darüber, ist also oberständig. Unterständig bekommt einen Strich über der Zahl.") },
      { text: tx("the carpels are fused.", "die Fruchtblätter sind verwachsen."), title: tx("That's brackets", "Das sind Klammern"), say: tx("Fused carpels get brackets. The line is about where the ovary sits.", "Verwachsene Fruchtblätter bekommen Klammern. Der Strich zeigt, wo der Fruchtknoten sitzt.") },
      { text: tx("the flower has only one carpel.", "die Blüte hat nur ein Fruchtblatt."), title: tx("Numbers count", "Die Zahl zählt"), say: tx("How many carpels there are is the number itself. The line shows the position of the ovary.", "Wie viele Fruchtblätter es sind, zeigt die Zahl selbst. Der Strich zeigt die Stellung des Fruchtknotens.") },
    ],
  },
  {
    q: tx("What does the + in A2+4 mean?", "Was bedeutet das + in A2+4?"),
    right: tx("The stamens stand in two groups: 2 and 4.", "Die Staubblätter stehen in zwei Gruppen: 2 und 4."),
    wrong: [
      { text: tx("There are 2 or 4 stamens.", "Es sind 2 oder 4 Staubblätter."), title: tx("Plus, not or", "Plus, nicht oder"), say: tx("+ means and: 2 + 4 = 6 stamens, in two groups.", "+ heißt und: 2 + 4 = 6 Staubblätter in zwei Gruppen.") },
      { text: tx("There are 24 stamens.", "Es sind 24 Staubblätter."), title: tx("+ is not a digit", "Das + ist keine Ziffer"), say: tx("2+4 is a sum: 6 stamens in two groups.", "2+4 ist eine Summe: 6 Staubblätter in zwei Gruppen.") },
      { text: tx("2 stamens are fused, 4 are free.", "2 Staubblätter sind verwachsen, 4 frei."), title: tx("No brackets here", "Hier ist keine Klammer"), say: tx("Fused ones would need brackets, like A(9)+1. Here + just separates two groups: 2 short and 4 long.", "Verwachsene bräuchten eine Klammer, wie bei A(9)+1. Hier trennt + nur zwei Gruppen: 2 kurze und 4 lange.") },
    ],
  },
];

function symbolTask(rng: Rng): Exercise {
  const s = rng.pick(SYMBOLS);
  const { answer, mistakes } = choice(rng, [{ text: s.right }, ...s.wrong]);
  return {
    instruction: tx("Floral formula symbols", "Zeichen der Blütenformel"),
    text: s.q,
    answer,
    hint: tx("K calyx, C corolla, P perianth, A stamens, G carpels. Brackets: fused. +: groups. ∞: many. ✱ radial, ↓ zygomorphic.", "K Kelch, C Krone, P Blütenhülle, A Staubblätter, G Fruchtblätter. Klammer: verwachsen. +: Gruppen. ∞: viele. ✱ radiär, ↓ zygomorph."),
    solution: [{ math: q(tx("✱ K C P A G ( ) + ∞", "✱ K C P A G ( ) + ∞"), "s"), note: s.right }],
    mistakes,
  };
}

type Write = { desc: Text; code: string; wrong: { code: string; title: Text; say: Text }[] };
const fusedSay = (what: Text): [Text, Text] => [tx("Brackets mean fused", "Klammer heißt verwachsen"), tx(`Check the ${en(what)}: free parts get no brackets, fused parts do.`, `Prüf die ${de(what)}: Freie Teile bekommen keine Klammer, verwachsene schon.`)];
const symSay: [Text, Text] = [tx("Check the symmetry", "Prüf die Symmetrie"), tx("Radial flowers get ✱, zygomorphic flowers (one plane of symmetry) get ↓.", "Radiäre Blüten bekommen ✱, zygomorphe (nur eine Symmetrieebene) bekommen ↓.")];

const WRITES: Write[] = [
  {
    desc: tx("radial; 4 free sepals; 4 free petals; 6 stamens, 2 short and 4 long; 2 fused carpels, superior", "radiär; 4 freie Kelchblätter; 4 freie Kronblätter; 6 Staubblätter, 2 kurze und 4 lange; 2 verwachsene Fruchtblätter, oberständig"),
    code: "*K4C4A2+4G(2)o",
    wrong: [
      { code: "*K(4)C(4)A2+4G(2)o", title: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[0], say: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[1] },
      { code: "vK4C4A2+4G(2)o", title: symSay[0], say: symSay[1] },
      { code: "*K4C4A6G2o", title: tx("Groups and brackets lost", "Gruppen und Klammer verloren"), say: tx("A6 hides the two groups (2 short, 4 long), and G2 hides that the carpels are fused.", "A6 verschweigt die zwei Gruppen (2 kurze, 4 lange), und G2 verschweigt, dass die Fruchtblätter verwachsen sind.") },
    ],
  },
  {
    desc: tx("zygomorphic; 5 fused sepals; 5 fused petals (2 form the upper lip, 3 the lower lip); 4 stamens, 2 long and 2 short; 2 fused carpels, superior", "zygomorph; 5 verwachsene Kelchblätter; 5 verwachsene Kronblätter (2 bilden die Oberlippe, 3 die Unterlippe); 4 Staubblätter, 2 lange und 2 kurze; 2 verwachsene Fruchtblätter, oberständig"),
    code: "vK(5)C(2+3)A2+2G(2)o",
    wrong: [
      { code: "vK5C2+3A2+2G(2)o", title: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[0], say: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[1] },
      { code: "*K(5)C(2+3)A2+2G(2)o", title: symSay[0], say: symSay[1] },
      { code: "vK(5)C(2+3)A2+2G(4)o", title: tx("Chambers aren't carpels", "Kammern sind keine Fruchtblätter"), say: tx("The description says 2 carpels. The 4 nutlets come from extra walls in the ovary.", "Die Beschreibung nennt 2 Fruchtblätter. Die 4 Nüsschen entstehen durch zusätzliche Wände im Fruchtknoten.") },
    ],
  },
  {
    desc: tx("zygomorphic; 5 fused sepals; corolla of a standard, 2 wings and 2 fused keel petals; 10 stamens, 9 fused and 1 free; 1 carpel, superior", "zygomorph; 5 verwachsene Kelchblätter; Krone aus Fahne, 2 Flügeln und 2 verwachsenen Schiffchenblättern; 10 Staubblätter, 9 verwachsen und 1 frei; 1 Fruchtblatt, oberständig"),
    code: "vK(5)C1+2+(2)A(9)+1G1o",
    wrong: [
      { code: "vK(5)C(1+2+2)A(9)+1G1o", title: tx("Only the keel is fused", "Nur das Schiffchen ist verwachsen"), say: tx("Standard and wings are free. Only the two keel petals are fused: C1+2+(2).", "Fahne und Flügel sind frei. Nur die zwei Schiffchenblätter sind verwachsen: C1+2+(2).") },
      { code: "vK(5)C1+2+(2)A9+(1)G1o", title: tx("Brackets on the wrong group", "Klammer an der falschen Gruppe"), say: tx("Nine stamens are fused into a tube, one is free: the brackets belong round the 9.", "Neun Staubblätter sind zu einer Röhre verwachsen, eines ist frei: Die Klammer gehört um die 9.") },
      { code: "vK(5)C1+2+(2)A(9)+1G(2)o", title: tx("One carpel", "Ein Fruchtblatt"), say: tx("The legume grows from a single carpel: G1.", "Die Hülse entsteht aus einem einzigen Fruchtblatt: G1.") },
    ],
  },
  {
    desc: tx("radial; a perianth of 6 equal, free tepals in 2 circles; 6 stamens in 2 circles; 3 fused carpels, superior", "radiär; Blütenhülle aus 6 gleichen, freien Blättern in 2 Kreisen; 6 Staubblätter in 2 Kreisen; 3 verwachsene Fruchtblätter, oberständig"),
    code: "*P3+3A3+3G(3)o",
    wrong: [
      { code: "*K3C3A3+3G(3)o", title: tx("All tepals look alike", "Alle Hüllblätter gleich"), say: tx("When calyx and corolla can't be told apart, you write P for perianth.", "Wenn sich Kelch und Krone nicht unterscheiden, schreibt man P für die Blütenhülle.") },
      { code: "*P(3+3)A3+3G(3)o", title: fusedSay(tx("tepals", "Blütenhüllblätter"))[0], say: fusedSay(tx("tepals", "Blütenhüllblätter"))[1] },
      { code: "*P3+3A3+3G3o", title: fusedSay(tx("carpels", "Fruchtblätter"))[0], say: fusedSay(tx("carpels", "Fruchtblätter"))[1] },
    ],
  },
  {
    desc: tx("radial; 5 free sepals; 5 free petals; many stamens; 1 carpel", "radiär; 5 freie Kelchblätter; 5 freie Kronblätter; viele Staubblätter; 1 Fruchtblatt"),
    code: "*K5C5AxG1m",
    wrong: [
      { code: "*K(5)C(5)AxG1m", title: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[0], say: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[1] },
      { code: "*K5C5A5G1m", title: tx("Many is ∞", "Viele heißt ∞"), say: tx("\"Many stamens\" is written A∞, not A5.", "„Viele Staubblätter“ schreibt man A∞, nicht A5.") },
      { code: "vK5C5AxG1m", title: symSay[0], say: symSay[1] },
    ],
  },
  {
    desc: tx("radial; 5 free sepals; 5 free petals; 10 stamens in 2 circles of 5; 5 fused carpels, superior", "radiär; 5 freie Kelchblätter; 5 freie Kronblätter; 10 Staubblätter in 2 Kreisen zu je 5; 5 verwachsene Fruchtblätter, oberständig"),
    code: "*K5C5A5+5G(5)o",
    wrong: [
      { code: "*K5C5A(10)G(5)o", title: tx("Circles, not fused", "Kreise, nicht verwachsen"), say: tx("Two circles of 5 are written A5+5. Brackets would mean the stamens are fused.", "Zwei Kreise zu je 5 schreibt man A5+5. Eine Klammer hieße, die Staubblätter sind verwachsen.") },
      { code: "*K5C5A5+5G5o", title: fusedSay(tx("carpels", "Fruchtblätter"))[0], say: fusedSay(tx("carpels", "Fruchtblätter"))[1] },
      { code: "*K(5)C(5)A5+5G(5)o", title: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[0], say: fusedSay(tx("sepals and petals", "Kelch- und Kronblätter"))[1] },
    ],
  },
];

function writeTask(rng: Rng): Exercise {
  const w = rng.pick(WRITES);
  const { answer, mistakes } = choice(rng, [{ text: formulaPlain(w.code) }, ...w.wrong.map((x) => ({ text: formulaPlain(x.code), title: x.title, say: x.say }))]);
  return {
    instruction: tx("Write the floral formula", "Stell die Blütenformel auf"),
    text: tx(`A flower: ${en(w.desc)}. Which floral formula fits? (The line for the ovary position is left out here.)`, `Eine Blüte: ${de(w.desc)}. Welche Blütenformel passt? (Der Strich für die Stellung des Fruchtknotens fehlt hier.)`),
    answer,
    hint: tx("Go through it part by part: symmetry, K (or P), C, A, G. Fused → brackets, groups → +, many → ∞.", "Geh Teil für Teil durch: Symmetrie, K (oder P), C, A, G. Verwachsen → Klammer, Gruppen → +, viele → ∞."),
    solution: [{ math: q(formulaPlain(w.code), "ans"), note: tx("Every part of the description has its symbol in the formula.", "Jeder Teil der Beschreibung hat sein Zeichen in der Formel."), highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// Diagram, parts and fruits

function diagramTask(rng: Rng): Exercise {
  const F = rng.pick(FORMULAS);
  const others = FORMULAS.filter((x) => x.code !== F.code);
  const wrong = pickSome(rng, others, 3);
  const { answer, mistakes } = choice(rng, [{ text: formulaPlain(F.code) }, ...wrong.map((x) => {
    const [title, say] = FORMULA_SAY[`${F.family}>${x.family}`] ?? [tx("Count the circles", "Zähl die Kreise"), tx("Count each circle of the diagram from outside in: green sepals, pink petals, yellow anthers, the ovary in the middle. Rings joining them mean fused.", "Zähl jeden Kreis des Diagramms von außen nach innen: grüne Kelchblätter, rosa Kronblätter, gelbe Staubbeutel, in der Mitte der Fruchtknoten. Verbindende Ringe heißen verwachsen.")];
    return { text: formulaPlain(x.code), title, say };
  })]);
  return {
    instruction: tx("Floral diagram", "Blütendiagramm"),
    text: tx("This floral diagram shows a flower from above (the dot marks the stem side). Which formula belongs to it?", "Dieses Blütendiagramm zeigt eine Blüte von oben (der Punkt zeigt zur Sprossachse). Welche Formel gehört dazu?"),
    visual: visual(DiversityDiagramPicture, { id: F.diagram! }),
    answer,
    hint: tx("Count from outside in: sepals (green), petals (pink), stamens (yellow), carpels (chambers in the middle). Rings = fused.", "Zähl von außen nach innen: Kelchblätter (grün), Kronblätter (rosa), Staubblätter (gelb), Fruchtblätter (Kammern in der Mitte). Ringe = verwachsen."),
    solution: [{ math: q(formulaPlain(F.code), "ans"), note: tx(`The diagram of the ${en(F.plant)} (${en(FAMILY_SHORT[F.family])}).`, `Das Diagramm: ${de(F.plant)} (${de(FAMILY_SHORT[F.family])}).`), highlight: ["ans"] }],
    mistakes,
  };
}

const PART_FAMILIES: FamilyId[] = ["brassicaceae", "lamiaceae", "fabaceae", "rosaceae", "asteraceae", "poaceae"];
const PART_PAIRS: Record<string, [Text, Text]> = {
  "standard>wing": [tx("Big and upright", "Groß und aufrecht"), tx("The wings sit at the sides. The big upright petal at the back is the standard.", "Die Flügel sitzen seitlich. Das große, aufrechte Kronblatt hinten ist die Fahne.")],
  "wing>keel": [tx("At the side", "Seitlich"), tx("The keel is the boat-shaped part at the bottom. The marked petal sits at the side.", "Das Schiffchen ist der kahnförmige Teil unten. Das markierte Blatt sitzt seitlich.")],
  "keel>wing": [tx("At the bottom", "Unten"), tx("The wings sit at the sides. The boat-shaped part at the bottom, which hides the stamens, is the keel.", "Die Flügel sitzen seitlich. Der kahnförmige Teil unten, der die Staubblätter verbirgt, ist das Schiffchen.")],
  "upper>lower": [tx("Top or bottom?", "Oben oder unten?"), tx("The lower lip is the landing place below. The hood on top is the upper lip.", "Die Unterlippe ist der Landeplatz unten. Der Helm oben ist die Oberlippe.")],
  "lower>upper": [tx("Top or bottom?", "Oben oder unten?"), tx("The upper lip is the hood on top. The marked part hangs down: the landing place.", "Die Oberlippe ist der Helm oben. Der markierte Teil hängt nach unten: der Landeplatz.")],
  "ray>disc": [tx("Strap or tube?", "Zunge oder Röhre?"), tx("Disc florets are the tiny tubes in the middle. The marked one has a long strap.", "Röhrenblüten sind die winzigen Röhren in der Mitte. Die markierte hat eine lange Zunge.")],
  "disc>ray": [tx("Strap or tube?", "Zunge oder Röhre?"), tx("Ray florets have a long strap at the edge. The marked floret is a little tube in the middle.", "Zungenblüten haben am Rand eine lange Zunge. Die markierte Blüte ist eine kleine Röhre in der Mitte.")],
  "long>short": [tx("Long or short?", "Lang oder kurz?"), tx("Compare the heights: the marked stamens reach as high as the stigma.", "Vergleich die Höhe: Die markierten Staubblätter reichen so hoch wie die Narbe.")],
  "short>long": [tx("Long or short?", "Lang oder kurz?"), tx("Compare the heights: the marked stamen is clearly shorter than the others.", "Vergleich die Höhe: Das markierte Staubblatt ist deutlich kürzer als die anderen.")],
  "sepal>petal": [tx("Green and narrow", "Grün und schmal"), tx("Petals are the big coloured ones. The marked part is green and narrow.", "Kronblätter sind die großen, bunten. Der markierte Teil ist grün und schmal.")],
  "petal>sepal": [tx("Big and coloured", "Groß und bunt"), tx("Sepals are green and small. The marked part is big and coloured.", "Kelchblätter sind grün und klein. Der markierte Teil ist groß und bunt.")],
  "ear>spikelet": [tx("The whole or a part?", "Das Ganze oder ein Teil?"), tx("A spikelet is one small group of flowers. The marker points to the whole ear made of many spikelets.", "Ein Ährchen ist eine kleine Blütengruppe. Der Marker zeigt auf die ganze Ähre aus vielen Ährchen.")],
  "spikelet>ear": [tx("The whole or a part?", "Das Ganze oder ein Teil?"), tx("The ear is the whole spike. The marked part is a single spikelet, enlarged.", "Die Ähre ist der ganze Blütenstand. Markiert ist ein einzelnes Ährchen, vergrößert.")],
};

function partTask(rng: Rng): Exercise {
  const fam = rng.pick(PART_FAMILIES);
  const parts = flowerParts(fam);
  const P = rng.pick(parts);
  const others = pickSome(rng, parts.filter((x) => x.id !== P.id), 3);
  const { answer, mistakes } = choice(rng, [{ text: capT(P.label) }, ...others.map((o) => {
    const s = PART_PAIRS[`${P.id}>${o.id}`];
    return s ? { text: capT(o.label), title: s[0], say: s[1] } : { text: capT(o.label), title: tx("Another part", "Ein anderer Teil"), say: tx(`That would be: ${en(o.info ?? o.label)} Look again at where the ? points.`, `Das wäre: ${de(o.info ?? o.label)} Schau noch mal, worauf das ? zeigt.`) };
  })]);
  return {
    instruction: tx("Name the part", "Benenne den Teil"),
    text: tx(`A flower of the ${en(FAMILY_SHORT[fam])}. What is the part marked "?" called?`, `Eine Blüte der ${de(FAMILY_SHORT[fam])}. Wie heißt der mit „?“ markierte Teil?`),
    visual: visual(DiversityFlowerPicture, { family: fam, mode: "numbers", ask: P.id, legend: "none" }),
    answer,
    hint: tx("Where does it sit: outside or inside, top or bottom? Is it green, coloured or yellow?", "Wo sitzt er: außen oder innen, oben oder unten? Ist er grün, bunt oder gelb?"),
    solution: [{ math: q(capT(P.label), "ans"), note: P.info ?? P.label, highlight: ["ans"] }],
    mistakes,
  };
}

function fruitMatchTask(rng: Rng): Exercise {
  const fams = pickSome(rng, FAMILIES, 4);
  const pairs: [Text, Text][] = fams.map((f) => [famName(f), FAMILY_FRUIT[f]]);
  const list: Mistake[] = [];
  if (fams.includes("brassicaceae") && fams.includes("fabaceae"))
    list.push({
      when: {
        kind: "match",
        pairs: [
          [famName("brassicaceae"), FAMILY_FRUIT.fabaceae],
          [famName("fabaceae"), FAMILY_FRUIT.brassicaceae],
        ],
      },
      title: tx("Silique or legume?", "Schote oder Hülse?"),
      say: tx("Both are pods! A silique (crucifers) has a thin partition in the middle, from 2 carpels. A legume (pea family) has none: it comes from 1 carpel. Peas grow in legumes.", "Beides sind Kapseln mit Samen! Die Schote (Kreuzblütler) hat eine dünne Scheidewand, aus 2 Fruchtblättern. Die Hülse (Schmetterlingsblütler) hat keine: Sie entsteht aus 1 Fruchtblatt. Erbsen wachsen in Hülsen."),
    });
  if (fams.includes("lamiaceae") && fams.includes("asteraceae"))
    list.push({
      when: {
        kind: "match",
        pairs: [
          [famName("lamiaceae"), FAMILY_FRUIT.asteraceae],
          [famName("asteraceae"), FAMILY_FRUIT.lamiaceae],
        ],
      },
      title: tx("Parachute or four nutlets?", "Schirmchen oder vier Nüsschen?"),
      say: tx("Think of the dandelion clock: composites make achenes with a parachute. The mint family's fruit splits into four nutlets.", "Denk an die Pusteblume: Korbblütler bilden Achänen mit Haarschirm. Die Frucht der Lippenblütler zerfällt in vier Nüsschen."),
    });
  return {
    instruction: tx("Match family and fruit", "Ordne Familie und Frucht zu"),
    text: tx("Which fruit is typical of which family?", "Welche Frucht ist typisch für welche Familie?"),
    answer: { kind: "match", pairs },
    hint: tx("Silique with a partition, legume without, four nutlets, a parachute, a grain…", "Schote mit Scheidewand, Hülse ohne, vier Nüsschen, ein Schirmchen, ein Korn …"),
    solution: [
      { math: join(q(famName(fams[0]), "a"), "\\to", q(FAMILY_FRUIT[fams[0]], "b")), note: FAMILY_FACTS[fams[0]].fruit },
      { math: join(q(famName(fams[1]), "c"), "\\to", q(FAMILY_FRUIT[fams[1]], "d")), note: FAMILY_FACTS[fams[1]].fruit },
      { math: join(q(famName(fams[2]), "e"), "\\to", q(FAMILY_FRUIT[fams[2]], "f"), "\\quad", q(famName(fams[3]), "g"), "\\to", q(FAMILY_FRUIT[fams[3]], "h")), note: tx("And the other two.", "Und die beiden anderen.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Select all that apply

function multiFeatureTask(rng: Rng): Exercise {
  const f = rng.pick(FAMILIES);
  const k = rng.int(2, 3);
  const rights: MultiOpt[] = pickSome(rng, FAMILY_FEATURES[f].list, k).map((t) => ({ text: t, right: true }));
  const others = pickSome(rng, FAMILY_CONFUSE[f].slice(0, 3), 5 - k);
  const wrongs: MultiOpt[] = others.map((o) => {
    const t = rng.pick(FAMILY_FEATURES[o].list.slice(0, FAMILY_FEATURES[o].key));
    return { text: t, right: false, title: tx("Another family", "Eine andere Familie"), say: tx(`"${en(t)}" belongs to the ${en(FAMILY_SHORT[o])}.`, `„${de(t)}“ gehört zu den ${DAT_DE[o]}.`) };
  });
  const { answer, mistakes } = multi(rng, [...rights, ...wrongs]);
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx(`Which features fit the **${en(FAMILY_SHORT[f])}**?`, `Welche Merkmale passen zu den **${DAT_DE[f]}**?`),
    answer,
    hint: tx(`Picture a typical flower: ${en(FAMILY_SIGN[f])}.`, `Stell dir eine typische Blüte vor: ${de(FAMILY_SIGN[f])}.`),
    solution: [{ math: q(famName(f), "ans"), note: tx(`Typical: ${rights.map((r) => en(r.text)).join("; ")}.`, `Typisch: ${rights.map((r) => de(r.text)).join("; ")}.`), highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------
// The family key

const FAM_TAXA: FamilyId[] = ["asteraceae", "poaceae", "brassicaceae", "rosaceae", "fabaceae", "lamiaceae"];
const pathText = (p: [number, "a" | "b"][]) => p.map(([n, s]) => `${n}${s}`).join(" → ");

function keyTask(rng: Rng): Exercise {
  const f = rng.pick(FAM_TAXA);
  const path = keyPath(FAMILY_KEY, f);
  const ex = rng.pick(PLANT_EXAMPLES.filter((p) => p.family === f));
  const wrong = pickSome(rng, FAMILY_CONFUSE[f].slice(0, 4), 3);
  const { answer, mistakes } = choice(rng, familyOpts(f, wrong));
  const feats = path.map(([n, s]) => FAMILY_KEY.couplets[n - 1][s].text);
  return {
    instruction: tx("Identify with the key", "Bestimme mit dem Schlüssel"),
    text: tx(`You find a plant (${en(ex.name)}). What you see: ${feats.map((x) => en(x).charAt(0).toLowerCase() + en(x).slice(1)).join("; ")}. Which family does the key lead to?`, `Du findest eine Pflanze (${de(ex.name)}). Das siehst du: ${feats.map((x) => de(x)).join("; ")}. Zu welcher Familie führt der Schlüssel?`),
    visual: visual(DiversityKeyTable, { which: "families" }),
    answer,
    hint: tx("Start at 1 and pick the line that matches what you see. Follow the numbers.", "Beginne bei 1 und wähle die Zeile, die zu deiner Beobachtung passt. Folge den Nummern."),
    solution: [{ math: join(q(pathText(path), "p"), "\\Rightarrow#r", q(famName(f), "ans")), note: tx(`The path ${pathText(path)} ends at the **${en(FAMILY_SHORT[f])}**.`, `Der Weg ${pathText(path)} endet bei den **${DAT_DE[f]}**.`), highlight: ["ans"] }],
    mistakes,
  };
}

// ---------------------------------------------------------------------------

export function generate2(rng: Rng): Exercise {
  switch (rng.int(0, 12)) {
    case 0:
    case 1:
      return featuresTask(rng);
    case 2:
    case 3:
      return exampleTask(rng);
    case 4:
      return formulaFamilyTask(rng);
    case 5:
      return countTask(rng);
    case 6:
      return symbolTask(rng);
    case 7:
      return writeTask(rng);
    case 8:
      return diagramTask(rng);
    case 9:
      return partTask(rng);
    case 10:
      return fruitMatchTask(rng);
    case 11:
      return multiFeatureTask(rng);
    default:
      return keyTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const checkFeatures = featuresTask(createRng(21), "lamiaceae", [0, 1]);
const checkCount = countTask(createRng(1), COUNTS.find((c) => c.code.startsWith("vK(5)C1") && c.whorl === "A")!);
const checkFormula = formulaFamilyTask(createRng(6), FORMULAS[0]);
const checkClover = exampleTask(createRng(13), PLANT_EXAMPLES.find((p) => en(p.name) === "red clover")!);

export const level2: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("What is a plant family?", "Was ist eine Pflanzenfamilie?"),
      blob: tx("Rape, mustard and cabbage: three plants, one family. Let's see why!", "Raps, Senf und Kohl: drei Pflanzen, eine Familie. Schauen wir, warum!"),
      body: tx("Plants that are closely related have flowers built to the same plan. Botanists group them into **families**. So to identify a plant, look at its flower first.", "Nah verwandte Pflanzen haben Blüten nach demselben Bauplan. Botaniker fassen sie zu **Familien** zusammen. Zum Bestimmen schaust du deshalb zuerst auf die Blüte."),
      frames: [
        { math: join(q(tx("rape", "Raps"), "a"), "\\quad", q(tx("mustard", "Senf"), "b"), "\\quad", q(tx("cabbage", "Kohl"), "c")), note: tx("Rape, mustard and cabbage look quite different as plants.", "Raps, Senf und Kohl sehen als Pflanzen ganz verschieden aus.") },
        { math: join(q(tx("4 sepals", "4 Kelchblätter"), "k"), "\\;", q(tx("4 petals", "4 Kronblätter"), "c"), "\\;", q(tx("6 stamens", "6 Staubblätter"), "s")), note: tx("But their flowers are the same: 4 sepals, 4 petals in a cross, 6 stamens (4 long, 2 short), and a pod with a partition: the silique.", "Aber ihre Blüten sind gleich: 4 Kelchblätter, 4 Kronblätter über Kreuz, 6 Staubblätter (4 lange, 2 kurze) und eine Frucht mit Scheidewand: die Schote.") },
        { math: join(q(tx("same flower plan", "gleicher Blütenbau"), "p"), "\\Rightarrow#r", q(tx("family: crucifers", "Familie: Kreuzblütler"), "f")), note: tx("Same flower plan means close relatives: they form the family of the **crucifers**.", "Gleicher Blütenbau heißt nahe Verwandtschaft: Sie bilden die Familie der **Kreuzblütler**."), highlight: ["f"] },
      ],
    },
    {
      type: "widget",
      title: tx("Six families", "Sechs Familien"),
      blob: tx("Tap the numbers on each flower. Spot what makes each family special!", "Tipp auf die Nummern jeder Blüte. Finde, was jede Familie besonders macht!"),
      body: tx("Crucifers, mint family, pea family, rose family, daisy family and grasses: each has its own flower plan and its own fruit.", "Kreuzblütler, Lippenblütler, Schmetterlingsblütler, Rosengewächse, Korbblütler und Süßgräser: Jede Familie hat ihren eigenen Blütenbau und ihre eigene Frucht."),
      widget: DiversityFamilies,
    },
    { type: "check", blob: tx("Two flowers with only one plane of symmetry. Which one is it?", "Zwei Blüten mit nur einer Symmetrieebene. Welche ist es?"), exercise: checkFeatures },
    {
      type: "explain",
      title: tx("Reading a floral formula", "Die Blütenformel lesen"),
      blob: tx("A whole flower in one line. Let's decode it!", "Eine ganze Blüte in einer Zeile. Entschlüsseln wir sie!"),
      body: tx("A **floral formula** describes a flower in short: symmetry, then sepals, petals, stamens and carpels with their numbers.", "Eine **Blütenformel** beschreibt eine Blüte in Kurzform: die Symmetrie, dann Kelch-, Kron-, Staub- und Fruchtblätter mit ihrer Anzahl."),
      frames: [
        { math: '"✱"#s', note: tx("First the symmetry: **✱** radial (several planes of symmetry), **↓** zygomorphic (only one).", "Zuerst die Symmetrie: **✱** radiär (mehrere Symmetrieebenen), **↓** zygomorph (nur eine).") },
        { math: '"✱"#s \\; "K4"#k', note: tx("**K** stands for the calyx: 4 free sepals.", "**K** steht für den Kelch: 4 freie Kelchblätter.") },
        { math: '"✱"#s \\; "K4"#k \\; "C4"#c', note: tx("**C** stands for the corolla: 4 free petals. If calyx and corolla look the same, you write **P** (perianth), as in the tulip.", "**C** steht für die Krone: 4 freie Kronblätter. Sehen Kelch und Krone gleich aus, schreibt man **P** (Blütenhülle), wie bei der Tulpe.") },
        { math: '"✱"#s \\; "K4"#k \\; "C4"#c \\; "A2+4"#a', note: tx("**A** stands for the stamens. **+** separates groups: 2 short and 4 long.", "**A** steht für die Staubblätter. **+** trennt Gruppen: 2 kurze und 4 lange.") },
        { math: '"✱"#s \\; "K4"#k \\; "C4"#c \\; "A2+4"#a \\; "G(2)"#g', note: tx("**G** stands for the carpels. **Brackets** mean fused: 2 carpels form one ovary. A line under the number: ovary superior; over it: inferior.", "**G** steht für die Fruchtblätter. **Klammern** heißen verwachsen: 2 Fruchtblätter bilden einen Fruchtknoten. Ein Strich unter der Zahl: Fruchtknoten oberständig; darüber: unterständig."), highlight: ["g"] },
        { math: tx('"✱ K4 C4 A2+4 G(2)" \\Rightarrow "crucifers"', '"✱ K4 C4 A2+4 G(2)" \\Rightarrow "Kreuzblütler"'), note: tx("That's the formula of the crucifers. And **∞** means many, as in A∞ for the rose family.", "Das ist die Formel der Kreuzblütler. Und **∞** heißt viele, wie bei A∞ der Rosengewächse.") },
      ],
    },
    {
      type: "widget",
      title: tx("Build the formula", "Bau die Formel"),
      blob: tx("Look at the floral diagram and pick a chip in every row!", "Schau dir das Blütendiagramm an und wähle in jeder Zeile einen Baustein!"),
      body: tx("A **floral diagram** shows the flower from above, every circle of parts as a ring: green sepals outside, then the petals, the yellow anthers and the ovary in the middle. Count and build the formula.", "Ein **Blütendiagramm** zeigt die Blüte von oben, jeden Kreis von Blütenteilen als Ring: außen die grünen Kelchblätter, dann die Kronblätter, die gelben Staubbeutel und in der Mitte der Fruchtknoten. Zähle und bau die Formel."),
      widget: DiversityFormulaBuilder,
    },
    { type: "check", blob: tx("Count carefully: brackets are part of the sum!", "Zähl genau: Klammern gehören mit zur Summe!"), exercise: checkCount },
    { type: "check", blob: tx("Fours everywhere. Which family loves the number four?", "Überall Vieren. Welche Familie liebt die Vier?"), exercise: checkFormula },
    {
      type: "widget",
      title: tx("Finding the family with a key", "Die Familie mit dem Schlüssel finden"),
      blob: tx("Your turn to be the botanist!", "Jetzt bist du die Botanikerin oder der Botaniker!"),
      body: tx("Work through the key step by step. Watch out: a clover head or a dandelion looks like one flower, but is it?", "Arbeite den Schlüssel Schritt für Schritt durch. Vorsicht: Ein Kleeköpfchen oder ein Löwenzahn sieht aus wie eine Blüte, aber ist es eine?"),
      widget: DiversityFamilyKey,
    },
    { type: "check", blob: tx("A classic trap from the meadow!", "Eine klassische Falle von der Wiese!"), exercise: checkClover },
  ],
  summary: [
    {
      title: tx("Six families at a glance", "Sechs Familien auf einen Blick"),
      examples: [
        tx('"crucifers: 4 petals in a cross, silique"', '"Kreuzblütler: 4 Kronblätter über Kreuz, Schote"'),
        tx('"mint family: two lips, square stem"', '"Lippenblütler: Ober- und Unterlippe, vierkantig"'),
        tx('"pea family: standard, wings, keel, legume"', '"Schmetterlingsblütler: Fahne, Flügel, Schiffchen, Hülse"'),
        tx('"rose family: 5 petals, many stamens"', '"Rosengewächse: 5 Kronblätter, viele Staubblätter"'),
        tx('"daisy family: a head of many florets"', '"Korbblütler: Körbchen aus vielen Blüten"'),
        tx('"grasses: spikelets, stalk with nodes"', '"Süßgräser: Ährchen, Halm mit Knoten"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Floral formula", "Blütenformel"),
      body: tx("✱ radial, ↓ zygomorphic. K calyx, C corolla, P perianth, A stamens, G carpels. Brackets: fused. +: groups. ∞: many. Line under G: superior, over G: inferior.", "✱ radiär, ↓ zygomorph. K Kelch, C Krone, P Blütenhülle, A Staubblätter, G Fruchtblätter. Klammer: verwachsen. +: Gruppen. ∞: viele. Strich unter G: oberständig, über G: unterständig."),
      tone: "rule",
    },
    {
      title: tx("Formulas to know", "Formeln, die du kennen solltest"),
      examples: [
        tx('"crucifers:" \\; "✱ K4 C4 A2+4 G(2)"', '"Kreuzblütler:" \\; "✱ K4 C4 A2+4 G(2)"'),
        tx('"mint family:" \\; "↓ K(5) C(2+3) A2+2 G(2)"', '"Lippenblütler:" \\; "↓ K(5) C(2+3) A2+2 G(2)"'),
        tx('"pea family:" \\; "↓ K(5) C1+2+(2) A(9)+1 G1"', '"Schmetterlingsblütler:" \\; "↓ K(5) C1+2+(2) A(9)+1 G1"'),
        tx('"tulip:" \\; "✱ P3+3 A3+3 G(3)"', '"Tulpe:" \\; "✱ P3+3 A3+3 G(3)"'),
      ],
      tone: "tip",
    },
    {
      title: tx("Floral diagram", "Blütendiagramm"),
      body: tx("The flower seen from above: rings from outside in are sepals, petals, stamens, carpels. The dot shows the side of the stem; arcs joining parts mean fused.", "Die Blüte von oben: Von außen nach innen Kelch-, Kron-, Staub- und Fruchtblätter. Der Punkt zeigt zur Sprossachse; verbindende Bögen heißen verwachsen."),
      tone: "tip",
    },
    {
      title: tx("Using a key", "Bestimmen mit dem Schlüssel"),
      body: tx("Always two statements, a and b. Choose the one that fits, follow the number, and compare the result with the plant.", "Immer zwei Aussagen, a und b. Wähle die passende, folge der Nummer und vergleich das Ergebnis mit der Pflanze."),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx("Pea and mint flowers are both zygomorphic: standard, wings, keel vs. two lips. Silique (crucifers, partition) ≠ legume (peas, no partition). Clover and dandelion heads are many flowers. Brackets mean fused, not \"one\".", "Schmetterlings- und Lippenblüte sind beide zygomorph: Fahne, Flügel, Schiffchen gegen zwei Lippen. Schote (Kreuzblütler, Scheidewand) ≠ Hülse (Erbse, keine Scheidewand). Klee- und Löwenzahnköpfchen sind viele Blüten. Klammern heißen verwachsen, nicht „eins“."),
      tone: "warning",
    },
  ],
};
