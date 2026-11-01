import type { ComponentType } from "react";
import type { PartsContent, PartsView, Spot, StepsContent, StepsView, TimelineContent, TimelineView } from "./types";

/** A parts view from its text and its drawing (every part needs a spot). */
export function partsView<K extends string>(
  id: string,
  content: PartsContent & { parts: Record<K, PartsContent["parts"][string]> },
  drawing: { width: number; height: number; spots: Record<K, Spot>; Drawing: ComponentType; fit?: [number, number, number, number] },
): PartsView {
  return {
    kind: "parts",
    id,
    title: content.title,
    intro: content.intro,
    questions: content.questions,
    width: drawing.width,
    height: drawing.height,
    Drawing: drawing.Drawing,
    fit: drawing.fit,
    parts: (Object.keys(content.parts) as K[]).map((key) => ({ id: key, info: content.parts[key], spot: drawing.spots[key] })),
  };
}

export function stepsView(id: string, content: StepsContent, drawing: { width: number; height: number; Drawing: ComponentType<{ step: number }> }): StepsView {
  return { kind: "steps", id, title: content.title, intro: content.intro, questions: content.questions, steps: content.steps, ...drawing };
}

export function timelineView(id: string, content: TimelineContent): TimelineView {
  return {
    kind: "timeline",
    id,
    title: content.title,
    intro: content.intro,
    questions: content.questions,
    events: Object.entries(content.events)
      .map(([key, e]) => ({ id: key, ...e }))
      .sort((a, b) => a.year - b.year),
  };
}
