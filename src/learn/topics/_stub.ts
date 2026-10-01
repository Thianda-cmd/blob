import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";

/** Placeholder used while a topic is being written. */
export function stubTopic(slug: string): Topic {
  return {
    ...topicMeta(slug),
    summary: [{ title: "Coming soon", body: "Blob is still writing this lesson." }],
    lesson: [{ type: "explain", title: "Coming soon", body: "Blob is still writing this lesson.", blob: "Almost ready!" }],
    generate: () => ({
      instruction: "Warm-up",
      math: "2 + 2",
      answer: { kind: "number", value: 4 },
      solution: [{ math: "2 + 2 = 4", note: "Two plus two is four." }],
    }),
  };
}
