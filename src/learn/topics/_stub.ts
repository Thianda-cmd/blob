import { tx } from "@/i18n/text";
import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";

const soon = tx("Blob is still writing this lesson.", "Blob schreibt diese Lektion gerade noch.");

/** Placeholder used while a topic is being written. */
export function stubTopic(slug: string): Topic {
  return {
    ...topicMeta(slug),
    summary: [{ title: tx("Coming soon", "Kommt bald"), body: soon }],
    lesson: [{ type: "explain", title: tx("Coming soon", "Kommt bald"), body: soon, blob: tx("Almost ready!", "Fast fertig!") }],
    generate: () => ({
      instruction: tx("Warm-up", "Zum Aufwärmen"),
      math: "2 + 2",
      answer: { kind: "number", value: 4 },
      solution: [{ math: "2 + 2 = 4", note: tx("Two plus two is four.", "Zwei plus zwei ist vier.") }],
    }),
  };
}
