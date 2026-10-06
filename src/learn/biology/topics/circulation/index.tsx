"use client";

import { topicMeta } from "@/learn/catalog";
import type { Topic } from "@/learn/types";
import { generate1, level1 } from "./level1";
import { generate2, level2 } from "./level2";
import { generate3, level3 } from "./level3";

const topic: Topic = {
  ...topicMeta("circulation"),
  lessons: { 1: level1, 2: level2, 3: level3 },
  generate: (level, rng) => (level === 1 ? generate1(rng) : level === 2 ? generate2(rng) : generate3(rng)),
};

export default topic;
