import type { SingleLessonTopic, Topic } from "@/learn/types";

/** Biology topics, each loaded when first needed (same order as BIOLOGY_CATALOG). */
export const BIOLOGY_LOADERS: Record<string, () => Promise<{ default: Topic | SingleLessonTopic }>> = {
  cell: () => import("./cell"),
  "cell-division": () => import("./cell-division"),
  enzymes: () => import("./enzymes"),
  "plant-structure": () => import("./plant-structure"),
  photosynthesis: () => import("./photosynthesis"),
  "flowers-seeds": () => import("./flowers-seeds"),
  "plant-diversity": () => import("./plant-diversity"),
  vertebrates: () => import("./vertebrates"),
  digestion: () => import("./digestion"),
  circulation: () => import("./circulation"),
  "nervous-system": () => import("./nervous-system"),
  "immune-system": () => import("./immune-system"),
  genetics: () => import("./genetics"),
  dna: () => import("./dna"),
  evolution: () => import("./evolution"),
  ecosystems: () => import("./ecosystems"),
};
