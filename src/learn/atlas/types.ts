import type { ComponentType } from "react";
import type { Text } from "@/i18n/text";

/**
 * The Atlas: interactive models to learn by looking. A model (the bacterial cell, the cell
 * wall…) has one or more views. A view is a labelled drawing whose structures you tap
 * ("parts"), a process you step through ("steps"), or a timeline of discoveries ("timeline").
 *
 * Text lives apart from the drawings (`*.content.ts`, no React), so search can load all of it
 * without the pictures. Text may use **bold** and inline chemistry like $\ce{CO2}$ (see Rich).
 */

/** What you learn about one structure. */
export type PartInfo = {
  name: Text;
  /** Other names and technical terms: "Peptidoglykan, Mureinsacculus". */
  aka?: Text;
  /** A short chip, e.g. "only Gram-negative". */
  tag?: Text;
  /** What it is and does, in one or two sentences. */
  role: Text;
  /** What you need for the exam: one fact per line. */
  facts: Text[];
  /** A tip or a typical trap ("Merke"). */
  tip?: Text;
  /**
   * Says what it does without naming it, for "Tap the structure that …". Completes the sentence
   * "Tap the structure that …" / "Tippe auf die Struktur, die …". Without it, the part is only
   * asked by name.
   */
  clue?: Text;
};

/** Where a part's marker sits in the drawing (viewBox units), and its label when labels are on. */
export type Spot = {
  at: [number, number];
  /** Where the label pill sits. Without it, the label sits to the right of the marker. */
  label?: [number, number];
  /**
   * Which way the pill grows from `label`: "l" to the left, "r" to the right, "c" centred on it
   * (rows of labels above or below a drawing). By default away from the marker.
   */
  side?: "l" | "r" | "c";
};

/** A multiple-choice question from the textbook, mixed into quiz rounds. */
export type Question = {
  q: Text;
  options: Text[];
  /** Index of the right option. Options are shuffled when shown. */
  correct: number;
  /** Why, shown after answering. */
  why?: Text;
};

export type AtlasPart = { id: string; info: PartInfo; spot: Spot };

/** One step of a process. */
export type StepInfo = {
  title: Text;
  /** A short name for the step bar ("Stain", "Färben"). */
  short: Text;
  body: Text;
  facts?: Text[];
  tip?: Text;
  /** How long it takes, e.g. "1 min". */
  time?: Text;
};

/** Little pictures for the timeline. */
export type EventIcon =
  | "lens"
  | "microscope"
  | "cells"
  | "flask"
  | "swan"
  | "vaccine"
  | "hands"
  | "scalpel"
  | "rod"
  | "dish"
  | "stain"
  | "spore"
  | "filter"
  | "phage"
  | "mould"
  | "pill"
  | "tree"
  | "dna"
  | "helix"
  | "scissors"
  | "plasmid"
  | "earth";

/** A milestone. */
export type EventInfo = {
  year: number;
  /** How the date reads when it is not just the year: "um 1546", "1876–1882". */
  when?: Text;
  who: Text;
  title: Text;
  body: Text;
  facts?: Text[];
  tip?: Text;
  icon: EventIcon;
};

type ViewBase = {
  id: string;
  title: Text;
  /** What this view shows and how to use it, one or two sentences. */
  intro: Text;
  questions?: Question[];
};

export type PartsView = ViewBase & {
  kind: "parts";
  width: number;
  height: number;
  parts: AtlasPart[];
  /** The picture: one `<g data-part="id">` per part, drawn in a `width` × `height` viewBox. */
  Drawing: ComponentType;
  /**
   * A tighter crop [x, y, w, h] for narrow screens, where names show as numbers and the rows of
   * name pills around the drawing stay empty. Every marker must lie inside it.
   */
  fit?: [number, number, number, number];
};

export type StepsView = ViewBase & {
  kind: "steps";
  width: number;
  height: number;
  steps: StepInfo[];
  /** The picture at a step (0-based). */
  Drawing: ComponentType<{ step: number }>;
};

export type TimelineView = ViewBase & {
  kind: "timeline";
  events: (EventInfo & { id: string })[];
};

export type AtlasView = PartsView | StepsView | TimelineView;

export type AtlasModel = {
  slug: string;
  views: AtlasView[];
};

/** A view's text (`*.content.ts`): everything but the picture. */
export type PartsContent = { kind: "parts"; title: Text; intro: Text; parts: Record<string, PartInfo>; questions?: Question[] };
export type StepsContent = { kind: "steps"; title: Text; intro: Text; steps: StepInfo[]; questions?: Question[] };
export type TimelineContent = { kind: "timeline"; title: Text; intro: Text; events: Record<string, EventInfo>; questions?: Question[] };
export type ViewContent = PartsContent | StepsContent | TimelineContent;

/** A model's text, view by view in order. */
export type ModelContent = { slug: string; views: Record<string, ViewContent> };
