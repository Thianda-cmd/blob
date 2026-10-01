"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { SolutionPlayer } from "@/learn/components/SolutionPlayer";
import { topicMeta } from "@/learn/catalog";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";
import { emWidth, smoothFracExits } from "./equations";

// ---------------------------------------------------------------------------
// Formulas as small trees. To solve for a letter we undo the operations around
// it from the outside in, which is exactly "undo in reverse order". Every token
// keeps its key, so letters glide from frame to frame.

type N =
  | { t: "sym"; s: string; id: string }
  | { t: "num"; v: string; id: string }
  | { t: "sum"; items: SumItem[]; id: string }
  | { t: "prod"; items: N[]; id: string; tight?: boolean }
  | { t: "frac"; num: N; den: N; id: string }
  | { t: "pow"; base: N; e: number; id: string }
  | { t: "sqrt"; body: N; id: string };
type SumItem = { neg: boolean; n: N; sid: string };

const sym = (s: string): N => ({ t: "sym", s, id: "" });
const num = (v: number | string): N => ({ t: "num", v: String(v), id: "" });
/** Product with "·" between letters: m · a. */
const mul = (...items: N[]): N => ({ t: "prod", items, id: "" });
/** Product written without dots: 2πr, mx. */
const tight = (...items: N[]): N => ({ t: "prod", items, id: "", tight: true });
const over = (n: N, d: N): N => ({ t: "frac", num: n, den: d, id: "" });
const sq = (base: N): N => ({ t: "pow", base, e: 2, id: "" });
const root = (body: N): N => ({ t: "sqrt", body, id: "" });
const sum = (...parts: (N | ["-", N])[]): N => ({
  t: "sum",
  id: "",
  items: parts.map((p) => (Array.isArray(p) ? { neg: true, n: p[1], sid: "" } : { neg: false, n: p, sid: "" })),
});
const half = () => over(num(1), num(2));

/** Give every node of a formula a key: k0, k1, … */
function label(node: N, next = { n: 0 }): N {
  const id = `k${next.n++}`;
  switch (node.t) {
    case "sym":
    case "num":
      return { ...node, id };
    case "sum":
      return { ...node, id, items: node.items.map((it) => ({ neg: it.neg, sid: `k${next.n++}`, n: label(it.n, next) })) };
    case "prod":
      return { ...node, id, items: node.items.map((f) => label(f, next)) };
    case "frac":
      return { ...node, id, num: label(node.num, next), den: label(node.den, next) };
    case "pow":
      return { ...node, id, base: label(node.base, next) };
    case "sqrt":
      return { ...node, id, body: label(node.body, next) };
  }
}

/** A copy of a subtree with fresh keys (same keys + suffix). */
function clone(node: N, sfx: string): N {
  switch (node.t) {
    case "sym":
    case "num":
      return { ...node, id: node.id + sfx };
    case "sum":
      return { ...node, id: node.id + sfx, items: node.items.map((it) => ({ neg: it.neg, sid: it.sid + sfx, n: clone(it.n, sfx) })) };
    case "prod":
      return { ...node, id: node.id + sfx, items: node.items.map((f) => clone(f, sfx)) };
    case "frac":
      return { ...node, id: node.id + sfx, num: clone(node.num, sfx), den: clone(node.den, sfx) };
    case "pow":
      return { ...node, id: node.id + sfx, base: clone(node.base, sfx) };
    case "sqrt":
      return { ...node, id: node.id + sfx, body: clone(node.body, sfx) };
  }
}

function has(node: N, s: string): boolean {
  switch (node.t) {
    case "sym":
      return node.s === s;
    case "num":
      return false;
    case "sum":
      return node.items.some((it) => has(it.n, s));
    case "prod":
      return node.items.some((f) => has(f, s));
    case "frac":
      return has(node.num, s) || has(node.den, s);
    case "pow":
      return has(node.base, s);
    case "sqrt":
      return has(node.body, s);
  }
}

const isInt = (node: N) => node.t === "num" && /^\d+$/.test(node.v);

/** Display-language source. `mark` paints one letter purple (the one we solve for). */
function src(node: N, keys = true, mark?: string): string {
  const K = (k: string) => (keys ? `#${k}` : "");
  const inner = (n: N) => src(n, keys, mark);
  switch (node.t) {
    case "sym": {
      const body = `${node.s === "π" ? "\\pi" : node.s}${K(node.id)}`;
      return mark && node.s === mark ? `\\blob{${body}}` : body;
    }
    case "num":
      return `${node.v}${K(node.id)}`;
    case "sum":
      return node.items
        .map((it, i) => {
          const sign = it.neg ? `-${K(it.sid)} ` : i ? `+${K(it.sid)} ` : "";
          return sign + (it.n.t === "sum" ? `(${inner(it.n)})${K(`p${it.n.id}`)}` : inner(it.n));
        })
        .join(" ");
    case "prod":
      return node.items
        .map((f, i) => {
          const body = f.t === "sum" ? `(${inner(f)})${K(`p${f.id}`)}` : inner(f);
          if (i === 0) return body;
          const prev = node.items[i - 1];
          const glue = node.tight
            ? f.t !== "frac" && f.t !== "num" && prev.t !== "frac"
            : isInt(prev) && (f.t === "sym" || f.t === "pow" || f.t === "sum" || f.t === "sqrt");
          return glue ? ` ${body}` : ` \\cdot${K(`m${f.id}`)} ${body}`;
        })
        .join("");
    case "frac":
      return `\\frac{${inner(node.num)}}{${inner(node.den)}}${K(node.id)}`;
    case "pow": {
      const atom = node.base.t === "sym" || node.base.t === "num";
      const base = atom ? inner(node.base) : `(${inner(node.base)})${K(`p${node.id}`)}`;
      return `${base}^{${node.e}${K(`e${node.id}`)}}`;
    }
    case "sqrt":
      return `\\sqrt{${inner(node.body)}}${K(node.id)}`;
  }
}

/** Plain text for the answer checker, e.g. "(100*Z)/(K*t)". */
function plain(node: N): string {
  switch (node.t) {
    case "sym":
      return node.s === "π" ? "pi" : node.s;
    case "num":
      return node.v.replace(",", ".");
    case "sum":
      return node.items.map((it, i) => `${it.neg ? "-" : i ? "+" : ""}(${plain(it.n)})`).join("");
    case "prod":
      return node.items.map((f) => `(${plain(f)})`).join("*");
    case "frac":
      return `(${plain(node.num)})/(${plain(node.den)})`;
    case "pow":
      return `(${plain(node.base)})^${node.e}`;
    case "sqrt":
      return `sqrt(${plain(node.body)})`;
  }
}

/** Keys of all tokens a display-language source draws. */
function leafKeys(math: string): string[] {
  const out: string[] = [];
  const walk = (nodes: DNode[]) => {
    for (const n of nodes) {
      if (n.type === "num" || n.type === "var" || n.type === "op" || n.type === "text" || n.type === "sym") out.push(n.k);
      else if (n.type === "frac") {
        out.push(`${n.k}-bar`);
        walk([...n.num, ...n.den]);
      } else if (n.type === "paren") {
        out.push(`${n.k}(`, `${n.k})`);
        walk(n.body);
      } else if (n.type === "sqrt") {
        out.push(`${n.k}-rad`);
        walk(n.body);
      } else if (n.type === "pow") walk([...n.base, ...n.exp]);
      else if (n.type === "sub") walk([...n.base, ...n.sub]);
      else if (n.type === "style") walk(n.body);
    }
  };
  walk(parseDisplay(math));
  return out;
}

const factors = (node: N) => (node.t === "prod" ? node.items : [node]);
const needsBrackets = (node: N) => node.t === "sum" || (node.t === "prod" && node.items.length > 1);

function appendSum(o: N, item: SumItem, n: number): N {
  if (o.t === "sum") return { ...o, items: [...o.items, item] };
  return { t: "sum", id: `su${n}`, items: [{ neg: false, n: o, sid: `sz${n}` }, item] };
}

function divideBy(o: N, d: N, n: number): N {
  if (o.t === "frac") return { ...o, den: { t: "prod", id: o.den.t === "prod" ? o.den.id : `dp${n}`, items: [...factors(o.den), ...factors(d)] } };
  return { t: "frac", id: `fo${n}`, num: o, den: d };
}

/** Multiply by a number (written in front: 2A) or by a letter (written behind: v · t). */
function multiplyBy(o: N, m: N, n: number): N {
  if (o.t === "frac") return { ...o, num: multiplyBy(o.num, m, n) };
  const front = m.t === "num";
  if (o.t === "prod") return { ...o, tight: false, items: front ? [m, ...o.items] : [...o.items, m] };
  return { t: "prod", id: `mp${n}`, items: front ? [m, o] : [o, m] };
}

// ---------------------------------------------------------------------------
// One undo step at a time.

type Step = {
  /** The operation after the bar, e.g. "-2b", ":(K · t)". */
  op: string;
  /** Both sides with the operation applied but not simplified yet. */
  tApply: N;
  oApply: N;
  /** Both sides afterwards. */
  t: N;
  o: N;
  before: string;
  after: string;
  /** For hints: "divide both sides by $a$". */
  short: string;
};

function plan(T: N, O: N, target: string, n: number): Step {
  const p = (x: N) => src(x, false);
  const A = (x: N) => clone(x, `_a${n}`);
  const Tc = (x: N) => clone(x, `_t${n}`);
  const Oc = (x: N) => clone(x, `_o${n}`);
  const opNode = (sign: string, x: N, bracket: boolean) => `${sign}#ao${n} ${bracket ? `(${src(A(x))})#ab${n}` : src(A(x))}`;

  if (T.t === "sum") {
    const idx = T.items.findIndex((it) => has(it.n, target));
    const mine = T.items[idx];
    const pick = mine.neg ? mine : T.items.find((_, j) => j !== idx)!;
    const moving = pick === mine;
    const X = p(pick.n);
    const rest = T.items.filter((it) => it !== pick);
    const flipped = pick.neg ? "+" : "-";
    return {
      op: opNode(flipped, pick.n, pick.n.t === "sum"),
      tApply: { ...T, items: [...T.items, { neg: !pick.neg, n: Tc(pick.n), sid: `ts${n}` }] },
      oApply: appendSum(O, { neg: !pick.neg, n: Oc(pick.n), sid: `os${n}` }, n),
      t: rest.length === 1 && !rest[0].neg ? rest[0].n : { ...T, items: rest },
      o: appendSum(O, { neg: !pick.neg, n: Oc(pick.n), sid: `os${n}` }, n),
      before: moving
        ? `$${target}$ comes with a minus. Add $${X}$ on both sides to bring it over.`
        : `$${X}$ is ${pick.neg ? "subtracted" : "added"}. Undo it: ${pick.neg ? "add" : "subtract"} $${X}$ on **both** sides.`,
      after: moving ? `Now $${target}$ is on the other side, with a plus.` : `$${pick.neg ? "-" : "+"} ${X}$ and $${flipped} ${X}$ cancel.`,
      short: `${pick.neg ? "add" : "subtract"} $${X}$ on both sides`,
    };
  }

  if (T.t === "prod") {
    // A fraction with a number underneath (½, (a + c)/2): multiply it away first.
    const fi = T.items.findIndex((f) => f.t === "frac" && f.den.t === "num");
    if (fi >= 0) {
      const fr = T.items[fi] as Extract<N, { t: "frac" }>;
      const M = fr.den;
      const left = fr.num.t === "num" && fr.num.v === "1" ? [] : [fr.num];
      const items = [...T.items.slice(0, fi), ...left, ...T.items.slice(fi + 1)];
      return {
        op: `\\cdot#ao${n} ${src(A(M))}`,
        tApply: { t: "prod", id: `pm${n}`, items: [Tc(M), ...T.items] },
        oApply: multiplyBy(O, Oc(M), n),
        t: items.length === 1 ? items[0] : { ...T, items },
        o: multiplyBy(O, Oc(M), n),
        before: `Get rid of the fraction $${p(fr)}$ first: multiply both sides by $${p(M)}$.`,
        after: `$${p(M)} \\cdot ${p(fr)} = ${left.length ? (left[0].t === "sum" ? `(${p(left[0])})` : p(left[0])) : "1"}$.`,
        short: `multiply both sides by $${p(M)}$`,
      };
    }
    const ti = T.items.findIndex((f) => has(f, target));
    const others = T.items.filter((_, j) => j !== ti);
    const D: N = others.length === 1 ? others[0] : { t: "prod", id: `pd${n}`, items: others, tight: T.tight };
    const kept = T.items[ti];
    return {
      op: opNode(":", D, needsBrackets(D)),
      tApply: { t: "frac", id: `ft${n}`, num: T, den: Tc(D) },
      oApply: divideBy(O, Oc(D), n),
      t: kept,
      o: divideBy(O, Oc(D), n),
      before: `$${p(kept)}$ is multiplied by $${p(D)}$. Undo it: divide both sides by $${p(D)}$.`,
      after: `$\\frac{${p(T)}}{${p(D)}} = ${p(kept)}$: the $${p(D)}$ cancels.`,
      short: `divide both sides by $${p(D)}$`,
    };
  }

  if (T.t === "frac") {
    const M = T.den;
    const inDen = has(M, target);
    return {
      op: `\\cdot#ao${n} ${needsBrackets(M) ? `(${src(A(M))})#ab${n}` : src(A(M))}`,
      tApply: { t: "prod", id: `pf${n}`, items: [T, Tc(M)] },
      oApply: multiplyBy(O, Oc(M), n),
      t: T.num,
      o: multiplyBy(O, Oc(M), n),
      before: inDen
        ? `$${target}$ is in the denominator. Multiply both sides by $${p(M)}$ to get it out.`
        : `$${p(T.num)}$ is divided by $${p(M)}$. Undo it: multiply both sides by $${p(M)}$.`,
      after: inDen
        ? `$\\frac{${p(T.num)}}{${p(M)}} \\cdot ${p(M)} = ${p(T.num)}$. Now $${target}$ is on the other side, and no longer in a fraction.`
        : `$\\frac{${p(T.num)}}{${p(M)}} \\cdot ${p(M)} = ${p(T.num)}$.`,
      short: `multiply both sides by $${p(M)}$`,
    };
  }

  if (T.t === "pow") {
    const b = p(T.base);
    return {
      op: `\\sqrt{\\,}#ao${n}`,
      tApply: { t: "sqrt", id: `rt${n}`, body: T },
      oApply: { t: "sqrt", id: `ro${n}`, body: O },
      t: T.base,
      o: { t: "sqrt", id: `ro${n}`, body: O },
      before: `$${b}$ is squared. Undo it: take the square root of both sides.`,
      after: `$\\sqrt{${b}^2} = ${b}$, because $${b}$ is positive.`,
      short: "take the square root of both sides",
    };
  }

  if (T.t === "sqrt") {
    const body = p(T.body);
    const squared: N = { t: "pow", id: `po${n}`, base: O, e: 2 };
    return {
      op: `(\\,)#ao${n}^{2#ae${n}}`,
      tApply: { t: "pow", id: `pt${n}`, base: T, e: 2 },
      oApply: squared,
      t: T.body,
      o: squared,
      before: `$${body}$ is under a square root. Undo it: square both sides.`,
      after: `$(\\sqrt{${body}})^2 = ${body}$.`,
      short: "square both sides",
    };
  }
  throw new Error(`Can't undo ${T.t}`);
}

type Solution = { frames: Frame[]; answer: N; L: N; R: N; hint: string; steps: number };

/**
 * All frames for solving `L = R` for `target`. `maxEm`: the widest step that fits on one line
 * (about 13em in a worked solution, 18em on the lesson board); wider steps only show the bar.
 */
function rearrange(L0: N, R0: N, target: string, opts: { intro?: string; maxEm?: number } = {}): Solution {
  let L = L0;
  let R = R0;
  const eq = (l: N, r: N, op = "", n = 0) => `${src(l, true, target)} =#eq ${src(r, true, target)}${op ? ` \\quad |#bar${n} \\, ${op}` : ""}`;
  const frames: Frame[] = [{ math: eq(L, R), note: opts.intro ?? `We want $${target}$ on its own. Undo what happens to it, one step at a time.` }];
  let n = 0;
  let short = "";
  for (let guard = 0; guard < 10; guard++) {
    const left = has(L, target);
    const T = left ? L : R;
    const O = left ? R : L;
    if (T.t === "sym") break;
    n++;
    const s = plan(T, O, target, n);
    if (!short) short = s.short;
    const full = left ? eq(s.tApply, s.oApply, s.op, n) : eq(s.oApply, s.tApply, s.op, n);
    if (emWidth(full) <= (opts.maxEm ?? 13)) {
      // Highlight what this step adds on both sides (not the note after the bar).
      const before = new Set(leafKeys(frames[frames.length - 1].math));
      frames.push({ math: full, note: s.before, highlight: leafKeys(full).filter((k) => !before.has(k) && !/^(ao|ab|ae|bar)\d/.test(k) && !k.includes(`_a${n}`)) });
    } else {
      // Too wide for one line: just write the step after the bar, like in an exercise book.
      const math = eq(L, R, s.op, n);
      frames.push({ math, note: s.before, highlight: leafKeys(math).filter((k) => /^(ao|ab|ae)\d/.test(k) || k.includes(`_a${n}`)) });
    }
    if (left) [L, R] = [s.t, s.o];
    else [L, R] = [s.o, s.t];
    frames.push({ math: eq(L, R), note: s.after });
  }
  const leftDone = has(L, target);
  const answer = leftDone ? R : L;
  const done = `$${target} = ${src(answer, false)}$`;
  if (!leftDone) {
    [L, R] = [R, L];
    frames.push({ math: eq(L, R), note: `Swap the sides. Done: ${done}.` });
  } else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: `${last.note} Done: ${done}.` };
  }
  const hint = n === 1 ? `One step does it: ${short}.` : `First step: ${short}. Then keep undoing until $${target}$ is alone.`;
  return { frames: smoothFracExits(frames), answer, L, R, hint, steps: n };
}

// ---------------------------------------------------------------------------
// Formula bank

type Formula = {
  key: string;
  name: string;
  L: N;
  R: N;
  /** What the letters mean (rich text). */
  legend: string;
  /** Letters to solve for, with the practice level. */
  targets: Record<string, Level>;
  /** Example values for the number check in the explorer (inputs only). */
  values?: Record<string, number>;
};

function formula(key: string, name: string, L: N, R: N, legend: string, targets: Record<string, Level>, values?: Record<string, number>): Formula {
  const next = { n: 0 };
  return { key, name, L: label(L, next), R: label(R, next), legend, targets, values };
}

const FORMULAS: Formula[] = [
  formula("rect", "Rectangle", sym("A"), mul(sym("a"), sym("b")), "Area $A$ of a rectangle with sides $a$ and $b$.", { a: 1, b: 1 }, { a: 6, b: 4 }),
  formula("perimeter", "Perimeter", sym("u"), sum(mul(num(2), sym("a")), mul(num(2), sym("b"))), "Perimeter $u$ of a rectangle with sides $a$ and $b$.", { a: 2, b: 2 }, { a: 6, b: 4 }),
  formula("speed", "Speed", sym("v"), over(sym("s"), sym("t")), "Speed $v$, distance $s$, time $t$.", { s: 1, t: 2 }, { s: 120, t: 2 }),
  formula("force", "Force", sym("F"), mul(sym("m"), sym("a")), "Force $F$, mass $m$, acceleration $a$.", { m: 1, a: 1 }, { m: 5, a: 4 }),
  formula("power", "Electric power", sym("P"), mul(sym("U"), sym("I")), "Electric power $P$, voltage $U$, current $I$.", { U: 1, I: 1 }, { U: 12, I: 3 }),
  formula("triangle", "Triangle", sym("A"), mul(half(), sym("g"), sym("h")), "Area $A$ of a triangle with base $g$ and height $h$.", { g: 2, h: 2 }, { g: 8, h: 5 }),
  formula(
    "interest",
    "Interest",
    sym("Z"),
    over(mul(sym("K"), sym("p"), sym("t")), num(100)),
    "Interest $Z$ on a capital $K$ at $p$ percent for $t$ years.",
    { K: 2, p: 2, t: 2 },
    { K: 500, p: 4, t: 3 },
  ),
  formula("circle", "Circle", sym("U"), tight(num(2), sym("π"), sym("r")), "Circumference $U$ of a circle with radius $r$.", {}, { r: 5 }),
  formula("disc", "Circle area", sym("A"), tight(sym("π"), sq(sym("r"))), "Area $A$ of a circle with radius $r$.", {}, { r: 3 }),
  formula("fall", "Accelerating", sym("s"), mul(half(), sym("a"), sq(sym("t"))), "Distance $s$ after time $t$ with constant acceleration $a$.", { a: 2, t: 3 }, { a: 10, t: 3 }),
  formula(
    "trapezoid",
    "Trapezoid",
    sym("A"),
    mul(over(sum(sym("a"), sym("c")), num(2)), sym("h")),
    "Area $A$ of a trapezoid with parallel sides $a$ and $c$ and height $h$.",
    { h: 3, a: 3 },
    { a: 7, c: 3, h: 4 },
  ),
  formula("work", "Work", sym("W"), mul(sym("F"), sym("s")), "Work $W$ done by a force $F$ along a distance $s$.", { F: 1, s: 1 }),
  formula("ohm", "Ohm's law", sym("U"), mul(sym("R"), sym("I")), "Ohm's law: voltage $U$, resistance $R$, current $I$.", { R: 1, I: 1 }),
  formula("current", "Current", sym("I"), over(sym("U"), sym("R")), "Current $I$, voltage $U$, resistance $R$.", { U: 1, R: 2 }),
  formula("powerTime", "Power", sym("P"), over(sym("W"), sym("t")), "Power $P$: work $W$ done in a time $t$.", { W: 1, t: 2 }),
  formula("cuboid", "Cuboid", sym("V"), mul(sym("a"), sym("b"), sym("c")), "Volume $V$ of a cuboid with edges $a$, $b$ and $c$.", { a: 1, c: 1 }),
  formula("energy", "Potential energy", sym("E"), mul(sym("m"), sym("g"), sym("h")), "Potential energy $E$: mass $m$, gravity $g$, height $h$.", { m: 1, h: 1 }),
  formula("diameter", "Diameter", sym("d"), mul(num(2), sym("r")), "Diameter $d$ and radius $r$ of a circle.", { r: 1 }),
  formula("square", "Square", sym("u"), mul(num(4), sym("a")), "Perimeter $u$ of a square with side $a$.", { a: 1 }),
  formula("line", "Straight line", sym("y"), sum(tight(sym("m"), sym("x")), sym("b")), "The equation of a straight line.", { b: 1, x: 2, m: 3 }),
  formula("einstein", "Mass and energy", sym("E"), mul(sym("m"), sq(sym("c"))), "Energy $E$, mass $m$ and the speed of light $c$.", { m: 1, c: 3 }),
  formula("prism", "Square prism", sym("V"), mul(sq(sym("a")), sym("h")), "Volume $V$ of a prism with a square base of side $a$ and height $h$.", { h: 1, a: 3 }),
  formula("percent", "Percentages", sym("W"), over(mul(sym("G"), sym("p")), num(100)), "Percentage $W$ of a base value $G$ at $p$ percent.", { G: 2, p: 2 }),
  formula("pyramid", "Pyramid", sym("V"), mul(over(num(1), num(3)), sym("G"), sym("h")), "Volume $V$ of a pyramid with base area $G$ and height $h$.", { G: 2, h: 2 }),
  formula("fahrenheit", "Fahrenheit", sym("F"), sum(mul(num("1,8"), sym("C")), num(32)), "Turns degrees Celsius $C$ into degrees Fahrenheit $F$.", { C: 2 }),
  formula("kinetic", "Kinetic energy", sym("E"), mul(half(), sym("m"), sq(sym("v"))), "Kinetic energy $E$ of a mass $m$ moving at speed $v$.", { m: 2, v: 3 }),
  formula("centripetal", "Centripetal force", sym("F"), over(mul(sym("m"), sq(sym("v"))), sym("r")), "Force $F$ that keeps a mass $m$ on a circle of radius $r$ at speed $v$.", { m: 2, r: 2, v: 3 }),
  formula("pythagoras", "Pythagoras", sq(sym("c")), sum(sq(sym("a")), sq(sym("b"))), "Pythagoras: legs $a$ and $b$, hypotenuse $c$.", { a: 3, b: 3 }),
  formula("drop", "Falling speed", sym("v"), root(tight(num(2), sym("g"), sym("h"))), "Speed $v$ after falling a height $h$ ($g$ is gravity).", { h: 3, g: 3 }),
  formula("perimeter2", "Perimeter", sym("u"), mul(num(2), sum(sym("a"), sym("b"))), "Perimeter $u$ of a rectangle, written with a bracket.", { a: 3 }),
];

const byKey = (key: string) => FORMULAS.find((f) => f.key === key)!;

function formulaSrc(f: Formula, mark?: string) {
  return `${src(f.L, false, mark)} = ${src(f.R, false, mark)}`;
}

/** The formula, big, with the letter to solve for in purple. Shown as the task's picture. */
function FormulaCard(props: Record<string, unknown>) {
  return (
    <div className="relative -m-3 grid min-h-[150px] place-items-center overflow-hidden rounded-2xl px-6 py-9">
      <div className="bg-dots pointer-events-none absolute inset-0 opacity-25" />
      <MathView src={String(props.src)} size="xl" animate={false} className="relative" />
    </div>
  );
}

function task(f: Formula, target: string): Exercise {
  const sol = rearrange(f.L, f.R, target);
  return {
    instruction: "Rearrange the formula",
    text: f.legend ? `${f.legend} Solve for $${target}$.` : `Solve for $${target}$.`,
    answer: { kind: "expr", value: plain(sol.answer), prefix: `${target} =`, positive: true },
    hint: sol.hint,
    solution: sol.frames,
    visual: { component: FormulaCard, props: { src: formulaSrc(f, target) } },
  };
}

const POOLS: Record<Level, [string, string][]> = { 1: [], 2: [], 3: [] };
for (const f of FORMULAS) for (const [letter, level] of Object.entries(f.targets)) POOLS[level].push([f.key, letter]);

/** Letters and numbers, as in "Stelle nach x um": y = 3x + 5, y = 4(x - 2), y = 12/x + 1 … */
function algebra(level: Level, rng: Rng): Exercise {
  const [y, x] = rng.pick([["y", "x"], ["y", "x"], ["y", "x"], ["s", "t"], ["q", "p"]] as const);
  const a = rng.int(2, 9);
  const b = rng.int(1, 15);
  const X = () => sym(x);
  const shapes: Record<Level, (() => N)[]> = {
    1: [() => sum(X(), num(b)), () => sum(X(), ["-", num(b)]), () => tight(num(a), X()), () => over(X(), num(a))],
    2: [
      () => sum(tight(num(a), X()), num(b)),
      () => sum(tight(num(a), X()), ["-", num(b)]),
      () => sum(over(X(), num(a)), num(b)),
      () => over(num(a * rng.int(2, 6)), X()),
      () => over(sum(X(), num(b)), num(a)),
    ],
    3: [
      () => mul(num(a), sum(X(), ["-", num(b)])),
      () => mul(num(a), sum(X(), num(b))),
      // ax² − b, not + b: the answer checker tests small positive values, so √((y − b)/a) would never be defined.
      () => sum(tight(num(a), sq(X())), ["-", num(b)]),
      () => sum(over(num(a * rng.int(2, 6)), X()), num(b)),
      () => sq(sum(X(), num(b))),
    ],
  };
  const f = formula("algebra", "", sym(y), rng.pick(shapes[level])(), "", { [x]: level });
  return { ...task(f, x), text: `Solve $${formulaSrc(f)}$ for $${x}$.` };
}

function generate(level: Level, rng: Rng): Exercise {
  if (rng.chance(0.4)) return algebra(level, rng);
  const [key, letter] = rng.pick(POOLS[level]);
  return task(byKey(key), letter);
}

// ---------------------------------------------------------------------------
// Numbers: evaluate a formula and show it with numbers put in.

function evaluate(node: N, vals: Record<string, number>): number {
  switch (node.t) {
    case "sym":
      return node.s === "π" ? Math.PI : (vals[node.s] ?? NaN);
    case "num":
      return Number(node.v.replace(",", "."));
    case "sum":
      return node.items.reduce((s, it) => s + (it.neg ? -1 : 1) * evaluate(it.n, vals), 0);
    case "prod":
      return node.items.reduce((s, f) => s * evaluate(f, vals), 1);
    case "frac":
      return evaluate(node.num, vals) / evaluate(node.den, vals);
    case "pow":
      return evaluate(node.base, vals) ** node.e;
    case "sqrt":
      return Math.sqrt(evaluate(node.body, vals));
  }
}

const exact = (x: number) => Math.abs(x - Math.round(x)) < 1e-9;
const deNum = (x: number) => (exact(x) ? String(Math.round(x)) : (Math.round(x * 100) / 100).toString().replace(".", ","));

function withNumbers(node: N, vals: Record<string, number>): N {
  switch (node.t) {
    case "sym":
      return node.s === "π" ? node : { t: "num", v: deNum(vals[node.s]), id: node.id };
    case "num":
      return node;
    case "sum":
      return { ...node, items: node.items.map((it) => ({ ...it, n: withNumbers(it.n, vals) })) };
    case "prod":
      return { ...node, tight: false, items: node.items.map((f) => withNumbers(f, vals)) };
    case "frac":
      return { ...node, num: withNumbers(node.num, vals), den: withNumbers(node.den, vals) };
    case "pow":
      return { ...node, base: withNumbers(node.base, vals) };
    case "sqrt":
      return { ...node, body: withNumbers(node.body, vals) };
  }
}

// ---------------------------------------------------------------------------
// Interactive: pick a formula and a letter, watch the formula rearrange itself.

const EXPLORE = ["rect", "speed", "force", "perimeter", "triangle", "interest", "circle", "disc", "fall", "trapezoid"];

const lettersOf = (f: Formula) => {
  const out: string[] = [];
  const walk = (node: N) => {
    if (node.t === "sym" && node.s !== "π" && !out.includes(node.s)) out.push(node.s);
    if (node.t === "sum") node.items.forEach((it) => walk(it.n));
    if (node.t === "prod") node.items.forEach(walk);
    if (node.t === "frac") [node.num, node.den].forEach(walk);
    if (node.t === "pow") walk(node.base);
    if (node.t === "sqrt") walk(node.body);
  };
  walk(f.R);
  return out;
};

function FormulaExplorer() {
  const scope = useId();
  const [fi, setFi] = useState(1);
  const f = byKey(EXPLORE[fi]);
  const letters = lettersOf(f);
  const [pick, setPick] = useState<string>("t");
  const target = letters.includes(pick) ? pick : letters[letters.length - 1];
  const sol = rearrange(f.L, f.R, target);

  const subject = f.L.t === "sym" ? f.L.s : "";
  const vals = f.values ?? {};
  const subjectValue = evaluate(f.R, vals);
  const rounded = exact(subjectValue) ? subjectValue : Math.round(subjectValue * 100) / 100;
  const back = evaluate(sol.answer, { ...vals, [subject]: rounded });
  const approx = (x: number) => (exact(x) ? "=" : "\\approx");
  const forward = `${subject} = ${src(withNumbers(f.R, vals), false)} ${approx(subjectValue)} ${deNum(subjectValue)}`;
  const backward = `${target} = ${src(withNumbers(sol.answer, { ...vals, [subject]: rounded }), false)} ${approx(back)} ${deNum(back)}`;
  const matches = Math.abs(back - vals[target]) < 0.05;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {EXPLORE.map((key, i) => {
          const g = byKey(key);
          return (
            <button
              key={key}
              title={g.name}
              onClick={() => setFi(i)}
              className={cn("relative h-10 rounded-lg border px-2.5 transition-colors", fi === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
            >
              {fi === i && <motion.span layoutId={`${scope}-f`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
              <MathView src={formulaSrc(g)} size="sm" animate={false} className="relative" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-ink-2">Solve for</span>
        <div className="flex gap-1">
          {letters.map((l) => (
            <button
              key={l}
              onClick={() => setPick(l)}
              className={cn(
                "relative grid size-10 place-items-center rounded-full border font-math text-[20px] italic transition-colors",
                l === target ? "border-transparent text-white" : "border-line text-ink hover:bg-hover",
              )}
              aria-label={`Solve for ${l}`}
            >
              {l === target && <motion.span layoutId={`${scope}-l`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 30 }} />}
              <span className="relative">{l}</span>
            </button>
          ))}
        </div>
        <span className="min-w-0 text-[13px] text-ink-3 sm:ml-auto">
          <Inline text={f.legend} />
        </span>
      </div>

      <SolutionPlayer key={`${f.key}-${target}`} frames={sol.frames} size="lg" interval={2000} />

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${f.key}-${target}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-blob-soft/50 px-4 py-3"
        >
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-blob-ink">Check with numbers</span>
          <MathView src={forward} size="md" animate={false} />
          <MathView src={backward} size="md" animate={false} />
          {matches && (
            <span className="flex items-center gap-1 text-[13px] font-medium text-ok">
              <Check className="size-4" /> matches
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const rect = byKey("rect");
const speed = byKey("speed");

const firstFrames = rearrange(rect.L, rect.R, "b", {
  maxEm: 18,
  intro: "We know the area $A$ and the side $a$, and want $b$. A formula is an equation with letters, so the balance rules work here too.",
}).frames;

/** v = s/t: first for s, then carry on from s = v · t to get t. */
const speedFrames = (() => {
  const forS = rearrange(speed.L, speed.R, "s", { maxEm: 18, intro: "Speed $v = \\frac{s}{t}$. First we want the distance $s$." });
  const forT = rearrange(forS.L, forS.R, "t", { maxEm: 18 });
  const last = forS.frames[forS.frames.length - 1];
  return smoothFracExits([
    ...forS.frames.slice(0, -1),
    { ...last, note: `${last.note} Now let's get the time $t$ from $s = v \\cdot t$.` },
    ...forT.frames.slice(1),
  ]);
})();

const perimeter = byKey("perimeter");
const reverseFrames = rearrange(perimeter.L, perimeter.R, "a", {
  maxEm: 18,
  intro: "To get $u$ from $a$: first $\\cdot 2$, then $+ 2b$. So we undo it backwards: first $- 2b$, then $: 2$.",
}).frames;

const mistakeFrames: Frame[] = [
  { math: "u#u -#s 2#c b#b =#eq 2#c2 a#a \\quad |#bar \\, :#o 2#on", note: "We stopped here: now divide both sides by $2$." },
  { math: "\\frac{u#u -#s 2#c b#b}{2#d}#f =#eq a#a", highlight: ["f-bar", "d"], note: "The **whole** left side is divided by $2$. The fraction bar works like a bracket." },
  {
    math: "\\red{\\frac{u}{2} - 2b} \\ne \\frac{u - 2b}{2}",
    note: "A classic mistake: dividing only $u$ by $2$ and forgetting the $2b$.",
  },
  {
    math: "\\frac{u - 2b}{2} = \\frac{u}{2} - \\frac{2b}{2} = \\frac{u}{2} - b",
    note: "If you split the fraction, divide **every** term. Both $a = \\frac{u - 2b}{2}$ and $a = \\frac{u}{2} - b$ are right.",
  },
];

const fall = byKey("fall");
const rootFrames = rearrange(fall.L, fall.R, "t", {
  maxEm: 18,
  intro: "Distance $s = \\frac{1}{2} a t^2$. We want the time $t$, and it's squared.",
}).frames;

const rearranging: Topic = {
  ...topicMeta("rearranging"),
  summary: [
    {
      title: "Same rules as equations",
      body: "Do the same to both sides until the letter you want is on its own. Then write it on the left.",
      examples: ["A = a \\cdot b \\quad | \\, :a", "\\frac{A}{a} = b", "b = \\frac{A}{a}"],
      tone: "rule",
    },
    {
      title: "Undo with the opposite",
      body: "Plus is undone by minus, times by divide, a square by the square root.",
      examples: ["v = \\frac{s}{t} \\quad | \\, \\cdot t", "v \\cdot t = s"],
      tone: "rule",
    },
    {
      title: "Reverse order",
      body: "Undo the last thing first. What happened to the letter last comes off first.",
      examples: ["u = 2a + 2b \\quad | \\, -2b", "u - 2b = 2a \\quad | \\, :2", "a = \\frac{u - 2b}{2}"],
      tone: "rule",
    },
    {
      title: "Letter in the denominator",
      body: "Multiply it out of the fraction first. Then divide.",
      examples: ["v = \\frac{s}{t} \\quad | \\, \\cdot t", "v \\cdot t = s \\quad | \\, :v", "t = \\frac{s}{v}"],
      tone: "tip",
    },
    {
      title: "Squared letter",
      body: "Take the square root at the end. Lengths, times and speeds are positive, so the positive root is the answer.",
      examples: ["s = \\frac{1}{2} a t^2", "t = \\sqrt{\\frac{2s}{a}}"],
      tone: "tip",
    },
    {
      title: "Divide every term",
      body: "When you divide a sum, the whole sum is divided, not just one part.",
      examples: ["\\frac{u - 2b}{2} = \\frac{u}{2} - b", "\\frac{u - 2b}{2} \\ne \\frac{u}{2} - 2b"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "A formula is an equation",
      blob: "Formulas look scary, but they follow the same balance rules!",
      body: "Formeln umstellen means: get a different letter on its own. You do exactly what you do with equations: the same operation on both sides.",
      frames: firstFrames,
    },
    {
      type: "explain",
      title: "Divided? Multiply!",
      blob: "Every operation has an opposite. That's our superpower.",
      body: "Plus is undone by minus, times by divide, and divide by times. When the letter sits in the denominator, multiply it out of the fraction first.",
      frames: speedFrames,
    },
    {
      type: "widget",
      title: "Pick a letter",
      blob: "Choose a formula and a letter. Watch it rearrange itself!",
      body: "Tap a formula, then the letter you want on its own. Each step shows what is undone. The numbers at the bottom check that the new formula gives the same result.",
      widget: FormulaExplorer,
    },
    {
      type: "check",
      blob: "One step is enough here.",
      exercise: task(byKey("power"), "I"),
    },
    {
      type: "explain",
      title: "Undo in reverse order",
      blob: "Socks first, then shoes. Taking them off? Shoes first!",
      body: "Think about how the formula is built from your letter. Then undo those steps backwards: the last one first.",
      frames: reverseFrames,
    },
    {
      type: "explain",
      title: "The classic mistake",
      blob: "This one costs points in almost every test. Let's avoid it!",
      body: "When you divide a sum by a number, **every** term gets divided.",
      frames: mistakeFrames,
    },
    {
      type: "check",
      blob: "Get rid of the fraction first.",
      exercise: task(byKey("triangle"), "h"),
    },
    {
      type: "explain",
      title: "Squares need a root",
      blob: "A squared letter is the last thing to undo.",
      body: "If the letter is squared, take the square root at the very end. Times, lengths and speeds are positive, so we only need the positive root.",
      frames: rootFrames,
    },
    {
      type: "check",
      blob: "Pythagoras! Which step comes first?",
      exercise: task(byKey("pythagoras"), "a"),
    },
    {
      type: "check",
      blob: "Last one: the interest formula from maths class.",
      exercise: task(byKey("interest"), "p"),
    },
  ],
  generate,
};

export default rearranging;
