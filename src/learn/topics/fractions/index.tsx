"use client";

import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";
import base from "./level1";
import { level2 } from "./level2";
import { level3 } from "./level3";

/**
 * Fractions. Level 1 is the lesson written before levels; until the other levels have their own
 * tasks, its practice (three difficulty tiers) serves every level.
 */
const topic: Topic = {
  ...topicMeta("fractions"),
  lessons: { 1: { lesson: base.lesson, summary: base.summary }, 2: level2, 3: level3 },
  generate: base.generate,
};

export default topic;
