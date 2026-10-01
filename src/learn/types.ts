import type { ComponentType } from "react";
import type { TopicMeta } from "./catalog";
import type { Rng } from "./engine/rng";

/**
 * Rich text: plain text with inline maths in $…$ (display language, see
 * engine/display.ts) and **bold**. Blank lines start paragraphs.
 */
export type RichText = string;

/** One frame of a maths animation. Tokens with the same key glide between frames. */
export type Frame = {
  /** Display-language maths. */
  math: string;
  /** What Blob says about this frame. */
  note?: RichText;
  /** Token keys to highlight, e.g. ["x#1", "br("]. */
  highlight?: string[];
  /** Curved arrows between tokens: [fromKey, toKey]. */
  arrows?: [string, string][];
};

export type AnswerSpec =
  /** A number. Accepts decimals with comma or point and fractions like 3/4. */
  | { kind: "number"; value: number; tolerance?: number; unit?: string; label?: string }
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
      prefix?: string;
    }
  /** Solutions of an equation in one variable. Empty array = no solution. */
  | { kind: "solutions"; variable: string; values: number[]; allowNone?: boolean }
  /** The solution set of a linear inequality, e.g. x > 3. */
  | { kind: "inequality"; variable: string; op: "<" | ">" | "≤" | "≥"; value: number }
  /** A pair like the solution of a 2×2 system. */
  | { kind: "pair"; names: [string, string]; values: [number, number] }
  /** Multiple choice. */
  | { kind: "choice"; options: RichText[]; correct: number };

export type Feedback = { correct: boolean; message?: string; partial?: boolean };

export type Exercise = {
  /** Short instruction, e.g. "Expand and simplify". */
  instruction: string;
  /** Optional text for word problems (rich text). */
  text?: RichText;
  /** The task as display-language maths, shown big. */
  math?: string;
  answer: AnswerSpec;
  /** A nudge without giving it away. */
  hint?: RichText;
  /** Worked solution, animated frame by frame. */
  solution: Frame[];
  /** Optional picture for the task (graph, number line…). */
  visual?: { component: ComponentType<Record<string, unknown>>; props: Record<string, unknown> };
};

export type Level = 1 | 2 | 3;

export type LessonStep =
  | {
      type: "explain";
      title: string;
      /** Shown on the card under the title. */
      body?: RichText;
      /** Animated maths board. Each "Next" advances one frame. */
      frames?: Frame[];
      /** Blob's line when the step opens. */
      blob?: string;
    }
  | {
      type: "widget";
      title: string;
      body?: RichText;
      blob?: string;
      /** An interactive explanation (graph you can drag, number line…). */
      widget: ComponentType;
    }
  | {
      type: "check";
      title?: string;
      blob?: string;
      exercise: Exercise;
    };

export type SummaryBlock = {
  title: string;
  body?: RichText;
  /** Display-language example lines. */
  examples?: string[];
  /** "rule" blocks get an accent border. */
  tone?: "rule" | "tip" | "warning";
};

export type Area = "algebra" | "equations" | "numbers" | "functions" | "applied";

export type Topic = TopicMeta & {
  summary: SummaryBlock[];
  lesson: LessonStep[];
  generate: (level: Level, rng: Rng) => Exercise;
};

export const AREAS: Record<Area, { title: string; blurb: string }> = {
  algebra: { title: "Algebra basics", blurb: "Brackets, terms and formulas" },
  numbers: { title: "Numbers", blurb: "Fractions, powers and percentages" },
  equations: { title: "Equations", blurb: "Solve for the unknown" },
  functions: { title: "Functions", blurb: "Lines and graphs" },
  applied: { title: "Word problems", blurb: "Maths in real life" },
};
