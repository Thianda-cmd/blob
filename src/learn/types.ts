import type { ComponentType } from "react";
import { tx, type Text } from "@/i18n/text";
import type { TopicMeta } from "./catalog";
import type { Rng } from "./engine/rng";

/**
 * Rich text: plain text with inline maths in $…$ (display language, see
 * engine/display.ts) and **bold**. Blank lines start paragraphs. Bilingual:
 * `tx("English", "Deutsch")`; a plain string only for text without words.
 */
export type RichText = Text;
export type { Text };

/** One frame of a maths animation. Tokens with the same key glide between frames. */
export type Frame = {
  /** Display-language maths (bilingual only if it contains words, e.g. "each"). */
  math: Text;
  /** What Blob says about this frame. */
  note?: RichText;
  /** Token keys to highlight, e.g. ["x#1", "br("]. */
  highlight?: string[];
  /** Curved arrows between tokens: [fromKey, toKey]. */
  arrows?: [string, string][];
};

export type AnswerSpec =
  /** A number. Accepts decimals with comma or point and fractions like 3/4. */
  | { kind: "number"; value: number; tolerance?: number; unit?: Text; label?: Text }
  /** An exact fraction typed as two boxes (numerator / denominator). */
  | { kind: "fraction"; n: number; d: number; mustReduce?: boolean }
  /** An algebraic expression, compared by value at random points. */
  | {
      kind: "expr";
      value: string;
      /** "expanded": no brackets left; "simplified": also like terms combined. */
      form?: "any" | "expanded" | "simplified";
      /** Test only positive values (for formulas with roots, divisions…). */
      positive?: boolean;
      /** Shown in front of the input, e.g. "t =". */
      prefix?: Text;
    }
  /** Solutions of an equation in one variable. Empty array = no solution. */
  | { kind: "solutions"; variable: string; values: number[]; allowNone?: boolean }
  /** The solution set of a linear inequality, e.g. x > 3. */
  | { kind: "inequality"; variable: string; op: "<" | ">" | "≤" | "≥"; value: number }
  /** A pair like the solution of a 2×2 system. */
  | { kind: "pair"; names: [Text, Text]; values: [number, number] }
  /** Multiple choice. */
  | { kind: "choice"; options: RichText[]; correct: number }
  /** Select all that apply. */
  | { kind: "multi"; options: RichText[]; correct: number[] }
  /** A chemical formula, compared by atoms and charge (order doesn't matter): "Al2O3", "SO4^2-". */
  | { kind: "formula"; value: string; label?: Text }
  /** Coefficients that balance an equation ("Fe + O2 -> Fe2O3"); empty boxes count as 1. */
  | { kind: "balance"; equation: string; coefficients: number[] }
  /** A word or name; any accepted spelling in either language counts. */
  | { kind: "word"; accept: Text[]; label?: Text; placeholder?: Text }
  /**
   * Put things in the right order (phases of mitosis, the way of the blood…). `items` are
   * listed in the CORRECT order; the student sees them shuffled and sorts them.
   */
  | { kind: "order"; items: RichText[]; label?: Text }
  /**
   * Match each item on the left with one on the right (organelle → job). `pairs` are the
   * correct pairs; the right side is shown shuffled. Extra wrong options (`distractors`) are allowed.
   */
  | { kind: "match"; pairs: [RichText, RichText][]; distractors?: RichText[]; label?: Text };

export type Feedback = {
  correct: boolean;
  /** What Blob says about the answer. */
  message?: Text;
  /** Right idea, small slip (e.g. not simplified yet): counts as "close". */
  partial?: boolean;
  /** Short label for the feedback card ("Not simplified yet"). */
  title?: Text;
  /** The student's own answer (display language) with the spots that matter highlighted. */
  mark?: string;
};

/**
 * A typical wrong answer for this exercise and what Blob says when a student gives it,
 * e.g. forgetting the middle term of (a + b)². Matched with the normal checker, so `when`
 * is an AnswerSpec of the same kind ("expr" matches by value).
 */
export type Mistake = {
  when: AnswerSpec;
  title?: Text;
  say: Text;
  /** A near miss (one zero missing, a rounding slip): Blob looks thoughtful instead of worried. */
  close?: boolean;
};

export type Exercise = {
  /** Short instruction, e.g. "Expand and simplify". */
  instruction: Text;
  /** Optional text for word problems (rich text). */
  text?: RichText;
  /** The task as display-language maths, shown big. */
  math?: Text;
  answer: AnswerSpec;
  /** A nudge without giving it away. */
  hint?: RichText;
  /** Worked solution, animated frame by frame. */
  solution: Frame[];
  /** Typical wrong answers with tailored feedback (checked before the generic diagnosis). */
  mistakes?: Mistake[];
  /** Optional picture for the task (graph, number line…). */
  visual?: { component: ComponentType<Record<string, unknown>>; props: Record<string, unknown> };
};

/**
 * How deep a topic goes: 1 beginner (Einsteiger), 2 intermediate (Fortgeschritten),
 * 3 expert (Experte, up to Abitur and first university steps). Every topic has its own
 * depth per level (see LevelMeta.depth). Practice at a level uses generate(level).
 */
export type Level = 1 | 2 | 3;
export const LEVELS: Level[] = [1, 2, 3];

export type LessonStep =
  | {
      type: "explain";
      title: Text;
      /** Shown on the card under the title. */
      body?: RichText;
      /** Animated maths board. Each "Next" advances one frame. */
      frames?: Frame[];
      /** Blob's line when the step opens. */
      blob?: Text;
    }
  | {
      type: "widget";
      title: Text;
      body?: RichText;
      blob?: Text;
      /** An interactive explanation (graph you can drag, number line…). */
      widget: ComponentType;
    }
  | {
      type: "check";
      title?: Text;
      blob?: Text;
      exercise: Exercise;
    };

export type SummaryBlock = {
  title: Text;
  body?: RichText;
  /** Display-language example lines. */
  examples?: Text[];
  /** "rule" blocks get an accent border. */
  tone?: "rule" | "tip" | "warning";
};

export type Area =
  | "algebra"
  | "equations"
  | "numbers"
  | "functions"
  | "applied"
  // Chemistry
  | "matter"
  | "atoms"
  | "bonding"
  | "reactions"
  | "chemcalc"
  | "organic"
  // Biology
  | "cells"
  | "botany"
  | "zoology"
  | "human"
  | "genetics"
  | "evolution"
  | "ecology";

/** One level's lesson and cheat sheet. */
export type LevelLesson = {
  lesson: LessonStep[];
  summary: SummaryBlock[];
};

/**
 * A topic: lessons and cheat sheets per level (a level without one shows "coming soon")
 * and practice tasks for every level.
 */
export type Topic = TopicMeta & {
  lessons: Partial<Record<Level, LevelLesson>>;
  generate: (level: Level, rng: Rng) => Exercise;
};

/** A topic written before levels: one lesson, placed at the level its catalog entry names. */
export type SingleLessonTopic = TopicMeta & {
  summary: SummaryBlock[];
  lesson: LessonStep[];
  generate: (level: Level, rng: Rng) => Exercise;
};

export const AREAS: Record<Area, { title: Text; blurb: Text }> = {
  algebra: { title: tx("Algebra basics", "Algebra-Grundlagen"), blurb: tx("Brackets, terms and formulas", "Klammern, Terme und Formeln") },
  numbers: { title: tx("Numbers", "Zahlen"), blurb: tx("Fractions, powers and percentages", "Brüche, Potenzen und Prozente") },
  equations: { title: tx("Equations", "Gleichungen"), blurb: tx("Solve for the unknown", "Finde die Unbekannte") },
  functions: { title: tx("Functions", "Funktionen"), blurb: tx("Lines and graphs", "Geraden und Graphen") },
  applied: { title: tx("Word problems", "Textaufgaben"), blurb: tx("Maths in real life", "Mathe im echten Leben") },
  matter: { title: tx("Substances and particles", "Stoffe und Teilchen"), blurb: tx("What everything is made of", "Woraus alles besteht") },
  atoms: { title: tx("Atoms", "Atome"), blurb: tx("Inside the atom and the periodic table", "Atombau und Periodensystem") },
  bonding: { title: tx("Bonding", "Bindungen"), blurb: tx("How atoms stick together", "Wie Atome zusammenhalten") },
  reactions: { title: tx("Reactions", "Reaktionen"), blurb: tx("Substances turning into new ones", "Aus Stoffen werden neue Stoffe") },
  chemcalc: { title: tx("Calculating", "Chemisches Rechnen"), blurb: tx("Moles, masses and concentrations", "Stoffmenge, Masse und Konzentration") },
  organic: { title: tx("Organic chemistry", "Organische Chemie"), blurb: tx("The chemistry of carbon", "Die Chemie des Kohlenstoffs") },
  cells: { title: tx("Cells", "Zellbiologie"), blurb: tx("The building blocks of life", "Die Bausteine des Lebens") },
  botany: { title: tx("Plants", "Botanik"), blurb: tx("How plants are built, feed and reproduce", "Wie Pflanzen gebaut sind, sich ernähren und vermehren") },
  zoology: { title: tx("Animals", "Zoologie"), blurb: tx("The diversity of animals", "Die Vielfalt der Tiere") },
  human: { title: tx("The human body", "Mensch und Gesundheit"), blurb: tx("Organs, systems and staying healthy", "Organe, Organsysteme und Gesundheit") },
  genetics: { title: tx("Genetics", "Genetik"), blurb: tx("Genes, DNA and inheritance", "Gene, DNA und Vererbung") },
  evolution: { title: tx("Evolution", "Evolution"), blurb: tx("How life changes over time", "Wie sich das Leben verändert") },
  ecology: { title: tx("Ecology", "Ökologie"), blurb: tx("Living things and their environment", "Lebewesen und ihre Umwelt") },
};
