import type { SingleLessonTopic, Topic } from "@/learn/types";

/** Chemistry topics, each loaded when first needed (same order as CHEMISTRY_CATALOG). */
export const CHEMISTRY_LOADERS: Record<string, () => Promise<{ default: Topic | SingleLessonTopic }>> = {
  particles: () => import("./particles"),
  mixtures: () => import("./mixtures"),
  atoms: () => import("./atoms"),
  "periodic-table": () => import("./periodic-table"),
  "ionic-bonds": () => import("./ionic-bonds"),
  "covalent-bonds": () => import("./covalent-bonds"),
  reactions: () => import("./reactions"),
  balancing: () => import("./balancing"),
  "acids-bases": () => import("./acids-bases"),
  redox: () => import("./redox"),
  moles: () => import("./moles"),
  alkanes: () => import("./alkanes"),
};
