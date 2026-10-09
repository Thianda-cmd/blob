import { tx, type Text } from "@/i18n/text";
import type { TopicProgress } from "./progress";
import { LEVELS, type Area, type Level } from "./types";

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
  /** A picture instead of the glyph: a name from the ICONS map in components/TopicGlyph.tsx (biology). */
  icon?: string;
  /** The three levels: how deep each goes and which lessons exist. */
  levels: Record<Level, LevelMeta>;
};

type Entry = Omit<TopicMeta, "subject">;

/** A topic from before levels: its one lesson sits at `lessonLevel`, the other levels come later. */
type SingleEntry = Omit<Entry, "levels"> & { minutes: number; lessonLevel: Level };

/** How deep each level goes in a subject, for topics whose levels aren't written yet. */
const DEPTH: Record<"chemistry", Record<Level, Text>> = {
  chemistry: { 1: tx("Grades 7–8", "Klasse 7–8"), 2: tx("Grades 9–10", "Klasse 9–10"), 3: tx("Upper school", "Oberstufe") },
};

function single(subject: "chemistry", { minutes, lessonLevel, ...entry }: SingleEntry): Entry {
  const levels = { 1: { depth: DEPTH[subject][1] }, 2: { depth: DEPTH[subject][2] }, 3: { depth: DEPTH[subject][3] } } as Record<Level, LevelMeta>;
  levels[lessonLevel] = { ...levels[lessonLevel], blurb: entry.blurb, minutes };
  return { ...entry, levels };
}

/** The level of the lesson a topic had before levels (its old progress row counts for it). */
export const LEGACY_LESSON_LEVEL: Record<string, Level> = {};

const L = (en: string, de: string) => tx(en, de);
/** "Klasse a–b" (or just "Klasse a"). */
const G = (a: number, b?: number) => (b ? L(`Grades ${a}–${b}`, `Klasse ${a}–${b}`) : L(`Grade ${a}`, `Klasse ${a}`));
const G56 = G(5, 6);
const G79 = G(7, 9);
const G78 = G(7, 8);
const G910 = G(9, 10);
const G810 = G(8, 10);
const UP = L("Upper school", "Oberstufe");
const UP10 = L("Grade 10 and upper school", "Klasse 10 und Oberstufe");
const UPU = L("Upper school and university", "Oberstufe und Studium");

/**
 * Maths topics in the order they're suggested. Each level builds on the one before: beginner
 * (first contact), intermediate (the standard of class tests) and expert (up to Oberstufe).
 */
const MATHS_ENTRIES: Entry[] = [
  {
    slug: "negative-numbers", title: L("Negative numbers", "Negative Zahlen"), de: "Ganze und rationale Zahlen", area: "numbers", glyph: "-3 + 5",
    blurb: L("Below zero: the number line, adding and subtracting, and the sign rules.", "Unter null: die Zahlengerade, Addieren und Subtrahieren und die Vorzeichenregeln."),
    levels: {
      1: { depth: G56, minutes: 9, blurb: L("The number line, ordering and comparing, temperatures and bank balances, adding and subtracting negative numbers.", "Die Zahlengerade, Ordnen und Vergleichen, Temperaturen und Kontostände, negative Zahlen addieren und subtrahieren.") },
      2: { depth: G(6, 7), minutes: 10, blurb: L("Multiplying and dividing with the sign rules, the order of operations, and negative fractions and decimals.", "Multiplizieren und Dividieren mit den Vorzeichenregeln, die Rechenreihenfolge und negative Brüche und Dezimalzahlen.") },
      3: { depth: G78, minutes: 10, blurb: L("Absolute value as distance, powers with negative bases, and the laws of arithmetic for clever calculating.", "Der Betrag als Abstand, Potenzen mit negativer Basis und die Rechengesetze für geschicktes Rechnen.") },
    },
  },
  {
    slug: "brackets", title: L("Removing brackets", "Klammern auflösen"), de: "Klammern auflösen", area: "algebra", glyph: "-(a - b)",
    blurb: L("Plus or minus in front? Learn when signs stay and when they flip.", "Plus oder Minus davor? Lerne, wann Vorzeichen bleiben und wann du sie umdrehst."),
    levels: {
      1: { depth: G(7), minutes: 7, blurb: L("Plus or minus in front of a bracket: when the signs stay and when they flip, also with brackets inside brackets.", "Plus oder Minus vor der Klammer: wann die Vorzeichen bleiben und wann sie sich umdrehen, auch bei Klammern in Klammern.") },
      2: { depth: G78, minutes: 9, blurb: L("Long terms with several brackets and a factor in front, like 4x − 2(3x − 5): step by step to the simplest form.", "Lange Terme mit mehreren Klammern und einem Faktor davor wie 4x − 2(3x − 5): Schritt für Schritt zur einfachsten Form.") },
      3: { depth: G(8, 9), minutes: 10, blurb: L("Factoring out: put common factors with variables and powers in front of a bracket, factor out −1, and use it to simplify.", "Ausklammern: gemeinsame Faktoren mit Variablen und Potenzen vor die Klammer ziehen, −1 ausklammern und damit vereinfachen.") },
    },
  },
  {
    slug: "expanding", title: L("Expanding brackets", "Ausmultiplizieren"), de: "Ausmultiplizieren", area: "algebra", glyph: "a(b + c)",
    blurb: L("Multiply into brackets, two brackets at once and the binomial formulas.", "In Klammern hineinmultiplizieren, zwei Klammern auf einmal und die binomischen Formeln."),
    levels: {
      1: { depth: G(7), minutes: 8, blurb: L("The distributive law with numbers and one variable, the area model, and collecting like terms.", "Das Distributivgesetz mit Zahlen und einer Variablen, das Flächenmodell und gleichartige Terme zusammenfassen.") },
      2: { depth: G(8), minutes: 9, blurb: L("Multiply into brackets, two brackets at once and the binomial formulas.", "In Klammern hineinmultiplizieren, zwei Klammern auf einmal und die binomischen Formeln.") },
      3: { depth: G910, minutes: 11, blurb: L("The binomial formulas backwards to factorise, (a + b)³ and Pascal's triangle, and the binomial theorem.", "Die binomischen Formeln rückwärts zum Faktorisieren, (a + b)³ und das Pascalsche Dreieck und der binomische Lehrsatz.") },
    },
  },
  {
    slug: "rearranging", title: L("Rearranging formulas", "Formeln umstellen"), de: "Formeln umstellen", area: "algebra", glyph: "v = \\frac{s}{t}",
    blurb: L("Get any letter on its own, step by step, with inverse operations.", "Bring jeden Buchstaben allein auf eine Seite, Schritt für Schritt mit Umkehroperationen."),
    levels: {
      1: { depth: G(6, 7), minutes: 7, blurb: L("Formulas you know (perimeter, area, speed): insert values, calculate, and rearrange in one step.", "Formeln, die du kennst (Umfang, Flächeninhalt, Geschwindigkeit): Werte einsetzen, ausrechnen und in einem Schritt umstellen.") },
      2: { depth: G(8, 9), minutes: 8, blurb: L("Get any letter on its own, step by step, with inverse operations.", "Bring jeden Buchstaben allein auf eine Seite, Schritt für Schritt mit Umkehroperationen.") },
      3: { depth: UP10, minutes: 11, blurb: L("Harder formulas: the letter appears twice, reciprocal formulas like 1/f = 1/g + 1/b, roots and powers.", "Schwierigere Formeln: der Buchstabe kommt zweimal vor, Kehrwertformeln wie 1/f = 1/g + 1/b, Wurzeln und Potenzen.") },
    },
  },
  {
    slug: "fractions", title: L("Fractions", "Bruchrechnung"), de: "Bruchrechnung", area: "numbers", glyph: "\\frac{3}{4}",
    blurb: L("Simplify, add, subtract, multiply and divide fractions with confidence.", "Brüche sicher kürzen, addieren, subtrahieren, multiplizieren und dividieren."),
    levels: {
      1: { depth: G(6), minutes: 10, blurb: L("Simplify, add, subtract, multiply and divide fractions with confidence.", "Brüche sicher kürzen, addieren, subtrahieren, multiplizieren und dividieren.") },
      2: { depth: G(6, 7), minutes: 10, blurb: L("Fractions, decimals and percentages both ways, repeating decimals, comparing and ordering, and the order of operations with fractions.", "Brüche, Dezimalzahlen und Prozente in beide Richtungen, periodische Dezimalzahlen, Vergleichen und Ordnen und die Rechenreihenfolge mit Brüchen.") },
      3: { depth: G(8, 9), minutes: 12, blurb: L("Algebraic fractions: the domain, simplifying by factorising, common denominators, and fractional equations.", "Bruchterme: die Definitionsmenge, Kürzen durch Faktorisieren, der Hauptnenner und Bruchgleichungen.") },
    },
  },
  {
    slug: "powers-roots", title: L("Powers and roots", "Potenzen und Wurzeln"), de: "Potenzen und Wurzeln", area: "numbers", glyph: "a^n",
    blurb: L("Power rules, negative exponents and simplifying square roots.", "Potenzgesetze, negative Exponenten und Wurzeln vereinfachen."),
    levels: {
      1: { depth: G(5, 7), minutes: 8, blurb: L("Squares, cubes and powers of ten, big numbers, square roots of square numbers, and why −3² is not (−3)².", "Quadrat-, Kubik- und Zehnerpotenzen, große Zahlen, Wurzeln aus Quadratzahlen und warum −3² nicht (−3)² ist.") },
      2: { depth: G(8, 9), minutes: 9, blurb: L("Power rules, negative exponents, scientific notation and simplifying square roots.", "Potenzgesetze, negative Exponenten, wissenschaftliche Schreibweise und Wurzeln vereinfachen.") },
      3: { depth: UP10, minutes: 12, blurb: L("Rational exponents and nth roots, rationalising denominators, logarithms and the log rules, exponential equations.", "Rationale Exponenten und n-te Wurzeln, Nenner rational machen, Logarithmen und Logarithmengesetze, Exponentialgleichungen.") },
    },
  },
  {
    slug: "percentages", title: L("Percentages", "Prozentrechnung"), de: "Prozentrechnung", area: "numbers", glyph: "25 %",
    blurb: L("Percentage, base value and percent rate, plus increases and discounts.", "Grundwert, Prozentwert und Prozentsatz, dazu Erhöhungen und Rabatte."),
    levels: {
      1: { depth: G(6, 7), minutes: 8, blurb: L("Percentage, base value and percent rate, plus increases and discounts.", "Grundwert, Prozentwert und Prozentsatz, dazu Erhöhungen und Rabatte.") },
      2: { depth: G78, minutes: 10, blurb: L("Interest for years, months and days, VAT, and several discounts and surcharges in a row.", "Zinsen für Jahre, Monate und Tage, Mehrwertsteuer und mehrere Rabatte und Aufschläge nacheinander.") },
      3: { depth: UP10, minutes: 11, blurb: L("Compound interest, exponential growth and decay, half-life and doubling time: linear or exponential?", "Zinseszins, exponentielles Wachstum und exponentielle Abnahme, Halbwertszeit und Verdopplungszeit: linear oder exponentiell?") },
    },
  },
  {
    slug: "equations", title: L("Equations and inequalities", "Gleichungen und Ungleichungen"), de: "Gleichungen und Ungleichungen", area: "equations", glyph: "2x + 3 = 11",
    blurb: L("Solve linear equations and inequalities, and know when the sign flips.", "Lineare Gleichungen und Ungleichungen lösen und wissen, wann sich das Zeichen umdreht."),
    levels: {
      1: { depth: G(7), minutes: 10, blurb: L("Solve linear equations and inequalities, and know when the sign flips.", "Lineare Gleichungen und Ungleichungen lösen und wissen, wann sich das Zeichen umdreht.") },
      2: { depth: G(8), minutes: 10, blurb: L("Equations with fractions and decimals, no or infinitely many solutions, ratio equations, and solution sets of inequalities.", "Gleichungen mit Brüchen und Dezimalzahlen, keine oder unendlich viele Lösungen, Verhältnisgleichungen und Lösungsmengen von Ungleichungen.") },
      3: { depth: G910, minutes: 12, blurb: L("Absolute value equations and inequalities with case analysis, root equations, and checking for false solutions.", "Betragsgleichungen und -ungleichungen mit Fallunterscheidung, Wurzelgleichungen und die Probe gegen Scheinlösungen.") },
    },
  },
  {
    slug: "linear-systems", title: L("Systems of equations", "Lineare Gleichungssysteme"), de: "Lineare Gleichungssysteme", area: "equations", glyph: "x + y = 5",
    blurb: L("Two equations, two unknowns: substitution, elimination and graphs.", "Zwei Gleichungen, zwei Unbekannte: Einsetzen, Gleichsetzen, Addieren und Graphen."),
    levels: {
      1: { depth: G78, minutes: 8, blurb: L("Two conditions at once: test a pair of numbers, solve with a table or where two lines cross, and simple substitution.", "Zwei Bedingungen auf einmal: ein Zahlenpaar testen, mit einer Tabelle oder am Schnittpunkt zweier Geraden lösen und einfaches Einsetzen.") },
      2: { depth: G(8, 9), minutes: 10, blurb: L("Two equations, two unknowns: substitution, elimination and graphs.", "Zwei Gleichungen, zwei Unbekannte: Einsetzen, Gleichsetzen, Addieren und Graphen.") },
      3: { depth: UP, minutes: 12, blurb: L("Three equations, three unknowns: the Gauss algorithm, special cases, and the parabola through three points.", "Drei Gleichungen, drei Unbekannte: das Gauß-Verfahren, Sonderfälle und die Parabel durch drei Punkte.") },
    },
  },
  {
    slug: "pq-formula", title: L("Quadratic equations", "Quadratische Gleichungen"), de: "Quadratische Gleichungen", area: "equations", glyph: "x^2 + px + q",
    blurb: L("Solve any quadratic equation, read the discriminant and see it on the parabola.", "Jede quadratische Gleichung lösen, die Diskriminante deuten und alles an der Parabel sehen."),
    levels: {
      1: { depth: G(8, 9), minutes: 8, blurb: L("Quadratic equations without a formula: take the root (x² = 25 has two solutions), factor out x and use the zero product rule.", "Quadratische Gleichungen ohne Formel: Wurzel ziehen (x² = 25 hat zwei Lösungen), x ausklammern und den Satz vom Nullprodukt nutzen.") },
      2: { depth: G(9), minutes: 9, blurb: L("Solve any quadratic equation in normal form with the pq formula, and read the discriminant.", "Jede quadratische Gleichung in Normalform mit der pq-Formel lösen und die Diskriminante deuten.") },
      3: { depth: UP10, minutes: 12, blurb: L("Parabolas in vertex form by completing the square, the abc formula, factorised form with Vieta, and biquadratic equations.", "Parabeln in Scheitelpunktform durch quadratische Ergänzung, die abc-Formel, die faktorisierte Form mit Vieta und biquadratische Gleichungen.") },
    },
  },
  {
    slug: "lines", title: L("Straight lines", "Geraden"), de: "Geraden", area: "functions", glyph: "y = mx + b",
    blurb: L("Slope, y-intercept and the line through two points, on a live graph.", "Steigung, y-Achsenabschnitt und die Gerade durch zwei Punkte, am lebendigen Graphen."),
    levels: {
      1: { depth: G(6, 7), minutes: 8, blurb: L("The coordinate system, points in all four quadrants, tables of values, and proportional functions y = mx.", "Das Koordinatensystem, Punkte in allen vier Quadranten, Wertetabellen und proportionale Funktionen y = mx.") },
      2: { depth: G(8), minutes: 10, blurb: L("Slope, y-intercept and the line through two points, on a live graph.", "Steigung, y-Achsenabschnitt und die Gerade durch zwei Punkte, am lebendigen Graphen.") },
      3: { depth: UP10, minutes: 11, blurb: L("Where two lines meet, the slope angle (tan α = m), distances and midpoints, and the perpendicular through a point.", "Wo sich zwei Geraden schneiden, der Steigungswinkel (tan α = m), Abstände und Mittelpunkte und die Senkrechte durch einen Punkt.") },
    },
  },
  {
    slug: "area-volume", title: L("Area and volume", "Flächen und Körper"), de: "Flächeninhalt und Volumen", area: "geometry", glyph: "A = a \\cdot b",
    blurb: L("Perimeter, area and volume: from rectangles and cuboids to circles, cylinders and spheres.", "Umfang, Flächeninhalt und Volumen: vom Rechteck und Quader bis zu Kreis, Zylinder und Kugel."),
    levels: {
      1: { depth: G56, minutes: 9, blurb: L("Perimeter and area of rectangles and squares, area units, and the volume and surface area of a cuboid.", "Umfang und Flächeninhalt von Rechteck und Quadrat, Flächeneinheiten sowie Volumen und Oberfläche des Quaders.") },
      2: { depth: G78, minutes: 11, blurb: L("Triangle, parallelogram and trapezium, composite shapes, the circle and π, prisms and cylinders.", "Dreieck, Parallelogramm und Trapez, zusammengesetzte Flächen, der Kreis und π, Prisma und Zylinder.") },
      3: { depth: G910, minutes: 12, blurb: L("Pyramid, cone and sphere, heights with Pythagoras, and how area and volume grow when you scale.", "Pyramide, Kegel und Kugel, Höhen mit dem Satz des Pythagoras und wie Fläche und Volumen beim Vergrößern wachsen.") },
    },
  },
  {
    slug: "probability", title: L("Probability", "Wahrscheinlichkeit"), de: "Wahrscheinlichkeitsrechnung", area: "stochastics", glyph: "P = \\frac{1}{6}",
    blurb: L("Dice, coins and tree diagrams: how likely is it, and what can you expect?", "Würfel, Münzen und Baumdiagramme: Wie wahrscheinlich ist es und was kannst du erwarten?"),
    levels: {
      1: { depth: G(5, 7), minutes: 9, blurb: L("Chance experiments, relative frequency, and Laplace probability with dice, coins and spinners.", "Zufallsexperimente, relative Häufigkeit und Laplace-Wahrscheinlichkeit mit Würfeln, Münzen und Glücksrädern.") },
      2: { depth: G810, minutes: 11, blurb: L("Multi-stage experiments, tree diagrams and the path rules, with and without replacement, and \"at least once\".", "Mehrstufige Zufallsexperimente, Baumdiagramme und die Pfadregeln, mit und ohne Zurücklegen und \"mindestens einmal\".") },
      3: { depth: UP, minutes: 13, blurb: L("Two-way tables and conditional probability, expected value, Bernoulli chains and the binomial distribution.", "Vierfeldertafel und bedingte Wahrscheinlichkeit, Erwartungswert, Bernoulli-Ketten und die Binomialverteilung.") },
    },
  },
  {
    slug: "word-problems", title: L("Word problems", "Textaufgaben"), de: "Textaufgaben", area: "applied", glyph: '12 "km" : 3 "h"',
    blurb: L("Turn a story into maths: find what's asked, pick the operation, check.", "Aus einer Geschichte wird Mathe: Gesuchtes finden, Rechenweg wählen, prüfen."),
    levels: {
      1: { depth: G(5, 7), minutes: 8, blurb: L("Turn a story into maths: find what's asked, pick the operation, check. Rule of three and speed.", "Aus einer Geschichte wird Mathe: Gesuchtes finden, Rechenweg wählen, prüfen. Dreisatz und Geschwindigkeit.") },
      2: { depth: G78, minutes: 10, blurb: L("The rule of three in several steps, scale and maps, averages, and comparing tariffs.", "Der zusammengesetzte Dreisatz, Maßstab und Karten, Durchschnitte und Tarifvergleiche.") },
      3: { depth: UP10, minutes: 12, blurb: L("Modelling: choose a linear, quadratic or exponential model, find the best value with a parabola, and Fermi estimates.", "Modellieren: ein lineares, quadratisches oder exponentielles Modell wählen, den besten Wert mit einer Parabel finden und Fermi-Aufgaben.") },
    },
  },
  {
    slug: "unknowns", title: L("Word problems with unknowns", "Textaufgaben mit Unbekannten"), de: "Textaufgaben mit Unbekannten", area: "applied", glyph: "x + 2x = 30",
    blurb: L("Name the unknown x, write the equation, solve it, answer in words.", "Die Unbekannte x benennen, die Gleichung aufstellen, lösen und im Antwortsatz antworten."),
    levels: {
      1: { depth: G(7), minutes: 10, blurb: L("Name the unknown x, write the equation, solve it, answer in words.", "Die Unbekannte x benennen, die Gleichung aufstellen, lösen und im Antwortsatz antworten.") },
      2: { depth: G(8, 9), minutes: 11, blurb: L("Two unknowns: turn a story into a system of equations (tickets, coins, mixtures), and motion problems.", "Zwei Unbekannte: aus einer Geschichte ein Gleichungssystem machen (Eintrittskarten, Münzen, Mischungen) und Bewegungsaufgaben.") },
      3: { depth: G910, minutes: 12, blurb: L("Quadratic word problems (areas, numbers, falling objects) and work-rate problems: which solution makes sense?", "Quadratische Textaufgaben (Flächen, Zahlen, Fallbewegungen) und Arbeitsaufgaben: Welche Lösung ist sinnvoll?") },
    },
  },
];

/** Where each maths lesson written before levels sits (its old progress row counts for that level). */
const MATHS_LEGACY: Record<string, Level> = {
  brackets: 1, expanding: 2, rearranging: 2, fractions: 1, "powers-roots": 2, percentages: 1,
  equations: 1, "linear-systems": 2, "pq-formula": 2, lines: 2, "word-problems": 1, unknowns: 1,
};

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

for (const t of CHEMISTRY_ENTRIES) LEGACY_LESSON_LEVEL[t.slug] = t.lessonLevel;
Object.assign(LEGACY_LESSON_LEVEL, MATHS_LEGACY);

export const MATHS_CATALOG: TopicMeta[] = MATHS_ENTRIES.map((t) => ({ ...t, subject: "maths" }));
export const CHEMISTRY_CATALOG: TopicMeta[] = CHEMISTRY_ENTRIES.map((t) => ({ ...single("chemistry", t), subject: "chemistry" }));
export const BIOLOGY_CATALOG: TopicMeta[] = BIOLOGY_ENTRIES.map((t) => ({ ...t, subject: "biology" }));
/** Every topic of every live subject. */
export const CATALOG: TopicMeta[] = [...MATHS_CATALOG, ...CHEMISTRY_CATALOG, ...BIOLOGY_CATALOG];

const BY_SUBJECT: Record<Subject, TopicMeta[]> = { maths: MATHS_CATALOG, chemistry: CHEMISTRY_CATALOG, biology: BIOLOGY_CATALOG };
export const subjectCatalog = (subject: Subject) => BY_SUBJECT[subject];

/** Levels whose lesson is written. */
export const lessonLevels = (t: Pick<TopicMeta, "levels">) => LEVELS.filter((l) => t.levels[l].minutes);
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

export type SubjectInfo = {
  slug: string;
  title: Text;
  live: boolean;
  areas?: Area[];
  /** A language course: its own page (/learn/<slug>) with a course path instead of topics. */
  language?: boolean;
};

/** Subjects shown in the learning center. */
export const SUBJECTS: SubjectInfo[] = [
  { slug: "maths", title: tx("Maths", "Mathe"), live: true, areas: ["numbers", "algebra", "equations", "functions", "geometry", "stochastics", "applied"] },
  { slug: "chemistry", title: tx("Chemistry", "Chemie"), live: true, areas: ["matter", "atoms", "bonding", "reactions", "chemcalc", "organic"] },
  { slug: "biology", title: tx("Biology", "Biologie"), live: true, areas: ["cells", "botany", "zoology", "human", "genetics", "evolution", "ecology"] },
  { slug: "french", title: tx("French", "Französisch"), live: true, language: true },
  { slug: "physics", title: tx("Physics", "Physik"), live: false },
  { slug: "english", title: tx("English", "Englisch"), live: false },
];

export const isSubject = (s: string): s is Subject => SUBJECTS.some((x) => x.slug === s && x.live && !x.language);

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
