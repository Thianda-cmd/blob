import { use } from "react";
import { LEGACY_LESSON_LEVEL } from "@/learn/catalog";
import { BIOLOGY_LOADERS } from "@/learn/biology/topics";
import { CHEMISTRY_LOADERS } from "@/learn/chemistry/topics";
import type { SingleLessonTopic, Topic } from "@/learn/types";

type Loader = () => Promise<{ default: Topic | SingleLessonTopic }>;

/** Maths topics, loaded when first needed (each topic is its own chunk). */
const MATHS_LOADERS: Record<string, Loader> = {
  brackets: () => import("./brackets"),
  expanding: () => import("./expanding"),
  rearranging: () => import("./rearranging"),
  fractions: () => import("./fractions"),
  "powers-roots": () => import("./powers-roots"),
  percentages: () => import("./percentages"),
  equations: () => import("./equations"),
  "linear-systems": () => import("./linear-systems"),
  "pq-formula": () => import("./pq-formula"),
  lines: () => import("./lines"),
  "word-problems": () => import("./word-problems"),
  unknowns: () => import("./unknowns"),
};

const LOADERS: Record<string, Loader> = { ...MATHS_LOADERS, ...CHEMISTRY_LOADERS, ...BIOLOGY_LOADERS };

/** A topic from before levels gets its one lesson at the level its catalog entry names. */
export function withLevels(t: Topic | SingleLessonTopic): Topic {
  if ("lessons" in t) return t;
  const { summary, lesson, ...rest } = t;
  return { ...rest, lessons: { [LEGACY_LESSON_LEVEL[t.slug] ?? 1]: { lesson, summary } } };
}

const cache = new Map<string, Promise<Topic>>();

/** The full topic (lessons, widgets, task generator). Loaded once per page. */
export function loadTopic(slug: string): Promise<Topic> {
  let p = cache.get(slug);
  if (!p) {
    const load = LOADERS[slug];
    p = load ? load().then((m) => withLevels(m.default)) : Promise.reject(new Error(`Unknown topic: ${slug}`));
    cache.set(slug, p);
  }
  return p;
}

/** The full topic inside a component (suspends until its chunk has loaded). */
export function useTopic(slug: string): Topic {
  return use(loadTopic(slug));
}

export const hasTopic = (slug: string) => slug in LOADERS;
