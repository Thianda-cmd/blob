import type { Area } from "./types";

/**
 * Plain data about each topic, safe for server components (the full topics
 * contain React widgets and live in client modules).
 */
export type TopicMeta = {
  slug: string;
  title: string;
  /** German name, shown as a subtitle so students recognise it from class. */
  de: string;
  area: Area;
  /** One sentence for cards. */
  blurb: string;
  /** Display-language glyph for the topic card, e.g. "a(b + c)". */
  glyph: string;
  /** Estimated lesson minutes. */
  minutes: number;
};

/** Maths topics in the order they're suggested. */
export const MATHS_CATALOG: TopicMeta[] = [
  { slug: "brackets", title: "Removing brackets", de: "Klammern auflösen", area: "algebra", blurb: "Plus or minus in front? Learn when signs stay and when they flip.", glyph: "-(a - b)", minutes: 7 },
  { slug: "expanding", title: "Expanding brackets", de: "Ausmultiplizieren", area: "algebra", blurb: "Multiply into brackets, two brackets at once and the binomial formulas.", glyph: "a(b + c)", minutes: 9 },
  { slug: "rearranging", title: "Rearranging formulas", de: "Formeln umstellen", area: "algebra", blurb: "Get any letter on its own, step by step, with inverse operations.", glyph: "v = \\frac{s}{t}", minutes: 8 },
  { slug: "fractions", title: "Fractions", de: "Bruchrechnung", area: "numbers", blurb: "Simplify, add, subtract, multiply and divide fractions with confidence.", glyph: "\\frac{3}{4}", minutes: 10 },
  { slug: "powers-roots", title: "Powers and roots", de: "Potenzen und Wurzeln", area: "numbers", blurb: "Power rules, negative exponents and simplifying square roots.", glyph: "a^n", minutes: 9 },
  { slug: "percentages", title: "Percentages", de: "Prozentrechnung", area: "numbers", blurb: "Percentage, base value and percent rate, plus increases and discounts.", glyph: "25 %", minutes: 8 },
  { slug: "equations", title: "Equations and inequalities", de: "Gleichungen und Ungleichungen", area: "equations", blurb: "Solve linear equations and inequalities, and know when the sign flips.", glyph: "2x + 3 = 11", minutes: 10 },
  { slug: "linear-systems", title: "Systems of equations", de: "Lineare Gleichungssysteme", area: "equations", blurb: "Two equations, two unknowns: substitution, elimination and graphs.", glyph: "x + y = 5", minutes: 10 },
  { slug: "pq-formula", title: "The pq formula", de: "pq-Formel", area: "equations", blurb: "Solve any quadratic equation in normal form, and read the discriminant.", glyph: "x^2 + px + q", minutes: 9 },
  { slug: "lines", title: "Straight lines", de: "Geraden", area: "functions", blurb: "Slope, y-intercept and the line through two points, on a live graph.", glyph: "y = mx + b", minutes: 10 },
  { slug: "word-problems", title: "Word problems", de: "Textaufgaben", area: "applied", blurb: "Turn a story into maths: find what's asked, pick the operation, check.", glyph: '12 "km" : 3 "h"', minutes: 8 },
  { slug: "unknowns", title: "Word problems with unknowns", de: "Textaufgaben mit Unbekannten", area: "applied", blurb: "Name the unknown x, write the equation, solve it, answer in words.", glyph: "x + 2x = 30", minutes: 10 },
];

export function topicMeta(slug: string): TopicMeta {
  const meta = MATHS_CATALOG.find((t) => t.slug === slug);
  if (!meta) throw new Error(`Unknown topic: ${slug}`);
  return meta;
}

export const findTopicMeta = (slug: string) => MATHS_CATALOG.find((t) => t.slug === slug);

/** Subjects shown in the learning center. Only maths is live for now. */
export const SUBJECTS = [
  { slug: "maths", title: "Maths", de: "Mathe", live: true },
  { slug: "chemistry", title: "Chemistry", de: "Chemie", live: false },
  { slug: "biology", title: "Biology", de: "Biologie", live: false },
  { slug: "physics", title: "Physics", de: "Physik", live: false },
  { slug: "english", title: "English", de: "Englisch", live: false },
] as const;
