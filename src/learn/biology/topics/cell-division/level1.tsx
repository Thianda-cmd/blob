"use client";

import type { Rng } from "@/learn/engine/rng";
import { stubExercise, stubLesson } from "@/learn/topics/_stub";
import type { Exercise, LevelLesson } from "@/learn/types";

/** Level 1: still being written. */
export const level1: LevelLesson = stubLesson();

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder until the level is written
export function generate1(rng: Rng): Exercise {
  return stubExercise();
}
