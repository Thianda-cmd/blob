"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { VertebrateClassRow } from "@/learn/biology/visuals/VertebrateAnimals";
import { VertebrateClassCards } from "@/learn/biology/visuals/VertebrateClasses";
import { VertebrateSorter } from "@/learn/biology/visuals/VertebrateSorter";
import { VertebrateThermo } from "@/learn/biology/visuals/VertebrateTemperature";
import { animal, ANIMALS, CLASS_IDS, CLASSES, cold, FEATURES, INVERTEBRATES, TheName, theName, type Animal, type ClassId } from "./data";
import { cap, capT, choice, de, en, join, mistakes, q, visual, where, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Helpers

const PRONOUN = { der: "er", die: "sie", das: "es" } as const;
/** "Which class does it belong to?" with the right German pronoun. */
const whichClass = (a: Animal): Text => tx("Which class does it belong to?", `Zu welcher Klasse gehört ${PRONOUN[a.art]}?`);
const sentence = (a: Animal, rest: Text): Text => tx(`${en(TheName(a))} ${en(rest)}.`, `${de(TheName(a))} ${de(rest)}.`);

/** The key features of an animal (its clues that fit its class, or its class profile). */
function keyFeatures(a: Animal): Text {
  const fits = (a.clues ?? []).filter((c) => c.fits?.includes(a.cls)).map((c) => c.text);
  const list = fits.length >= 2 ? fits.slice(0, 3) : [CLASSES[a.cls].skin, CLASSES[a.cls].breath, CLASSES[a.cls].young];
  return tx(list.map(en).join("; "), list.map(de).join("; "));
}

/** Blob's note when a student puts animal `a` into class `c`. */
function classSay(a: Animal, c: ClassId): { title: Text; say: Text } {
  const trap = a.traps?.[c];
  if (trap) {
    const title =
      c === "amph" && (a.cls === "rept" || a.cls === "mammal")
        ? tx("'Amphibian' isn't a habitat", "„Amphibie“ ist kein Lebensraum")
        : c === "fish" && a.cls === "mammal"
          ? tx("Habitat doesn't decide", "Der Lebensraum entscheidet nicht")
          : c === "bird" && a.cls === "mammal"
            ? tx("Flying isn't a class", "Fliegen ist keine Klasse")
            : tx("Looks can deceive", "Der Schein trügt");
    return { title, say: trap };
  }
  return { title: tx("Check the features", "Prüf die Merkmale"), say: tx(`${en(CLASSES[c].test)} Does that match this animal?`, `${de(CLASSES[c].test)} Passt das zu diesem Tier?`) };
}

const classOpt = (c: ClassId): Text => CLASSES[c].name;

// ---------------------------------------------------------------------------
// Task shapes

const TRICKY = ANIMALS.filter((a) => a.traps);

function classOfTask(rng: Rng, fixed?: Animal): Exercise {
  const a = fixed ?? (rng.chance(0.65) ? rng.pick(TRICKY) : rng.pick(ANIMALS));
  const trapClasses = Object.keys(a.traps ?? {}) as ClassId[];
  const others = rng.shuffle(CLASS_IDS.filter((c) => c !== a.cls && !trapClasses.includes(c)));
  const wrong = [...trapClasses, ...others].slice(0, 3);
  const opts: Opt[] = [{ text: classOpt(a.cls) }, ...wrong.map((c) => ({ text: classOpt(c), ...classSay(a, c) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Which class?", "Welche Klasse?"),
    text: a.note ? join(sentence(a, a.note), tx(`**${en(whichClass(a))}**`, `**${de(whichClass(a))}**`)) : tx(`Which class does **${en(theName(a))}** belong to?`, `Zu welcher Klasse gehört **${de(theName(a))}**?`),
    answer,
    hint: tx("Look at skin, breathing, body temperature and offspring, not at habitat or how it moves.", "Achte auf Haut, Atmung, Körpertemperatur und Fortpflanzung, nicht auf Lebensraum oder Fortbewegung."),
    solution: [
      { math: q(a.name, "a"), note: tx(`Key features: ${en(keyFeatures(a))}.`, `Entscheidende Merkmale: ${de(keyFeatures(a))}.`) },
      { math: join(q(a.name, "a"), "\\Rightarrow#r", q(CLASSES[a.cls].name, "c")), note: tx(`So ${en(theName(a))} is **${en(CLASSES[a.cls].one)}**.`, `${de(TheName(a))} ist also **${de(CLASSES[a.cls].one)}**.`), highlight: ["c"] },
    ],
    mistakes: list,
  };
}

export function featureClassTask(rng: Rng, fixedId?: string): Exercise {
  const f = fixedId ? FEATURES.find((x) => x.id === fixedId)! : rng.pick(FEATURES);
  const rest = rng.shuffle(CLASS_IDS.filter((c) => c !== f.cls && c !== f.near)).slice(0, 2);
  const opts: Opt[] = [
    { text: classOpt(f.cls) },
    { text: classOpt(f.near), title: tx("Close relative, wrong class", "Knapp daneben"), say: f.nearSay },
    ...rest.map((c) => ({ text: classOpt(c), title: tx("Not typical there", "Dort nicht typisch"), say: tx(`That isn't typical of ${en(CLASSES[c].name).toLowerCase()}. ${en(CLASSES[c].test)}`, `Das ist nicht typisch für ${de(CLASSES[c].name)}. ${de(CLASSES[c].test)}`) })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Feature and class", "Merkmal und Klasse"),
    text: tx(`Which class of vertebrates is this typical of: **${en(f.text)}**?`, `Für welche Wirbeltierklasse ist das typisch: **${de(f.text)}**?`),
    answer,
    hint: tx("Think of a typical member of each class: trout, frog, lizard, blackbird, mouse.", "Denk an ein typisches Tier jeder Klasse: Forelle, Frosch, Eidechse, Amsel, Maus."),
    solution: [
      { math: join(q(f.text, "f"), "\\Rightarrow#r", q(CLASSES[f.cls].name, "c")), note: tx(`${cap(en(f.text))}: that's typical of **${en(CLASSES[f.cls].name).toLowerCase()}**.`, `${cap(de(f.text))}: Das ist typisch für **${de(CLASSES[f.cls].name)}**.`), highlight: ["c"] },
    ],
    mistakes: list,
  };
}

type Prop = { text: Text; ok: boolean; say?: Text };
const ALL_FEATURES: Record<ClassId, Prop[]> = {
  bird: [
    { text: tx("feathers", "Federn"), ok: true },
    { text: tx("a beak without teeth", "Schnabel ohne Zähne"), ok: true },
    { text: tx("warm-blooded", "gleichwarm"), ok: true },
    { text: tx("eggs with a hard lime shell", "Eier mit harter Kalkschale"), ok: true },
    { text: tx("can fly", "können fliegen"), ok: false, say: tx("Not all of them! Penguins, ostriches and kiwis are birds that can't fly. Feathers make a bird, not flying.", "Nicht alle! Pinguin, Strauß und Kiwi sind Vögel, die nicht fliegen können. Federn machen den Vogel, nicht das Fliegen.") },
    { text: tx("cold-blooded", "wechselwarm"), ok: false, say: tx("Birds make their own heat and keep about 40 °C, even in the snow.", "Vögel erzeugen ihre eigene Wärme und halten etwa 40 °C, sogar im Schnee.") },
  ],
  mammal: [
    { text: tx("hair or fur", "Haare oder Fell"), ok: true },
    { text: tx("young are fed with milk", "Junge werden mit Milch gesäugt"), ok: true },
    { text: tx("breathe with lungs", "atmen mit Lungen"), ok: true },
    { text: tx("warm-blooded", "gleichwarm"), ok: true },
    { text: tx("give birth to live young", "bringen lebende Junge zur Welt"), ok: false, say: tx("Almost all, but not all: the platypus and the echidna lay eggs. They still feed their young with milk.", "Fast alle, aber nicht alle: Schnabeltier und Ameisenigel legen Eier. Ihre Jungen bekommen trotzdem Milch.") },
    { text: tx("live on land", "leben an Land"), ok: false, say: tx("Whales, dolphins and manatees are mammals that live in water all their lives.", "Wale, Delfine und Seekühe sind Säugetiere, die ihr ganzes Leben im Wasser verbringen.") },
  ],
  fish: [
    { text: tx("breathe with gills", "atmen mit Kiemen"), ok: true },
    { text: tx("fins", "Flossen"), ok: true },
    { text: tx("cold-blooded", "wechselwarm"), ok: true },
    { text: tx("breathe with lungs", "atmen mit Lungen"), ok: false, say: tx("Fish take oxygen from the water with their gills. Whales and dolphins use lungs, but they aren't fish.", "Fische holen den Sauerstoff mit Kiemen aus dem Wasser. Wale und Delfine atmen mit Lungen, sind aber keine Fische.") },
    { text: tx("dry skin with horny scales", "trockene Haut mit Hornschuppen"), ok: false, say: tx("Fish scales are made of bone and sit in slimy skin. Dry horny scales belong to reptiles.", "Fischschuppen sind aus Knochen und stecken in schleimiger Haut. Trockene Hornschuppen haben Reptilien.") },
  ],
  amph: [
    { text: tx("moist skin without scales", "feuchte Haut ohne Schuppen"), ok: true },
    { text: tx("larvae that breathe with gills", "Larven, die mit Kiemen atmen"), ok: true },
    { text: tx("cold-blooded", "wechselwarm"), ok: true },
    { text: tx("lay eggs with a shell on land", "legen Eier mit Schale an Land"), ok: false, say: tx("That's reptiles. Amphibian eggs (spawn) have no shell: they would dry out on land, so they are laid in water.", "Das machen Reptilien. Amphibieneier (Laich) haben keine Schale: An Land würden sie vertrocknen, deshalb liegen sie im Wasser.") },
    { text: tx("live only in water", "leben nur im Wasser"), ok: false, say: tx("Only the larvae do. Adult frogs, toads and salamanders spend a lot of time on land.", "Nur die Larven. Erwachsene Frösche, Kröten und Salamander verbringen viel Zeit an Land.") },
  ],
  rept: [
    { text: tx("dry skin with horny scales", "trockene Haut mit Hornschuppen"), ok: true },
    { text: tx("breathe with lungs", "atmen mit Lungen"), ok: true },
    { text: tx("cold-blooded", "wechselwarm"), ok: true },
    { text: tx("four legs", "vier Beine"), ok: false, say: tx("Snakes and slow worms are reptiles without legs. Count the scales, not the legs!", "Schlangen und Blindschleichen sind Reptilien ohne Beine. Zähl die Schuppen, nicht die Beine!") },
    { text: tx("larvae with gills", "Larven mit Kiemen"), ok: false, say: tx("That's amphibians. Young reptiles hatch from the egg looking like small adults and breathe with lungs straight away.", "Das sind Amphibien. Junge Reptilien schlüpfen schon als kleine Erwachsene aus dem Ei und atmen sofort mit Lungen.") },
  ],
};

function allFeaturesTask(rng: Rng): Exercise {
  const c = rng.pick(CLASS_IDS);
  const pool = ALL_FEATURES[c];
  const trues = rng.shuffle(pool.filter((p) => p.ok)).slice(0, rng.int(2, 3));
  const falses = rng.shuffle(pool.filter((p) => !p.ok)).slice(0, 2);
  const items = rng.shuffle([...trues, ...falses]);
  const options = items.map((p) => capT(p.text));
  const correct = where(items, (p) => p.ok);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((p, i) => {
    if (!p.ok && p.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((x, y) => x - y) }, tx("Not all of them", "Nicht bei allen"), p.say);
  });
  items.forEach((p, i) => {
    if (p.ok && correct.length > 1) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== i) }, tx("One more fits", "Eins passt noch"), tx(`Nearly! "${en(p.text)}" is true for all ${en(CLASSES[c].name).toLowerCase()} too.`, `Fast! „${de(p.text)}“ gilt auch für alle ${de(CLASSES[c].name)}.`), true);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx(`Which features do **all ${en(CLASSES[c].name).toLowerCase()}** have?`, `Welche Merkmale haben **alle ${de(CLASSES[c].name)}**?`),
    answer,
    hint: tx("Careful with 'all': think of the unusual members of the class too.", "Vorsicht bei „alle“: Denk auch an die ungewöhnlichen Mitglieder der Klasse."),
    solution: [
      { math: tx(correct.map((i, k) => `"${en(options[i])}"#c${k}`).join(" , "), correct.map((i, k) => `"${de(options[i])}"#c${k}`).join(" , ")), note: tx(`These are true for every member of the class ${en(CLASSES[c].name).toLowerCase()}.`, `Diese Merkmale gelten für alle ${de(CLASSES[c].name)}.`) },
    ],
    mistakes: m.list.slice(0, 5),
  };
}

function matchTask(rng: Rng, fixed?: string[]): Exercise {
  let chosen: Animal[];
  if (fixed) chosen = fixed.map(animal);
  else {
    const classes = rng.shuffle(CLASS_IDS).slice(0, 4);
    chosen = classes.map((c) => {
      const pool = ANIMALS.filter((a) => a.cls === c);
      const tricky = pool.filter((a) => a.traps);
      return rng.chance(0.6) && tricky.length ? rng.pick(tricky) : rng.pick(pool);
    });
  }
  const used = chosen.map((a) => a.cls);
  const extra = CLASS_IDS.filter((c) => !used.includes(c));
  const pairs: [Text, Text][] = chosen.map((a) => [capT(a.name), classOpt(a.cls)]);
  const list: Mistake[] = [];
  for (const a of chosen) {
    for (const [c, say] of Object.entries(a.traps ?? {}) as [ClassId, Text][]) {
      if (list.length >= 3 || list.some((m) => m.when.kind === "match" && en(m.when.pairs[0][0]) === en(capT(a.name)))) continue;
      list.push({ when: { kind: "match", pairs: [[capT(a.name), classOpt(c)]] }, title: classSay(a, c).title, say });
    }
  }
  return {
    instruction: tx("Match each animal to its class", "Ordne jedem Tier seine Klasse zu"),
    answer: { kind: "match", pairs, distractors: extra.map(classOpt) },
    hint: tx("One class is left over. Decide by skin, breathing and offspring.", "Eine Klasse bleibt übrig. Entscheide nach Haut, Atmung und Fortpflanzung."),
    solution: chosen.map((a, k) => ({
      math: join(q(a.name, `a${k}`), "\\to", q(CLASSES[a.cls].name, `c${k}`)),
      note: tx(`${cap(en(a.name))}: ${en(keyFeatures(a))}.`, `${de(a.name)}: ${de(keyFeatures(a))}.`),
    })),
    mistakes: list,
  };
}

/** "the skin" / "die Haut", for Blob's notes. */
const ROW_THE = {
  skin: tx("the skin", "die Haut"),
  breath: tx("the breathing", "die Atmung"),
  temp: tx("the body temperature", "die Körpertemperatur"),
  young: tx("the offspring", "die Fortpflanzung"),
  extra: tx("the other features", "die übrigen Merkmale"),
} as const;
const ROW_LABEL = {
  skin: tx("Skin", "Haut"),
  breath: tx("Breathing", "Atmung"),
  temp: tx("Body temperature", "Körpertemperatur"),
  young: tx("Offspring", "Fortpflanzung"),
  extra: tx("Also", "Außerdem"),
} as const;
type Row = keyof typeof ROW_LABEL;
const NEIGHBOUR: Record<ClassId, ClassId[]> = { fish: ["amph"], amph: ["rept", "fish"], rept: ["amph"], bird: ["mammal", "rept"], mammal: ["bird"] };

function profileTask(rng: Rng): Exercise {
  const c = rng.pick(CLASS_IDS);
  const rows = rng.shuffle(Object.keys(ROW_LABEL) as Row[]).slice(0, 3);
  const C = CLASSES[c];
  const answer: AnswerSpec = { kind: "word", accept: C.accept, placeholder: tx("class", "Klasse") };
  const m = mistakes(answer);
  for (const n of NEIGHBOUR[c]) {
    const differ = rows.find((r) => en(CLASSES[n][r]) !== en(C[r])) ?? rows[0];
    m.add(
      { kind: "word", accept: CLASSES[n].accept },
      tx("Close, but no", "Knapp daneben"),
      tx(`Check ${en(ROW_THE[differ])}: ${en(CLASSES[n].name).toLowerCase()} have "${en(CLASSES[n][differ])}". Does that match the profile?`, `Prüf ${de(ROW_THE[differ])}: ${de(CLASSES[n].name)} haben „${de(CLASSES[n][differ])}“. Passt das zum Steckbrief?`),
    );
  }
  const lines = (l: "en" | "de") => rows.map((r) => `**${l === "en" ? en(ROW_LABEL[r]) : de(ROW_LABEL[r])}:** ${l === "en" ? en(C[r]) : de(C[r])}`).join(" · ");
  return {
    instruction: tx("Name the class", "Nenne die Klasse"),
    text: tx(`A profile: ${lines("en")}. Which class of vertebrates is it?`, `Ein Steckbrief: ${lines("de")}. Welche Wirbeltierklasse ist das?`),
    answer,
    hint: tx("Which line fits only one class?", "Welche Zeile passt nur zu einer Klasse?"),
    solution: [
      { math: q(C[rows[0]], "r"), note: tx(`${en(ROW_LABEL[rows[0]])}: ${en(C[rows[0]])}.`, `${de(ROW_LABEL[rows[0]])}: ${de(C[rows[0]])}.`) },
      { math: join(q(tx("profile", "Steckbrief"), "p"), "\\Rightarrow#r", q(C.name, "c")), note: tx(`All three lines fit **${en(C.name).toLowerCase()}**.`, `Alle drei Zeilen passen zu den **${de(C.name)}**.`), highlight: ["c"] },
    ],
    mistakes: m.list,
  };
}

const ODD_VERTS = ["slowworm", "seahorse", "eel", "axolotl", "penguin", "bat", "whale", "salamander", "ostrich", "platypus"];

function vertebrateMultiTask(rng: Rng): Exercise {
  const odd = rng.pick(ODD_VERTS.map(animal));
  const verts = [odd, ...rng.shuffle(ANIMALS.filter((a) => a.id !== odd.id)).slice(0, rng.int(1, 2))];
  const trapInv = rng.pick(INVERTEBRATES.filter((i) => i.trap));
  const invs = [trapInv, ...rng.shuffle(INVERTEBRATES.filter((i) => i !== trapInv)).slice(0, 5 - verts.length)];
  const items = rng.shuffle([...verts.map((a) => ({ name: a.name, v: true as const, a })), ...invs.map((i) => ({ name: i.name, v: false as const, i }))]);
  const options = items.map((x) => capT(x.name));
  const correct = where(items, (x) => x.v);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  items.forEach((x, i) => {
    if (!x.v && x.i.trap) m.add({ kind: "multi", options, correct: [...correct, i].sort((p, r) => p - r) }, tx("No backbone", "Keine Wirbelsäule"), x.i.trap);
  });
  items.forEach((x, i) => {
    if (x.v && x.a.id === odd.id) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== i) }, tx("That one has a backbone", "Das hat eine Wirbelsäule"), tx(`${en(TheName(x.a))} has a skull and a backbone too: it's ${en(CLASSES[x.a.cls].one)}.`, `${de(TheName(x.a))} hat auch einen Schädel und eine Wirbelsäule: ${PRONOUN[x.a.art] === "er" ? "Er" : PRONOUN[x.a.art] === "sie" ? "Sie" : "Es"} ist ${de(CLASSES[x.a.cls].one)}.`));
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these animals are **vertebrates**?", "Welche dieser Tiere sind **Wirbeltiere**?"),
    answer,
    hint: tx("Vertebrates have a bony inner skeleton with a backbone. Watch out for names that sound like fish.", "Wirbeltiere haben ein Innenskelett aus Knochen mit Wirbelsäule. Vorsicht bei Namen, die nach Fisch klingen."),
    solution: [
      { math: tx('"vertebrates:"#h \\; "backbone + skull"#k', '"Wirbeltiere:"#h \\; "Wirbelsäule + Schädel"#k'), note: tx("Only animals with a backbone count.", "Nur Tiere mit Wirbelsäule zählen.") },
      { math: tx(correct.map((i, k) => `"${en(options[i])}"#c${k}`).join(" , "), correct.map((i, k) => `"${de(options[i])}"#c${k}`).join(" , ")), note: tx(`The others are invertebrates: ${invs.map((i) => `${en(i.name)} (${en(i.group)})`).join(", ")}.`, `Die anderen sind Wirbellose: ${invs.map((i) => `${de(i.name)} (${de(i.group)})`).join(", ")}.`) },
    ],
    mistakes: m.list,
  };
}

type Statement = { text: Text; why: Text };
const TRUE_ST: Statement[] = [
  { text: tx("Whales breathe with lungs.", "Wale atmen mit Lungen."), why: tx("Whales come up to the surface to breathe air through the blowhole.", "Wale tauchen zum Atmen auf und holen durch das Blasloch Luft.") },
  { text: tx("Penguins are birds, although they can't fly.", "Pinguine sind Vögel, obwohl sie nicht fliegen können."), why: tx("Penguins have feathers and a beak and lay eggs with a lime shell.", "Pinguine haben Federn und einen Schnabel und legen Eier mit Kalkschale.") },
  { text: tx("The platypus lays eggs and is still a mammal.", "Das Schnabeltier legt Eier und ist trotzdem ein Säugetier."), why: tx("It has fur and feeds its young with milk.", "Es hat Fell und ernährt seine Jungen mit Milch.") },
  { text: tx("Bats feed their young with milk.", "Fledermäuse säugen ihre Jungen mit Milch."), why: tx("Bats are mammals.", "Fledermäuse sind Säugetiere.") },
  { text: tx("Tadpoles breathe with gills.", "Kaulquappen atmen mit Kiemen."), why: tx("Amphibian larvae live in water and breathe with gills; adults use lungs and skin.", "Amphibienlarven leben im Wasser und atmen mit Kiemen, Erwachsene mit Lungen und Haut.") },
  { text: tx("In cold-blooded animals the body temperature depends on the surroundings.", "Bei wechselwarmen Tieren hängt die Körpertemperatur von der Umgebung ab."), why: tx("That's exactly what cold-blooded (wechselwarm) means.", "Genau das bedeutet wechselwarm.") },
  { text: tx("All vertebrates have a backbone and a skull.", "Alle Wirbeltiere haben eine Wirbelsäule und einen Schädel."), why: tx("That's what makes them vertebrates.", "Das macht sie zu Wirbeltieren.") },
  { text: tx("The eel is a fish.", "Der Aal ist ein Fisch."), why: tx("Eels breathe with gills and have fins and tiny scales.", "Aale atmen mit Kiemen und haben Flossen und winzige Schuppen.") },
  { text: tx("Most reptiles lay eggs with a shell on land.", "Die meisten Reptilien legen Eier mit Schale an Land."), why: tx("The shell protects the egg from drying out, so reptiles don't need water to breed.", "Die Schale schützt das Ei vor dem Austrocknen, Reptilien brauchen zum Fortpflanzen kein Wasser.") },
  { text: tx("Snakes are vertebrates.", "Schlangen sind Wirbeltiere."), why: tx("A snake has a very long backbone with up to 400 vertebrae.", "Eine Schlange hat eine sehr lange Wirbelsäule mit bis zu 400 Wirbeln.") },
];
const FALSE_ST: Statement[] = [
  { text: tx("Whales are fish because they live in the sea.", "Wale sind Fische, weil sie im Meer leben."), why: tx("Habitat doesn't decide the class: whales breathe with lungs and suckle their young.", "Der Lebensraum entscheidet nicht über die Klasse: Wale atmen mit Lungen und säugen ihre Jungen.") },
  { text: tx("Bats are birds because they can fly.", "Fledermäuse sind Vögel, weil sie fliegen können."), why: tx("Flying isn't a class feature: bats have fur and suckle their young.", "Fliegen ist kein Klassenmerkmal: Fledermäuse haben Fell und säugen ihre Jungen.") },
  { text: tx("Crocodiles are amphibians because they live in water and on land.", "Krokodile sind Amphibien, weil sie im Wasser und an Land leben."), why: tx("'Amphibian' is a class, not a habitat. Crocodiles have horny scales and lay eggs with a shell: reptiles.", "„Amphibie“ ist eine Klasse, kein Lebensraum. Krokodile haben Hornschuppen und legen Eier mit Schale.") },
  { text: tx("Cold-blooded animals are always cold.", "Wechselwarme Tiere sind immer kalt."), why: tx("On a hot day a lizard can be as warm as you. Its temperature simply follows the surroundings.", "An einem heißen Tag kann eine Eidechse so warm sein wie du. Ihre Temperatur folgt einfach der Umgebung.") },
  { text: tx("All mammals give birth to live young.", "Alle Säugetiere bringen lebende Junge zur Welt."), why: tx("The platypus and the echidna lay eggs.", "Schnabeltier und Ameisenigel legen Eier.") },
  { text: tx("All birds can fly.", "Alle Vögel können fliegen."), why: tx("Penguins, ostriches and kiwis can't fly.", "Pinguine, Strauße und Kiwis können nicht fliegen.") },
  { text: tx("Frogs have dry skin with horny scales.", "Frösche haben eine trockene Haut mit Hornschuppen."), why: tx("Frogs have moist skin full of glands. Horny scales are a reptile feature.", "Frösche haben feuchte Haut voller Drüsen. Hornschuppen sind ein Reptilienmerkmal.") },
  { text: tx("Salamanders are reptiles.", "Salamander sind Reptilien."), why: tx("Salamanders look like lizards, but they have moist skin without scales and larvae with gills.", "Salamander sehen aus wie Eidechsen, haben aber feuchte Haut ohne Schuppen und Larven mit Kiemen.") },
  { text: tx("The cuttlefish is a fish.", "Der Tintenfisch ist ein Fisch."), why: tx("A cuttlefish is a mollusc without a backbone.", "Ein Tintenfisch ist ein Weichtier ohne Wirbelsäule.") },
  { text: tx("Snakes aren't vertebrates because they have no legs.", "Schlangen sind keine Wirbeltiere, weil sie keine Beine haben."), why: tx("Legs don't matter: snakes have a long backbone.", "Beine sind egal: Schlangen haben eine lange Wirbelsäule.") },
  { text: tx("Fish breathe with lungs.", "Fische atmen mit Lungen."), why: tx("Fish breathe with gills: they take oxygen out of the water.", "Fische atmen mit Kiemen: Sie holen den Sauerstoff aus dem Wasser.") },
];

function statementTask(rng: Rng, wantTrue: boolean): Exercise {
  const right = rng.pick(wantTrue ? TRUE_ST : FALSE_ST);
  const others = rng.shuffle(wantTrue ? FALSE_ST : TRUE_ST).slice(0, 3);
  const opts: Opt[] = [
    { text: right.text },
    ...others.map((s) =>
      wantTrue
        ? { text: s.text, title: tx("That one is false", "Die stimmt nicht"), say: s.why }
        : { text: s.text, title: tx("That one is true", "Die stimmt doch"), say: tx(`That statement is actually true: ${en(s.why)}`, `Diese Aussage stimmt tatsächlich: ${de(s.why)}`) },
    ),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: wantTrue ? tx("Which statement is true?", "Welche Aussage stimmt?") : tx("Which statement is false?", "Welche Aussage ist falsch?"),
    text: wantTrue ? tx("Exactly **one** of these statements is true.", "Genau **eine** dieser Aussagen stimmt.") : tx("Exactly **one** of these statements is false.", "Genau **eine** dieser Aussagen ist falsch."),
    answer,
    hint: tx("Look for the trap: habitat, flying and looks don't decide the class.", "Such die Falle: Lebensraum, Fliegen und Aussehen entscheiden nicht über die Klasse."),
    solution: [{ math: wantTrue ? tx('"true"#t', '"stimmt"#t') : tx('"false"#t', '"falsch"#t'), note: tx(`"${en(right.text)}" ${en(right.why)}`, `„${de(right.text)}“ ${de(right.why)}`) }],
    mistakes: list,
  };
}

function oddOneOutTask(rng: Rng): Exercise | null {
  const odd = rng.pick(TRICKY);
  const majority = rng.pick(Object.keys(odd.traps!) as ClassId[]);
  const pool = ANIMALS.filter((a) => a.cls === majority);
  if (pool.length < 3) return null;
  const weird = pool.filter((a) => a.traps);
  const members = rng.shuffle([...(weird.length && rng.chance(0.7) ? [rng.pick(weird)] : []), ...rng.shuffle(pool)]).filter((a, i, all) => all.findIndex((b) => b.id === a.id) === i).slice(0, 3);
  const opts: Opt[] = [
    { text: capT(odd.name) },
    ...members.map((a) => ({
      text: capT(a.name),
      title: a.traps ? tx("It really belongs", "Gehört wirklich dazu") : tx("Same class", "Gleiche Klasse"),
      say: tx(`${en(TheName(a))} is ${en(CLASSES[a.cls].one)} like the others. Which animal only looks like one?`, `${de(TheName(a))} ist wie die anderen ${de(CLASSES[a.cls].one)}. Welches Tier sieht nur so aus?`),
    })),
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Odd one out", "Wer passt nicht?"),
    text: tx("Three of these animals belong to the same class. Which one doesn't?", "Drei dieser Tiere gehören zur selben Klasse. Welches nicht?"),
    answer,
    hint: tx("Compare skin, breathing and offspring, not habitat.", "Vergleiche Haut, Atmung und Fortpflanzung, nicht den Lebensraum."),
    solution: [
      { math: tx(members.map((a, k) => `"${en(a.name)}"#m${k}`).join(" , ") + ` \\to "${en(CLASSES[majority].name)}"#c`, members.map((a, k) => `"${de(a.name)}"#m${k}`).join(" , ") + ` \\to "${de(CLASSES[majority].name)}"#c`), note: tx(`These three are ${en(CLASSES[majority].name).toLowerCase()}.`, `Diese drei sind ${de(CLASSES[majority].name)}.`) },
      { math: join(q(odd.name, "o"), "\\to", q(CLASSES[odd.cls].name, "k")), note: odd.traps![majority]!, highlight: ["o"] },
    ],
    mistakes: list,
  };
}

const WARM_OPTS: Text[] = [tx("Warm-blooded", "Gleichwarm"), tx("Cold-blooded", "Wechselwarm")];

function tempKindTask(rng: Rng): Exercise {
  const a = rng.pick(ANIMALS);
  const isCold = cold(a.cls);
  const answer: AnswerSpec = { kind: "choice", options: WARM_OPTS, correct: isCold ? 1 : 0 };
  const say: Text = isCold
    ? tx(`Only birds and mammals make their own body heat. Which class is ${en(theName(a))}?`, `Nur Vögel und Säugetiere erzeugen ihre Körperwärme selbst. Zu welcher Klasse gehört ${de(theName(a))}?`)
    : a.cls === "mammal" && ["whale", "dolphin", "seal", "manatee", "otter"].includes(a.id)
      ? tx("Even in cold water it keeps its body at about 37 °C. A thick layer of fat (blubber) or fur insulates it.", "Selbst im kalten Wasser hält es seinen Körper bei etwa 37 °C. Eine dicke Speckschicht oder ein Fell isoliert.")
      : tx(`Birds and mammals keep their body temperature constant. Which class is ${en(theName(a))}?`, `Vögel und Säugetiere halten ihre Körpertemperatur konstant. Zu welcher Klasse gehört ${de(theName(a))}?`);
  return {
    instruction: tx("Warm- or cold-blooded?", "Gleichwarm oder wechselwarm?"),
    text: tx(`Is **${en(theName(a))}** warm-blooded or cold-blooded?`, `Ist **${de(theName(a))}** gleichwarm oder wechselwarm?`),
    answer,
    hint: tx("Only two classes are warm-blooded.", "Nur zwei Klassen sind gleichwarm."),
    solution: [
      { math: join(q(a.name, "a"), "\\to", q(CLASSES[a.cls].name, "c")), note: tx(`${cap(en(theName(a)))} is ${en(CLASSES[a.cls].one)}.`, `${de(TheName(a))} ist ${de(CLASSES[a.cls].one)}.`) },
      { math: join(q(CLASSES[a.cls].name, "c"), "\\Rightarrow#r", q(WARM_OPTS[isCold ? 1 : 0], "w")), note: isCold ? tx("Fish, amphibians and reptiles are **cold-blooded**: their body temperature follows the surroundings.", "Fische, Amphibien und Reptilien sind **wechselwarm**: Ihre Körpertemperatur folgt der Umgebung.") : tx("Birds and mammals are **warm-blooded**: they keep their body temperature constant.", "Vögel und Säugetiere sind **gleichwarm**: Sie halten ihre Körpertemperatur konstant."), highlight: ["w"] },
    ],
    mistakes: [{ when: { kind: "choice", options: WARM_OPTS, correct: isCold ? 0 : 1 }, title: tx("Who makes heat?", "Wer heizt selbst?"), say }],
  };
}

const COLD_ANIMALS = ["lizard", "grasssnake", "crocodile", "frog", "toad", "tortoise", "adder"];

export function bodyTempTask(rng: Rng, fixed?: { id: string; ta: number }): Exercise {
  const warmCase = !fixed && rng.chance(0.3);
  const a = fixed ? animal(fixed.id) : warmCase ? animal(rng.pick(["hedgehog", "squirrel", "polarbear", "blackbird", "penguin"])) : animal(rng.pick(COLD_ANIMALS));
  const ta = fixed?.ta ?? (warmCase ? rng.pick([-10, -5, 0, 5]) : rng.pick([6, 10, 14, 18, 25, 28, 30, 33, 35]));
  const own = a.cls === "bird" ? 40 : 37;
  const deg = (v: number): Text => tx(`about ${v} °C`, `etwa ${v} °C`);
  let opts: Opt[];
  if (warmCase) {
    opts = [
      { text: deg(own) },
      { text: deg(ta), title: tx("It heats itself", "Heizt selbst"), say: tx(`${en(TheName(a))} is warm-blooded: energy from its food keeps the body warm, whatever the weather.`, `${de(TheName(a))} ist gleichwarm: Energie aus der Nahrung hält den Körper warm, egal wie das Wetter ist.`) },
      { text: deg(own - 20), title: tx("Constant, not lower", "Konstant, nicht niedriger"), say: tx("Warm-blooded animals keep their temperature constant. They don't cool down halfway in the cold.", "Gleichwarme Tiere halten ihre Temperatur konstant. Sie kühlen in der Kälte nicht halb ab.") },
    ];
  } else {
    const others: Opt[] = [
      { text: deg(37), title: tx("That's warm-blooded", "Das wäre gleichwarm"), say: tx("37 °C all the time is typical of mammals. A cold-blooded animal doesn't heat itself.", "Immer 37 °C ist typisch für Säugetiere. Ein wechselwarmes Tier heizt nicht selbst.") },
    ];
    if (ta >= 18)
      others.push({ text: deg(5), title: tx("Cold-blooded isn't cold", "Wechselwarm ist nicht kalt"), say: tx("Cold-blooded doesn't mean always cold! In warm surroundings the body warms up too.", "Wechselwarm heißt nicht immer kalt! In warmer Umgebung wird auch der Körper warm.") });
    else others.push({ text: deg(ta + 15), title: tx("No inner heater", "Keine innere Heizung"), say: tx("The animal can't make its own heat. Its body ends up about as warm as its surroundings.", "Das Tier kann keine eigene Wärme erzeugen. Sein Körper ist etwa so warm wie die Umgebung.") });
    opts = [{ text: deg(ta) }, ...others];
  }
  const { answer, mistakes: list } = choice(rng, opts);
  const where_: Text = ta <= 0 ? tx("in the snow", "im Schnee") : ta >= 25 ? tx("in the sun", "in der Sonne") : tx("outside", "draußen");
  return {
    instruction: tx("Body temperature", "Körpertemperatur"),
    text: tx(`${en(TheName(a))} sits ${en(where_)}. The air is ${ta} °C. About how warm is its body?`, `${de(TheName(a))} sitzt ${de(where_)}. Die Luft hat ${ta} °C. Wie warm ist ${PRONOUN[a.art] === "er" ? "sein" : PRONOUN[a.art] === "sie" ? "ihr" : "sein"} Körper etwa?`),
    answer,
    hint: tx(`Is ${en(theName(a))} warm-blooded or cold-blooded?`, `Ist ${de(theName(a))} gleichwarm oder wechselwarm?`),
    solution: [
      { math: join(q(a.name, "a"), "\\to", q(warmCase ? WARM_OPTS[0] : WARM_OPTS[1], "w")), note: warmCase ? tx(`${cap(en(theName(a)))} is warm-blooded.`, `${de(TheName(a))} ist gleichwarm.`) : tx(`${cap(en(theName(a)))} is cold-blooded.`, `${de(TheName(a))} ist wechselwarm.`) },
      { math: tx(`"body:"#k \\; ${warmCase ? own : ta}#t "°C"`, `"Körper:"#k \\; ${warmCase ? own : ta}#t "°C"`), note: warmCase ? tx(`The body stays at about ${own} °C, even at ${ta} °C outside.`, `Die Körpertemperatur bleibt bei etwa ${own} °C, auch bei ${ta} °C draußen.`) : tx(`The body temperature follows the air: about ${ta} °C.`, `Die Körpertemperatur folgt der Luft: etwa ${ta} °C.`), highlight: ["t"] },
    ],
    mistakes: list,
  };
}

function pictureClassTask(rng: Rng): Exercise {
  const c = rng.pick(CLASS_IDS);
  const answer: AnswerSpec = { kind: "word", accept: CLASSES[c].accept, placeholder: tx("class", "Klasse") };
  const m = mistakes(answer);
  for (const n of NEIGHBOUR[c]) m.add({ kind: "word", accept: CLASSES[n].accept }, tx("Neighbouring class", "Nachbarklasse"), tx(`Look again at the marked animal: ${en(CLASSES[n].test)} Is that what you see?`, `Schau dir das markierte Tier noch mal an: ${de(CLASSES[n].test)} Siehst du das?`));
  return {
    instruction: tx("Name the class", "Nenne die Klasse"),
    text: tx("The marked animal is a typical member of its class. Which class is it?", "Das markierte Tier ist ein typischer Vertreter seiner Klasse. Welche Klasse ist das?"),
    visual: visual(VertebrateClassRow, { ask: c }),
    answer,
    hint: tx("Fish, amphibians, reptiles, birds or mammals?", "Fische, Amphibien, Reptilien, Vögel oder Säugetiere?"),
    solution: [{ math: q(CLASSES[c].name, "c"), note: tx(`${en(CLASSES[c].test)}`, `${de(CLASSES[c].test)}`) }],
    mistakes: m.list,
  };
}

export function generate1(rng: Rng): Exercise {
  for (let tries = 0; tries < 20; tries++) {
    const roll = rng.int(0, 11);
    const ex =
      roll <= 1
        ? classOfTask(rng)
        : roll === 2
          ? featureClassTask(rng)
          : roll === 3
            ? allFeaturesTask(rng)
            : roll === 4
              ? matchTask(rng)
              : roll === 5
                ? profileTask(rng)
                : roll === 6
                  ? vertebrateMultiTask(rng)
                  : roll === 7
                    ? statementTask(rng, rng.chance(0.6))
                    : roll === 8
                      ? oddOneOutTask(rng)
                      : roll === 9
                        ? tempKindTask(rng)
                        : roll === 10
                          ? bodyTempTask(rng)
                          : rng.chance(0.4)
                            ? pictureClassTask(rng)
                            : classOfTask(rng);
    if (ex) return ex;
  }
  return classOfTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const introFrames: Frame[] = [
  {
    math: tx('"vertebrates"#w', '"Wirbeltiere"#w'),
    note: tx(
      "Vertebrates have an inner skeleton of bone with a **backbone** made of many single vertebrae. It holds the body up and protects the spinal cord.",
      "Wirbeltiere haben ein Innenskelett aus Knochen mit einer **Wirbelsäule** aus vielen einzelnen Wirbeln. Sie stützt den Körper und schützt das Rückenmark.",
    ),
  },
  {
    math: tx('"vertebrates"#w = "backbone"#b + "skull"#s', '"Wirbeltiere"#w = "Wirbelsäule"#b + "Schädel"#s'),
    note: tx("They also have a **skull** that protects the brain.", "Dazu kommt ein **Schädel**, der das Gehirn schützt."),
  },
  {
    math: tx('"fish"#f \\; "amphibians"#a \\; "reptiles"#r \\\\ "birds"#v \\; "mammals"#m', '"Fische"#f \\; "Amphibien"#a \\; "Reptilien"#r \\\\ "Vögel"#v \\; "Säugetiere"#m'),
    note: tx("Vertebrates are sorted into **five classes**.", "Die Wirbeltiere teilt man in **fünf Klassen** ein."),
  },
  {
    math: tx('"invertebrates:"#x \\; "insects, snails, worms, jellyfish"#y', '"Wirbellose:"#x \\; "Insekten, Schnecken, Würmer, Quallen"#y'),
    note: tx(
      "Animals without a backbone are **invertebrates**: about 95 percent of all animal species! Insects have an outer skeleton, snails a shell, jellyfish no skeleton at all.",
      "Tiere ohne Wirbelsäule heißen **Wirbellose**: Das sind etwa 95 Prozent aller Tierarten! Insekten haben ein Außenskelett, Schnecken ein Gehäuse, Quallen gar kein Skelett.",
    ),
  },
];

const featureFrames: Frame[] = [
  { math: tx('"feathers"#a \\Rightarrow#r "birds"#b', '"Federn"#a \\Rightarrow#r "Vögel"#b'), note: tx("The body covering gives a class away fastest. Only one class has **feathers**: the birds.", "Am schnellsten verrät die **Körperbedeckung** die Klasse. Federn hat nur eine Klasse: die Vögel.") },
  { math: tx('"fur, hair"#a \\Rightarrow#r "mammals"#b', '"Fell, Haare"#a \\Rightarrow#r "Säugetiere"#b'), note: tx("Only mammals have hair. And only they feed their young with **milk** from milk glands.", "Haare haben nur Säugetiere. Und nur sie **säugen** ihre Jungen mit Milch aus Milchdrüsen, daher der Name.") },
  { math: tx('"dry horny scales"#a \\Rightarrow#r "reptiles"#b', '"trockene Hornschuppen"#a \\Rightarrow#r "Reptilien"#b'), note: tx("Dry skin with horny scales protects reptiles from drying out.", "Trockene Haut mit Hornschuppen schützt Reptilien vor dem Austrocknen.") },
  { math: tx('"moist skin with glands"#a \\Rightarrow#r "amphibians"#b', '"feuchte Drüsenhaut"#a \\Rightarrow#r "Amphibien"#b'), note: tx("Amphibians have bare, moist skin with many glands. They even breathe partly through it.", "Amphibien haben eine nackte, feuchte Haut mit vielen Drüsen. Durch sie atmen sie sogar zum Teil.") },
  { math: tx('"gills + fins"#a \\Rightarrow#r "fish"#b', '"Kiemen + Flossen"#a \\Rightarrow#r "Fische"#b'), note: tx("Fish breathe with **gills** all their life and swim with **fins**. Their skin has bony scales.", "Fische atmen ihr ganzes Leben mit **Kiemen** und schwimmen mit **Flossen**. Ihre Haut trägt Knochenschuppen.") },
  {
    math: tx('"warm-blooded:"#a \\; "birds, mammals"#b', '"gleichwarm:"#a \\; "Vögel, Säugetiere"#b'),
    note: tx("Only birds and mammals are **warm-blooded**: they keep their body temperature constant. Fish, amphibians and reptiles are **cold-blooded**.", "Nur Vögel und Säugetiere sind **gleichwarm**: Sie halten ihre Körpertemperatur konstant. Fische, Amphibien und Reptilien sind **wechselwarm**."),
  },
  {
    math: tx('"spawn"#a \\to "shell"#b \\to "lime shell"#c \\to "milk"#d', '"Laich"#a \\to "Schale"#b \\to "Kalkschale"#c \\to "Milch"#d'),
    note: tx(
      "Offspring: fish and amphibians lay spawn in water, reptiles lay eggs with a shell on land, birds brood eggs with a lime shell, and mammals give birth to young and suckle them.",
      "Fortpflanzung: Fische und Amphibien legen Laich ins Wasser, Reptilien legen Eier mit Schale an Land, Vögel bebrüten Eier mit Kalkschale, und Säugetiere gebären Junge und säugen sie.",
    ),
  },
];

const trapFrames: Frame[] = [
  { math: tx('"whale"#a \\Rightarrow#r "mammal"#b', '"Wal"#a \\Rightarrow#r "Säugetier"#b'), note: tx("The whale lives in the sea and is shaped like a fish. But it breathes with lungs, is warm-blooded and suckles its calf. **Habitat doesn't decide the class!**", "Der Wal lebt im Meer und hat eine Fischform. Aber er atmet mit Lungen, ist gleichwarm und säugt sein Junges. **Der Lebensraum entscheidet nicht über die Klasse!**") },
  { math: tx('"bat"#a \\Rightarrow#r "mammal"#b', '"Fledermaus"#a \\Rightarrow#r "Säugetier"#b'), note: tx("It flies, but it has fur instead of feathers and suckles its young.", "Sie fliegt, hat aber Fell statt Federn und säugt ihre Jungen.") },
  { math: tx('"penguin"#a \\Rightarrow#r "bird"#b', '"Pinguin"#a \\Rightarrow#r "Vogel"#b'), note: tx("It can't fly, but it has feathers and a beak and lays eggs with a lime shell.", "Er kann nicht fliegen, hat aber Federn und einen Schnabel und legt Eier mit Kalkschale.") },
  { math: tx('"crocodile"#a \\Rightarrow#r "reptile"#b', '"Krokodil"#a \\Rightarrow#r "Reptil"#b'), note: tx("It lives in water and on land, but it's no amphibian: dry skin with horny scales, eggs with a shell on land. 'Amphibian' is a class, not a description of the habitat.", "Es lebt im Wasser und an Land, ist aber keine Amphibie: trockene Haut mit Hornschuppen, Eier mit Schale an Land. „Amphibie“ ist eine Klasse, keine Beschreibung des Lebensraums.") },
  { math: tx('"platypus"#a \\Rightarrow#r "mammal"#b', '"Schnabeltier"#a \\Rightarrow#r "Säugetier"#b'), note: tx("It lays eggs and has a bill. Still, fur and milk make it a mammal: a rare exception.", "Es legt Eier und hat einen Schnabel. Trotzdem machen Fell und Milch es zum Säugetier: eine seltene Ausnahme.") },
];

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Animals with a backbone", "Tiere mit Wirbelsäule"),
      blob: tx("Feel along the middle of your back: those bumps are vertebrae. You're a vertebrate!", "Tast mal die Mitte deines Rückens ab: Die Huckel sind Wirbel. Du bist ein Wirbeltier!"),
      body: tx("Fish, frogs, lizards, birds and you have something in common: a **backbone** (spine).", "Fische, Frösche, Eidechsen, Vögel und du haben etwas gemeinsam: eine **Wirbelsäule**."),
      frames: introFrames,
    },
    {
      type: "widget",
      title: tx("The five classes", "Die fünf Klassen"),
      blob: tx("Tap through the classes. Each one has its own profile!", "Tipp dich durch die Klassen. Jede hat ihren eigenen Steckbrief!"),
      body: tx(
        "Each class shares the same features: body covering, breathing, body temperature and how the young develop.",
        "Die Tiere einer Klasse haben gemeinsame Merkmale: Körperbedeckung, Atmung, Körpertemperatur und Fortpflanzung.",
      ),
      widget: VertebrateClassCards,
    },
    {
      type: "explain",
      title: tx("How to tell the classes apart", "Woran du die Klassen erkennst"),
      blob: tx("Detective time: one clue is often enough!", "Detektivzeit: Oft reicht ein einziger Hinweis!"),
      frames: featureFrames,
    },
    {
      type: "check",
      blob: tx("Which class has this kind of skin?", "Welche Klasse hat so eine Haut?"),
      exercise: featureClassTask(createRng(3), "moist"),
    },
    {
      type: "widget",
      title: tx("Warm-blooded or cold-blooded?", "Gleichwarm oder wechselwarm?"),
      blob: tx("Turn up the heat and watch both thermometers!", "Dreh die Temperatur hoch und beobachte beide Thermometer!"),
      body: tx(
        "A **warm-blooded** animal (gleichwarm) keeps its body temperature constant: it burns food to make heat. In a **cold-blooded** animal (wechselwarm) the body temperature follows the surroundings.",
        "Ein **gleichwarmes** Tier hält seine Körpertemperatur konstant: Es verbrennt Nahrung, um Wärme zu erzeugen. Bei einem **wechselwarmen** Tier folgt die Körpertemperatur der Umgebung.",
      ),
      widget: VertebrateThermo,
    },
    {
      type: "check",
      blob: tx("A lizard on a hot rock. How warm is it?", "Eine Eidechse auf einem heißen Stein. Wie warm ist sie?"),
      exercise: bodyTempTask(createRng(1), { id: "lizard", ta: 33 }),
    },
    {
      type: "explain",
      title: tx("Watch out, traps!", "Vorsicht, Fallen!"),
      blob: tx("Some animals are masters of disguise. Don't let them fool you!", "Manche Tiere sind Meister der Verkleidung. Lass dich nicht reinlegen!"),
      body: tx("Habitat, body shape and the way an animal moves say **nothing** about its class. Only the features count.", "Lebensraum, Körperform und Fortbewegung verraten **nichts** über die Klasse. Es zählen nur die Merkmale."),
      frames: trapFrames,
    },
    {
      type: "widget",
      title: tx("Which class am I?", "Welche Klasse bin ich?"),
      blob: tx("Twelve tricky animals. How many can you get right first time?", "Zwölf knifflige Tiere. Wie viele schaffst du auf Anhieb?"),
      body: tx("Read each profile, then pick a class. Every clue is checked against your choice.", "Lies jeden Steckbrief und wähle dann eine Klasse. Jeder Hinweis wird mit deiner Wahl verglichen."),
      widget: VertebrateSorter,
    },
    {
      type: "check",
      blob: tx("Four animals, five classes. One is left over!", "Vier Tiere, fünf Klassen. Eine bleibt übrig!"),
      exercise: matchTask(createRng(2), ["bat", "penguin", "salamander", "eel"]),
    },
    {
      type: "check",
      blob: tx("Last one: careful with the names!", "Die letzte: Vorsicht bei den Namen!"),
      exercise: vertebrateMultiTask(createRng(31)),
    },
  ],
  summary: [
    {
      title: tx("Vertebrates", "Wirbeltiere"),
      body: tx(
        "Inner skeleton of bone with a **backbone** and a **skull**. Five classes: fish, amphibians, reptiles, birds, mammals. Animals without a backbone are **invertebrates** (insects, snails, worms, jellyfish).",
        "Innenskelett aus Knochen mit **Wirbelsäule** und **Schädel**. Fünf Klassen: Fische, Amphibien, Reptilien, Vögel, Säugetiere. Tiere ohne Wirbelsäule sind **Wirbellose** (Insekten, Schnecken, Würmer, Quallen).",
      ),
      tone: "rule",
    },
    {
      title: tx("Body covering and breathing", "Körperbedeckung und Atmung"),
      body: tx(
        "Fish: bony scales, gills. Amphibians: moist skin with glands; larvae gills, adults lungs and skin. Reptiles: dry skin with horny scales, lungs. Birds: feathers, lungs. Mammals: fur, lungs.",
        "Fische: Knochenschuppen, Kiemen. Amphibien: feuchte Drüsenhaut; Larven Kiemen, Erwachsene Lungen und Haut. Reptilien: trockene Haut mit Hornschuppen, Lungen. Vögel: Federn, Lungen. Säugetiere: Fell, Lungen.",
      ),
      examples: [tx('"feathers" \\Rightarrow "bird"', '"Federn" \\Rightarrow "Vogel"'), tx('"fur + milk" \\Rightarrow "mammal"', '"Fell + Milch" \\Rightarrow "Säugetier"')],
      tone: "rule",
    },
    {
      title: tx("Body temperature", "Körpertemperatur"),
      body: tx(
        "**Warm-blooded** (constant temperature): birds and mammals. **Cold-blooded** (temperature follows the surroundings): fish, amphibians, reptiles.",
        "**Gleichwarm** (konstante Temperatur): Vögel und Säugetiere. **Wechselwarm** (Temperatur folgt der Umgebung): Fische, Amphibien, Reptilien.",
      ),
      tone: "rule",
    },
    {
      title: tx("Offspring", "Fortpflanzung"),
      body: tx(
        "Fish and amphibians: spawn without a shell in water. Reptiles: eggs with a shell on land. Birds: eggs with a lime shell, brooded. Mammals: live young, fed with milk (exception: the platypus lays eggs).",
        "Fische und Amphibien: Laich ohne Schale im Wasser. Reptilien: Eier mit Schale an Land. Vögel: Eier mit Kalkschale, bebrütet. Säugetiere: lebende Junge, mit Milch gesäugt (Ausnahme: Das Schnabeltier legt Eier).",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic traps", "Typische Fallen"),
      body: tx(
        "Whale, dolphin and bat are **mammals**, penguin and ostrich are **birds**, crocodile and turtle are **reptiles** (not amphibians!), eel and seahorse are **fish**. Cuttlefish and starfish are no fish at all. Cold-blooded doesn't mean always cold.",
        "Wal, Delfin und Fledermaus sind **Säugetiere**, Pinguin und Strauß sind **Vögel**, Krokodil und Schildkröte sind **Reptilien** (keine Amphibien!), Aal und Seepferdchen sind **Fische**. Tintenfisch und Seestern sind gar keine Fische. Wechselwarm heißt nicht immer kalt.",
      ),
      tone: "warning",
    },
  ],
};
