import { tx, type Text } from "@/i18n/text";
import type { Area } from "./types";

/**
 * Plain data about each topic, safe for server components (the full topics
 * contain React widgets and live in client modules).
 */
export type TopicMeta = {
  slug: string;
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

/** Maths topics in the order they're suggested. */
export const MATHS_CATALOG: TopicMeta[] = [
  { slug: "brackets", title: tx("Removing brackets", "Klammern auflösen"), de: "Klammern auflösen", area: "algebra", blurb: tx("Plus or minus in front? Learn when signs stay and when they flip.", "Plus oder Minus davor? Lerne, wann Vorzeichen bleiben und wann sie kippen."), glyph: "-(a - b)", minutes: 7 },
  { slug: "expanding", title: tx("Expanding brackets", "Ausmultiplizieren"), de: "Ausmultiplizieren", area: "algebra", blurb: tx("Multiply into brackets, two brackets at once and the binomial formulas.", "In Klammern hineinmultiplizieren, zwei Klammern auf einmal und die binomischen Formeln."), glyph: "a(b + c)", minutes: 9 },
  { slug: "rearranging", title: tx("Rearranging formulas", "Formeln umstellen"), de: "Formeln umstellen", area: "algebra", blurb: tx("Get any letter on its own, step by step, with inverse operations.", "Bring jeden Buchstaben allein auf eine Seite, Schritt für Schritt mit Umkehroperationen."), glyph: "v = \\frac{s}{t}", minutes: 8 },
  { slug: "fractions", title: tx("Fractions", "Bruchrechnung"), de: "Bruchrechnung", area: "numbers", blurb: tx("Simplify, add, subtract, multiply and divide fractions with confidence.", "Brüche sicher kürzen, addieren, subtrahieren, multiplizieren und dividieren."), glyph: "\\frac{3}{4}", minutes: 10 },
  { slug: "powers-roots", title: tx("Powers and roots", "Potenzen und Wurzeln"), de: "Potenzen und Wurzeln", area: "numbers", blurb: tx("Power rules, negative exponents and simplifying square roots.", "Potenzgesetze, negative Exponenten und Wurzeln vereinfachen."), glyph: "a^n", minutes: 9 },
  { slug: "percentages", title: tx("Percentages", "Prozentrechnung"), de: "Prozentrechnung", area: "numbers", blurb: tx("Percentage, base value and percent rate, plus increases and discounts.", "Grundwert, Prozentwert und Prozentsatz, dazu Erhöhungen und Rabatte."), glyph: "25 %", minutes: 8 },
  { slug: "equations", title: tx("Equations and inequalities", "Gleichungen und Ungleichungen"), de: "Gleichungen und Ungleichungen", area: "equations", blurb: tx("Solve linear equations and inequalities, and know when the sign flips.", "Lineare Gleichungen und Ungleichungen lösen und wissen, wann das Zeichen kippt."), glyph: "2x + 3 = 11", minutes: 10 },
  { slug: "linear-systems", title: tx("Systems of equations", "Lineare Gleichungssysteme"), de: "Lineare Gleichungssysteme", area: "equations", blurb: tx("Two equations, two unknowns: substitution, elimination and graphs.", "Zwei Gleichungen, zwei Unbekannte: Einsetzen, Gleichsetzen, Addieren und Graphen."), glyph: "x + y = 5", minutes: 10 },
  { slug: "pq-formula", title: tx("The pq formula", "pq-Formel"), de: "pq-Formel", area: "equations", blurb: tx("Solve any quadratic equation in normal form, and read the discriminant.", "Jede quadratische Gleichung in Normalform lösen und die Diskriminante deuten."), glyph: "x^2 + px + q", minutes: 9 },
  { slug: "lines", title: tx("Straight lines", "Geraden"), de: "Geraden", area: "functions", blurb: tx("Slope, y-intercept and the line through two points, on a live graph.", "Steigung, y-Achsenabschnitt und die Gerade durch zwei Punkte, am lebendigen Graphen."), glyph: "y = mx + b", minutes: 10 },
  { slug: "word-problems", title: tx("Word problems", "Textaufgaben"), de: "Textaufgaben", area: "applied", blurb: tx("Turn a story into maths: find what's asked, pick the operation, check.", "Aus einer Geschichte wird Mathe: Gesuchtes finden, Rechenweg wählen, prüfen."), glyph: '12 "km" : 3 "h"', minutes: 8 },
  { slug: "unknowns", title: tx("Word problems with unknowns", "Textaufgaben mit Unbekannten"), de: "Textaufgaben mit Unbekannten", area: "applied", blurb: tx("Name the unknown x, write the equation, solve it, answer in words.", "Die Unbekannte x benennen, die Gleichung aufstellen, lösen und im Antwortsatz antworten."), glyph: "x + 2x = 30", minutes: 10 },
];

export function topicMeta(slug: string): TopicMeta {
  const meta = MATHS_CATALOG.find((t) => t.slug === slug);
  if (!meta) throw new Error(`Unknown topic: ${slug}`);
  return meta;
}

export const findTopicMeta = (slug: string) => MATHS_CATALOG.find((t) => t.slug === slug);

/** Subjects shown in the learning center. Only maths is live for now. */
export const SUBJECTS: { slug: string; title: Text; live: boolean }[] = [
  { slug: "maths", title: tx("Maths", "Mathe"), live: true },
  { slug: "chemistry", title: tx("Chemistry", "Chemie"), live: false },
  { slug: "biology", title: tx("Biology", "Biologie"), live: false },
  { slug: "physics", title: tx("Physics", "Physik"), live: false },
  { slug: "english", title: tx("English", "Englisch"), live: false },
];
