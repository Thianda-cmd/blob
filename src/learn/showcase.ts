import type { ComponentType } from "react";
import { resolveText, type Text } from "@/i18n/text";
import type { TopicMeta } from "./catalog";
import { LEVELS, type Level, type RichText, type Topic } from "./types";

/**
 * A lesson picture or interactive piece with its own public page (/show/…): every `widget` step
 * and every `explain` step with a `visual`. Anyone can open it without signing in, e.g. a teacher
 * showing it to a class.
 */
export type ShowItem = {
  /** Unique within its level: the step's `id`, or else its English title as a slug ("nucleotides-the-building-blocks"). */
  id: string;
  level: Level;
  /** Index of the step in its level's lesson. */
  step: number;
  title: Text;
  body?: RichText;
  kind: "widget" | "picture";
  component: ComponentType<Record<string, unknown>>;
  props: Record<string, unknown>;
};

/** "Nucleotides: the building blocks" → "nucleotides-the-building-blocks". */
export function slugify(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72)
      .replace(/-+$/, "") || "picture"
  );
}

/** The topic's shareable pictures and widgets, level by level, in lesson order. */
export function showItems(topic: Topic): ShowItem[] {
  const items: ShowItem[] = [];
  for (const level of LEVELS) {
    const lesson = topic.lessons[level]?.lesson ?? [];
    const used = new Set<string>();
    lesson.forEach((step, i) => {
      if (step.type === "check") return;
      const visual = step.type === "widget" ? { component: step.widget as ComponentType<Record<string, unknown>>, props: {} } : step.visual;
      if (!visual) return;
      // Steps with the same title get -2, -3…: every id of a level is handed out once.
      const base = slugify(step.id ?? resolveText(step.title, "en"));
      let id = base;
      for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
      used.add(id);
      items.push({
        id,
        level,
        step: i,
        title: step.title,
        body: step.body,
        kind: step.type === "widget" ? "widget" : "picture",
        component: visual.component,
        props: visual.props,
      });
    });
  }
  return items;
}

type Where = Pick<TopicMeta, "subject" | "slug">;

/** The public page of one picture. */
export const showHref = (t: Where, level: Level, id: string) => `/show/${t.subject}/${t.slug}/${level}/${id}`;
/** The same picture alone, for an iframe on another site. */
export const embedHref = (t: Where, level: Level, id: string) => `/embed/${t.subject}/${t.slug}/${level}/${id}`;
/** All public pictures of a topic. */
export const showTopicHref = (t: Where) => `/show/${t.subject}/${t.slug}`;
