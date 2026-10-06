import { tx, type Text } from "@/i18n/text";
import type { TopicProgress } from "./progress";
import type { Area, Level } from "./types";

export type Subject = "maths" | "chemistry" | "biology";

/** One level of a topic, as shown on cards and the topic page. */
export type LevelMeta = {
  /** How deep this level goes for this topic, e.g. "Klasse 5–6" or "Oberstufe". */
  depth: Text;
  /** What this level's lesson covers, one sentence. */
  blurb?: Text;
  /** Lesson minutes. Without it the lesson is still being written ("coming soon"). */
  minutes?: number;
};

/**
 * Plain data about each topic, safe for server components (the full topics
 * contain React widgets and live in client modules). Slugs are unique across
 * subjects, because progress is stored per slug.
 */
export type TopicMeta = {
  slug: string;
  subject: Subject;
  title: Text;
  /** German name from class. Shown as a subtitle in English so students recognise it. */
  de: string;
  area: Area;
  /** One sentence for cards. */
  blurb: Text;
  /** Display-language glyph for the topic card, e.g. "a(b + c)". */
  glyph: string;
  /** A picture instead of the glyph: a name from components/topicIcons.ts (biology). */
  icon?: string;
  /** The three levels: how deep each goes and which lessons exist. */
  levels: Record<Level, LevelMeta>;
};

type Entry = Omit<TopicMeta, "subject">;

/** A topic from before levels: its one lesson sits at `lessonLevel`, the other levels come later. */
type SingleEntry = Omit<Entry, "levels"> & { minutes: number; lessonLevel: Level };

/** How deep each level goes in a subject, for topics whose levels aren't written yet. */
const DEPTH: Record<"maths" | "chemistry", Record<Level, Text>> = {
  maths: { 1: tx("Grades 5–7", "Klasse 5–7"), 2: tx("Grades 8–10", "Klasse 8–10"), 3: tx("Upper school", "Oberstufe") },
  chemistry: { 1: tx("Grades 7–8", "Klasse 7–8"), 2: tx("Grades 9–10", "Klasse 9–10"), 3: tx("Upper school", "Oberstufe") },
};

function single(subject: "maths" | "chemistry", { minutes, lessonLevel, ...entry }: SingleEntry): Entry {
  const levels = { 1: { depth: DEPTH[subject][1] }, 2: { depth: DEPTH[subject][2] }, 3: { depth: DEPTH[subject][3] } } as Record<Level, LevelMeta>;
  levels[lessonLevel] = { ...levels[lessonLevel], blurb: entry.blurb, minutes };
  return { ...entry, levels };
}

/** The level of the lesson a topic had before levels (its old progress row counts for it). */
export const LEGACY_LESSON_LEVEL: Record<string, Level> = {};

/** Maths topics in the order they're suggested. */
const MATHS_ENTRIES: SingleEntry[] = [
  { slug: "brackets", title: tx("Removing brackets", "Klammern auflösen"), de: "Klammern auflösen", area: "algebra", blurb: tx("Plus or minus in front? Learn when signs stay and when they flip.", "Plus oder Minus davor? Lerne, wann Vorzeichen bleiben und wann du sie umdrehst."), glyph: "-(a - b)", minutes: 7, lessonLevel: 1 },
  { slug: "expanding", title: tx("Expanding brackets", "Ausmultiplizieren"), de: "Ausmultiplizieren", area: "algebra", blurb: tx("Multiply into brackets, two brackets at once and the binomial formulas.", "In Klammern hineinmultiplizieren, zwei Klammern auf einmal und die binomischen Formeln."), glyph: "a(b + c)", minutes: 9, lessonLevel: 2 },
  { slug: "rearranging", title: tx("Rearranging formulas", "Formeln umstellen"), de: "Formeln umstellen", area: "algebra", blurb: tx("Get any letter on its own, step by step, with inverse operations.", "Bring jeden Buchstaben allein auf eine Seite, Schritt für Schritt mit Umkehroperationen."), glyph: "v = \\frac{s}{t}", minutes: 8, lessonLevel: 2 },
  { slug: "fractions", title: tx("Fractions", "Bruchrechnung"), de: "Bruchrechnung", area: "numbers", blurb: tx("Simplify, add, subtract, multiply and divide fractions with confidence.", "Brüche sicher kürzen, addieren, subtrahieren, multiplizieren und dividieren."), glyph: "\\frac{3}{4}", minutes: 10, lessonLevel: 1 },
  { slug: "powers-roots", title: tx("Powers and roots", "Potenzen und Wurzeln"), de: "Potenzen und Wurzeln", area: "numbers", blurb: tx("Power rules, negative exponents and simplifying square roots.", "Potenzgesetze, negative Exponenten und Wurzeln vereinfachen."), glyph: "a^n", minutes: 9, lessonLevel: 2 },
  { slug: "percentages", title: tx("Percentages", "Prozentrechnung"), de: "Prozentrechnung", area: "numbers", blurb: tx("Percentage, base value and percent rate, plus increases and discounts.", "Grundwert, Prozentwert und Prozentsatz, dazu Erhöhungen und Rabatte."), glyph: "25 %", minutes: 8, lessonLevel: 1 },
  { slug: "equations", title: tx("Equations and inequalities", "Gleichungen und Ungleichungen"), de: "Gleichungen und Ungleichungen", area: "equations", blurb: tx("Solve linear equations and inequalities, and know when the sign flips.", "Lineare Gleichungen und Ungleichungen lösen und wissen, wann sich das Zeichen umdreht."), glyph: "2x + 3 = 11", minutes: 10, lessonLevel: 1 },
  { slug: "linear-systems", title: tx("Systems of equations", "Lineare Gleichungssysteme"), de: "Lineare Gleichungssysteme", area: "equations", blurb: tx("Two equations, two unknowns: substitution, elimination and graphs.", "Zwei Gleichungen, zwei Unbekannte: Einsetzen, Gleichsetzen, Addieren und Graphen."), glyph: "x + y = 5", minutes: 10, lessonLevel: 2 },
  { slug: "pq-formula", title: tx("The pq formula", "pq-Formel"), de: "pq-Formel", area: "equations", blurb: tx("Solve any quadratic equation in normal form, and read the discriminant.", "Jede quadratische Gleichung in Normalform lösen und die Diskriminante deuten."), glyph: "x^2 + px + q", minutes: 9, lessonLevel: 2 },
  { slug: "lines", title: tx("Straight lines", "Geraden"), de: "Geraden", area: "functions", blurb: tx("Slope, y-intercept and the line through two points, on a live graph.", "Steigung, y-Achsenabschnitt und die Gerade durch zwei Punkte, am lebendigen Graphen."), glyph: "y = mx + b", minutes: 10, lessonLevel: 2 },
  { slug: "word-problems", title: tx("Word problems", "Textaufgaben"), de: "Textaufgaben", area: "applied", blurb: tx("Turn a story into maths: find what's asked, pick the operation, check.", "Aus einer Geschichte wird Mathe: Gesuchtes finden, Rechenweg wählen, prüfen."), glyph: '12 "km" : 3 "h"', minutes: 8, lessonLevel: 1 },
  { slug: "unknowns", title: tx("Word problems with unknowns", "Textaufgaben mit Unbekannten"), de: "Textaufgaben mit Unbekannten", area: "applied", blurb: tx("Name the unknown x, write the equation, solve it, answer in words.", "Die Unbekannte x benennen, die Gleichung aufstellen, lösen und im Antwortsatz antworten."), glyph: "x + 2x = 30", minutes: 10, lessonLevel: 1 },
];

/** Chemistry topics in the order they're suggested (roughly the German school order, grades 7 to 10). */
const CHEMISTRY_ENTRIES: SingleEntry[] = [
  { slug: "particles", title: tx("Particles and states", "Teilchenmodell und Aggregatzustände"), de: "Teilchenmodell", area: "matter", blurb: tx("Solid, liquid, gas: what the particles do, and why things melt and boil.", "Fest, flüssig, gasförmig: was die Teilchen tun und warum Stoffe schmelzen und sieden."), glyph: "\\ce{H2O(l)}", minutes: 7, lessonLevel: 1 },
  { slug: "mixtures", title: tx("Mixtures and separation", "Stoffgemische und Trennverfahren"), de: "Stoffgemische", area: "matter", blurb: tx("Pure substances, solutions and suspensions, and how to separate them.", "Reinstoffe, Lösungen und Suspensionen und wie man sie wieder trennt."), glyph: "\\ce{NaCl(aq)}", minutes: 8, lessonLevel: 1 },
  { slug: "atoms", title: tx("Atomic structure", "Atombau"), de: "Atombau", area: "atoms", blurb: tx("Protons, neutrons, electrons and shells: build any atom yourself.", "Protonen, Neutronen, Elektronen und Schalen: Bau jedes Atom selbst."), glyph: "p^+ \\; n \\; e^-", minutes: 9, lessonLevel: 1 },
  { slug: "periodic-table", title: tx("The periodic table", "Das Periodensystem"), de: "Periodensystem", area: "atoms", blurb: tx("Read groups and periods, and predict how an element behaves.", "Hauptgruppen und Perioden lesen und vorhersagen, wie sich ein Element verhält."), glyph: "\\ce{Na}", minutes: 9, lessonLevel: 1 },
  { slug: "ionic-bonds", title: tx("Ions and salts", "Ionenbindung und Salze"), de: "Ionenbindung", area: "bonding", blurb: tx("Why atoms give and take electrons, and how to write any salt's formula.", "Warum Atome Elektronen abgeben und aufnehmen und wie du jede Salzformel aufstellst."), glyph: "\\ce{Na+ Cl-}", minutes: 10, lessonLevel: 2 },
  { slug: "covalent-bonds", title: tx("Covalent bonds", "Elektronenpaarbindung"), de: "Elektronenpaarbindung", area: "bonding", blurb: tx("Shared electron pairs, Lewis structures and polar molecules.", "Gemeinsame Elektronenpaare, Lewis-Formeln und polare Moleküle."), glyph: "\\ce{H2O}", minutes: 10, lessonLevel: 2 },
  { slug: "reactions", title: tx("Chemical reactions", "Chemische Reaktionen"), de: "Chemische Reaktion", area: "reactions", blurb: tx("New substances, energy and the signs that a reaction happened.", "Neue Stoffe, Energie und woran du eine Reaktion erkennst."), glyph: "\\ce{A + B -> C}", minutes: 8, lessonLevel: 1 },
  { slug: "balancing", title: tx("Balancing equations", "Reaktionsgleichungen"), de: "Reaktionsgleichungen aufstellen", area: "reactions", blurb: tx("Count the atoms and balance any equation, step by step.", "Atome zählen und jede Reaktionsgleichung Schritt für Schritt ausgleichen."), glyph: "\\ce{2H2 + O2 -> 2H2O}", minutes: 10, lessonLevel: 2 },
  { slug: "acids-bases", title: tx("Acids and bases", "Säuren und Basen"), de: "Säuren und Basen", area: "reactions", blurb: tx("Protons on the move: pH, indicators and neutralisation.", "Protonen auf Wanderschaft: pH-Wert, Indikatoren und Neutralisation."), glyph: "\\ce{H3O+}", minutes: 10, lessonLevel: 2 },
  { slug: "redox", title: tx("Redox reactions", "Redoxreaktionen"), de: "Redoxreaktionen", area: "reactions", blurb: tx("Oxidation numbers, who gives electrons and who takes them.", "Oxidationszahlen und wer Elektronen abgibt und wer sie aufnimmt."), glyph: "\\ce{Fe^3+ + e-}", minutes: 10, lessonLevel: 2 },
  { slug: "moles", title: tx("The mole", "Stoffmenge und Mol"), de: "Stoffmenge", area: "chemcalc", blurb: tx("Molar mass, amount of substance and concentration, with real numbers.", "Molare Masse, Stoffmenge und Konzentration, mit echten Zahlen."), glyph: "n = \\frac{m}{M}", minutes: 10, lessonLevel: 2 },
  { slug: "alkanes", title: tx("Alkanes", "Alkane"), de: "Alkane", area: "organic", blurb: tx("Methane to decane: formulas, names and the homologous series.", "Von Methan bis Decan: Formeln, Namen und die homologe Reihe."), glyph: "\\ce{CH4}", minutes: 9, lessonLevel: 2 },
];

const L = (en: string, de: string) => tx(en, de);
const G56 = L("Grades 5–6", "Klasse 5–6");
const G79 = L("Grades 7–9", "Klasse 7–9");
const G78 = L("Grades 7–8", "Klasse 7–8");
const G910 = L("Grades 9–10", "Klasse 9–10");
const G810 = L("Grades 8–10", "Klasse 8–10");
const UP = L("Upper school", "Oberstufe");
const UPU = L("Upper school and university", "Oberstufe und Studium");

/**
 * Biology topics in the order they're suggested. Every topic has three levels: beginner
 * (first contact at school), intermediate (the standard of grades 7–10) and expert (Oberstufe,
 * Abitur, sometimes first university steps). How deep "expert" goes depends on the topic.
 */
const BIOLOGY_ENTRIES: Entry[] = [
  {
    slug: "cell", title: L("The cell", "Die Zelle"), de: "Zellaufbau", area: "cells", icon: "microscope", glyph: '"Zelle"',
    blurb: L("Plant and animal cells, their organelles, and how a cell controls what gets in.", "Pflanzen- und Tierzelle, ihre Organellen und wie eine Zelle kontrolliert, was hineinkommt."),
    levels: {
      1: { depth: G56, minutes: 9, blurb: L("Cells as building blocks: plant and animal cells under the light microscope.", "Zellen als Bausteine: Pflanzen- und Tierzelle unter dem Lichtmikroskop.") },
      2: { depth: G79, minutes: 10, blurb: L("Organelles and their jobs, bacteria versus our cells, and working out magnification.", "Organellen und ihre Aufgaben, Bakterien im Vergleich zu unseren Zellen und Vergrößerung berechnen.") },
      3: { depth: UP, minutes: 12, blurb: L("Biomembranes, diffusion and osmosis, transport across membranes and the endosymbiotic theory.", "Biomembranen, Diffusion und Osmose, Membrantransport und die Endosymbiontentheorie.") },
    },
  },
  {
    slug: "cell-division", title: L("Cell division", "Zellteilung"), de: "Mitose und Meiose", area: "cells", icon: "split", glyph: '"Mitose"',
    blurb: L("How one cell becomes two, why chromosomes matter, and how sex cells are made.", "Wie aus einer Zelle zwei werden, warum Chromosomen wichtig sind und wie Keimzellen entstehen."),
    levels: {
      1: { depth: G78, minutes: 8, blurb: L("Growing by dividing: chromosomes and two identical daughter cells.", "Wachsen durch Teilen: Chromosomen und zwei gleiche Tochterzellen.") },
      2: { depth: G910, minutes: 10, blurb: L("The phases of mitosis, the cell cycle, and meiosis making haploid sex cells.", "Die Phasen der Mitose, der Zellzyklus und die Meiose, die haploide Keimzellen bildet.") },
      3: { depth: UP, minutes: 12, blurb: L("Meiosis I and II in detail, crossing over, nondisjunction and cell cycle control.", "Meiose I und II im Detail, Crossing-over, Fehlverteilung und die Kontrolle des Zellzyklus.") },
    },
  },
  {
    slug: "enzymes", title: L("Enzymes", "Enzyme"), de: "Enzyme", area: "cells", icon: "key", glyph: '"Enzym"',
    blurb: L("Biocatalysts that speed up the reactions of life, and what makes them fast or slow.", "Biokatalysatoren, die die Reaktionen des Lebens beschleunigen, und was sie schnell oder langsam macht."),
    levels: {
      1: { depth: G78, minutes: 8, blurb: L("Enzymes as biocatalysts and the lock and key model, with amylase and starch.", "Enzyme als Biokatalysatoren und das Schlüssel-Schloss-Prinzip, mit Amylase und Stärke.") },
      2: { depth: G910, minutes: 10, blurb: L("Active site, specificity, activation energy, and how temperature and pH change activity.", "Aktives Zentrum, Spezifität, Aktivierungsenergie und wie Temperatur und pH-Wert die Aktivität verändern.") },
      3: { depth: UPU, minutes: 12, blurb: L("Enzyme kinetics with vmax and Km, inhibition, cofactors and feedback control.", "Enzymkinetik mit vmax und KM, Hemmung, Cofaktoren und Endprodukthemmung.") },
    },
  },
  {
    slug: "plant-structure", title: L("How plants are built", "Bau der Blütenpflanze"), de: "Bau der Blütenpflanze", area: "botany", icon: "sprout", glyph: '"Wurzel"',
    blurb: L("Root, shoot and leaf: what each part does and how water travels up a plant.", "Wurzel, Sprossachse und Blatt: was jedes Teil leistet und wie Wasser in der Pflanze nach oben steigt."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("The basic organs of a flowering plant and their jobs, and what a seed needs to germinate.", "Die Grundorgane einer Blütenpflanze und ihre Aufgaben und was ein Samen zum Keimen braucht.") },
      2: { depth: G79, minutes: 10, blurb: L("Inside a leaf, vascular bundles, stomata and the transpiration stream.", "Der Blattaufbau, Leitbündel, Spaltöffnungen und der Transpirationsstrom.") },
      3: { depth: UP, minutes: 12, blurb: L("Plant tissues, secondary growth, how stomata open and close, and adaptations to dry and wet places.", "Pflanzengewebe, sekundäres Dickenwachstum, wie Spaltöffnungen öffnen und schließen und Angepasstheit an trockene und nasse Standorte.") },
    },
  },
  {
    slug: "photosynthesis", title: L("Photosynthesis", "Fotosynthese"), de: "Fotosynthese", area: "botany", icon: "sun", glyph: "\\ce{CO2 + H2O}",
    blurb: L("How plants turn light, water and carbon dioxide into sugar and oxygen.", "Wie Pflanzen aus Licht, Wasser und Kohlenstoffdioxid Zucker und Sauerstoff machen."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("Plants make their own food: what goes in, what comes out, and the starch test.", "Pflanzen stellen ihre Nahrung selbst her: was hineingeht, was herauskommt und der Stärkenachweis.") },
      2: { depth: G79, minutes: 10, blurb: L("The equation, chloroplasts, limiting factors and cellular respiration as the opposite.", "Die Reaktionsgleichung, Chloroplasten, begrenzende Faktoren und die Zellatmung als Gegenstück.") },
      3: { depth: UP, minutes: 13, blurb: L("Light-dependent reactions, chemiosmosis, the Calvin cycle, and C4 and CAM plants.", "Lichtabhängige Reaktionen, Chemiosmose, der Calvin-Zyklus sowie C4- und CAM-Pflanzen.") },
    },
  },
  {
    slug: "flowers-seeds", title: L("Flowers, pollination and seeds", "Blüte, Bestäubung und Samen"), de: "Fortpflanzung der Pflanzen", area: "botany", icon: "flower", glyph: '"Blüte"',
    blurb: L("The parts of a flower, how pollen travels, and how a flower becomes fruit and seeds.", "Die Teile einer Blüte, wie Pollen reisen und wie aus einer Blüte Frucht und Samen werden."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("The parts of a flower, pollination, fertilisation, fruits and how seeds spread.", "Die Teile der Blüte, Bestäubung, Befruchtung, Früchte und wie sich Samen verbreiten.") },
      2: { depth: G79, minutes: 10, blurb: L("Insect and wind pollination, the pollen tube, seed structure, germination and vegetative reproduction.", "Insekten- und Windbestäubung, der Pollenschlauch, Samenaufbau, Keimung und ungeschlechtliche Vermehrung.") },
      3: { depth: UP, minutes: 12, blurb: L("The embryo sac, double fertilisation, alternation of generations and self-incompatibility.", "Der Embryosack, die doppelte Befruchtung, der Generationswechsel und die Selbstinkompatibilität.") },
    },
  },
  {
    slug: "plant-diversity", title: L("Plant diversity", "Pflanzenvielfalt"), de: "Pflanzen bestimmen", area: "botany", icon: "trees", glyph: '"Rose"',
    blurb: L("Recognise trees, early bloomers and plant families, and see how plants conquered the land.", "Bäume, Frühblüher und Pflanzenfamilien erkennen und sehen, wie Pflanzen das Land erobert haben."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("Deciduous and coniferous trees, leaf shapes, early bloomers and their storage organs.", "Laub- und Nadelbäume, Blattformen, Frühblüher und ihre Speicherorgane.") },
      2: { depth: G79, minutes: 10, blurb: L("Plant families and their flowers, floral formulas and using a key.", "Pflanzenfamilien und ihre Blüten, Blütenformeln und das Bestimmen mit einem Schlüssel.") },
      3: { depth: UP, minutes: 12, blurb: L("Mosses, ferns and seed plants, the move onto land, and naming species the scientific way.", "Moose, Farne und Samenpflanzen, der Landgang und die wissenschaftliche Benennung von Arten.") },
    },
  },
  {
    slug: "vertebrates", title: L("Vertebrates", "Wirbeltiere"), de: "Wirbeltierklassen", area: "zoology", icon: "fish", glyph: '"Wirbeltiere"',
    blurb: L("Fish, amphibians, reptiles, birds and mammals: their features and how they fit their habitats.", "Fische, Amphibien, Reptilien, Vögel und Säugetiere: ihre Merkmale und wie sie an ihren Lebensraum angepasst sind."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("The five classes of vertebrates and the features that tell them apart.", "Die fünf Wirbeltierklassen und die Merkmale, an denen du sie unterscheidest.") },
      2: { depth: G79, minutes: 10, blurb: L("Adaptations to water, land and air, the vertebrate skeleton and surviving winter.", "Angepasstheit an Wasser, Land und Luft, das Wirbeltierskelett und das Überwintern.") },
      3: { depth: UP, minutes: 12, blurb: L("Homology and analogy, the vertebrate family tree, hearts in evolution and temperature control.", "Homologie und Analogie, der Stammbaum der Wirbeltiere, die Evolution des Herzens und die Temperaturregulation.") },
    },
  },
  {
    slug: "digestion", title: L("Food and digestion", "Ernährung und Verdauung"), de: "Ernährung und Verdauung", area: "human", icon: "apple", glyph: '"Nährstoffe"',
    blurb: L("Nutrients, the journey of food through the body and how it gets into the blood.", "Nährstoffe, die Reise der Nahrung durch den Körper und wie sie ins Blut gelangt."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("Nutrients and a balanced diet, and the way food travels through the body.", "Nährstoffe und ausgewogene Ernährung und der Weg der Nahrung durch den Körper.") },
      2: { depth: G79, minutes: 10, blurb: L("Digestive enzymes, building blocks, absorption in the small intestine and food tests.", "Verdauungsenzyme, Bausteine, Resorption im Dünndarm und Nachweisreaktionen.") },
      3: { depth: UP, minutes: 12, blurb: L("Absorption mechanisms, hormones of digestion, blood sugar control and energy balance.", "Resorptionsmechanismen, Verdauungshormone, Blutzuckerregulation und Energiebilanz.") },
    },
  },
  {
    slug: "circulation", title: L("Heart, blood and circulation", "Herz, Blut und Kreislauf"), de: "Blutkreislauf", area: "human", icon: "heart", glyph: '"Herz"',
    blurb: L("How the heart pumps, the double circulation, and what blood carries.", "Wie das Herz pumpt, der doppelte Kreislauf und was das Blut transportiert."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("The heart as a pump, blood vessels, the pulse, and breathing.", "Das Herz als Pumpe, Blutgefäße, der Puls und die Atmung.") },
      2: { depth: G79, minutes: 10, blurb: L("Chambers and valves, the double circulation, blood components, gas exchange and blood groups.", "Kammern und Klappen, der doppelte Kreislauf, Blutbestandteile, Gasaustausch und Blutgruppen.") },
      3: { depth: UP, minutes: 12, blurb: L("Haemoglobin and the oxygen curve, the cardiac cycle, the heart's own pacemaker and cardiac output.", "Hämoglobin und die Sauerstoffbindungskurve, der Herzzyklus, der Schrittmacher des Herzens und das Herzminutenvolumen.") },
    },
  },
  {
    slug: "nervous-system", title: L("Nerves and senses", "Nervensystem und Sinne"), de: "Nervensystem", area: "human", icon: "brain", glyph: '"Reiz"',
    blurb: L("From stimulus to response: senses, nerves, the brain and how a nerve impulse works.", "Vom Reiz zur Reaktion: Sinne, Nerven, das Gehirn und wie ein Nervenimpuls funktioniert."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("The senses, stimulus and response, and how the eye works.", "Die Sinne, Reiz und Reaktion und wie das Auge funktioniert.") },
      2: { depth: G79, minutes: 10, blurb: L("Brain and spinal cord, the reflex arc, the neuron and the synapse.", "Gehirn und Rückenmark, der Reflexbogen, die Nervenzelle und die Synapse.") },
      3: { depth: UP, minutes: 13, blurb: L("Resting and action potential, saltatory conduction, synapses in detail and synaptic poisons.", "Ruhe- und Aktionspotenzial, saltatorische Erregungsleitung, die Synapse im Detail und Synapsengifte.") },
    },
  },
  {
    slug: "immune-system", title: L("The immune system", "Immunsystem"), de: "Immunbiologie", area: "human", icon: "shield", glyph: '"Antikörper"',
    blurb: L("Bacteria and viruses, how the body fights back, and how vaccines help.", "Bakterien und Viren, wie sich der Körper wehrt und wie Impfungen helfen."),
    levels: {
      1: { depth: G78, minutes: 8, blurb: L("Pathogens, the body's barriers, fever, antibiotics and the idea of vaccination.", "Krankheitserreger, die Schutzbarrieren des Körpers, Fieber, Antibiotika und die Idee des Impfens.") },
      2: { depth: G810, minutes: 10, blurb: L("Bacteria versus viruses, phagocytes, B and T cells, antibodies and memory cells.", "Bakterien und Viren im Vergleich, Fresszellen, B- und T-Zellen, Antikörper und Gedächtniszellen.") },
      3: { depth: UP, minutes: 12, blurb: L("Humoral and cellular response, clonal selection, antibody structure, HIV and allergies.", "Humorale und zelluläre Immunantwort, klonale Selektion, Antikörperbau, HIV und Allergien.") },
    },
  },
  {
    slug: "genetics", title: L("Inheritance", "Vererbung"), de: "Klassische Genetik", area: "genetics", icon: "grid", glyph: '"Aa"',
    blurb: L("Mendel's rules, Punnett squares and family trees: how traits are passed on.", "Mendelsche Regeln, Kreuzungsschemata und Stammbäume: wie Merkmale vererbt werden."),
    levels: {
      1: { depth: G79, minutes: 8, blurb: L("Genes and traits, dominant and recessive, genotype and phenotype, Mendel's peas.", "Gene und Merkmale, dominant und rezessiv, Genotyp und Phänotyp, Mendels Erbsen.") },
      2: { depth: G910, minutes: 11, blurb: L("Punnett squares, Mendel's three laws, test crosses, blood groups and family trees.", "Kreuzungsschemata, die drei Mendelschen Regeln, Rückkreuzung, Blutgruppen und Stammbäume.") },
      3: { depth: UP, minutes: 12, blurb: L("Sex-linked inheritance, gene linkage and recombination frequency, and probabilities in pedigrees.", "Geschlechtsgebundene Vererbung, Genkopplung und Rekombinationshäufigkeit und Wahrscheinlichkeiten in Stammbäumen.") },
    },
  },
  {
    slug: "dna", title: L("DNA and protein synthesis", "DNA und Proteinbiosynthese"), de: "Molekulargenetik", area: "genetics", icon: "dna", glyph: '"A–T"',
    blurb: L("The double helix, how DNA is copied, and how a gene becomes a protein.", "Die Doppelhelix, wie DNA kopiert wird und wie aus einem Gen ein Protein wird."),
    levels: {
      1: { depth: G910, minutes: 8, blurb: L("DNA carries the genetic information: double helix, four bases and base pairing.", "Die DNA trägt die Erbinformation: Doppelhelix, vier Basen und Basenpaarung.") },
      2: { depth: G910, minutes: 11, blurb: L("Nucleotides, replication, transcription, translation with the genetic code, and mutations.", "Nukleotide, Replikation, Transkription, Translation mit dem genetischen Code und Mutationen.") },
      3: { depth: UPU, minutes: 13, blurb: L("Replication in detail, RNA processing and splicing, gene regulation with the lac operon, and gene technology.", "Replikation im Detail, RNA-Prozessierung und Spleißen, Genregulation am lac-Operon und Gentechnik.") },
    },
  },
  {
    slug: "evolution", title: L("Evolution", "Evolution"), de: "Evolution", area: "evolution", icon: "branch", glyph: '"Selektion"',
    blurb: L("Fossils, variation and natural selection: how species change and new ones arise.", "Fossilien, Variation und natürliche Selektion: wie sich Arten verändern und neue entstehen."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("Fossils, variation, adaptation and natural selection, and reading a family tree.", "Fossilien, Variation, Angepasstheit und natürliche Selektion und wie man einen Stammbaum liest.") },
      2: { depth: G910, minutes: 10, blurb: L("Lamarck and Darwin, the factors of evolution, speciation and evidence for evolution.", "Lamarck und Darwin, die Evolutionsfaktoren, Artbildung und Belege für die Evolution.") },
      3: { depth: UP, minutes: 13, blurb: L("Population genetics with Hardy-Weinberg, forms of selection, coevolution and molecular evidence.", "Populationsgenetik mit dem Hardy-Weinberg-Gesetz, Selektionsformen, Koevolution und molekulare Belege.") },
    },
  },
  {
    slug: "ecosystems", title: L("Ecosystems", "Ökosysteme"), de: "Ökologie", area: "ecology", icon: "leaf", glyph: '"Nahrungsnetz"',
    blurb: L("Food chains and webs, energy flow, cycles of matter and how populations grow.", "Nahrungsketten und -netze, Energiefluss, Stoffkreisläufe und wie Populationen wachsen."),
    levels: {
      1: { depth: G56, minutes: 8, blurb: L("Habitats, food chains and webs, producers, consumers and decomposers.", "Lebensräume, Nahrungsketten und -netze, Produzenten, Konsumenten und Destruenten.") },
      2: { depth: G79, minutes: 10, blurb: L("Biotic and abiotic factors, tolerance curves, energy flow, the carbon cycle and predator and prey.", "Biotische und abiotische Faktoren, Toleranzkurven, Energiefluss, der Kohlenstoffkreislauf sowie Räuber und Beute.") },
      3: { depth: UP, minutes: 13, blurb: L("Population growth, Lotka-Volterra, competition and niches, the nitrogen cycle and succession.", "Populationswachstum, Lotka-Volterra-Regeln, Konkurrenz und Nischen, der Stickstoffkreislauf und die Sukzession.") },
    },
  },
];

for (const t of [...MATHS_ENTRIES, ...CHEMISTRY_ENTRIES]) LEGACY_LESSON_LEVEL[t.slug] = t.lessonLevel;

export const MATHS_CATALOG: TopicMeta[] = MATHS_ENTRIES.map((t) => ({ ...single("maths", t), subject: "maths" }));
export const CHEMISTRY_CATALOG: TopicMeta[] = CHEMISTRY_ENTRIES.map((t) => ({ ...single("chemistry", t), subject: "chemistry" }));
export const BIOLOGY_CATALOG: TopicMeta[] = BIOLOGY_ENTRIES.map((t) => ({ ...t, subject: "biology" }));
/** Every topic of every live subject. */
export const CATALOG: TopicMeta[] = [...MATHS_CATALOG, ...CHEMISTRY_CATALOG, ...BIOLOGY_CATALOG];

const BY_SUBJECT: Record<Subject, TopicMeta[]> = { maths: MATHS_CATALOG, chemistry: CHEMISTRY_CATALOG, biology: BIOLOGY_CATALOG };
export const subjectCatalog = (subject: Subject) => BY_SUBJECT[subject];

/** Levels whose lesson is written. */
export const lessonLevels = (t: Pick<TopicMeta, "levels">) => ([1, 2, 3] as Level[]).filter((l) => t.levels[l].minutes);
/** Minutes of the first written lesson (for cards). */
export const firstLessonMinutes = (t: Pick<TopicMeta, "levels">) => t.levels[lessonLevels(t)[0] ?? 1].minutes ?? 0;

export function topicMeta(slug: string): TopicMeta {
  const meta = CATALOG.find((t) => t.slug === slug);
  if (!meta) throw new Error(`Unknown topic: ${slug}`);
  return meta;
}

export const findTopicMeta = (slug: string) => CATALOG.find((t) => t.slug === slug);

/** Where a topic lives: its overview page, lesson and practice. */
export const topicHref = (t: Pick<TopicMeta, "slug" | "subject">, level?: Level) => `/learn/${t.subject}/${t.slug}${level ? `?level=${level}` : ""}`;
export const studyHref = (t: Pick<TopicMeta, "slug" | "subject">, part: "lesson" | "practice", level?: Level) =>
  `/study/${t.subject}/${t.slug}/${part}${level ? `?level=${level}` : ""}`;

export type SubjectInfo = { slug: string; title: Text; live: boolean; areas?: Area[] };

/** Subjects shown in the learning center. */
export const SUBJECTS: SubjectInfo[] = [
  { slug: "maths", title: tx("Maths", "Mathe"), live: true, areas: ["algebra", "numbers", "equations", "functions", "applied"] },
  { slug: "chemistry", title: tx("Chemistry", "Chemie"), live: true, areas: ["matter", "atoms", "bonding", "reactions", "chemcalc", "organic"] },
  { slug: "biology", title: tx("Biology", "Biologie"), live: true, areas: ["cells", "botany", "zoology", "human", "genetics", "evolution", "ecology"] },
  { slug: "physics", title: tx("Physics", "Physik"), live: false },
  { slug: "english", title: tx("English", "Englisch"), live: false },
];

export const isSubject = (s: string): s is Subject => SUBJECTS.some((x) => x.slug === s && x.live);

/** The subject the student worked on most recently (maths for a fresh start). */
export function lastSubject(progress: Record<string, TopicProgress>): Subject {
  const latest = Object.values(progress)
    .filter((p) => findTopicMeta(p.topic))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  return latest ? findTopicMeta(latest.topic)!.subject : "maths";
}

/** Which topic to suggest: the first lesson not done yet, else the weakest topic. */
export function upNext(catalog: TopicMeta[], progress: Record<string, TopicProgress>): TopicMeta {
  const fresh = catalog.find((t) => !progress[t.slug]?.lesson_done);
  if (fresh) return fresh;
  return [...catalog].sort((a, b) => (progress[a.slug]?.mastery ?? 0) - (progress[b.slug]?.mastery ?? 0))[0];
}
