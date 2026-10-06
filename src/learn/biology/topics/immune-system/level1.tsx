"use client";

// Level 1 (Einsteiger, Klasse 7–8): pathogens (bacteria, viruses, fungi, parasites), ways of
// infection and hygiene, the body's outer barriers, inflammation and fever, antibiotics and
// resistance, and the idea of vaccination.

import { tx, type Text } from "@/i18n/text";
import { ImmuneAntibiotics } from "@/learn/biology/visuals/ImmuneAntibiotics";
import { BARRIER_PARTS, ImmuneBarriers } from "@/learn/biology/visuals/ImmuneBarriers";
import { ImmuneCompare } from "@/learn/biology/visuals/ImmunePathogens";
import { ImmuneTiter } from "@/learn/biology/visuals/ImmuneTiter";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { BARRIERS, DISEASES, KINDS, ROUTES, SITUATIONS, type Disease, type Kind, type Route, type Situation } from "./data";
import { capT, choice, de, en, join, listFrame, matchSlip, mistakes, multiOf, orderSlip, q, solve, some, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Which kind of pathogen?

const KIND_ORDER: Kind[] = ["bacteria", "virus", "fungus", "parasite"];

function kindSay(d: Disease, picked: Kind): [Text, Text] {
  const n = d.name;
  if (d.kind === "virus" && picked === "bacteria")
    return [tx("Viruses, not bacteria", "Viren, nicht Bakterien"), tx(`Classic mix-up! ${en(capT(n))} is caused by viruses. That's exactly why antibiotics don't help against it.`, `Klassische Verwechslung! ${de(capT(n))} wird von Viren ausgelöst. Genau deshalb hilft hier kein Antibiotikum.`)];
  if (d.kind === "bacteria" && picked === "virus")
    return [tx("Bacteria, not viruses", "Bakterien, nicht Viren"), tx(`${en(capT(n))} is caused by bacteria: living single cells. That's why a doctor can treat it with antibiotics.`, `${de(capT(n))} wird von Bakterien ausgelöst, also von lebenden Einzellern. Deshalb kann man es mit Antibiotika behandeln.`)];
  if (d.kind === "fungus") return [tx("A fungus", "Ein Pilz"), tx(`${en(capT(n))}: here fungi grow on the skin or mucous membranes. The name often gives it away!`, `${de(capT(n))}: Hier wachsen Pilze auf Haut oder Schleimhaut. Oft verrät es schon der Name!`)];
  if (d.kind === "parasite")
    return en(n) === "malaria"
      ? [tx("A single-celled parasite", "Ein einzelliger Parasit"), tx("Malaria is caused by single-celled parasites (plasmodia) that a mosquito passes on.", "Malaria wird von einzelligen Parasiten (Plasmodien) ausgelöst, die eine Mücke überträgt.")]
      : [tx("A parasite", "Ein Parasit"), tx(`${en(capT(n))}: a small animal lives on or in us and feeds on us. That's a parasite.`, `${de(capT(n))}: Ein kleines Tier lebt auf oder in uns und ernährt sich von uns. Das ist ein Parasit.`)];
  return [tx("Another group", "Eine andere Gruppe"), tx(`Think about what causes ${en(n)}: ${en(KINDS[d.kind].one)}.`, `Überleg, wer ${de(n)} auslöst: ${de(KINDS[d.kind].one)}.`)];
}

function kindTask(rng: Rng, d: Disease = rng.pick(DISEASES)): Exercise {
  const opts: Opt[] = [{ text: KINDS[d.kind].name }];
  for (const k of KIND_ORDER) {
    if (k === d.kind) continue;
    const [title, say] = kindSay(d, k);
    opts.push({ text: KINDS[k].name, title, say });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the pathogen", "Nenne den Erreger"),
    text: tx(`Which pathogens cause **${en(d.name)}**?`, `Welche Erreger lösen **${de(d.name)}** aus?`),
    answer,
    hint: tx("Bacteria: living single cells. Viruses: not cells at all. Fungi grow on skin and mucous membranes. Parasites are small animals living on or in us.", "Bakterien: lebende Einzeller. Viren: gar keine Zellen. Pilze wachsen auf Haut und Schleimhäuten. Parasiten sind kleine Tiere, die auf oder in uns leben."),
    solution: solve(d.name, tx("A well-known infectious disease.", "Eine bekannte Infektionskrankheit."), KINDS[d.kind].name, tx(`${en(capT(d.name))} is caused by **${en(KINDS[d.kind].one)}**.`, `${de(capT(d.name))} wird von **${de(KINDS[d.kind].one)}** ausgelöst.`)),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Bacteria or viruses: select all that apply

type Fact = { text: Text; bact: boolean; virus: boolean };
const FACTS: Fact[] = [
  { text: tx("They are living cells", "Sie sind lebende Zellen"), bact: true, virus: false },
  { text: tx("They have their own metabolism", "Sie haben einen eigenen Stoffwechsel"), bact: true, virus: false },
  { text: tx("They multiply by dividing in two", "Sie vermehren sich durch Zweiteilung"), bact: true, virus: false },
  { text: tx("They can only multiply inside host cells", "Sie vermehren sich nur in Wirtszellen"), bact: false, virus: true },
  { text: tx("Antibiotics work against them", "Antibiotika wirken gegen sie"), bact: true, virus: false },
  { text: tx("They contain genetic material", "Sie enthalten Erbinformation"), bact: true, virus: true },
  { text: tx("They can be seen in a light microscope", "Man sieht sie im Lichtmikroskop"), bact: true, virus: false },
  { text: tx("They are much smaller than bacteria", "Sie sind viel kleiner als Bakterien"), bact: false, virus: true },
  { text: tx("They have a nucleus", "Sie haben einen Zellkern"), bact: false, virus: false },
];

function factsTask(rng: Rng, virus = rng.chance(0.5), fixed?: number[]): Exercise {
  const pool = fixed ? fixed.map((i) => FACTS[i]) : (() => {
    for (let k = 0; k < 20; k++) {
      const pick = some(rng, FACTS, 5);
      const right = pick.filter((f) => (virus ? f.virus : f.bact)).length;
      if (right >= 2 && right <= 3) return pick;
    }
    return FACTS.slice(0, 5);
  })();
  const { picked, options, correct, answer } = multiOf(rng, pool, (f) => (virus ? f.virus : f.bact));
  const m = mistakes(answer);
  const idx = (en0: string) => picked.findIndex((f) => en(f.text).startsWith(en0));
  const plus = (i: number) => [...correct, i].sort((a, b) => a - b);
  const minus = (i: number) => correct.filter((j) => j !== i);
  if (virus) {
    const ab = idx("Antibiotics");
    if (ab >= 0) m.add({ kind: "multi", options, correct: plus(ab) }, tx("Antibiotics and viruses", "Antibiotika und Viren"), tx("The big classic! Antibiotics don't work against viruses: there is no cell wall and no metabolism for them to attack.", "Der große Klassiker! Antibiotika wirken nicht gegen Viren: Es gibt keine Zellwand und keinen Stoffwechsel, den sie angreifen könnten."));
    const cell = idx("They are living cells");
    if (cell >= 0) m.add({ kind: "multi", options, correct: plus(cell) }, tx("Viruses aren't cells", "Viren sind keine Zellen"), tx("Viruses aren't cells: just genetic material in a protein coat. Without a host cell they can't do anything.", "Viren sind keine Zellen, nur Erbinformation in einer Proteinhülle. Ohne Wirtszelle können sie gar nichts."));
    const gen = idx("They contain");
    if (gen >= 0) m.add({ kind: "multi", options, correct: minus(gen) }, tx("Viruses have genes too", "Auch Viren haben Erbinformation"), tx("Viruses do carry genetic material: the blueprint for new viruses. That's all they need the host cell for.", "Viren tragen sehr wohl Erbinformation: den Bauplan für neue Viren. Genau dafür brauchen sie die Wirtszelle."), true);
  } else {
    const nuc = idx("They have a nucleus");
    if (nuc >= 0) m.add({ kind: "multi", options, correct: plus(nuc) }, tx("No nucleus", "Kein Zellkern"), tx("Careful: bacteria have no nucleus. Their DNA lies free in the cytoplasm.", "Vorsicht: Bakterien haben keinen Zellkern. Ihre DNA liegt frei im Cytoplasma."));
    const host = idx("They can only");
    if (host >= 0) m.add({ kind: "multi", options, correct: plus(host) }, tx("That's the virus", "Das ist das Virus"), tx("Only viruses need a host cell. Bacteria are living cells and multiply by dividing in two.", "Nur Viren brauchen eine Wirtszelle. Bakterien sind lebende Zellen und vermehren sich durch Zweiteilung."));
    const ab = idx("Antibiotics");
    if (ab >= 0) m.add({ kind: "multi", options, correct: minus(ab) }, tx("Antibiotics do work here", "Hier wirken Antibiotika"), tx("Antibiotics are made exactly for bacteria: they attack their cell wall or ribosomes.", "Antibiotika sind genau für Bakterien gemacht: Sie greifen ihre Zellwand oder Ribosomen an."), true);
  }
  const who = virus ? tx("viruses", "Viren") : tx("bacteria", "Bakterien");
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx(`Which statements are true for **${en(who)}**?`, `Welche Aussagen treffen auf **${de(who)}** zu?`),
    answer,
    hint: virus ? tx("A virus is not a cell: genetic material in a coat, nothing more.", "Ein Virus ist keine Zelle: Erbinformation in einer Hülle, mehr nicht.") : tx("A bacterium is a living single cell, but without a nucleus.", "Ein Bakterium ist ein lebender Einzeller, aber ohne Zellkern."),
    solution: [
      { math: virus ? tx('"virus:"#w \\; "no cell"#a', '"Virus:"#w \\; "keine Zelle"#a') : tx('"bacterium:"#w \\; "single cell, no nucleus"#a', '"Bakterium:"#w \\; "Einzeller ohne Zellkern"#a'), note: virus ? tx("Viruses are not cells and have no metabolism. They multiply only inside host cells.", "Viren sind keine Zellen und haben keinen Stoffwechsel. Sie vermehren sich nur in Wirtszellen.") : tx("Bacteria are living cells with their own metabolism, but without a nucleus.", "Bakterien sind lebende Zellen mit eigenem Stoffwechsel, aber ohne Zellkern.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: tx("These statements are true.", "Diese Aussagen stimmen.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Barriers

const FAKE_BARRIER: Text = tx("makes antibodies", "bildet Antikörper");

function barrierMatchTask(rng: Rng, ids?: string[]): Exercise {
  const pick = ids ? ids.map((id) => BARRIERS.find((b) => b.id === id)!) : some(rng, BARRIERS, 4);
  const pairs: [Text, Text][] = pick.map((b) => [b.name, b.how]);
  const withFake = ids ? true : rng.chance(0.6);
  const list: Mistake[] = [];
  const has = (id: string) => pick.find((b) => b.id === id);
  const mucosa = has("mucosa");
  const cilia = has("cilia");
  if (mucosa && cilia) list.push(matchSlip([[cilia.name, mucosa.how]], tx("Hold or carry?", "Festhalten oder befördern?"), tx("Close! The mucus traps the pathogens, and the cilia carry the mucus away up to the throat.", "Knapp! Der Schleim hält die Erreger fest, und die Flimmerhärchen befördern den Schleim zum Rachen.")));
  const tears = has("tears");
  const acid = has("acid");
  if (tears && acid) list.push(matchSlip([[acid.name, tears.how]], tx("Acid isn't lysozyme", "Säure ist kein Lysozym"), tx("Lysozyme is an enzyme in tears and saliva. The stomach uses hydrochloric acid instead.", "Lysozym ist ein Enzym in Tränen und Speichel. Der Magen setzt dagegen auf Salzsäure.")));
  if (withFake) {
    const first = pick[0];
    list.push(matchSlip([[first.name, FAKE_BARRIER]], tx("Not a barrier's job", "Keine Aufgabe einer Barriere"), tx("Barriers stop pathogens before they get in. Antibodies come later, from cells of the specific defence.", "Barrieren stoppen Erreger, bevor sie hineinkommen. Antikörper kommen erst später, von Zellen der spezifischen Abwehr.")));
  }
  return {
    instruction: tx("Match the barriers", "Ordne die Barrieren zu"),
    text: tx("How does each barrier protect you?", "Wie schützt dich jede Barriere?"),
    answer: { kind: "match", pairs, distractors: withFake ? [FAKE_BARRIER] : undefined },
    hint: tx("Think of where the barrier is: on the outside, in the airways, in the eye or in the stomach.", "Überleg, wo die Barriere sitzt: außen, in den Atemwegen, im Auge oder im Magen."),
    solution: pick.map((b, i) => ({ math: join(q(b.name, `b${i}`), "\\to", q(b.how, `h${i}`)), note: tx(`${en(b.name)}: ${en(b.how)}.`, `${de(b.name)}: ${de(b.how)}.`) })),
    mistakes: list,
  };
}

const PLACE: Record<string, Text> = {
  skin: tx("on the outside of the body", "außen auf dem Körper"),
  tears: tx("at the eye", "am Auge"),
  mucosa: tx("at the nose", "an der Nase"),
  saliva: tx("at the mouth", "am Mund"),
  cilia: tx("in the windpipe (see the magnifier)", "in der Luftröhre (siehe Lupe)"),
  acid: tx("in the stomach", "im Magen"),
};

function barrierFigureTask(rng: Rng, id = rng.pick(BARRIER_PARTS).id): Exercise {
  const part = BARRIER_PARTS.find((p) => p.id === id)!;
  const others = some(rng, BARRIER_PARTS.filter((p) => p.id !== id), 3);
  const opts: Opt[] = [{ text: capT(part.label) }, ...others.map((o) => ({ text: capT(o.label), title: tx("Look where the ? is", "Schau, wo das ? sitzt"), say: tx(`The ? sits ${en(PLACE[id])}. You find ${en(o.label)} ${en(PLACE[o.id])}.`, `Das ? sitzt ${de(PLACE[id])}. ${de(capT(o.label))} findest du ${de(PLACE[o.id])}.`) }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Name the barrier", "Benenne die Barriere"),
    text: tx("Which barrier against pathogens is marked with ?", "Welche Schutzbarriere gegen Erreger ist mit ? markiert?"),
    visual: visual(ImmuneBarriers, { mode: "numbers", ask: id, legend: "none" }),
    answer,
    hint: tx(`The ? sits ${en(PLACE[id])}.`, `Das ? sitzt ${de(PLACE[id])}.`),
    solution: solve(PLACE[id], tx(`The marked spot is ${en(PLACE[id])}.`, `Die markierte Stelle ist ${de(PLACE[id])}.`), capT(part.label), part.info!),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Ways of infection and protection

const ROUTE_ORDER: Route[] = ["droplet", "smear", "food", "animal"];
const ROUTE_HOW: Record<Route, Text> = {
  droplet: tx("tiny droplets from coughing, sneezing or talking fly through the air", "winzige Tröpfchen vom Husten, Niesen oder Sprechen fliegen durch die Luft"),
  smear: tx("pathogens get to you via hands, objects or surfaces", "Erreger gelangen über Hände, Gegenstände oder Oberflächen zu dir"),
  food: tx("pathogens are in food or drinking water", "Erreger stecken in Lebensmitteln oder im Trinkwasser"),
  animal: tx("an animal passes pathogens on by stinging or biting", "ein Tier überträgt Erreger durch einen Stich oder Biss"),
};

function routeTask(rng: Rng, s: Situation = rng.pick(SITUATIONS)): Exercise {
  const opts: Opt[] = [{ text: ROUTES[s.route] }];
  for (const r of ROUTE_ORDER) {
    if (r === s.route) continue;
    opts.push({ text: ROUTES[r], title: tx("Another way", "Ein anderer Weg"), say: tx(`That would mean: ${en(ROUTE_HOW[r])}. Here, ${en(ROUTE_HOW[s.route])}.`, `Das hieße: ${de(ROUTE_HOW[r])}. Hier gilt aber: ${de(ROUTE_HOW[s.route])}.`) });
  }
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("How do you get infected?", "Wie steckst du dich an?"),
    text: tx(`${en(s.text)} How could pathogens get to you here?`, `${de(s.text)} Wie könnten Erreger hier zu dir gelangen?`),
    answer,
    hint: tx("Through the air, via hands and objects, with food and water, or through an animal?", "Durch die Luft, über Hände und Gegenstände, mit Nahrung und Wasser oder durch ein Tier?"),
    solution: [{ math: q(ROUTES[s.route], "a"), note: tx(`Here ${en(ROUTE_HOW[s.route])}: that's a **${en(ROUTES[s.route]).toLowerCase()}**.`, `Hier gilt: ${de(ROUTE_HOW[s.route])}. Das ist **${de(ROUTES[s.route])}**.`), highlight: ["a"] }],
    mistakes: list,
  };
}

const ANTIBIOTIC_SHIELD: Text = tx("Take an antibiotic just in case", "Vorsorglich ein Antibiotikum nehmen");

function protectTask(rng: Rng, s: Situation = rng.pick(SITUATIONS)): Exercise {
  const others = some(rng, SITUATIONS.filter((o) => o.route !== s.route && en(o.protect) !== en(s.protect)), 6);
  const wrong: Situation[] = [];
  for (const o of others) if (wrong.length < 2 && !wrong.some((w) => w.route === o.route)) wrong.push(o);
  const opts: Opt[] = [
    { text: s.protect },
    ...wrong.map((w) => ({ text: w.protect, title: tx("Wrong way of infection", "Falscher Ansteckungsweg"), say: tx(`That protects against ${en(ROUTES[w.route]).toLowerCase()}. How do the pathogens get to you here?`, `Das schützt vor einem anderen Weg (${de(ROUTES[w.route])}). Wie kommen die Erreger hier zu dir?`) })),
    { text: ANTIBIOTIC_SHIELD, title: tx("No protection", "Kein Schutz"), say: tx("Antibiotics don't prevent an infection and don't work against viruses at all. Taken without need, they breed resistant bacteria.", "Antibiotika verhindern keine Ansteckung und wirken gegen Viren überhaupt nicht. Ohne Not genommen, fördern sie resistente Bakterien.") },
  ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Protect yourself", "Schütz dich"),
    text: tx(`${en(s.text)} What protects you best against an infection here?`, `${de(s.text)} Was schützt dich hier am besten vor einer Ansteckung?`),
    answer,
    hint: tx("First think about how the pathogens would get to you. Then block exactly that way.", "Überleg zuerst, wie die Erreger zu dir kämen. Dann blockier genau diesen Weg."),
    solution: solve(ROUTES[s.route], tx(`The way of infection: ${en(ROUTES[s.route]).toLowerCase()}.`, `Der Ansteckungsweg: ${de(ROUTES[s.route])}.`), s.protect, tx("This interrupts exactly this way of infection.", "Das unterbricht genau diesen Ansteckungsweg.")),
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Antibiotics and resistance

const AB_OPTS: Record<"bact" | "virus" | "fungus" | "all", Text> = {
  bact: tx("Yes, because it is caused by bacteria", "Ja, denn sie wird von Bakterien ausgelöst"),
  virus: tx("No, because it is caused by viruses", "Nein, denn sie wird von Viren ausgelöst"),
  fungus: tx("No, because it is caused by fungi", "Nein, denn sie wird von Pilzen ausgelöst"),
  all: tx("Yes, antibiotics work against all pathogens", "Ja, Antibiotika wirken gegen alle Erreger"),
};

function antibioticTask(rng: Rng, d: Disease = rng.pick(DISEASES.filter((x) => x.kind !== "parasite"))): Exercise {
  const right = d.kind === "bacteria" ? "bact" : d.kind === "virus" ? "virus" : "fungus";
  const N = capT(d.name);
  const culprit: [Text, Text] = [tx("Who is the culprit?", "Wer ist der Täter?"), tx(`Check again which pathogens cause ${en(d.name)}: ${en(KINDS[d.kind].one)}.`, `Prüf noch mal, welche Erreger ${de(d.name)} auslösen: ${de(KINDS[d.kind].one)}.`)];
  const sayFor = (picked: "bact" | "virus" | "fungus" | "all"): [Text, Text] => {
    if (picked === "all")
      return right === "bact"
        ? [tx("Right answer, wrong reason", "Richtig, aber falsch begründet"), tx("Here it does help, but only because bacteria are the culprits. Against viruses antibiotics are useless.", "Hier hilft es zwar, aber nur, weil Bakterien die Täter sind. Gegen Viren sind Antibiotika nutzlos.")]
        : [tx("Only against bacteria", "Nur gegen Bakterien"), tx("Antibiotics only work against bacteria, not against viruses or fungi.", "Antibiotika wirken nur gegen Bakterien, nicht gegen Viren oder Pilze.")];
    if (picked === "bact" && right === "virus")
      return [tx("Antibiotics against viruses?", "Antibiotika gegen Viren?"), tx(`${en(N)} is caused by viruses. Antibiotics can't do anything against them: viruses have no cell wall and no metabolism of their own.`, `${de(N)} wird von Viren ausgelöst. Antibiotika können dagegen nichts ausrichten: Viren haben keine Zellwand und keinen eigenen Stoffwechsel.`)];
    if (picked === "bact" && right === "fungus")
      return [tx("A fungus", "Ein Pilz"), tx(`${en(N)} is caused by fungi. Against fungi you use special antifungal medicines.`, `${de(N)} wird von Pilzen ausgelöst. Dagegen nimmt man besondere Mittel gegen Pilze (Antimykotika).`)];
    if (right === "bact") return [tx("Bacteria here", "Hier sind es Bakterien"), tx(`${en(N)} is caused by bacteria, so an antibiotic does help.`, `${de(N)} wird von Bakterien ausgelöst, ein Antibiotikum hilft also.`)];
    return culprit;
  };
  const keys = (["bact", "virus", "fungus", "all"] as const).filter((k) => k !== right);
  const opts: Opt[] = [{ text: AB_OPTS[right] }, ...keys.map((k) => ({ text: AB_OPTS[k], title: sayFor(k)[0], say: sayFor(k)[1] }))];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Antibiotic or not?", "Antibiotikum oder nicht?"),
    text: tx(`Does an antibiotic help against **${en(d.name)}**?`, `Hilft ein Antibiotikum gegen **${de(d.name)}**?`),
    answer,
    hint: tx("Antibiotics only work against bacteria. Which pathogens cause this disease?", "Antibiotika wirken nur gegen Bakterien. Welche Erreger lösen diese Krankheit aus?"),
    solution: solve(d.name, tx(`${en(N)} is caused by ${en(KINDS[d.kind].one)}.`, `${de(N)} wird von ${de(KINDS[d.kind].one)} ausgelöst.`), right === "bact" ? tx("antibiotic helps", "Antibiotikum hilft") : tx("no antibiotic", "kein Antibiotikum"), right === "bact" ? tx("Antibiotics attack the cell wall or ribosomes of bacteria.", "Antibiotika greifen Zellwand oder Ribosomen der Bakterien an.") : tx("Antibiotics only work against bacteria.", "Antibiotika wirken nur gegen Bakterien.")),
    mistakes: list,
  };
}

function resistanceTask(rng: Rng): Exercise {
  if (rng.chance(0.5)) {
    const { answer, mistakes: list } = choice(rng, [
      { text: tx("A few bacteria are insensitive by a random change in their genes. They survive and multiply.", "Einzelne Bakterien sind durch eine zufällige Veränderung im Erbgut unempfindlich. Sie überleben und vermehren sich.") },
      { text: tx("The human body has got used to the antibiotic.", "Der Körper des Menschen hat sich an das Antibiotikum gewöhnt."), title: tx("Not you, the bacteria", "Nicht du, die Bakterien"), say: tx("It's not you who becomes resistant, it's the bacteria! The surviving bacteria pass their resistance on to their offspring.", "Nicht du wirst resistent, sondern die Bakterien! Die überlebenden Bakterien geben ihre Resistenz an ihre Nachkommen weiter.") },
      { text: tx("The bacteria learn to cope with the antibiotic because they have to.", "Die Bakterien lernen, das Antibiotikum zu vertragen, weil sie müssen."), title: tx("No learning on purpose", "Kein absichtliches Lernen"), say: tx("Bacteria can't adapt on purpose. The resistant ones were there before by chance, and they are simply the ones left over.", "Bakterien können sich nicht absichtlich anpassen. Die resistenten waren zufällig schon vorher da und bleiben einfach übrig.") },
      { text: tx("The antibiotic loses its strength over the years.", "Das Antibiotikum verliert mit den Jahren seine Wirkung."), title: tx("The medicine is the same", "Das Medikament ist dasselbe"), say: tx("The medicine hasn't changed. What changed are the bacteria that survive it.", "Das Medikament hat sich nicht verändert. Verändert haben sich die Bakterien, die es überleben.") },
    ]);
    return {
      instruction: tx("Antibiotic resistance", "Antibiotikaresistenz"),
      text: tx("Why do some antibiotics no longer work against certain bacteria?", "Warum wirken manche Antibiotika gegen bestimmte Bakterien nicht mehr?"),
      answer,
      hint: tx("Who becomes resistant: the person, the medicine or the bacteria?", "Wer wird resistent: der Mensch, das Medikament oder die Bakterien?"),
      solution: [
        { math: tx('"antibiotic"#a \\to "survivors"#s', '"Antibiotikum"#a \\to "Überlebende"#s'), note: tx("The antibiotic kills the sensitive bacteria. A few are insensitive by chance and survive.", "Das Antibiotikum tötet die empfindlichen Bakterien. Einige wenige sind zufällig unempfindlich und überleben.") },
        { math: tx('"survivors"#s \\to "resistant bacteria"#r', '"Überlebende"#s \\to "resistente Bakterien"#r'), note: tx("They multiply: soon most bacteria are **resistant**.", "Sie vermehren sich: Bald sind die meisten Bakterien **resistent**."), highlight: ["r"] },
      ],
      mistakes: list,
    };
  }
  const items = [
    { text: tx("Taking antibiotics for a cold", "Antibiotika gegen eine Erkältung nehmen"), right: true },
    { text: tx("Stopping an antibiotic too early on your own", "Ein Antibiotikum eigenmächtig zu früh absetzen"), right: true },
    { text: tx("Using lots of antibiotics in livestock farming", "Massenhaft Antibiotika in der Tierhaltung"), right: true },
    { text: tx("Washing your hands regularly", "Regelmäßig Hände waschen"), right: false },
    { text: tx("Getting vaccinated", "Sich impfen lassen"), right: false },
    { text: tx("Taking an antibiotic exactly as prescribed", "Ein Antibiotikum genau nach Verordnung nehmen"), right: false },
  ];
  const pool = [...some(rng, items.filter((x) => x.right), rng.int(2, 3)), ...some(rng, items.filter((x) => !x.right), 2)];
  const { picked, options, correct, answer } = multiOf(rng, pool, (x) => x.right);
  const m = mistakes(answer);
  const vac = picked.findIndex((x) => en(x.text) === "Getting vaccinated");
  if (vac >= 0) m.add({ kind: "multi", options, correct: [...correct, vac].sort((a, b) => a - b) }, tx("Vaccines help here", "Impfungen helfen sogar"), tx("Vaccinations prevent infections, so fewer antibiotics are needed. That slows resistance down.", "Impfungen verhindern Infektionen, dann braucht man weniger Antibiotika. Das bremst Resistenzen sogar."));
  const cold = picked.findIndex((x) => en(x.text).startsWith("Taking antibiotics for"));
  if (cold >= 0) m.add({ kind: "multi", options, correct: correct.filter((j) => j !== cold) }, tx("A cold counts too", "Auch die Erkältung zählt"), tx("Against the cold viruses the antibiotic is useless, but it still hits the bacteria in your body. Resistant ones are left over.", "Gegen die Erkältungsviren ist das Antibiotikum nutzlos, aber es trifft trotzdem die Bakterien in deinem Körper. Übrig bleiben die resistenten."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("What helps resistant bacteria to spread?", "Was fördert die Ausbreitung resistenter Bakterien?"),
    answer,
    hint: tx("Resistant bacteria win whenever antibiotics are used without need or not properly.", "Resistente Bakterien gewinnen immer dann, wenn Antibiotika unnötig oder falsch eingesetzt werden."),
    solution: [
      { math: tx('"unnecessary or wrong use"#u \\to "resistance"#r', '"unnötiger oder falscher Einsatz"#u \\to "Resistenz"#r'), note: tx("Every use of antibiotics selects the resistant bacteria. Unnecessary or wrong use helps them most.", "Jeder Einsatz von Antibiotika bevorzugt die resistenten Bakterien. Unnötiger oder falscher Einsatz hilft ihnen am meisten.") },
      { math: listFrame(correct.map((i) => options[i]), " , "), note: tx("These promote resistance.", "Das fördert Resistenzen.") },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Inflammation and fever

const SIGNS = [
  { text: tx("Redness", "Rötung"), right: true },
  { text: tx("Swelling", "Schwellung"), right: true },
  { text: tx("Warmth", "Überwärmung"), right: true },
  { text: tx("Pain", "Schmerz"), right: true },
  { text: tx("Paleness", "Blässe"), right: false, say: tx("An inflamed spot gets more blood, so it turns red, not pale.", "Eine entzündete Stelle wird stärker durchblutet: Sie wird rot, nicht blass.") },
  { text: tx("Coldness", "Kälte"), right: false, say: tx("More blood flows there, and blood brings warmth: an inflamed spot feels warm.", "Dorthin fließt mehr Blut, und Blut bringt Wärme: Eine entzündete Stelle fühlt sich warm an.") },
  { text: tx("Goosebumps", "Gänsehaut"), right: false, say: tx("Goosebumps have nothing to do with an inflammation. Think of what more blood and fluid do to the spot.", "Gänsehaut hat mit einer Entzündung nichts zu tun. Überleg, was mehr Blut und Flüssigkeit an der Stelle bewirken.") },
];

function inflammationTask(rng: Rng): Exercise {
  const pool = [...SIGNS.filter((s) => s.right), ...some(rng, SIGNS.filter((s) => !s.right), 2)];
  const { picked, options, correct, answer } = multiOf(rng, pool, (s) => s.right);
  const m = mistakes(answer);
  picked.forEach((s, i) => {
    if (!s.right && s.say) m.add({ kind: "multi", options, correct: [...correct, i].sort((a, b) => a - b) }, tx("Not a sign of inflammation", "Kein Entzündungszeichen"), s.say);
  });
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("A splinter in your finger has got inflamed. Which signs do you notice?", "Ein Splitter im Finger hat sich entzündet. Welche Anzeichen bemerkst du?"),
    answer,
    hint: tx("Blood vessels widen and fluid leaks into the tissue. What does that do to the spot?", "Die Blutgefäße weiten sich und Flüssigkeit tritt ins Gewebe aus. Was macht das mit der Stelle?"),
    solution: [
      { math: tx('"more blood"#b \\to "red, warm"#r', '"mehr Blut"#b \\to "rot, warm"#r'), note: tx("The blood vessels widen: more blood makes the spot red and warm.", "Die Blutgefäße weiten sich: Mehr Blut macht die Stelle rot und warm.") },
      { math: tx('"fluid"#f \\to "swollen, painful"#s', '"Flüssigkeit"#f \\to "geschwollen, schmerzhaft"#s'), note: tx("Fluid leaks out: the spot swells and presses on nerves, so it hurts. Phagocytes move in and eat the bacteria.", "Flüssigkeit tritt aus: Die Stelle schwillt an und drückt auf Nerven, es tut weh. Fresszellen wandern ein und fressen die Bakterien.") },
    ],
    mistakes: m.list,
  };
}

const FEVER_TRUE: Text[] = [
  tx("The body itself sets its temperature higher.", "Der Körper stellt seine Temperatur selbst höher ein."),
  tx("The defence cells work faster when it's warmer.", "Die Abwehrzellen arbeiten bei höherer Temperatur schneller."),
  tx("Many pathogens multiply more slowly at a higher temperature.", "Viele Erreger vermehren sich bei höherer Temperatur schlechter."),
];
const FEVER_FALSE: Opt[] = [
  { text: tx("Fever comes from the heat that the pathogens give off.", "Fieber entsteht durch die Wärme, die die Erreger abgeben."), title: tx("The body heats", "Der Körper heizt"), say: tx("The pathogens don't heat you up. Your brain raises the set temperature, and the body heats itself, for example by shivering.", "Die Erreger heizen dich nicht auf. Dein Gehirn stellt die Soll-Temperatur höher, und der Körper heizt selbst, zum Beispiel durch Zittern.") },
  { text: tx("Fever shows that the immune system has failed.", "Fieber zeigt, dass das Immunsystem versagt hat."), title: tx("Defence at work", "Abwehr bei der Arbeit"), say: tx("The opposite! Fever is part of the defence: the body is fighting back.", "Im Gegenteil! Fieber ist ein Teil der Abwehr: Der Körper wehrt sich gerade.") },
  { text: tx("Fever kills all pathogens straight away.", "Fieber tötet alle Erreger sofort ab."), title: tx("Not that strong", "So stark ist es nicht"), say: tx("Fever slows many pathogens down and speeds up the defence, but it doesn't kill them all on its own.", "Fieber bremst viele Erreger und beschleunigt die Abwehr, aber allein tötet es nicht alle ab.") },
  { text: tx("Fever starts at a body temperature of 37 °C.", "Fieber beginnt bei einer Körpertemperatur von 37 °C."), title: tx("37 °C is normal", "37 °C ist normal"), say: tx("37 °C is our normal body temperature. One speaks of fever from about 38 °C.", "37 °C ist unsere normale Körpertemperatur. Von Fieber spricht man ab etwa 38 °C.") },
];

function feverTask(rng: Rng): Exercise {
  const { answer, mistakes: list } = choice(rng, [{ text: rng.pick(FEVER_TRUE) }, ...some(rng, FEVER_FALSE, 3)]);
  return {
    instruction: tx("Fever", "Fieber"),
    text: tx("Which statement about fever is true?", "Welche Aussage über Fieber stimmt?"),
    answer,
    hint: tx("Fever is part of the defence. Who sets the temperature higher?", "Fieber gehört zur Abwehr. Wer stellt die Temperatur höher?"),
    solution: [
      { math: tx('37 "°C" \\to "over" 38#f "°C"', '37 "°C" \\to "über" 38#f "°C"'), note: tx("Normal is about 37 °C; from about 38 °C we speak of fever.", "Normal sind etwa 37 °C, ab etwa 38 °C spricht man von Fieber.") },
      { math: tx('"fever"#f \\to "faster defence"#d', '"Fieber"#f \\to "schnellere Abwehr"#d'), note: tx("The body raises its own temperature: the defence works faster and many pathogens multiply more slowly.", "Der Körper erhöht selbst seine Temperatur: Die Abwehr arbeitet schneller, viele Erreger vermehren sich schlechter.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Bacteria multiply: a calculation

function growthTask(rng: Rng): Exercise {
  const every = rng.pick([20, 30]);
  const hours = every === 20 ? rng.pick([1, 2, 3]) : rng.pick([2, 3, 4]);
  const start = rng.pick([1, 1, 2, 3]);
  const n = (hours * 60) / every;
  const value = start * 2 ** n;
  const answer: AnswerSpec = { kind: "number", value };
  const m = mistakes(answer);
  m.add({ kind: "number", value: start * 2 * n }, tx("Doubling isn't adding", "Verdoppeln ist nicht addieren"), tx(`Each division doubles the number. So it's not ${start} × 2 × ${n}: you double ${n} times in a row.`, `Jede Teilung verdoppelt die Zahl. Also nicht ${start} · 2 · ${n}, sondern ${n}-mal hintereinander verdoppeln.`));
  m.add({ kind: "number", value: start + n }, tx("One new per division?", "Pro Teilung nur eins dazu?"), tx("Every bacterium divides, not just one. So the number doubles each time.", "Jedes Bakterium teilt sich, nicht nur eins. Die Zahl verdoppelt sich also jedes Mal."));
  m.add({ kind: "number", value: start * 2 ** (n - 1) }, tx("One doubling short", "Eine Verdopplung zu wenig"), tx(`Count the divisions again: ${hours * 60} minutes ÷ ${every} minutes = ${n} divisions.`, `Zähl die Teilungen noch mal: ${hours * 60} Minuten : ${every} Minuten = ${n} Teilungen.`), true);
  m.add({ kind: "number", value: n }, tx("That's the number of divisions", "Das ist die Zahl der Teilungen"), tx(`${n} is how often they divide. Now double ${start === 1 ? "the one bacterium" : `the ${start} bacteria`} that many times.`, `${n} ist die Zahl der Teilungen. Jetzt musst du ${start === 1 ? "das eine Bakterium" : `die ${start} Bakterien`} so oft verdoppeln.`));
  const steps = Array.from({ length: n + 1 }, (_, i) => start * 2 ** i);
  return {
    instruction: tx("Calculate", "Berechne"),
    text: tx(
      `Under good conditions a bacterium divides every ${every} minutes. A cut contains ${start === 1 ? "one bacterium" : `${start} bacteria`}. How many bacteria are there after ${hours} hours, if none die?`,
      `Unter guten Bedingungen teilt sich ein Bakterium alle ${every} Minuten. In einer Wunde ${start === 1 ? "ist ein Bakterium" : `sind ${start} Bakterien`}. Wie viele Bakterien sind es nach ${hours} Stunden, wenn keins abstirbt?`,
    ),
    answer,
    hint: tx(`First: how many divisions fit into ${hours} hours? Then double that many times.`, `Zuerst: Wie viele Teilungen passen in ${hours} Stunden? Dann so oft verdoppeln.`),
    solution: [
      { math: tx(`${hours * 60} "min" : ${every} "min" = ${n}#n "divisions"`, `${hours * 60} "min" : ${every} "min" = ${n}#n "Teilungen"`), note: tx(`${hours} hours are ${hours * 60} minutes, that's ${n} divisions.`, `${hours} Stunden sind ${hours * 60} Minuten, das sind ${n} Teilungen.`) },
      { math: steps.length <= 7 ? steps.map((v, i) => `${v}#s${i}`).join(" \\to ") : `${start} \\cdot 2^{${n}} = ${value}#s${n}`, note: tx(`The number doubles with each division: **${value}** bacteria.`, `Mit jeder Teilung verdoppelt sich die Zahl: **${value}** Bakterien.`), highlight: [`s${n}`] },
    ],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Vaccination

function vaccineTask(rng: Rng, form = rng.int(0, 2)): Exercise {
  const forms: { text: Text; opts: Opt[]; frames: [Text, Text] }[] = [
    {
      text: tx("What does a vaccine contain?", "Was enthält ein Impfstoff?"),
      opts: [
        { text: tx("Weakened or killed pathogens, or parts of them", "Abgeschwächte oder abgetötete Erreger oder Teile davon") },
        { text: tx("Antibiotics that kill the pathogens", "Antibiotika, die die Erreger abtöten"), title: tx("Vaccine isn't medicine", "Impfstoff ist kein Medikament"), say: tx("Antibiotics are medicines against bacteria. A vaccine shows your body the pathogen so that it learns to fight it itself.", "Antibiotika sind Medikamente gegen Bakterien. Ein Impfstoff zeigt deinem Körper den Erreger, damit er selbst lernt, ihn abzuwehren.") },
        { text: tx("Dangerous pathogens at full strength", "Gefährliche Erreger in voller Stärke"), title: tx("Then you'd get ill", "Dann würdest du krank"), say: tx("Then you would get ill! The pathogens in a vaccine are weakened, dead or just parts of them.", "Dann würdest du ja krank! Die Erreger im Impfstoff sind abgeschwächt, tot oder nur Teile davon.") },
        { text: tx("Vitamins that strengthen the defence", "Vitamine, die die Abwehr stärken"), title: tx("Not vitamins", "Keine Vitamine"), say: tx("Vitamins are healthy, but they don't teach your body a pathogen. That's what a vaccine is for.", "Vitamine sind gesund, aber sie zeigen deinem Körper keinen Erreger. Genau dafür ist ein Impfstoff da.") },
      ],
      frames: [tx("vaccine", "Impfstoff"), tx("harmless pathogens or parts", "harmlose Erreger oder Teile")],
    },
    {
      text: tx("Why does a vaccinated person usually not get ill when infected?", "Warum wird ein geimpfter Mensch bei einer Ansteckung meist nicht krank?"),
      opts: [
        { text: tx("The body knows the pathogen already and fights it off at once", "Der Körper kennt den Erreger schon und wehrt ihn sofort ab") },
        { text: tx("The vaccine kills the pathogens as soon as they come", "Der Impfstoff tötet die Erreger sofort ab, wenn sie kommen"), title: tx("The body remembers", "Der Körper erinnert sich"), say: tx("The vaccine was broken down long ago. It's your body that remembers the pathogen.", "Der Impfstoff ist längst abgebaut. Es ist dein Körper, der sich an den Erreger erinnert.") },
        { text: tx("Vaccinated people can't catch the pathogen at all", "Geimpfte können sich gar nicht anstecken"), title: tx("Infection is possible", "Anstecken geht schon"), say: tx("The pathogen can still get in. But the defence is so fast that you usually don't get ill.", "Der Erreger kann trotzdem eindringen. Aber die Abwehr ist so schnell, dass man meist nicht krank wird.") },
        { text: tx("The vaccine makes the pathogens around you harmless", "Die Impfung macht die Erreger in der Umgebung unschädlich"), title: tx("It works inside you", "Sie wirkt in dir"), say: tx("A vaccination doesn't change the pathogens outside. It trains your own defence.", "Eine Impfung verändert die Erreger draußen nicht. Sie trainiert deine eigene Abwehr.") },
      ],
      frames: [tx("vaccination", "Impfung"), tx("body remembers", "Körper erinnert sich")],
    },
    {
      text: tx("When do you get vaccinated?", "Wann lässt man sich impfen?"),
      opts: [
        { text: tx("In advance, before you get infected", "Vorbeugend, bevor man sich ansteckt") },
        { text: tx("Only when you are already ill", "Erst, wenn man schon krank ist"), title: tx("A vaccine prevents", "Impfen beugt vor"), say: tx("It takes one to two weeks until the protection has built up. That's why you vaccinate beforehand.", "Bis der Schutz aufgebaut ist, dauert es ein bis zwei Wochen. Deshalb impft man vorher.") },
        { text: tx("Only after an antibiotic has failed", "Erst, wenn ein Antibiotikum nicht gewirkt hat"), title: tx("Different things", "Zwei verschiedene Dinge"), say: tx("A vaccination doesn't replace a medicine. It prepares the body before an infection.", "Eine Impfung ersetzt kein Medikament. Sie bereitet den Körper vor einer Ansteckung vor.") },
        { text: tx("Every day, like taking vitamins", "Jeden Tag, wie Vitamine"), title: tx("Memory lasts", "Das Gedächtnis hält"), say: tx("The body remembers the pathogen for years. Depending on the vaccine, a booster every few years is enough.", "Der Körper merkt sich den Erreger jahrelang. Je nach Impfung reicht eine Auffrischung nach einigen Jahren.") },
      ],
      frames: [tx("vaccinate first", "erst impfen"), tx("then protected", "dann geschützt")],
    },
  ];
  const f = forms[form];
  const { answer, mistakes: list } = choice(rng, f.opts);
  return {
    instruction: tx("The idea of vaccination", "Die Idee des Impfens"),
    text: f.text,
    answer,
    hint: tx("A vaccination lets the body get to know a pathogen without getting ill.", "Bei einer Impfung lernt der Körper einen Erreger kennen, ohne krank zu werden."),
    solution: [
      { math: q(f.frames[0], "v"), note: tx("The vaccine contains harmless (weakened or dead) pathogens or parts of them.", "Der Impfstoff enthält harmlose (abgeschwächte oder tote) Erreger oder Teile davon.") },
      { math: join(q(f.frames[0], "v"), "\\to", q(f.frames[1], "m")), note: tx("The body gets to know the pathogen and remembers it. If the real pathogen comes later, it reacts at once.", "Der Körper lernt den Erreger kennen und merkt ihn sich. Kommt später der echte Erreger, reagiert er sofort."), highlight: ["m"] },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Course of an infection (order) and terms (word)

const COURSE: Text[] = [
  tx("Infection: pathogens get into the body", "Ansteckung: Erreger gelangen in den Körper"),
  tx("Incubation period: they multiply, you notice nothing yet", "Inkubationszeit: Sie vermehren sich, man merkt noch nichts"),
  tx("Outbreak: fever and other symptoms", "Ausbruch: Fieber und andere Krankheitszeichen"),
  tx("The defence fights the pathogens", "Die Abwehr bekämpft die Erreger"),
  tx("Recovery: often you are immune afterwards", "Genesung: Danach ist man oft immun"),
];
const COURSE_SHORT: Text[] = [tx("infection", "Ansteckung"), tx("incubation", "Inkubation"), tx("outbreak", "Ausbruch"), tx("defence", "Abwehr"), tx("recovery", "Genesung")];

const SPLINTER: Text[] = [
  tx("A splinter injures the skin", "Ein Splitter verletzt die Haut"),
  tx("Bacteria get into the wound", "Bakterien dringen in die Wunde ein"),
  tx("Blood vessels widen: the spot turns red and warm", "Blutgefäße weiten sich: Die Stelle wird rot und warm"),
  tx("Phagocytes move in and eat the bacteria", "Fresszellen wandern ein und fressen die Bakterien"),
  tx("The wound heals", "Die Wunde heilt"),
];
const SPLINTER_SHORT: Text[] = [tx("splinter", "Splitter"), tx("bacteria", "Bakterien"), tx("red, warm", "rot, warm"), tx("phagocytes", "Fresszellen"), tx("healing", "Heilung")];

function orderTask(rng: Rng, which = rng.int(0, 1)): Exercise {
  const items = which === 0 ? COURSE : SPLINTER;
  const short = which === 0 ? COURSE_SHORT : SPLINTER_SHORT;
  const list: Mistake[] =
    which === 0
      ? [
          orderSlip([COURSE[2], COURSE[1]], tx("Not ill right away", "Nicht sofort krank"), tx("Right after the infection you don't notice anything yet: the pathogens first have to multiply. That's the incubation period.", "Direkt nach der Ansteckung merkt man noch nichts: Die Erreger müssen sich erst vermehren. Das ist die Inkubationszeit.")),
          orderSlip([COURSE[3], COURSE[2]], tx("The defence needs time", "Die Abwehr braucht Zeit"), tx("The first time, the defence needs a few days to get going. That's why you are ill first.", "Beim ersten Mal braucht die Abwehr ein paar Tage, bis sie richtig loslegt. Deshalb ist man zuerst krank.")),
        ]
      : [orderSlip([SPLINTER[3], SPLINTER[2]], tx("Phagocytes come with the blood", "Fresszellen kommen mit dem Blut"), tx("The phagocytes arrive with the blood: first the vessels widen and become leaky, then they can move into the tissue.", "Die Fresszellen kommen mit dem Blut: Erst weiten sich die Gefäße und werden durchlässig, dann können sie ins Gewebe wandern."))];
  return {
    instruction: tx("Put in order", "Bring in die richtige Reihenfolge"),
    text: which === 0 ? tx("How does an infectious disease go?", "Wie verläuft eine Infektionskrankheit?") : tx("A splinter gets into your finger. What happens?", "Ein Splitter dringt in deinen Finger ein. Was passiert?"),
    answer: { kind: "order", items },
    hint: which === 0 ? tx("Before you notice anything, the pathogens have to multiply.", "Bevor man etwas merkt, müssen sich die Erreger vermehren.") : tx("The phagocytes arrive with the blood.", "Die Fresszellen kommen mit dem Blut."),
    solution: [{ math: listFrame(short), note: which === 0 ? tx("Infection, incubation period, outbreak, defence, recovery.", "Ansteckung, Inkubationszeit, Ausbruch, Abwehr, Genesung.") : tx("Injury, bacteria get in, the spot gets inflamed, phagocytes eat the bacteria, the wound heals.", "Verletzung, Bakterien dringen ein, die Stelle entzündet sich, Fresszellen fressen die Bakterien, die Wunde heilt.") }],
    mistakes: list,
  };
}

type Term = { clue: Text; accept: Text[]; wrong: { accept: Text[]; title: Text; say: Text }[] };
const TERMS: Term[] = [
  {
    clue: tx("Pathogens that are not cells and can only multiply inside host cells.", "Krankheitserreger, die keine Zellen sind und sich nur in Wirtszellen vermehren können."),
    accept: [tx("viruses", "Viren"), tx("virus", "Virus")],
    wrong: [{ accept: [tx("bacteria", "Bakterien"), tx("bacterium", "Bakterium")], title: tx("Bacteria are cells", "Bakterien sind Zellen"), say: tx("Bacteria are living cells and divide by themselves. Who needs a host cell?", "Bakterien sind lebende Zellen und teilen sich selbst. Wer braucht eine Wirtszelle?") }],
  },
  {
    clue: tx("Living single cells without a nucleus; some of them cause scarlet fever or tuberculosis.", "Lebende Einzeller ohne Zellkern; manche lösen Scharlach oder Tuberkulose aus."),
    accept: [tx("bacteria", "Bakterien"), tx("bacterium", "Bakterium")],
    wrong: [{ accept: [tx("viruses", "Viren"), tx("virus", "Virus")], title: tx("Viruses aren't cells", "Viren sind keine Zellen"), say: tx("Viruses aren't living cells. Who is a single cell without a nucleus?", "Viren sind keine lebenden Zellen. Wer ist ein Einzeller ohne Zellkern?") }],
  },
  {
    clue: tx("The enzyme in tears and saliva that dissolves the cell walls of bacteria.", "Das Enzym in Tränen und Speichel, das die Zellwände von Bakterien auflöst."),
    accept: [tx("lysozyme", "Lysozym")],
    wrong: [{ accept: [tx("antibody", "Antikörper"), tx("antibodies", "Antikörper")], title: tx("Not an antibody", "Kein Antikörper"), say: tx("Antibodies are made by immune cells. In tears there is an enzyme that attacks any bacterial wall.", "Antikörper bilden Immunzellen. In Tränen steckt ein Enzym, das jede Bakterienzellwand angreift.") }],
  },
  {
    clue: tx("White blood cells that engulf and digest pathogens.", "Weiße Blutkörperchen, die Erreger umfließen und verdauen."),
    accept: [tx("phagocytes", "Fresszellen"), tx("phagocyte", "Fresszelle"), tx("macrophages", "Makrophagen"), tx("macrophage", "Makrophage"), "Phagozyten", "Phagocyten"],
    wrong: [{ accept: [tx("antibodies", "Antikörper")], title: tx("Not cells", "Keine Zellen"), say: tx("Antibodies are proteins, not cells. Which cells eat pathogens?", "Antikörper sind Proteine, keine Zellen. Welche Zellen fressen Erreger?") }],
  },
  {
    clue: tx("Medicines that work against bacteria but not against viruses.", "Medikamente, die gegen Bakterien wirken, aber nicht gegen Viren."),
    accept: [tx("antibiotics", "Antibiotika"), tx("antibiotic", "Antibiotikum")],
    wrong: [{ accept: [tx("vaccines", "Impfstoffe"), tx("vaccine", "Impfstoff")], title: tx("A vaccine prevents", "Ein Impfstoff beugt vor"), say: tx("A vaccine prevents an illness by training the body. Which medicines kill bacteria?", "Ein Impfstoff beugt vor, indem er den Körper trainiert. Welche Medikamente töten Bakterien?") }],
  },
  {
    clue: tx("The time between infection and the first symptoms.", "Die Zeit zwischen Ansteckung und den ersten Krankheitszeichen."),
    accept: [tx("incubation period", "Inkubationszeit"), "Inkubationsphase"],
    wrong: [],
  },
  {
    clue: tx("Bacteria that an antibiotic can no longer kill are called …", "Bakterien, die ein Antibiotikum nicht mehr abtöten kann, nennt man …"),
    accept: [tx("resistant", "resistent")],
    wrong: [{ accept: [tx("immune", "immun")], title: tx("Immune is you", "Immun bist du"), say: tx("'Immune' is what we say about people who can fight off a pathogen. Bacteria that survive antibiotics are …", "„Immun“ sagt man über Menschen, die einen Erreger abwehren können. Bakterien, die Antibiotika überleben, sind …") }],
  },
  {
    clue: tx("A way to protect yourself in advance: the body gets to know a harmless form of the pathogen.", "Eine Möglichkeit, sich vorbeugend zu schützen: Der Körper lernt eine harmlose Form des Erregers kennen."),
    accept: [tx("vaccination", "Impfung"), tx("immunisation", "Schutzimpfung"), "Impfen", "Immunisierung"],
    wrong: [{ accept: [tx("antibiotic", "Antibiotikum"), tx("antibiotics", "Antibiotika")], title: tx("That's a medicine", "Das ist ein Medikament"), say: tx("Antibiotics treat a bacterial disease you already have. What protects you beforehand?", "Antibiotika behandeln eine bakterielle Krankheit, die man schon hat. Was schützt dich vorher?") }],
  },
];

function termTask(rng: Rng, term: Term = rng.pick(TERMS)): Exercise {
  const answer: AnswerSpec = { kind: "word", accept: term.accept, placeholder: tx("term", "Fachbegriff") };
  const m = mistakes(answer);
  for (const w of term.wrong) m.add({ kind: "word", accept: w.accept }, w.title, w.say);
  return {
    instruction: tx("Name the term", "Nenne den Fachbegriff"),
    text: term.clue,
    answer,
    hint: tx(`It starts with “${en(term.accept[0]).charAt(0).toUpperCase()}”.`, `Er beginnt mit „${de(term.accept[0]).charAt(0).toUpperCase()}“.`),
    solution: [{ math: q(term.accept[0], "a"), note: tx(`The term is **${en(term.accept[0])}**.`, `Der Fachbegriff ist **${de(term.accept[0])}**.`), highlight: ["a"] }],
    mistakes: m.list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate1(rng: Rng): Exercise {
  switch (rng.int(0, 13)) {
    case 0:
      return kindTask(rng);
    case 1:
      return factsTask(rng);
    case 2:
      return barrierMatchTask(rng);
    case 3:
      return barrierFigureTask(rng);
    case 4:
      return routeTask(rng);
    case 5:
      return protectTask(rng);
    case 6:
    case 7:
      return antibioticTask(rng);
    case 8:
      return resistanceTask(rng);
    case 9:
      return rng.chance(0.5) ? inflammationTask(rng) : feverTask(rng);
    case 10:
      return growthTask(rng);
    case 11:
      return vaccineTask(rng);
    case 12:
      return orderTask(rng);
    default:
      return termTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

function CompareWidget() {
  return <ImmuneCompare />;
}
function BarrierWidget() {
  return <ImmuneBarriers mode="explore" />;
}
function TiterWidget() {
  return <ImmuneTiter level={1} />;
}

const checkFacts = factsTask(createRng(4), true, [0, 3, 4, 5, 7]);
const checkBarriers = barrierMatchTask(createRng(2), ["mucosa", "cilia", "acid", "tears"]);
const checkAntibiotic = antibioticTask(createRng(5), DISEASES.find((d) => en(d.name) === "flu (influenza)")!);
const checkVaccine = vaccineTask(createRng(7), 1);

export const level1: LevelLesson = {
  lesson: [
    {
      type: "explain",
      title: tx("Pathogens", "Krankheitserreger"),
      blob: tx("Achoo! Who is actually behind a cold? Let's meet the suspects!", "Hatschi! Wer steckt eigentlich hinter einer Erkältung? Lernen wir die Verdächtigen kennen!"),
      body: tx(
        "Infectious diseases are caused by **pathogens**: tiny organisms or particles that get into the body and multiply there. There are four big groups.",
        "Infektionskrankheiten werden von **Krankheitserregern** ausgelöst: winzigen Lebewesen oder Teilchen, die in den Körper eindringen und sich dort vermehren. Es gibt vier große Gruppen.",
      ),
      frames: [
        { math: tx('"bacteria"#b', '"Bakterien"#b'), note: tx("**Bacteria** are living single cells without a nucleus. Most are harmless or even useful, e.g. in your gut. Some cause scarlet fever, tuberculosis or salmonella poisoning.", "**Bakterien** sind lebende Einzeller ohne Zellkern. Die meisten sind harmlos oder sogar nützlich, z. B. in deinem Darm. Manche lösen Scharlach, Tuberkulose oder eine Salmonellen-Vergiftung aus.") },
        { math: tx('"bacteria"#b \\quad "viruses"#v', '"Bakterien"#b \\quad "Viren"#v'), note: tx("**Viruses** are not cells at all: genetic material in a coat. They can only multiply inside a host cell. They cause flu, colds, measles and chickenpox.", "**Viren** sind gar keine Zellen: Erbinformation in einer Hülle. Sie können sich nur in einer Wirtszelle vermehren. Sie lösen Grippe, Erkältung, Masern und Windpocken aus.") },
        { math: tx('"bacteria"#b \\quad "viruses"#v \\\\ "fungi"#p \\quad "parasites"#a', '"Bakterien"#b \\quad "Viren"#v \\\\ "Pilze"#p \\quad "Parasiten"#a'), note: tx("**Fungi** cause e.g. athlete's foot. **Parasites** are organisms that live on or in us, like tapeworms, lice or the single-celled malaria pathogen.", "**Pilze** lösen z. B. Fußpilz aus. **Parasiten** sind Lebewesen, die auf oder in uns leben, wie Bandwürmer, Läuse oder der einzellige Malaria-Erreger.") },
      ],
    },
    {
      type: "widget",
      title: tx("Bacteria and viruses compared", "Bakterien und Viren im Vergleich"),
      blob: tx("A bacterium is a living thing. A virus? See for yourself!", "Ein Bakterium ist ein Lebewesen. Ein Virus? Schau selbst!"),
      body: tx("Bacteria and viruses are often mixed up, but they are completely different. Tap the features and compare.", "Bakterien und Viren werden oft verwechselt, dabei sind sie grundverschieden. Tipp auf die Merkmale und vergleiche."),
      widget: CompareWidget,
    },
    { type: "check", blob: tx("Let's see if you can tell them apart.", "Mal sehen, ob du sie auseinanderhalten kannst."), exercise: checkFacts },
    {
      type: "explain",
      title: tx("How pathogens get to you", "Wie Erreger zu dir kommen"),
      blob: tx("Pathogens have many ways into your body. And you have many ways to stop them!", "Erreger haben viele Wege in deinen Körper. Und du hast viele Wege, sie aufzuhalten!"),
      body: tx("Each way of infection can be blocked with a suitable hygiene rule.", "Jeden Ansteckungsweg kann man mit einer passenden Hygieneregel unterbrechen."),
      frames: [
        { math: tx('"droplet infection"#a', '"Tröpfcheninfektion"#a'), note: tx("Coughing, sneezing and even talking send tiny droplets with pathogens through the air: flu, colds, measles.", "Beim Husten, Niesen und sogar Sprechen fliegen winzige Tröpfchen mit Erregern durch die Luft: Grippe, Erkältung, Masern.") },
        { math: tx('"droplet infection"#a \\\\ "smear infection"#b', '"Tröpfcheninfektion"#a \\\\ "Schmierinfektion"#b'), note: tx("In a **smear infection** pathogens get to your mouth, nose or eyes via hands, door handles or towels.", "Bei einer **Schmierinfektion** gelangen Erreger über Hände, Türklinken oder Handtücher an Mund, Nase oder Augen.") },
        { math: tx('"droplet infection"#a \\\\ "smear infection"#b \\\\ "food and water"#c \\\\ "animals"#d', '"Tröpfcheninfektion"#a \\\\ "Schmierinfektion"#b \\\\ "Nahrung und Wasser"#c \\\\ "Tiere"#d'), note: tx("Spoilt food and dirty water carry e.g. salmonella or cholera. Ticks pass on Lyme disease, mosquitoes malaria.", "Verdorbene Lebensmittel und verschmutztes Wasser übertragen z. B. Salmonellen oder Cholera. Zecken übertragen Borreliose, Mücken Malaria.") },
        { math: tx('"wash hands"#h \\quad "sneeze into your arm"#n \\\\ "cook meat"#g \\quad "check for ticks"#z', '"Hände waschen"#h \\quad "in die Armbeuge niesen"#n \\\\ "Fleisch durchgaren"#g \\quad "Zecken absuchen"#z'), note: tx("**Hygiene** breaks the chains: wash your hands with soap for 20 to 30 seconds, sneeze into the crook of your arm, cook meat thoroughly, check for ticks.", "**Hygiene** unterbricht die Ansteckungswege: Hände 20 bis 30 Sekunden mit Seife waschen, in die Armbeuge niesen, Fleisch gut durchgaren, nach Zecken absuchen.") },
      ],
    },
    {
      type: "widget",
      title: tx("The body's barriers", "Die Schutzbarrieren des Körpers"),
      blob: tx("Your body is a fortress, with walls, traps and an acid pool!", "Dein Körper ist eine Festung, mit Mauern, Fallen und einem Säurebecken!"),
      body: tx("Before a pathogen can do any harm, it has to get past the **outer barriers**. Tap the numbers.", "Bevor ein Erreger Schaden anrichten kann, muss er an den **äußeren Barrieren** vorbei. Tipp auf die Nummern."),
      widget: BarrierWidget,
    },
    { type: "check", blob: tx("Who does what in the fortress?", "Wer macht was in der Festung?"), exercise: checkBarriers },
    {
      type: "explain",
      title: tx("Inflammation and fever", "Entzündung und Fieber"),
      blob: tx("Red, warm, swollen: that's no accident, that's the defence at work!", "Rot, warm, geschwollen: Das ist kein Zufall, das ist die Abwehr bei der Arbeit!"),
      frames: [
        { math: tx('"splinter"#s \\to "bacteria in the wound"#b', '"Splitter"#s \\to "Bakterien in der Wunde"#b'), note: tx("A splinter injures the skin. Bacteria get past the barrier into the tissue.", "Ein Splitter verletzt die Haut. Bakterien gelangen an der Barriere vorbei ins Gewebe.") },
        { math: tx('"red"#r \\; "warm"#w \\; "swollen"#g \\; "painful"#p', '"rot"#r \\; "warm"#w \\; "geschwollen"#g \\; "schmerzt"#p'), note: tx("The spot becomes **inflamed**: blood vessels widen (red and warm), fluid leaks out (swelling), and it hurts.", "Die Stelle **entzündet** sich: Blutgefäße weiten sich (rot und warm), Flüssigkeit tritt aus (Schwellung), und es tut weh.") },
        { math: tx('"phagocytes"#f \\to "bacteria"#b', '"Fresszellen"#f \\to "Bakterien"#b'), note: tx("Through the leaky vessel walls **phagocytes** (white blood cells) move in and eat the bacteria. Pus is dead phagocytes and pathogens.", "Durch die durchlässigen Gefäßwände wandern **Fresszellen** (weiße Blutkörperchen) ein und fressen die Bakterien. Eiter besteht aus abgestorbenen Fresszellen und Erregern.") },
        { math: tx('37#a "°C" \\to "over"#u 38#b "°C"', '37#a "°C" \\to "über"#u 38#b "°C"'), note: tx("With many infections you get a **fever**: the body itself sets its temperature higher. The defence then works faster and many pathogens multiply more slowly.", "Bei vielen Infektionen bekommt man **Fieber**: Der Körper stellt seine Temperatur selbst höher ein. Die Abwehr arbeitet dann schneller, viele Erreger vermehren sich schlechter.") },
      ],
    },
    {
      type: "widget",
      title: tx("The antibiotic experiment", "Das Antibiotika-Experiment"),
      blob: tx("Antibiotics are strong weapons. But against whom exactly?", "Antibiotika sind starke Waffen. Aber gegen wen genau?"),
      body: tx(
        "**Antibiotics** (like penicillin, found by Alexander Fleming in a mould in 1928) kill bacteria or stop them from growing. Try them on bacteria and on viruses, and wait in between.",
        "**Antibiotika** (wie das Penicillin, das Alexander Fleming 1928 in einem Schimmelpilz entdeckte) töten Bakterien ab oder hemmen ihr Wachstum. Probier sie an Bakterien und an Viren aus, und warte zwischendurch ab.",
      ),
      widget: ImmuneAntibiotics,
    },
    { type: "check", blob: tx("Flu season! What would you say?", "Grippezeit! Was meinst du?"), exercise: checkAntibiotic },
    {
      type: "widget",
      title: tx("The idea of vaccination", "Die Idee des Impfens"),
      blob: tx("What if your body could practise before the real fight?", "Was, wenn dein Körper vor dem echten Kampf üben könnte?"),
      body: tx(
        "Once you have had measles, you usually never get them again: the body **remembers** the pathogen. A vaccination uses exactly that. Press play, then vaccinate and play again.",
        "Wer einmal Masern hatte, bekommt sie meist nie wieder: Der Körper **merkt sich** den Erreger. Eine Impfung nutzt genau das. Drück auf Abspielen, dann impfe und spiel es noch mal ab.",
      ),
      widget: TiterWidget,
    },
    { type: "check", blob: tx("Last one: why does the vaccine protect you?", "Zum Schluss: Warum schützt die Impfung?"), exercise: checkVaccine },
  ],
  summary: [
    {
      title: tx("Pathogens", "Krankheitserreger"),
      body: tx(
        "Bacteria: living single cells without a nucleus, they multiply by dividing. Viruses: not cells, no metabolism, they multiply only in host cells. Also fungi and parasites.",
        "Bakterien: lebende Einzeller ohne Zellkern, sie vermehren sich durch Teilung. Viren: keine Zellen, kein Stoffwechsel, sie vermehren sich nur in Wirtszellen. Außerdem Pilze und Parasiten.",
      ),
      examples: [tx('"bacteria:" \\; "scarlet fever, tuberculosis"', '"Bakterien:" \\; "Scharlach, Tuberkulose"'), tx('"viruses:" \\; "flu, measles, chickenpox"', '"Viren:" \\; "Grippe, Masern, Windpocken"')],
      tone: "rule",
    },
    {
      title: tx("Infection and hygiene", "Ansteckung und Hygiene"),
      body: tx("Ways of infection: droplets, smear (contact), food and water, animals. Hygiene breaks them: wash hands, sneeze into your arm, cook food well.", "Ansteckungswege: Tröpfchen, Schmier (Kontakt), Nahrung und Wasser, Tiere. Hygiene unterbricht sie: Hände waschen, in die Armbeuge niesen, Essen gut durchgaren."),
      tone: "tip",
    },
    {
      title: tx("Outer barriers", "Äußere Barrieren"),
      body: tx(
        "Skin (horny layer, acid mantle), mucous membranes and cilia (trap and carry away), stomach acid (kills), tears and saliva (lysozyme), coughing and sneezing.",
        "Haut (Hornschicht, Säureschutzmantel), Schleimhäute und Flimmerhärchen (festhalten und abtransportieren), Magensäure (tötet ab), Tränen und Speichel (Lysozym), Husten und Niesen.",
      ),
      tone: "rule",
    },
    {
      title: tx("Inflammation and fever", "Entzündung und Fieber"),
      body: tx("Inflammation: red, warm, swollen, painful; phagocytes eat the pathogens. Fever (from about 38 °C): the body raises its temperature, the defence works faster.", "Entzündung: rot, warm, geschwollen, schmerzhaft; Fresszellen fressen die Erreger. Fieber (ab etwa 38 °C): Der Körper erhöht seine Temperatur, die Abwehr arbeitet schneller."),
      tone: "rule",
    },
    {
      title: tx("Antibiotics: only against bacteria", "Antibiotika: nur gegen Bakterien"),
      body: tx("Antibiotics don't work against viruses. Used without need or stopped too early, they breed resistant bacteria.", "Antibiotika wirken nicht gegen Viren. Unnötig genommen oder zu früh abgesetzt, fördern sie resistente Bakterien."),
      tone: "warning",
    },
    {
      title: tx("Vaccination", "Impfung"),
      body: tx("The vaccine contains weakened or dead pathogens or parts of them. The body gets to know the pathogen without getting ill and later fights it off at once.", "Der Impfstoff enthält abgeschwächte oder tote Erreger oder Teile davon. Der Körper lernt den Erreger kennen, ohne krank zu werden, und wehrt ihn später sofort ab."),
      examples: [tx('"vaccination" \\to "memory" \\to "protection"', '"Impfung" \\to "Gedächtnis" \\to "Schutz"')],
      tone: "rule",
    },
  ],
};
