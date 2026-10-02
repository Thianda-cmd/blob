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
  | { kind: "choice"; options: RichText[]; correct: number };

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
export type Mistake = { when: AnswerSpec; title?: Text; say: Text };

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

export type Level = 1 | 2 | 3;

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

export type Area = "algebra" | "equations" | "numbers" | "functions" | "applied";

export type Topic = TopicMeta & {
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
};
