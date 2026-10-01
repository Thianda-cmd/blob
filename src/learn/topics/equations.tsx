"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, RotateCcw, Shuffle, Undo2 } from "lucide-react";
import { useId, useRef, useState, useSyncExternalStore } from "react";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import { add, div as qdiv, frac, mul as qmul, neg as qneg, show as qshow, value as qvalue, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// A small model of linear equations and inequalities. Every token gets a stable
// key, so in the worked solutions each term glides to its new place and the
// "| −3" step visibly lands on both sides.

type Pow = 0 | 1 | 2;
/** c·vᵖ. `sk`/`ck` override the sign/coefficient keys (used after expanding a bracket). */
type Term = { kind: "t"; c: Frac; p: Pow; id: string; sk?: string; ck?: string };
/** k(…) */
type Group = { kind: "g"; k: number; id: string; items: Term[] };
/** ±(…)(…) or ±(…)² */
type Prod = { kind: "pp"; sign: 1 | -1; id: string; a: Term[]; b: Term[]; square?: boolean };
type Item = Term | Group | Prod;
type Rel = "=" | "<" | ">" | "≤" | "≥";
type Eq = { L: Item[]; R: Item[]; rel: Rel; rk: string };
type Op = { kind: "add"; x: Term } | { kind: "mul"; k: number } | { kind: "div"; k: number };

const term = (id: string, c: number | Frac, p: Pow = 0): Term => ({ kind: "t", c: typeof c === "number" ? frac(c) : c, p, id });
/** Terms inside brackets get their ids from the bracket. */
const inner = (c: number | Frac, p: Pow = 0) => term("", c, p);
const group = (id: string, k: number, items: Term[]): Group => ({ kind: "g", k, id, items: items.map((x, i) => ({ ...x, id: `${id}${i}` })) });
const prod = (id: string, a: Term[], b: Term[], opts: { square?: boolean; sign?: 1 | -1 } = {}): Prod => ({
  kind: "pp",
  sign: opts.sign ?? 1,
  id,
  square: opts.square,
  a: a.map((x, i) => ({ ...x, id: `${id}a${i}` })),
  b: b.map((x, i) => ({ ...x, id: `${id}b${i}` })),
});
const equation = (L: Item[], rel: Rel, R: Item[]): Eq => ({ L, R, rel, rk: "rel" });

const REL_FLIP: Record<Rel, Rel> = { "=": "=", "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
const REL_TEXT: Record<Rel, string> = { "=": "=", "<": "<", ">": ">", "≤": "\\le", "≥": "\\ge" };
const kk = (keys: boolean, key: string) => (keys ? `#${key}` : "");
const isZero = (q: Frac) => q.n === 0;
const absQ = (q: Frac) => frac(Math.abs(q.n), q.d);

function signSrc(x: Term, first: boolean, keys: boolean, force = false) {
  const key = kk(keys, x.sk ?? `s${x.id}`);
  if (x.c.n < 0) return `-${key} `;
  return first && !force ? "" : `+${key} `;
}

function bodySrc(x: Term, v: string, keys: boolean) {
  const n = Math.abs(x.c.n);
  const d = x.c.d;
  if (n === 0) return `0${kk(keys, x.ck ?? `c${x.id}`)}`;
  const vv = x.p === 0 ? "" : x.p === 1 ? `${v}${kk(keys, `v${x.id}`)}` : `${v}${kk(keys, `v${x.id}`)}^{2${kk(keys, `e${x.id}`)}}`;
  const top = x.p > 0 && n === 1 ? vv : [`${n}${kk(keys, x.ck ?? `c${x.id}`)}`, vv].filter(Boolean).join(" ");
  return d === 1 ? top : `\\frac{${top}}{${d}${kk(keys, `d${x.id}`)}}${kk(keys, `f${x.id}`)}`;
}

function termSrc(x: Term, v: string, first: boolean, keys = true, force = false) {
  return signSrc(x, first, keys, force) + bodySrc(x, v, keys);
}

function groupSrc(g: Group, v: string, first: boolean, keys: boolean) {
  const sign = g.k < 0 ? `-${kk(keys, `s${g.id}`)} ` : first ? "" : `+${kk(keys, `s${g.id}`)} `;
  const factor = Math.abs(g.k) === 1 ? "" : `${Math.abs(g.k)}${kk(keys, `k${g.id}`)} `;
  return `${sign}${factor}(${g.items.map((x, i) => termSrc(x, v, i === 0, keys)).join(" ")})${kk(keys, `b${g.id}`)}`;
}

function prodSrc(p: Prod, v: string, first: boolean, keys: boolean) {
  const sign = p.sign < 0 ? `-${kk(keys, `s${p.id}`)} ` : first ? "" : `+${kk(keys, `s${p.id}`)} `;
  const side = (list: Term[], name: string) => `(${list.map((x, i) => termSrc(x, v, i === 0, keys)).join(" ")})${kk(keys, `${name}${p.id}`)}`;
  return p.square ? `${sign}${side(p.a, "ba")}^{2${kk(keys, `q${p.id}`)}}` : `${sign}${side(p.a, "ba")} ${side(p.b, "bb")}`;
}

function itemSrc(it: Item, v: string, first: boolean, keys = true) {
  return it.kind === "t" ? termSrc(it, v, first, keys) : it.kind === "g" ? groupSrc(it, v, first, keys) : prodSrc(it, v, first, keys);
}

function sideSrc(items: Item[], v: string, keys = true) {
  return items.length ? items.map((it, i) => itemSrc(it, v, i === 0, keys)).join(" ") : "0";
}

function eqSrc(e: Eq, v: string, keys = true, annot = "") {
  return `${sideSrc(e.L, v, keys)} ${e.rel}${kk(keys, e.rk)} ${sideSrc(e.R, v, keys)}${annot}`;
}

/** ":2" or ":(−3)" (also for "·"), with keys `<name><id>`. */
function opNumSrc(sym: string, k: number, id: string, keys = true) {
  const K = (name: string) => kk(keys, `${name}${id}`);
  return k > 0 ? `${sym}${K("q")} ${k}${K("qk")}` : `${sym}${K("q")} (-${K("qs")} ${-k}${K("qk")})${K("qb")}`;
}

/** The step written after the bar, German style: "| −3", "| :2", "| ·6". */
function opSrc(op: Op, n: number, v: string, keys = true) {
  const body =
    op.kind === "add"
      ? termSrc({ ...op.x, id: `O${n}`, sk: undefined, ck: undefined }, v, true, keys, true)
      : opNumSrc(op.kind === "mul" ? "\\cdot" : ":", op.k, `O${n}`, keys);
  return ` \\quad |${kk(keys, `bar${n}`)} \\, ${body}`;
}

const RELATION = new Set(["=", "<", ">", "≤", "≥", "≠"]);
const BINARY_OP = new Set(["+", "−", "·", ":", "±"]);

/** Rough width of display-language maths in em, to keep worked steps on one line. */
export function emWidth(src: string): number {
  const list = (nodes: DNode[]): number => nodes.reduce((sum, node, i) => sum + one(node, nodes[i - 1]), 0);
  const one = (node: DNode, prev?: DNode): number => {
    switch (node.type) {
      case "num":
        return 0.52 * node.v.length;
      case "var":
      case "sym":
        return 0.58;
      case "text":
        return 0.42 * node.v.length + 0.5;
      case "space":
        return node.v === "quad" ? 1 : 0.18;
      case "op": {
        if (RELATION.has(node.v)) return 1.36;
        const unary = node.v === "−" && (!prev || prev.type === "op");
        return BINARY_OP.has(node.v) && !unary ? 1.04 : 0.56;
      }
      case "frac":
        return Math.max(list(node.num), list(node.den)) * 0.88 + 0.3;
      case "pow":
      case "sub":
        return list(node.base) + 0.64 * list(node.type === "pow" ? node.exp : node.sub);
      case "sqrt":
        return 0.62 + list(node.body);
      case "paren":
        return 0.72 + list(node.body);
      case "style":
        return list(node.body);
    }
  };
  return list(parseDisplay(src));
}

const termKeys = (x: Term) => [x.sk ?? `s${x.id}`, x.ck ?? `c${x.id}`, `v${x.id}`, `e${x.id}`, `d${x.id}`, `f${x.id}-bar`];
const terms = (items: Item[]) => items as Term[];
const coef = (items: Item[], p: Pow) => terms(items).filter((x) => x.p === p).reduce((s, x) => add(s, x.c), frac(0));

/** Add up like terms. The first term of each kind keeps its keys, so it morphs into the sum. */
function combine(list: Term[]): Term[] {
  const out: Term[] = [];
  for (const x of list) {
    const prev = out.find((o) => o.p === x.p);
    if (prev) prev.c = add(prev.c, x.c);
    else out.push({ ...x });
  }
  const kept = out.filter((x) => !isZero(x.c));
  return kept.length ? kept : [{ ...out[0], c: frac(0), p: 0 }];
}

/** "$5x - 3x = 2x$" for every kind that gets combined on this side. */
function combineNote(list: Term[], v: string): string[] {
  const out: string[] = [];
  for (const p of [2, 1, 0] as Pow[]) {
    const same = list.filter((x) => x.p === p);
    if (same.length < 2) continue;
    const sum = same.reduce((s, x) => add(s, x.c), frac(0));
    out.push(`$${sideSrc(same, v, false)} = ${isZero(sum) ? "0" : termSrc({ ...same[0], c: sum }, v, true, false)}$`);
  }
  return out;
}

/** Notes for the left and right side; identical ones are said once ("… on both sides"). */
function bothNote(left: string[], right: string[]) {
  if (left.length === 1 && right.length === 1 && left[0] === right[0]) return `${left[0]} on both sides.`;
  const parts = [...left, ...right];
  return parts.length ? `${join(parts)}.` : "";
}

const join = (parts: string[]) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`);

function expandGroup(g: Group): Term[] {
  return g.items.map((x, i) => ({
    ...x,
    c: qmul(x.c, frac(g.k)),
    sk: i === 0 ? `s${g.id}` : x.sk,
    ck: i === 0 && Math.abs(g.k) !== 1 ? `k${g.id}` : x.ck,
  }));
}

function expandProd(p: Prod): Term[] {
  const b = p.square ? p.a : p.b;
  const sums = new Map<number, Frac>();
  for (const x of p.a) for (const y of b) sums.set(x.p + y.p, add(sums.get(x.p + y.p) ?? frac(0), qmul(x.c, y.c)));
  return [...sums.entries()]
    .filter(([, c]) => !isZero(c))
    .sort((u, w) => w[0] - u[0])
    .map(([pw, c], i): Term => ({ kind: "t", c: p.sign < 0 ? qneg(c) : c, p: pw as Pow, id: `${p.id}r${pw}`, sk: i === 0 ? `s${p.id}` : undefined }));
}

const expandItem = (it: Item): Term[] => (it.kind === "t" ? [it] : it.kind === "g" ? expandGroup(it) : expandProd(it));

/** The key of the first visible token of a term (coefficient or variable). */
const leadKey = (x: Term) => (x.p > 0 && Math.abs(x.c.n) === 1 && x.c.d === 1 ? `v${x.id}` : x.c.d !== 1 ? `f${x.id}-bar` : (x.ck ?? `c${x.id}`));

function applyOp(e: Eq, op: Op, n: number, v: string, maxEm: number): { math: string; highlight: string[] } {
  const full = applyFull(e, op, n, v);
  if (emWidth(full.math) <= maxEm) return full;
  // Too wide for one line: show just the step after the bar, like in an exercise book.
  const annotKeys = op.kind === "add" ? termKeys({ ...op.x, id: `O${n}`, sk: undefined, ck: undefined }) : [`qO${n}`, `qkO${n}`, `qsO${n}`];
  return { math: eqSrc(e, v, true, opSrc(op, n, v)), highlight: [...annotKeys, ...(op.kind !== "add" && op.k < 0 && e.rel !== "=" ? [e.rk] : [])] };
}

function applyFull(e: Eq, op: Op, n: number, v: string): { math: string; highlight: string[] } {
  const L = terms(e.L);
  const R = terms(e.R);
  const annot = opSrc(op, n, v);
  if (op.kind === "add") {
    const l: Term = { ...op.x, id: `L${n}`, sk: undefined, ck: undefined };
    const r: Term = { ...op.x, id: `R${n}`, sk: undefined, ck: undefined };
    return { math: eqSrc({ ...e, L: [...L, l], R: [...R, r] }, v, true, annot), highlight: [...termKeys(l), ...termKeys(r)] };
  }
  if (op.kind === "mul" && op.k < 0) {
    return { math: eqSrc(e, v, true, annot), highlight: [...L, ...R].map((x) => x.sk ?? `s${x.id}`).concat(e.rel === "=" ? [] : [e.rk]) };
  }
  if (op.kind === "mul") {
    const side = (list: Term[]) => list.map((x, i) => `${signSrc(x, i === 0, true)}${op.k}#m${x.id} \\cdot#md${x.id} ${bodySrc(x, v, true)}`).join(" ");
    return {
      math: `${side(L)} ${e.rel}#${e.rk} ${side(R)}${annot}`,
      highlight: [...L, ...R].flatMap((x) => [`m${x.id}`, `md${x.id}`]),
    };
  }
  const side = (list: Term[], s: string) => {
    const body = list.length > 1 ? `(${sideSrc(list, v)})#p${s}${n}` : sideSrc(list, v);
    return `${body} ${opNumSrc(":", op.k, `${s}${n}`)}`;
  };
  const keys = (s: string) => ["q", "qk", "qs"].map((k) => `${k}${s}${n}`);
  return {
    math: `${side(L, "L")} ${e.rel}#${e.rk} ${side(R, "R")}${annot}`,
    highlight: [...keys("L"), ...keys("R"), ...(op.k < 0 && e.rel !== "=" ? [e.rk] : [])],
  };
}

function resultOp(e: Eq, op: Op, n: number, v: string): { eq: Eq; note: string; highlight?: string[] } {
  const L = terms(e.L);
  const R = terms(e.R);
  if (op.kind === "add") {
    const l = [...L, { ...op.x, id: `L${n}`, sk: undefined, ck: undefined }];
    const r = [...R, { ...op.x, id: `R${n}`, sk: undefined, ck: undefined }];
    return { eq: { ...e, L: combine(l), R: combine(r) }, note: bothNote(combineNote(l, v), combineNote(r, v)) };
  }
  const flip = op.k < 0 && e.rel !== "=";
  const f = (x: Term): Term => ({ ...x, c: op.kind === "mul" ? qmul(x.c, frac(op.k)) : qdiv(x.c, frac(op.k)) });
  const next: Eq = { L: L.map(f), R: R.map(f), rel: flip ? REL_FLIP[e.rel] : e.rel, rk: flip ? `rel${n}` : e.rk };
  return { eq: next, note: "", highlight: flip ? [next.rk] : undefined };
}

/** "$6 \\cdot \\frac{x}{2} = 3x$", "$2 \\cdot (-2) = -4$" */
function productNote(x: Term, k: number, v: string) {
  const factor = x.c.n < 0 ? `(${termSrc(x, v, true, false)})` : bodySrc(x, v, false);
  return `$${k} \\cdot ${factor} = ${termSrc({ ...x, c: qmul(x.c, frac(k)) }, v, true, false)}$`;
}

// ---------------------------------------------------------------------------
// Substitution check ("Probe")

const valSrc = (q: Frac) => (q.n < 0 ? `(${qshow(q)})` : qshow(q));

function substTerm(x: Term, val: Frac, first: boolean) {
  const sign = x.c.n < 0 ? "- " : first ? "" : "+ ";
  const n = Math.abs(x.c.n);
  if (x.p === 0) return `${sign}${qshow(frac(n, x.c.d))}`;
  // A lone first value needs no bracket: "-6 - 6", but "2 · (-6)" and "+ (-6)".
  const bare = x.p === 1 && n === 1 && (sign === "" || x.c.d !== 1);
  const pv = x.p === 2 ? `${valSrc(val)}^2` : bare ? qshow(val) : valSrc(val);
  const top = n === 1 ? pv : `${n} \\cdot ${pv}`;
  return `${sign}${x.c.d === 1 ? top : `\\frac{${top}}{${x.c.d}}`}`;
}

function substSide(items: Item[], val: Frac): string {
  return items
    .map((it, i) => {
      if (it.kind === "t") return substTerm(it, val, i === 0);
      if (it.kind === "g") {
        const sign = it.k < 0 ? "- " : i === 0 ? "" : "+ ";
        const k = Math.abs(it.k);
        return `${sign}${k === 1 ? "" : `${k} \\cdot `}(${it.items.map((x, j) => substTerm(x, val, j === 0)).join(" ")})`;
      }
      return "";
    })
    .join(" ");
}

function evalSide(items: Item[], val: Frac): Frac {
  const pw = (p: Pow) => (p === 0 ? frac(1) : p === 1 ? val : qmul(val, val));
  return expandAll(items).reduce((s, x) => add(s, qmul(x.c, pw(x.p))), frac(0));
}

const expandAll = (items: Item[]) => items.flatMap(expandItem);

// ---------------------------------------------------------------------------
// The solver: expand, tidy, collect x-terms, collect numbers, divide.

const SOLUTION_WORDS: Record<Exclude<Rel, "=">, (b: string) => string> = {
  "<": (b) => `Every number smaller than $${b}$ is a solution.`,
  ">": (b) => `Every number greater than $${b}$ is a solution.`,
  "≤": (b) => `Every number smaller than or equal to $${b}$ is a solution.`,
  "≥": (b) => `Every number greater than or equal to $${b}$ is a solution.`,
};

type Solved = { frames: Frame[]; value: Frac; rel: Rel };

/** `maxEm`: widest step that fits on one line (about 13em in a worked solution, 18em on the lesson board). */
export function solveEq(start: Eq, v: string, opts: { check?: boolean; intro?: string; maxEm?: number } = {}): Solved {
  const frames: Frame[] = [];
  const ineq = start.rel !== "=";
  let e = start;
  let n = 0;

  const brackets = [...e.L, ...e.R].filter((it): it is Group | Prod => it.kind !== "t");
  if (brackets.length) {
    const highlight = brackets.flatMap((b) =>
      b.kind === "g" ? [`b${b.id}(`, `b${b.id})`] : [`ba${b.id}(`, `ba${b.id})`, `bb${b.id}(`, `bb${b.id})`, `q${b.id}`],
    );
    const arrows = brackets.flatMap((b) =>
      b.kind === "g" ? b.items.map((x) => [Math.abs(b.k) === 1 ? `s${b.id}` : `k${b.id}`, leadKey(x)] as [string, string]) : [],
    );
    const single = brackets.length === 1 ? brackets[0] : null;
    const intro =
      single?.kind === "g"
        ? single.k === -1
          ? "A minus in front of the bracket: remove it and flip every sign inside."
          : `Brackets first: multiply $${single.k}$ by each term inside.`
        : single
          ? "Brackets first: multiply them out."
          : "Brackets first: expand each one.";
    frames.push({ math: eqSrc(e, v), highlight, arrows, note: opts.intro ? `${opts.intro} ${intro}` : intro });
    const note = brackets.map((b) => `$${itemSrc(b, v, true, false)} = ${sideSrc(expandItem(b), v, false)}$`);
    e = { ...e, L: expandAll(e.L), R: expandAll(e.R) };
    frames.push({ math: eqSrc(e, v), note: `${join(note)}.` });
  } else {
    const intro = ineq ? "Solve it just like an equation. Only a negative factor needs extra care." : `Goal: get $${v}$ on its own.`;
    frames.push({ math: eqSrc(e, v), note: opts.intro ?? intro });
  }

  const tidy = () => {
    const needs = (list: Item[]) => new Set(terms(list).map((x) => x.p)).size < list.length;
    if (!needs(e.L) && !needs(e.R)) return;
    const parts = [...combineNote(terms(e.L), v), ...combineNote(terms(e.R), v)];
    e = { ...e, L: combine(terms(e.L)), R: combine(terms(e.R)) };
    frames.push({ math: eqSrc(e, v), note: `Tidy up first: ${join(parts)}.` });
  };

  const step = (op: Op, before: string, after?: string) => {
    n++;
    const app = applyOp(e, op, n, v, opts.maxEm ?? 13);
    frames.push({ math: app.math, highlight: app.highlight, note: before });
    const res = resultOp(e, op, n, v);
    e = res.eq;
    frames.push({ math: eqSrc(e, v), highlight: res.highlight, note: after ?? res.note });
  };

  tidy();

  // Several fractions: clear them all at once.
  const withFrac = terms([...e.L, ...e.R]).filter((x) => x.c.d !== 1);
  if (withFrac.length >= 2) {
    const k = withFrac.reduce((m, x) => lcm(m, x.c.d), 1);
    const all = terms([...e.L, ...e.R]);
    const products = all.map((x) => productNote(x, k, v));
    step(
      { kind: "mul", k },
      `Clear the fractions: multiply **every** term by $${k}$, the common denominator.`,
      all.length <= 3 ? `${join(products)}. No more fractions!` : "Work out each product. No more fractions!",
    );
    tidy();
  }

  // x² on both sides (after multiplying out) cancels.
  const sq = coef(e.R, 2);
  if (!isZero(sq) || !isZero(coef(e.L, 2))) {
    const x = term("", qneg(isZero(sq) ? coef(e.L, 2) : sq), 2);
    const word = x.c.n < 0 ? "Subtract" : "Add";
    step({ kind: "add", x }, `$${v}^2$ is on both sides. ${word} $${bodySrc({ ...x, c: absQ(x.c) }, v, false)}$ on both sides and it's gone.`);
  }

  // x-terms on both sides: bring them together.
  const xl = coef(e.L, 1);
  const xr = coef(e.R, 1);
  if (!isZero(xl) && !isZero(xr)) {
    // Equations: take away the smaller x-term, so the x stays positive. Inequalities: always collect on the left.
    const away = ineq || qvalue(xl) > qvalue(xr) ? xr : xl;
    const x = term("", qneg(away), 1);
    const word = x.c.n < 0 ? "subtract" : "add";
    step({ kind: "add", x }, `Bring the $${v}$-terms together: ${word} $${bodySrc({ ...x, c: absQ(x.c) }, v, false)}$ on **both** sides.`);
  }

  const xLeft = !isZero(coef(e.L, 1));
  const xSide = () => (xLeft ? e.L : e.R);
  const other = () => (xLeft ? e.R : e.L);

  // Numbers to the other side.
  const b = coef(xSide(), 0);
  if (!isZero(b)) {
    const word = b.n > 0 ? "subtract" : "add";
    const shown = qshow(absQ(b));
    step({ kind: "add", x: term("", qneg(b)) }, `To get rid of the $${b.n > 0 ? "+" : "-"} ${shown}$, ${word} $${shown}$ on **both** sides.`);
  }

  // The number in front of x.
  let a = coef(xSide(), 1);
  const flipWarning = ineq ? " Careful: a negative number **flips** the sign!" : "";
  if (a.d !== 1) {
    const k = a.d;
    const o = terms(other());
    const xt = terms(xSide());
    const before =
      Math.abs(a.n) === 1 ? `$${v}$ is divided by $${k}$. Undo it: multiply both sides by $${k}$.` : `Multiply both sides by $${k}$ to get rid of the fraction.`;
    const after = join([...xt, ...o].map((x) => productNote(x, k, v)));
    step({ kind: "mul", k }, before, `${after}.`);
    a = coef(xSide(), 1);
  }
  if (a.n === -1 && a.d === 1) {
    step(
      { kind: "mul", k: -1 },
      `Only $-${v}$ is left. Multiply both sides by $-1$.${flipWarning}`,
      ineq ? `Every sign flips, and $${REL_TEXT[e.rel]}$ becomes $${REL_TEXT[REL_FLIP[e.rel]]}$.` : "Every sign flips.",
    );
  } else if (!(a.n === 1 && a.d === 1)) {
    const k = a.n;
    const o = coef(other(), 0);
    const ks = k < 0 ? `(${k})` : `${k}`;
    const rel = e.rel;
    const res = qdiv(o, frac(k));
    const calc = `$${qshow(o)} : ${ks} = ${qshow(res)}$`;
    step(
      { kind: "div", k },
      `$${v}$ is multiplied by $${k}$. Undo it: divide both sides by $${k}$.${k < 0 ? flipWarning : ""}`,
      k < 0 && ineq ? `The sign flips: $${REL_TEXT[rel]}$ becomes $${REL_TEXT[REL_FLIP[rel]]}$. And ${calc}.` : `${calc}.`,
    );
  }

  const value = coef(other(), 0);
  const shown = qshow(value);
  if (!xLeft) {
    e = { ...e, L: e.R, R: e.L, rel: REL_FLIP[e.rel] };
    frames.push({ math: eqSrc(e, v), note: `Turn it around: $${v} = ${shown}$.` });
  } else {
    const last = frames[frames.length - 1];
    const end = ineq ? `So $${v} ${REL_TEXT[e.rel]} ${shown}$. ${SOLUTION_WORDS[e.rel as Exclude<Rel, "=">](shown)}` : `So $${v} = ${shown}$.`;
    frames[frames.length - 1] = { ...last, note: last.note ? `${last.note} ${end}` : end };
  }

  if (opts.check && !ineq && ![...start.L, ...start.R].some((it) => it.kind === "pp")) {
    const both = qshow(evalSide(start.L, value));
    frames.push({
      math: `${substSide(start.L, value)} = ${substSide(start.R, value)}`,
      note: `Check: put $${v} = ${shown}$ back in. Both sides give $${both}$. It works!`,
    });
  }
  return { frames: smoothFracExits(frames), value, rel: e.rel };
}

// ---------------------------------------------------------------------------
// MathView quirk: tokens that glide out of a fraction which disappears (or moves
// into another bracket or root) in the same step blink to invisible for a moment.
// Such tokens get fresh keys from that step on, so they simply scale in instead.

const LEAF_TYPES = new Set(["num", "var", "op", "text", "sym"]);

function leafKeys(nodes: DNode[], out: string[] = []): string[] {
  for (const n of nodes) {
    if (LEAF_TYPES.has(n.type)) out.push(n.k);
    if (n.type === "frac") {
      out.push(`${n.k}-bar`);
      leafKeys([...n.num, ...n.den], out);
    } else if (n.type === "paren") {
      out.push(`${n.k}(`, `${n.k})`);
      leafKeys(n.body, out);
    } else if (n.type === "sqrt") {
      out.push(`${n.k}-rad`);
      leafKeys(n.body, out);
    } else if (n.type === "pow") leafKeys([...n.base, ...n.exp], out);
    else if (n.type === "sub") leafKeys([...n.base, ...n.sub], out);
    else if (n.type === "style") leafKeys(n.body, out);
  }
  return out;
}

/** Each fraction's key → where it sits and which tokens it holds. */
function fracPlaces(nodes: DNode[], path = "", out = new Map<string, { path: string; leaves: string[] }>()) {
  for (const n of nodes) {
    if (n.type === "frac") {
      out.set(n.k, { path, leaves: leafKeys([...n.num, ...n.den]) });
      fracPlaces(n.num, `${path}>${n.k}.n`, out);
      fracPlaces(n.den, `${path}>${n.k}.d`, out);
    } else if (n.type === "paren" || n.type === "sqrt" || n.type === "style") fracPlaces(n.body, `${path}>${n.k}`, out);
    else if (n.type === "pow") {
      fracPlaces(n.base, `${path}>${n.k}.b`, out);
      fracPlaces(n.exp, `${path}>${n.k}.e`, out);
    }
  }
  return out;
}

const baseKey = (k: string) => k.replace(/(-bar|-rad|\(|\))$/, "");

export function smoothFracExits(frames: Frame[]): Frame[] {
  const out = [...frames];
  for (let i = 1; i < out.length; i++) {
    const prev = fracPlaces(parseDisplay(out[i - 1].math));
    const nextTree = parseDisplay(out[i].math);
    const next = fracPlaces(nextTree);
    const nextLeaves = new Set(leafKeys(nextTree));
    const moving = new Set<string>();
    for (const [key, place] of prev) {
      if (next.get(key)?.path === place.path) continue;
      for (const k of place.leaves) if (nextLeaves.has(k)) moving.add(baseKey(k));
    }
    if (!moving.size) continue;
    const re = new RegExp(`#(${[...moving].map((k) => k.replace(/-/g, "\\-")).join("|")})(?![A-Za-z0-9_-])`, "g");
    const swap = (k: string) => (moving.has(baseKey(k)) ? k.replace(baseKey(k), `${baseKey(k)}_${i}`) : k);
    for (let j = i; j < out.length; j++) {
      const f = out[j];
      out[j] = { ...f, math: f.math.replace(re, `#$1_${i}`), highlight: f.highlight?.map(swap), arrows: f.arrows?.map(([a, b]) => [swap(a), swap(b)] as [string, string]) };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exercise generator

const VARS = ["x", "x", "x", "x", "x", "y", "a", "n"];

function make(e: Eq, v: string, hint: string, check = false): Exercise {
  const { frames, value, rel } = solveEq(e, v, { check });
  return {
    instruction: rel === "=" ? "Solve the equation" : "Solve the inequality",
    math: eqSrc(e, v, false),
    answer: rel === "=" ? { kind: "solutions", variable: v, values: [qvalue(value)] } : { kind: "inequality", variable: v, op: rel, value: qvalue(value) },
    hint,
    solution: frames,
  };
}

const signed = (b: number) => (b < 0 ? `- ${-b}` : `+ ${b}`);
const RELS: Exclude<Rel, "=">[] = ["<", ">", "≤", "≥"];

function level1(rng: Rng): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(["plus", "times", "two", "two", "two", "turned", "frac", "minus"] as const);
  if (shape === "plus") {
    const x = rng.nonZero(-8, 15);
    const b = rng.nonZero(-15, 15, [-x]);
    const L = rng.chance(0.3) ? [term("B", b), term("A", 1, 1)] : [term("A", 1, 1), term("B", b)];
    return make(equation(L, "=", [term("C", x + b)]), v, `Undo the $${signed(b)}$: ${b > 0 ? "subtract" : "add"} $${Math.abs(b)}$ on both sides.`, true);
  }
  if (shape === "times") {
    const a = rng.pick([2, 3, 4, 5, 6, 7, 8, 9, -2, -3, -4, -5]);
    const x = rng.nonZero(-9, 12, [1]);
    return make(equation([term("A", a, 1)], "=", [term("C", a * x)]), v, `$${a}${v}$ means $${a} \\cdot ${v}$. Divide both sides by $${a}$.`, true);
  }
  if (shape === "frac") {
    const a = rng.int(2, 6);
    const c = rng.nonZero(-6, 9);
    return make(equation([term("A", frac(1, a), 1)], "=", [term("C", c)]), v, `$${v}$ is divided by $${a}$. Do the opposite on both sides.`, true);
  }
  if (shape === "minus") {
    const a = rng.int(2, 6);
    const x = rng.nonZero(-4, 9);
    const b = rng.int(5, 30);
    if (b - a * x === 0) return null;
    return make(
      equation([term("B", b), term("A", -a, 1)], "=", [term("C", b - a * x)]),
      v,
      `First subtract $${b}$ on both sides. Then divide by $-${a}$, minus included.`,
      true,
    );
  }
  const a = rng.int(2, 9);
  const x = rng.nonZero(-6, 10);
  const b = rng.nonZero(-15, 15);
  const c = a * x + b;
  if (c === 0 || Math.abs(c) > 90) return null;
  const hint = `First get rid of the $${signed(b)}$, then divide by $${a}$.`;
  const lhs = rng.chance(0.25) ? [term("B", b), term("A", a, 1)] : [term("A", a, 1), term("B", b)];
  if (shape === "turned") return make(equation([term("C", c)], "=", lhs), v, hint, true);
  return make(equation(lhs, "=", [term("C", c)]), v, hint, true);
}

function level2(rng: Rng): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(["both", "both", "bracket", "bracketBoth", "tidy", "ineq", "ineq"] as const);
  if (shape === "both") {
    const a = rng.int(2, 9);
    const c = rng.chance(0.2) ? -rng.int(1, 4) : rng.int(1, 8);
    const x = rng.nonZero(-6, 9);
    const b = rng.nonZero(-12, 12);
    const d = (a - c) * x + b;
    if (a === c || d === 0 || d === b || Math.abs(d) > 40) return null;
    const R = rng.chance(0.3) ? [term("D", d), term("C", c, 1)] : [term("C", c, 1), term("D", d)];
    const L = rng.chance(0.2) ? [term("B", b), term("A", a, 1)] : [term("A", a, 1), term("B", b)];
    return make(equation(L, "=", R), v, `Collect the $${v}$-terms on one side and the numbers on the other.`, true);
  }
  if (shape === "bracket" || shape === "bracketBoth") {
    const k = rng.chance(0.2) ? -rng.int(2, 3) : rng.int(2, 6);
    const q = shape === "bracket" && rng.chance(0.3) ? rng.int(2, 3) : 1;
    const p = rng.nonZero(-9, 9);
    const x = rng.nonZero(-6, 9);
    const g = group("G", k, [inner(q, 1), inner(p)]);
    if (shape === "bracket") {
      const extra = rng.chance(0.3) ? rng.nonZero(-9, 9) : 0;
      const c = k * (q * x + p) + extra;
      if (c === 0 || Math.abs(c) > 80) return null;
      const L = extra ? [g, term("E", extra)] : [g];
      return make(equation(L, "=", [term("C", c)]), v, `Expand the bracket first: multiply $${k}$ by both terms inside.`, true);
    }
    const c = rng.int(1, 6);
    const d = k * (x + p) - c * x;
    if (c === k || d === 0 || Math.abs(d) > 40) return null;
    return make(equation([g], "=", [term("C", c, 1), term("D", d)]), v, `Expand the bracket, then bring the $${v}$-terms together.`, true);
  }
  if (shape === "tidy") {
    const a = rng.int(2, 7);
    const c = rng.nonZero(-4, 5);
    const s = a + c;
    const x = rng.nonZero(-6, 9);
    const b = rng.nonZero(-10, 10);
    const d = s * x + b;
    if (s === 0 || d === 0 || Math.abs(d) > 60) return null;
    return make(equation([term("A", a, 1), term("B", b), term("C", c, 1)], "=", [term("D", d)]), v, `First combine the two $${v}$-terms on the left.`, true);
  }
  // inequality, positive coefficient
  const rel = rng.pick(RELS);
  const x0 = rng.int(-6, 9);
  const a = rng.int(2, 8);
  const b = rng.nonZero(-12, 12);
  if (rng.chance(0.5)) {
    const c = a * x0 + b;
    return make(equation([term("A", a, 1), term("B", b)], rel, [term("C", c)]), v, "Solve it like an equation. You only divide by a positive number, so the sign stays.");
  }
  const c = rng.int(1, a - 1);
  const d = (a - c) * x0 + b;
  if (d === b) return null;
  return make(
    equation([term("A", a, 1), term("B", b)], rel, [term("C", c, 1), term("D", d)]),
    v,
    `Collect the $${v}$-terms on the left, the numbers on the right. Then divide.`,
  );
}

function level3(rng: Rng): Exercise | null {
  const v = rng.pick(VARS);
  const shape = rng.pick(["frac", "fracTwo", "ineqNeg", "ineqNeg", "ineqBracket", "twoBrackets", "minusBracket", "product"] as const);
  if (shape === "frac") {
    const [p, q] = rng.pick([[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4], [2, 5], [3, 5]] as const);
    const m = rng.nonZero(-4, 6);
    const b = rng.nonZero(-10, 10);
    const c = p * m + b;
    if (c === 0) return null;
    return make(
      equation([term("A", frac(p, q), 1), term("B", b)], "=", [term("C", c)]),
      v,
      "Get the fraction on its own first. Then multiply by the denominator.",
    );
  }
  if (shape === "fracTwo") {
    const [a, b] = rng.pick([[2, 3], [2, 5], [3, 4], [3, 5], [4, 6], [2, 4], [2, 6]] as const);
    const l = lcm(a, b);
    const x = l * rng.nonZero(-3, 4);
    if (rng.chance(0.4)) {
      // x/a + k = x/b
      const k = x / b - x / a;
      if (k === 0) return null;
      return make(
        equation([term("A", frac(1, a), 1), term("B", k)], "=", [term("C", frac(1, b), 1)]),
        v,
        `Multiply every term by $${l}$ first. That clears both fractions.`,
      );
    }
    const s = rng.sign();
    const c = x / a + (s * x) / b;
    if (c === 0) return null;
    return make(
      equation([term("A", frac(1, a), 1), term("B", frac(s, b), 1)], "=", [term("C", c)]),
      v,
      `Multiply every term by $${l}$, the common denominator.`,
    );
  }
  if (shape === "ineqNeg") {
    const rel = rng.pick(RELS);
    const x0 = rng.int(-5, 8);
    if (rng.chance(0.5)) {
      const a = rng.int(2, 6);
      const b = rng.int(1, 20);
      return make(
        equation([term("B", b), term("A", -a, 1)], rel, [term("C", b - a * x0)]),
        v,
        `Subtract $${b}$ first. Then you divide by $-${a}$: that flips the sign.`,
      );
    }
    const a = rng.int(1, 5);
    const c = a + rng.int(1, 5);
    const b = rng.nonZero(-10, 10);
    const d = (a - c) * x0 + b;
    if (d === b) return null;
    return make(
      equation([term("A", a, 1), term("B", b)], rel, [term("C", c, 1), term("D", d)]),
      v,
      `Bring the $${v}$-terms to the left. You'll end up dividing by a negative number, so flip the sign.`,
    );
  }
  if (shape === "ineqBracket") {
    const rel = rng.pick(RELS);
    const x0 = rng.int(-5, 6);
    const p = rng.nonZero(-6, 6);
    if (rng.chance(0.5)) {
      const k = rng.int(2, 4);
      const c = k + rng.int(1, 4);
      const d = k * (x0 + p) - c * x0;
      if (d === 0) return null;
      return make(
        equation([group("G", k, [inner(1, 1), inner(p)])], rel, [term("C", c, 1), term("D", d)]),
        v,
        `Expand first, then collect the $${v}$-terms on the left. Watch for a negative factor at the end.`,
      );
    }
    const k = -rng.int(2, 5);
    const d = k * (x0 + p);
    if (d === 0) return null;
    return make(
      equation([group("G", k, [inner(1, 1), inner(p)])], rel, [term("D", d)]),
      v,
      `Expand: $${k}$ times each term. In the end you divide by a negative number.`,
    );
  }
  if (shape === "twoBrackets") {
    const k = rng.int(2, 6);
    const m = rng.int(1, 5);
    if (k === m) return null;
    const p = rng.nonZero(-7, 7);
    const q = rng.nonZero(-7, 7);
    const x = rng.nonZero(-6, 8);
    const G = group("G", k, [inner(1, 1), inner(p)]);
    if (rng.chance(0.5)) {
      const c = k * (x + p) - m * (x + q);
      if (c === 0 || Math.abs(c) > 60) return null;
      return make(equation([G, group("H", -m, [inner(1, 1), inner(q)])], "=", [term("C", c)]), v, "Expand both brackets. The minus in front of the second one flips its signs.");
    }
    const c = k * (x + p) - m * (x + q);
    if (c === 0 || Math.abs(c) > 40) return null;
    return make(equation([G], "=", [group("H", m, [inner(1, 1), inner(q)]), term("C", c)]), v, "Expand both brackets, then solve as usual.");
  }
  if (shape === "minusBracket") {
    const a = rng.int(3, 9);
    const bb = rng.int(1, a - 1);
    const c = rng.nonZero(-9, 9);
    const x = rng.nonZero(-6, 8);
    const d = (a - bb) * x + c;
    if (d === 0 || Math.abs(d) > 60) return null;
    return make(
      equation([term("A", a, 1), group("G", -1, [inner(bb, 1), inner(-c)])], "=", [term("D", d)]),
      v,
      "A minus in front of the bracket flips every sign inside.",
    );
  }
  // product: (x + p)(x + q) = x² + r, or (x + p)² = x² + r
  const p = rng.nonZero(-6, 6);
  const x = rng.nonZero(-6, 8);
  if (rng.chance(0.5)) {
    const q = rng.nonZero(-6, 6);
    if (p + q === 0) return null;
    const r = (p + q) * x + p * q;
    if (r === 0 || Math.abs(r) > 60) return null;
    return make(
      equation([prod("P", [inner(1, 1), inner(p)], [inner(1, 1), inner(q)])], "=", [term("A", 1, 2), term("C", r)]),
      v,
      `Multiply out the brackets. The $${v}^2$ cancels, then it's a normal equation.`,
    );
  }
  const r = 2 * p * x + p * p;
  if (r === 0 || Math.abs(r) > 80) return null;
  return make(
    equation([prod("P", [inner(1, 1), inner(p)], [], { square: true })], "=", [term("A", 1, 2), term("C", r)]),
    v,
    `Use $(a + b)^2 = a^2 + 2ab + b^2$. The $${v}^2$ cancels.`,
  );
}

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 40; tries++) {
    const ex = level === 1 ? level1(rng) : level === 2 ? level2(rng) : level3(rng);
    if (!ex) continue;
    const a = ex.answer;
    const value = a.kind === "solutions" ? a.values[0] : a.kind === "inequality" ? a.value : 0;
    // Friendly numbers only, and no lonely 0 as the answer to an equation.
    if (Math.abs(value) > 30 || (a.kind === "solutions" && value === 0)) continue;
    return ex;
  }
  return make(equation([term("A", 2, 1), term("B", 3)], "=", [term("C", 11)]), "x", "First subtract $3$, then divide by $2$.", true);
}

// ---------------------------------------------------------------------------
// Interactive balance scale: take the same away on both sides.

type Pan = { x: number; n: number };
type Side = "l" | "r";
type BalanceLine = { l: Pan; r: Pan; kind: "x" | "n" | "div"; amount: number };
type BalanceState = { l: Pan; r: Pan; lines: BalanceLine[]; tipped: boolean };
type BalanceMsg = "start" | "ok" | "noN" | "noX" | "div" | "solved" | "tipped" | "one";

const PUZZLES: { l: Pan; r: Pan; x: number }[] = [
  { l: { x: 2, n: 3 }, r: { x: 0, n: 11 }, x: 4 },
  { l: { x: 3, n: 1 }, r: { x: 1, n: 7 }, x: 3 },
  { l: { x: 1, n: 8 }, r: { x: 3, n: 2 }, x: 3 },
  { l: { x: 4, n: 2 }, r: { x: 2, n: 10 }, x: 4 },
];

const fresh = (i: number): BalanceState => ({ l: PUZZLES[i].l, r: PUZZLES[i].r, lines: [], tipped: false });
const weightOf = (p: Pan, x: number) => p.x * x + p.n;

function panSrc(p: Pan, side: Side | "", keys = true): string {
  const k = (name: string) => (keys ? `#${side}${name}` : "");
  const parts: string[] = [];
  if (p.x > 0) parts.push(p.x === 1 ? `x${k("x")}` : `${p.x}${k("c")} x${k("x")}`);
  if (p.n > 0) parts.push(`${parts.length ? `+${k("p")} ` : ""}${p.n}${k("n")}`);
  return parts.length ? parts.join(" ") : `0${k("z")}`;
}

function lineOp(line: BalanceLine) {
  if (line.kind === "div") return `:${line.amount}`;
  if (line.kind === "n") return `-${line.amount}`;
  return line.amount === 1 ? "-x" : `-${line.amount}x`;
}

function isSolved(s: BalanceState) {
  return !s.tipped && ((s.l.x === 1 && s.l.n === 0 && s.r.x === 0) || (s.r.x === 1 && s.r.n === 0 && s.l.x === 0));
}

function takeBoth(s: BalanceState, kind: "x" | "n"): BalanceState | null {
  if (s.l[kind] < 1 || s.r[kind] < 1) return null;
  const last = s.lines[s.lines.length - 1];
  const lines = last && last.kind === kind ? [...s.lines.slice(0, -1), { ...last, amount: last.amount + 1 }] : [...s.lines, { l: s.l, r: s.r, kind, amount: 1 }];
  return { l: { ...s.l, [kind]: s.l[kind] - 1 }, r: { ...s.r, [kind]: s.r[kind] - 1 }, lines, tipped: false };
}

function divisorOf(s: BalanceState) {
  if (s.tipped || (!s.l.x && !s.r.x) || isSolved(s)) return 0;
  const counts = [s.l.x, s.l.n, s.r.x, s.r.n].filter((c) => c > 0);
  const g = counts.reduce((a, b) => gcd(a, b));
  return g >= 2 ? g : 0;
}

/** Item positions on a pan, bottom row first: x-boxes, then 1-weights. */
function pack(p: Pan) {
  const out: { id: string; kind: "x" | "n"; cx: number; cy: number }[] = [];
  let y = 0;
  const rows = (count: number, size: number, perRow: number, kind: "x" | "n") => {
    for (let start = 0; start < count; start += perRow) {
      const k = Math.min(perRow, count - start);
      const width = k * size + (k - 1) * 5;
      for (let i = 0; i < k; i++) out.push({ id: `${kind}${start + i}`, kind, cx: -width / 2 + size / 2 + i * (size + 5), cy: -(y + size / 2) });
      y += size + 5;
    }
  };
  rows(p.x, 32, 4, "x");
  rows(p.n, 20, 6, "n");
  return out;
}

const SWING = { type: "spring" as const, stiffness: 70, damping: 9, mass: 1 };
const BEAM = 160;

function PanView({ cx, angle, side, pan, xValue, reveal, onTap }: { cx: number; angle: number; side: Side; pan: Pan; xValue: number; reveal: boolean; onTap: (side: Side, kind: "x" | "n") => void }) {
  const rad = (angle * Math.PI) / 180;
  const dir = side === "l" ? -1 : 1;
  const dx = -dir * BEAM * (1 - Math.cos(rad));
  const dy = dir * BEAM * Math.sin(rad);
  return (
    <motion.g initial={false} animate={{ x: dx, y: dy }} transition={SWING}>
      <path d={`M ${cx} 70 L ${cx - 76} 224 M ${cx} 70 L ${cx + 76} 224`} stroke="var(--ink-3)" strokeWidth={1.4} fill="none" opacity={0.7} />
      <circle cx={cx} cy={70} r={4} fill="var(--ink-2)" />
      <path d={`M ${cx - 86} 224 H ${cx + 86} A 86 17 0 0 1 ${cx - 86} 224 Z`} fill="color-mix(in oklab, var(--ink) 9%, var(--surface))" stroke="var(--ink-3)" strokeWidth={1.2} />
      <g transform={`translate(${cx} 221)`}>
        <AnimatePresence initial={false}>
          {pack(pan).map((it) => (
            <motion.g
              key={it.id}
              initial={{ opacity: 0, scale: 0.4, x: it.cx, y: it.cy - 24 }}
              animate={{ opacity: 1, scale: 1, x: it.cx, y: it.cy }}
              exit={{ opacity: 0, scale: 0.7, y: it.cy - 56, transition: { duration: 0.38, ease: "easeOut" } }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => onTap(side, it.kind)}
              style={{ cursor: "pointer" }}
            >
              {it.kind === "x" ? (
                <>
                  <rect x={-16} y={-16} width={32} height={32} rx={8} fill="var(--blob)" />
                  <text y={6.5} textAnchor="middle" fontSize={reveal ? 18 : 20} fill="#fff" className="font-math" fontStyle={reveal ? "normal" : "italic"}>
                    {reveal ? xValue : "x"}
                  </text>
                </>
              ) : (
                <>
                  <rect x={-10} y={-10} width={20} height={20} rx={4.5} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} />
                  <text y={4.5} textAnchor="middle" fontSize={13} fill="var(--ink-2)" className="font-math">
                    1
                  </text>
                </>
              )}
            </motion.g>
          ))}
        </AnimatePresence>
      </g>
    </motion.g>
  );
}

function EqRow({ l, r, rel = "=", op, scope, live }: { l: string; r: string; rel?: string; op?: string; scope?: string; live?: boolean }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2", live ? "min-h-12" : "min-h-8 text-ink-3")}>
      <MathView src={l} size={live ? "lg" : "md"} scope={scope && `${scope}-l`} animate={!!live} className="justify-self-end" />
      <MathView src={rel} size={live ? "lg" : "md"} animate={false} className={rel === "=" ? "" : "text-danger"} />
      <span className="flex min-w-0 items-center gap-4">
        <MathView src={r} size={live ? "lg" : "md"} scope={scope && `${scope}-r`} animate={!!live} />
        {op && <MathView src={`| \\, ${op}`} size="md" animate={false} className="text-blob-ink" />}
      </span>
    </div>
  );
}

const BALANCE_MSG: Record<BalanceMsg, string> = {
  start: "Tap a block to take it away. The same block disappears from the other pan too.",
  ok: "Still level. Both sides lost exactly the same weight.",
  noN: "The other pan has no 1-weight left. Try something else.",
  noX: "The other pan has no x-box to take away. Try something else.",
  div: "Each pan was split into equal parts. One part stays on each side, so it's still level.",
  solved: "Solved! One x-box balances the weights on the other side.",
  tipped: "It tips! Only one side changed, so the two sides aren't equal any more.",
  one: "Now tap a block on just one pan and watch the balance.",
};

function BalanceScale() {
  const scope = useId();
  const [puzzle, setPuzzle] = useState(0);
  const [mode, setMode] = useState<"both" | "one">("both");
  const [s, setS] = useState(() => fresh(0));
  const [past, setPast] = useState<BalanceState[]>([]);
  const [msg, setMsg] = useState<BalanceMsg>("start");
  const X = PUZZLES[puzzle].x;
  const solved = isSolved(s);
  const angle = Math.max(-11, Math.min(11, (weightOf(s.r, X) - weightOf(s.l, X)) * 3.5));
  const k = divisorOf(s);

  function commit(next: BalanceState, m: BalanceMsg) {
    setPast((p) => [...p, s]);
    setS(next);
    setMsg(isSolved(next) ? "solved" : m);
  }
  function tap(side: Side, kind: "x" | "n") {
    if (s.tipped || solved) return;
    if (mode === "one") {
      const pan = s[side];
      if (pan[kind] < 1) return;
      const nextPan = { ...pan, [kind]: pan[kind] - 1 };
      const next = { ...s, [side]: nextPan } as BalanceState;
      commit({ ...next, tipped: weightOf(next.l, X) !== weightOf(next.r, X) }, "tipped");
      return;
    }
    const next = takeBoth(s, kind);
    if (!next) setMsg(kind === "x" ? "noX" : "noN");
    else commit(next, "ok");
  }
  function divide() {
    if (!k) return;
    commit({ l: { x: s.l.x / k, n: s.l.n / k }, r: { x: s.r.x / k, n: s.r.n / k }, lines: [...s.lines, { l: s.l, r: s.r, kind: "div", amount: k }], tipped: false }, "div");
  }
  function undo() {
    const prev = past[past.length - 1];
    if (!prev) return;
    setPast((p) => p.slice(0, -1));
    setS(prev);
    setMsg(prev.tipped ? "tipped" : prev.lines.length ? "ok" : "start");
  }
  function load(i: number, m: "both" | "one" = mode) {
    setPuzzle(i);
    setS(fresh(i));
    setPast([]);
    setMsg(m === "one" ? "one" : "start");
  }
  function switchMode(m: "both" | "one") {
    setMode(m);
    load(puzzle, m);
  }

  const tone = msg === "tipped" ? "text-danger" : msg === "solved" ? "text-blob-ink font-semibold" : msg === "ok" || msg === "div" ? "text-ok" : "text-ink-2";
  const buttons: { label: string; on: () => void; ok: boolean }[] = [
    { label: "-1", on: () => tap("l", "n"), ok: s.l.n > 0 && s.r.n > 0 },
    { label: "-x", on: () => tap("l", "x"), ok: s.l.x > 0 && s.r.x > 0 },
    { label: `:${k || 2}`, on: divide, ok: k > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["both", "one"] as const).map((m) => (
            <button key={m} onClick={() => switchMode(m)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", mode === m ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {mode === m && <motion.span layoutId={`${scope}-mode`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{m === "both" ? "Both sides" : "One side only"}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={undo} disabled={!past.length} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent">
            <Undo2 className="size-3.5" /> Undo
          </button>
          <button onClick={() => load(puzzle)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> Reset
          </button>
          <button onClick={() => load((puzzle + 1) % PUZZLES.length)} className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <Shuffle className="size-3.5" /> New puzzle
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 pt-3 pb-1">
        <svg viewBox="0 34 520 234" className="mx-auto block w-full max-w-[540px] select-none overflow-visible" role="img" aria-label="Balance scale">
          <path d="M 260 74 L 246 254 H 274 Z" fill="color-mix(in oklab, var(--ink) 16%, transparent)" />
          <rect x={206} y={252} width={108} height={10} rx={5} fill="color-mix(in oklab, var(--ink) 22%, transparent)" />
          <PanView cx={260 - BEAM} angle={angle} side="l" pan={s.l} xValue={X} reveal={solved} onTap={tap} />
          <PanView cx={260 + BEAM} angle={angle} side="r" pan={s.r} xValue={X} reveal={solved} onTap={tap} />
          <motion.g initial={false} animate={{ rotate: angle }} transition={SWING}>
            <rect x={92} y={66} width={336} height={8} rx={4} fill="var(--ink-2)" />
            <circle cx={260} cy={70} r={10} fill="var(--blob)" />
            <circle cx={260} cy={70} r={3.5} fill="var(--raised)" />
          </motion.g>
        </svg>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {s.lines.map((line, i) => (
              <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                <EqRow l={panSrc(line.l, "", false)} r={panSrc(line.r, "", false)} op={lineOp(line)} />
              </motion.div>
            ))}
          </AnimatePresence>
          <EqRow l={panSrc(s.l, "l")} r={panSrc(s.r, "r")} rel={s.tipped ? "\\ne" : "="} scope={scope} live />
        </div>
        {mode === "both" && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">On both sides</span>
            <div className="flex gap-1.5">
              {buttons.map((b) => (
                <button
                  key={b.label}
                  onClick={b.on}
                  disabled={!b.ok || solved}
                  className="h-10 min-w-14 rounded-lg border border-line bg-raised px-3 text-[18px] text-ink transition-[transform,background] hover:border-blob hover:bg-blob-soft active:scale-95 disabled:pointer-events-none disabled:opacity-35"
                >
                  <MathView src={`| \\, ${b.label}`} size="sm" animate={false} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={msg + (solved ? X : "")} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className={cn("min-h-[1.5em] text-[14px]", tone)}>
          {BALANCE_MSG[msg]}
          {solved && (
            <>
              {" "}
              <MathView src={`x = ${X}`} size="inline" animate={false} className="mx-[0.1em] align-middle" />
            </>
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Interactive number line: test numbers in an inequality and find the pattern.

type LabEx = { tex: string; lhs: (x: number) => number; sub: (x: string) => string; rel: Exclude<Rel, "=">; rhs: number; sol: { rel: Exclude<Rel, "=">; at: number }; steps: string[]; flips: boolean };

const LAB: LabEx[] = [
  { tex: "2x + 1 < 7", lhs: (x) => 2 * x + 1, sub: (x) => `2 \\cdot ${x} + 1`, rel: "<", rhs: 7, sol: { rel: "<", at: 3 }, steps: ["2x + 1 < 7 \\quad | \\, -1", "2x < 6 \\quad | \\, :2", "x < 3"], flips: false },
  { tex: "-2x < 6", lhs: (x) => -2 * x, sub: (x) => `-2 \\cdot ${x}`, rel: "<", rhs: 6, sol: { rel: ">", at: -3 }, steps: ["-2x < 6 \\quad | \\, :(-2)", "x \\hl{>} -3"], flips: true },
  { tex: "3x - 2 \\ge 4", lhs: (x) => 3 * x - 2, sub: (x) => `3 \\cdot ${x} - 2`, rel: "≥", rhs: 4, sol: { rel: "≥", at: 2 }, steps: ["3x - 2 \\ge 4 \\quad | \\, +2", "3x \\ge 6 \\quad | \\, :3", "x \\ge 2"], flips: false },
  { tex: "4 - 2x \\ge -2", lhs: (x) => 4 - 2 * x, sub: (x) => `4 - 2 \\cdot ${x}`, rel: "≥", rhs: -2, sol: { rel: "≤", at: 3 }, steps: ["4 - 2x \\ge -2 \\quad | \\, -4", "-2x \\ge -6 \\quad | \\, :(-2)", "x \\hl{\\le} 3"], flips: true },
];

const holds = (a: number, rel: Exclude<Rel, "=">, b: number) => (rel === "<" ? a < b : rel === ">" ? a > b : rel === "≤" ? a <= b : a >= b);
const deNum = (v: number) => (Number.isInteger(v) ? String(v) : String(v).replace(".", ","));
const inBrackets = (v: number) => (v < 0 ? `(${deNum(v)})` : deNum(v));
const REL_PLAIN: Record<Rel, string> = { "=": "=", "<": "<", ">": ">", "≤": "≤", "≥": "≥" };

const NL = { from: -6, to: 6, y: 56 };
/** Number line geometry: a narrower drawing on phones keeps the labels readable. */
const lineGeometry = (narrow: boolean) => (narrow ? { w: 360, left: 22, right: 338, font: 17, bubble: 80 } : { w: 640, left: 34, right: 606, font: 15, bubble: 68 });

const subscribeNarrow = (cb: () => void) => {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia("(max-width: 639px)").matches, () => false);

function InequalityLab() {
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [ex, setEx] = useState(0);
  const [x, setX] = useState(0);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState(false);
  const [dragging, setDragging] = useState(false);
  const g = lineGeometry(useNarrow());
  const nx = (v: number) => g.left + ((v - NL.from) / (NL.to - NL.from)) * (g.right - g.left);
  const e = LAB[ex];
  const lhs = e.lhs(x);
  const ok = holds(lhs, e.rel, e.rhs);
  const color = ok ? "var(--ok)" : "var(--danger)";

  function moveTo(raw: number) {
    const v = Math.max(NL.from, Math.min(NL.to, Math.round(raw * 2) / 2));
    setX(v);
    setSeen((s) => (String(v) in s ? s : { ...s, [String(v)]: holds(e.lhs(v), e.rel, e.rhs) }));
  }
  function fromPointer(ev: React.PointerEvent) {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    moveTo(NL.from + ((p.x - g.left) / (g.right - g.left)) * (NL.to - NL.from));
  }
  function pick(i: number) {
    setEx(i);
    setX(0);
    setSeen({});
    setShow(false);
  }

  const ticks: number[] = [];
  for (let v = NL.from; v <= NL.to; v++) ticks.push(v);
  const right = e.sol.rel === ">" || e.sol.rel === "≥";
  const closed = e.sol.rel === "≤" || e.sol.rel === "≥";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {LAB.map((l, i) => (
          <button
            key={l.tex}
            onClick={() => pick(i)}
            className={cn("relative h-10 rounded-lg border px-3 transition-colors", ex === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
          >
            {ex === i && <motion.span layoutId={`${scope}-ex`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <MathView src={l.tex} size="sm" animate={false} className="relative" />
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface px-2 py-3 sm:px-4">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${g.w} 96`}
          className={cn("block w-full touch-none select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
          role="slider"
          aria-label="Value of x"
          aria-valuemin={NL.from}
          aria-valuemax={NL.to}
          aria-valuenow={x}
          tabIndex={0}
          onKeyDown={(ev) => {
            if (ev.key === "ArrowRight" || ev.key === "ArrowUp") {
              ev.preventDefault();
              moveTo(x + 0.5);
            } else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") {
              ev.preventDefault();
              moveTo(x - 0.5);
            }
          }}
          onPointerDown={(ev) => {
            (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
            setDragging(true);
            fromPointer(ev);
          }}
          onPointerMove={(ev) => dragging && fromPointer(ev)}
          onPointerUp={() => setDragging(false)}
          onPointerCancel={() => setDragging(false)}
        >
          <line x1={g.left - 22} x2={g.right + 22} y1={NL.y} y2={NL.y} stroke="var(--ink-3)" strokeWidth={1.5} />
          <path d={`M ${g.right + 15} ${NL.y - 5} L ${g.right + 23} ${NL.y} L ${g.right + 15} ${NL.y + 5}`} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} />
          {ticks.map((t) => (
            <g key={t}>
              <line x1={nx(t)} x2={nx(t)} y1={NL.y - 7} y2={NL.y + 7} stroke="var(--ink-3)" strokeWidth={t === 0 ? 1.6 : 1} />
              {t < NL.to && <line x1={nx(t + 0.5)} x2={nx(t + 0.5)} y1={NL.y - 3} y2={NL.y + 3} stroke="var(--ink-3)" strokeWidth={0.8} opacity={0.6} />}
              <text x={nx(t)} y={NL.y + 27} fontSize={g.font} textAnchor="middle" fill="var(--ink-2)" className="font-math">
                {String(t).replace("-", "−")}
              </text>
            </g>
          ))}
          <AnimatePresence>
            {show && (
              <motion.g key={`sol${ex}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.line
                  y1={NL.y}
                  y2={NL.y}
                  x1={nx(e.sol.at)}
                  initial={{ x2: nx(e.sol.at) }}
                  animate={{ x2: right ? g.right + 20 : g.left - 20 }}
                  transition={{ type: "spring", stiffness: 90, damping: 18 }}
                  stroke="var(--blob)"
                  strokeWidth={9}
                  strokeLinecap="round"
                  opacity={0.32}
                />
                <circle cx={nx(e.sol.at)} cy={NL.y} r={7.5} fill={closed ? "var(--blob)" : "var(--surface)"} stroke="var(--blob)" strokeWidth={2.6} />
              </motion.g>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {Object.entries(seen).map(([k, good]) => (
              <motion.circle
                key={`${ex}:${k}`}
                cx={nx(Number(k))}
                cy={NL.y}
                r={4.6}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                exit={{ scale: 0, opacity: 0 }}
                fill={good ? "var(--ok)" : "var(--danger)"}
              />
            ))}
          </AnimatePresence>
          <motion.g initial={false} animate={{ x: nx(x) }} transition={{ type: "spring", stiffness: 520, damping: 36 }}>
            <circle cy={NL.y} r={16} fill={color} opacity={0.16} />
            <circle cy={NL.y} r={8.5} fill={color} stroke="var(--raised)" strokeWidth={2.5} />
            <rect x={-g.bubble / 2} y={2} width={g.bubble} height={27} rx={13.5} fill={color} />
            <text y={21} textAnchor="middle" fontSize={g.font} fill="#fff" className="font-math" fontStyle="italic">
              x = {deNum(x).replace("-", "−")}
            </text>
          </motion.g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <MathView src={`${e.sub(inBrackets(x))} = ${deNum(lhs)}`} size="md" scope={`${scope}-sub`} />
        <span className="flex items-center gap-2.5">
          <MathView src={`${deNum(lhs)} ${REL_PLAIN[e.rel]} ${deNum(e.rhs)}`} size="md" scope={`${scope}-cmp`} />
          <motion.span
            key={String(ok)}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 22 }}
            className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold text-white", ok ? "bg-ok" : "bg-danger")}
          >
            {ok ? "true" : "false"}
          </motion.span>
        </span>
        {!show && (
          <button onClick={() => setShow(true)} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <Eye className="size-3.5" /> Show the solution
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {show && (
          <motion.div key={`steps${ex}`} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-blob-soft/50 px-4 py-3">
              <div className="space-y-1">
                {e.steps.map((st) => (
                  <div key={st}>
                    <MathView src={st} size="md" animate={false} />
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <div className="font-math text-[22px] text-ink">
                  L = {"{"} <i>x</i> | <i>x</i> {REL_PLAIN[e.sol.rel]} {String(e.sol.at).replace("-", "−")} {"}"}
                </div>
                <p className="max-w-[340px] text-[13.5px] text-ink-2">
                  {e.flips
                    ? "Dividing by a negative number flipped the sign. Your green dots agree!"
                    : closed
                      ? "The boundary belongs to the solution: a filled dot."
                      : "The boundary itself is not a solution: an open circle."}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------

const balanceFrames: Frame[] = [
  { math: "x#x +#p 5#b =#eq 12#c", note: "On the left: $x$ and $5$. On the right: $12$. Both sides are worth the same." },
  {
    math: "x#x +#p 5#b =#eq 12#c \\quad |#bar \\, -#o 5#on",
    highlight: ["o", "on"],
    note: "We want $x$ alone, so the $+5$ has to go. Write the plan after a bar: $| -5$ means **subtract 5**.",
  },
  {
    math: "x#x +#p 5#b -#l 5#ln =#eq 12#c -#r 5#rn \\quad |#bar \\, -#o 5#on",
    highlight: ["l", "ln", "r", "rn"],
    note: "Whatever you do to one side, you do to the other: subtract $5$ on **both** sides.",
  },
  { math: "x#x =#eq 7#c", note: "$5 - 5 = 0$ and $12 - 5 = 7$. So $x = 7$." },
  { math: "\\green{7} + 5 = 12", note: "Check: put $7$ in for $x$. $7 + 5 = 12$. Balanced!" },
];

const twoStep = solveEq(equation([term("A", 2, 1), term("B", 3)], "=", [term("C", 11)]), "x", {
  check: true,
  maxEm: 18,
  intro: "$2x$ means $2 \\cdot x$. So two things happen to $x$: times $2$, then plus $3$.",
}).frames;

const bothSides = solveEq(equation([term("A", 5, 1), term("B", -2)], "=", [term("C", 3, 1), term("D", 6)]), "x", {
  check: true,
  maxEm: 18,
  intro: "Now there's an $x$ on both sides. Collect them on one side first.",
}).frames;

const withBracket = solveEq(equation([group("G", 3, [inner(1, 1), inner(-2)])], "=", [term("C", 1, 1), term("D", 4)]), "x", { check: true, maxEm: 18 }).frames;

const firstInequality = solveEq(equation([term("A", 2, 1), term("B", 1)], "<", [term("C", 7)]), "x", {
  maxEm: 18,
  intro: "An inequality: the left side is **smaller** than the right side. Solve it just like an equation.",
}).frames;

const flipFrames: Frame[] = [
  { math: "2#a <#rel 5#b", note: "Why is there an exception? Start with something true: $2 < 5$." },
  { math: "2#a <#rel 5#b \\quad |#bar \\, \\cdot#o (-#os 1#on)#ob", highlight: ["bar", "o", "os", "on", "ob(", "ob)"], note: "Now multiply both sides by $-1$." },
  { math: "-#as 2#a \\hl{?#q} -#bs 5#b", note: "We get $-2$ and $-5$. Which one is bigger?" },
  {
    math: "-#as 2#a >#rel2 -#bs 5#b",
    highlight: ["rel2"],
    note: "$-2$ is **bigger** than $-5$: it lies further right on the number line. The sign had to flip!",
  },
  ...solveEq(equation([term("A", -3, 1)], "≤", [term("C", 12)]), "x", {
    maxEm: 18,
    intro: "Same with $-3x \\le 12$. To get $x$ alone you divide by $-3$.",
  }).frames,
];

const equations: Topic = {
  ...topicMeta("equations"),
  summary: [
    {
      title: "The balance rule",
      body: "Do the same thing to **both** sides. Write each step after a bar.",
      examples: ["2x + 3 = 11 \\quad | \\, -3", "2x = 8 \\quad | \\, :2", "x = 4"],
      tone: "rule",
    },
    {
      title: "In this order",
      body: "Expand brackets. Collect the $x$-terms on one side and the numbers on the other. Then divide by the number in front of $x$.",
      examples: ["3(x - 2) = x + 4", "3x - 6 = x + 4 \\quad | \\, -x", "2x - 6 = 4 \\quad | \\, +6", "2x = 10 \\quad | \\, :2"],
      tone: "rule",
    },
    {
      title: "Inequalities",
      body: "Solve them like equations. The solution is a whole range of numbers, shown on a number line.",
      examples: ["2x + 1 < 7 \\quad | \\, -1", "2x < 6 \\quad | \\, :2", "x < 3"],
      tone: "rule",
    },
    {
      title: "Negative factor: flip the sign",
      body: "Multiplying or dividing both sides by a **negative** number turns the inequality sign around.",
      examples: ["-3x \\le 12 \\quad | \\, :(-3)", "x \\ge -4"],
      tone: "warning",
    },
    {
      title: "Fractions",
      body: "Multiply every term by the common denominator. The fractions disappear.",
      examples: ["\\frac{x}{2} + \\frac{x}{3} = 5 \\quad | \\, \\cdot 6", "3x + 2x = 30"],
      tone: "tip",
    },
    {
      title: "Check your answer",
      body: "Put the solution back in. Both sides must give the same number.",
      examples: ["2 \\cdot 4 + 3 = 11"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: "An equation is a balance",
      blob: "Picture a balance that's perfectly level. That's an equation!",
      body: "An equation says: the left side is worth exactly as much as the right side. To find $x$, we change both sides in the same way until $x$ is alone.",
      frames: balanceFrames,
    },
    {
      type: "widget",
      title: "Keep it balanced",
      blob: "Tap the blocks! Can you get one x-box all by itself?",
      body: "Each purple box weighs $x$, each small block weighs $1$. Take away the same on both sides and the balance stays level. Then switch to **One side only** and see what happens.",
      widget: BalanceScale,
    },
    {
      type: "explain",
      title: "Two steps: first plus and minus, then divide",
      blob: "Undo things in reverse: the plus goes first, then the times.",
      body: "Get rid of the number that's added or subtracted first. Then divide by the number in front of $x$.",
      frames: twoStep,
    },
    {
      type: "check",
      blob: "Your turn! Same two steps.",
      exercise: make(equation([term("A", 4, 1), term("B", -7)], "=", [term("C", 13)]), "x", "First add $7$ on both sides, then divide by $4$.", true),
    },
    {
      type: "explain",
      title: "x on both sides",
      blob: "Two teams of x? Bring them together on one side.",
      body: "Collect all $x$-terms on one side and all numbers on the other. Tip: take away the smaller $x$-term, then $x$ stays positive.",
      frames: bothSides,
    },
    {
      type: "explain",
      title: "Brackets? Expand first",
      blob: "Brackets are wrapping paper. Unwrap them first!",
      body: "Multiply out the brackets. After that it's an equation like the ones before.",
      frames: withBracket,
    },
    {
      type: "check",
      blob: "Bracket first, then the balance steps.",
      exercise: make(
        equation([group("G", 2, [inner(1, 1), inner(4)])], "=", [term("C", 5, 1), term("D", -1)]),
        "x",
        "Expand: $2(x + 4) = 2x + 8$. Then bring the $x$-terms together.",
        true,
      ),
    },
    {
      type: "explain",
      title: "Inequalities",
      blob: "Not equal, but smaller or bigger. Same tricks!",
      body: "$x < 3$ means $x$ is smaller than $3$. $x \\ge 3$ means greater than or equal to $3$. You solve inequalities just like equations, and the answer is a whole range of numbers.",
      frames: firstInequality,
    },
    {
      type: "widget",
      title: "Test numbers on the number line",
      blob: "Drag x around. Green means it works, red means it doesn't.",
      body: "Move $x$ and watch whether the inequality is true. The dots remember what you tried. Then compare $2x + 1 < 7$ with $-2x < 6$: where are the solutions?",
      widget: InequalityLab,
    },
    {
      type: "explain",
      title: "The one exception: negative numbers",
      blob: "This is the trap in every test. Watch closely!",
      body: "Multiply or divide both sides by a **negative** number and the inequality sign turns around. That's the only new rule.",
      frames: flipFrames,
    },
    {
      type: "check",
      blob: "Last one. Remember the flip!",
      exercise: make(
        equation([term("A", -4, 1), term("B", 3)], ">", [term("C", 11)]),
        "x",
        "Subtract $3$, then divide by $-4$. Dividing by a negative number flips the sign!",
      ),
    },
  ],
  generate,
};

export default equations;
