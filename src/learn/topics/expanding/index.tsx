"use client";

import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";
import base from "./level2";
import { level1 } from "./level1";
import { level3 } from "./level3";

/**
 * Expanding brackets. Level 2 is the lesson written before levels; until the other levels have their own
 * tasks, its practice (three difficulty tiers) serves every level.
 */
const topic: Topic = {
  ...topicMeta("expanding"),
  lessons: { 1: level1, 2: { lesson: base.lesson, summary: base.summary }, 3: level3 },
  generate: base.generate,
};

export default topic;
