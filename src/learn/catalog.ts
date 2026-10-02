import { tx, type Text } from "@/i18n/text";
import type { TopicProgress } from "./progress";
import type { Area } from "./types";

export type Subject = "maths" | "chemistry";

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
  /** Estimated lesson minutes. */
  minutes: number;
};

type Entry = Omit<TopicMeta, "subject">;

/** Maths topics in the order they're suggested. */
const MATHS_ENTRIES: Entry[] = [
  { slug: "brackets", title: tx("Removing brackets", "Klammern auflösen"), de: "Klammern auflösen", area: "algebra", blurb: tx("Plus or minus in front? Learn when signs stay and when they flip.", "Plus oder Minus davor? Lerne, wann Vorzeichen bleiben und wann du sie umdrehst."), glyph: "-(a - b)", minutes: 7 },
  { slug: "expanding", title: tx("Expanding brackets", "Ausmultiplizieren"), de: "Ausmultiplizieren", area: "algebra", blurb: tx("Multiply into brackets, two brackets at once and the binomial formulas.", "In Klammern hineinmultiplizieren, zwei Klammern auf einmal und die binomischen Formeln."), glyph: "a(b + c)", minutes: 9 },
  { slug: "rearranging", title: tx("Rearranging formulas", "Formeln umstellen"), de: "Formeln umstellen", area: "algebra", blurb: tx("Get any letter on its own, step by step, with inverse operations.", "Bring jeden Buchstaben allein auf eine Seite, Schritt für Schritt mit Umkehroperationen."), glyph: "v = \\frac{s}{t}", minutes: 8 },
  { slug: "fractions", title: tx("Fractions", "Bruchrechnung"), de: "Bruchrechnung", area: "numbers", blurb: tx("Simplify, add, subtract, multiply and divide fractions with confidence.", "Brüche sicher kürzen, addieren, subtrahieren, multiplizieren und dividieren."), glyph: "\\frac{3}{4}", minutes: 10 },
  { slug: "powers-roots", title: tx("Powers and roots", "Potenzen und Wurzeln"), de: "Potenzen und Wurzeln", area: "numbers", blurb: tx("Power rules, negative exponents and simplifying square roots.", "Potenzgesetze, negative Exponenten und Wurzeln vereinfachen."), glyph: "a^n", minutes: 9 },
  { slug: "percentages", title: tx("Percentages", "Prozentrechnung"), de: "Prozentrechnung", area: "numbers", blurb: tx("Percentage, base value and percent rate, plus increases and discounts.", "Grundwert, Prozentwert und Prozentsatz, dazu Erhöhungen und Rabatte."), glyph: "25 %", minutes: 8 },
  { slug: "equations", title: tx("Equations and inequalities", "Gleichungen und Ungleichungen"), de: "Gleichungen und Ungleichungen", area: "equations", blurb: tx("Solve linear equations and inequalities, and know when the sign flips.", "Lineare Gleichungen und Ungleichungen lösen und wissen, wann sich das Zeichen umdreht."), glyph: "2x + 3 = 11", minutes: 10 },
  { slug: "linear-systems", title: tx("Systems of equations", "Lineare Gleichungssysteme"), de: "Lineare Gleichungssysteme", area: "equations", blurb: tx("Two equations, two unknowns: substitution, elimination and graphs.", "Zwei Gleichungen, zwei Unbekannte: Einsetzen, Gleichsetzen, Addieren und Graphen."), glyph: "x + y = 5", minutes: 10 },
  { slug: "pq-formula", title: tx("The pq formula", "pq-Formel"), de: "pq-Formel", area: "equations", blurb: tx("Solve any quadratic equation in normal form, and read the discriminant.", "Jede quadratische Gleichung in Normalform lösen und die Diskriminante deuten."), glyph: "x^2 + px + q", minutes: 9 },
  { slug: "lines", title: tx("Straight lines", "Geraden"), de: "Geraden", area: "functions", blurb: tx("Slope, y-intercept and the line through two points, on a live graph.", "Steigung, y-Achsenabschnitt und die Gerade durch zwei Punkte, am lebendigen Graphen."), glyph: "y = mx + b", minutes: 10 },
  { slug: "word-problems", title: tx("Word problems", "Textaufgaben"), de: "Textaufgaben", area: "applied", blurb: tx("Turn a story into maths: find what's asked, pick the operation, check.", "Aus einer Geschichte wird Mathe: Gesuchtes finden, Rechenweg wählen, prüfen."), glyph: '12 "km" : 3 "h"', minutes: 8 },
  { slug: "unknowns", title: tx("Word problems with unknowns", "Textaufgaben mit Unbekannten"), de: "Textaufgaben mit Unbekannten", area: "applied", blurb: tx("Name the unknown x, write the equation, solve it, answer in words.", "Die Unbekannte x benennen, die Gleichung aufstellen, lösen und im Antwortsatz antworten."), glyph: "x + 2x = 30", minutes: 10 },
];

/** Chemistry topics in the order they're suggested (roughly the German school order, grades 7 to 10). */
const CHEMISTRY_ENTRIES: Entry[] = [
  { slug: "particles", title: tx("Particles and states", "Teilchenmodell und Aggregatzustände"), de: "Teilchenmodell", area: "matter", blurb: tx("Solid, liquid, gas: what the particles do, and why things melt and boil.", "Fest, flüssig, gasförmig: was die Teilchen tun und warum Stoffe schmelzen und sieden."), glyph: "\\ce{H2O(l)}", minutes: 7 },
  { slug: "mixtures", title: tx("Mixtures and separation", "Stoffgemische und Trennverfahren"), de: "Stoffgemische", area: "matter", blurb: tx("Pure substances, solutions and suspensions, and how to separate them.", "Reinstoffe, Lösungen und Suspensionen und wie man sie wieder trennt."), glyph: "\\ce{NaCl(aq)}", minutes: 8 },
  { slug: "atoms", title: tx("Atomic structure", "Atombau"), de: "Atombau", area: "atoms", blurb: tx("Protons, neutrons, electrons and shells: build any atom yourself.", "Protonen, Neutronen, Elektronen und Schalen: Bau jedes Atom selbst."), glyph: "p^+ \\; n \\; e^-", minutes: 9 },
  { slug: "periodic-table", title: tx("The periodic table", "Das Periodensystem"), de: "Periodensystem", area: "atoms", blurb: tx("Read groups and periods, and predict how an element behaves.", "Hauptgruppen und Perioden lesen und vorhersagen, wie sich ein Element verhält."), glyph: "\\ce{Na}", minutes: 9 },
  { slug: "ionic-bonds", title: tx("Ions and salts", "Ionenbindung und Salze"), de: "Ionenbindung", area: "bonding", blurb: tx("Why atoms give and take electrons, and how to write any salt's formula.", "Warum Atome Elektronen abgeben und aufnehmen und wie du jede Salzformel aufstellst."), glyph: "\\ce{Na+ Cl-}", minutes: 10 },
  { slug: "covalent-bonds", title: tx("Covalent bonds", "Elektronenpaarbindung"), de: "Elektronenpaarbindung", area: "bonding", blurb: tx("Shared electron pairs, Lewis structures and polar molecules.", "Gemeinsame Elektronenpaare, Lewis-Formeln und polare Moleküle."), glyph: "\\ce{H2O}", minutes: 10 },
  { slug: "reactions", title: tx("Chemical reactions", "Chemische Reaktionen"), de: "Chemische Reaktion", area: "reactions", blurb: tx("New substances, energy and the signs that a reaction happened.", "Neue Stoffe, Energie und woran du eine Reaktion erkennst."), glyph: "\\ce{A + B -> C}", minutes: 8 },
  { slug: "balancing", title: tx("Balancing equations", "Reaktionsgleichungen"), de: "Reaktionsgleichungen aufstellen", area: "reactions", blurb: tx("Count the atoms and balance any equation, step by step.", "Atome zählen und jede Reaktionsgleichung Schritt für Schritt ausgleichen."), glyph: "\\ce{2H2 + O2 -> 2H2O}", minutes: 10 },
  { slug: "acids-bases", title: tx("Acids and bases", "Säuren und Basen"), de: "Säuren und Basen", area: "reactions", blurb: tx("Protons on the move: pH, indicators and neutralisation.", "Protonen auf Wanderschaft: pH-Wert, Indikatoren und Neutralisation."), glyph: "\\ce{H3O+}", minutes: 10 },
  { slug: "redox", title: tx("Redox reactions", "Redoxreaktionen"), de: "Redoxreaktionen", area: "reactions", blurb: tx("Oxidation numbers, who gives electrons and who takes them.", "Oxidationszahlen und wer Elektronen abgibt und wer sie aufnimmt."), glyph: "\\ce{Fe^3+ + e-}", minutes: 10 },
  { slug: "moles", title: tx("The mole", "Stoffmenge und Mol"), de: "Stoffmenge", area: "chemcalc", blurb: tx("Molar mass, amount of substance and concentration, with real numbers.", "Molare Masse, Stoffmenge und Konzentration, mit echten Zahlen."), glyph: "n = \\frac{m}{M}", minutes: 10 },
  { slug: "alkanes", title: tx("Alkanes", "Alkane"), de: "Alkane", area: "organic", blurb: tx("Methane to decane: formulas, names and the homologous series.", "Von Methan bis Decan: Formeln, Namen und die homologe Reihe."), glyph: "\\ce{CH4}", minutes: 9 },
];

export const MATHS_CATALOG: TopicMeta[] = MATHS_ENTRIES.map((t) => ({ ...t, subject: "maths" }));
export const CHEMISTRY_CATALOG: TopicMeta[] = CHEMISTRY_ENTRIES.map((t) => ({ ...t, subject: "chemistry" }));
/** Every topic of every live subject. */
export const CATALOG: TopicMeta[] = [...MATHS_CATALOG, ...CHEMISTRY_CATALOG];

export const subjectCatalog = (subject: Subject) => (subject === "maths" ? MATHS_CATALOG : CHEMISTRY_CATALOG);

export function topicMeta(slug: string): TopicMeta {
  const meta = CATALOG.find((t) => t.slug === slug);
  if (!meta) throw new Error(`Unknown topic: ${slug}`);
  return meta;
}

export const findTopicMeta = (slug: string) => CATALOG.find((t) => t.slug === slug);

/** Where a topic lives: its overview page, lesson and practice. */
export const topicHref = (t: Pick<TopicMeta, "slug" | "subject">) => `/learn/${t.subject}/${t.slug}`;
export const studyHref = (t: Pick<TopicMeta, "slug" | "subject">, part: "lesson" | "practice") => `/study/${t.subject}/${t.slug}/${part}`;

export type SubjectInfo = { slug: string; title: Text; live: boolean; areas?: Area[] };

/** Subjects shown in the learning center. */
export const SUBJECTS: SubjectInfo[] = [
  { slug: "maths", title: tx("Maths", "Mathe"), live: true, areas: ["algebra", "numbers", "equations", "functions", "applied"] },
  { slug: "chemistry", title: tx("Chemistry", "Chemie"), live: true, areas: ["matter", "atoms", "bonding", "reactions", "chemcalc", "organic"] },
  { slug: "biology", title: tx("Biology", "Biologie"), live: false },
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
