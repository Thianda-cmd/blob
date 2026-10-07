"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { SolutionPlayer } from "@/learn/components/SolutionPlayer";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import { equivalentText } from "@/learn/engine/expr";
import type { Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, LevelLesson, Mistake } from "@/learn/types";
import { cn } from "@/lib/utils";
import { emWidth, smoothFracExits } from "../equations/level1";
import { choice, clean, dec, enDecimalFrames, enDecimals, numberMistakes } from "./kit";

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
  before: Text;
  after: Text;
  /** For hints: "divide both sides by $a$". */
  short: Text;
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
        ? tx(`$${target}$ comes with a minus. Add $${X}$ on both sides to bring it over.`, `Vor $${target}$ steht ein Minus. Addiere $${X}$ auf beiden Seiten, dann wechselt es die Seite.`)
        : tx(
            `$${X}$ is ${pick.neg ? "subtracted" : "added"}. Undo it: ${pick.neg ? "add" : "subtract"} $${X}$ on **both** sides.`,
            `$${X}$ wird ${pick.neg ? "subtrahiert" : "addiert"}. Umkehroperation: ${pick.neg ? "Addiere" : "Subtrahiere"} $${X}$ auf **beiden** Seiten.`,
          ),
      after: moving
        ? tx(`Now $${target}$ is on the other side, with a plus.`, `Jetzt steht $${target}$ auf der anderen Seite, mit Plus.`)
        : tx(`$${pick.neg ? "-" : "+"} ${X}$ and $${flipped} ${X}$ cancel.`, `$${pick.neg ? "-" : "+"} ${X}$ und $${flipped} ${X}$ heben sich auf.`),
      short: tx(`${pick.neg ? "add" : "subtract"} $${X}$ on both sides`, `auf beiden Seiten $${X}$ ${pick.neg ? "addieren" : "subtrahieren"}`),
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
        before: tx(`Get rid of the fraction $${p(fr)}$ first: multiply both sides by $${p(M)}$.`, `Werde zuerst den Bruch $${p(fr)}$ los: Multipliziere beide Seiten mit $${p(M)}$.`),
        after: `$${p(M)} \\cdot ${p(fr)} = ${left.length ? (left[0].t === "sum" ? `(${p(left[0])})` : p(left[0])) : "1"}$.`,
        short: tx(`multiply both sides by $${p(M)}$`, `beide Seiten mit $${p(M)}$ multiplizieren`),
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
      before: tx(
        `$${p(kept)}$ is multiplied by $${p(D)}$. Undo it: divide both sides by $${p(D)}$.`,
        `$${p(kept)}$ wird mit $${p(D)}$ multipliziert. Umkehroperation: Teile beide Seiten durch $${p(D)}$.`,
      ),
      after: tx(`$\\frac{${p(T)}}{${p(D)}} = ${p(kept)}$: the $${p(D)}$ cancels.`, `$\\frac{${p(T)}}{${p(D)}} = ${p(kept)}$, denn $${p(D)}$ kürzt sich weg.`),
      short: tx(`divide both sides by $${p(D)}$`, `beide Seiten durch $${p(D)}$ teilen`),
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
        ? tx(
            `$${target}$ is in the denominator. Multiply both sides by $${p(M)}$ to get it out.`,
            `$${target}$ steht im Nenner. Multipliziere beide Seiten mit $${p(M)}$, dann ist der Bruch weg.`,
          )
        : tx(
            `$${p(T.num)}$ is divided by $${p(M)}$. Undo it: multiply both sides by $${p(M)}$.`,
            `$${p(T.num)}$ wird durch $${p(M)}$ geteilt. Umkehroperation: Multipliziere beide Seiten mit $${p(M)}$.`,
          ),
      after: inDen
        ? tx(
            `$\\frac{${p(T.num)}}{${p(M)}} \\cdot ${p(M)} = ${p(T.num)}$. Now $${target}$ is on the other side, and no longer in a fraction.`,
            `$\\frac{${p(T.num)}}{${p(M)}} \\cdot ${p(M)} = ${p(T.num)}$. Jetzt steht $${target}$ auf der anderen Seite und nicht mehr im Nenner.`,
          )
        : `$\\frac{${p(T.num)}}{${p(M)}} \\cdot ${p(M)} = ${p(T.num)}$.`,
      short: tx(`multiply both sides by $${p(M)}$`, `beide Seiten mit $${p(M)}$ multiplizieren`),
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
      before: tx(`$${b}$ is squared. Undo it: take the square root of both sides.`, `$${b}$ wird quadriert. Umkehroperation: Zieh auf beiden Seiten die Wurzel.`),
      after: tx(`$\\sqrt{${b}^2} = ${b}$, because $${b}$ is positive.`, `$\\sqrt{${b}^2} = ${b}$, weil $${b}$ positiv ist.`),
      short: tx("take the square root of both sides", "auf beiden Seiten die Wurzel ziehen"),
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
      before: tx(`$${body}$ is under a square root. Undo it: square both sides.`, `$${body}$ steht unter einer Wurzel. Umkehroperation: Quadriere beide Seiten.`),
      after: `$(\\sqrt{${body}})^2 = ${body}$.`,
      short: tx("square both sides", "beide Seiten quadrieren"),
    };
  }
  throw new Error(`Can't undo ${T.t}`);
}

type Solution = { frames: Frame[]; answer: N; L: N; R: N; hint: Text; steps: number };

/**
 * All frames for solving `L = R` for `target`. `maxEm`: the widest step that fits on one line
 * (about 13em in a worked solution, 18em on the lesson board); wider steps only show the bar.
 */
function rearrange(L0: N, R0: N, target: string, opts: { intro?: Text; maxEm?: number } = {}): Solution {
  let L = L0;
  let R = R0;
  const eq = (l: N, r: N, op = "", n = 0) => `${src(l, true, target)} =#eq ${src(r, true, target)}${op ? ` \\quad |#bar${n} \\, ${op}` : ""}`;
  const intro = opts.intro ?? tx(`We want $${target}$ on its own. Undo what happens to it, one step at a time.`, `Wir stellen nach $${target}$ um: Mach Schritt für Schritt rückgängig, was mit $${target}$ passiert.`);
  let lastMath = eq(L, R);
  const frames: Frame[] = [{ math: lastMath, note: intro }];
  let n = 0;
  let short: Text = "";
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
      const before = new Set(leafKeys(lastMath));
      frames.push({ math: full, note: s.before, highlight: leafKeys(full).filter((k) => !before.has(k) && !/^(ao|ab|ae|bar)\d/.test(k) && !k.includes(`_a${n}`)) });
    } else {
      // Too wide for one line: just write the step after the bar, like in an exercise book.
      const math = eq(L, R, s.op, n);
      frames.push({ math, note: s.before, highlight: leafKeys(math).filter((k) => /^(ao|ab|ae)\d/.test(k) || k.includes(`_a${n}`)) });
    }
    if (left) [L, R] = [s.t, s.o];
    else [L, R] = [s.o, s.t];
    lastMath = eq(L, R);
    frames.push({ math: lastMath, note: s.after });
  }
  const leftDone = has(L, target);
  const answer = leftDone ? R : L;
  const done = `$${target} = ${src(answer, false)}$`;
  if (!leftDone) {
    [L, R] = [R, L];
    frames.push({ math: eq(L, R), note: tx(`Swap the sides. Done: ${done}.`, `Seiten tauschen. Fertig: ${done}.`) });
  } else {
    const last = frames[frames.length - 1];
    frames[frames.length - 1] = { ...last, note: txMap((t, locale) => `${resolveText(last.note, locale)} ${t("Done:", "Fertig:")} ${done}.`) };
  }
  const hint = txMap((t, locale) => {
    const first = resolveText(short, locale);
    return n === 1 ? t(`One step does it: ${first}.`, `Ein Schritt reicht: ${first}.`) : t(`First step: ${first}. Then keep undoing until $${target}$ is alone.`, `Erster Schritt: ${first}. Dann machst du weiter, bis $${target}$ allein steht.`);
  });
  return { frames: smoothFracExits(frames), answer, L, R, hint, steps: n };
}

// ---------------------------------------------------------------------------
// Formula bank

type Formula = {
  key: string;
  name: Text;
  L: N;
  R: N;
  /** What the letters mean (rich text). */
  legend: Text;
  /** Letters to solve for, with the practice level. */
  targets: Record<string, Level>;
  /** Example values for the number check in the explorer (inputs only). */
  values?: Record<string, number>;
};

function formula(key: string, name: Text, L: N, R: N, legend: Text, targets: Record<string, Level>, values?: Record<string, number>): Formula {
  const next = { n: 0 };
  return { key, name, L: label(L, next), R: label(R, next), legend, targets, values };
}

const FORMULAS: Formula[] = [
  formula(
    "rect",
    tx("Rectangle", "Rechteck"),
    sym("A"),
    mul(sym("a"), sym("b")),
    tx("Area $A$ of a rectangle with sides $a$ and $b$.", "Flächeninhalt $A$ eines Rechtecks mit den Seiten $a$ und $b$."),
    { a: 1, b: 1 },
    { a: 6, b: 4 },
  ),
  formula(
    "perimeter",
    tx("Perimeter", "Umfang"),
    sym("u"),
    sum(mul(num(2), sym("a")), mul(num(2), sym("b"))),
    tx("Perimeter $u$ of a rectangle with sides $a$ and $b$.", "Umfang $u$ eines Rechtecks mit den Seiten $a$ und $b$."),
    { a: 2, b: 2 },
    { a: 6, b: 4 },
  ),
  formula("speed", tx("Speed", "Geschwindigkeit"), sym("v"), over(sym("s"), sym("t")), tx("Speed $v$, distance $s$, time $t$.", "Geschwindigkeit $v$, Strecke $s$, Zeit $t$."), { s: 1, t: 2 }, { s: 120, t: 2 }),
  formula("force", tx("Force", "Kraft"), sym("F"), mul(sym("m"), sym("a")), tx("Force $F$, mass $m$, acceleration $a$.", "Kraft $F$, Masse $m$, Beschleunigung $a$."), { m: 1, a: 1 }, { m: 5, a: 4 }),
  formula(
    "power",
    tx("Electric power", "Elektrische Leistung"),
    sym("P"),
    mul(sym("U"), sym("I")),
    tx("Electric power $P$, voltage $U$, current $I$.", "Elektrische Leistung $P$, Spannung $U$, Stromstärke $I$."),
    { U: 1, I: 1 },
    { U: 12, I: 3 },
  ),
  formula(
    "triangle",
    tx("Triangle", "Dreieck"),
    sym("A"),
    mul(half(), sym("g"), sym("h")),
    tx("Area $A$ of a triangle with base $g$ and height $h$.", "Flächeninhalt $A$ eines Dreiecks mit der Grundseite $g$ und der Höhe $h$."),
    { g: 2, h: 2 },
    { g: 8, h: 5 },
  ),
  formula(
    "interest",
    tx("Interest", "Zinsen"),
    sym("Z"),
    over(mul(sym("K"), sym("p"), sym("t")), num(100)),
    tx("Interest $Z$ on a capital $K$ at $p$ percent for $t$ years.", "Zinsen $Z$ für ein Kapital $K$ bei einem Zinssatz von $p$ Prozent in $t$ Jahren."),
    { K: 2, p: 2, t: 2 },
    { K: 500, p: 4, t: 3 },
  ),
  formula("circle", tx("Circle", "Kreis"), sym("U"), tight(num(2), sym("π"), sym("r")), tx("Circumference $U$ of a circle with radius $r$.", "Umfang $U$ eines Kreises mit dem Radius $r$."), {}, { r: 5 }),
  formula("disc", tx("Circle area", "Kreisfläche"), sym("A"), tight(sym("π"), sq(sym("r"))), tx("Area $A$ of a circle with radius $r$.", "Flächeninhalt $A$ eines Kreises mit dem Radius $r$."), {}, { r: 3 }),
  formula(
    "fall",
    tx("Accelerating", "Beschleunigung"),
    sym("s"),
    mul(half(), sym("a"), sq(sym("t"))),
    tx("Distance $s$ after time $t$ with constant acceleration $a$.", "Strecke $s$ nach der Zeit $t$ bei konstanter Beschleunigung $a$."),
    { a: 2, t: 3 },
    { a: 10, t: 3 },
  ),
  formula(
    "trapezoid",
    tx("Trapezoid", "Trapez"),
    sym("A"),
    mul(over(sum(sym("a"), sym("c")), num(2)), sym("h")),
    tx("Area $A$ of a trapezoid with parallel sides $a$ and $c$ and height $h$.", "Flächeninhalt $A$ eines Trapezes mit den parallelen Seiten $a$ und $c$ und der Höhe $h$."),
    { h: 3, a: 3 },
    { a: 7, c: 3, h: 4 },
  ),
  formula("work", tx("Work", "Arbeit"), sym("W"), mul(sym("F"), sym("s")), tx("Work $W$ done by a force $F$ along a distance $s$.", "Arbeit $W$, die eine Kraft $F$ längs der Strecke $s$ verrichtet."), { F: 1, s: 1 }),
  formula("ohm", tx("Ohm's law", "Ohmsches Gesetz"), sym("U"), mul(sym("R"), sym("I")), tx("Ohm's law: voltage $U$, resistance $R$, current $I$.", "Ohmsches Gesetz: Spannung $U$, Widerstand $R$, Stromstärke $I$."), { R: 1, I: 1 }),
  formula("current", tx("Current", "Stromstärke"), sym("I"), over(sym("U"), sym("R")), tx("Current $I$, voltage $U$, resistance $R$.", "Stromstärke $I$, Spannung $U$, Widerstand $R$."), { U: 1, R: 2 }),
  formula("powerTime", tx("Power", "Leistung"), sym("P"), over(sym("W"), sym("t")), tx("Power $P$: work $W$ done in a time $t$.", "Leistung $P$: Arbeit $W$, verrichtet in der Zeit $t$."), { W: 1, t: 2 }),
  formula(
    "cuboid",
    tx("Cuboid", "Quader"),
    sym("V"),
    mul(sym("a"), sym("b"), sym("c")),
    tx("Volume $V$ of a cuboid with edges $a$, $b$ and $c$.", "Volumen $V$ eines Quaders mit den Kantenlängen $a$, $b$ und $c$."),
    { a: 1, c: 1 },
  ),
  formula(
    "energy",
    tx("Potential energy", "Lageenergie"),
    sym("E"),
    mul(sym("m"), sym("g"), sym("h")),
    tx("Potential energy $E$: mass $m$, gravity $g$, height $h$.", "Lageenergie $E$: Masse $m$, Fallbeschleunigung $g$, Höhe $h$."),
    { m: 1, h: 1 },
  ),
  formula("diameter", tx("Diameter", "Durchmesser"), sym("d"), mul(num(2), sym("r")), tx("Diameter $d$ and radius $r$ of a circle.", "Durchmesser $d$ und Radius $r$ eines Kreises."), { r: 1 }),
  formula("square", tx("Square", "Quadrat"), sym("u"), mul(num(4), sym("a")), tx("Perimeter $u$ of a square with side $a$.", "Umfang $u$ eines Quadrats mit der Seitenlänge $a$."), { a: 1 }),
  formula("line", tx("Straight line", "Gerade"), sym("y"), sum(tight(sym("m"), sym("x")), sym("b")), tx("The equation of a straight line.", "Die Gleichung einer Geraden."), { b: 1, x: 2, m: 3 }),
  formula(
    "einstein",
    tx("Mass and energy", "Masse und Energie"),
    sym("E"),
    mul(sym("m"), sq(sym("c"))),
    tx("Energy $E$, mass $m$ and the speed of light $c$.", "Energie $E$, Masse $m$ und Lichtgeschwindigkeit $c$."),
    { m: 1, c: 3 },
  ),
  formula(
    "prism",
    tx("Square prism", "Quadratisches Prisma"),
    sym("V"),
    mul(sq(sym("a")), sym("h")),
    tx("Volume $V$ of a prism with a square base of side $a$ and height $h$.", "Volumen $V$ eines Prismas mit quadratischer Grundfläche (Seitenlänge $a$) und der Höhe $h$."),
    { h: 1, a: 3 },
  ),
  formula(
    "percent",
    tx("Percentages", "Prozentrechnung"),
    sym("W"),
    over(mul(sym("G"), sym("p")), num(100)),
    tx("Percentage $W$ of a base value $G$ at $p$ percent.", "Prozentwert $W$ zum Grundwert $G$ bei $p$ Prozent."),
    { G: 2, p: 2 },
  ),
  formula(
    "pyramid",
    tx("Pyramid", "Pyramide"),
    sym("V"),
    mul(over(num(1), num(3)), sym("G"), sym("h")),
    tx("Volume $V$ of a pyramid with base area $G$ and height $h$.", "Volumen $V$ einer Pyramide mit der Grundfläche $G$ und der Höhe $h$."),
    { G: 2, h: 2 },
  ),
  formula(
    "fahrenheit",
    tx("Fahrenheit", "Celsius in Fahrenheit"),
    sym("F"),
    sum(mul(num("1,8"), sym("C")), num(32)),
    tx("Turns degrees Celsius $C$ into degrees Fahrenheit $F$.", "Rechnet Grad Celsius $C$ in Grad Fahrenheit $F$ um."),
    { C: 2 },
  ),
  formula(
    "kinetic",
    tx("Kinetic energy", "Bewegungsenergie"),
    sym("E"),
    mul(half(), sym("m"), sq(sym("v"))),
    tx("Kinetic energy $E$ of a mass $m$ moving at speed $v$.", "Bewegungsenergie $E$ einer Masse $m$, die sich mit der Geschwindigkeit $v$ bewegt."),
    { m: 2, v: 3 },
  ),
  formula(
    "centripetal",
    tx("Centripetal force", "Zentripetalkraft"),
    sym("F"),
    over(mul(sym("m"), sq(sym("v"))), sym("r")),
    tx(
      "Force $F$ that keeps a mass $m$ on a circle of radius $r$ at speed $v$.",
      "Kraft $F$, die eine Masse $m$ mit der Geschwindigkeit $v$ auf einer Kreisbahn mit dem Radius $r$ hält.",
    ),
    { m: 2, r: 2, v: 3 },
  ),
  formula(
    "pythagoras",
    tx("Pythagoras", "Satz des Pythagoras"),
    sq(sym("c")),
    sum(sq(sym("a")), sq(sym("b"))),
    tx("Pythagoras: legs $a$ and $b$, hypotenuse $c$.", "Satz des Pythagoras: Katheten $a$ und $b$, Hypotenuse $c$."),
    { a: 3, b: 3 },
  ),
  formula(
    "drop",
    tx("Falling speed", "Fallgeschwindigkeit"),
    sym("v"),
    root(tight(num(2), sym("g"), sym("h"))),
    tx("Speed $v$ after falling a height $h$ ($g$ is gravity).", "Geschwindigkeit $v$ nach einem Fall aus der Höhe $h$ ($g$ ist die Fallbeschleunigung)."),
    { h: 3, g: 3 },
  ),
  formula(
    "perimeter2",
    tx("Perimeter", "Umfang"),
    sym("u"),
    mul(num(2), sum(sym("a"), sym("b"))),
    tx("Perimeter $u$ of a rectangle, written with a bracket.", "Umfang $u$ eines Rechtecks, mit Klammer geschrieben."),
    { a: 3 },
  ),
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
      <MathView src={props.src as Text} size="xl" animate={false} className="relative" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typical mistakes. Blob rearranges the formula the way a student with one
// particular misconception would (a term moved without changing its sign, only
// one summand divided, the root forgotten…), so the wrong formula is exactly what
// that student types, and Blob can say what happened.

type Kind = "sum" | "unfrac" | "div" | "mul" | "root" | "square";
type Trace = { kind: Kind; T: N; O: N; s: Step };
/** What a slip does to one step: the other side afterwards (and the letter's side, if that changes too). */
type Twist = (tr: Trace) => { t?: N; o: N } | null;

/** The kind of undo step `plan` takes for this side (same branches as `plan`). */
function kindOf(T: N): Kind {
  if (T.t === "sum") return "sum";
  if (T.t === "prod") return T.items.some((f) => f.t === "frac" && f.den.t === "num") ? "unfrac" : "div";
  if (T.t === "frac") return "mul";
  return T.t === "pow" ? "root" : "square";
}

/** Rearrange without frames. `twist` may change step `at` (the steps before it are the correct ones). */
function solveTo(L0: N, R0: N, target: string, at = -1, twist?: Twist): { answer: N; steps: Trace[]; twisted: boolean } {
  let L = L0;
  let R = R0;
  const steps: Trace[] = [];
  let twisted = false;
  for (let guard = 0; guard < 10; guard++) {
    const left = has(L, target);
    const T = left ? L : R;
    const O = left ? R : L;
    if (T.t === "sym") break;
    const s = plan(T, O, target, steps.length + 1);
    const tr: Trace = { kind: kindOf(T), T, O, s };
    const changed = steps.length === at && twist ? twist(tr) : null;
    steps.push(tr);
    if (changed) twisted = true;
    const t = changed?.t ?? s.t;
    const o = changed?.o ?? s.o;
    if (left) [L, R] = [t, o];
    else [L, R] = [o, t];
  }
  return { answer: has(L, target) ? R : L, steps, twisted };
}

/** What a divide step divides by (same as `plan`). */
function divisor(T: Extract<N, { t: "prod" }>, target: string): N {
  const others = T.items.filter((f) => !has(f, target));
  return others.length === 1 ? others[0] : { t: "prod", id: "", items: others, tight: T.tight };
}

/** The fraction with a number underneath that an "unfrac" step multiplies away (½ in ½gh). */
const numberFraction = (T: N) => (T.t === "prod" ? (T.items.find((f) => f.t === "frac" && f.den.t === "num") as Extract<N, { t: "frac" }> | undefined) : undefined);

/** The factor a multiply/divide step uses, or null when the step isn't one (or has the letter inside). */
function factorOf(tr: Trace, target: string): N | null {
  const { T } = tr;
  if (tr.kind === "div" && T.t === "prod") return divisor(T, target);
  if (tr.kind === "mul" && T.t === "frac" && !has(T.den, target)) return T.den;
  if (tr.kind === "unfrac") return numberFraction(T)?.den ?? null;
  return null;
}

/**
 * "Undo in the wrong order": the student treats a(x − b) as ax − b, (x + b)/a as x/a + b, (x + b)² as
 * x² + b, so the summand inside the bracket comes off first. Returns that misread formula.
 */
function flatten(node: N, target: string): { node: N; rest: SumItem[]; where: "bracket" | "fraction" } | null {
  const inside = (child: N, where: "bracket" | "fraction") => {
    if (child.t === "sum") {
      const mine = child.items.find((it) => has(it.n, target));
      if (!mine || mine.neg) return null;
      return { node: mine.n, rest: child.items.filter((it) => it !== mine), where };
    }
    return flatten(child, target);
  };
  if (node.t === "prod") {
    const i = node.items.findIndex((f) => has(f, target));
    const got = inside(node.items[i], "bracket");
    return got && { ...got, node: { ...node, items: node.items.map((f, j) => (j === i ? got.node : f)) } };
  }
  if (node.t === "frac" && has(node.num, target)) {
    const got = inside(node.num, "fraction");
    return got && { ...got, node: { ...node, num: got.node } };
  }
  if (node.t === "pow") {
    const got = inside(node.base, "bracket");
    return got && { ...got, node: { ...node, base: got.node } };
  }
  return null;
}

const show = (x: N) => src(x, false);
const signedItem = (it: SumItem) => `${it.neg ? "-" : "+"} ${show(it.n)}`;
/** A sum item on its own, with the minus only if it has one: "u", "2b", "-32". */
const bare = (it: SumItem) => `${it.neg ? "-" : ""}${show(it.n)}`;
const paren = (x: N) => (needsBrackets(x) ? `(${show(x)})` : show(x));

/** A typical wrong formula: what a student with one misconception gets. `typing`: right idea, brackets missing when typed. */
type Slip = { node: N; title: Text; say: Text; close: boolean; typing: boolean };

function formulaMistakes(L0: N, R0: N, target: string, right: N): Mistake[] {
  return formulaSlips(L0, R0, target, right).map((s) => ({ when: { kind: "expr", value: plain(s.node), positive: true }, title: s.title, say: s.say, close: s.close }));
}

function formulaSlips(L0: N, R0: N, target: string, right: N): Slip[] {
  const base = solveTo(L0, R0, target);
  const steps = base.steps;
  if (!steps.length) return [];
  const rightSrc = plain(right);
  const out: Slip[] = [];
  const BRACKETS = tx("Brackets missing", "Klammern fehlen");
  /** `close`: a near miss (right idea, one small slip), so Blob looks thoughtful and doesn't reveal the solution yet. */
  const push = (answer: N | null, title: Text, say: Text, close = false) => {
    if (!answer || out.length >= 5 || has(answer, target)) return;
    const value = plain(answer);
    // Must be defined for the positive test values, and different from the answer and from the other slips.
    if (!equivalentText(value, value, { positive: true }) || equivalentText(value, rightSrc, { positive: true })) return;
    if (out.some((m) => equivalentText(plain(m.node), value, { positive: true }))) return;
    out.push({ node: answer, title, say, close, typing: title === BRACKETS });
  };
  const find = (pred: (tr: Trace) => boolean, last = false) => (last ? steps.findLastIndex(pred) : steps.findIndex(pred));
  /** The answer with step `i` done the way `twist` says. */
  const wrong = (i: number, twist: Twist) => {
    if (i < 0) return null;
    const run = solveTo(L0, R0, target, i, twist);
    return run.twisted ? run.answer : null;
  };
  const first = steps[0].s.short;

  // Undone in the wrong order: the summand inside the bracket came off first.
  const leftSide = has(L0, target);
  const flat = flatten(leftSide ? L0 : R0, target);
  if (flat && flat.rest.length) {
    const misread: N = { t: "sum", id: "", items: [{ neg: false, n: flat.node, sid: "" }, ...flat.rest] };
    const where = flat.where === "bracket" ? tx("inside the bracket", "in der Klammer") : tx("on top of the fraction bar", "über dem Bruchstrich");
    const inner = signedItem(flat.rest[0]);
    push(
      (leftSide ? solveTo(misread, R0, target) : solveTo(L0, misread, target)).answer,
      tx("Wrong order", "Falsche Reihenfolge"),
      txMap(
        (t, locale) =>
          t(
            `I think I know what you did: you undid the $${inner}$ first. But it sits ${resolveText(where, locale)}, so it comes off **last**: first ${resolveText(first, locale)}.`,
            `Ich glaub, ich weiß, was du gemacht hast: Du hast zuerst das $${inner}$ rückgängig gemacht. Das steht aber ${resolveText(where, locale)}, kommt also erst **zum Schluss** weg: Zuerst musst du ${resolveText(first, locale)}.`,
          ),
      ),
    );
  }

  // A term moved to the other side without changing its sign.
  const sumAt = find((tr) => tr.kind === "sum" && tr.T.t === "sum" && !tr.T.items.find((it) => has(it.n, target))?.neg);
  const pickOf = (T: N) => (T.t === "sum" ? T.items.find((it) => !has(it.n, target)) : undefined);
  if (sumAt >= 0) {
    const pick = pickOf(steps[sumAt].T)!;
    const X = show(pick.n);
    push(
      wrong(sumAt, ({ O }) => ({ o: appendSum(O, { ...pick, sid: "" }, 0) })),
      tx("Sign didn't change", "Vorzeichen nicht gewechselt"),
      tx(
        `Ah, I see what happened! The $${signedItem(pick)}$ went over to the other side but kept its sign. To get rid of it, ${pick.neg ? "add" : "subtract"} $${X}$ on **both** sides.`,
        `Ah, ich seh, was passiert ist! Das $${signedItem(pick)}$ ist auf die andere Seite gewandert, hat aber sein Vorzeichen behalten. Um es loszuwerden, ${pick.neg ? "addierst" : "subtrahierst"} du auf **beiden** Seiten $${X}$.`,
      ),
    );
  }

  // Multiplying or dividing a sum: only one summand got it.
  const spreadAt = find((tr) => tr.kind !== "sum" && tr.O.t === "sum" && factorOf(tr, target) !== null);
  const spread = (which: "first" | "last") => (tr: Trace) => {
    const F = factorOf(tr, target)!;
    if (tr.O.t !== "sum") return null;
    const k = which === "first" ? 0 : tr.O.items.length - 1;
    const apply = (n: N) => (tr.kind === "div" ? divideBy(n, F, 0) : multiplyBy(n, F, 0));
    return { o: { ...tr.O, items: tr.O.items.map((it, j) => (j === k ? { ...it, n: apply(it.n) } : it)) } };
  };
  if (spreadAt >= 0) {
    const tr = steps[spreadAt];
    const F = show(factorOf(tr, target)!);
    const items = (tr.O as Extract<N, { t: "sum" }>).items;
    const div = tr.kind === "div";
    push(
      wrong(spreadAt, spread("first")),
      div ? tx("Not every term divided", "Nicht jeden Summanden geteilt") : tx("Not every term multiplied", "Nicht jeden Summanden multipliziert"),
      div
        ? tx(
            `Ah, I see what happened! Only $${bare(items[0])}$ got divided by $${F}$, but $${show(items[1].n)}$ has to be divided too. Put the whole side over one fraction bar.`,
            `Ah, ich seh, was passiert ist! Nur $${bare(items[0])}$ wurde durch $${F}$ geteilt, aber $${show(items[1].n)}$ muss auch geteilt werden. Schreib die ganze Seite über einen Bruchstrich.`,
          )
        : tx(
            `Ah, I see what happened! Only $${bare(items[0])}$ got multiplied by $${F}$, but $${show(items[1].n)}$ has to be multiplied too. Put the whole side in brackets.`,
            `Ah, ich seh, was passiert ist! Nur $${bare(items[0])}$ wurde mit $${F}$ multipliziert, aber $${show(items[1].n)}$ muss auch mit. Setz die ganze Seite in Klammern.`,
          ),
    );
  }

  // The square root forgotten, or the root never undone.
  const rootAt = find((tr) => tr.kind === "root");
  const squareAt = find((tr) => tr.kind === "square");
  if (rootAt >= 0) {
    const b = steps[rootAt].T.t === "pow" ? paren((steps[rootAt].T as Extract<N, { t: "pow" }>).base) : "";
    push(
      wrong(rootAt, ({ O }) => ({ o: O })),
      tx("Square root missing", "Wurzel vergessen"),
      tx(
        `So close! But $${b}$ is squared, and that square never got undone. You still need a **square root**.`,
        `Ganz knapp! Aber $${b}$ ist quadriert, und das Quadrat hast du nicht rückgängig gemacht. Es fehlt noch eine **Wurzel**.`,
      ),
      true,
    );
  }
  if (squareAt >= 0) {
    const T = steps[squareAt].T;
    const body = T.t === "sqrt" ? show(T.body) : "";
    push(
      wrong(squareAt, ({ O }) => ({ o: O })),
      tx("Root not undone", "Wurzel nicht aufgelöst"),
      tx(
        `Almost! $${body}$ sits under a square root, and that root never got undone. Square **both** sides first.`,
        `Fast! $${body}$ steht unter einer Wurzel, und die hast du nicht rückgängig gemacht. Quadriere zuerst **beide** Seiten.`,
      ),
      true,
    );
  }
  // √(c² − b²) taken as c − b.
  if (rootAt >= 0 && steps[rootAt].O.t === "sum") {
    const minus = (steps[rootAt].O as Extract<N, { t: "sum" }>).items.some((it) => it.neg);
    const ex = minus ? ["\\sqrt{25 - 9} = 4", "\\sqrt{25} - \\sqrt{9} = 2"] : ["\\sqrt{9 + 16} = 5", "\\sqrt{9} + \\sqrt{16} = 7"];
    push(
      wrong(rootAt, ({ O }) => (O.t === "sum" ? { o: { ...O, items: O.items.map((it) => ({ ...it, n: { t: "sqrt", id: "", body: it.n } })) } } : null)),
      tx("Root split up", "Wurzel aufgeteilt"),
      tx(
        `Ooh, classic trap! A root doesn't split over plus or minus: $${ex[0]}$, but $${ex[1]}$. Keep the whole side under one root.`,
        `Die klassische Falle! Eine Wurzel darfst du nicht über Plus oder Minus aufteilen: $${ex[0]}$, aber $${ex[1]}$. Lass die ganze Seite unter einer Wurzel.`,
      ),
    );
  }

  // The wrong opposite: multiplied instead of divided, or the other way round.
  const inverseAt = find((tr) => factorOf(tr, target) !== null);
  if (inverseAt >= 0) {
    const tr = steps[inverseAt];
    const F = factorOf(tr, target)!;
    const f = show(F);
    const answer = wrong(inverseAt, ({ O }) => ({ o: tr.kind === "div" ? multiplyBy(O, F, 0) : divideBy(O, F, 0) }));
    if (tr.kind === "div" && tr.T.t === "prod") {
      const kept = paren(tr.T.items.find((x) => has(x, target))!);
      push(
        answer,
        tx("Multiplied instead of divided", "Multipliziert statt geteilt"),
        tx(
          `Ah, I see what happened! $${kept}$ is **multiplied** by $${f}$, so you undo that by **dividing**, not by multiplying again.`,
          `Ah, ich seh, was passiert ist! $${kept}$ wird mit $${f}$ **multipliziert**. Das machst du mit **Teilen** rückgängig, nicht mit noch mal Multiplizieren.`,
        ),
      );
    } else if (tr.kind === "mul" && tr.T.t === "frac") {
      const top = tr.T.num.t === "sum" ? paren(tr.T.num) : show(tr.T.num);
      push(
        answer,
        tx("Divided instead of multiplied", "Geteilt statt multipliziert"),
        tx(
          `Ah, I see what happened! $${top}$ is **divided** by $${f}$, so you undo that by **multiplying**, not by dividing again.`,
          `Ah, ich seh, was passiert ist! $${top}$ wird durch $${f}$ **geteilt**. Das machst du mit **Multiplizieren** rückgängig, nicht mit noch mal Teilen.`,
        ),
      );
    } else {
      const fr = show(numberFraction(tr.T)!);
      push(
        answer,
        tx("Divided instead of multiplied", "Geteilt statt multipliziert"),
        tx(
          `Ah, the fraction! $${fr}$ means **divided by** $${f}$, so you undo it by **multiplying** by $${f}$, not by dividing.`,
          `Ah, der Bruch! $${fr}$ heißt **geteilt durch** $${f}$. Das machst du mit **Multiplizieren** mit $${f}$ rückgängig, nicht mit Teilen.`,
        ),
      );
    }
  }

  // A number in a denominator (½, : 100) simply lost.
  const lostAt = find((tr) => tr.kind === "unfrac" || (tr.kind === "mul" && tr.T.t === "frac" && tr.T.den.t === "num"));
  if (lostAt >= 0) {
    const tr = steps[lostAt];
    const M = show(factorOf(tr, target)!);
    const without = (T: N): N | null => {
      if (T.t === "frac") return T.num;
      if (T.t !== "prod") return null;
      const fr = numberFraction(T)!;
      const items = T.items.flatMap((f) => (f !== fr ? [f] : fr.num.t === "num" && fr.num.v === "1" ? [] : [fr.num]));
      return items.length === 1 ? items[0] : { ...T, items };
    };
    push(
      wrong(lostAt, ({ T, O }) => {
        const t = without(T);
        return t && { t, o: O };
      }),
      tx("A number got lost", "Eine Zahl ist verloren gegangen"),
      tx(
        `Where did the $${M}$ in the denominator go? It belongs to the formula too: undo it by multiplying both sides by $${M}$.`,
        `Wo ist die $${M}$ im Nenner geblieben? Die gehört auch zur Formel: Mach sie rückgängig, indem du beide Seiten mit $${M}$ multiplizierst.`,
      ),
    );
  }

  // Typed without brackets around the denominator: 100Z/Kt reads as (100Z/K)·t.
  const divAt = find((tr) => tr.kind === "div", true);
  if (divAt >= 0) {
    const tr = steps[divAt];
    const D = factorOf(tr, target)!;
    if (tr.O.t !== "sum" && (D.t === "sum" || (D.t === "prod" && D.items.length > 1))) {
      const head = D.t === "sum" ? D.items[0].n : (D as Extract<N, { t: "prod" }>).items[0];
      push(
        wrong(divAt, ({ O }) => {
          const over: N = { t: "frac", id: "", num: O, den: head };
          if (D.t === "sum") return { o: { t: "sum", id: "", items: [{ neg: false, n: over, sid: "" }, ...D.items.slice(1)] } };
          return { o: { t: "prod", id: "", items: [over, ...(D as Extract<N, { t: "prod" }>).items.slice(1)] } };
        }),
        BRACKETS,
        tx(
          `I think you meant the right thing, but brackets are missing: typed like that, only $${show(head)}$ is under the fraction bar. Put the whole denominator in brackets.`,
          `Ich glaub, du meinst das Richtige, aber es fehlen Klammern: So getippt steht nur $${show(head)}$ unter dem Bruchstrich. Setz den ganzen Nenner in Klammern.`,
        ),
        true,
      );
    }
    // Divided the wrong way round: D/O instead of O/D.
    const d = show(D);
    push(
      wrong(divAt, ({ O }) => ({ o: { t: "frac", id: "", num: D, den: O } })),
      tx("Fraction upside down", "Bruch auf dem Kopf"),
      tx(
        `Upside down! When you divide by $${d}$, the $${d}$ goes **under** the fraction bar, not on top.`,
        `Andersrum! Wenn du durch $${d}$ teilst, kommt $${d}$ **unter** den Bruchstrich, nicht darüber.`,
      ),
    );
  }

  // Typed without brackets around a sum: u − 2b/2 only divides the 2b.
  if (spreadAt >= 0) {
    const tr = steps[spreadAt];
    const F = show(factorOf(tr, target)!);
    const items = (tr.O as Extract<N, { t: "sum" }>).items;
    const lastX = show(items[items.length - 1].n);
    push(
      wrong(spreadAt, spread("last")),
      BRACKETS,
      tr.kind === "div"
        ? tx(
            `I think you meant the right thing, but brackets are missing: typed like that, only $${lastX}$ gets divided by $${F}$. Put $${show(tr.O)}$ in brackets.`,
            `Ich glaub, du meinst das Richtige, aber es fehlen Klammern: So getippt wird nur $${lastX}$ durch $${F}$ geteilt. Setz $${show(tr.O)}$ in Klammern.`,
          )
        : tx(
            `I think you meant the right thing, but brackets are missing: typed like that, only $${lastX}$ gets multiplied by $${F}$. Put $${show(tr.O)}$ in brackets.`,
            `Ich glaub, du meinst das Richtige, aber es fehlen Klammern: So getippt wird nur $${lastX}$ mit $${F}$ multipliziert. Setz $${show(tr.O)}$ in Klammern.`,
          ),
      true,
    );
  }

  // Changed only one side.
  const oneAt = find((tr) => (tr.kind === "sum" && tr === steps[sumAt]) || tr.kind === "div" || (tr.kind === "mul" && tr.T.t === "frac" && tr.T.den.t !== "num" && !has(tr.T.den, target)));
  if (oneAt >= 0) {
    const tr = steps[oneAt];
    const answer = wrong(oneAt, ({ O }) => ({ o: O }));
    if (tr.kind === "sum") {
      push(
        answer,
        tx("Only one side changed", "Nur eine Seite verändert"),
        tx(
          `You made the $${signedItem(pickOf(tr.T)!)}$ disappear on one side, but the other side didn't change. Whatever you do, do it on **both** sides.`,
          `Du hast das $${signedItem(pickOf(tr.T)!)}$ auf einer Seite verschwinden lassen, aber die andere Seite ist gleich geblieben. Was du machst, machst du auf **beiden** Seiten.`,
        ),
      );
    } else {
      const f = show(factorOf(tr, target)!);
      push(
        answer,
        tr.kind === "div" ? tx("Only one side divided", "Nur eine Seite geteilt") : tx("Only one side multiplied", "Nur eine Seite multipliziert"),
        tr.kind === "div"
          ? tx(
              `You got rid of the $${f}$ on one side, but the other side didn't change. Divide it by $${f}$ too: **both** sides always get the same step.`,
              `Du hast $${f}$ auf einer Seite weggemacht, aber die andere Seite ist gleich geblieben. Teile sie auch durch $${f}$: **Beide** Seiten bekommen immer denselben Schritt.`,
            )
          : tx(
              `You got rid of the $${f}$ in the denominator on one side, but the other side didn't change. Multiply it by $${f}$ too: **both** sides always get the same step.`,
              `Du hast $${f}$ im Nenner auf einer Seite weggemacht, aber die andere Seite ist gleich geblieben. Multipliziere sie auch mit $${f}$: **Beide** Seiten bekommen immer denselben Schritt.`,
            ),
      );
    }
  }

  // Squared instead of taking the root, or the other way round.
  push(
    wrong(rootAt, ({ O }) => ({ o: { t: "pow", id: "", base: O, e: 2 } })),
    tx("Squared instead of root", "Quadriert statt Wurzel gezogen"),
    tx("To undo a square you take the **square root**. Squaring again goes the wrong way.", "Ein Quadrat machst du mit der **Wurzel** rückgängig. Noch mal quadrieren geht in die falsche Richtung."),
  );
  push(
    wrong(squareAt, ({ O }) => ({ o: { t: "sqrt", id: "", body: O } })),
    tx("Root instead of squaring", "Wurzel statt Quadrieren"),
    tx("A square root is undone by **squaring**. Another root goes the wrong way.", "Eine Wurzel machst du mit **Quadrieren** rückgängig. Noch eine Wurzel geht in die falsche Richtung."),
  );
  return out;
}

/** English shows decimal points: the Fahrenheit formula's 1,8 becomes 1.8 there. */
function localise(ex: Exercise): Exercise {
  return {
    ...ex,
    text: ex.text === undefined ? undefined : enDecimals(ex.text),
    hint: ex.hint === undefined ? undefined : enDecimals(ex.hint),
    solution: enDecimalFrames(ex.solution),
    mistakes: ex.mistakes?.map((m) => ({ ...m, say: enDecimals(m.say) })),
    visual: ex.visual && { ...ex.visual, props: { ...ex.visual.props, src: enDecimals(ex.visual.props.src as Text) } },
  };
}

function task(f: Formula, target: string): Exercise {
  const sol = rearrange(f.L, f.R, target);
  return localise({
    instruction: tx("Rearrange the formula", "Stelle die Formel um"),
    text: txMap((t, locale) => {
      const legend = resolveText(f.legend, locale);
      const ask = t(`Solve for $${target}$.`, `Stelle nach $${target}$ um.`);
      return legend ? `${legend} ${ask}` : ask;
    }),
    answer: { kind: "expr", value: plain(sol.answer), prefix: `${target} =`, positive: true },
    hint: sol.hint,
    solution: sol.frames,
    visual: { component: FormulaCard, props: { src: formulaSrc(f, target) } },
    mistakes: formulaMistakes(f.L, f.R, target, sol.answer),
  });
}

const POOLS: Record<Level, [string, string][]> = { 1: [], 2: [], 3: [] };
for (const f of FORMULAS) for (const [letter, level] of Object.entries(f.targets)) POOLS[level].push([f.key, letter]);

/** Letters and numbers, as in "Stelle nach x um": y = 3x + 5, y = 4(x - 2), y = 12/x + 1 … */
function algebraFormula(level: Level, rng: Rng): [Formula, string] {
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
  return [formula("algebra", "", sym(y), rng.pick(shapes[level])(), "", { [x]: level }), x];
}

function algebra(level: Level, rng: Rng): Exercise {
  const [f, x] = algebraFormula(level, rng);
  return { ...task(f, x), text: tx(`Solve $${formulaSrc(f)}$ for $${x}$.`, `Stelle $${formulaSrc(f)}$ nach $${x}$ um.`) };
}

/** The practice of the one-lesson topic: three tiers from one-step formulas to roots and brackets. */
function tier(level: Level, rng: Rng): Exercise {
  if (rng.chance(0.4)) return algebra(level, rng);
  const [key, letter] = rng.pick(POOLS[level]);
  return task(byKey(key), letter);
}

/** A formula and a letter for the new task shapes: mostly two or more steps, sometimes plain algebra. */
function pickFormula(rng: Rng): [Formula, string] {
  if (rng.chance(0.25)) return algebraFormula(rng.chance(0.5) ? 2 : 3, rng);
  const [key, letter] = rng.pick([...POOLS[2], ...POOLS[3]]);
  return [byKey(key), letter];
}

/** "Solve for $t$." or, for plain algebra, "Solve $y = 3x + 5$ for $x$." */
const askText = (f: Formula, target: string, en: string, de: string): Text =>
  txMap((t, locale) => {
    const legend = resolveText(f.legend, locale);
    return legend ? `${legend} ${t(en, de)}` : t(`$${formulaSrc(f)}$. ${en}`, `$${formulaSrc(f)}$. ${de}`);
  });

// ---------------------------------------------------------------------------
// Which rearrangement is correct? The wrong options are the typical slips.

function choiceTask(rng: Rng): Exercise | null {
  const [f, target] = pickFormula(rng);
  const sol = rearrange(f.L, f.R, target);
  const slips = formulaSlips(f.L, f.R, target, sol.answer).filter((s) => !s.typing);
  if (slips.length < 2) return null;
  const line = (n: N) => enDecimals(`$${target} = ${src(n, false)}$`);
  const c = choice(rng, [{ text: line(sol.answer) }, ...rng.shuffle(slips).slice(0, 3).map((s) => ({ text: line(s.node), title: s.title, say: s.say }))]);
  return localise({
    instruction: tx("Which rearrangement is right?", "Welche Umstellung stimmt?"),
    text: askText(f, target, `Which formula for $${target}$ is right?`, `Welche Formel für $${target}$ stimmt?`),
    answer: c.answer,
    hint: sol.hint,
    solution: sol.frames,
    visual: { component: FormulaCard, props: { src: formulaSrc(f, target) } },
    mistakes: c.mistakes,
  });
}

// ---------------------------------------------------------------------------
// Rearrange and calculate: values that fit together, and the units of every letter.

type Values = Record<string, number>;
const YEARS = tx("years", "Jahre");

const NUMERIC: Record<string, { units: Record<string, Text>; pick: (r: Rng) => Values }> = {
  rect: { units: { A: "cm²", a: "cm", b: "cm" }, pick: (r) => ({ a: r.int(3, 15), b: r.int(2, 12) }) },
  perimeter: { units: { u: "cm", a: "cm", b: "cm" }, pick: (r) => ({ a: r.int(3, 20), b: r.int(2, 15) }) },
  speed: { units: { v: "km/h", s: "km", t: "h" }, pick: (r) => ({ s: r.pick([1.5, 2, 2.5, 3, 4, 5]) * r.pick([20, 30, 40, 50, 60, 70, 80, 90, 100, 120]), t: r.pick([1.5, 2, 2.5, 3, 4, 5]) }) },
  force: { units: { F: "N", m: "kg", a: "m/s²" }, pick: (r) => ({ m: r.int(2, 40), a: r.int(2, 9) }) },
  power: { units: { P: "W", U: "V", I: "A" }, pick: (r) => ({ U: r.pick([6, 9, 12, 24, 230]), I: r.pick([0.5, 1, 2, 3, 4, 5, 6, 8, 10]) }) },
  triangle: { units: { A: "cm²", g: "cm", h: "cm" }, pick: (r) => ({ g: 2 * r.int(2, 9), h: r.int(2, 14) }) },
  interest: { units: { Z: "€", K: "€", p: "%", t: YEARS }, pick: (r) => ({ K: r.pick([200, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 4000, 5000]), p: r.pick([1, 2, 3, 4, 5, 1.5, 2.5]), t: r.int(2, 6) }) },
  trapezoid: { units: { A: "cm²", a: "cm", c: "cm", h: "cm" }, pick: (r) => ({ a: r.int(6, 14), c: r.int(2, 5), h: 2 * r.int(2, 6) }) },
  work: { units: { W: "J", F: "N", s: "m" }, pick: (r) => ({ F: r.pick([10, 20, 25, 40, 50, 80, 100, 150]), s: r.int(2, 12) }) },
  ohm: { units: { U: "V", R: "Ω", I: "A" }, pick: (r) => ({ R: r.pick([2, 4, 5, 10, 20, 50, 100]), I: r.pick([0.5, 1, 2, 3, 4, 5]) }) },
  powerTime: { units: { P: "W", W: "J", t: "s" }, pick: (r) => ({ W: r.pick([20, 40, 50, 60, 100, 500, 1000]) * r.int(2, 10), t: r.int(2, 10) }) },
  cuboid: { units: { V: "cm³", a: "cm", b: "cm", c: "cm" }, pick: (r) => ({ a: r.int(2, 9), b: r.int(2, 9), c: r.int(2, 9) }) },
  kinetic: { units: { E: "J", m: "kg", v: "m/s" }, pick: (r) => ({ m: r.pick([2, 4, 6, 8, 10, 20, 50, 60, 80]), v: r.int(2, 10) }) },
  pyramid: { units: { V: "cm³", G: "cm²", h: "cm" }, pick: (r) => ({ G: 3 * r.int(3, 20), h: r.int(2, 12) }) },
  percent: { units: { W: "€", G: "€", p: "%" }, pick: (r) => ({ G: r.pick([40, 50, 60, 80, 120, 150, 200, 250, 300, 400, 500, 600, 800]), p: r.pick([5, 10, 15, 20, 25, 30, 40, 50, 75]) }) },
  fahrenheit: { units: { F: "°F", C: "°C" }, pick: (r) => ({ C: 5 * r.int(0, 8) }) },
  pythagoras: {
    units: { a: "cm", b: "cm", c: "cm" },
    pick: (r) => {
      const [a, b, c] = r.pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20], [7, 24, 25], [15, 20, 25]]);
      return r.chance(0.5) ? { a, b, c } : { a: b, b: a, c };
    },
  },
  fall: { units: { s: "m", a: "m/s²", t: "s" }, pick: (r) => ({ a: r.pick([2, 4, 6, 8, 10]), t: r.int(2, 6) }) },
  centripetal: { units: { F: "N", m: "kg", v: "m/s", r: "m" }, pick: (r) => ({ m: r.int(1, 8), v: r.pick([2, 4, 6, 8, 10]), r: r.pick([2, 4]) }) },
  prism: { units: { V: "cm³", a: "cm", h: "cm" }, pick: (r) => ({ a: r.int(2, 8), h: r.int(2, 12) }) },
};

/** Every letter of a formula with a value: the picked inputs plus the subject worked out. */
function valuesFor(f: Formula, r: Rng): Values | null {
  const vals = NUMERIC[f.key].pick(r);
  if (f.L.t === "sym") vals[f.L.s] = clean(evaluate(f.R, vals));
  const ok = Math.abs(evaluate(f.L, vals) - evaluate(f.R, vals)) < 1e-6 && Object.values(vals).every((v) => Number.isFinite(v) && v >= 0 && Math.abs(v * 100 - Math.round(v * 100)) < 1e-6);
  return ok ? vals : null;
}

/** A number with its unit in the display language: 20 "cm²", 37,50 "€". */
function amountSrc(v: number, unit: Text | undefined, l: "en" | "de") {
  const u = resolveText(unit, l);
  const n = u === "€" && !Number.isInteger(v) ? v.toFixed(2).replace(".", l === "de" ? "," : ".") : dec(v, l);
  return u ? `${n} "${u}"` : n;
}

/** The formula with numbers put in, keeping the keys, so letters turn into numbers on the board. */
function withValues(node: N, vals: Values, l: "en" | "de"): N {
  switch (node.t) {
    case "sym":
      return node.s === "π" || vals[node.s] === undefined ? node : { t: "num", v: dec(vals[node.s], l), id: node.id };
    case "num":
      return { ...node, v: l === "en" ? node.v.replace(",", ".") : node.v };
    case "sum":
      return { ...node, items: node.items.map((it) => ({ ...it, n: withValues(it.n, vals, l) })) };
    case "prod":
      return { ...node, tight: false, items: node.items.map((f) => withValues(f, vals, l)) };
    case "frac":
      return { ...node, num: withValues(node.num, vals, l), den: withValues(node.den, vals, l) };
    case "pow":
      return { ...node, base: withValues(node.base, vals, l) };
    case "sqrt":
      return { ...node, body: withValues(node.body, vals, l) };
  }
}

function numberTask(rng: Rng): Exercise | null {
  const key = rng.pick(Object.keys(NUMERIC));
  const f = byKey(key);
  const target = rng.pick(Object.keys(f.targets));
  const vals = valuesFor(f, rng);
  if (!vals) return null;
  const { units } = NUMERIC[key];
  const answer = vals[target];
  const sol = rearrange(f.L, f.R, target);
  const given = Object.keys(vals)
    .filter((k) => k !== target)
    .sort((x, y) => Number(f.L.t === "sym" && y === f.L.s) - Number(f.L.t === "sym" && x === f.L.s));
  const givenText = (l: "en" | "de") => given.map((k) => `$${k} = ${amountSrc(vals[k], units[k], l)}$`).join(", ");
  // Letters on the board turn into numbers: same keys as the solved formula.
  const subject = sol.L.t === "sym" ? sol.L : null;
  if (!subject) return null;
  const head = `\\blob{${target}#${subject.id}} =#eq`;
  const unitOf = (l: "en" | "de") => resolveText(units[target], l);
  const right: Extract<AnswerSpec, { kind: "number" }> = { kind: "number", value: answer, unit: units[target], label: `${target} =` };
  const frames: Frame[] = [
    ...sol.frames,
    {
      math: txMap((_, l) => `${head} ${src(withValues(sol.R, vals, l), true)}`),
      note: tx("Now put in the values you know.", "Jetzt setzt du die bekannten Werte ein."),
    },
    {
      math: txMap((_, l) => `${head} ${amountSrc(answer, units[target], l).replace(/^(\S+)/, "$1#res").replace(/"$/, '"#unit')}`),
      note: txMap((t, l) => t(`Work it out: $${target} = ${amountSrc(answer, units[target], l)}$.`, `Ausrechnen: $${target} = ${amountSrc(answer, units[target], l)}$.`)),
    },
  ];
  const slips = formulaSlips(f.L, f.R, target, sol.answer).filter((s) => !s.typing);
  const mistakes = numberMistakes(
    right,
    slips.map((s) => {
      const v = evaluate(s.node, vals);
      const whole = Math.abs(v - Math.round(v)) < 1e-9;
      return { value: v, title: s.title, say: s.say, close: s.close, tolerance: whole ? undefined : 0.01 };
    }),
  );
  return localise({
    instruction: tx("Rearrange and calculate", "Stelle um und berechne"),
    text: txMap((t, l) => {
      const legend = resolveText(f.legend, l);
      const unit = unitOf(l);
      const inUnit = typeof units[target] === "string" && unit !== "%" ? ` in ${unit}` : "";
      return `${legend} ${t("Given:", "Gegeben:")} ${givenText(l)}. ${t(`Calculate $${target}$`, `Berechne $${target}$`)}${inUnit}.`;
    }),
    answer: right,
    hint: txMap((t, l) => t(`First solve the formula for $${target}$, then put in the numbers. ${resolveText(sol.hint, l)}`, `Stell die Formel zuerst nach $${target}$ um, dann setzt du die Zahlen ein. ${resolveText(sol.hint, l)}`)),
    solution: smoothFracExits(frames),
    visual: { component: FormulaCard, props: { src: formulaSrc(f, target) } },
    mistakes,
  });
}

// ---------------------------------------------------------------------------
// Put the lines of a rearrangement in order.

/** The equation after every undo step (and the swap at the end), as display sources. */
function linesOf(L0: N, R0: N, target: string): { lines: string[]; shorts: Text[] } {
  let L = L0;
  let R = R0;
  const line = (l: N, r: N) => `${src(l, false)} = ${src(r, false)}`;
  const lines = [line(L, R)];
  const shorts: Text[] = [];
  for (let guard = 0; guard < 10; guard++) {
    const left = has(L, target);
    const T = left ? L : R;
    if (T.t === "sym") break;
    const s = plan(T, left ? R : L, target, guard + 1);
    shorts.push(s.short);
    if (left) [L, R] = [s.t, s.o];
    else [L, R] = [s.o, s.t];
    lines.push(line(L, R));
  }
  if (!has(L, target)) lines.push(line(R, L));
  return { lines, shorts };
}

function orderTask(rng: Rng): Exercise | null {
  const [f, target] = pickFormula(rng);
  const { lines, shorts } = linesOf(f.L, f.R, target);
  if (lines.length < 3 || lines.length > 5 || new Set(lines).size !== lines.length) return null;
  const items = lines.map((l) => enDecimals(`$${l}$`));
  const sol = rearrange(f.L, f.R, target);
  const mistakes: Exercise["mistakes"] = [];
  if (shorts.length >= 2) {
    mistakes.push({
      when: { kind: "order", items: [items[2], items[1]] },
      title: tx("Wrong order", "Falsche Reihenfolge"),
      say: txMap((t, l) =>
        t(
          `Ah, I see what happened! You took the second step first. Undo the last operation first: ${resolveText(shorts[0], l)}. Only then ${resolveText(shorts[1], l)}.`,
          `Ah, ich seh, was passiert ist! Du hast den zweiten Schritt zuerst gemacht. Mach zuerst die letzte Rechnung rückgängig: ${resolveText(shorts[0], l)}. Erst danach ${resolveText(shorts[1], l)}.`,
        ),
      ),
    });
  }
  return localise({
    instruction: tx("Put the lines in order", "Bring die Zeilen in die richtige Reihenfolge"),
    text: askText(f, target, `Solve for $${target}$: which line comes after which?`, `Stelle nach $${target}$ um: Welche Zeile kommt nach welcher?`),
    answer: { kind: "order", items, label: tx("From the formula to the result", "Von der Formel zum Ergebnis") },
    hint: tx("The formula itself comes first. Then undo one operation per line, the last one first.", "Die Formel selbst kommt zuerst. Dann machst du pro Zeile eine Rechnung rückgängig, die letzte zuerst."),
    solution: sol.frames,
    visual: { component: FormulaCard, props: { src: formulaSrc(f, target) } },
    mistakes,
  });
}

/**
 * Level 2 practice: the old tiers (mostly the standard and the harder one) mixed with three newer
 * shapes: pick the right rearrangement, rearrange and calculate, put the lines in order.
 */
export function generate2(rng: Rng): Exercise {
  const r = rng.next();
  for (let i = 0; i < 8; i++) {
    const ex = r < 0.2 ? choiceTask(rng) : r < 0.4 ? numberTask(rng) : r < 0.55 ? orderTask(rng) : null;
    if (ex) return ex;
    if (r >= 0.55) break;
  }
  const t = rng.next();
  return tier(t < 0.1 ? 1 : t < 0.6 ? 2 : 3, rng);
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
  const t = useText();
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
              title={t(g.name)}
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
        <span className="text-[13px] text-ink-2">{t(tx("Solve for", "Umstellen nach"))}</span>
        <div className="flex gap-1">
          {letters.map((l) => (
            <button
              key={l}
              onClick={() => setPick(l)}
              className={cn(
                "relative grid size-10 place-items-center rounded-full border font-math text-[20px] italic transition-colors",
                l === target ? "border-transparent text-white" : "border-line text-ink hover:bg-hover",
              )}
              aria-label={t(tx(`Solve for ${l}`, `Nach ${l} umstellen`))}
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
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-blob-ink">{t(tx("Check with numbers", "Probe mit Zahlen"))}</span>
          <MathView src={forward} size="md" animate={false} />
          <MathView src={backward} size="md" animate={false} />
          {matches && (
            <span className="flex items-center gap-1 text-[13px] font-medium text-ok">
              <Check className="size-4" /> {t(tx("matches", "passt"))}
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
  intro: tx(
    "We know the area $A$ and the side $a$, and want $b$. A formula is an equation with letters, so the balance rules work here too.",
    "Wir kennen den Flächeninhalt $A$ und die Seite $a$ und suchen $b$. Eine Formel ist eine Gleichung mit Buchstaben, also funktionieren hier dieselben Äquivalenzumformungen.",
  ),
}).frames;

/** v = s/t: first for s, then carry on from s = v · t to get t. */
const speedFrames = (() => {
  const forS = rearrange(speed.L, speed.R, "s", {
    maxEm: 18,
    intro: tx("Speed $v = \\frac{s}{t}$. First we want the distance $s$.", "Geschwindigkeit $v = \\frac{s}{t}$. Zuerst wollen wir die Strecke $s$."),
  });
  const forT = rearrange(forS.L, forS.R, "t", { maxEm: 18 });
  const last = forS.frames[forS.frames.length - 1];
  return smoothFracExits([
    ...forS.frames.slice(0, -1),
    {
      ...last,
      note: txMap((t, locale) => `${resolveText(last.note, locale)} ${t("Now let's get the time $t$ from $s = v \\cdot t$.", "Jetzt holen wir uns die Zeit $t$ aus $s = v \\cdot t$.")}`),
    },
    ...forT.frames.slice(1),
  ]);
})();

const perimeter = byKey("perimeter");
const reverseFrames = rearrange(perimeter.L, perimeter.R, "a", {
  maxEm: 18,
  intro: tx(
    "To get $u$ from $a$: first $\\cdot 2$, then $+ 2b$. So we undo it backwards: first $- 2b$, then $: 2$.",
    "Von $a$ zu $u$ geht es so: erst $\\cdot 2$, dann $+ 2b$. Also machen wir es in umgekehrter Reihenfolge rückgängig: erst $- 2b$, dann $: 2$.",
  ),
}).frames;

const mistakeFrames: Frame[] = [
  {
    math: "u#u -#s 2#c b#b =#eq 2#c2 a#a \\quad |#bar \\, :#o 2#on",
    note: tx("We stopped here: now divide both sides by $2$.", "Hier waren wir stehen geblieben: Jetzt teilen wir beide Seiten durch $2$."),
  },
  {
    math: "\\frac{u#u -#s 2#c b#b}{2#d}#f =#eq a#a",
    highlight: ["f-bar", "d"],
    note: tx("The **whole** left side is divided by $2$. The fraction bar works like a bracket.", "Die **ganze** linke Seite wird durch $2$ geteilt. Der Bruchstrich wirkt wie eine Klammer."),
  },
  {
    math: "\\red{\\frac{u}{2} - 2b} \\ne \\frac{u - 2b}{2}",
    note: tx("A classic mistake: dividing only $u$ by $2$ and forgetting the $2b$.", "Ein typischer Fehler: nur $u$ durch $2$ teilen und $2b$ dabei vergessen."),
  },
  {
    math: "\\frac{u - 2b}{2} = \\frac{u}{2} - \\frac{2b}{2} = \\frac{u}{2} - b",
    note: tx(
      "If you split the fraction, divide **every** term. Both $a = \\frac{u - 2b}{2}$ and $a = \\frac{u}{2} - b$ are right.",
      "Wenn du den Bruch aufteilst, teile **jeden** Summanden. $a = \\frac{u - 2b}{2}$ und $a = \\frac{u}{2} - b$ sind beide richtig.",
    ),
  },
];

const fall = byKey("fall");
const rootFrames = rearrange(fall.L, fall.R, "t", {
  maxEm: 18,
  intro: tx("Distance $s = \\frac{1}{2} a t^2$. We want the time $t$, and it's squared.", "Strecke $s = \\frac{1}{2} a t^2$. Wir suchen die Zeit $t$, und die ist quadriert."),
}).frames;

/** Level 2 (the lesson written before levels): any letter on its own, step by step, with inverse operations. */
export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Same rules as equations", "Gleiche Regeln wie bei Gleichungen"),
      body: tx(
        "Do the same to both sides until the letter you want is on its own. Then write it on the left.",
        "Rechne auf beiden Seiten dasselbe, bis der gesuchte Buchstabe allein steht. Dann schreib ihn nach links.",
      ),
      examples: ["A = a \\cdot b \\quad | \\, :a", "\\frac{A}{a} = b", "b = \\frac{A}{a}"],
      tone: "rule",
    },
    {
      title: tx("Undo with the opposite", "Umkehroperationen"),
      body: tx("Plus is undone by minus, times by divide, a square by the square root.", "Plus machst du mit Minus rückgängig, Mal mit Geteilt, ein Quadrat mit der Wurzel."),
      examples: ["v = \\frac{s}{t} \\quad | \\, \\cdot t", "v \\cdot t = s"],
      tone: "rule",
    },
    {
      title: tx("Reverse order", "Umgekehrte Reihenfolge"),
      body: tx(
        "Undo the last thing first. What happened to the letter last comes off first.",
        "Mach das Letzte zuerst rückgängig. Was zuletzt mit dem Buchstaben passiert ist, kommt zuerst weg.",
      ),
      examples: ["u = 2a + 2b \\quad | \\, -2b", "u - 2b = 2a \\quad | \\, :2", "a = \\frac{u - 2b}{2}"],
      tone: "rule",
    },
    {
      title: tx("Letter in the denominator", "Buchstabe im Nenner"),
      body: tx("Multiply it out of the fraction first. Then divide.", "Hol ihn zuerst durch Multiplizieren aus dem Bruch. Dann teilen."),
      examples: ["v = \\frac{s}{t} \\quad | \\, \\cdot t", "v \\cdot t = s \\quad | \\, :v", "t = \\frac{s}{v}"],
      tone: "tip",
    },
    {
      title: tx("Squared letter", "Quadrierter Buchstabe"),
      body: tx(
        "Take the square root at the end. Lengths, times and speeds are positive, so the positive root is the answer.",
        "Zieh am Ende die Wurzel. Längen, Zeiten und Geschwindigkeiten sind positiv, also ist die positive Wurzel die Lösung.",
      ),
      examples: ["s = \\frac{1}{2} a t^2", "t = \\sqrt{\\frac{2s}{a}}"],
      tone: "tip",
    },
    {
      title: tx("Divide every term", "Jeden Summanden teilen"),
      body: tx("When you divide a sum, the whole sum is divided, not just one part.", "Wenn du eine Summe teilst, wird die ganze Summe geteilt, nicht nur ein Teil davon."),
      examples: ["\\frac{u - 2b}{2} = \\frac{u}{2} - b", "\\frac{u - 2b}{2} \\ne \\frac{u}{2} - 2b"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("A formula is an equation", "Eine Formel ist eine Gleichung"),
      blob: tx("Formulas look scary, but they follow the same balance rules!", "Formeln sehen gruselig aus, aber es gelten dieselben Regeln wie bei Gleichungen!"),
      body: tx(
        "Formeln umstellen means: get a different letter on its own. You do exactly what you do with equations: the same operation on both sides.",
        "Formeln umstellen heißt: Ein anderer Buchstabe soll allein stehen. Du machst genau das Gleiche wie bei Gleichungen: dieselbe Rechnung auf beiden Seiten.",
      ),
      frames: firstFrames,
    },
    {
      type: "explain",
      title: tx("Divided? Multiply!", "Geteilt? Multiplizieren!"),
      blob: tx("Every operation has an opposite. That's our superpower.", "Jede Rechenart hat eine Umkehroperation. Das ist unsere Superkraft."),
      body: tx(
        "Plus is undone by minus, times by divide, and divide by times. When the letter sits in the denominator, multiply it out of the fraction first.",
        "Plus machst du mit Minus rückgängig, Mal mit Geteilt und Geteilt mit Mal. Steht der Buchstabe im Nenner, holst du ihn zuerst durch Multiplizieren aus dem Bruch.",
      ),
      frames: speedFrames,
    },
    {
      type: "widget",
      title: tx("Pick a letter", "Wähle einen Buchstaben"),
      blob: tx("Choose a formula and a letter. Watch it rearrange itself!", "Such dir eine Formel und einen Buchstaben aus. Schau zu, wie sie sich umstellt!"),
      body: tx(
        "Tap a formula, then the letter you want on its own. Each step shows what is undone. The numbers at the bottom check that the new formula gives the same result.",
        "Tippe auf eine Formel und dann auf den Buchstaben, der allein stehen soll. Jeder Schritt zeigt, was rückgängig gemacht wird. Die Zahlen unten prüfen, ob die neue Formel dasselbe Ergebnis liefert.",
      ),
      widget: FormulaExplorer,
    },
    {
      type: "check",
      blob: tx("One step is enough here.", "Hier reicht ein Schritt."),
      exercise: task(byKey("power"), "I"),
    },
    {
      type: "explain",
      title: tx("Undo in reverse order", "In umgekehrter Reihenfolge"),
      blob: tx("Socks first, then shoes. Taking them off? Shoes first!", "Erst Socken, dann Schuhe. Und beim Ausziehen? Erst die Schuhe!"),
      body: tx(
        "Think about how the formula is built from your letter. Then undo those steps backwards: the last one first.",
        "Überleg dir, wie die Formel aus deinem Buchstaben entsteht. Dann machst du diese Schritte in umgekehrter Reihenfolge rückgängig: den letzten zuerst.",
      ),
      frames: reverseFrames,
    },
    {
      type: "explain",
      title: tx("The classic mistake", "Der typische Fehler"),
      blob: tx("This one costs points in almost every test. Let's avoid it!", "Der kostet in fast jeder Klassenarbeit Punkte. Den vermeiden wir!"),
      body: tx("When you divide a sum by a number, **every** term gets divided.", "Wenn du eine Summe durch eine Zahl teilst, wird **jeder** Summand geteilt."),
      frames: mistakeFrames,
    },
    {
      type: "check",
      blob: tx("Get rid of the fraction first.", "Werde zuerst den Bruch los."),
      exercise: task(byKey("triangle"), "h"),
    },
    {
      type: "explain",
      title: tx("Squares need a root", "Quadrate brauchen eine Wurzel"),
      blob: tx("A squared letter is the last thing to undo.", "Das Quadrat machst du ganz zum Schluss rückgängig."),
      body: tx(
        "If the letter is squared, take the square root at the very end. Times, lengths and speeds are positive, so we only need the positive root.",
        "Ist der Buchstabe quadriert, ziehst du ganz am Ende die Wurzel. Zeiten, Längen und Geschwindigkeiten sind positiv, also brauchen wir nur die positive Wurzel.",
      ),
      frames: rootFrames,
    },
    {
      type: "check",
      blob: tx("Pythagoras! Which step comes first?", "Pythagoras! Welcher Schritt kommt zuerst?"),
      exercise: task(byKey("pythagoras"), "a"),
    },
    {
      type: "check",
      blob: tx("Last one: the interest formula from maths class.", "Die letzte: die Zinsformel aus dem Matheunterricht."),
      exercise: task(byKey("interest"), "p"),
    },
  ],
};
