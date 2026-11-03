// Every spreadsheet function by its canonical (English) name. names.ts lists them with their
// German names; each category lives in its own file next to this one.

import { FUNCTION_NAMES } from "../names";
import { CONVERT } from "./convert";
import { DATE_FNS } from "./date";
import { INFO } from "./info";
import { LOGIC } from "./logic";
import { LOOKUP } from "./lookup";
import { MATH } from "./math";
import { REGRESSION } from "./regression";
import { STATS } from "./stats";
import { TEXT_FNS } from "./text";
import type { FnDef } from "./types";

export type { Ctx, FnDef } from "./types";

const ALL = new Map<string, FnDef>();
for (const list of [MATH, STATS, REGRESSION, LOGIC, LOOKUP, TEXT_FNS, DATE_FNS, INFO, CONVERT]) for (const f of list) ALL.set(f.name, f);

/** The definition of a function by canonical name (upper case); null when there is none. */
export function getFunction(name: string): FnDef | null {
  return ALL.get(name) ?? null;
}

/** Names in names.ts without an implementation (the check script makes sure this stays empty). */
export function missingFunctions(): string[] {
  return FUNCTION_NAMES.filter((f) => !ALL.has(f.en)).map((f) => f.en);
}

/** Which kind of argument number i is: "s" (one value, lifted over arrays), "v" (value or array) or "r" (reference kept). */
export function argKind(spec: string, i: number): string {
  const slash = spec.indexOf("/");
  if (slash < 0) return spec[Math.min(i, spec.length - 1)] ?? "s";
  const head = spec.slice(0, slash);
  const cycle = spec.slice(slash + 1);
  return i < head.length ? head[i] : cycle[(i - head.length) % cycle.length];
}
