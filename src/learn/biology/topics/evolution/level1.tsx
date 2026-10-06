"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { ARCH_FEATURES, ArchaeopteryxFigure, EvolutionArchaeopteryx, type ArchFeature } from "@/learn/biology/visuals/EvolutionArchaeopteryx";
import { EvolutionMoths } from "@/learn/biology/visuals/EvolutionMoths";
import { EvolutionDig, EvolutionRockColumn } from "@/learn/biology/visuals/EvolutionRockLayers";
import { EvolutionFamilyTree, EvolutionTreeFigure } from "@/learn/biology/visuals/EvolutionTree";
import { FOSSILS, FOSSIL_IDS, LEAVES, TREES, depthOf, lca, leavesOf, nodesOf, type FossilId, type LeafId, type TreeId } from "./data";
import { choice, de, en, indicesOf, join, mistakes, q, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Kinds of fossils

type Kind = "stone" | "imprint" | "amber" | "ice";

const KINDS: Record<Kind, { name: Text; what: Text }> = {
  stone: {
    name: tx("petrification", "Versteinerung"),
    what: tx("Minerals slowly replaced the hard parts (bones, shells, wood), so they turned into stone.", "Mineralien haben die harten Teile (Knochen, Schalen, Holz) nach und nach ersetzt. So wurden sie zu Stein."),
  },
  imprint: {
    name: tx("imprint", "Abdruck"),
    what: tx("The living thing left its shape in soft mud that later hardened to rock. The body itself is gone.", "Das Lebewesen hat seine Form in weichem Schlamm hinterlassen, der später zu Gestein wurde. Der Körper selbst ist weg."),
  },
  amber: {
    name: tx("inclusion in amber", "Einschluss in Bernstein"),
    what: tx("A small animal got stuck in sticky tree resin. The resin hardened to amber and keeps the whole body.", "Ein kleines Tier blieb in klebrigem Baumharz hängen. Das Harz wurde zu Bernstein und bewahrt den ganzen Körper."),
  },
  ice: {
    name: tx("frozen in permafrost", "im Dauerfrostboden eingefroren"),
    what: tx("The body froze in ground that never thaws. Skin, hair and even stomach contents can survive.", "Der Körper ist in Boden eingefroren, der nie auftaut. Haut, Haare und sogar Mageninhalt können erhalten bleiben."),
  },
};

const FINDS: { text: Text; kind: Kind }[] = [
  { kind: "amber", text: tx("A 40-million-year-old mosquito inside a golden lump of ancient, hardened tree resin.", "Eine 40 Millionen Jahre alte Mücke in einem goldgelben Klumpen aus uraltem, hart gewordenem Baumharz.") },
  { kind: "amber", text: tx("A spider, every hair on its legs still visible, enclosed in a clear yellow lump from the Baltic coast.", "Eine Spinne, an der man noch jedes Beinhärchen sieht, eingeschlossen in einem klaren gelben Klumpen von der Ostseeküste.") },
  { kind: "ice", text: tx("A baby mammoth with skin and hair, found in the frozen ground of Siberia.", "Ein Mammutbaby mit Haut und Haaren, gefunden im gefrorenen Boden Sibiriens.") },
  { kind: "ice", text: tx("A woolly rhinoceros with its fur still on, found in Siberian ground that never thaws.", "Ein Wollnashorn, dessen Fell noch erhalten ist, gefunden in sibirischem Boden, der nie auftaut.") },
  { kind: "imprint", text: tx("The outline of a fern leaf in a slab of slate. The leaf itself is gone, only its shape remains.", "Der Umriss eines Farnblatts in einer Schieferplatte. Das Blatt selbst ist weg, nur seine Form ist geblieben.") },
  { kind: "imprint", text: tx("The outline of a jellyfish in fine limestone, like a stamp.", "Der Umriss einer Qualle in feinem Kalkstein, wie ein Stempel.") },
  { kind: "imprint", text: tx("Three-toed footprints of a dinosaur in a slab of sandstone.", "Dreizehige Fußspuren eines Dinosauriers in einer Sandsteinplatte.") },
  { kind: "stone", text: tx("An ammonite shell whose material was slowly replaced by minerals: it is now solid stone.", "Ein Ammonitengehäuse, dessen Material langsam durch Mineralien ersetzt wurde: Es ist jetzt massiver Stein.") },
  { kind: "stone", text: tx("A tree trunk in which every cell is filled with quartz. It is as hard as rock.", "Ein Baumstamm, in dem jede Zelle mit Quarz gefüllt ist. Er ist hart wie Fels.") },
  { kind: "stone", text: tx("Dinosaur bones that turned into rock: minerals took the place of the bone material.", "Dinosaurierknochen, die zu Gestein wurden: Mineralien haben den Platz des Knochenmaterials eingenommen.") },
];

function kindSay(right: Kind, picked: Kind): { title: Text; say: Text } {
  if (picked === "imprint")
    return {
      title: tx("More than a shape", "Mehr als eine Form"),
      say: tx("An imprint only keeps the shape, the body is gone. Here something of the living thing itself is still there.", "Ein Abdruck bewahrt nur die Form, der Körper ist weg. Hier ist aber noch etwas vom Lebewesen selbst erhalten."),
    };
  if (picked === "amber") return { title: tx("No resin here", "Hier ist kein Harz"), say: tx("Amber is hardened tree resin. Is there any resin in this find?", "Bernstein ist hart gewordenes Baumharz. Ist bei diesem Fund überhaupt Harz im Spiel?") };
  if (picked === "ice")
    return {
      title: tx("Nothing frozen here", "Hier ist nichts gefroren"),
      say: tx("Frozen bodies only survive in ground that never thaws, like in Siberia. Is anything frozen here?", "Eingefrorene Körper gibt es nur in Boden, der nie auftaut, etwa in Sibirien. Ist hier etwas gefroren?"),
    };
  // picked "stone"
  if (right === "imprint")
    return {
      title: tx("Only the shape is left", "Nur die Form ist übrig"),
      say: tx("Nothing of the body turned into stone here: it's gone, and only its shape is left in the rock.", "Hier ist nichts vom Körper zu Stein geworden: Er ist weg, und nur seine Form ist im Gestein geblieben."),
    };
  if (right === "amber")
    return {
      title: tx("Hardened resin, not stone", "Hartes Harz, kein Stein"),
      say: tx("In amber nothing turns into stone. The animal is enclosed in hardened tree resin, often with every tiny hair.", "Im Bernstein wird nichts zu Stein. Das Tier ist in hart gewordenem Baumharz eingeschlossen, oft mit jedem Härchen."),
    };
  return {
    title: tx("Frozen, not stone", "Gefroren, nicht versteinert"),
    say: tx("Here even skin and hair survived, because the ground stayed frozen. Nothing turned into stone.", "Hier sind sogar Haut und Haare erhalten, weil der Boden gefroren blieb. Nichts ist versteinert."),
  };
}

function fossilKindTask(rng: Rng, find = rng.pick(FINDS)): Exercise {
  const others = (Object.keys(KINDS) as Kind[]).filter((k) => k !== find.kind);
  const { answer, mistakes: list } = choice(rng, [{ text: KINDS[find.kind].name }, ...others.map((k) => ({ text: KINDS[k].name, ...kindSay(find.kind, k) }))]);
  return {
    instruction: tx("What kind of fossil?", "Welche Art von Fossil?"),
    text: tx(`${en(find.text)} What kind of fossil is this?`, `${de(find.text)} Um welche Art von Fossil handelt es sich?`),
    answer,
    hint: tx("Ask yourself: is the body itself still there? Has it turned into stone, or is only its shape left?", "Frag dich: Ist der Körper selbst noch da? Ist er zu Stein geworden, oder ist nur seine Form übrig?"),
    solution: [{ math: q(KINDS[find.kind].name, "k"), note: KINDS[find.kind].what }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Rock layers

/** Four different fossils from the bank, top (youngest) to bottom (oldest). */
function column(rng: Rng, n = 4): FossilId[] {
  return rng
    .shuffle(FOSSIL_IDS)
    .slice(0, n)
    .sort((a, b) => FOSSILS[a].age - FOSSILS[b].age);
}

function rockAgeTask(rng: Rng, fixed?: { fossils: FossilId[]; oldest: boolean }): Exercise {
  const fossils = fixed?.fossils ?? column(rng);
  const oldest = fixed?.oldest ?? rng.chance(0.6);
  const right = oldest ? fossils[fossils.length - 1] : fossils[0];
  const wrongEnd = oldest ? fossils[0] : fossils[fossils.length - 1];
  const opts: Opt[] = [{ text: FOSSILS[right].name }];
  for (const f of fossils) {
    if (f === right) continue;
    opts.push(
      f === wrongEnd
        ? {
            text: FOSSILS[f].name,
            title: tx("Top and bottom swapped", "Oben und unten vertauscht"),
            say: oldest
              ? tx("That one lies in the top layer. The top layer settled last, so it is the youngest. Deeper means older!", "Dieses Fossil liegt in der obersten Schicht. Sie hat sich zuletzt abgelagert und ist deshalb die jüngste. Tiefer heißt älter!")
              : tx("That one lies in the bottom layer, which settled first: it is the oldest. The youngest layer is on top.", "Dieses Fossil liegt in der untersten Schicht, die sich zuerst abgelagert hat: Sie ist die älteste. Die jüngste Schicht liegt oben."),
          }
        : {
            text: FOSSILS[f].name,
            title: tx("Look at the depth", "Schau auf die Tiefe"),
            say: oldest
              ? tx("There is a layer below this one. Which fossil lies deepest?", "Unter dieser Schicht liegt noch eine weitere. Welches Fossil liegt am tiefsten?")
              : tx("There is a layer above this one. Which fossil lies highest?", "Über dieser Schicht liegt noch eine weitere. Welches Fossil liegt am höchsten?"),
          },
    );
  }
  const { answer, mistakes: list } = choice(rng, opts);
  const numbering = fixed ? [fossils[2], fossils[0], fossils[3], fossils[1]] : rng.shuffle(fossils);
  return {
    instruction: oldest ? tx("Find the oldest fossil", "Finde das älteste Fossil") : tx("Find the youngest fossil", "Finde das jüngste Fossil"),
    text: oldest
      ? tx("The rock layers here were never disturbed. Which fossil is the **oldest**?", "Die Gesteinsschichten hier wurden nie gestört. Welches Fossil ist am **ältesten**?")
      : tx("The rock layers here were never disturbed. Which fossil is the **youngest**?", "Die Gesteinsschichten hier wurden nie gestört. Welches Fossil ist am **jüngsten**?"),
    visual: visual(EvolutionRockColumn, { fossils, numbering }),
    answer,
    hint: tx("Layers settle one on top of the other. Which layer was there first?", "Schichten lagern sich übereinander ab. Welche Schicht war zuerst da?"),
    solution: [
      { math: tx('"deeper"#d \\Rightarrow "older"#o', '"tiefer"#d \\Rightarrow "älter"#o'), note: tx("Undisturbed layers: the deeper, the older.", "Ungestörte Schichten: Je tiefer, desto älter.") },
      {
        math: q(FOSSILS[right].name, "f"),
        note: tx(
          `The ${en(FOSSILS[right].name)} lies ${oldest ? "deepest" : "highest"}, so it is the ${oldest ? "oldest" : "youngest"} (${en(FOSSILS[right].ageText)}).`,
          `${capDe(FOSSILS[right].name)} liegt am ${oldest ? "tiefsten" : "höchsten"} und ist damit am ${oldest ? "ältesten" : "jüngsten"} (${de(FOSSILS[right].ageText)}).`,
        ),
      },
    ],
    mistakes: list,
  };
}

/** German nouns with their article for "… liegt am tiefsten". */
function capDe(t: Text) {
  const d = de(t);
  const art: Record<string, string> = {
    "Mammut-Stoßzahn": "Der Mammut-Stoßzahn",
    Urpferdchen: "Das Urpferdchen",
    "Urvogel Archaeopteryx": "Der Urvogel Archaeopteryx",
    "Dinosaurier-Fußspur": "Die Dinosaurier-Fußspur",
    Ammonit: "Der Ammonit",
    Baumfarnblatt: "Das Baumfarnblatt",
    Panzerfisch: "Der Panzerfisch",
    Trilobit: "Der Trilobit",
    "Stromatolith (Bakterienmatten)": "Der Stromatolith",
  };
  return art[d] ?? d;
}

function rockOrderTask(rng: Rng): Exercise {
  const fossils = column(rng);
  const items = [...fossils].reverse().map((f) => FOSSILS[f].name);
  const top = FOSSILS[fossils[0]].name;
  const bottom = FOSSILS[fossils[fossils.length - 1]].name;
  const m: Mistake[] = [
    {
      when: { kind: "order", items: [top, bottom] },
      title: tx("Upside down", "Verkehrt herum"),
      say: tx("You started with the top layer. But the top layer is the youngest: the oldest fossil lies at the bottom.", "Du hast mit der obersten Schicht angefangen. Die oberste ist aber die jüngste: Das älteste Fossil liegt ganz unten."),
    },
  ];
  return {
    instruction: tx("Order by age", "Ordne nach dem Alter"),
    text: tx("Sort the fossils from the **oldest** to the **youngest**. The layers were never disturbed.", "Ordne die Fossilien vom **ältesten** zum **jüngsten**. Die Schichten wurden nie gestört."),
    visual: visual(EvolutionRockColumn, { fossils, numbering: rng.shuffle(fossils) }),
    answer: { kind: "order", items, label: tx("oldest at the top", "das älteste oben") },
    hint: tx("Start with the deepest layer and work your way up.", "Fang bei der tiefsten Schicht an und arbeite dich nach oben."),
    solution: [
      {
        math: tx([...fossils].reverse().map((f, i) => `"${en(FOSSILS[f].name)}"#f${i}`).join(" \\to "), [...fossils].reverse().map((f, i) => `"${de(FOSSILS[f].name)}"#f${i}`).join(" \\to ")),
        note: tx(`From the bottom up: ${[...fossils].reverse().map((f) => `${en(FOSSILS[f].name)} (${en(FOSSILS[f].ageText)})`).join(", ")}.`, `Von unten nach oben: ${[...fossils].reverse().map((f) => `${de(FOSSILS[f].name)} (${de(FOSSILS[f].ageText)})`).join(", ")}.`),
      },
    ],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// Archaeopteryx

const EXTRA_REPTILE = { id: "belly", name: tx("belly ribs", "Bauchrippen"), bird: false };
const ARCH_POOL = [...ARCH_FEATURES, EXTRA_REPTILE];

function archMultiTask(rng: Rng, fixed?: { reptile: boolean; picks: string[] }): Exercise {
  const askReptile = fixed?.reptile ?? rng.chance(0.5);
  const birds = ARCH_POOL.filter((f) => f.bird);
  const reps = ARCH_POOL.filter((f) => !f.bird);
  const picked = fixed
    ? fixed.picks.map((id) => ARCH_POOL.find((f) => f.id === id)!)
    : rng.shuffle([...rng.shuffle(birds).slice(0, rng.int(2, 3)), ...rng.shuffle(reps).slice(0, rng.int(2, 3))]);
  const options = picked.map((f) => f.name);
  const correct = indicesOf(picked, (f) => f.bird !== askReptile);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  m.add(
    { kind: "multi", options, correct: indicesOf(picked, (f) => f.bird === askReptile) },
    tx("The other side", "Die andere Seite"),
    askReptile
      ? tx("You picked the bird features. Reptile features are the ones that today's birds don't have.", "Du hast die Vogelmerkmale gewählt. Reptilienmerkmale sind die, die heutige Vögel nicht haben.")
      : tx("You picked the reptile features. Bird features are the ones that today's birds still have.", "Du hast die Reptilienmerkmale gewählt. Vogelmerkmale sind die, die heutige Vögel auch haben."),
  );
  m.add({ kind: "multi", options, correct: picked.map((_, i) => i) }, tx("A mix of both", "Eine Mischung aus beidem"), tx("Not all of them! Archaeopteryx is a mix: some features are bird-like, others reptile-like.", "Nicht alle! Archaeopteryx ist eine Mischung: Manche Merkmale sind vogeltypisch, andere reptilientypisch."));
  const feathers = picked.findIndex((f) => f.id === "feathers");
  const teeth = picked.findIndex((f) => f.id === "teeth");
  if (askReptile && feathers >= 0)
    m.add(
      { kind: "multi", options, correct: [...correct, feathers].sort((a, b) => a - b) },
      tx("Feathers are bird-like", "Federn sind typisch Vogel"),
      tx("Feathers are the classic bird feature: no living reptile has feathers.", "Federn sind das klassische Vogelmerkmal: Kein heutiges Reptil hat Federn."),
    );
  if (!askReptile && teeth >= 0)
    m.add(
      { kind: "multi", options, correct: [...correct, teeth].sort((a, b) => a - b) },
      tx("Birds have no teeth", "Vögel haben keine Zähne"),
      tx("Today's birds have a horny beak without teeth. Teeth in the jaws are a reptile feature.", "Heutige Vögel haben einen Hornschnabel ohne Zähne. Zähne im Kiefer sind ein Reptilienmerkmal."),
    );
  const names = (list: number[], l: "en" | "de") => list.map((i) => (l === "en" ? en(options[i]) : de(options[i]))).join(", ");
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: askReptile ? tx("Which of these features of Archaeopteryx are **reptile features**?", "Welche dieser Merkmale des Archaeopteryx sind **Reptilienmerkmale**?") : tx("Which of these features of Archaeopteryx are **bird features**?", "Welche dieser Merkmale des Archaeopteryx sind **Vogelmerkmale**?"),
    visual: visual(ArchaeopteryxFigure, { mode: "plain" }),
    answer,
    hint: tx("Think of a pigeon: which of these does it have, too?", "Denk an eine Taube: Welche dieser Merkmale hat sie auch?"),
    solution: [
      { math: tx('"bird:"#v \\; "feathers, wings, wishbone"#a', '"Vogel:"#v \\; "Federn, Flügel, Gabelbein"#a'), note: tx("Birds today have feathers, wings and a wishbone.", "Heutige Vögel haben Federn, Flügel und ein Gabelbein.") },
      { math: tx('"reptile:"#r \\; "teeth, claws, long tail"#b', '"Reptil:"#r \\; "Zähne, Krallen, langer Schwanz"#b'), note: tx("Teeth, clawed fingers, a long bony tail and belly ribs are reptile features.", "Zähne, Finger mit Krallen, eine lange Schwanzwirbelsäule und Bauchrippen sind Reptilienmerkmale.") },
      { math: q(tx(names(correct, "en"), names(correct, "de")), "c"), note: askReptile ? tx("So these are the reptile features here.", "Das sind hier also die Reptilienmerkmale.") : tx("So these are the bird features here.", "Das sind hier also die Vogelmerkmale."), highlight: ["c"] },
    ],
    mistakes: m.list,
  };
}

const WHERE: Record<ArchFeature, Text> = {
  feathers: tx("all over the body and along the tail", "am ganzen Körper und am Schwanz entlang"),
  wing: tx("the big wing with its long flight feathers", "der große Flügel mit den langen Schwungfedern"),
  wishbone: tx("a V-shaped bone in the chest", "ein V-förmiger Knochen in der Brust"),
  teeth: tx("in the mouth", "im Maul"),
  claws: tx("at the front edge of the wing", "vorn am Flügel"),
  tail: tx("the chain of little bones in the tail", "die Kette kleiner Knochen im Schwanz"),
};

function archAskTask(rng: Rng): Exercise {
  const f = rng.pick(ARCH_FEATURES);
  const other = rng.pick(ARCH_FEATURES.filter((x) => x.id !== f.id));
  const third = rng.pick(ARCH_FEATURES.filter((x) => x.id !== f.id && x.id !== other.id));
  const kind = (bird: boolean) => (bird ? tx("bird feature", "Vogelmerkmal") : tx("reptile feature", "Reptilienmerkmal"));
  const label = (x: { name: Text }, bird: boolean): Text => tx(`${en(x.name)}: ${en(kind(bird))}`, `${de(x.name)}: ${de(kind(bird))}`);
  const { answer, mistakes: list } = choice(rng, [
    { text: label(f, f.bird) },
    {
      text: label(f, !f.bird),
      title: tx("Right part, wrong group", "Richtig erkannt, falsch zugeordnet"),
      say: f.bird
        ? tx("You found the right part! But today's birds have it too, so it's a bird feature.", "Das Merkmal hast du richtig erkannt! Aber heutige Vögel haben es auch, also ist es ein Vogelmerkmal.")
        : tx("You found the right part! But no bird today has it: it comes from the reptile ancestors.", "Das Merkmal hast du richtig erkannt! Aber kein heutiger Vogel hat es: Es stammt von den Reptilienvorfahren."),
    },
    { text: label(other, other.bird), title: tx("Another spot", "Eine andere Stelle"), say: tx(`That's somewhere else: ${en(WHERE[other.id])}. Look again where the question mark sits.`, `Das sitzt woanders: ${de(WHERE[other.id])}. Schau noch mal, wo das Fragezeichen ist.`) },
    { text: label(third, !third.bird), title: tx("Another spot", "Eine andere Stelle"), say: tx(`That's somewhere else: ${en(WHERE[third.id])}. Look again where the question mark sits.`, `Das sitzt woanders: ${de(WHERE[third.id])}. Schau noch mal, wo das Fragezeichen ist.`) },
  ]);
  return {
    instruction: tx("Name the feature", "Benenne das Merkmal"),
    text: tx("What is marked with **?** on Archaeopteryx, and is it a bird or a reptile feature?", "Was ist beim Archaeopteryx mit **?** markiert, und ist es ein Vogel- oder ein Reptilienmerkmal?"),
    visual: visual(ArchaeopteryxFigure, { mode: "numbers", ask: f.id, show: [f.id], legend: "none" }),
    answer,
    hint: tx("First find the spot, then think of a pigeon: does it have this too?", "Finde zuerst die Stelle und denk dann an eine Taube: Hat sie das auch?"),
    solution: [{ math: q(label(f, f.bird), "f"), note: f.bird ? tx(`${en(f.name)}: birds today have this too.`, `${de(f.name)}: Das haben heutige Vögel auch.`) : tx(`${en(f.name)}: no bird today has this. It comes from the reptile ancestors.`, `${de(f.name)}: Das hat kein heutiger Vogel. Es stammt von den Reptilienvorfahren.`) }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Adaptations

const ADAPT: { who: Text; how: Text; home: string }[] = [
  { who: tx("polar bear", "Eisbär"), how: tx("thick fur and a layer of fat against the cold", "dickes Fell und Fettschicht gegen Kälte"), home: "cold" },
  { who: tx("mountain hare", "Schneehase"), how: tx("brown in summer, white fur in winter", "im Sommer braun, im Winter weißes Fell"), home: "cold" },
  { who: tx("cactus", "Kaktus"), how: tx("stores water in its thick stem, spines instead of leaves", "speichert Wasser im dicken Spross, Dornen statt Blätter"), home: "desert" },
  { who: tx("fennec fox", "Wüstenfuchs (Fennek)"), how: tx("huge ears that give off heat", "riesige Ohren, die Wärme abgeben"), home: "desert" },
  { who: tx("duck", "Ente"), how: tx("webbed feet for paddling", "Schwimmhäute zum Paddeln"), home: "water" },
  { who: tx("trout", "Forelle"), how: tx("streamlined body and gills", "stromlinienförmiger Körper und Kiemen"), home: "water" },
  { who: tx("water lily", "Seerose"), how: tx("floating leaves with air spaces", "Schwimmblätter mit Lufträumen"), home: "water" },
  { who: tx("mole", "Maulwurf"), how: tx("shovel-like front paws for digging", "schaufelartige Vorderpfoten zum Graben"), home: "soil" },
  { who: tx("woodpecker", "Specht"), how: tx("chisel-like beak and a stiff tail for support", "meißelartiger Schnabel und Stützschwanz"), home: "forest" },
  { who: tx("squirrel", "Eichhörnchen"), how: tx("sharp claws for climbing and a bushy tail for balance", "spitze Krallen zum Klettern und buschiger Schwanz zum Balancieren"), home: "forest" },
];

function adaptTask(rng: Rng): Exercise {
  const picked = rng.shuffle(ADAPT).slice(0, 4);
  const pairs = picked.map((a) => [a.who, a.how] as [Text, Text]);
  const m: Mistake[] = [];
  for (let i = 0; i < picked.length; i++)
    for (let j = i + 1; j < picked.length; j++) {
      if (picked[i].home !== picked[j].home || m.length >= 2) continue;
      m.push({
        when: { kind: "match", pairs: [[picked[i].who, picked[j].how]] },
        title: tx("Same habitat, different tricks", "Gleicher Lebensraum, andere Tricks"),
        say: tx(
          `The ${en(picked[i].who)} and the ${en(picked[j].who)} live in the same kind of habitat, so both are adapted to it. But check again which feature belongs to whom.`,
          `${de(picked[i].who)} und ${de(picked[j].who)} leben in einem ähnlichen Lebensraum und sind beide daran angepasst. Prüf aber noch mal, welches Merkmal zu wem gehört.`,
        ),
      });
    }
  const extra = rng.pick(ADAPT.filter((a) => !picked.includes(a)));
  return {
    instruction: tx("Match the adaptations", "Ordne die Angepasstheiten zu"),
    text: tx("Each living thing is adapted to its habitat. Which feature belongs to which living thing? One feature is left over.", "Jedes Lebewesen ist an seinen Lebensraum angepasst. Welches Merkmal gehört zu welchem Lebewesen? Ein Merkmal bleibt übrig."),
    answer: { kind: "match", pairs, distractors: [extra.how] },
    hint: tx("Picture where each one lives: cold, desert, water, soil or forest. What helps it there?", "Stell dir vor, wo jedes lebt: Kälte, Wüste, Wasser, Boden oder Wald. Was hilft ihm dort?"),
    solution: [
      {
        math: tx(picked.map((a, i) => `"${en(a.who)}"#w${i}`).join(" \\quad "), picked.map((a, i) => `"${de(a.who)}"#w${i}`).join(" \\quad ")),
        note: tx(picked.map((a) => `${en(a.who)}: ${en(a.how)}.`).join(" "), picked.map((a) => `${de(a.who)}: ${de(a.how)}.`).join(" ")),
      },
    ],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// Natural selection: steps and explanations

type Story = { id: string; steps: Text[] };

const STORIES: Story[] = [
  {
    id: "moth",
    steps: [
      tx("Some peppered moths are light, a few are dark.", "Manche Birkenspanner sind hell, einige wenige dunkel."),
      tx("On sooty bark, birds spot the light moths more easily and eat them.", "Auf rußiger Rinde entdecken Vögel die hellen Falter leichter und fressen sie."),
      tx("More dark moths survive and reproduce.", "Mehr dunkle Falter überleben und pflanzen sich fort."),
      tx("Their offspring inherit the dark colour.", "Ihre Nachkommen erben die dunkle Farbe."),
      tx("After many generations most moths are dark.", "Nach vielen Generationen sind die meisten Falter dunkel."),
    ],
  },
  {
    id: "beetle",
    steps: [
      tx("In a population of leaf beetles, some are green and some brown.", "In einer Population von Blattkäfern sind manche grün, manche braun."),
      tx("On green leaves, birds find the brown beetles more easily.", "Auf grünen Blättern finden Vögel die braunen Käfer leichter."),
      tx("More green beetles survive and lay eggs.", "Mehr grüne Käfer überleben und legen Eier."),
      tx("The young beetles inherit the green colour.", "Die jungen Käfer erben die grüne Farbe."),
      tx("After many generations almost all beetles are green.", "Nach vielen Generationen sind fast alle Käfer grün."),
    ],
  },
  {
    id: "bacteria",
    steps: [
      tx("By chance, a few bacteria are resistant to an antibiotic.", "Zufällig sind einige wenige Bakterien gegen ein Antibiotikum resistent."),
      tx("The antibiotic kills the bacteria that are not resistant.", "Das Antibiotikum tötet die Bakterien, die nicht resistent sind."),
      tx("The resistant bacteria survive and divide.", "Die resistenten Bakterien überleben und teilen sich."),
      tx("Their daughter cells are resistant too.", "Ihre Tochterzellen sind ebenfalls resistent."),
      tx("After a while most bacteria are resistant: the antibiotic no longer works.", "Nach einiger Zeit sind die meisten Bakterien resistent: Das Antibiotikum wirkt nicht mehr."),
    ],
  },
  {
    id: "rats",
    steps: [
      tx("A few rats in a town carry a variant that makes them resistant to rat poison.", "Einige Ratten einer Stadt tragen eine Erbanlage, die sie gegen Rattengift resistent macht."),
      tx("Poison is put out: most rats without this variant die.", "Gift wird ausgelegt: Die meisten Ratten ohne diese Erbanlage sterben."),
      tx("The resistant rats survive and have young.", "Die resistenten Ratten überleben und bekommen Junge."),
      tx("The young inherit the resistance.", "Die Jungen erben die Resistenz."),
      tx("After a few years most rats in the town are resistant.", "Nach einigen Jahren sind die meisten Ratten der Stadt resistent."),
    ],
  },
];

const STEP_NAMES: Text[] = [tx("variation", "Variation"), tx("selection", "Auslese"), tx("reproduction", "Fortpflanzung"), tx("inheritance", "Vererbung"), tx("change", "Wandel")];

function selectionOrderTask(rng: Rng): Exercise {
  const story = rng.pick(STORIES);
  const s = story.steps;
  return {
    instruction: tx("Put the steps in order", "Bring die Schritte in die richtige Reihenfolge"),
    text: tx("How does natural selection work here? Put the steps in the right order.", "Wie läuft die natürliche Selektion hier ab? Bring die Schritte in die richtige Reihenfolge."),
    answer: { kind: "order", items: s },
    hint: tx("First there must be differences. Then some survive better. Only survivors have offspring.", "Zuerst muss es Unterschiede geben. Dann überleben manche besser. Nur Überlebende haben Nachkommen."),
    solution: [
      {
        math: tx(STEP_NAMES.map((n, i) => `"${en(n)}"#s${i}`).join(" \\to "), STEP_NAMES.map((n, i) => `"${de(n)}"#s${i}`).join(" \\to ")),
        note: tx(`Variation first: ${en(s[0])} Then selection: ${en(s[1])} ${en(s[2])} ${en(s[3])} ${en(s[4])}`, `Zuerst die Variation: ${de(s[0])} Dann die Auslese: ${de(s[1])} ${de(s[2])} ${de(s[3])} ${de(s[4])}`),
      },
    ],
    mistakes: [
      {
        when: { kind: "order", items: [s[3], s[2]] },
        title: tx("Survive first", "Erst überleben"),
        say: tx("Only those that survive can have offspring. So survival and reproduction come before the offspring inherit anything.", "Nur wer überlebt, kann Nachkommen haben. Überleben und Fortpflanzung kommen also, bevor die Nachkommen etwas erben."),
      },
      {
        when: { kind: "order", items: [s[4], s[1]] },
        title: tx("The change comes last", "Der Wandel kommt zuletzt"),
        say: tx("The change in the population is the result at the very end, after many generations. It isn't there at the start.", "Die Veränderung der Population ist das Ergebnis ganz am Schluss, nach vielen Generationen. Am Anfang ist sie noch nicht da."),
      },
    ],
  };
}

type Why = { id: string; text: Text; right: Text; individual: Text; goal: Text; strong: Text; lamarck: Text; sayIndividual: Text; sayStrong: Text; sayLamarck: Text };

const WHYS: Why[] = [
  {
    id: "soot",
    text: tx(
      "Around 1900, almost all peppered moths near Manchester were dark. Fifty years earlier, almost all of them were light. In between, soot from the factories had blackened the tree trunks. How did this happen?",
      "Um 1900 waren fast alle Birkenspanner bei Manchester dunkel. 50 Jahre vorher waren fast alle hell. Dazwischen hatte Ruß aus den Fabriken die Baumstämme geschwärzt. Wie kam es dazu?",
    ),
    right: tx("Dark moths were spotted less often on the sooty bark. More of them survived and passed on their colour.", "Dunkle Falter wurden auf der rußigen Rinde seltener entdeckt. Mehr von ihnen überlebten und vererbten ihre Farbe."),
    individual: tx("The light moths changed their colour to dark so that birds couldn't see them.", "Die hellen Falter haben ihre Farbe zu Dunkel gewechselt, damit die Vögel sie nicht sehen."),
    goal: tx("The moths wanted to be dark, so they had dark young.", "Die Falter wollten dunkel sein, deshalb bekamen sie dunkle Junge."),
    strong: tx("The dark moths were stronger and drove the light ones away.", "Die dunklen Falter waren stärker und haben die hellen vertrieben."),
    lamarck: tx("Soot stuck to the moths' wings, and they passed the dark colour on to their young.", "Ruß blieb an den Flügeln hängen, und die Falter vererbten die dunkle Farbe an ihre Jungen."),
    sayIndividual: tx("A single moth keeps its colour all its life. What changed is the population: how many light and how many dark moths there are.", "Ein einzelner Falter behält sein Leben lang seine Farbe. Verändert hat sich die Population: wie viele helle und wie viele dunkle Falter es gibt."),
    sayStrong: tx("It wasn't about strength or fighting. What counted was being well hidden from birds. Darwin's 'fittest' means the best adapted.", "Es ging nicht um Kraft oder Kämpfe. Entscheidend war, für Vögel gut getarnt zu sein. Darwins „Fitteste“ sind die am besten Angepassten."),
    sayLamarck: tx("Soot on the wings doesn't change the genetic information. Only the inherited colour is passed on to the young.", "Ruß auf den Flügeln verändert die Erbinformation nicht. Weitergegeben wird nur die vererbte Farbe."),
  },
  {
    id: "clean",
    text: tx(
      "From about 1960 the air in England got cleaner. Lichens grew back and the bark became light again. Today almost all peppered moths there are light again. Why?",
      "Ab etwa 1960 wurde die Luft in England sauberer. Flechten wuchsen nach, die Rinde wurde wieder hell. Heute sind dort fast alle Birkenspanner wieder hell. Warum?",
    ),
    right: tx("Now the dark moths stand out and are eaten more often. Light moths survive more often and pass on their colour.", "Jetzt fallen die dunklen Falter auf und werden öfter gefressen. Helle Falter überleben häufiger und vererben ihre Farbe."),
    individual: tx("The dark moths turned light again because the air was clean.", "Die dunklen Falter sind wieder hell geworden, weil die Luft sauber war."),
    goal: tx("The moths knew that being light was better again and had light young.", "Die Falter wussten, dass hell wieder besser ist, und bekamen helle Junge."),
    strong: tx("Light moths are simply stronger than dark ones.", "Helle Falter sind einfach stärker als dunkle."),
    lamarck: tx("Without soot on their wings, the moths passed on a light colour to their young.", "Ohne Ruß auf den Flügeln gaben die Falter eine helle Farbe an ihre Jungen weiter."),
    sayIndividual: tx("No moth changes its colour during its life. The share of light moths grew because they survived more often.", "Kein Falter ändert im Leben seine Farbe. Der Anteil der hellen wuchs, weil sie häufiger überlebten."),
    sayStrong: tx("Strength doesn't decide here. On light bark the light moths are better hidden: they are better adapted.", "Kraft entscheidet hier nicht. Auf heller Rinde sind die hellen Falter besser getarnt: Sie sind besser angepasst."),
    sayLamarck: tx("Dirt or no dirt on the wings doesn't change the genetic information. Only inherited traits are passed on.", "Ob Schmutz auf den Flügeln ist oder nicht, ändert die Erbinformation nicht. Weitergegeben werden nur erbliche Merkmale."),
  },
  {
    id: "beetle",
    text: tx(
      "On a green meadow, almost all leaf beetles are green after many years, although there used to be many brown ones too. Birds hunt the beetles. Why are they green now?",
      "Auf einer grünen Wiese sind nach vielen Jahren fast alle Blattkäfer grün, obwohl es früher auch viele braune gab. Vögel jagen die Käfer. Warum sind sie jetzt grün?",
    ),
    right: tx("Birds spotted the brown beetles more easily. Green beetles survived more often and passed on their colour.", "Vögel entdeckten die braunen Käfer leichter. Grüne Käfer überlebten häufiger und vererbten ihre Farbe."),
    individual: tx("The brown beetles turned green to hide in the grass.", "Die braunen Käfer sind grün geworden, um sich im Gras zu verstecken."),
    goal: tx("The beetles wanted to be green and therefore had green young.", "Die Käfer wollten grün sein und bekamen deshalb grüne Junge."),
    strong: tx("The green beetles were stronger and won the fights.", "Die grünen Käfer waren stärker und gewannen die Kämpfe."),
    lamarck: tx("Eating green leaves coloured the beetles green, and they passed this on.", "Vom Fressen grüner Blätter wurden die Käfer grün und vererbten das."),
    sayIndividual: tx("A beetle can't change its colour to hide. The green ones were already there; they just survived more often.", "Ein Käfer kann seine Farbe nicht zum Verstecken ändern. Die grünen gab es schon; sie überlebten nur häufiger."),
    sayStrong: tx("It's not about fights: camouflage decided who survived. 'Survival of the fittest' means the best adapted.", "Es geht nicht um Kämpfe: Die Tarnung entschied, wer überlebte. Gemeint ist das Überleben der am besten Angepassten."),
    sayLamarck: tx("What a beetle eats doesn't change the genetic information in its eggs. Acquired traits are not inherited.", "Was ein Käfer frisst, verändert nicht die Erbinformation in seinen Eiern. Erworbene Eigenschaften werden nicht vererbt."),
  },
  {
    id: "bacteria",
    text: tx(
      "A patient takes an antibiotic. After some time it stops working because most of the bacteria are now resistant. How did this happen?",
      "Ein Patient nimmt ein Antibiotikum. Nach einiger Zeit wirkt es nicht mehr, weil die meisten Bakterien jetzt resistent sind. Wie kam es dazu?",
    ),
    right: tx("A few bacteria were resistant by chance. They survived the antibiotic and multiplied.", "Einige wenige Bakterien waren zufällig resistent. Sie überlebten das Antibiotikum und vermehrten sich."),
    individual: tx("The bacteria got used to the antibiotic and became resistant.", "Die Bakterien haben sich an das Antibiotikum gewöhnt und wurden resistent."),
    goal: tx("The bacteria wanted to survive and therefore developed a resistance.", "Die Bakterien wollten überleben und haben deshalb eine Resistenz entwickelt."),
    strong: tx("The strongest bacteria ate the weak ones.", "Die stärksten Bakterien haben die schwachen gefressen."),
    lamarck: tx("Bacteria that met the antibiotic learned to resist it and passed this on.", "Bakterien, die das Antibiotikum abbekamen, lernten, ihm zu widerstehen, und gaben das weiter."),
    sayIndividual: tx("A bacterium can't get used to an antibiotic. The resistant ones were there by chance before; the antibiotic only sorted out the others.", "Ein Bakterium kann sich nicht an ein Antibiotikum gewöhnen. Die resistenten gab es zufällig schon vorher; das Antibiotikum hat nur die anderen aussortiert."),
    sayStrong: tx("It's not about strength. What decided was a resistance that some bacteria happened to carry.", "Es geht nicht um Stärke. Entscheidend war eine Resistenz, die einige Bakterien zufällig trugen."),
    sayLamarck: tx("Bacteria can't learn a resistance and pass it on. Only a change in their genetic information is inherited.", "Bakterien können eine Resistenz nicht lernen und weitergeben. Vererbt wird nur eine Veränderung der Erbinformation."),
  },
];

const SAY_GOAL = tx(
  "Living things can't choose their traits, and evolution doesn't plan ahead. The variants were there by chance; selection only decided which ones were left.",
  "Lebewesen können sich ihre Merkmale nicht aussuchen, und die Evolution verfolgt keinen Plan. Die Varianten waren zufällig da; die Selektion hat nur entschieden, welche übrig blieben.",
);

function selectionWhyTask(rng: Rng, w = rng.pick(WHYS), keep?: ("individual" | "goal" | "strong" | "lamarck")[]): Exercise {
  const wrong = {
    individual: { text: w.individual, title: tx("Individuals don't change", "Einzelne ändern sich nicht"), say: w.sayIndividual },
    goal: { text: w.goal, title: tx("Evolution has no goal", "Evolution hat kein Ziel"), say: SAY_GOAL },
    strong: { text: w.strong, title: tx("Best adapted, not strongest", "Am besten angepasst, nicht am stärksten"), say: w.sayStrong },
    lamarck: { text: w.lamarck, title: tx("Acquired traits aren't inherited", "Erworbenes wird nicht vererbt"), say: w.sayLamarck },
  };
  const chosen = keep ?? rng.shuffle(["individual", "goal", "strong", "lamarck"] as const).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: w.right }, ...chosen.map((k) => wrong[k])]);
  return {
    instruction: tx("Explain the change", "Erkläre die Veränderung"),
    text: w.text,
    answer,
    hint: tx("Were there differences before? Who survived more often, and what did their young inherit?", "Gab es vorher schon Unterschiede? Wer hat häufiger überlebt, und was haben die Jungen geerbt?"),
    solution: [
      { math: tx('"variation"#a \\to "selection"#b \\to "inheritance"#c', '"Variation"#a \\to "Auslese"#b \\to "Vererbung"#c'), note: w.right },
      { math: tx('"population changes"#p', '"Population ändert sich"#p'), note: tx("No single individual changed: the population changed over many generations.", "Kein einzelnes Lebewesen hat sich verändert: Die Population hat sich über viele Generationen verändert.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Family trees

const TREE_IDS: TreeId[] = ["apes", "vertebrates", "hoofed"];

function treeRelativeTask(rng: Rng, fixed?: { tree: TreeId; x: LeafId; others: LeafId[] }): Exercise | null {
  const tree = fixed?.tree ?? rng.pick(TREE_IDS);
  const root = TREES[tree].root;
  const all = leavesOf(root);
  const x = fixed?.x ?? rng.pick(all);
  const others = fixed?.others ?? rng.shuffle(all.filter((l) => l !== x)).slice(0, 3);
  const depth = (l: LeafId) => depthOf(root, lca(root, [x, l]).id);
  const best = Math.max(...others.map(depth));
  const winners = others.filter((l) => depth(l) === best);
  if (winners.length !== 1) return null;
  const right = winners[0];
  const at = all.indexOf(x);
  const neighbours = [all[at - 1], all[at + 1]].filter(Boolean);
  const opts: Opt[] = [{ text: LEAVES[right] }];
  for (const o of others) {
    if (o === right) continue;
    opts.push(
      neighbours.includes(o)
        ? {
            text: LEAVES[o],
            title: tx("Close in the picture only", "Nur im Bild nah"),
            say: tx(
              `In the drawing the ${en(LEAVES[o])} sits right next to the ${en(LEAVES[x])}. But what counts is where the lines meet: follow them back to the branching point.`,
              `In der Zeichnung steht ${de(LEAVES[o])} direkt neben ${de(LEAVES[x])}. Entscheidend ist aber, wo sich die Linien treffen: Folge ihnen zurück bis zum Verzweigungspunkt.`,
            ),
          }
        : {
            text: LEAVES[o],
            title: tx("An older ancestor", "Ein älterer Vorfahre"),
            say: tx(
              `The lines of the ${en(LEAVES[o])} and the ${en(LEAVES[x])} only meet further back. Another line meets the ${en(LEAVES[x])} earlier.`,
              `Die Linien von ${de(LEAVES[o])} und ${de(LEAVES[x])} treffen sich erst weiter hinten. Eine andere Linie trifft ${de(LEAVES[x])} früher.`,
            ),
          },
    );
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Read the family tree", "Lies den Stammbaum"),
    text: tx(`Which of these is the closest relative of the **${en(LEAVES[x])}**?`, `Wer davon ist am nächsten mit **${de(LEAVES[x])}** verwandt?`),
    visual: visual(EvolutionTreeFigure, { tree, leaves: [x] }),
    answer,
    hint: tx(`Follow the line of the ${en(LEAVES[x])} back to the left. Which line joins it first?`, `Folge der Linie von ${de(LEAVES[x])} nach links zurück. Welche Linie stößt zuerst dazu?`),
    solution: [
      {
        math: join(q(LEAVES[x], "x"), "+", q(LEAVES[right], "r"), "\\to", q(tx("most recent common ancestor", "jüngster gemeinsamer Vorfahre"), "a")),
        note: tx(
          `The lines of the ${en(LEAVES[x])} and the ${en(LEAVES[right])} meet first. The more recent the common ancestor, the closer the relationship.`,
          `Die Linien von ${de(LEAVES[x])} und ${de(LEAVES[right])} treffen sich zuerst. Je jünger der gemeinsame Vorfahre, desto näher die Verwandtschaft.`,
        ),
      },
    ],
    mistakes: list,
  };
}

function treeNodeTask(rng: Rng): Exercise | null {
  const tree = rng.pick(TREE_IDS);
  const root = TREES[tree].root;
  const all = leavesOf(root);
  const [a, b] = rng.shuffle(all).slice(0, 2);
  const anc = lca(root, [a, b]);
  const nodes = nodesOf(root);
  const numbered = rng.shuffle(nodes.map((n) => n.id));
  const numberOf = (id: string) => numbered.indexOf(id) + 1;
  const right = numberOf(anc.id);
  const answer: AnswerSpec = { kind: "number", value: right };
  const m = mistakes(answer);
  for (const n of nodes) {
    if (n.id === anc.id) continue;
    const under = leavesOf(n);
    if (under.includes(a) && under.includes(b))
      m.add({ kind: "number", value: numberOf(n.id) }, tx("An older ancestor", "Ein älterer Vorfahre"), tx("Both descend from this point too, but it lies further back. Look for the point where their lines meet first.", "Von diesem Punkt stammen zwar beide ab, aber er liegt weiter zurück. Such den Punkt, an dem sich ihre Linien zuerst treffen."));
    else if (under.includes(a) || under.includes(b))
      m.add(
        { kind: "number", value: numberOf(n.id) },
        tx("Only one of the two", "Nur einer von beiden"),
        tx(`Only the ${en(LEAVES[under.includes(a) ? a : b])} descends from this point, not both.`, `Von diesem Punkt stammt nur ${de(LEAVES[under.includes(a) ? a : b])} ab, nicht beide.`),
      );
  }
  return {
    instruction: tx("Find the common ancestor", "Finde den gemeinsamen Vorfahren"),
    text: tx(
      `Which number marks the **last common ancestor** of the ${en(LEAVES[a])} and the ${en(LEAVES[b])}?`,
      `Welche Nummer markiert den **letzten gemeinsamen Vorfahren** von ${de(LEAVES[a])} und ${de(LEAVES[b])}?`,
    ),
    visual: visual(EvolutionTreeFigure, { tree, numbered, leaves: [a, b] }),
    answer: { ...answer, label: tx("number", "Nummer") },
    hint: tx("Follow both lines back to the left until they meet.", "Folge beiden Linien nach links zurück, bis sie sich treffen."),
    solution: [
      {
        math: tx(`"${en(LEAVES[a])}"#a + "${en(LEAVES[b])}"#b \\to ${right}#n`, `"${de(LEAVES[a])}"#a + "${de(LEAVES[b])}"#b \\to ${right}#n`),
        note: tx(`The two lines meet first at point ${right}: that is their last common ancestor.`, `Die beiden Linien treffen sich zuerst an Punkt ${right}: Das ist ihr letzter gemeinsamer Vorfahre.`),
        highlight: ["n"],
      },
    ],
    mistakes: m.list.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Terms

const TERMS: { def: Text; accept: Text[]; traps?: [Text, Text, Text][] }[] = [
  {
    def: tx("Remains or traces of living things from long ago, preserved in rock, amber or ice.", "Reste oder Spuren von Lebewesen aus früheren Zeiten, erhalten in Gestein, Bernstein oder Eis."),
    accept: [tx("fossil", "Fossil"), "Fossilien", "fossils"],
    traps: [[tx("petrification", "Versteinerung"), tx("Only one kind", "Nur eine Art davon"), tx("A petrification is only one kind. Imprints and amber inclusions count too: what's the word for all of them?", "Eine Versteinerung ist nur eine Art davon. Abdrücke und Bernsteineinschlüsse zählen auch: Wie heißt der Oberbegriff?")]],
  },
  {
    def: tx("Individuals of the same species differ from each other, for example in colour or size.", "Individuen derselben Art unterscheiden sich voneinander, z. B. in Farbe oder Größe."),
    accept: [tx("variation", "Variation"), "Variabilität", "variability"],
    traps: [[tx("mutation", "Mutation"), tx("Cause, not the name", "Ursache, nicht der Name"), tx("Mutations can cause such differences. But the differences themselves have another name.", "Mutationen können solche Unterschiede verursachen. Die Unterschiede selbst heißen aber anders.")]],
  },
  {
    def: tx("A feature that helps a living thing to survive in its habitat, like the thick fur of a polar bear.", "Ein Merkmal, das einem Lebewesen hilft, in seinem Lebensraum zu überleben, wie das dicke Fell des Eisbären."),
    accept: [tx("adaptation", "Angepasstheit"), "Anpassung", "adaptedness"],
    traps: [[tx("evolution", "Evolution"), tx("Too big", "Zu groß"), tx("Evolution is the change over many generations. Here a single helpful feature is meant.", "Evolution ist die Veränderung über viele Generationen. Gemeint ist hier ein einzelnes hilfreiches Merkmal.")]],
  },
  {
    def: tx("The change of living things over very many generations, in which new species arise.", "Die Veränderung von Lebewesen über sehr viele Generationen, bei der neue Arten entstehen."),
    accept: [tx("evolution", "Evolution"), "Stammesgeschichte"],
    traps: [[tx("adaptation", "Anpassung"), tx("Part of it", "Ein Teil davon"), tx("Adaptation is part of it. The whole long-term change of life has another name.", "Anpassung ist ein Teil davon. Die gesamte langfristige Veränderung des Lebens heißt anders.")]],
  },
  {
    def: tx("A living thing with features of two different groups of animals, like Archaeopteryx.", "Ein Lebewesen mit Merkmalen zweier verschiedener Tiergruppen, wie der Archaeopteryx."),
    accept: [tx("transitional form", "Übergangsform"), "Brückentier", "Zwischenform", "Mosaikform", "missing link", "transitional fossil"],
    traps: [[tx("hybrid", "Mischling"), tx("Not a cross", "Keine Kreuzung"), tx("Archaeopteryx isn't a cross between a bird and a reptile. It's an animal from the time when birds evolved from reptiles.", "Archaeopteryx ist keine Kreuzung aus Vogel und Reptil. Er ist ein Tier aus der Zeit, als Vögel aus Reptilien entstanden.")]],
  },
  {
    def: tx("Better adapted individuals survive more often and have more offspring than others.", "Besser angepasste Individuen überleben häufiger und haben mehr Nachkommen als andere."),
    accept: [tx("natural selection", "natürliche Selektion"), "Selektion", "natürliche Auslese", "Auslese", "selection"],
    traps: [[tx("evolution", "Evolution"), tx("The result, not the process", "Das Ergebnis, nicht der Vorgang"), tx("Evolution is the overall change. The process that sorts out the less well adapted has its own name.", "Evolution ist die gesamte Veränderung. Der Vorgang, der die weniger gut Angepassten aussortiert, hat einen eigenen Namen.")]],
  },
  {
    def: tx("In a family tree: the point where the lines of two living things meet.", "Im Stammbaum: der Punkt, an dem sich die Linien zweier Lebewesen treffen."),
    accept: [tx("common ancestor", "gemeinsamer Vorfahre"), "Vorfahre", "letzter gemeinsamer Vorfahre", "gemeinsamer Vorfahr", "Vorfahr", "ancestor", "last common ancestor"],
  },
  {
    def: tx("All individuals of one species that live in the same area at the same time and can mate with each other.", "Alle Individuen einer Art, die zur selben Zeit im selben Gebiet leben und sich miteinander fortpflanzen können."),
    accept: [tx("population", "Population")],
    traps: [[tx("species", "Art"), tx("Smaller than that", "Kleiner als das"), tx("A species can live in many places. Here only those in one area at the same time are meant.", "Eine Art kann an vielen Orten leben. Gemeint sind hier nur die in einem Gebiet zur selben Zeit.")]],
  },
];

function termTask(rng: Rng): Exercise {
  const term = rng.pick(TERMS);
  const answer: AnswerSpec = { kind: "word", accept: term.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const [word, title, say] of term.traps ?? []) m.add({ kind: "word", accept: [word] }, title, say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: tx(`What is the term? ${en(term.def)}`, `Wie heißt der Fachbegriff? ${de(term.def)}`),
    answer,
    hint: tx("You met this word in the lesson.", "Dieses Wort kam in der Lektion vor."),
    solution: [{ math: q(term.accept[0], "t"), note: term.def }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  for (let tries = 0; tries < 40; tries++) {
    let ex: Exercise | null;
    switch (rng.int(0, 10)) {
      case 0:
        ex = fossilKindTask(rng);
        break;
      case 1:
        ex = rockAgeTask(rng);
        break;
      case 2:
        ex = rockOrderTask(rng);
        break;
      case 3:
        ex = archMultiTask(rng);
        break;
      case 4:
        ex = archAskTask(rng);
        break;
      case 5:
        ex = adaptTask(rng);
        break;
      case 6:
        ex = selectionOrderTask(rng);
        break;
      case 7:
      case 8:
        ex = selectionWhyTask(rng);
        break;
      case 9:
        ex = rng.chance(0.5) ? treeRelativeTask(rng) : treeNodeTask(rng);
        break;
      default:
        ex = termTask(rng);
    }
    if (ex) return ex;
  }
  return selectionWhyTask(rng);
}

// ---------------------------------------------------------------------------
// Lesson

const checkRock = rockAgeTask(createRng(11), { fossils: ["horse", "archaeopteryx", "fern", "trilobite"], oldest: true });
const checkArch = archMultiTask(createRng(5), { reptile: true, picks: ["feathers", "teeth", "wing", "tail", "claws", "wishbone"] });
const checkMoth = selectionWhyTask(createRng(7), WHYS[0], ["individual", "goal", "strong"]);
const checkTree = treeRelativeTask(createRng(3), { tree: "vertebrates", x: "bird", others: ["lizard", "croc", "mouse"] })!;

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Fossils: windows into the past", "Fossilien: Fenster in die Vergangenheit"),
      blob: tx("Let's travel back in time. Millions of years!", "Lass uns in der Zeit zurückreisen. Millionen von Jahren!"),
      body: tx(
        "The Earth is about 4.6 billion years old. The first living things were tiny single cells, more than 3.5 billion years ago. Since then, living things have changed over very long periods of time, and new species have arisen. This is called **evolution**.\n\nWe know this from **fossils**: remains and traces of living things from long ago.",
        "Die Erde ist etwa 4,6 Milliarden Jahre alt. Die ersten Lebewesen waren winzige Einzeller, vor mehr als 3,5 Milliarden Jahren. Seitdem haben sich Lebewesen über sehr lange Zeiträume verändert, und neue Arten sind entstanden. Das nennt man **Evolution**.\n\nWir wissen das aus **Fossilien**: Resten und Spuren von Lebewesen aus früheren Zeiten.",
      ),
      frames: [
        { math: tx('"petrification"#a', '"Versteinerung"#a'), note: tx("**Petrification**: minerals slowly replace bones, shells or wood. They turn into stone.", "**Versteinerung**: Mineralien ersetzen nach und nach Knochen, Schalen oder Holz. Sie werden zu Stein.") },
        { math: tx('"petrification"#a \\quad "imprint"#b', '"Versteinerung"#a \\quad "Abdruck"#b'), note: tx("**Imprint**: a leaf or an animal leaves its shape in soft mud, which later hardens to rock.", "**Abdruck**: Ein Blatt oder ein Tier hinterlässt seine Form in weichem Schlamm, der später zu Gestein wird.") },
        { math: tx('"petrification"#a \\quad "imprint"#b \\\\ "amber"#c', '"Versteinerung"#a \\quad "Abdruck"#b \\\\ "Bernstein"#c'), note: tx("**Inclusion in amber**: an insect gets stuck in sticky tree resin. The resin hardens to amber and keeps the whole animal.", "**Einschluss in Bernstein**: Ein Insekt bleibt in klebrigem Baumharz hängen. Das Harz wird zu Bernstein und bewahrt das ganze Tier.") },
        { math: tx('"petrification"#a \\quad "imprint"#b \\\\ "amber"#c \\quad "ice"#d', '"Versteinerung"#a \\quad "Abdruck"#b \\\\ "Bernstein"#c \\quad "Eis"#d'), note: tx("**Frozen in permafrost**: mammoths from the Ice Age, with skin and hair, found in the frozen ground of Siberia.", "**Im Dauerfrostboden eingefroren**: Mammuts aus der Eiszeit, mit Haut und Haaren, gefunden im gefrorenen Boden Sibiriens.") },
      ],
    },
    {
      type: "widget",
      title: tx("Dig through the rock layers", "Grab dich durch die Gesteinsschichten"),
      blob: tx("Grab the trowel! What's hiding down there?", "Schnapp dir die Kelle! Was steckt da unten?"),
      body: tx(
        "Rock forms in layers: sand and mud settle on top of each other for millions of years and harden. Dig down layer by layer and look at the fossils and their ages.",
        "Gestein entsteht in Schichten: Sand und Schlamm lagern sich Millionen Jahre lang übereinander ab und werden fest. Grab dich Schicht für Schicht nach unten und schau dir die Fossilien und ihr Alter an.",
      ),
      widget: EvolutionDig,
    },
    { type: "check", blob: tx("Now you're the fossil detective!", "Jetzt bist du Fossiliendetektiv!"), exercise: checkRock },
    {
      type: "widget",
      title: tx("Archaeopteryx, the primeval bird", "Der Urvogel Archaeopteryx"),
      blob: tx("Feathers AND teeth? Let's take a closer look!", "Federn UND Zähne? Schauen wir genauer hin!"),
      body: tx(
        "Archaeopteryx lived about 150 million years ago; its fossils were found in Bavaria. It has **bird features** and **reptile features**. Such a living thing is called a **transitional form**. It shows that birds descend from reptile ancestors. Tap the features or light up a group.",
        "Archaeopteryx lebte vor etwa 150 Millionen Jahren; seine Fossilien wurden in Bayern gefunden. Er hat **Vogelmerkmale** und **Reptilienmerkmale**. So ein Lebewesen nennt man **Übergangsform** (Brückentier). Es zeigt, dass Vögel von Reptilien abstammen. Tipp die Merkmale an oder lass eine Gruppe aufleuchten.",
      ),
      widget: EvolutionArchaeopteryx,
    },
    { type: "check", blob: tx("Sort the features: bird or reptile?", "Sortier die Merkmale: Vogel oder Reptil?"), exercise: checkArch },
    {
      type: "explain",
      title: tx("Variation and adaptation", "Variation und Angepasstheit"),
      blob: tx("No two peppered moths are exactly alike, just like you and your friends!", "Kein Birkenspanner gleicht dem anderen genau, genau wie du und deine Freunde!"),
      body: tx(
        "Individuals of a species are never exactly alike: they differ in colour, size and many other features. This is called **variation**, and many of these differences are inherited. Living things are **adapted** to their habitat: their features help them to survive there.",
        "Individuen einer Art sind nie ganz gleich: Sie unterscheiden sich in Farbe, Größe und vielen anderen Merkmalen. Das nennt man **Variation**, und viele dieser Unterschiede sind erblich. Lebewesen sind an ihren Lebensraum **angepasst**: Ihre Merkmale helfen ihnen, dort zu überleben.",
      ),
      frames: [
        { math: tx('"light"#a \\quad "dark"#b', '"hell"#a \\quad "dunkel"#b'), note: tx("The peppered moth is a moth species. Most are light with dark speckles, a few are almost black: variation within one species.", "Der Birkenspanner ist eine Schmetterlingsart. Die meisten sind hell mit dunklen Sprenkeln, einige fast schwarz: Variation innerhalb einer Art.") },
        { math: tx('"polar bear"#e \\to "thick fur, fat"#f', '"Eisbär"#e \\to "dickes Fell, Fett"#f'), note: tx("**Adaptation**: the polar bear's thick fur and its layer of fat keep it warm in the Arctic.", "**Angepasstheit**: Das dicke Fell und die Fettschicht halten den Eisbären in der Arktis warm.") },
        { math: tx('"cactus"#e \\to "stores water"#f', '"Kaktus"#e \\to "speichert Wasser"#f'), note: tx("A cactus stores water in its thick stem and has spines instead of leaves: adapted to the desert.", "Ein Kaktus speichert Wasser in seinem dicken Spross und hat Dornen statt Blätter: angepasst an die Wüste.") },
        { math: tx('"duck"#e \\to "webbed feet"#f', '"Ente"#e \\to "Schwimmhäute"#f'), note: tx("A duck paddles with webbed feet: adapted to life on the water.", "Eine Ente paddelt mit Schwimmhäuten: angepasst an das Leben auf dem Wasser.") },
      ],
    },
    {
      type: "widget",
      title: tx("The peppered moth: selection live", "Der Birkenspanner: Selektion live"),
      blob: tx("Your turn to do research: let the birds hunt and watch what happens!", "Jetzt forschst du selbst: Lass die Vögel jagen und schau, was passiert!"),
      body: tx(
        "In England around 1850, almost all peppered moths were light: on birch bark with lichens they are hard to see. Then factories covered the trunks with soot. Switch the bark and let the birds hunt for a few generations.",
        "In England waren um 1850 fast alle Birkenspanner hell: Auf Birkenrinde mit Flechten sind sie kaum zu sehen. Dann bedeckten Fabriken die Stämme mit Ruß. Schalte die Rinde um und lass die Vögel ein paar Generationen lang jagen.",
      ),
      widget: EvolutionMoths,
    },
    {
      type: "explain",
      title: tx("Natural selection step by step", "Natürliche Selektion Schritt für Schritt"),
      blob: tx("Here's the recipe behind what you just saw.", "Hier ist das Rezept hinter dem, was du gerade gesehen hast."),
      body: tx("Charles Darwin called this process **natural selection**.", "Charles Darwin nannte diesen Vorgang **natürliche Selektion** (natürliche Auslese)."),
      frames: [
        { math: tx('"variation"#a', '"Variation"#a'), note: tx("There are light and dark moths. Their colour is inherited.", "Es gibt helle und dunkle Falter. Die Farbe ist erblich.") },
        { math: tx('"variation"#a \\to "selection"#b', '"Variation"#a \\to "Auslese"#b'), note: tx("On sooty bark, birds spot the light moths more easily and eat more of them.", "Auf rußiger Rinde entdecken Vögel die hellen Falter leichter und fressen mehr von ihnen.") },
        { math: tx('"variation"#a \\to "selection"#b \\\\ \\to "inheritance"#c', '"Variation"#a \\to "Auslese"#b \\\\ \\to "Vererbung"#c'), note: tx("More dark moths survive and have young. The young inherit the dark colour.", "Mehr dunkle Falter überleben und bekommen Junge. Die Jungen erben die dunkle Farbe.") },
        {
          math: tx('"variation"#a \\to "selection"#b \\\\ \\to "inheritance"#c \\to "change"#d', '"Variation"#a \\to "Auslese"#b \\\\ \\to "Vererbung"#c \\to "Wandel"#d'),
          note: tx("Generation after generation the share of dark moths grows: the **population** changes.", "Generation für Generation wächst der Anteil der dunklen Falter: Die **Population** verändert sich."),
          highlight: ["d"],
        },
        {
          math: tx('\\strike{"a moth changes"}#x \\quad "the population changes"#d', '\\strike{"ein Falter ändert sich"}#x \\quad "die Population ändert sich"#d'),
          note: tx(
            "Important: no single moth changed its colour! And evolution has no goal: the dark moths were simply lucky that their colour suited the new bark.",
            "Wichtig: Kein einzelner Falter hat seine Farbe geändert! Und die Evolution hat kein Ziel: Die dunklen Falter hatten einfach Glück, dass ihre Farbe zur neuen Rinde passte.",
          ),
        },
      ],
    },
    { type: "check", blob: tx("Careful, there are some sneaky traps in this one!", "Vorsicht, hier lauern ein paar fiese Fallen!"), exercise: checkMoth },
    {
      type: "widget",
      title: tx("Reading a family tree", "Stammbäume lesen"),
      blob: tx("Family trees are maps of relatedness. Tap two animals!", "Stammbäume sind Landkarten der Verwandtschaft. Tipp zwei Tiere an!"),
      body: tx(
        "A family tree shows how living things are related. Today's species sit at the tips. Where two lines meet lies their **last common ancestor**. The more recent this ancestor, the closer the relationship. By the way: humans don't descend from chimpanzees. Both descend from a common ancestor.",
        "Ein Stammbaum zeigt, wie Lebewesen miteinander verwandt sind. Die heutigen Arten stehen an den Spitzen. Wo sich zwei Linien treffen, liegt ihr **letzter gemeinsamer Vorfahre**. Je jünger dieser Vorfahre, desto näher die Verwandtschaft. Übrigens: Der Mensch stammt nicht vom Schimpansen ab. Beide stammen von einem gemeinsamen Vorfahren ab.",
      ),
      widget: EvolutionFamilyTree,
    },
    { type: "check", blob: tx("A surprise is waiting in this family tree!", "In diesem Stammbaum wartet eine Überraschung!"), exercise: checkTree },
  ],
  summary: [
    {
      title: tx("Fossils", "Fossilien"),
      body: tx(
        "Remains or traces of living things from long ago: petrification, imprint, inclusion in amber, frozen in permafrost. In undisturbed rock, deeper layers are older than the ones above them.",
        "Reste oder Spuren von Lebewesen aus früheren Zeiten: Versteinerung, Abdruck, Einschluss in Bernstein, im Dauerfrostboden eingefroren. In ungestörtem Gestein sind tiefere Schichten älter als die darüber.",
      ),
      examples: [tx('"deeper" \\Rightarrow "older"', '"tiefer" \\Rightarrow "älter"')],
      tone: "rule",
    },
    {
      title: tx("Archaeopteryx: a transitional form", "Archaeopteryx: eine Übergangsform"),
      body: tx(
        "Bird features: feathers, wings, wishbone. Reptile features: teeth, clawed fingers, long bony tail, belly ribs. It shows that birds descend from reptiles.",
        "Vogelmerkmale: Federn, Flügel, Gabelbein. Reptilienmerkmale: Zähne, Finger mit Krallen, lange Schwanzwirbelsäule, Bauchrippen. Er zeigt, dass Vögel von Reptilien abstammen.",
      ),
      examples: [tx('"bird" + "reptile" \\to "transitional form"', '"Vogel" + "Reptil" \\to "Übergangsform"')],
      tone: "rule",
    },
    {
      title: tx("Natural selection", "Natürliche Selektion"),
      body: tx(
        "Individuals of a species differ (variation). The best adapted survive more often and have more young, which inherit their features. Over many generations the population changes.",
        "Individuen einer Art unterscheiden sich (Variation). Die am besten Angepassten überleben häufiger und haben mehr Nachkommen, die ihre Merkmale erben. Über viele Generationen verändert sich die Population.",
      ),
      examples: [tx('"variation" \\to "selection" \\to "inheritance"', '"Variation" \\to "Auslese" \\to "Vererbung"')],
      tone: "rule",
    },
    {
      title: tx("Reading a family tree", "Stammbäume lesen"),
      body: tx(
        "Follow the lines back from the tips. Where two lines meet sits their last common ancestor. The more recent it is, the closer the relationship. Neighbours in the drawing aren't automatically closest relatives.",
        "Folge den Linien von den Spitzen zurück. Wo sich zwei Linien treffen, sitzt ihr letzter gemeinsamer Vorfahre. Je jünger er ist, desto näher die Verwandtschaft. Nachbarn in der Zeichnung sind nicht automatisch die nächsten Verwandten.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "A single animal never changes its features to fit in. Evolution has no goal. The best adapted survive, not the strongest. And humans don't descend from today's apes: we share ancestors with them.",
        "Ein einzelnes Tier ändert seine Merkmale nie, um besser zu passen. Die Evolution hat kein Ziel. Es überleben die am besten Angepassten, nicht die Stärksten. Und der Mensch stammt nicht von heutigen Affen ab: Wir haben gemeinsame Vorfahren mit ihnen.",
      ),
      tone: "warning",
    },
  ],
};
