import { tx } from "@/i18n/text";
import type { Exercise, LevelLesson } from "@/learn/types";

const soon = tx("Blob is still writing this lesson.", "Blob schreibt diese Lektion gerade noch.");

/** Placeholder lesson for a level while it is being written. */
export const stubLesson = (): LevelLesson => ({
  summary: [{ title: tx("Coming soon", "Kommt bald"), body: soon }],
  lesson: [{ type: "explain", title: tx("Coming soon", "Kommt bald"), body: soon, blob: tx("Almost ready!", "Fast fertig!") }],
});

/** Placeholder task for a level while it is being written. */
export const stubExercise = (): Exercise => ({
  instruction: tx("Warm-up", "Zum Aufwärmen"),
  math: "2 + 2",
  answer: { kind: "number", value: 4 },
  solution: [{ math: "2 + 2 = 4", note: tx("Two plus two is four.", "Zwei plus zwei ist vier.") }],
});
