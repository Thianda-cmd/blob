"use client";

import { tx, type Text } from "@/i18n/text";
import { createRng, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, LevelLesson, Mistake } from "@/learn/types";
import { EvolutionForelimbs } from "@/learn/biology/visuals/EvolutionForelimbs";
import { EvolutionGiraffes } from "@/learn/biology/visuals/EvolutionGiraffes";
import { EvolutionIslands } from "@/learn/biology/visuals/EvolutionIslands";
import { category, choice, de, en, indicesOf, join, mistakes, q, visual, type Opt } from "./kit";

// ---------------------------------------------------------------------------
// Darwin's explanation of an example (with Lamarck, "goal" and "strongest" as traps)

type Example = { id: string; ask: Text; darwin: Text; lamarck: Text; goal: Text; strong: Text };

const EXAMPLES: Example[] = [
  {
    id: "giraffe",
    ask: tx("Why do giraffes have such long necks?", "Warum haben Giraffen so lange Hälse?"),
    darwin: tx("Among the ancestors, neck length varied by chance. Animals with longer necks reached more food, survived more often and passed the long neck on.", "Bei den Vorfahren war die Halslänge zufällig verschieden. Tiere mit längerem Hals erreichten mehr Futter, überlebten häufiger und vererbten den langen Hals."),
    lamarck: tx("The ancestors stretched their necks all their lives to reach the leaves. Their necks grew longer, and this was passed on to the young.", "Die Vorfahren streckten ihr Leben lang den Hals nach den Blättern. Der Hals wurde länger, und das wurde an die Jungen vererbt."),
    goal: tx("Giraffes needed longer necks, so the next generation was born with longer necks.", "Giraffen brauchten längere Hälse, deshalb kam die nächste Generation mit längeren Hälsen zur Welt."),
    strong: tx("The strongest giraffes fought the others off and therefore had the most young.", "Die stärksten Giraffen haben die anderen weggekämpft und deshalb die meisten Jungen bekommen."),
  },
  {
    id: "mole",
    ask: tx("Moles live underground and have tiny eyes. How did that come about?", "Maulwürfe leben unter der Erde und haben winzige Augen. Wie kam es dazu?"),
    darwin: tx("Eye size varied. Underground, large eyes were no advantage but got inflamed more easily. Moles with smaller eyes had more young, who inherited them.", "Die Augengröße variierte. Unter der Erde brachten große Augen keinen Vorteil, entzündeten sich aber leichter. Maulwürfe mit kleineren Augen hatten mehr Junge, die diese erbten."),
    lamarck: tx("Because moles didn't use their eyes in the dark, the eyes shrank during their lives, and the young inherited the smaller eyes.", "Weil Maulwürfe ihre Augen im Dunkeln nicht benutzten, wurden die Augen im Lauf des Lebens kleiner, und die Jungen erbten die kleineren Augen."),
    goal: tx("Moles knew they wouldn't need eyes underground, so they had young with small eyes.", "Maulwürfe wussten, dass sie unter der Erde keine Augen brauchen, und bekamen deshalb Junge mit kleinen Augen."),
    strong: tx("Moles with small eyes were the strongest diggers and drove the others out of their tunnels.", "Maulwürfe mit kleinen Augen waren die stärksten Gräber und vertrieben die anderen aus ihren Gängen."),
  },
  {
    id: "cheetah",
    ask: tx("Cheetahs are the fastest land animals. How did they become so fast?", "Geparden sind die schnellsten Landtiere. Wie wurden sie so schnell?"),
    darwin: tx("Some cheetahs were faster than others by chance. The faster ones caught more prey, survived more often and passed on their speed.", "Manche Geparden waren zufällig schneller als andere. Die schnelleren fingen mehr Beute, überlebten häufiger und vererbten ihre Schnelligkeit."),
    lamarck: tx("Cheetahs trained every day by chasing prey. Their legs got stronger, and the young inherited this fitness.", "Geparden trainierten jeden Tag bei der Jagd. Ihre Beine wurden kräftiger, und die Jungen erbten diese Fitness."),
    goal: tx("Cheetahs wanted to be faster than their prey and therefore became faster from generation to generation.", "Geparden wollten schneller sein als ihre Beute und wurden deshalb von Generation zu Generation schneller."),
    strong: tx("The strongest cheetahs won every fight and therefore had the most young.", "Die stärksten Geparden gewannen jeden Kampf und hatten deshalb die meisten Jungen."),
  },
  {
    id: "duck",
    ask: tx("Ducks have webbed feet. How did these evolve?", "Enten haben Schwimmhäute. Wie sind sie entstanden?"),
    darwin: tx("Some birds had a little more skin between their toes by chance. They swam better, found more food and had more young, who inherited this skin.", "Manche Vögel hatten zufällig etwas mehr Haut zwischen den Zehen. Sie schwammen besser, fanden mehr Nahrung und hatten mehr Junge, die diese Haut erbten."),
    lamarck: tx("The ancestors spread their toes again and again while swimming. The skin between them stretched, and this was passed on.", "Die Vorfahren spreizten beim Schwimmen immer wieder die Zehen. Die Haut dazwischen dehnte sich, und das wurde vererbt."),
    goal: tx("The birds needed webbed feet for swimming, so their young were born with them.", "Die Vögel brauchten Schwimmhäute zum Schwimmen, deshalb kamen ihre Jungen damit zur Welt."),
    strong: tx("The strongest ducks pushed the others out of the water and had the most young.", "Die stärksten Enten drängten die anderen aus dem Wasser und hatten die meisten Jungen."),
  },
  {
    id: "cavefish",
    ask: tx("Fish in dark caves are often blind and pale. How did that come about?", "Fische in dunklen Höhlen sind oft blind und blass. Wie kam es dazu?"),
    darwin: tx("Eye size varied by chance. In the dark, fish with smaller eyes were at no disadvantage and saved energy. They did as well or better and passed the trait on.", "Die Augengröße variierte zufällig. Im Dunkeln waren Fische mit kleineren Augen nicht im Nachteil und sparten Energie. Sie kamen genauso gut oder besser zurecht und vererbten das Merkmal."),
    lamarck: tx("The fish didn't use their eyes in the dark, so the eyes wasted away, and the young inherited the weak eyes.", "Die Fische benutzten ihre Augen im Dunkeln nicht, deshalb verkümmerten die Augen, und die Jungen erbten die schwachen Augen."),
    goal: tx("The fish knew they didn't need eyes in the cave and stopped making them.", "Die Fische wussten, dass sie in der Höhle keine Augen brauchen, und bildeten keine mehr."),
    strong: tx("The strongest fish ate the ones that could still see.", "Die stärksten Fische fraßen die, die noch sehen konnten."),
  },
  {
    id: "polarbear",
    ask: tx("Polar bears descend from brown bears. How did their white fur evolve?", "Eisbären stammen von Braunbären ab. Wie entstand ihr weißes Fell?"),
    darwin: tx("Among the ancestors, some bears were lighter by chance. On snow and ice they were better camouflaged, caught more seals and had more young.", "Unter den Vorfahren waren manche Bären zufällig heller. Auf Schnee und Eis waren sie besser getarnt, fingen mehr Robben und hatten mehr Junge."),
    lamarck: tx("The bears lived in the snow so long that their fur bleached, and the young inherited the light fur.", "Die Bären lebten so lange im Schnee, dass ihr Fell ausbleichte, und die Jungen erbten das helle Fell."),
    goal: tx("The bears wanted to be invisible on the ice and therefore turned white.", "Die Bären wollten auf dem Eis unsichtbar sein und wurden deshalb weiß."),
    strong: tx("The strongest bears happened to be white and fought off the brown ones.", "Die stärksten Bären waren zufällig weiß und haben die braunen vertrieben."),
  },
];

const TRAP_LAMARCK = {
  title: tx("That's Lamarck", "Das ist Lamarck"),
  say: tx(
    "That's Lamarck's idea: use and disuse plus inheritance of acquired traits. But what a body acquires during its life doesn't change the genetic information in its germ cells.",
    "Das ist Lamarcks Idee: Gebrauch und Nichtgebrauch plus Vererbung erworbener Eigenschaften. Was ein Körper im Leben erwirbt, verändert aber nicht die Erbinformation in den Keimzellen.",
  ),
};
const TRAP_GOAL = {
  title: tx("Evolution has no goal", "Evolution hat kein Ziel"),
  say: tx(
    "Needs and wishes don't change the genes. Evolution doesn't plan: variants arise by chance, and selection decides which ones become more common.",
    "Bedürfnisse und Wünsche verändern keine Gene. Evolution verfolgt keinen Plan: Varianten entstehen zufällig, und die Selektion entscheidet, welche häufiger werden.",
  ),
};
const TRAP_STRONG = {
  title: tx("Fittest = best adapted", "Fitteste = am besten angepasst"),
  say: tx(
    "Darwin's 'survival of the fittest' doesn't mean the strongest. It means the best adapted: those with the most surviving offspring.",
    "Darwins „Überleben der Tauglichsten“ meint nicht die Stärksten, sondern die am besten Angepassten: die mit den meisten überlebenden Nachkommen.",
  ),
};

function darwinTask(rng: Rng, ex = rng.pick(EXAMPLES)): Exercise {
  const { answer, mistakes: list } = choice(rng, [
    { text: ex.darwin },
    { text: ex.lamarck, ...TRAP_LAMARCK },
    { text: ex.goal, ...TRAP_GOAL },
    { text: ex.strong, ...TRAP_STRONG },
  ]);
  return {
    instruction: tx("Explain it like Darwin", "Erkläre es wie Darwin"),
    text: tx(`${en(ex.ask)} Which explanation fits **Darwin's** theory?`, `${de(ex.ask)} Welche Erklärung passt zur Theorie von **Darwin**?`),
    answer,
    hint: tx("Darwin: variation by chance, then selection of the best adapted, then inheritance.", "Darwin: zufällige Variation, dann Selektion der am besten Angepassten, dann Vererbung."),
    solution: [
      { math: tx('"variation"#a \\to "selection"#b \\to "inheritance"#c', '"Variation"#a \\to "Selektion"#b \\to "Vererbung"#c'), note: ex.darwin },
      { math: tx('\\strike{"inheritance of acquired traits"}#x', '\\strike{"Vererbung erworbener Eigenschaften"}#x'), note: tx("Use, disuse and needs don't change the genes, so they can't be inherited.", "Gebrauch, Nichtgebrauch und Bedürfnisse ändern keine Gene und können deshalb nicht vererbt werden.") },
    ],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Lamarck, Darwin, both or neither?

const WHO: Text[] = [tx("Lamarck", "Lamarck"), tx("Darwin", "Darwin"), tx("both", "beide"), tx("neither", "keiner von beiden")];
type Who = 0 | 1 | 2 | 3;

const SAYINGS: { text: Text; who: Who }[] = [
  { who: 0, text: tx("Organs that are used a lot become stronger; unused organs waste away.", "Organe, die viel gebraucht werden, werden kräftiger; ungenutzte verkümmern.") },
  { who: 0, text: tx("Traits acquired during life are passed on to the offspring.", "Im Leben erworbene Eigenschaften werden an die Nachkommen vererbt.") },
  { who: 0, text: tx("Living things have an inner drive to become more perfect.", "Lebewesen haben einen inneren Trieb zur Vervollkommnung.") },
  { who: 0, text: tx("A changed need leads to a changed use of the organs.", "Ein verändertes Bedürfnis führt zu einem veränderten Gebrauch der Organe.") },
  { who: 1, text: tx("Living things produce more offspring than can survive.", "Lebewesen bringen mehr Nachkommen hervor, als überleben können.") },
  { who: 1, text: tx("Individuals of a species differ in heritable traits.", "Individuen einer Art unterscheiden sich in erblichen Merkmalen.") },
  { who: 1, text: tx("Individuals compete for limited resources such as food.", "Individuen konkurrieren um begrenzte Ressourcen wie Nahrung.") },
  { who: 1, text: tx("The best adapted individuals leave the most offspring.", "Die am besten angepassten Individuen hinterlassen die meisten Nachkommen.") },
  { who: 1, text: tx("All living things descend from common ancestors.", "Alle Lebewesen stammen von gemeinsamen Vorfahren ab.") },
  { who: 2, text: tx("Species are not constant: they change over long periods of time.", "Arten sind nicht unveränderlich: Sie wandeln sich über lange Zeiträume.") },
  { who: 2, text: tx("The adaptedness of living things arose gradually over time.", "Die Angepasstheit der Lebewesen ist im Lauf der Zeit allmählich entstanden.") },
  { who: 3, text: tx("Every species was created separately and never changes.", "Jede Art wurde einzeln erschaffen und verändert sich nie.") },
  { who: 3, text: tx("Mutations in the DNA create new alleles.", "Mutationen in der DNA erzeugen neue Allele.") },
  { who: 3, text: tx("Genes are inherited according to Mendel's rules.", "Gene werden nach den mendelschen Regeln vererbt.") },
];

function whoTask(rng: Rng): Exercise {
  const s = rng.pick(SAYINGS);
  const why: Record<Who, Text> = {
    0: tx("Use and disuse, needs and an inner drive, inheritance of acquired traits: that's Lamarck (1809).", "Gebrauch und Nichtgebrauch, Bedürfnisse und innerer Trieb, Vererbung erworbener Eigenschaften: Das ist Lamarck (1809)."),
    1: tx("Overproduction, variation, competition, selection and common descent: that's Darwin (1859).", "Überproduktion, Variation, Konkurrenz, Selektion und gemeinsame Abstammung: Das ist Darwin (1859)."),
    2: tx("Both Lamarck and Darwin were sure that species change over time. They only explained it differently.", "Lamarck und Darwin waren sich einig, dass sich Arten im Lauf der Zeit verändern. Sie erklärten es nur unterschiedlich."),
    3: tx(
      "Neither of them: unchangeable species is the older view (e.g. Linnaeus, Cuvier); genes, alleles and mutations only came later with genetics.",
      "Keiner von beiden: Unveränderliche Arten sind die ältere Sicht (z. B. Linné, Cuvier); Gene, Allele und Mutationen kamen erst später mit der Genetik.",
    ),
  };
  const say: Record<Who, { title: Text; say: Text }> = {
    0: { title: tx("Not Lamarck", "Nicht Lamarck"), say: tx("Lamarck talked about use, needs and the inheritance of acquired traits. Is that what this sentence says?", "Lamarck sprach von Gebrauch, Bedürfnissen und der Vererbung erworbener Eigenschaften. Steht das in diesem Satz?") },
    1: { title: tx("Not Darwin", "Nicht Darwin"), say: tx("Darwin talked about variation, competition and selection. Is that what this sentence says?", "Darwin sprach von Variation, Konkurrenz und Selektion. Steht das in diesem Satz?") },
    2: {
      title: tx("Not both", "Nicht beide"),
      say:
        s.who === 3
          ? tx("Neither knew about genes or mutations, and both were sure that species change.", "Keiner von beiden kannte Gene oder Mutationen, und beide waren sicher, dass sich Arten verändern.")
          : tx("They agreed that species change, but here it's about how. That is where they differ.", "Einig waren sie sich, dass sich Arten verändern. Hier geht es aber um das Wie, und da unterscheiden sie sich."),
    },
    3: {
      title: tx("One of them did", "Einer von beiden schon"),
      say: tx("This idea is part of one of the two theories (or both). Think about use and needs versus variation and selection.", "Diese Idee gehört zu einer der beiden Theorien (oder zu beiden). Denk an Gebrauch und Bedürfnis gegenüber Variation und Selektion."),
    },
  };
  const { answer, mistakes: list } = category(WHO, s.who, { 0: say[0], 1: say[1], 2: say[2], 3: say[3] });
  return {
    instruction: tx("Lamarck or Darwin?", "Lamarck oder Darwin?"),
    text: tx(`Who held this view: **${en(s.text)}**`, `Wer vertrat diese Ansicht: **${de(s.text)}**`),
    answer,
    hint: tx("Lamarck: use, needs, inheritance of acquired traits. Darwin: variation, competition, selection.", "Lamarck: Gebrauch, Bedürfnis, Vererbung erworbener Eigenschaften. Darwin: Variation, Konkurrenz, Selektion."),
    solution: [{ math: q(WHO[s.who], "w"), note: why[s.who] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Darwin's steps in order

const DARWIN_STEPS: Text[][] = [
  [
    tx("Giraffes differ in neck length, and the differences are heritable.", "Giraffen unterscheiden sich in der Halslänge, und die Unterschiede sind erblich."),
    tx("More young are born than the food can feed: in dry seasons they compete for leaves.", "Es werden mehr Junge geboren, als das Futter ernähren kann: In Trockenzeiten konkurrieren sie um Blätter."),
    tx("Giraffes with longer necks reach more leaves and survive more often.", "Giraffen mit längerem Hals erreichen mehr Blätter und überleben häufiger."),
    tx("They have more young, who inherit the long neck.", "Sie haben mehr Junge, die den langen Hals erben."),
    tx("Over many generations the average neck length in the population increases.", "Über viele Generationen nimmt die mittlere Halslänge in der Population zu."),
  ],
  [
    tx("On a Galápagos island, ground finches differ in beak size.", "Auf einer Galápagosinsel unterscheiden sich Grundfinken in der Schnabelgröße."),
    tx("A drought: only large, hard seeds are left, and the finches compete for them.", "Eine Dürre: Nur noch große, harte Samen sind übrig, und die Finken konkurrieren darum."),
    tx("Finches with larger, stronger beaks crack these seeds and survive more often.", "Finken mit größeren, kräftigeren Schnäbeln knacken diese Samen und überleben häufiger."),
    tx("They have young, who inherit the larger beaks.", "Sie haben Junge, die die größeren Schnäbel erben."),
    tx("In the next generation the average beak is larger.", "In der nächsten Generation ist der Schnabel im Mittel größer."),
  ],
  [
    tx("Cheetahs differ in how fast they can run.", "Geparden unterscheiden sich darin, wie schnell sie laufen können."),
    tx("More cubs are born than there is prey for: they compete for food.", "Es werden mehr Junge geboren, als es Beute gibt: Sie konkurrieren um Nahrung."),
    tx("Faster cheetahs catch more prey and survive more often.", "Schnellere Geparden fangen mehr Beute und überleben häufiger."),
    tx("They raise more cubs, who inherit their speed.", "Sie ziehen mehr Junge auf, die ihre Schnelligkeit erben."),
    tx("Over many generations the population becomes faster.", "Über viele Generationen wird die Population schneller."),
  ],
  [
    tx("Brown bears in the far north differ in fur colour: some are lighter.", "Braunbären im hohen Norden unterscheiden sich in der Fellfarbe: Manche sind heller."),
    tx("Food is scarce on the ice: the bears compete for seals.", "Nahrung ist auf dem Eis knapp: Die Bären konkurrieren um Robben."),
    tx("Lighter bears are better camouflaged, catch more seals and survive more often.", "Hellere Bären sind besser getarnt, fangen mehr Robben und überleben häufiger."),
    tx("They have more cubs, who inherit the light fur.", "Sie haben mehr Junge, die das helle Fell erben."),
    tx("Over many generations white polar bears evolve.", "Über viele Generationen entstehen weiße Eisbären."),
  ],
];

function darwinOrderTask(rng: Rng): Exercise {
  const s = rng.pick(DARWIN_STEPS);
  const names = [tx("variation", "Variation"), tx("competition", "Konkurrenz"), tx("selection", "Selektion"), tx("inheritance", "Vererbung"), tx("change", "Artwandel")];
  return {
    instruction: tx("Put Darwin's steps in order", "Ordne Darwins Schritte"),
    text: tx("Explain the change with Darwin's theory: put the steps in the right order.", "Erkläre die Veränderung mit Darwins Theorie: Bring die Schritte in die richtige Reihenfolge."),
    answer: { kind: "order", items: s },
    hint: tx("Variation and competition come first; the change of the population is the result.", "Variation und Konkurrenz kommen zuerst; die Veränderung der Population ist das Ergebnis."),
    solution: [{ math: tx(names.map((n, i) => `"${en(n)}"#s${i}`).join(" \\to "), names.map((n, i) => `"${de(n)}"#s${i}`).join(" \\to ")), note: tx(s.map(en).join(" "), s.map(de).join(" ")) }],
    mistakes: [
      { when: { kind: "order", items: [s[3], s[2]] }, title: tx("Survive first", "Erst überleben"), say: tx("Only survivors can pass on their traits. Selection comes before inheritance.", "Nur Überlebende können ihre Merkmale weitergeben. Die Selektion kommt vor der Vererbung.") },
      { when: { kind: "order", items: [s[4], s[1]] }, title: tx("The change comes last", "Der Wandel kommt zuletzt"), say: tx("The change of the population is the result after many generations, not the start.", "Die Veränderung der Population ist das Ergebnis nach vielen Generationen, nicht der Anfang.") },
    ],
  };
}

// ---------------------------------------------------------------------------
// Factors of evolution

type Factor = "mutation" | "recombination" | "selection" | "drift" | "isolation";

const FACTOR: Record<Factor, Text> = {
  mutation: tx("mutation", "Mutation"),
  recombination: tx("recombination", "Rekombination"),
  selection: tx("selection", "Selektion"),
  drift: tx("genetic drift", "Gendrift"),
  isolation: tx("isolation", "Isolation"),
};

const FACTOR_CASES: { factor: Factor; text: Text }[] = [
  { factor: "mutation", text: tx("A copying error in the DNA creates a new allele for a different fur colour.", "Ein Kopierfehler in der DNA erzeugt ein neues Allel für eine andere Fellfarbe.") },
  { factor: "mutation", text: tx("UV radiation changes a gene in a germ cell of a mouse.", "UV-Strahlung verändert ein Gen in einer Keimzelle einer Maus.") },
  { factor: "recombination", text: tx("In meiosis and fertilisation the parents' alleles are newly combined: siblings look different.", "Bei Meiose und Befruchtung werden die Allele der Eltern neu kombiniert: Geschwister sehen verschieden aus.") },
  { factor: "recombination", text: tx("Crossing-over in meiosis creates new combinations of alleles on a chromosome.", "Crossing-over in der Meiose erzeugt neue Kombinationen von Allelen auf einem Chromosom.") },
  { factor: "selection", text: tx("Hawks catch slower mice more often, so faster mice leave more offspring.", "Greifvögel fangen langsamere Mäuse häufiger, deshalb hinterlassen schnellere Mäuse mehr Nachkommen.") },
  { factor: "selection", text: tx("Only resistant bacteria survive an antibiotic and multiply.", "Nur resistente Bakterien überleben ein Antibiotikum und vermehren sich.") },
  { factor: "drift", text: tx("A storm by chance kills mostly brown snails on a small island, regardless of how well adapted they are.", "Ein Sturm tötet auf einer kleinen Insel zufällig vor allem braune Schnecken, egal wie gut sie angepasst sind.") },
  { factor: "drift", text: tx("Around 1890 hunting reduced northern elephant seals to about 20 animals. Today's more than 200,000 seals are genetically very similar.", "Um 1890 hatte die Jagd die Nördlichen See-Elefanten auf etwa 20 Tiere reduziert. Die heute über 200.000 Tiere sind genetisch sehr ähnlich.") },
  { factor: "drift", text: tx("A few birds are blown to a remote island and found a population with only a small part of the gene pool.", "Einige Vögel werden auf eine abgelegene Insel verweht und gründen eine Population mit nur einem kleinen Teil des Genpools.") },
  { factor: "isolation", text: tx("A new river divides a population of beetles into two halves that can no longer meet.", "Ein neuer Fluss teilt eine Käferpopulation in zwei Hälften, die sich nicht mehr begegnen können.") },
  { factor: "isolation", text: tx("Two populations of crickets sing different songs, so females only mate with males of their own population.", "Zwei Grillenpopulationen singen unterschiedliche Lieder, deshalb paaren sich die Weibchen nur mit Männchen der eigenen Population.") },
];

function factorSay(right: Factor, picked: Factor): { title: Text; say: Text } {
  const key = `${right}>${picked}`;
  const special: Record<string, { title: Text; say: Text }> = {
    "drift>selection": { title: tx("Chance, not fitness", "Zufall, nicht Fitness"), say: tx("Here chance decided, not how well adapted the individuals were. A random change of allele frequencies is genetic drift.", "Hier hat der Zufall entschieden, nicht die Angepasstheit. Eine zufällige Änderung der Allelfrequenzen ist Gendrift.") },
    "selection>drift": { title: tx("An advantage decides", "Ein Vorteil entscheidet"), say: tx("It's not chance here: a certain trait gives a real advantage. That is selection.", "Hier ist es kein Zufall: Ein bestimmtes Merkmal bringt einen echten Vorteil. Das ist Selektion.") },
    "recombination>mutation": { title: tx("Nothing new, just shuffled", "Nichts Neues, nur gemischt"), say: tx("No new allele arises here. Existing alleles are only shuffled into new combinations.", "Hier entsteht kein neues Allel. Vorhandene Allele werden nur neu kombiniert.") },
    "mutation>recombination": { title: tx("Something new arises", "Etwas Neues entsteht"), say: tx("Here the genetic information itself changes: a new allele arises. Recombination only shuffles existing alleles.", "Hier ändert sich die Erbinformation selbst: Ein neues Allel entsteht. Rekombination mischt nur vorhandene Allele."), },
    "drift>isolation": { title: tx("Look at the chance sample", "Schau auf die Zufallsauswahl"), say: tx("There is isolation, true. But what changes the gene pool here is the small, random group of survivors or founders: drift.", "Isolation gibt es auch, stimmt. Den Genpool verändert hier aber die kleine, zufällige Gruppe der Überlebenden oder Gründer: Drift.") },
    "isolation>drift": { title: tx("A barrier separates", "Eine Barriere trennt"), say: tx("Here nothing random happens to the alleles. A barrier keeps the populations apart: no more gene flow.", "Hier passiert nichts Zufälliges mit den Allelen. Eine Barriere hält die Populationen getrennt: kein Genfluss mehr.") },
    "isolation>selection": { title: tx("Separated, not sorted out", "Getrennt, nicht aussortiert"), say: tx("Nobody is sorted out here. The populations are simply separated so that they can't exchange genes.", "Hier wird niemand aussortiert. Die Populationen werden nur getrennt und können keine Gene mehr austauschen.") },
  };
  if (special[key]) return special[key];
  if (picked === "mutation" || picked === "recombination")
    return { title: tx("That creates variation", "Das erzeugt Variation"), say: tx("Mutation and recombination create new variants. Here something else changes the gene pool.", "Mutation und Rekombination schaffen neue Varianten. Hier verändert etwas anderes den Genpool.") };
  if (right === "mutation" || right === "recombination")
    return { title: tx("Where does variation come from?", "Woher kommt die Variation?"), say: tx("Here new variants arise in the first place. Which factor creates variation?", "Hier entstehen überhaupt erst neue Varianten. Welcher Faktor erzeugt Variation?") };
  return { title: tx("Another factor", "Ein anderer Faktor"), say: tx("Look closely at what changes the gene pool here: an advantage, chance or a barrier?", "Schau genau hin, was hier den Genpool verändert: ein Vorteil, der Zufall oder eine Barriere?") };
}

function factorTask(rng: Rng): Exercise {
  const c = rng.pick(FACTOR_CASES);
  const others = rng.shuffle((Object.keys(FACTOR) as Factor[]).filter((f) => f !== c.factor)).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: FACTOR[c.factor] }, ...others.map((f) => ({ text: FACTOR[f], ...factorSay(c.factor, f) }))]);
  const what: Record<Factor, Text> = {
    mutation: tx("Mutation: the genetic information changes, a new allele arises. It is random and undirected.", "Mutation: Die Erbinformation verändert sich, ein neues Allel entsteht. Sie ist zufällig und ungerichtet."),
    recombination: tx("Recombination: existing alleles are combined anew in meiosis and fertilisation.", "Rekombination: Vorhandene Allele werden bei Meiose und Befruchtung neu kombiniert."),
    selection: tx("Selection: individuals with an advantageous trait leave more offspring. It changes allele frequencies in a directed way.", "Selektion: Individuen mit einem vorteilhaften Merkmal hinterlassen mehr Nachkommen. Sie verändert Allelfrequenzen gerichtet."),
    drift: tx("Genetic drift: chance changes the allele frequencies, especially in small populations (bottleneck or founder effect).", "Gendrift: Der Zufall verändert die Allelfrequenzen, vor allem in kleinen Populationen (Flaschenhals- oder Gründereffekt)."),
    isolation: tx("Isolation: a barrier stops the gene flow between populations.", "Isolation: Eine Barriere unterbricht den Genfluss zwischen Populationen."),
  };
  return {
    instruction: tx("Name the factor of evolution", "Nenne den Evolutionsfaktor"),
    text: tx(`Which factor of evolution is at work here? **${en(c.text)}**`, `Welcher Evolutionsfaktor wirkt hier? **${de(c.text)}**`),
    answer,
    hint: tx("Does something new arise, is it shuffled, does an advantage decide, does chance decide, or does a barrier separate?", "Entsteht etwas Neues, wird gemischt, entscheidet ein Vorteil, der Zufall oder trennt eine Barriere?"),
    solution: [{ math: q(FACTOR[c.factor], "f"), note: what[c.factor] }],
    mistakes: list,
  };
}

// Bottleneck or founder effect

const DRIFT_KINDS: Text[] = [tx("bottleneck effect", "Flaschenhalseffekt"), tx("founder effect", "Gründereffekt"), tx("natural selection", "natürliche Selektion")];
const DRIFT_CASES: { k: 0 | 1 | 2; text: Text }[] = [
  { k: 0, text: tx("Hunting reduced the northern elephant seals to about 20 animals. All of today's seals descend from them and are genetically very alike.", "Die Jagd hat die Nördlichen See-Elefanten auf etwa 20 Tiere reduziert. Alle heutigen Tiere stammen von ihnen ab und sind genetisch sehr ähnlich.") },
  { k: 0, text: tx("About 12,000 years ago only very few cheetahs survived. Today's cheetahs are almost genetically identical.", "Vor etwa 12.000 Jahren überlebten nur sehr wenige Geparden. Die heutigen Geparden sind genetisch fast gleich.") },
  { k: 0, text: tx("All of today's European bison descend from about a dozen zoo animals that survived after the wild bison were wiped out.", "Alle heutigen Wisente stammen von etwa einem Dutzend Zootieren ab, die überlebten, nachdem die wilden Wisente ausgerottet waren.") },
  { k: 1, text: tx("A few lizards drift on a tree trunk to an empty island and found a new population there.", "Einige Eidechsen treiben auf einem Baumstamm zu einer unbewohnten Insel und gründen dort eine neue Population.") },
  { k: 1, text: tx("The Amish in Pennsylvania descend from a few hundred settlers. A rare hereditary disease is far more common among them than elsewhere.", "Die Amischen in Pennsylvania stammen von wenigen Hundert Siedlern ab. Eine seltene Erbkrankheit ist bei ihnen viel häufiger als anderswo.") },
  { k: 1, text: tx("Fifteen settlers founded the population of the remote island of Tristan da Cunha. Today an inherited eye disease is unusually common there.", "Fünfzehn Siedler gründeten die Bevölkerung der abgelegenen Insel Tristan da Cunha. Heute ist dort eine erbliche Augenkrankheit ungewöhnlich häufig.") },
  { k: 2, text: tx("On an island, ground finches with larger beaks survive a drought more often because they can crack hard seeds.", "Auf einer Insel überleben Grundfinken mit größeren Schnäbeln eine Dürre häufiger, weil sie harte Samen knacken können.") },
];

function driftTask(rng: Rng): Exercise {
  const c = rng.pick(DRIFT_CASES);
  const { answer, mistakes: list } = category(DRIFT_KINDS, c.k, {
    0: { title: tx("Not a catastrophe", "Keine Katastrophe"), say: tx("A bottleneck means a population shrinks drastically and only a few survive. Is that what happened here?", "Flaschenhals heißt: Eine Population schrumpft drastisch, nur wenige überleben. Ist das hier passiert?") },
    1: { title: tx("Nobody founded anything new", "Hier wurde nichts neu gegründet"), say: tx("Founder effect means a few individuals settle somewhere new and start a population there. Is that what happened here?", "Gründereffekt heißt: Wenige Individuen besiedeln einen neuen Ort und gründen dort eine Population. Ist das hier passiert?") },
    2: { title: tx("Chance, not an advantage", "Zufall, kein Vorteil"), say: tx("Who survived or settled here was mostly a matter of chance, not of a better adapted trait.", "Wer hier überlebte oder ankam, war vor allem Zufall und keine Frage eines besser angepassten Merkmals.") },
  }, rng);
  const notes = [
    tx("A drastic shrinking of the population: only a few, randomly chosen individuals pass on their alleles. Bottleneck effect, a form of genetic drift.", "Die Population schrumpft drastisch: Nur wenige, zufällige Individuen geben ihre Allele weiter. Flaschenhalseffekt, eine Form der Gendrift."),
    tx("A few individuals found a new population: it gets only a small, random part of the gene pool. Founder effect, a form of genetic drift.", "Wenige Individuen gründen eine neue Population: Sie bekommt nur einen kleinen, zufälligen Teil des Genpools. Gründereffekt, eine Form der Gendrift."),
    tx("Here a trait brings a real advantage: that is natural selection, not drift.", "Hier bringt ein Merkmal einen echten Vorteil: Das ist natürliche Selektion, keine Drift."),
  ];
  return {
    instruction: tx("Bottleneck or founder effect?", "Flaschenhals oder Gründereffekt?"),
    text: c.text,
    answer,
    hint: tx("Did a population shrink, did a few individuals start a new one, or did an advantage decide?", "Ist eine Population geschrumpft, haben wenige eine neue gegründet, oder hat ein Vorteil entschieden?"),
    solution: [{ math: q(DRIFT_KINDS[c.k], "k"), note: notes[c.k] }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Isolation mechanisms

type Iso = "geo" | "eco" | "time" | "mech" | "behav";

const ISO: Record<Iso, Text> = {
  geo: tx("geographic isolation", "geografische Isolation"),
  eco: tx("ecological isolation", "ökologische Isolation"),
  time: tx("temporal isolation", "zeitliche Isolation"),
  mech: tx("mechanical isolation", "mechanische Isolation"),
  behav: tx("behavioural isolation", "ethologische Isolation"),
};

const ISO_CASES: { iso: Iso; text: Text }[] = [
  { iso: "geo", text: tx("A mountain range separates two salamander populations.", "Ein Gebirge trennt zwei Salamanderpopulationen.") },
  { iso: "geo", text: tx("The Grand Canyon separates the squirrels on its north and south rims.", "Der Grand Canyon trennt die Hörnchen am Nord- und am Südrand.") },
  { iso: "geo", text: tx("Rising sea level turns a peninsula into an island and cuts off its lizards.", "Steigender Meeresspiegel macht eine Halbinsel zur Insel und schneidet ihre Eidechsen ab.") },
  { iso: "eco", text: tx("In India, lions used to live in open grassland and tigers in dense forest.", "In Indien lebten Löwen in offenem Grasland, Tiger im dichten Wald.") },
  { iso: "eco", text: tx("In the same lake, one fish population lives near the bottom, another in open water.", "Im selben See lebt eine Fischpopulation am Grund, eine andere im offenen Wasser.") },
  { iso: "time", text: tx("Two related frog species spawn at different times of the year.", "Zwei verwandte Froscharten laichen zu verschiedenen Jahreszeiten.") },
  { iso: "time", text: tx("Two related pine species release their pollen in different months.", "Zwei verwandte Kiefernarten geben ihren Pollen in verschiedenen Monaten ab.") },
  { iso: "mech", text: tx("The mating organs of two insect species don't fit together, like a key in the wrong lock.", "Die Begattungsorgane zweier Insektenarten passen nicht zusammen, wie ein Schlüssel im falschen Schloss.") },
  { iso: "mech", text: tx("The flowers of two sage species fit only pollinators of a certain size.", "Die Blüten zweier Salbeiarten passen nur zu Bestäubern einer bestimmten Größe.") },
  { iso: "behav", text: tx("Two firefly species flash different light signals; females only answer their own species.", "Zwei Glühwürmchenarten senden unterschiedliche Lichtsignale; Weibchen antworten nur der eigenen Art.") },
  { iso: "behav", text: tx("Chiffchaff and willow warbler look almost the same but sing completely different songs.", "Zilpzalp und Fitis sehen fast gleich aus, singen aber völlig verschiedene Lieder.") },
];

const ISO_TRAPS: Partial<Record<string, { title: Text; say: Text }>> = {
  "eco>geo": { title: tx("Same area, different habitat", "Gleiches Gebiet, anderer Lebensraum"), say: tx("No mountain or sea separates them: they live in the same area, but in different habitats. That's ecological isolation.", "Kein Gebirge und kein Meer trennt sie: Sie leben im selben Gebiet, aber in verschiedenen Lebensräumen. Das ist ökologische Isolation.") },
  "geo>eco": { title: tx("A real barrier", "Eine echte Barriere"), say: tx("Here a physical barrier separates the populations in space. That's geographic isolation.", "Hier trennt eine räumliche Barriere die Populationen. Das ist geografische Isolation.") },
  "time>behav": { title: tx("A matter of timing", "Eine Frage der Zeit"), say: tx("Their behaviour may fit, but they are ready to reproduce at different times. That's temporal isolation.", "Das Verhalten könnte passen, aber sie sind zu verschiedenen Zeiten fortpflanzungsbereit. Das ist zeitliche Isolation.") },
  "behav>mech": { title: tx("Signals, not body parts", "Signale, keine Körperteile"), say: tx("Nothing physical fails to fit here. The signals (song, light, courtship) don't match: behavioural isolation.", "Hier passt nichts Körperliches nicht. Die Signale (Gesang, Licht, Balz) passen nicht: ethologische Isolation.") },
  "mech>behav": { title: tx("Body parts, not signals", "Körperteile, keine Signale"), say: tx("The behaviour isn't the problem: the body parts (mating organs or flowers) don't fit together. That's mechanical isolation.", "Das Verhalten ist nicht das Problem: Die Körperteile (Begattungsorgane oder Blüten) passen nicht zusammen. Das ist mechanische Isolation.") },
};

const isoSay = (right: Iso, picked: Iso) =>
  ISO_TRAPS[`${right}>${picked}`] ?? {
    title: tx("Another barrier", "Eine andere Barriere"),
    say: tx(`${en(ISO[picked]).replace(/^./, (c) => c.toUpperCase())} doesn't fit here. What exactly keeps these populations from interbreeding?`, `${de(ISO[picked]).replace(/^./, (c) => c.toUpperCase())} passt hier nicht. Was genau verhindert, dass sich diese Populationen kreuzen?`),
  };

function isoChoiceTask(rng: Rng): Exercise {
  const c = rng.pick(ISO_CASES);
  const others = rng.shuffle((Object.keys(ISO) as Iso[]).filter((i) => i !== c.iso)).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: ISO[c.iso] }, ...others.map((o) => ({ text: ISO[o], ...isoSay(c.iso, o) }))]);
  return {
    instruction: tx("Name the isolation mechanism", "Nenne den Isolationsmechanismus"),
    text: tx(`Which kind of isolation keeps the populations apart? **${en(c.text)}**`, `Welche Art von Isolation hält die Populationen getrennt? **${de(c.text)}**`),
    answer,
    hint: tx("Space, habitat, time, body parts or behaviour: what separates them?", "Raum, Lebensraum, Zeit, Körperteile oder Verhalten: Was trennt sie?"),
    solution: [{ math: q(ISO[c.iso], "i"), note: c.text }],
    mistakes: list,
  };
}

function isoMatchTask(rng: Rng, fixed?: { iso: Iso; text: Text }[]): Exercise {
  const picked =
    fixed ??
    rng
      .shuffle(Object.keys(ISO) as Iso[])
      .slice(0, 4)
      .map((iso) => rng.pick(ISO_CASES.filter((c) => c.iso === iso)));
  const pairs = picked.map((c) => [c.text, ISO[c.iso]] as [Text, Text]);
  const m: Mistake[] = [];
  for (const c of picked)
    for (const d of picked) {
      const trap = ISO_TRAPS[`${c.iso}>${d.iso}`];
      if (trap && m.length < 3) m.push({ when: { kind: "match", pairs: [[c.text, ISO[d.iso]]] }, ...trap });
    }
  return {
    instruction: tx("Match the isolation mechanisms", "Ordne die Isolationsmechanismen zu"),
    text: tx("Which kind of isolation keeps the populations apart?", "Welche Art von Isolation hält die Populationen jeweils getrennt?"),
    answer: { kind: "match", pairs },
    hint: tx("Space, habitat, time, body parts or behaviour: what separates them?", "Raum, Lebensraum, Zeit, Körperteile oder Verhalten: Was trennt sie?"),
    solution: [{ math: tx(picked.map((c, i) => `"${en(ISO[c.iso])}"#i${i}`).join(" \\\\ "), picked.map((c, i) => `"${de(ISO[c.iso])}"#i${i}`).join(" \\\\ ")), note: tx(picked.map((c) => `${en(c.text)} → ${en(ISO[c.iso])}.`).join(" "), picked.map((c) => `${de(c.text)} → ${de(ISO[c.iso])}.`).join(" ")) }],
    mistakes: m,
  };
}

// ---------------------------------------------------------------------------
// The biological species concept

type Pair = { a: Text; b: Text; same: boolean; alike: boolean; young: Text; note: Text };

const PAIRS: Pair[] = [
  { a: tx("a horse", "Pferd"), b: tx("a donkey", "Esel"), same: false, alike: true, young: tx("a mule, which is infertile", "ein Maultier, das unfruchtbar ist"), note: tx("Mules are infertile, so horse and donkey are separate species.", "Maultiere sind unfruchtbar, also sind Pferd und Esel getrennte Arten.") },
  { a: tx("a horse", "Pferd"), b: tx("a zebra", "Zebra"), same: false, alike: true, young: tx("a zebroid, which is infertile", "ein Zebroid, das unfruchtbar ist"), note: tx("Zebroids are infertile, so horses and zebras are separate species.", "Zebroide sind unfruchtbar, also sind Pferd und Zebra getrennte Arten.") },
  { a: tx("a donkey", "Esel"), b: tx("a zebra", "Zebra"), same: false, alike: false, young: tx("a zonkey, which is infertile", "ein Zesel, der unfruchtbar ist"), note: tx("Zonkeys are infertile, so donkeys and zebras are separate species.", "Zesel sind unfruchtbar, also sind Esel und Zebra getrennte Arten.") },
  { a: tx("a dachshund", "Dackel"), b: tx("a Great Dane", "Deutsche Dogge"), same: true, alike: false, young: tx("puppies that are fertile", "Welpen, die fruchtbar sind"), note: tx("However different they look, all dog breeds belong to one species.", "So verschieden sie aussehen: Alle Hunderassen gehören zu einer Art.") },
  { a: tx("a wolf", "Wolf"), b: tx("a domestic dog", "Haushund"), same: true, alike: true, young: tx("pups that are fertile", "Welpen, die fruchtbar sind"), note: tx("Their young are fertile: by the biological species concept, the domestic dog belongs to the species of the wolf.", "Ihre Jungen sind fruchtbar: Nach dem biologischen Artbegriff gehört der Haushund zur Art Wolf.") },
  { a: tx("people from Africa", "Menschen aus Afrika"), b: tx("people from Europe", "Menschen aus Europa"), same: true, alike: false, young: tx("children who are fertile", "Kinder, die fruchtbar sind"), note: tx("All humans living today belong to one species: Homo sapiens.", "Alle heute lebenden Menschen gehören zu einer Art: Homo sapiens.") },
];

function speciesTask(rng: Rng): Exercise {
  const p = rng.pick(PAIRS);
  const opts: Opt[] = p.same
    ? [
        { text: tx("Yes: their offspring are fertile.", "Ja: Ihre Nachkommen sind fruchtbar.") },
        { text: tx("No: they look far too different.", "Nein: Sie sehen viel zu verschieden aus."), title: tx("Looks don't decide", "Das Aussehen entscheidet nicht"), say: tx("Looks can deceive. By the biological species concept, what counts is fertile offspring.", "Das Aussehen kann täuschen. Nach dem biologischen Artbegriff zählen fruchtbare Nachkommen.") },
        { text: tx("No: their offspring are infertile.", "Nein: Ihre Nachkommen sind unfruchtbar."), title: tx("Check the offspring", "Prüf die Nachkommen"), say: tx(`Their offspring are ${en(p.young)}. Read the text again.`, `Ihre Nachkommen sind ${de(p.young)}. Lies den Text noch mal.`) },
        { text: tx("You can't decide that without a DNA test.", "Ohne DNA-Test kann man das nicht entscheiden."), title: tx("You can decide", "Man kann es entscheiden"), say: tx("The biological species concept only asks: do they produce fertile offspring together in nature?", "Der biologische Artbegriff fragt nur: Bekommen sie in der Natur gemeinsam fruchtbare Nachkommen?") },
      ]
    : [
        { text: tx("No: their offspring are infertile.", "Nein: Ihre Nachkommen sind unfruchtbar.") },
        { text: tx("Yes: they can mate and have young together.", "Ja: Sie können sich paaren und gemeinsam Junge bekommen."), title: tx("The young must be fertile", "Die Jungen müssen fruchtbar sein"), say: tx("Having young isn't enough: the young must be fertile too. A mule can't have young of its own.", "Junge zu bekommen reicht nicht: Die Jungen müssen auch fruchtbar sein. Ein Maultier kann selbst keine Jungen bekommen.") },
        p.alike
          ? { text: tx("Yes: they look very much alike.", "Ja: Sie sehen sich sehr ähnlich."), title: tx("Looks don't decide", "Das Aussehen entscheidet nicht"), say: tx("Similar looks don't make a species. By the biological species concept, what counts is fertile offspring.", "Ähnliches Aussehen macht noch keine Art. Nach dem biologischen Artbegriff zählen fruchtbare Nachkommen.") }
          : { text: tx("No: they look too different.", "Nein: Sie sehen zu verschieden aus."), title: tx("Right answer, wrong reason", "Richtige Antwort, falscher Grund"), say: tx("Looks aren't the criterion: dog breeds look very different and are still one species. What decides is whether the offspring are fertile.", "Das Aussehen ist nicht das Kriterium: Hunderassen sehen sehr verschieden aus und sind trotzdem eine Art. Entscheidend ist, ob die Nachkommen fruchtbar sind.") },
        { text: tx("Yes: they are both mammals.", "Ja: Beide sind Säugetiere."), title: tx("Far too broad", "Viel zu weit gefasst"), say: tx("Mice and whales are mammals too. A species is far narrower than a class like mammals.", "Mäuse und Wale sind auch Säugetiere. Eine Art ist viel enger gefasst als eine Klasse wie die Säugetiere.") },
      ];
  const { answer, mistakes: list } = choice(rng, opts);
  return {
    instruction: tx("Same species?", "Gleiche Art?"),
    text: tx(`${en(p.a).replace(/^./, (c) => c.toUpperCase())} and ${en(p.b)} can have offspring together: ${en(p.young)}. Do they belong to the same species?`, `${de(p.a)} und ${de(p.b)} können gemeinsam Nachkommen bekommen: ${de(p.young)}. Gehören sie zur selben Art?`),
    answer,
    hint: tx("Biological species concept: individuals that interbreed in nature and produce fertile offspring.", "Biologischer Artbegriff: Individuen, die sich in der Natur kreuzen und fruchtbare Nachkommen bekommen."),
    solution: [{ math: join(q(p.a, "a"), "+", q(p.b, "b"), "\\to", p.same ? q(tx("fertile", "fruchtbar"), "f") : tx('\\strike{"fertile"}#f', '\\strike{"fruchtbar"}#f')), note: p.note }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Evidence for evolution

type Ev = "homology" | "analogy" | "rudiment" | "atavism" | "embryo" | "fossil";

const EV: Record<Ev, Text> = {
  homology: tx("homologous organs", "homologe Organe"),
  analogy: tx("analogous organs", "analoge Organe"),
  rudiment: tx("rudimentary organ", "rudimentäres Organ"),
  atavism: tx("atavism", "Atavismus"),
  embryo: tx("embryonic development", "Embryonalentwicklung"),
  fossil: tx("transitional fossil", "fossile Übergangsform"),
};

const EV_CASES: { ev: Ev; text: Text }[] = [
  { ev: "homology", text: tx("The arm of a human and the wing of a bat are made of the same bones.", "Arm des Menschen und Flügel der Fledermaus bestehen aus denselben Knochen.") },
  { ev: "homology", text: tx("The flipper of a whale and the front leg of a horse are built from the same bones.", "Die Flosse des Wals und das Vorderbein des Pferdes sind aus denselben Knochen aufgebaut.") },
  { ev: "homology", text: tx("The spines of a cactus and the thorns of a barberry are both modified leaves.", "Die Dornen des Kaktus und die Dornen der Berberitze sind beide umgewandelte Blätter.") },
  { ev: "analogy", text: tx("The wings of a butterfly and of a bird both serve for flying but are built completely differently.", "Die Flügel von Schmetterling und Vogel dienen beide dem Fliegen, sind aber völlig verschieden gebaut.") },
  { ev: "analogy", text: tx("The digging legs of a mole and of a mole cricket look alike, although one is a mammal and the other an insect.", "Die Grabbeine von Maulwurf und Maulwurfsgrille sehen ähnlich aus, obwohl das eine ein Säugetier und das andere ein Insekt ist.") },
  { ev: "analogy", text: tx("Sharks and dolphins both have a streamlined body shape.", "Haie und Delfine haben beide einen stromlinienförmigen Körper.") },
  { ev: "rudiment", text: tx("Humans have a small tailbone at the end of the spine.", "Der Mensch hat am Ende der Wirbelsäule ein kleines Steißbein.") },
  { ev: "rudiment", text: tx("Whales have small pelvic bones inside their body, although they have no hind legs.", "Wale haben kleine Beckenknochen im Körper, obwohl sie keine Hinterbeine haben.") },
  { ev: "rudiment", text: tx("Humans have ear muscles, but most people can hardly move their ears.", "Menschen haben Ohrmuskeln, doch die meisten können ihre Ohren kaum bewegen.") },
  { ev: "atavism", text: tx("Very rarely, a baby is born with a short, tail-like appendage.", "Sehr selten kommt ein Baby mit einem kurzen, schwanzartigen Anhang zur Welt.") },
  { ev: "atavism", text: tx("Some people have extra nipples along the milk line.", "Manche Menschen haben zusätzliche Brustwarzen entlang der Milchleiste.") },
  { ev: "atavism", text: tx("Now and then a horse is born with small extra toes.", "Ab und zu kommt ein Pferd mit kleinen zusätzlichen Zehen zur Welt.") },
  { ev: "embryo", text: tx("Early human embryos have pharyngeal arches, like the gill arches of fish embryos.", "Frühe menschliche Embryonen haben Schlundbögen, wie die Kiemenbögen von Fischembryonen.") },
  { ev: "embryo", text: tx("Early embryos of fish, chickens and humans look very similar.", "Frühe Embryonen von Fisch, Huhn und Mensch sehen sich sehr ähnlich.") },
  { ev: "fossil", text: tx("Archaeopteryx has feathers, but also teeth and a long bony tail.", "Archaeopteryx hat Federn, aber auch Zähne und einen langen Knochenschwanz.") },
  { ev: "fossil", text: tx("Tiktaalik, a fish with sturdy fins, lungs and a neck, lived 375 million years ago.", "Tiktaalik, ein Fisch mit kräftigen Flossen, Lungen und einem Hals, lebte vor 375 Millionen Jahren.") },
];

const EV_TRAPS: Partial<Record<string, { title: Text; say: Text }>> = {
  "homology>analogy": { title: tx("Same plan, not just same job", "Gleicher Bauplan, nicht nur gleiche Aufgabe"), say: tx("Analogous organs only share a job. Here the basic plan is the same, a sign of common descent: homologous.", "Analoge Organe haben nur dieselbe Aufgabe. Hier ist der Grundbauplan gleich, ein Zeichen gemeinsamer Abstammung: homolog.") },
  "analogy>homology": { title: tx("Same job, different plan", "Gleiche Aufgabe, anderer Bauplan"), say: tx("They do the same job, but they are built differently and evolved independently. That's analogy, not homology.", "Sie erfüllen dieselbe Aufgabe, sind aber verschieden gebaut und unabhängig entstanden. Das ist Analogie, keine Homologie.") },
  "rudiment>atavism": { title: tx("Everyone has it", "Jeder hat es"), say: tx("An atavism only appears in a few individuals. This organ is present in all of them, just reduced: rudimentary.", "Ein Atavismus tritt nur bei einzelnen Individuen auf. Dieses Organ haben alle, nur zurückgebildet: rudimentär.") },
  "atavism>rudiment": { title: tx("Only in single individuals", "Nur bei Einzelnen"), say: tx("A rudimentary organ is present in all individuals. This trait pops up only now and then, an ancestral trait reappearing: an atavism.", "Ein rudimentäres Organ haben alle Individuen. Dieses Merkmal taucht nur ab und zu auf, ein Merkmal der Vorfahren kehrt zurück: ein Atavismus.") },
};

const evSay = (right: Ev, picked: Ev) =>
  EV_TRAPS[`${right}>${picked}`] ?? {
    title: tx("Another kind of evidence", "Ein anderer Beleg"),
    say: tx(`Think about what is compared here: adult organs, embryos, single unusual individuals or fossils? ${en(EV[picked]).replace(/^./, (c) => c.toUpperCase())} doesn't fit.`, `Überleg, was hier verglichen wird: Organe erwachsener Tiere, Embryonen, einzelne Ausnahmefälle oder Fossilien? ${de(EV[picked]).replace(/^./, (c) => c.toUpperCase())} passt nicht.`),
  };

const EV_WHAT: Record<Ev, Text> = {
  homology: tx("Homologous organs have the same basic plan, even if they do different jobs. They point to a common ancestor.", "Homologe Organe haben denselben Grundbauplan, auch wenn sie verschiedene Aufgaben haben. Sie weisen auf gemeinsame Vorfahren hin."),
  analogy: tx("Analogous organs do the same job but are built differently. They evolved independently under similar selection pressures (convergence).", "Analoge Organe haben dieselbe Aufgabe, sind aber verschieden gebaut. Sie entstanden unabhängig unter ähnlichem Selektionsdruck (Konvergenz)."),
  rudiment: tx("Rudimentary organs are reduced remains of organs that worked in the ancestors. All individuals have them.", "Rudimentäre Organe sind zurückgebildete Reste von Organen, die bei den Vorfahren funktionierten. Alle Individuen haben sie."),
  atavism: tx("Atavisms are ancestral traits that reappear in single individuals.", "Atavismen sind Merkmale der Vorfahren, die bei einzelnen Individuen wieder auftreten."),
  embryo: tx("Similar stages in embryonic development point to common ancestors.", "Ähnliche Stadien in der Embryonalentwicklung weisen auf gemeinsame Vorfahren hin."),
  fossil: tx("Transitional forms combine features of two groups and show intermediate steps of evolution.", "Übergangsformen vereinen Merkmale zweier Gruppen und zeigen Zwischenschritte der Evolution."),
};

function evidenceTask(rng: Rng): Exercise {
  const c = rng.pick(EV_CASES);
  const pool = (Object.keys(EV) as Ev[]).filter((e) => e !== c.ev);
  const trap: Ev | null = c.ev === "homology" ? "analogy" : c.ev === "analogy" ? "homology" : c.ev === "rudiment" ? "atavism" : c.ev === "atavism" ? "rudiment" : null;
  const others = trap ? [trap, ...rng.shuffle(pool.filter((e) => e !== trap)).slice(0, 2)] : rng.shuffle(pool).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: EV[c.ev] }, ...others.map((o) => ({ text: EV[o], ...evSay(c.ev, o) }))]);
  return {
    instruction: tx("Which evidence for evolution?", "Welcher Beleg für die Evolution?"),
    text: tx(`What kind of evidence for evolution is this? **${en(c.text)}**`, `Um welchen Beleg für die Evolution handelt es sich? **${de(c.text)}**`),
    answer,
    hint: tx("Same plan or only the same job? Present in everyone or only in a few? Embryo or fossil?", "Gleicher Bauplan oder nur gleiche Aufgabe? Bei allen vorhanden oder nur bei Einzelnen? Embryo oder Fossil?"),
    solution: [{ math: q(EV[c.ev], "e"), note: EV_WHAT[c.ev] }],
    mistakes: list,
  };
}

const ORGAN_PAIRS: { text: Text; homologous: boolean; job?: string }[] = [
  { text: tx("arm of a human and wing of a bat", "Arm des Menschen und Flügel der Fledermaus"), homologous: true },
  { text: tx("flipper of a whale and front leg of a horse", "Flosse des Wals und Vorderbein des Pferdes"), homologous: true },
  { text: tx("wing of a bird and arm of a human", "Flügel des Vogels und Arm des Menschen"), homologous: true },
  { text: tx("spines of a cactus and thorns of a barberry", "Dornen des Kaktus und Dornen der Berberitze"), homologous: true },
  { text: tx("hand of a human and paw of a cat", "Hand des Menschen und Pfote der Katze"), homologous: true },
  { text: tx("wing of a butterfly and wing of a bird", "Flügel des Schmetterlings und Flügel des Vogels"), homologous: false, job: "fly" },
  { text: tx("digging hand of a mole and digging leg of a mole cricket", "Grabhand des Maulwurfs und Grabbein der Maulwurfsgrille"), homologous: false, job: "dig" },
  { text: tx("body shape of a shark and of a dolphin", "Körperform von Hai und Delfin"), homologous: false, job: "swim" },
  { text: tx("eye of a human and eye of an octopus", "Auge des Menschen und Auge des Kraken"), homologous: false, job: "see" },
  { text: tx("prickles of a rose and spines of a cactus", "Stacheln der Rose und Dornen des Kaktus"), homologous: false, job: "protect" },
  { text: tx("tendril of a pea (a leaf) and tendril of a grapevine (a shoot)", "Ranke der Erbse (ein Blatt) und Ranke der Weinrebe (ein Spross)"), homologous: false, job: "climb" },
];

function homologyMultiTask(rng: Rng): Exercise {
  const hom = rng.shuffle(ORGAN_PAIRS.filter((p) => p.homologous)).slice(0, rng.int(2, 3));
  const ana = rng.shuffle(ORGAN_PAIRS.filter((p) => !p.homologous)).slice(0, rng.int(2, 3));
  const picked = rng.shuffle([...hom, ...ana]);
  const options = picked.map((p) => p.text);
  const correct = indicesOf(picked, (p) => p.homologous);
  const answer: AnswerSpec = { kind: "multi", options, correct };
  const m = mistakes(answer);
  m.add({ kind: "multi", options, correct: indicesOf(picked, (p) => !p.homologous) }, tx("Swapped", "Vertauscht"), tx("You picked the analogous pairs: same job, different build. Homologous means the same basic plan.", "Du hast die analogen Paare gewählt: gleiche Aufgabe, anderer Bauplan. Homolog heißt gleicher Grundbauplan."));
  m.add({ kind: "multi", options, correct: picked.map((_, i) => i) }, tx("Not all", "Nicht alle"), tx("Not every similar pair is homologous. Check for each: same basic plan, or only the same job?", "Nicht jedes ähnliche Paar ist homolog. Prüf bei jedem: gleicher Grundbauplan oder nur gleiche Aufgabe?"));
  const fly = picked.findIndex((p) => p.job === "fly");
  if (fly >= 0) m.add({ kind: "multi", options, correct: [...correct, fly].sort((a, b) => a - b) }, tx("Same job, different build", "Gleiche Aufgabe, anderer Bau"), tx("Butterfly and bird wings both fly, but an insect wing has no bones at all. Same job alone means analogous.", "Schmetterlings- und Vogelflügel fliegen beide, aber ein Insektenflügel hat gar keine Knochen. Nur gleiche Aufgabe heißt analog."));
  const prot = picked.findIndex((p) => p.job === "protect");
  if (prot >= 0) m.add({ kind: "multi", options, correct: [...correct, prot].sort((a, b) => a - b) }, tx("Prickles aren't leaves", "Stacheln sind keine Blätter"), tx("Cactus spines are modified leaves, but rose prickles grow out of the skin of the stem. Same job, different origin: analogous.", "Kaktusdornen sind umgewandelte Blätter, Rosenstacheln wachsen aber aus der Haut des Sprosses. Gleiche Aufgabe, anderer Ursprung: analog."));
  return {
    instruction: tx("Select all that apply", "Wähle alle passenden aus"),
    text: tx("Which of these pairs are **homologous**?", "Welche dieser Paare sind **homolog**?"),
    answer,
    hint: tx("Homologous: same basic plan from a common ancestor, even if the job differs.", "Homolog: gleicher Grundbauplan von gemeinsamen Vorfahren, auch wenn die Aufgabe verschieden ist."),
    solution: [
      { math: tx('"homologous"#h = "same basic plan"#p', '"homolog"#h = "gleicher Grundbauplan"#p'), note: tx("Homologous organs go back to the same organ in a common ancestor.", "Homologe Organe gehen auf dasselbe Organ eines gemeinsamen Vorfahren zurück.") },
      { math: tx(correct.map((i, j) => `"${en(options[i])}"#c${j}`).join(" \\\\ "), correct.map((i, j) => `"${de(options[i])}"#c${j}`).join(" \\\\ ")), note: tx("These pairs share a basic plan. The others only do the same job: analogous.", "Diese Paare haben einen gemeinsamen Grundbauplan. Die anderen haben nur dieselbe Aufgabe: analog.") },
    ],
    mistakes: m.list,
  };
}

// Homologous bones in the forelimb drawing

const BONES: { id: string; name: Text; where: Text }[] = [
  { id: "humerus", name: tx("upper arm bone (humerus)", "Oberarmknochen"), where: tx("one single bone next to the body", "ein einzelner Knochen nahe am Körper") },
  { id: "forearm", name: tx("radius and ulna", "Elle und Speiche"), where: tx("two bones side by side below the elbow", "zwei Knochen nebeneinander unterhalb des Ellenbogens") },
  { id: "carpals", name: tx("wrist bones (carpals)", "Handwurzelknochen"), where: tx("a group of small, roundish bones", "eine Gruppe kleiner, rundlicher Knochen") },
  { id: "metacarpals", name: tx("metacarpals", "Mittelhandknochen"), where: tx("the long bones of the palm, one per finger", "die langen Knochen der Mittelhand, einer pro Finger") },
  { id: "phalanges", name: tx("finger bones (phalanges)", "Fingerknochen"), where: tx("the small bones in a row at the tips", "die kleinen Knochen in einer Reihe an den Spitzen") },
];

function boneTask(rng: Rng): Exercise {
  const at = rng.int(0, BONES.length - 1);
  const b = BONES[at];
  const near = [BONES[at - 1], BONES[at + 1]].filter(Boolean);
  const far = rng.shuffle(BONES.filter((x) => x !== b && !near.includes(x)));
  const others = [...near, ...far].slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [
    { text: b.name },
    ...others.map((o) => ({
      text: o.name,
      title: near.includes(o) ? tx("The neighbour", "Der Nachbar") : tx("Another bone", "Ein anderer Knochen"),
      say: tx(`The ${en(o.name)}: ${en(o.where)}. The question mark points somewhere else.`, `${de(o.name)}: ${de(o.where)}. Das Fragezeichen zeigt woanders hin.`),
    })),
  ]);
  return {
    instruction: tx("Name the homologous bone", "Benenne den homologen Knochen"),
    text: tx("Same colour means the same bone in all four animals. Which bone is marked with **?**", "Gleiche Farbe heißt: derselbe Knochen bei allen vier Tieren. Welcher Knochen ist mit **?** markiert?"),
    visual: visual(EvolutionForelimbs, { mode: "numbers", ask: b.id, show: [b.id], legend: "none", highlight: [b.id] }),
    answer,
    hint: tx("Go from the shoulder to the tips: upper arm, forearm, wrist, palm, fingers.", "Geh von der Schulter zu den Spitzen: Oberarm, Unterarm, Handwurzel, Mittelhand, Finger."),
    solution: [{ math: q(b.name, "b"), note: tx(`${en(b.name).replace(/^./, (c) => c.toUpperCase())}: ${en(b.where)}. Human, bat, whale and horse all have it: homologous organs.`, `${de(b.name)}: ${de(b.where)}. Mensch, Fledermaus, Wal und Pferd haben ihn alle: homologe Organe.`) }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Human evolution

const HOMININS: Text[] = [
  tx("Australopithecus (upright walk, small brain)", "Australopithecus (aufrechter Gang, kleines Gehirn)"),
  tx("Homo habilis (first stone tools)", "Homo habilis (erste Steinwerkzeuge)"),
  tx("Homo erectus (uses fire, leaves Africa)", "Homo erectus (nutzt Feuer, verlässt Afrika)"),
  tx("Homo sapiens (modern humans)", "Homo sapiens (moderner Mensch)"),
];
const HOMININ_AGE: Text[] = [tx("about 4 to 2 million years ago", "vor etwa 4 bis 2 Mio. Jahren"), tx("from about 2.5 million years ago", "ab etwa 2,5 Mio. Jahren"), tx("from about 1.9 million years ago", "ab etwa 1,9 Mio. Jahren"), tx("from about 300,000 years ago", "ab etwa 300.000 Jahren")];

function humanOrderTask(rng: Rng): Exercise {
  const drop = rng.int(-1, 2);
  const idx = [0, 1, 2, 3].filter((i) => i !== drop);
  const items = idx.map((i) => HOMININS[i]);
  const ms: Mistake[] = [{ when: { kind: "order", items: [items[items.length - 1], items[0]] }, title: tx("Upside down", "Verkehrt herum"), say: tx("You started with modern humans. The task asks for the oldest first: which one walked upright with a small brain?", "Du hast mit dem modernen Menschen angefangen. Gefragt ist das Älteste zuerst: Wer ging aufrecht, hatte aber ein kleines Gehirn?") }];
  if (idx.includes(1) && idx.includes(2)) ms.push({ when: { kind: "order", items: [HOMININS[2], HOMININS[1]] }, title: tx("Tools before fire", "Werkzeuge vor Feuer"), say: tx("Homo habilis made the first stone tools; Homo erectus came later and used fire.", "Homo habilis stellte die ersten Steinwerkzeuge her; Homo erectus kam später und nutzte das Feuer.") });
  return {
    instruction: tx("Order by age", "Ordne nach dem Alter"),
    text: tx("Put these human species in the order in which they appeared, **oldest first**.", "Bring diese Menschenarten in die Reihenfolge ihres Auftretens, **die älteste zuerst**."),
    answer: { kind: "order", items, label: tx("oldest at the top", "die älteste oben") },
    hint: tx("Upright walking came first, the big brain much later.", "Zuerst kam der aufrechte Gang, das große Gehirn viel später."),
    solution: [{ math: tx(`"oldest:"#o \\\\ ${idx.map((i, j) => `"${en(HOMININS[i]).split(" (")[0]}"#h${j}`).join(" \\to ")}`, `"älteste:"#o \\\\ ${idx.map((i, j) => `"${de(HOMININS[i]).split(" (")[0]}"#h${j}`).join(" \\to ")}`), note: tx(idx.map((i) => `${en(HOMININS[i]).split(" (")[0]}: ${en(HOMININ_AGE[i])}.`).join(" "), idx.map((i) => `${de(HOMININS[i]).split(" (")[0]}: ${de(HOMININ_AGE[i])}.`).join(" ")) }],
    mistakes: ms,
  };
}

const HUMAN_TRUE: Text[] = [
  tx("Humans and chimpanzees share a common ancestor that lived about 6 to 7 million years ago.", "Mensch und Schimpanse haben einen gemeinsamen Vorfahren, der vor etwa 6 bis 7 Millionen Jahren lebte."),
  tx("Upright walking developed long before the large brain.", "Der aufrechte Gang entstand lange vor dem großen Gehirn."),
  tx("Homo sapiens and the Neanderthals lived at the same time for thousands of years.", "Homo sapiens und Neandertaler lebten Jahrtausende lang zur selben Zeit."),
  tx("The oldest fossils of Australopithecus and of the genus Homo come from Africa.", "Die ältesten Fossilien von Australopithecus und der Gattung Homo stammen aus Afrika."),
  tx("Homo erectus was the first human species to spread from Africa to Asia and Europe.", "Homo erectus war die erste Menschenart, die sich von Afrika nach Asien und Europa ausbreitete."),
];

const HUMAN_FALSE: Opt[] = [
  { text: tx("Humans descend from today's chimpanzees.", "Der Mensch stammt vom heutigen Schimpansen ab."), title: tx("Cousins, not ancestors", "Vettern, keine Vorfahren"), say: tx("Today's chimpanzees have evolved for just as long as we have. Humans and chimpanzees share a common ancestor; neither descends from the other.", "Heutige Schimpansen haben sich genauso lange weiterentwickelt wie wir. Mensch und Schimpanse haben einen gemeinsamen Vorfahren; keiner stammt vom anderen ab.") },
  { text: tx("The large brain developed first, upright walking only later.", "Zuerst entstand das große Gehirn, erst später der aufrechte Gang."), title: tx("The other way round", "Andersherum"), say: tx("Australopithecus already walked upright but had a brain hardly larger than a chimpanzee's. The big brain came much later.", "Australopithecus ging schon aufrecht, hatte aber ein Gehirn kaum größer als das eines Schimpansen. Das große Gehirn kam viel später.") },
  { text: tx("Homo sapiens descends from the Neanderthals.", "Homo sapiens stammt vom Neandertaler ab."), title: tx("Relatives, side by side", "Verwandte, nebeneinander"), say: tx("Neanderthals and Homo sapiens were separate lines that lived at the same time and sometimes had children together. We don't descend from the Neanderthals.", "Neandertaler und Homo sapiens waren getrennte Linien, die gleichzeitig lebten und manchmal gemeinsame Kinder hatten. Wir stammen nicht vom Neandertaler ab.") },
  { text: tx("Australopithecus already used fire and lived in houses.", "Australopithecus nutzte schon Feuer und wohnte in Häusern."), title: tx("Much too early", "Viel zu früh"), say: tx("Controlled use of fire is only known from Homo erectus on, and houses came far later.", "Feuer wurde erst ab Homo erectus genutzt, und Häuser kamen noch viel später.") },
  { text: tx("Humans evolved in Europe and only later moved to Africa.", "Der Mensch ist in Europa entstanden und erst später nach Afrika gewandert."), title: tx("Out of Africa", "Aus Afrika heraus"), say: tx("The oldest fossils of Australopithecus and of Homo sapiens come from Africa. From there humans spread across the world.", "Die ältesten Fossilien von Australopithecus und Homo sapiens stammen aus Afrika. Von dort breitete sich der Mensch über die Welt aus.") },
];

function humanTruthTask(rng: Rng, fixed?: { right: number; wrong: number[] }): Exercise {
  const right = fixed ? HUMAN_TRUE[fixed.right] : rng.pick(HUMAN_TRUE);
  const wrong = fixed ? fixed.wrong.map((i) => HUMAN_FALSE[i]) : rng.shuffle(HUMAN_FALSE).slice(0, 3);
  const { answer, mistakes: list } = choice(rng, [{ text: right }, ...wrong]);
  return {
    instruction: tx("Which statement is correct?", "Welche Aussage stimmt?"),
    text: tx("Human evolution: which of these statements is correct?", "Evolution des Menschen: Welche dieser Aussagen ist richtig?"),
    answer,
    hint: tx("Remember: common ancestors, Africa, upright walk before big brain, Neanderthals as relatives living at the same time.", "Denk an: gemeinsame Vorfahren, Afrika, aufrechter Gang vor großem Gehirn, Neandertaler als gleichzeitig lebende Verwandte."),
    solution: [{ math: q(tx("correct", "richtig"), "r"), note: right }],
    mistakes: list,
  };
}

// ---------------------------------------------------------------------------
// Generator

export function generate2(rng: Rng): Exercise {
  switch (rng.int(0, 13)) {
    case 13:
      return boneTask(rng);
    case 0:
    case 1:
      return darwinTask(rng);
    case 2:
      return whoTask(rng);
    case 3:
      return darwinOrderTask(rng);
    case 4:
      return factorTask(rng);
    case 5:
      return driftTask(rng);
    case 6:
      return isoChoiceTask(rng);
    case 7:
      return isoMatchTask(rng);
    case 8:
      return speciesTask(rng);
    case 9:
      return evidenceTask(rng);
    case 10:
      return homologyMultiTask(rng);
    case 11:
      return humanOrderTask(rng);
    default:
      return humanTruthTask(rng);
  }
}

// ---------------------------------------------------------------------------
// Lesson

const checkDarwin = darwinTask(createRng(4), EXAMPLES[0]);
const checkIso = isoMatchTask(createRng(2), [ISO_CASES[3], ISO_CASES[0], ISO_CASES[10], ISO_CASES[5]]);
const checkHuman = humanTruthTask(createRng(6), { right: 1, wrong: [0, 2, 3] });

export const level2: LevelLesson = {
  lesson: [
    {
      type: "widget",
      title: tx("Lamarck and Darwin: the giraffe's neck", "Lamarck und Darwin: der Hals der Giraffe"),
      blob: tx("Two famous explanations, one long neck. Step through both!", "Zwei berühmte Erklärungen, ein langer Hals. Geh beide Schritt für Schritt durch!"),
      body: tx(
        "Jean-Baptiste de Lamarck (1809) and Charles Darwin (1859) both thought that species change over time. But they explained it very differently. Go through the four steps and compare.",
        "Jean-Baptiste de Lamarck (1809) und Charles Darwin (1859) waren beide überzeugt, dass sich Arten im Lauf der Zeit verändern. Sie erklärten es aber ganz unterschiedlich. Geh die vier Schritte durch und vergleiche.",
      ),
      widget: EvolutionGiraffes,
    },
    {
      type: "explain",
      title: tx("Darwin's theory of natural selection", "Darwins Selektionstheorie"),
      blob: tx("Five observations, one brilliant idea.", "Fünf Beobachtungen, eine geniale Idee."),
      body: tx("In 1859 Darwin published \"On the Origin of Species\". His theory rests on a few observations and conclusions.", "1859 veröffentlichte Darwin „Über die Entstehung der Arten“. Seine Theorie beruht auf wenigen Beobachtungen und Schlussfolgerungen."),
      frames: [
        { math: tx('"overproduction"#a', '"Überproduktion"#a'), note: tx("**Overproduction**: every species produces far more offspring than can survive.", "**Überproduktion**: Jede Art bringt viel mehr Nachkommen hervor, als überleben können.") },
        { math: tx('"overproduction"#a \\quad "variation"#b', '"Überproduktion"#a \\quad "Variation"#b'), note: tx("**Variation**: individuals differ, and many of the differences are heritable.", "**Variation**: Die Individuen unterscheiden sich, und viele Unterschiede sind erblich.") },
        { math: tx('"overproduction"#a \\quad "variation"#b \\\\ "competition"#c', '"Überproduktion"#a \\quad "Variation"#b \\\\ "Konkurrenz"#c'), note: tx("**Competition**: food and space are limited, so individuals compete with each other (struggle for existence).", "**Konkurrenz**: Nahrung und Lebensraum sind begrenzt, deshalb konkurrieren die Individuen miteinander (Kampf ums Dasein).") },
        {
          math: tx('"overproduction"#a \\quad "variation"#b \\\\ "competition"#c \\quad "selection"#d', '"Überproduktion"#a \\quad "Variation"#b \\\\ "Konkurrenz"#c \\quad "Selektion"#d'),
          note: tx("**Selection**: the best adapted survive more often and have more offspring. 'Survival of the fittest' means the best adapted, not the strongest.", "**Selektion**: Die am besten Angepassten überleben häufiger und haben mehr Nachkommen. Gemeint ist das Überleben der am besten Angepassten, nicht der Stärksten."),
        },
        {
          math: tx('"overproduction"#a \\quad "variation"#b \\\\ "competition"#c \\quad "selection"#d \\\\ "inheritance"#e', '"Überproduktion"#a \\quad "Variation"#b \\\\ "Konkurrenz"#c \\quad "Selektion"#d \\\\ "Vererbung"#e'),
          note: tx("**Inheritance**: they pass on their traits. Over many generations the species changes (gradually, without a goal).", "**Vererbung**: Sie geben ihre Merkmale weiter. Über viele Generationen wandelt sich die Art (allmählich und ohne Ziel)."),
        },
        {
          math: tx('\\strike{"inheritance of acquired traits"}#x', '\\strike{"Vererbung erworbener Eigenschaften"}#x'),
          note: tx(
            "Lamarck is refuted: trained muscles or a cut-off tail don't change the genetic information in the germ cells. August Weismann cut off the tails of mice for generation after generation: the young always had normal tails.",
            "Lamarck ist widerlegt: Trainierte Muskeln oder ein abgeschnittener Schwanz verändern die Erbinformation in den Keimzellen nicht. August Weismann schnitt Mäusen über viele Generationen die Schwänze ab: Die Jungen hatten immer normale Schwänze.",
          ),
        },
      ],
    },
    { type: "check", blob: tx("Three of these sound convincing. Only one is Darwin.", "Drei davon klingen überzeugend. Nur eine ist Darwin."), exercise: checkDarwin },
    {
      type: "explain",
      title: tx("The factors of evolution", "Die Evolutionsfaktoren"),
      blob: tx("Darwin didn't know about genes yet. Today we know more!", "Darwin kannte noch keine Gene. Heute wissen wir mehr!"),
      body: tx(
        "Today evolution is described as a change of the **gene pool** of a population. Several **factors of evolution** work together.",
        "Heute beschreibt man Evolution als Veränderung des **Genpools** einer Population. Dabei wirken mehrere **Evolutionsfaktoren** zusammen.",
      ),
      frames: [
        {
          math: tx('"mutation"#a \\quad "recombination"#b', '"Mutation"#a \\quad "Rekombination"#b'),
          note: tx("**Mutation** creates new alleles (random, undirected changes of the DNA). **Recombination** in meiosis and fertilisation shuffles alleles into new combinations. Both create **variation**.", "**Mutation** erzeugt neue Allele (zufällige, ungerichtete Änderungen der DNA). **Rekombination** bei Meiose und Befruchtung mischt die Allele neu. Beide erzeugen **Variation**."),
        },
        { math: tx('"mutation"#a \\quad "recombination"#b \\\\ "selection"#c', '"Mutation"#a \\quad "Rekombination"#b \\\\ "Selektion"#c'), note: tx("**Selection** changes allele frequencies in a directed way: well adapted variants become more common.", "**Selektion** verändert die Allelfrequenzen gerichtet: Gut angepasste Varianten werden häufiger.") },
        {
          math: tx('"mutation"#a \\quad "recombination"#b \\\\ "selection"#c \\quad "genetic drift"#d', '"Mutation"#a \\quad "Rekombination"#b \\\\ "Selektion"#c \\quad "Gendrift"#d'),
          note: tx(
            "**Genetic drift**: chance changes allele frequencies, especially in small populations. **Bottleneck effect**: hunting left only about 20 northern elephant seals around 1890. **Founder effect**: a few individuals found a new population.",
            "**Gendrift**: Der Zufall verändert Allelfrequenzen, vor allem in kleinen Populationen. **Flaschenhalseffekt**: Um 1890 hatte die Jagd nur etwa 20 Nördliche See-Elefanten übrig gelassen. **Gründereffekt**: Wenige Individuen gründen eine neue Population.",
          ),
        },
        {
          math: tx('"mutation"#a \\quad "recombination"#b \\\\ "selection"#c \\quad "genetic drift"#d \\\\ "isolation"#e', '"Mutation"#a \\quad "Rekombination"#b \\\\ "Selektion"#c \\quad "Gendrift"#d \\\\ "Isolation"#e'),
          note: tx("**Isolation** separates gene pools: no more gene flow between populations. That's where new species begin.", "**Isolation** trennt Genpools: kein Genfluss mehr zwischen Populationen. Hier beginnt die Bildung neuer Arten."),
        },
      ],
    },
    {
      type: "widget",
      title: tx("New species on islands", "Neue Arten auf Inseln"),
      blob: tx("Darwin's finches: a story that took a few million years. Here it takes five steps!", "Darwinfinken: eine Geschichte von ein paar Millionen Jahren. Hier dauert sie fünf Schritte!"),
      body: tx(
        "On the Galápagos Islands Darwin found finches that differ mainly in their beaks. Today we know: they descend from one species that came from the mainland. Step through how new species arise.",
        "Auf den Galápagosinseln fand Darwin Finken, die sich vor allem in ihren Schnäbeln unterscheiden. Heute weiß man: Sie stammen von einer Art ab, die vom Festland kam. Geh Schritt für Schritt durch, wie neue Arten entstehen.",
      ),
      widget: EvolutionIslands,
    },
    {
      type: "explain",
      title: tx("What is a species? Isolation mechanisms", "Was ist eine Art? Isolationsmechanismen"),
      blob: tx("A mule is cute, but it can't have foals of its own.", "Ein Maultier ist niedlich, kann aber selbst keine Fohlen bekommen."),
      body: tx(
        "**Biological species concept**: a species is a group of individuals that interbreed in nature and produce **fertile** offspring. Barriers that prevent interbreeding are called **isolation mechanisms**.",
        "**Biologischer Artbegriff**: Eine Art ist eine Gruppe von Individuen, die sich in der Natur miteinander kreuzen und **fruchtbare** Nachkommen hervorbringen. Barrieren, die das verhindern, heißen **Isolationsmechanismen**.",
      ),
      frames: [
        { math: tx('"horse"#a + "donkey"#b \\to "mule"#c', '"Pferd"#a + "Esel"#b \\to "Maultier"#c'), note: tx("Horse and donkey can have a mule together, but mules are infertile. So horse and donkey are separate species.", "Pferd und Esel bekommen zusammen ein Maultier, doch Maultiere sind unfruchtbar. Pferd und Esel sind also getrennte Arten.") },
        { math: tx('"geographic"#g', '"geografisch"#g'), note: tx("**Geographic**: mountains, sea or rivers separate populations in space. This leads to allopatric speciation.", "**Geografisch**: Gebirge, Meer oder Flüsse trennen Populationen räumlich. Das führt zur allopatrischen Artbildung.") },
        { math: tx('"geographic"#g \\quad "ecological"#h', '"geografisch"#g \\quad "ökologisch"#h'), note: tx("**Ecological**: same area, different habitats (lions in grassland, tigers in forest).", "**Ökologisch**: gleiches Gebiet, verschiedene Lebensräume (Löwen im Grasland, Tiger im Wald).") },
        { math: tx('"geographic"#g \\quad "ecological"#h \\\\ "temporal"#i', '"geografisch"#g \\quad "ökologisch"#h \\\\ "zeitlich"#i'), note: tx("**Temporal**: different breeding or flowering times.", "**Zeitlich**: verschiedene Paarungs- oder Blütezeiten.") },
        { math: tx('"geographic"#g \\quad "ecological"#h \\\\ "temporal"#i \\quad "mechanical"#j', '"geografisch"#g \\quad "ökologisch"#h \\\\ "zeitlich"#i \\quad "mechanisch"#j'), note: tx("**Mechanical**: mating organs or flower parts don't fit together.", "**Mechanisch**: Begattungsorgane oder Blütenteile passen nicht zusammen.") },
        {
          math: tx('"geographic"#g \\quad "ecological"#h \\\\ "temporal"#i \\quad "mechanical"#j \\\\ "behavioural"#k', '"geografisch"#g \\quad "ökologisch"#h \\\\ "zeitlich"#i \\quad "mechanisch"#j \\\\ "ethologisch"#k'),
          note: tx("**Behavioural**: different songs or courtship, like chiffchaff and willow warbler.", "**Ethologisch**: verschiedene Gesänge oder Balz, wie bei Zilpzalp und Fitis."),
        },
      ],
    },
    { type: "check", blob: tx("Four barriers, four examples. Match them up!", "Vier Barrieren, vier Beispiele. Ordne sie zu!"), exercise: checkIso },
    {
      type: "explain",
      title: tx("Evidence for evolution", "Belege für die Evolution"),
      blob: tx("Our own body is full of clues!", "Unser eigener Körper steckt voller Hinweise!"),
      frames: [
        {
          math: tx('"homologous"#a', '"homolog"#a'),
          note: tx(
            "**Homologous organs**: same basic plan, often a different job, because of common descent (human arm, bat wing). **Analogous organs** only share the job (butterfly and bird wing): they evolved independently (convergence).",
            "**Homologe Organe**: gleicher Grundbauplan, oft andere Aufgabe, wegen gemeinsamer Abstammung (Arm des Menschen, Flügel der Fledermaus). **Analoge Organe** haben nur dieselbe Aufgabe (Flügel von Schmetterling und Vogel): Sie entstanden unabhängig (Konvergenz).",
          ),
        },
        { math: tx('"rudimentary"#b', '"rudimentär"#b'), note: tx("**Rudimentary organs**: reduced remains of organs that worked in the ancestors: the human tailbone, the appendix, wisdom teeth, the pelvic bones of whales.", "**Rudimentäre Organe**: zurückgebildete Reste von Organen, die bei den Vorfahren funktionierten: das Steißbein, der Wurmfortsatz des Blinddarms, die Weisheitszähne, die Beckenknochen der Wale.") },
        { math: tx('"atavism"#c', '"Atavismus"#c'), note: tx("**Atavisms**: ancestral traits that reappear in single individuals: a tail-like appendage, extra nipples, a horse with extra toes.", "**Atavismen**: Merkmale der Vorfahren, die bei einzelnen Individuen wieder auftreten: ein schwanzartiger Anhang, zusätzliche Brustwarzen, ein Pferd mit zusätzlichen Zehen.") },
        { math: tx('"embryos"#d', '"Embryonen"#d'), note: tx("**Embryonic development**: early embryos of all vertebrates have pharyngeal arches (gill arches) and a tail.", "**Embryonalentwicklung**: Frühe Embryonen aller Wirbeltiere haben Schlundbögen (Kiemenbögen) und einen Schwanz.") },
        { math: tx('"fossils"#e', '"Fossilien"#e'), note: tx("**Fossils** and transitional forms like Archaeopteryx or Tiktaalik show the intermediate steps.", "**Fossilien** und Übergangsformen wie Archaeopteryx oder Tiktaalik zeigen Zwischenschritte.") },
      ],
    },
    {
      type: "widget",
      title: tx("Homologous forelimbs", "Homologe Vordergliedmaßen"),
      blob: tx("Same bones, four completely different jobs. Tap a bone!", "Gleiche Knochen, vier völlig verschiedene Aufgaben. Tipp einen Knochen an!"),
      body: tx(
        "Grasping, flying, swimming, running: the forelimbs of these mammals do very different jobs. Yet they are built from the same bones, in the same order. That only makes sense if they all go back to a common ancestor.",
        "Greifen, Fliegen, Schwimmen, Laufen: Die Vordergliedmaßen dieser Säugetiere haben ganz verschiedene Aufgaben. Trotzdem bestehen sie aus denselben Knochen in derselben Anordnung. Das ergibt nur Sinn, wenn alle auf einen gemeinsamen Vorfahren zurückgehen.",
      ),
      widget: EvolutionForelimbs,
    },
    {
      type: "explain",
      title: tx("Human evolution", "Die Evolution des Menschen"),
      blob: tx("Now it's about us!", "Jetzt geht es um uns!"),
      body: tx(
        "Humans and chimpanzees share a common ancestor that lived about 6 to 7 million years ago in Africa. We do **not** descend from today's apes: they have evolved for just as long as we have.",
        "Mensch und Schimpanse haben einen gemeinsamen Vorfahren, der vor etwa 6 bis 7 Millionen Jahren in Afrika lebte. Wir stammen **nicht** von heutigen Affen ab: Sie haben sich genauso lange weiterentwickelt wie wir.",
      ),
      frames: [
        { math: tx('"Australopithecus"#a \\\\ "4 to 2 million years ago"#t', '"Australopithecus"#a \\\\ "vor 4 bis 2 Mio. Jahren"#t'), note: tx("**Australopithecus** (Africa): walked upright, but had a small brain of about 450 cm³, not much larger than a chimpanzee's.", "**Australopithecus** (Afrika): ging aufrecht, hatte aber ein kleines Gehirn von etwa 450 cm³, kaum größer als das eines Schimpansen.") },
        { math: tx('"Homo erectus"#b \\\\ "from 1.9 million years ago"#t', '"Homo erectus"#b \\\\ "ab 1,9 Mio. Jahren"#t'), note: tx("**Homo erectus**: larger brain, used fire, the first to spread from Africa to Asia and Europe.", "**Homo erectus**: größeres Gehirn, nutzte das Feuer, breitete sich als Erster von Afrika nach Asien und Europa aus.") },
        { math: tx('"Neanderthals"#c \\\\ "400,000 to 40,000 years ago"#t', '"Neandertaler"#c \\\\ "vor 400.000 bis 40.000 Jahren"#t'), note: tx("**Neanderthals** (Europe and Western Asia): large brain, skilled tool makers. They died out about 40,000 years ago.", "**Neandertaler** (Europa und Westasien): großes Gehirn, geschickte Werkzeugmacher. Sie starben vor etwa 40.000 Jahren aus.") },
        { math: tx('"Homo sapiens"#d \\\\ "from 300,000 years ago"#t', '"Homo sapiens"#d \\\\ "ab 300.000 Jahren"#t'), note: tx("**Homo sapiens** arose in Africa, spread across the world and met the Neanderthals. Many people today carry a little Neanderthal DNA.", "**Homo sapiens** entstand in Afrika, breitete sich über die Welt aus und traf auf die Neandertaler. Viele Menschen tragen heute etwas Neandertaler-DNA in sich.") },
        { math: tx('"upright walk"#u \\to "large brain"#g', '"aufrechter Gang"#u \\to "großes Gehirn"#g'), note: tx("The order matters: upright walking came first, the large brain much later.", "Die Reihenfolge zählt: Zuerst kam der aufrechte Gang, das große Gehirn viel später.") },
      ],
    },
    { type: "check", blob: tx("Myth or fact? Only one statement survives.", "Mythos oder Fakt? Nur eine Aussage überlebt."), exercise: checkHuman },
  ],
  summary: [
    {
      title: tx("Lamarck and Darwin", "Lamarck und Darwin"),
      body: tx(
        "Lamarck (1809): use and disuse of organs, inheritance of acquired traits (refuted). Darwin (1859): overproduction, variation, competition, selection of the best adapted, inheritance.",
        "Lamarck (1809): Gebrauch und Nichtgebrauch der Organe, Vererbung erworbener Eigenschaften (widerlegt). Darwin (1859): Überproduktion, Variation, Konkurrenz, Selektion der am besten Angepassten, Vererbung.",
      ),
      examples: [tx('"variation" + "selection" \\to "change"', '"Variation" + "Selektion" \\to "Artwandel"')],
      tone: "rule",
    },
    {
      title: tx("Factors of evolution", "Evolutionsfaktoren"),
      body: tx(
        "Mutation and recombination create variation. Selection (directed) and genetic drift (chance: bottleneck, founder effect) change the gene pool. Isolation separates gene pools.",
        "Mutation und Rekombination erzeugen Variation. Selektion (gerichtet) und Gendrift (Zufall: Flaschenhals, Gründereffekt) verändern den Genpool. Isolation trennt Genpools.",
      ),
      tone: "rule",
    },
    {
      title: tx("Species and speciation", "Art und Artbildung"),
      body: tx(
        "Biological species: individuals that interbreed in nature and have fertile offspring. Allopatric speciation: geographic isolation, then different mutations, selection and drift, finally reproductive isolation (Darwin's finches).",
        "Biologische Art: Individuen, die sich in der Natur kreuzen und fruchtbare Nachkommen haben. Allopatrische Artbildung: geografische Isolation, dann verschiedene Mutationen, Selektion und Drift, schließlich Fortpflanzungsbarriere (Darwinfinken).",
      ),
      examples: [tx('"isolation" \\to "selection, drift" \\to "new species"', '"Isolation" \\to "Selektion, Drift" \\to "neue Art"')],
      tone: "rule",
    },
    {
      title: tx("Evidence for evolution", "Belege für die Evolution"),
      body: tx(
        "Homologous organs (same plan, different job), rudimentary organs (tailbone, whale pelvis), atavisms (extra nipples), embryonic development (gill arches), fossils and transitional forms. Analogous organs (same job, different plan) show convergence, not close relationship.",
        "Homologe Organe (gleicher Bauplan, andere Aufgabe), rudimentäre Organe (Steißbein, Walbecken), Atavismen (zusätzliche Brustwarzen), Embryonalentwicklung (Kiemenbögen), Fossilien und Übergangsformen. Analoge Organe (gleiche Aufgabe, anderer Bauplan) zeigen Konvergenz, keine nahe Verwandtschaft.",
      ),
      tone: "tip",
    },
    {
      title: tx("Human evolution", "Evolution des Menschen"),
      body: tx(
        "Australopithecus (upright, small brain), Homo habilis (stone tools), Homo erectus (fire, out of Africa), Homo sapiens (from 300,000 years ago); Neanderthals lived at the same time as Homo sapiens. Upright walking came before the large brain.",
        "Australopithecus (aufrecht, kleines Gehirn), Homo habilis (Steinwerkzeuge), Homo erectus (Feuer, aus Afrika hinaus), Homo sapiens (ab 300.000 Jahren); Neandertaler lebten gleichzeitig mit Homo sapiens. Der aufrechte Gang kam vor dem großen Gehirn.",
      ),
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "Acquired traits are not inherited. 'Fittest' means best adapted, not strongest. Evolution has no goal. Humans don't descend from today's apes. The same job doesn't make organs homologous.",
        "Erworbene Eigenschaften werden nicht vererbt. „Fittest“ heißt am besten angepasst, nicht am stärksten. Evolution hat kein Ziel. Der Mensch stammt nicht von heutigen Affen ab. Dieselbe Aufgabe macht Organe nicht homolog.",
      ),
      tone: "warning",
    },
  ],
};
