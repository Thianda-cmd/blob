import { LEGACY_LESSON_LEVEL, lessonLevels, type TopicMeta } from "./catalog";
import { EMPTY_PROGRESS, levelKey, type TopicProgress } from "./progress";
import { LEVELS, type Level } from "./types";

export type LevelRows = Record<string, TopicProgress>;

/**
 * Progress of one level of a topic. A topic from before levels had one lesson: its old topic row
 * counts for that lesson's level until the level has a row of its own.
 */
export function levelProgress(slug: string, level: Level, topicRow: TopicProgress | undefined, rows: LevelRows): TopicProgress {
  const own = rows[levelKey(slug, level)];
  if (own) return own;
  if (topicRow && LEGACY_LESSON_LEVEL[slug] === level) return { ...topicRow, topic: levelKey(slug, level) };
  return EMPTY_PROGRESS(levelKey(slug, level));
}

/**
 * The level to open a topic at: the first written lesson not done yet, else the first level
 * whose practice isn't mastered, else the highest written level.
 */
export function suggestedLevel(meta: Pick<TopicMeta, "slug" | "levels">, topicRow: TopicProgress | undefined, rows: LevelRows): Level {
  const written = lessonLevels(meta);
  const state = (l: Level) => levelProgress(meta.slug, l, topicRow, rows);
  const open = written.find((l) => !state(l).lesson_done);
  if (open) return open;
  const weak = written.find((l) => state(l).mastery < 85);
  return weak ?? written[written.length - 1] ?? 1;
}

export const parseLevel = (raw: unknown): Level | undefined => {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return LEVELS.includes(n as Level) ? (n as Level) : undefined;
};
