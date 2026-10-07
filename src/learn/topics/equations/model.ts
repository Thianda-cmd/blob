// The equation engine shared by all three levels: a small model of linear equations and
// inequalities (terms, brackets, products), the step-by-step solver that writes the animated
// worked solutions, and the typical-mistake simulator.

import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { parseDisplay, type DNode } from "@/learn/engine/display";
import { add, div as qdiv, frac, mul as qmul, neg as qneg, show as qshow, value as qvalue, type Frac } from "@/learn/engine/frac";
import { lcm } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Mistake } from "@/learn/types";

// ---------------------------------------------------------------------------
// A small model of linear equations and inequalities. Every token gets a stable
// key, so in the worked solutions each term glides to its new place and the
// "| −3" step visibly lands on both sides.

export type Pow = 0 | 1 | 2;
/** c·vᵖ. `sk`/`ck` override the sign/coefficient keys (used after expanding a bracket). */
export type Term = { kind: "t"; c: Frac; p: Pow; id: string; sk?: string; ck?: string };
/** k(…) */
export type Group = { kind: "g"; k: number; id: string; items: Term[] };
/** ±(…)(…) or ±(…)² */
export type Prod = { kind: "pp"; sign: 1 | -1; id: string; a: Term[]; b: Term[]; square?: boolean };
export type Item = Term | Group | Prod;
export type Rel = "=" | "<" | ">" | "≤" | "≥";
export type Eq = { L: Item[]; R: Item[]; rel: Rel; rk: string };
export type Op = { kind: "add"; x: Term } | { kind: "mul"; k: number } | { kind: "div"; k: number };

export const term = (id: string, c: number | Frac, p: Pow = 0): Term => ({ kind: "t", c: typeof c === "number" ? frac(c) : c, p, id });
/** Terms inside brackets get their ids from the bracket. */
export const inner = (c: number | Frac, p: Pow = 0) => term("", c, p);
export const group = (id: string, k: number, items: Term[]): Group => ({ kind: "g", k, id, items: items.map((x, i) => ({ ...x, id: `${id}${i}` })) });
export const prod = (id: string, a: Term[], b: Term[], opts: { square?: boolean; sign?: 1 | -1 } = {}): Prod => ({
  kind: "pp",
  sign: opts.sign ?? 1,
  id,
  square: opts.square,
  a: a.map((x, i) => ({ ...x, id: `${id}a${i}` })),
  b: b.map((x, i) => ({ ...x, id: `${id}b${i}` })),
});
export const equation = (L: Item[], rel: Rel, R: Item[]): Eq => ({ L, R, rel, rk: "rel" });

export const REL_FLIP: Record<Rel, Rel> = { "=": "=", "<": ">", ">": "<", "≤": "≥", "≥": "≤" };
export const REL_TEXT: Record<Rel, string> = { "=": "=", "<": "<", ">": ">", "≤": "\\le", "≥": "\\ge" };
export const kk = (keys: boolean, key: string) => (keys ? `#${key}` : "");
export const isZero = (q: Frac) => q.n === 0;

/** Display source of a frame (the keys are the same in both languages). */
export const srcOf = (t: Text) => (typeof t === "string" ? t : t.en);
/** Same change in both languages. */
export const mapText = (t: Text, f: (s: string) => string): Text => (typeof t === "string" ? f(t) : { en: f(t.en), de: f(t.de) });
/** Sentences joined with a space; empty parts are skipped. */
export const joinText = (...parts: (Text | undefined)[]): Text =>
  txMap((_, locale) =>
    parts
      .map((p) => resolveText(p, locale))
      .filter(Boolean)
      .join(" "),
  );
export const absQ = (q: Frac) => frac(Math.abs(q.n), q.d);

export function signSrc(x: Term, first: boolean, keys: boolean, force = false) {
  const key = kk(keys, x.sk ?? `s${x.id}`);
  if (x.c.n < 0) return `-${key} `;
  return first && !force ? "" : `+${key} `;
}

export function bodySrc(x: Term, v: string, keys: boolean) {
  const n = Math.abs(x.c.n);
  const d = x.c.d;
  if (n === 0) return `0${kk(keys, x.ck ?? `c${x.id}`)}`;
  const vv = x.p === 0 ? "" : x.p === 1 ? `${v}${kk(keys, `v${x.id}`)}` : `${v}${kk(keys, `v${x.id}`)}^{2${kk(keys, `e${x.id}`)}}`;
  const top = x.p > 0 && n === 1 ? vv : [`${n}${kk(keys, x.ck ?? `c${x.id}`)}`, vv].filter(Boolean).join(" ");
  return d === 1 ? top : `\\frac{${top}}{${d}${kk(keys, `d${x.id}`)}}${kk(keys, `f${x.id}`)}`;
}

export function termSrc(x: Term, v: string, first: boolean, keys = true, force = false) {
  return signSrc(x, first, keys, force) + bodySrc(x, v, keys);
}

export function groupSrc(g: Group, v: string, first: boolean, keys: boolean) {
  const sign = g.k < 0 ? `-${kk(keys, `s${g.id}`)} ` : first ? "" : `+${kk(keys, `s${g.id}`)} `;
  const factor = Math.abs(g.k) === 1 ? "" : `${Math.abs(g.k)}${kk(keys, `k${g.id}`)} `;
  return `${sign}${factor}(${g.items.map((x, i) => termSrc(x, v, i === 0, keys)).join(" ")})${kk(keys, `b${g.id}`)}`;
}

export function prodSrc(p: Prod, v: string, first: boolean, keys: boolean) {
  const sign = p.sign < 0 ? `-${kk(keys, `s${p.id}`)} ` : first ? "" : `+${kk(keys, `s${p.id}`)} `;
  const side = (list: Term[], name: string) => `(${list.map((x, i) => termSrc(x, v, i === 0, keys)).join(" ")})${kk(keys, `${name}${p.id}`)}`;
  return p.square ? `${sign}${side(p.a, "ba")}^{2${kk(keys, `q${p.id}`)}}` : `${sign}${side(p.a, "ba")} ${side(p.b, "bb")}`;
}

export function itemSrc(it: Item, v: string, first: boolean, keys = true) {
  return it.kind === "t" ? termSrc(it, v, first, keys) : it.kind === "g" ? groupSrc(it, v, first, keys) : prodSrc(it, v, first, keys);
}

export function sideSrc(items: Item[], v: string, keys = true) {
  return items.length ? items.map((it, i) => itemSrc(it, v, i === 0, keys)).join(" ") : "0";
}

export function eqSrc(e: Eq, v: string, keys = true, annot = "") {
  return `${sideSrc(e.L, v, keys)} ${e.rel}${kk(keys, e.rk)} ${sideSrc(e.R, v, keys)}${annot}`;
}

/** ":2" or ":(−3)" (also for "·"), with keys `<name><id>`. */
export function opNumSrc(sym: string, k: number, id: string, keys = true) {
  const K = (name: string) => kk(keys, `${name}${id}`);
  return k > 0 ? `${sym}${K("q")} ${k}${K("qk")}` : `${sym}${K("q")} (-${K("qs")} ${-k}${K("qk")})${K("qb")}`;
}

/** The step written after the bar, German style: "| −3", "| :2", "| ·6". */
export function opSrc(op: Op, n: number, v: string, keys = true) {
  const body =
    op.kind === "add"
      ? termSrc({ ...op.x, id: `O${n}`, sk: undefined, ck: undefined }, v, true, keys, true)
      : opNumSrc(op.kind === "mul" ? "\\cdot" : ":", op.k, `O${n}`, keys);
  return ` \\quad |${kk(keys, `bar${n}`)} \\, ${body}`;
}

export const RELATION = new Set(["=", "<", ">", "≤", "≥", "≠"]);
export const BINARY_OP = new Set(["+", "−", "·", ":", "±"]);

/** Rough width of display-language maths in em, to keep worked steps on one line (bilingual: the wider one). */
export function emWidth(src: Text): number {
  if (typeof src !== "string") return Math.max(emWidth(src.en), emWidth(src.de));
  const list = (nodes: DNode[]): number => nodes.reduce((sum, node, i) => sum + one(node, nodes[i - 1]), 0);
  const one = (node: DNode, prev?: DNode): number => {
    switch (node.type) {
      case "num":
        return 0.52 * node.v.length;
      case "var":
      case "sym":
        return 0.58;
      case "fn":
        return 0.5 * node.v.length + 0.14;
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

export const termKeys = (x: Term) => [x.sk ?? `s${x.id}`, x.ck ?? `c${x.id}`, `v${x.id}`, `e${x.id}`, `d${x.id}`, `f${x.id}-bar`];
export const terms = (items: Item[]) => items as Term[];
export const coef = (items: Item[], p: Pow) => terms(items).filter((x) => x.p === p).reduce((s, x) => add(s, x.c), frac(0));

/** Add up like terms. The first term of each kind keeps its keys, so it morphs into the sum. */
export function combine(list: Term[]): Term[] {
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
export function combineNote(list: Term[], v: string): string[] {
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
export function bothNote(left: string[], right: string[]): Text {
  if (left.length === 1 && right.length === 1 && left[0] === right[0]) return tx(`${left[0]} on both sides.`, `${left[0]} auf beiden Seiten.`);
  const parts = [...left, ...right];
  return parts.length ? mapText(join(parts), (s) => `${s}.`) : "";
}

export const joinWith = (parts: string[], and: string) => (parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`);
/** "$a$, $b$ and $c$" (maths only, so just the "and" differs). */
export const join = (parts: string[]): Text => (parts.length <= 1 ? parts.join("") : tx(joinWith(parts, "and"), joinWith(parts, "und")));

export function expandGroup(g: Group): Term[] {
  return g.items.map((x, i) => ({
    ...x,
    c: qmul(x.c, frac(g.k)),
    sk: i === 0 ? `s${g.id}` : x.sk,
    ck: i === 0 && Math.abs(g.k) !== 1 ? `k${g.id}` : x.ck,
  }));
}

export function expandProd(p: Prod): Term[] {
  const b = p.square ? p.a : p.b;
  const sums = new Map<number, Frac>();
  for (const x of p.a) for (const y of b) sums.set(x.p + y.p, add(sums.get(x.p + y.p) ?? frac(0), qmul(x.c, y.c)));
  return [...sums.entries()]
    .filter(([, c]) => !isZero(c))
    .sort((u, w) => w[0] - u[0])
    .map(([pw, c], i): Term => ({ kind: "t", c: p.sign < 0 ? qneg(c) : c, p: pw as Pow, id: `${p.id}r${pw}`, sk: i === 0 ? `s${p.id}` : undefined }));
}

export const expandItem = (it: Item): Term[] => (it.kind === "t" ? [it] : it.kind === "g" ? expandGroup(it) : expandProd(it));

/** The key of the first visible token of a term (coefficient or variable). */
export const leadKey = (x: Term) => (x.p > 0 && Math.abs(x.c.n) === 1 && x.c.d === 1 ? `v${x.id}` : x.c.d !== 1 ? `f${x.id}-bar` : (x.ck ?? `c${x.id}`));

export function applyOp(e: Eq, op: Op, n: number, v: string, maxEm: number): { math: string; highlight: string[] } {
  const full = applyFull(e, op, n, v);
  if (emWidth(full.math) <= maxEm) return full;
  // Too wide for one line: show just the step after the bar, like in an exercise book.
  const annotKeys = op.kind === "add" ? termKeys({ ...op.x, id: `O${n}`, sk: undefined, ck: undefined }) : [`qO${n}`, `qkO${n}`, `qsO${n}`];
  return { math: eqSrc(e, v, true, opSrc(op, n, v)), highlight: [...annotKeys, ...(op.kind !== "add" && op.k < 0 && e.rel !== "=" ? [e.rk] : [])] };
}

export function applyFull(e: Eq, op: Op, n: number, v: string): { math: string; highlight: string[] } {
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

export function resultOp(e: Eq, op: Op, n: number, v: string): { eq: Eq; note: Text; highlight?: string[] } {
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
export function productNote(x: Term, k: number, v: string) {
  const factor = x.c.n < 0 ? `(${termSrc(x, v, true, false)})` : bodySrc(x, v, false);
  return `$${k} \\cdot ${factor} = ${termSrc({ ...x, c: qmul(x.c, frac(k)) }, v, true, false)}$`;
}

// ---------------------------------------------------------------------------
// Substitution check ("Probe")

export const valSrc = (q: Frac) => (q.n < 0 ? `(${qshow(q)})` : qshow(q));

export function substTerm(x: Term, val: Frac, first: boolean) {
  const sign = x.c.n < 0 ? "- " : first ? "" : "+ ";
  const n = Math.abs(x.c.n);
  if (x.p === 0) return `${sign}${qshow(frac(n, x.c.d))}`;
  // A lone first value needs no bracket: "-6 - 6", but "2 · (-6)" and "+ (-6)".
  const bare = x.p === 1 && n === 1 && (sign === "" || x.c.d !== 1);
  const pv = x.p === 2 ? `${valSrc(val)}^2` : bare ? qshow(val) : valSrc(val);
  const top = n === 1 ? pv : `${n} \\cdot ${pv}`;
  return `${sign}${x.c.d === 1 ? top : `\\frac{${top}}{${x.c.d}}`}`;
}

export function substSide(items: Item[], val: Frac): string {
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

export function evalSide(items: Item[], val: Frac): Frac {
  const pw = (p: Pow) => (p === 0 ? frac(1) : p === 1 ? val : qmul(val, val));
  return expandAll(items).reduce((s, x) => add(s, qmul(x.c, pw(x.p))), frac(0));
}

export const expandAll = (items: Item[]) => items.flatMap(expandItem);

// ---------------------------------------------------------------------------
// The solver: expand, tidy, collect x-terms, collect numbers, divide.

export const SOLUTION_WORDS: Record<Exclude<Rel, "=">, (b: string) => Text> = {
  "<": (b) => tx(`Every number smaller than $${b}$ is a solution.`, `Jede Zahl kleiner als $${b}$ ist eine Lösung.`),
  ">": (b) => tx(`Every number greater than $${b}$ is a solution.`, `Jede Zahl größer als $${b}$ ist eine Lösung.`),
  "≤": (b) => tx(`Every number smaller than or equal to $${b}$ is a solution.`, `Jede Zahl kleiner oder gleich $${b}$ ist eine Lösung.`),
  "≥": (b) => tx(`Every number greater than or equal to $${b}$ is a solution.`, `Jede Zahl größer oder gleich $${b}$ ist eine Lösung.`),
};

export type Solved = { frames: Frame[]; value: Frac; rel: Rel };

/** `maxEm`: widest step that fits on one line (about 13em in a worked solution, 18em on the lesson board). */
export function solveEq(start: Eq, v: string, opts: { check?: boolean; intro?: Text; maxEm?: number } = {}): Solved {
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
          ? tx("A minus in front of the bracket: remove it and flip every sign inside.", "Ein Minus vor der Klammer: Lass die Klammer weg und dreh jedes Vorzeichen darin um.")
          : tx(`Brackets first: multiply $${single.k}$ by each term inside.`, `Zuerst die Klammer auflösen: Multipliziere jeden Term darin mit $${single.k}$.`)
        : single
          ? tx("Brackets first: multiply them out.", "Zuerst die Klammern ausmultiplizieren.")
          : tx("Brackets first: expand each one.", "Zuerst alle Klammern auflösen.");
    frames.push({ math: eqSrc(e, v), highlight, arrows, note: joinText(opts.intro, intro) });
    const note = brackets.map((b) => `$${itemSrc(b, v, true, false)} = ${sideSrc(expandItem(b), v, false)}$`);
    e = { ...e, L: expandAll(e.L), R: expandAll(e.R) };
    frames.push({ math: eqSrc(e, v), note: mapText(join(note), (s) => `${s}.`) });
  } else {
    const intro = ineq
      ? tx("Solve it just like an equation. Only a negative factor needs extra care.", "Löse sie genau wie eine Gleichung. Nur bei einem negativen Faktor musst du aufpassen.")
      : tx(`Goal: get $${v}$ on its own.`, `Ziel: $${v}$ allein auf eine Seite bringen.`);
    frames.push({ math: eqSrc(e, v), note: opts.intro ?? intro });
  }

  const tidy = () => {
    const needs = (list: Item[]) => new Set(terms(list).map((x) => x.p)).size < list.length;
    if (!needs(e.L) && !needs(e.R)) return;
    const parts = [...combineNote(terms(e.L), v), ...combineNote(terms(e.R), v)];
    e = { ...e, L: combine(terms(e.L)), R: combine(terms(e.R)) };
    frames.push({ math: eqSrc(e, v), note: tx(`Tidy up first: ${joinWith(parts, "and")}.`, `Fasse zuerst zusammen: ${joinWith(parts, "und")}.`) });
  };

  const step = (op: Op, before: Text, after?: Text) => {
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
      tx(`Clear the fractions: multiply **every** term by $${k}$, the common denominator.`, `Weg mit den Brüchen: Multipliziere **jeden** Term mit $${k}$, dem Hauptnenner.`),
      all.length <= 3
        ? tx(`${joinWith(products, "and")}. No more fractions!`, `${joinWith(products, "und")}. Keine Brüche mehr!`)
        : tx("Work out each product. No more fractions!", "Rechne jedes Produkt aus. Keine Brüche mehr!"),
    );
    tidy();
  }

  // x² on both sides (after multiplying out) cancels.
  const sq = coef(e.R, 2);
  if (!isZero(sq) || !isZero(coef(e.L, 2))) {
    const x = term("", qneg(isZero(sq) ? coef(e.L, 2) : sq), 2);
    const shown = `$${bodySrc({ ...x, c: absQ(x.c) }, v, false)}$`;
    step(
      { kind: "add", x },
      tx(
        `$${v}^2$ is on both sides. ${x.c.n < 0 ? "Subtract" : "Add"} ${shown} on both sides and it's gone.`,
        `$${v}^2$ steht auf beiden Seiten. ${x.c.n < 0 ? "Subtrahiere" : "Addiere"} ${shown} auf beiden Seiten, dann ist es weg.`,
      ),
    );
  }

  // x-terms on both sides: bring them together.
  const xl = coef(e.L, 1);
  const xr = coef(e.R, 1);
  if (!isZero(xl) && !isZero(xr)) {
    // Equations: take away the smaller x-term, so the x stays positive. Inequalities: always collect on the left.
    const away = ineq || qvalue(xl) > qvalue(xr) ? xr : xl;
    const x = term("", qneg(away), 1);
    const shown = `$${bodySrc({ ...x, c: absQ(x.c) }, v, false)}$`;
    step(
      { kind: "add", x },
      tx(
        `Bring the $${v}$-terms together: ${x.c.n < 0 ? "subtract" : "add"} ${shown} on **both** sides.`,
        `Bring die $${v}$-Terme auf eine Seite: ${x.c.n < 0 ? "Subtrahiere" : "Addiere"} ${shown} auf **beiden** Seiten.`,
      ),
    );
  }

  const xLeft = !isZero(coef(e.L, 1));
  const xSide = () => (xLeft ? e.L : e.R);
  const other = () => (xLeft ? e.R : e.L);

  // Numbers to the other side.
  const b = coef(xSide(), 0);
  if (!isZero(b)) {
    const shown = qshow(absQ(b));
    const what = `$${b.n > 0 ? "+" : "-"} ${shown}$`;
    step(
      { kind: "add", x: term("", qneg(b)) },
      tx(
        `To get rid of the ${what}, ${b.n > 0 ? "subtract" : "add"} $${shown}$ on **both** sides.`,
        `Damit das ${what} verschwindet, ${b.n > 0 ? "subtrahiere" : "addiere"} $${shown}$ auf **beiden** Seiten.`,
      ),
    );
  }

  // The number in front of x.
  let a = coef(xSide(), 1);
  const flipWarning: Text = ineq ? tx("Careful: a negative number **flips** the sign!", "Achtung: Eine negative Zahl **dreht** das Relationszeichen um!") : "";
  if (a.d !== 1) {
    const k = a.d;
    const o = terms(other());
    const xt = terms(xSide());
    const before =
      Math.abs(a.n) === 1
        ? tx(`$${v}$ is divided by $${k}$. Undo it: multiply both sides by $${k}$.`, `$${v}$ wird durch $${k}$ geteilt. Mach das rückgängig: Multipliziere beide Seiten mit $${k}$.`)
        : tx(`Multiply both sides by $${k}$ to get rid of the fraction.`, `Multipliziere beide Seiten mit $${k}$, dann ist der Bruch weg.`);
    const after = join([...xt, ...o].map((x) => productNote(x, k, v)));
    step({ kind: "mul", k }, before, mapText(after, (s) => `${s}.`));
    a = coef(xSide(), 1);
  }
  if (a.n === -1 && a.d === 1) {
    const [r0, r1] = [REL_TEXT[e.rel], REL_TEXT[REL_FLIP[e.rel]]];
    step(
      { kind: "mul", k: -1 },
      joinText(tx(`Only $-${v}$ is left. Multiply both sides by $-1$.`, `Übrig ist nur $-${v}$. Multipliziere beide Seiten mit $-1$.`), flipWarning),
      ineq
        ? tx(`Every sign flips, and $${r0}$ becomes $${r1}$.`, `Alle Vorzeichen drehen sich um, und aus $${r0}$ wird $${r1}$.`)
        : tx("Every sign flips.", "Alle Vorzeichen drehen sich um."),
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
      joinText(
        tx(`$${v}$ is multiplied by $${k}$. Undo it: divide both sides by $${k}$.`, `$${v}$ wird mit $${k}$ multipliziert. Mach das rückgängig: Teile beide Seiten durch $${k}$.`),
        k < 0 ? flipWarning : "",
      ),
      k < 0 && ineq
        ? tx(
            `The sign flips: $${REL_TEXT[rel]}$ becomes $${REL_TEXT[REL_FLIP[rel]]}$. And ${calc}.`,
            `Das Relationszeichen dreht sich um: Aus $${REL_TEXT[rel]}$ wird $${REL_TEXT[REL_FLIP[rel]]}$. Und ${calc}.`,
          )
        : `${calc}.`,
    );
  }

  const value = coef(other(), 0);
  const shown = qshow(value);
  if (!xLeft) {
    e = { ...e, L: e.R, R: e.L, rel: REL_FLIP[e.rel] };
    frames.push({ math: eqSrc(e, v), note: tx(`Turn it around: $${v} = ${shown}$.`, `Seiten tauschen: $${v} = ${shown}$.`) });
  } else {
    const last = frames[frames.length - 1];
    const end = ineq
      ? joinText(tx(`So $${v} ${REL_TEXT[e.rel]} ${shown}$.`, `Also ist $${v} ${REL_TEXT[e.rel]} ${shown}$.`), SOLUTION_WORDS[e.rel as Exclude<Rel, "=">](shown))
      : tx(`So $${v} = ${shown}$.`, `Also ist $${v} = ${shown}$.`);
    frames[frames.length - 1] = { ...last, note: joinText(last.note, end) };
  }

  if (opts.check && !ineq && ![...start.L, ...start.R].some((it) => it.kind === "pp")) {
    const both = qshow(evalSide(start.L, value));
    frames.push({
      math: `${substSide(start.L, value)} = ${substSide(start.R, value)}`,
      note: tx(`Check: put $${v} = ${shown}$ back in. Both sides give $${both}$. It works!`, `Probe: Setze $${v} = ${shown}$ ein. Beide Seiten ergeben $${both}$. Passt!`),
    });
  }
  return { frames: smoothFracExits(frames), value, rel: e.rel };
}

// ---------------------------------------------------------------------------
// MathView quirk: tokens that glide out of a fraction which disappears (or moves
// into another bracket or root) in the same step blink to invisible for a moment.
// Such tokens get fresh keys from that step on, so they simply scale in instead.

export const LEAF_TYPES = new Set(["num", "var", "op", "text", "sym"]);

export function leafKeys(nodes: DNode[], out: string[] = []): string[] {
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
export function fracPlaces(nodes: DNode[], path = "", out = new Map<string, { path: string; leaves: string[] }>()) {
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

export const baseKey = (k: string) => k.replace(/(-bar|-rad|\(|\))$/, "");

export function smoothFracExits(frames: Frame[]): Frame[] {
  const out = [...frames];
  for (let i = 1; i < out.length; i++) {
    const prev = fracPlaces(parseDisplay(srcOf(out[i - 1].math)));
    const nextTree = parseDisplay(srcOf(out[i].math));
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
      out[j] = { ...f, math: mapText(f.math, (s) => s.replace(re, `#$1_${i}`)), highlight: f.highlight?.map(swap), arrows: f.arrows?.map(([a, b]) => [swap(a), swap(b)] as [string, string]) };
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Typical mistakes. Blob solves the task the way a student with one particular
// misconception would (a term moved without changing its sign, only one term
// divided, the flip forgotten…), so the wrong value is exactly what that student
// gets, and Blob can say what happened.

export type Slip = {
  /** The number on the x-side changes sides but keeps its sign: x + 3 = 11 → x = 14. */
  numSign?: boolean;
  /** The x-term from the other side changes sides but keeps its sign. */
  xSign?: boolean;
  /** Collect the x-terms on the other side than the worked solution does. */
  other?: boolean;
  /** Divided before the number was gone, but the number itself didn't get divided. */
  partial?: boolean;
  /** The number vanishes on its own side only. */
  dropNum?: boolean;
  /** The number in front of x vanishes on its own side only. */
  dropCoef?: boolean;
  /** 3x = 12 → x = 12 − 3. */
  subCoef?: boolean;
  /** Divided by 3 instead of −3 (or stopped at −x). */
  dropMinus?: boolean;
  /** Multiplied by the fraction in front of x instead of dividing by it. */
  fracRecip?: boolean;
  /** ⅔x = 4: multiplied by 3, but never divided by 2. */
  fracNoNum?: boolean;
  /** Inequalities: no flip for a negative factor, or a flip for a positive one. */
  noFlip?: boolean;
  flip?: boolean;
};

/** A slipped solution: the result plus the numbers Blob talks about (x-side and other side). */
export type Run = { value: Frac; rel: Rel; A: Frac; bx: Frac; ao: Frac };

export const qsub = (a: Frac, b: Frac) => add(a, qneg(b));
export const sameQ = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;

/** Solve the expanded equation the way the worked solution does, with at most one slip. */
export function slipSolve(L: Term[], R: Term[], rel: Rel, slip: Slip = {}): Run | null {
  const side = (list: Term[]) => [coef(list, 0), coef(list, 1), coef(list, 2)];
  let [bL, aL, sL, bR, aR, sR] = [...side(L), ...side(R)];
  // Several fractions: the worked solution multiplies by the common denominator first.
  const fracs = [bL, aL, sL, bR, aR, sR].filter((q) => q.d !== 1);
  if (fracs.length >= 2) {
    const k = frac(fracs.reduce((m, q) => lcm(m, q.d), 1));
    [bL, aL, sL, bR, aR, sR] = [bL, aL, sL, bR, aR, sR].map((q) => qmul(q, k));
  }
  // x² has to cancel, otherwise this isn't a linear equation any more.
  if (!sameQ(sL, sR) || (isZero(aL) && isZero(aR))) return null;
  const both = !isZero(aL) && !isZero(aR);
  let xLeft = both ? rel !== "=" || qvalue(aL) > qvalue(aR) : !isZero(aL);
  if (slip.other) {
    if (!both) return null;
    xLeft = !xLeft;
  }
  const [ax, bx, ao, bo] = xLeft ? [aL, bL, aR, bR] : [aR, bR, aL, bL];
  if (slip.xSign && isZero(ao)) return null;
  if ((slip.numSign || slip.partial || slip.dropNum) && isZero(bx)) return null;
  const A = slip.xSign ? add(ax, ao) : qsub(ax, ao);
  if (isZero(A)) return null;
  const C = slip.numSign ? add(bo, bx) : slip.dropNum ? bo : qsub(bo, bx);
  const whole = A.d === 1;
  let value = qdiv(C, A);
  /** Sign of what the student divides by (decides the flip). */
  let divisor = qvalue(A);
  if (slip.partial) {
    if (!whole || Math.abs(A.n) === 1) return null;
    value = qsub(qdiv(bo, A), bx);
  } else if (slip.fracRecip) {
    if (whole) return null;
    value = qmul(C, A);
  } else if (slip.fracNoNum) {
    if (whole || Math.abs(A.n) === 1) return null;
    value = qmul(C, frac(A.d));
    divisor = 1;
  } else if (slip.dropMinus) {
    if (A.n > 0) return null;
    value = qdiv(C, absQ(A));
    divisor = 1;
  } else if (slip.subCoef) {
    if (!whole || A.n < 2 || rel !== "=") return null;
    value = qsub(C, A);
  } else if (slip.dropCoef) {
    if ((A.n === 1 && A.d === 1) || rel !== "=") return null;
    value = C;
  }
  let r = rel;
  if (rel !== "=") {
    if ((slip.noFlip && divisor > 0) || (slip.flip && divisor < 0)) return null;
    if (divisor < 0 !== Boolean(slip.noFlip || slip.flip)) r = REL_FLIP[r];
    // x ended up on the right: turning the inequality around mirrors the sign.
    if (!xLeft) r = REL_FLIP[r];
  }
  return { value, rel: r, A, bx, ao };
}

export type WrongExpand = "first" | "sign" | "no2" | "minus";

/** A bracket multiplied out the way a student with a misconception would. */
export function wrongExpand(it: Item, how: WrongExpand): Term[] | null {
  if (it.kind === "g") {
    // 3(x + 2) → 3x + 2
    if (how === "first" && Math.abs(it.k) !== 1) return it.items.map((x, i) => ({ ...x, c: i === 0 ? qmul(x.c, frac(it.k)) : x.c }));
    // −(x − 4) → −x − 4, −2(x + 3) → −2x + 6
    if (how === "sign" && it.k < 0) return it.items.map((x, i) => ({ ...x, c: qmul(x.c, frac(i === 0 ? it.k : -it.k)) }));
    return null;
  }
  if (it.kind !== "pp") return null;
  const signed = (list: Term[]) => list.map((x) => ({ ...x, c: it.sign < 0 ? qneg(x.c) : x.c }));
  const mono = (x: Term, y: Term, k = 1) => term("", qmul(frac(k), qmul(x.c, y.c)), (x.p + y.p) as Pow);
  // (x + 3)² → x² + 3x + 9: the middle term without its 2.
  if (how === "no2" && it.square) return signed(it.a.flatMap((x, i) => it.a.slice(i).map((y) => mono(x, y))));
  // (x − 2)(x − 5) with (−2)·(−5) = −10.
  if (how === "minus" && !it.square && it.a.some((x) => x.c.n < 0) && it.b.some((y) => y.c.n < 0)) {
    return signed(it.a.flatMap((x) => it.b.map((y) => mono(x, y, x.c.n < 0 && y.c.n < 0 ? -1 : 1))));
  }
  return null;
}

/** Signed number for the messages: "+ 3", "- \frac{1}{2}". */
export const signedQ = (q: Frac) => `${q.n < 0 ? "-" : "+"} ${qshow(absQ(q))}`;

export function eqMistakes(e: Eq, v: string, value: Frac, rel: Rel): Mistake[] {
  const L = expandAll(e.L);
  const R = expandAll(e.R);
  const base = slipSolve(L, R, e.rel);
  // Only when the simulation retraces the worked solution exactly.
  if (!base || !sameQ(base.value, value) || base.rel !== rel) return [];
  const ineq = rel !== "=";
  const out: Mistake[] = [];
  const keyOf = (r: Run) => `${ineq ? r.rel : ""} ${r.value.n}/${r.value.d}`;
  const seen = new Set([keyOf(base)]);
  /** `close`: a near miss (right idea, one small slip), so Blob looks thoughtful and doesn't reveal the solution yet. */
  const push = (run: Run | null, title: Text, say: (r: Run) => Text, close = false) => {
    if (!run || out.length >= 5 || seen.has(keyOf(run))) return;
    seen.add(keyOf(run));
    const when: AnswerSpec = ineq
      ? { kind: "inequality", variable: v, op: run.rel as Exclude<Rel, "=">, value: qvalue(run.value) }
      : { kind: "solutions", variable: v, values: [qvalue(run.value)] };
    out.push({ when, title, say: say(run), close });
  };
  const solve = (slip: Slip, l = L, r = R) => slipSolve(l, r, e.rel, slip);
  const xt = (q: Frac) => termSrc(term("", q, 1), v, true, false);
  const n = (q: Frac) => qshow(q);

  if (ineq) {
    push(
      solve({ noFlip: true }),
      tx("Sign not flipped", "Zeichen nicht umgedreht"),
      ({ A }) =>
        A.n === -1 && A.d === 1
          ? tx(
              `Ooh, the classic trap! To turn $-${v}$ into $${v}$ you multiply by $-1$, and multiplying by a negative number **flips** the sign.`,
              `Die klassische Falle! Um aus $-${v}$ ein $${v}$ zu machen, multiplizierst du mit $-1$, und dabei dreht sich das Relationszeichen **um**.`,
            )
          : tx(
              `Ooh, the classic trap! In the last step you divide by $${n(A)}$, and dividing by a negative number **flips** the sign.`,
              `Die klassische Falle! Im letzten Schritt teilst du durch $${n(A)}$, und beim Teilen durch eine negative Zahl dreht sich das Relationszeichen **um**.`,
            ),
      true,
    );
    push(solve({ flip: true }), tx("Flipped for no reason", "Unnötig umgedreht"), ({ A }) =>
      A.n === 1 && A.d === 1
        ? tx(
            "You flipped the sign, but here you never multiply or divide by a negative number. It only flips for a **negative** factor; a minus somewhere else doesn't count.",
            "Du hast das Relationszeichen umgedreht, aber hier multiplizierst oder teilst du gar nicht mit einer negativen Zahl. Umdrehen musst du nur bei einem **negativen** Faktor, ein Minus woanders zählt nicht.",
          )
        : tx(
            `You flipped the sign, but you only divide by $${n(A)}$, a positive number. It only flips for a **negative** factor; a minus somewhere else doesn't count.`,
            `Du hast das Relationszeichen umgedreht, aber du teilst nur durch $${n(A)}$, also durch eine positive Zahl. Umdrehen musst du nur bei einem **negativen** Faktor, ein Minus woanders zählt nicht.`,
          ),
      true,
    );
  }

  // Brackets multiplied out wrongly, then everything else done right.
  const brackets = [...e.L.map((it) => [it, "L"] as const), ...e.R.map((it) => [it, "R"] as const)].filter(([it]) => it.kind !== "t");
  for (const how of ["first", "sign", "no2", "minus"] as WrongExpand[]) {
    for (const [it, where] of brackets) {
      const wrong = wrongExpand(it, how);
      if (!wrong) continue;
      const swap = (items: Item[]) => items.flatMap((x) => (x === it ? wrong : expandItem(x)));
      const run = where === "L" ? solve({}, swap(e.L), R) : solve({}, L, swap(e.R));
      const k = it.kind === "g" ? it.k : 0;
      if (how === "first") {
        push(run, tx("Only the first term multiplied", "Nur der erste Term multipliziert"), () =>
          tx(
            `Ah, I see what happened! The $${k}$ only reached the first term in the bracket. It has to multiply **every** term inside.`,
            `Ah, ich seh, was passiert ist! Die $${k}$ hat nur den ersten Term in der Klammer erwischt. Sie muss **jeden** Term darin multiplizieren.`,
          ),
        );
      } else if (how === "sign") {
        push(run, tx("Only the first sign flipped", "Nur das erste Vorzeichen gedreht"), () =>
          k === -1
            ? tx(
                "Ooh, careful with the minus in front of the bracket! It flips **every** sign inside, the last one too.",
                "Achtung beim Minus vor der Klammer! Es dreht **jedes** Vorzeichen darin um, auch das letzte.",
              )
            : tx(
                `Careful with the signs! The $${k}$ multiplies **every** term in the bracket, minus included, so the last sign flips too.`,
                `Vorsicht mit den Vorzeichen! Die $${k}$ multipliziert **jeden** Term in der Klammer, samt Minus. Also dreht sich auch das letzte Vorzeichen um.`,
              ),
        );
      } else if (how === "no2") {
        push(run, tx("Middle term without the 2", "Mittelterm ohne die 2"), () =>
          tx(
            "Ooh, careful with the square! Its middle term is **twice** the product: $(a + b)^2 = a^2 + 2ab + b^2$. Your $2$ got lost.",
            "Vorsicht beim Quadrat! Der Mittelterm ist das **Doppelte** des Produkts: $(a + b)^2 = a^2 + 2ab + b^2$. Bei dir ist die $2$ verloren gegangen.",
          ),
        );
      } else if (it.kind === "pp") {
        const [p, q] = [it.a[1].c, it.b[1].c];
        push(run, tx("Minus times minus", "Minus mal Minus"), () =>
          tx(
            `Careful with the signs: $${n(p)} \\cdot (${n(q)})$ is minus times minus, and that gives **plus**!`,
            `Vorsicht mit den Vorzeichen: $${n(p)} \\cdot (${n(q)})$ ist Minus mal Minus, und das ergibt **Plus**!`,
          ),
        );
      }
    }
  }

  if (!ineq) {
    // x/2 + x/3 taken as 2x/5.
    for (const [list, isLeft] of [[L, true], [R, false]] as const) {
      const units = list.filter((x) => x.p === 1 && x.c.n === 1 && x.c.d > 1);
      if (units.length !== 2 || list.filter((x) => x.p === 1).length !== 2) continue;
      const [a, b] = units.map((x) => x.c.d);
      const merged = [...list.filter((x) => !units.includes(x)), term("", frac(2, a + b), 1)];
      push(isLeft ? solve({}, merged, R) : solve({}, L, merged), tx("Tops and bottoms added", "Zähler und Nenner addiert"), () =>
        tx(
          `Ooh, classic trap! $\\frac{${v}}{${a}} + \\frac{${v}}{${b}}$ is **not** $\\frac{2${v}}{${a + b}}$: you can't just add tops and bottoms. Use the common denominator $${lcm(a, b)}$.`,
          `Die klassische Falle! $\\frac{${v}}{${a}} + \\frac{${v}}{${b}}$ ist **nicht** $\\frac{2${v}}{${a + b}}$: Zähler und Nenner darfst du nicht einfach addieren. Nimm den Hauptnenner $${lcm(a, b)}$.`,
        ),
      );
    }
    // Fractions cleared, but the terms without a fraction never got multiplied.
    const withFrac = [...L, ...R].filter((x) => x.c.d !== 1);
    if (withFrac.length && L.length + R.length >= 3) {
      const K = withFrac.reduce((m, x) => lcm(m, x.c.d), 1);
      const times = (list: Term[]) => list.map((x) => (x.c.d !== 1 ? { ...x, c: qmul(x.c, frac(K)) } : x));
      const many = withFrac.length > 1;
      push(solve({}, times(L), times(R)), tx("Not every term multiplied", "Nicht jeden Term multipliziert"), () =>
        tx(
          `Ah, I see what happened! You multiplied the ${many ? "fractions" : "fraction"} by $${K}$, but not the other terms. **Every** term has to be multiplied by $${K}$.`,
          `Ah, ich seh, was passiert ist! Du hast ${many ? "die Brüche" : "den Bruch"} mit $${K}$ multipliziert, aber nicht die anderen Terme. **Jeder** Term muss mit $${K}$ multipliziert werden.`,
        ),
      );
    }
  }

  const numSign = ({ bx }: Run) =>
    tx(
      `Ah, I see what happened! You moved the $${signedQ(bx)}$ to the other side, but it's still $${signedQ(bx)}$ there. To get rid of it, ${bx.n > 0 ? "subtract" : "add"} $${n(absQ(bx))}$ on **both** sides.`,
      `Ah, ich seh, was passiert ist! Du hast das $${signedQ(bx)}$ auf die andere Seite gebracht, aber dort steht es immer noch als $${signedQ(bx)}$. Um es loszuwerden, ${bx.n > 0 ? "subtrahierst" : "addierst"} du auf **beiden** Seiten $${n(absQ(bx))}$.`,
    );
  const xSign = ({ ao }: Run) =>
    tx(
      `I think I know what you did: $${xt(ao)}$ went over to the other side but kept its sign. To bring it over, ${ao.n > 0 ? "subtract" : "add"} $${xt(absQ(ao))}$ on **both** sides.`,
      `Ich glaub, ich weiß, was du gemacht hast: $${xt(ao)}$ ist auf die andere Seite gewandert, hat aber sein Vorzeichen behalten. Um es rüberzuholen, ${ao.n > 0 ? "subtrahierst" : "addierst"} du auf **beiden** Seiten $${xt(absQ(ao))}$.`,
    );
  const NUM_SIGN = tx("Sign not changed", "Vorzeichen nicht gewechselt");
  const X_SIGN = tx(`${v}-term kept its sign`, `${v}-Term ohne Vorzeichenwechsel`);
  const dropMinus = ({ A }: Run) =>
    A.n === -1 && A.d === 1
      ? tx(
          `Nearly! You stopped at $-${v}$, but we want $${v}$, not $-${v}$. One last step: multiply both sides by $-1$${ineq ? ", and that flips the sign" : ""}.`,
          `Fast! Du bist bei $-${v}$ stehen geblieben, aber gesucht ist $${v}$, nicht $-${v}$. Ein letzter Schritt: Multipliziere beide Seiten mit $-1$${ineq ? ", dabei dreht sich das Relationszeichen um" : ""}.`,
        )
      : tx(
          `Ah, I see what happened! You divided by $${n(absQ(A))}$, but the number in front of $${v}$ is $${n(A)}$. The minus belongs to it, so divide by $${n(A)}$${ineq ? ", and that flips the sign" : ""}.`,
          `Ah, ich seh, was passiert ist! Du hast durch $${n(absQ(A))}$ geteilt, aber vor dem $${v}$ steht $${n(A)}$. Das Minus gehört dazu, also teilst du durch $${n(A)}$${ineq ? ", und dabei dreht sich das Relationszeichen um" : ""}.`,
        );
  const MINUS = tx("Minus sign dropped", "Minus unterschlagen");

  push(solve({ numSign: true }), NUM_SIGN, numSign);
  if (!ineq) push(solve({ dropMinus: true }), MINUS, dropMinus, true);
  push(solve({ xSign: true }), X_SIGN, xSign);
  push(solve({ numSign: true, other: true }), NUM_SIGN, numSign);
  push(solve({ xSign: true, other: true }), X_SIGN, xSign);
  push(solve({ partial: true }), tx("Not every term divided", "Nicht jeden Term geteilt"), ({ A, bx }) =>
    tx(
      `Ah, I see what happened! You divided by $${n(A)}$ while the $${signedQ(bx)}$ was still there, but the $${signedQ(bx)}$ didn't get divided. Get rid of it first, then divide.`,
      `Ah, ich seh, was passiert ist! Du hast durch $${n(A)}$ geteilt, solange das $${signedQ(bx)}$ noch da war, aber das $${signedQ(bx)}$ hast du nicht mitgeteilt. Bring es zuerst weg und teile dann.`,
    ),
  );
  if (ineq) push(solve({ dropMinus: true }), MINUS, dropMinus, true);
  push(solve({ fracRecip: true }), tx("Multiplied instead of divided", "Multipliziert statt geteilt"), ({ A }) =>
    A.n === 1
      ? tx(
          `Ah, I see what happened! $${v}$ is **divided** by $${A.d}$, so you undo that by **multiplying** by $${A.d}$, not by dividing again.`,
          `Ah, ich seh, was passiert ist! $${v}$ wird durch $${A.d}$ **geteilt**. Das machst du mit **Multiplizieren** rückgängig, nicht mit noch mal Teilen.`,
        )
      : tx(
          `I think I know what you did: you multiplied by $${n(A)}$ instead of dividing by it. Dividing by a fraction means multiplying by its **reciprocal**.`,
          `Ich glaub, ich weiß, was du gemacht hast: Du hast mit $${n(A)}$ multipliziert, statt durch $${n(A)}$ zu teilen. Durch einen Bruch teilst du, indem du mit dem **Kehrwert** multiplizierst.`,
        ),
  );
  push(solve({ fracNoNum: true }), tx("One step missing", "Ein Schritt fehlt"), ({ A }) =>
    tx(
      `Almost! Multiplying by $${A.d}$ was right, but that leaves $${A.n}${v}$, which still means $${A.n} \\cdot ${v}$. Divide by $${A.n}$ as well.`,
      `Fast! Mit $${A.d}$ multiplizieren war richtig, aber dann steht da $${A.n}${v}$, also $${A.n} \\cdot ${v}$. Teile noch durch $${A.n}$.`,
    ),
    true,
  );
  push(solve({ dropNum: true }), tx("Only one side changed", "Nur eine Seite verändert"), ({ bx }) =>
    tx(
      `You made the $${signedQ(bx)}$ disappear on one side, but the other side didn't change. Whatever you do, do it on **both** sides.`,
      `Du hast das $${signedQ(bx)}$ auf einer Seite verschwinden lassen, aber die andere Seite ist gleich geblieben. Was du machst, machst du auf **beiden** Seiten.`,
    ),
  );
  const coefRun = solve({ dropCoef: true });
  const unit = coefRun && coefRun.A.n === 1 && coefRun.A.d > 1;
  push(coefRun, unit ? tx("Only one side multiplied", "Nur eine Seite multipliziert") : tx("Only one side divided", "Nur eine Seite geteilt"), ({ A }) =>
    unit
      ? tx(
          `You got rid of the $${A.d}$ under the $${v}$, but only on one side. Multiply the other side by $${A.d}$ too: **both** sides always get the same step.`,
          `Du hast die $${A.d}$ unter dem $${v}$ weggemacht, aber nur auf einer Seite. Multipliziere auch die andere Seite mit $${A.d}$: **Beide** Seiten bekommen immer denselben Schritt.`,
        )
      : A.d === 1
        ? tx(
            `You got rid of the $${n(A)}$ in front of $${v}$, but only on one side. Divide the other side by $${n(A)}$ too: **both** sides always get the same step.`,
            `Du hast die $${n(A)}$ vor dem $${v}$ weggemacht, aber nur auf einer Seite. Teile auch die andere Seite durch $${n(A)}$: **Beide** Seiten bekommen immer denselben Schritt.`,
          )
        : tx(
            `You got rid of the $${n(A)}$ in front of $${v}$, but only on one side. **Both** sides always get the same step.`,
            `Du hast den Bruch $${n(A)}$ vor dem $${v}$ weggemacht, aber nur auf einer Seite. **Beide** Seiten bekommen immer denselben Schritt.`,
          ),
  );
  push(solve({ subCoef: true }), tx("Subtracted instead of divided", "Subtrahiert statt geteilt"), ({ A }) =>
    tx(
      `Ah, I see what happened! $${A.n}${v}$ means $${A.n} \\cdot ${v}$, so you undo it by **dividing** by $${A.n}$, not by subtracting.`,
      `Ah, ich seh, was passiert ist! $${A.n}${v}$ bedeutet $${A.n} \\cdot ${v}$. Das machst du mit **Teilen** durch $${A.n}$ rückgängig, nicht mit Subtrahieren.`,
    ),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Exercise generator

export const VARS = ["x", "x", "x", "x", "x", "y", "a", "n"];

export function make(e: Eq, v: string, hint: Text, check = false): Exercise {
  const { frames, value, rel } = solveEq(e, v, { check });
  return {
    instruction: rel === "=" ? tx("Solve the equation", "Löse die Gleichung") : tx("Solve the inequality", "Löse die Ungleichung"),
    math: eqSrc(e, v, false),
    answer: rel === "=" ? { kind: "solutions", variable: v, values: [qvalue(value)] } : { kind: "inequality", variable: v, op: rel, value: qvalue(value) },
    hint,
    solution: frames,
    mistakes: eqMistakes(e, v, value, rel),
  };
}
