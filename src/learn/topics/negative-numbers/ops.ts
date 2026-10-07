"use client";

import type { Locale } from "@/i18n/config";
import type { Text } from "@/i18n/text";
import type { Frame } from "@/learn/types";
import { dmath, num, r9, say } from "./shared";

// ---------------------------------------------------------------------------
// A tiny model of calculations with brackets, squares, point and line operations,
// solved step by step in school order (brackets, powers, point before line), with
// keyed tokens so each result glides into the place of its first number.

export type Op4 = "+" | "-" | "*" | ":";
export type Node =
  | { t: "n"; v: number; k: string }
  | { t: "op"; op: Op4; l: Node; r: Node; k: string; ok?: string }
  | { t: "br"; e: Node; k: string }
  | { t: "sq"; e: Node; k: string };

/** Builds nodes with unique keys (local counter: the same task always gets the same keys). */
export function builder(prefix = "k") {
  let i = 0;
  const id = () => `${prefix}${i++}`;
  return {
    n: (v: number): Node => ({ t: "n", v, k: id() }),
    op: (op: Op4, l: Node, r: Node): Node => ({ t: "op", op, l, r, k: id() }),
    br: (e: Node): Node => ({ t: "br", e, k: id() }),
    sq: (e: Node): Node => ({ t: "sq", e, k: id() }),
  };
}

const apply = (op: Op4, a: number, b: number) => r9(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);

/** The value. `squareSlip`: a student who thinks (−3)² = −9. */
export function evaluate(n: Node, opts: { squareSlip?: boolean } = {}): number {
  switch (n.t) {
    case "n":
      return n.v;
    case "br":
      return evaluate(n.e, opts);
    case "sq": {
      const b = evaluate(n.e, opts);
      return opts.squareSlip && b < 0 ? -(b * b) : b * b;
    }
    case "op":
      return apply(n.op, evaluate(n.l, opts), evaluate(n.r, opts));
  }
}

function flatten(n: Node, vals: Node[], ops: Op4[]) {
  if (n.t === "op") {
    flatten(n.l, vals, ops);
    ops.push(n.op);
    flatten(n.r, vals, ops);
  } else vals.push(n);
}

/** Strictly from left to right, ignoring "point before line" (brackets still first). */
export function evalLeftToRight(n: Node): number {
  if (n.t === "n") return n.v;
  if (n.t === "br") return evalLeftToRight(n.e);
  if (n.t === "sq") {
    const b = evalLeftToRight(n.e);
    return b * b;
  }
  const vals: Node[] = [];
  const ops: Op4[] = [];
  flatten(n, vals, ops);
  let acc = evalLeftToRight(vals[0]);
  ops.forEach((op, i) => (acc = apply(op, acc, evalLeftToRight(vals[i + 1]))));
  return acc;
}

/** Display-language source. A negative number gets brackets unless it opens a sum. */
export function render(n: Node, l: Locale = "en", keys = true, first = true): string {
  const K = (k: string) => (keys ? `#${k}` : "");
  switch (n.t) {
    case "n": {
      const abs = num(Math.abs(n.v), l);
      if (n.v >= 0) return `${abs}${K(n.k)}`;
      const inner = keys ? `-#${n.k}s ${abs}#${n.k}` : `-${abs}`;
      return first ? inner : `(${inner})${K(`${n.k}b`)}`;
    }
    case "op": {
      const sym = n.op === "*" ? "\\cdot" : n.op;
      const point = n.op === "*" || n.op === ":";
      return `${render(n.l, l, keys, first && !point)} ${sym}${K(n.ok ?? `${n.k}o`)} ${render(n.r, l, keys, false)}`;
    }
    case "br":
      return `(${render(n.e, l, keys, true)})${K(n.k)}`;
    case "sq":
      return `${render(n.e, l, keys, false)}^{2${K(`${n.k}e`)}}`;
  }
}

const leftmost = (n: Node): string => (n.t === "n" ? n.k : n.t === "op" ? leftmost(n.l) : leftmost(n.e));
const isNum = (n: Node): n is Extract<Node, { t: "n" }> => n.t === "n";

type Calc = { src: (l: Locale) => string; v: number };
type Step = { n: Node; kind: "br" | "sq" | "point" | "merge" | "line"; calcs: Calc[]; made: string[] };

/** Replaces nodes for which `f` returns a replacement (top-down, the first match in each branch). */
function mapNode(n: Node, f: (x: Node) => Node | undefined): Node {
  const hit = f(n);
  if (hit) return hit;
  switch (n.t) {
    case "n":
      return n;
    case "op":
      return { ...n, l: mapNode(n.l, f), r: mapNode(n.r, f) };
    case "br":
    case "sq":
      return { ...n, e: mapNode(n.e, f) };
  }
}

function some(n: Node, f: (x: Node) => boolean): boolean {
  if (f(n)) return true;
  if (n.t === "op") return some(n.l, f) || some(n.r, f);
  if (n.t === "br" || n.t === "sq") return some(n.e, f);
  return false;
}

/**
 * One step in school order. `slip`: the first value computed in this step gets the wrong
 * sign (for "find the mistake" tasks).
 */
export function step(root: Node, slip = false): Step | null {
  const calcs: Calc[] = [];
  const made: string[] = [];
  let slipped = false;
  const compute = (x: Node, v: number) => {
    let out = v;
    if (slip && !slipped && v !== 0 && some(x, (y) => y.t === "n" && y.v < 0)) {
      out = -v;
      slipped = true;
    }
    calcs.push({ src: (l) => `${render(x, l, false)} = ${num(v, l)}`, v });
    const k = leftmost(x);
    made.push(k);
    return { t: "n", v: out, k } as Node;
  };

  // 1. Brackets: work inside the first bracket that still holds a calculation.
  const simpleBr = (x: Node) => x.t === "br" && x.e.t === "op" && isNum(x.e.l) && isNum(x.e.r);
  if (some(root, simpleBr)) {
    let done = false;
    const n = mapNode(root, (x) => (!done && x.t === "br" && simpleBr(x) ? ((done = true), compute(x.e, evaluate(x.e))) : undefined));
    return { n, kind: "br", calcs, made };
  }
  const deepBr = (x: Node) => x.t === "br" && x.e.t !== "n";
  if (some(root, deepBr)) {
    let done = false;
    let inner: Step | null = null;
    const n = mapNode(root, (x) => {
      if (done || x.t !== "br" || x.e.t === "n") return undefined;
      done = true;
      inner = step(x.e, slip);
      return inner ? { ...x, e: inner.n } : x;
    });
    const s = inner as Step | null;
    if (s) return { n, kind: "br", calcs: s.calcs, made: s.made };
  }
  // 2. Powers.
  const simpleSq = (x: Node) => x.t === "sq" && (isNum(x.e) || (x.e.t === "br" && isNum(x.e.e)));
  if (some(root, simpleSq)) {
    const n = mapNode(root, (x) => (simpleSq(x) ? compute(x, evaluate(x)) : undefined));
    return { n, kind: "sq", calcs, made };
  }
  // 3. Point before line: every product or quotient of two numbers at once.
  const point = (x: Node) => x.t === "op" && (x.op === "*" || x.op === ":") && isNum(x.l) && isNum(x.r);
  if (some(root, point)) {
    const n = mapNode(root, (x) => (point(x) ? compute(x, evaluate(x)) : undefined));
    return { n, kind: "point", calcs, made };
  }
  // 4. Two signs meet: + (−6) becomes − 6, − (−6) becomes + 6.
  const meet = (x: Node) => x.t === "op" && (x.op === "+" || x.op === "-") && isNum(x.r) && x.r.v < 0;
  if (some(root, meet)) {
    const n = mapNode(root, (x) => {
      if (x.t !== "op" || !meet(x)) return undefined;
      const r = x.r as Extract<Node, { t: "n" }>;
      calcs.push({ src: (l) => `${x.op} (${num(r.v, l)}) = ${x.op === "+" ? "-" : "+"} ${num(-r.v, l)}`, v: 0 });
      return { ...x, op: x.op === "+" ? "-" : "+", ok: `${r.k}s`, r: { ...r, v: -r.v } };
    });
    return { n, kind: "merge", calcs, made };
  }
  // 5. Line: the first sum or difference of two numbers, from the left.
  const line = (x: Node) => x.t === "op" && isNum(x.l) && isNum(x.r);
  if (some(root, line)) {
    let done = false;
    const n = mapNode(root, (x) => (!done && line(x) ? ((done = true), compute(x, evaluate(x))) : undefined));
    return { n, kind: "line", calcs, made };
  }
  return null;
}

/** All steps from the task to the result. */
export function steps(root: Node, slipAt = -1): Step[] {
  const out: Step[] = [];
  let cur: Node = root;
  let evalIndex = 0;
  for (let i = 0; i < 20; i++) {
    const peek = step(cur);
    if (!peek) break;
    const isEval = peek.kind !== "merge";
    const s = isEval && evalIndex === slipAt ? step(cur, true)! : peek;
    if (isEval) evalIndex++;
    out.push(s);
    cur = s.n;
  }
  return out;
}

const NOTE: Record<Step["kind"], [string, string]> = {
  br: ["Brackets first:", "Zuerst die Klammer:"],
  sq: ["Then the power:", "Dann die Potenz:"],
  point: ["Point before line:", "Punkt vor Strich:"],
  merge: ["Two signs meet:", "Zwei Zeichen treffen aufeinander:"],
  line: ["Now from left to right:", "Jetzt von links nach rechts:"],
};

/** The note of one step: "Point before line: $4 \cdot (-2) = -8$." */
export function stepNote(s: Step): Text {
  return say((t, l) => {
    const [en, de] = NOTE[s.kind];
    const parts = s.calcs.map((c) => `$${c.src(l)}$`).join(t(" and ", " und "));
    const extra =
      s.kind === "sq" ? t(" A square of a negative number is positive.", " Das Quadrat einer negativen Zahl ist positiv.") : s.kind === "merge" ? t(" Equal signs give plus, different signs give minus.", " Gleiche Zeichen ergeben plus, verschiedene minus.") : "";
    return `${t(en, de)} ${parts}.${extra}`;
  });
}

/** The worked solution as frames: the task, then one frame per step. */
export function solveFrames(root: Node, first: Text, last?: Text): Frame[] {
  const frames: Frame[] = [{ math: dmath((l) => render(root, l)), note: first }];
  for (const s of steps(root)) frames.push({ math: dmath((l) => render(s.n, l)), note: stepNote(s), highlight: s.made });
  const v = evaluate(root);
  const end = frames[frames.length - 1];
  frames[frames.length - 1] = {
    ...end,
    note: say((t, l) => {
      const base = typeof end.note === "object" && end.note ? end.note[l] : String(end.note ?? "");
      const extra = last ? ` ${typeof last === "string" ? last : last[l]}` : "";
      return `${base} ${t(`Result: $${num(v, l)}$.`, `Ergebnis: $${num(v, l)}$.`)}${extra}`;
    }),
  };
  return frames;
}
