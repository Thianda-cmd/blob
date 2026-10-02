import { CHEMISTRY } from "@/learn/chemistry/topics";
import type { Topic } from "@/learn/types";
import brackets from "./brackets";
import equations from "./equations";
import expanding from "./expanding";
import fractions from "./fractions";
import lines from "./lines";
import linearSystems from "./linear-systems";
import percentages from "./percentages";
import powersRoots from "./powers-roots";
import pqFormula from "./pq-formula";
import rearranging from "./rearranging";
import unknowns from "./unknowns";
import wordProblems from "./word-problems";

/** Maths topics in the order they're suggested. */
export const MATHS: Topic[] = [
  brackets,
  expanding,
  rearranging,
  fractions,
  powersRoots,
  percentages,
  equations,
  linearSystems,
  pqFormula,
  lines,
  wordProblems,
  unknowns,
];

/** Every topic of every live subject. */
export const TOPICS: Topic[] = [...MATHS, ...CHEMISTRY];

export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

