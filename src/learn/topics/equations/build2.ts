// Level 2 builders: equations and inequalities with fractions and decimals, equations whose x
// cancels (no solution or every number), and ratio equations. Each builder writes the animated
// worked solution with stable token keys and hands the rest to the level 1 solver.

import type { Locale } from "@/i18n/config";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { add, div as qdiv, frac, mul as qmul, show as qshow, value as qvalue, type Frac } from "@/learn/engine/frac";
import { lcm } from "@/learn/engine/rng";
import type { Frame, Mistake } from "@/learn/types";
import {
  applyOp,
  bodySrc,
  coef,
  combine,
  combineNote,
  eqSrc,
  equation,
  expandAll,
  expandItem,
  group,
  inner,
  isZero,
  itemSrc,
  join,
  joinText,
  joinWith,
  kk,
  mapText,
  opSrc,
  qsub,
  REL_FLIP,
  REL_TEXT,
  resultOp,
  sameQ,
  sideSrc,
  smoothFracExits,
  solveEq,
  term,
  termSrc,
  terms,
  type Eq,
  type Item,
  type Rel,
  type Term,
} from "./model";

// ---------------------------------------------------------------------------
// Numbers

/** A decimal for the display language: "1.5" in English, "1,5" in German. */
export const decTex = (v: number, l: Locale) => {
  const s = String(Math.round(v * 1e6) / 1e6);
  return l === "de" ? s.replace(".", ",") : s;
};
/** A number right after "{": grouped, so its minus reads as a sign, not as "minus". */
export const lead = (s: string | number) => (String(s).startsWith("-") ? `\\group{${s}}` : String(s));
/** "{ -2; 8 }" in German, "{ -2, 8 }" in English (the comma is the German decimal sign). */
export const setOf = (values: number[]): Text => {
  const sorted = [...values].sort((a, b) => a - b);
  return txMap((_, l) => (sorted.length ? `L = \\{ ${sorted.map((v, i) => (i ? decTex(v, l) : lead(decTex(v, l)))).join(l === "de" ? "; " : ", ")} \\}` : "L = \\{ \\}"));
};
/** "L = { x | x > 3 }" */
export const setBuilder = (v: string, rel: Rel, b: number | string): Text =>
  txMap((_, l) => `L = \\{ ${v} \\,|\\, ${v} ${REL_TEXT[rel]} ${typeof b === "number" ? decTex(b, l) : b} \\}`);
/** Interval notation as plain text: ]3; ∞[ in German, (3, ∞) in English. */
export function intervalText(rel: Exclude<Rel, "=">, b: number): Text {
  const n = (l: Locale) => decTex(b, l).replace("-", "−");
  return txMap((_, l) => {
    const de = l === "de";
    if (rel === ">") return de ? `]${n(l)}; ∞[` : `(${n(l)}, ∞)`;
    if (rel === "≥") return de ? `[${n(l)}; ∞[` : `[${n(l)}, ∞)`;
    if (rel === "<") return de ? `]−∞; ${n(l)}[` : `(−∞, ${n(l)})`;
    return de ? `]−∞; ${n(l)}]` : `(−∞, ${n(l)}]`;
  });
}

// ---------------------------------------------------------------------------
// Solving and typical mistakes

export type Run = { value: Frac; rel: Rel };

/** The solution of a linear equation or inequality (x² must cancel), or null when x cancels. */
export function linSolve(L: Item[], R: Item[], rel: Rel): Run | null {
  const l = expandAll(L);
  const r = expandAll(R);
  if (!sameQ(coef(l, 2), coef(r, 2))) return null;
  const A = qsub(coef(l, 1), coef(r, 1));
  if (isZero(A)) return null;
  return { value: qdiv(qsub(coef(r, 0), coef(l, 0)), A), rel: rel !== "=" && A.n < 0 ? REL_FLIP[rel] : rel };
}

const runKey = (r: Run) => `${r.rel === "=" ? "" : r.rel} ${Math.round(qvalue(r.value) * 1e6)}`;
const whenKey = (m: Mistake) =>
  m.when.kind === "solutions" ? ` ${Math.round((m.when.values[0] ?? NaN) * 1e6)}` : m.when.kind === "inequality" ? `${m.when.op} ${Math.round(m.when.value * 1e6)}` : JSON.stringify(m.when);

/** Typical mistakes of one task: never the right answer, never the same wrong answer twice. */
export function mistakeBag(right: Run, v: string, max = 5) {
  const out: Mistake[] = [];
  const seen = new Set([runKey(right)]);
  return {
    out,
    push(run: Run | null, title: Text, say: Text, close = false) {
      if (!run || out.length >= max || seen.has(runKey(run))) return;
      seen.add(runKey(run));
      const value = qvalue(run.value);
      out.push({
        when: run.rel === "=" ? { kind: "solutions", variable: v, values: [value] } : { kind: "inequality", variable: v, op: run.rel, value },
        title,
        say,
        close,
      });
    },
    merge(list: Mistake[]) {
      for (const m of list) {
        if (out.length >= max || seen.has(whenKey(m))) continue;
        seen.add(whenKey(m));
        out.push(m);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Fractions: a summand is sign · (u·x + a) / den (den 1: no fraction, then only u or a).

export type Piece = { id: string; sign: 1 | -1; u: number; a: number; den: number };

export function piece(id: string, sign: 1 | -1, u: number, a: number, den = 1): Piece {
  // A single term carries its sign in front: -\frac{x}{3}, not \frac{-x}{3}.
  if (!(u && a) && (u || a) < 0) return { id, sign: (sign * -1) as 1 | -1, u: -u, a: -a, den };
  return { id, sign, u, a, den };
}
const binomial = (p: Piece) => p.den > 1 && p.u !== 0 && p.a !== 0;

export function pieceSrc(p: Piece, v: string, first: boolean, keys = true): string {
  const K = (name: string) => kk(keys, `${name}${p.id}`);
  const sign = p.sign < 0 ? `-${K("s")} ` : first ? "" : `+${K("s")} `;
  if (!binomial(p)) {
    const body = bodySrc(term(p.id, p.u || p.a, p.u ? 1 : 0), v, keys);
    return p.den === 1 ? sign + body : `${sign}\\frac{${body}}{${p.den}${K("d")}}${K("f")}`;
  }
  const num = `${termSrc(term(`${p.id}0`, p.u, 1), v, true, keys)} ${termSrc(term(`${p.id}1`, p.a, 0), v, false, keys)}`;
  return `${sign}\\frac{${num}}{${p.den}${K("d")}}${K("f")}`;
}

export type FracSpec = { L: Piece[]; R: Piece[]; rel: Rel };
const piecesSrc = (list: Piece[], v: string, keys = true) => (list.length ? list.map((p, i) => pieceSrc(p, v, i === 0, keys)).join(" ") : "0");
export const fracSrc = (s: FracSpec, v: string, keys = true) => `${piecesSrc(s.L, v, keys)} ${s.rel}${kk(keys, "rel")} ${piecesSrc(s.R, v, keys)}`;
export const commonDen = (s: FracSpec) => [...s.L, ...s.R].reduce((m, p) => lcm(m, p.den), 1);

/** The summand after multiplying by k: a bracket for a numerator with two terms (none when the factor is 1). */
export function clearPiece(p: Piece, k: number): Item[] {
  const f = (p.sign * k) / p.den;
  if (binomial(p) && f === 1) return [term(`${p.id}0`, p.u, 1), term(`${p.id}1`, p.a)];
  if (binomial(p)) return [group(p.id, f, [inner(p.u, 1), inner(p.a)])];
  return [term(p.id, f * (p.u || p.a), p.u ? 1 : 0)];
}
export const clearSpec = (s: FracSpec, k = commonDen(s)): Eq => equation(s.L.flatMap((p) => clearPiece(p, k)), s.rel, s.R.flatMap((p) => clearPiece(p, k)));

const pieceValue = (p: Piece, x: Frac) => qmul(frac(p.sign), qdiv(add(qmul(frac(p.u), x), frac(p.a)), frac(p.den)));
const sideValue = (list: Piece[], x: Frac) => list.reduce((s, p) => add(s, pieceValue(p, x)), frac(0));

function pieceSubst(p: Piece, x: Frac, first: boolean): string {
  const sign = p.sign < 0 ? "- " : first ? "" : "+ ";
  const shown = x.n < 0 ? `(${qshow(x)})` : qshow(x);
  const lead = p.den > 1 || (first && p.sign > 0);
  const ux = p.u === 1 ? (lead ? qshow(x) : shown) : `${p.u} \\cdot ${shown}`;
  const num = p.u && p.a ? `${ux} ${p.a > 0 ? "+" : "-"} ${Math.abs(p.a)}` : p.u ? ux : String(p.a);
  return `${sign}${p.den > 1 ? `\\frac{${num}}{${p.den}}` : num}`;
}
const sideSubst = (list: Piece[], x: Frac) => list.map((p, i) => pieceSubst(p, x, i === 0)).join(" ");

/** The check in the original equation with fractions. */
export function fracCheck(s: FracSpec, v: string, x: Frac): Frame {
  const l = sideValue(s.L, x);
  const r = sideValue(s.R, x);
  const plainRight = s.R.length === 1 && !s.R[0].u && s.R[0].den === 1;
  const math = plainRight ? `${sideSubst(s.L, x)} = ${qshow(l)}` : `${sideSubst(s.L, x)} = ${qshow(l)} \\quad ${sideSubst(s.R, x)} = ${qshow(r)}`;
  return {
    math,
    note: tx(
      `Check: put $${v} = ${qshow(x)}$ into the original equation. Both sides give $${qshow(l)}$. It works!`,
      `Probe: Setz $${v} = ${qshow(x)}$ in die ursprüngliche Gleichung ein. Beide Seiten ergeben $${qshow(l)}$. Passt!`,
    ),
  };
}

/** Worked solution: find the common denominator, multiply every term, then solve as usual. */
export function fracFrames(s: FracSpec, v: string, opts: { check?: boolean; maxEm?: number; intro?: Text } = {}) {
  const k = commonDen(s);
  const all = [...s.L, ...s.R];
  const dens = [...new Set(all.filter((p) => p.den > 1).map((p) => p.den))].sort((a, b) => a - b);
  const src = fracSrc(s, v);
  const denList = join(dens.map((d) => `$${d}$`));
  const first: Text =
    dens.length > 1
      ? txMap((t, l) => `${t("The denominators are", "Die Nenner sind")} ${resolveText(denList, l)}. ${t(`Their common denominator is $${k}$.`, `Ihr Hauptnenner ist $${k}$.`)}`)
      : tx(`The denominator is $${k}$. Multiplying by $${k}$ clears the fraction.`, `Der Nenner ist $${k}$. Mit $${k}$ multipliziert ist der Bruch weg.`);
  const frames: Frame[] = [
    { math: src, note: joinText(opts.intro, first) },
    {
      math: src + opSrc({ kind: "mul", k }, 0, v),
      highlight: ["qO0", "qkO0"],
      note: all.some((p) => p.den === 1)
        ? tx(`Multiply **every** term by $${k}$, the ones without a fraction too.`, `Multipliziere **jeden** Term mit $${k}$, auch die ohne Bruch.`)
        : tx(`Multiply **every** term by $${k}$.`, `Multipliziere **jeden** Term mit $${k}$.`),
    },
  ];
  const products = all.map((p) => `$${k} \\cdot ${pieceSrc({ ...p, sign: 1 }, v, true, false)} = ${sideSrc(clearPiece({ ...p, sign: 1 }, k), v, false)}$`);
  const said: Text = products.length <= 3 ? mapText(join(products), (x) => `${x}.`) : tx("Work out each product.", "Rechne jedes Produkt aus.");
  const cleared = clearSpec(s, k);
  const solved = solveEq(cleared, v, {
    maxEm: opts.maxEm,
    intro: joinText(said, all.some(binomial) ? tx("Each numerator keeps its bracket!", "Jeder Zähler bleibt in seiner Klammer!") : ""),
  });
  frames.push(...solved.frames);
  if (opts.check && s.rel === "=") frames.push(fracCheck(s, v, solved.value));
  return { frames: smoothFracExits(frames), value: solved.value, rel: solved.rel, cleared, k };
}

/** The typical slips with fractions, worked out for this task. */
export function fracMistakes(s: FracSpec, v: string, right: Run, extra: Mistake[] = []) {
  const k = commonDen(s);
  const bag = mistakeBag(right, v);
  const all = [...s.L, ...s.R];
  const rebuild = (swap: (p: Piece, cleared: Item[]) => Item[]) => {
    const side = (list: Piece[]) => list.flatMap((p) => swap(p, clearPiece(p, k)));
    return linSolve(side(s.L), side(s.R), s.rel);
  };
  for (const p of all.filter(binomial)) {
    const g = sideSrc(clearPiece({ ...p, sign: 1 }, k), v, false);
    const f = (p.sign * k) / p.den;
    // 6 · (x − 2)/3 written as 2x − 2: the numerator lost its bracket.
    bag.push(
      rebuild((q, c) => (q === p ? [term("", f * p.u, 1), term("", p.a)] : c)),
      tx("Numerator without brackets", "Zähler ohne Klammer"),
      tx(
        `Ah, I see what happened! When the fraction goes, its numerator becomes a bracket: $${k} \\cdot ${pieceSrc({ ...p, sign: 1 }, v, true, false)} = ${g}$. Without the bracket only the $${v}$ gets multiplied.`,
        `Ah, ich seh, was passiert ist! Wenn der Bruch verschwindet, wird sein Zähler zur Klammer: $${k} \\cdot ${pieceSrc({ ...p, sign: 1 }, v, true, false)} = ${g}$. Ohne Klammer wird nur das $${v}$ multipliziert.`,
      ),
    );
    if (p.sign < 0) {
      // −2(x − 2) → −2x − 4: the minus didn't reach the second term.
      bag.push(
        rebuild((q, c) => (q === p ? [term("", f * p.u, 1), term("", -f * p.a)] : c)),
        tx("Minus only on the first term", "Minus nur beim ersten Term"),
        tx(
          `Careful with the minus in front of the fraction! It belongs to the **whole** numerator, so it flips the sign of **every** term in the bracket: $-${g} = ${sideSrc(clearPiece(p, k).flatMap(expandItem), v, false)}$.`,
          `Vorsicht mit dem Minus vor dem Bruch! Es gehört zum **ganzen** Zähler und dreht deshalb das Vorzeichen **jedes** Terms in der Klammer um: $-${g} = ${sideSrc(clearPiece(p, k).flatMap(expandItem), v, false)}$.`,
        ),
      );
    }
  }
  const plain = all.filter((p) => p.den === 1);
  const many = all.filter((p) => p.den > 1).length > 1;
  if (plain.length && k > 1) {
    const names = plain.map((p) => `$${pieceSrc({ ...p, sign: 1 }, v, true, false)}$`);
    bag.push(
      rebuild((q, c) => (q.den === 1 ? [term(q.id, q.sign * (q.u || q.a), q.u ? 1 : 0)] : c)),
      tx("Not every term multiplied", "Nicht jeden Term multipliziert"),
      txMap(
        (t) =>
          `${many ? t("Ah, I see what happened! You multiplied the fractions by", "Ah, ich seh, was passiert ist! Du hast die Brüche mit") : t("Ah, I see what happened! You multiplied the fraction by", "Ah, ich seh, was passiert ist! Du hast den Bruch mit")} $${k}$${t(", but not", " multipliziert, aber nicht")} ${joinWith(names, t("and", "und"))}. ${t(`**Every** term gets multiplied by $${k}$.`, `**Jeder** Term wird mit $${k}$ multipliziert.`)}`,
      ),
    );
  }
  bag.merge(extra);
  return bag.out;
}

// ---------------------------------------------------------------------------
// Decimals: an equation with whole-number coefficients, shown divided by 10.

function decTermSrc(x: Term, v: string, first: boolean, scale: number, l: Locale): string {
  const sign = x.c.n < 0 ? `-#s${x.id} ` : first ? "" : `+#s${x.id} `;
  const n = Math.abs(qvalue(x.c)) / scale;
  if (x.p === 0) return `${sign}${decTex(n, l)}#c${x.id}`;
  return n === 1 ? `${sign}${v}#v${x.id}` : `${sign}${decTex(n, l)}#c${x.id} ${v}#v${x.id}`;
}
const decSide = (list: Term[], v: string, scale: number, l: Locale) => list.map((x, i) => decTermSrc(x, v, i === 0, scale, l)).join(" ");
/** The decimal version of an equation with whole-number terms (every coefficient divided by `scale`). */
export const decSrc = (e: Eq, v: string, scale = 10): Text => txMap((_, l) => `${decSide(terms(e.L), v, scale, l)} ${e.rel}#rel ${decSide(terms(e.R), v, scale, l)}`);
const decPlain = (x: Term, v: string, scale: number, l: Locale) => decTermSrc({ ...x, c: frac(Math.abs(x.c.n)) }, v, true, scale, l).replace(/#[A-Za-z0-9_-]+/g, "");

/** Worked solution for decimals: times 10, then solve the whole-number equation. */
export function decFrames(e: Eq, v: string, opts: { maxEm?: number } = {}) {
  const scale = 10;
  const src = decSrc(e, v, scale);
  const all = terms([...e.L, ...e.R]);
  const frames: Frame[] = [
    {
      math: src,
      note: tx(
        "Decimals with one digit after the point: multiply by $10$ and they become whole numbers.",
        "Dezimalzahlen mit einer Nachkommastelle: Multipliziere mit $10$, dann werden daraus ganze Zahlen.",
      ),
    },
    {
      math: mapText(src, (s) => s + opSrc({ kind: "mul", k: scale }, 0, v)),
      highlight: ["qO0", "qkO0"],
      note: tx(`Multiply **every** term by $10$. The point moves one place to the right.`, `Multipliziere **jeden** Term mit $10$. Das Komma rutscht eine Stelle nach rechts.`),
    },
  ];
  const decimals = all.filter((x) => Math.abs(x.c.n) % scale !== 0).slice(0, 3);
  const said = txMap((t, l) => {
    const parts = decimals.map((x) => `$10 \\cdot ${decPlain(x, v, scale, l)} = ${termSrc({ ...x, c: frac(Math.abs(x.c.n)) }, v, true, false)}$`);
    return `${joinWith(parts, t("and", "und"))}. ${t("No more decimals!", "Keine Kommazahlen mehr!")}`;
  });
  const solved = solveEq(e, v, { intro: said, maxEm: opts.maxEm });
  frames.push(...solved.frames);
  return { frames, value: solved.value, rel: solved.rel };
}

/** Typical slips with decimals: the whole numbers not multiplied by 10. */
export function decMistakes(e: Eq, v: string, right: Run, extra: Mistake[] = []) {
  const bag = mistakeBag(right, v);
  const whole = terms([...e.L, ...e.R]).filter((x) => Math.abs(x.c.n) % 10 === 0);
  if (whole.length) {
    const shrink = (list: Item[]) => terms(list).map((x) => (whole.includes(x) ? { ...x, c: frac(x.c.n / 10) } : x));
    const names = whole.map((x) => `$${Math.abs(x.c.n / 10)}${x.p ? v : ""}$`);
    bag.push(
      linSolve(shrink(e.L), shrink(e.R), e.rel),
      tx("Not every term multiplied", "Nicht jeden Term multipliziert"),
      txMap(
        (t) =>
          `${t("Ah, I see what happened! The decimals got multiplied by $10$, but", "Ah, ich seh, was passiert ist! Die Kommazahlen hast du mit $10$ multipliziert, aber")} ${joinWith(names, t("and", "und"))} ${t(
            "didn't. **Every** term gets multiplied, whole numbers too.",
            "nicht. **Jeder** Term wird multipliziert, auch die ganzen Zahlen.",
          )}`,
      ),
    );
  }
  bag.merge(extra);
  return bag.out;
}

// ---------------------------------------------------------------------------
// When x cancels: a false statement (no solution) or a true one (every number).

export type CancelKind = "none" | "all";

/** Worked solution for an equation whose x-terms cancel. `left`/`right`: the numbers that are left. */
export function cancelFrames(start: Eq, v: string, maxEm = 13): { frames: Frame[]; kind: CancelKind; left: Frac; right: Frac } {
  const frames: Frame[] = [];
  let e = start;
  const brackets = [...e.L, ...e.R].filter((it) => it.kind !== "t");
  if (brackets.length) {
    frames.push({
      math: eqSrc(e, v),
      highlight: brackets.flatMap((b) => (b.kind === "g" ? [`b${b.id}(`, `b${b.id})`] : [])),
      note: tx("Expand the brackets first.", "Löse zuerst die Klammern auf."),
    });
    const said = brackets.map((b) => `$${itemSrc(b, v, true, false)} = ${sideSrc(expandItem(b), v, false)}$`);
    e = { ...e, L: expandAll(e.L), R: expandAll(e.R) };
    frames.push({ math: eqSrc(e, v), note: mapText(join(said), (s) => `${s}.`) });
  } else frames.push({ math: eqSrc(e, v), note: tx(`Collect the $${v}$-terms on one side.`, `Bring die $${v}$-Terme auf eine Seite.`) });
  const needs = (list: Item[]) => new Set(terms(list).map((x) => x.p)).size < list.length;
  if (needs(e.L) || needs(e.R)) {
    const parts = [...combineNote(terms(e.L), v), ...combineNote(terms(e.R), v)];
    e = { ...e, L: combine(terms(e.L)), R: combine(terms(e.R)) };
    frames.push({ math: eqSrc(e, v), note: tx(`Tidy up: ${joinWith(parts, "and")}.`, `Fasse zusammen: ${joinWith(parts, "und")}.`) });
  }
  const a = coef(e.R, 1);
  if (!isZero(a)) {
    const x = term("", qmul(frac(-1), a), 1);
    const shown = `$${bodySrc({ ...x, c: frac(Math.abs(a.n), a.d) }, v, false)}$`;
    const app = applyOp(e, { kind: "add", x }, 1, v, maxEm);
    frames.push({
      math: app.math,
      highlight: app.highlight,
      note: tx(`${a.n > 0 ? "Subtract" : "Add"} ${shown} on both sides.`, `${a.n > 0 ? "Subtrahiere" : "Addiere"} ${shown} auf beiden Seiten.`),
    });
    e = resultOp(e, { kind: "add", x }, 1, v).eq;
  }
  const left = coef(e.L, 0);
  const right = coef(e.R, 0);
  const st = `$${qshow(left)} = ${qshow(right)}$`;
  const kind: CancelKind = sameQ(left, right) ? "all" : "none";
  frames.push({
    math: eqSrc(e, v),
    note:
      kind === "none"
        ? tx(`The $${v}$ is gone, and ${st} is **false**. No number can make it true.`, `Das $${v}$ ist weg, und ${st} ist **falsch**. Keine Zahl kann daran etwas ändern.`)
        : tx(`The $${v}$ is gone, and ${st} is **always true**, whatever $${v}$ is.`, `Das $${v}$ ist weg, und ${st} ist **immer wahr**, egal, was $${v}$ ist.`),
  });
  frames.push(
    kind === "none"
      ? { math: "L = \\{ \\}", note: tx("No solution: the solution set is empty, $L = \\{ \\}$.", "Keine Lösung: Die Lösungsmenge ist leer, $L = \\{ \\}$.") }
      : { math: "L = ℚ", note: tx("Every number is a solution: $L =$ ℚ, all rational numbers.", "Jede Zahl ist eine Lösung: $L =$ ℚ, alle rationalen Zahlen.") },
  );
  return { frames, kind, left, right };
}

// ---------------------------------------------------------------------------
// Ratio equations a : b = c : d (or as fractions): outer times outer = inner times inner.

/** Four terms, one of them the unknown (null). */
export type Ratio = { t: (number | null)[]; form: "colon" | "frac" };

export function ratioSrc(r: Ratio, v: string, keys = true): string {
  const s = (i: number) => `${r.t[i] === null ? v : r.t[i]}${kk(keys, `t${i}`)}`;
  return r.form === "colon"
    ? `${s(0)} :${kk(keys, "d1")} ${s(1)} =${kk(keys, "rel")} ${s(2)} :${kk(keys, "d2")} ${s(3)}`
    : `\\frac{${s(0)}}{${s(1)}}${kk(keys, "f1")} =${kk(keys, "rel")} \\frac{${s(2)}}{${s(3)}}${kk(keys, "f2")}`;
}

export function ratioValue(r: Ratio): number {
  const pos = r.t.indexOf(null);
  const partner = r.t[3 - pos] as number;
  const pair = pos === 0 || pos === 3 ? [r.t[1], r.t[2]] : [r.t[0], r.t[3]];
  return ((pair[0] as number) * (pair[1] as number)) / partner;
}

export function ratioFrames(r: Ratio, v: string): Frame[] {
  const pos = r.t.indexOf(null);
  const partner = r.t[3 - pos] as number;
  const pair = pos === 0 || pos === 3 ? [1, 2] : [0, 3];
  const product = (r.t[pair[0]] as number) * (r.t[pair[1]] as number);
  const x = product / partner;
  const s = (i: number) => `${r.t[i] === null ? v : r.t[i]}#t${i}`;
  const outerFirst = pos === 0 || pos === 3;
  const words =
    r.form === "colon"
      ? tx("Outer terms times each other, inner terms times each other: the two products are equal.", "Außenglieder mal Außenglieder, Innenglieder mal Innenglieder: Die beiden Produkte sind gleich.")
      : tx("Multiply crosswise: each numerator times the other denominator.", "Multipliziere über Kreuz: jeden Zähler mit dem anderen Nenner.");
  const xSide = `${partner}#t${3 - pos} ${v}#t${pos}`;
  const frames: Frame[] = [
    {
      math: ratioSrc(r, v),
      note:
        r.form === "colon"
          ? tx("A ratio equation: two ratios are equal.", "Eine Verhältnisgleichung: Zwei Verhältnisse sind gleich.")
          : tx("Two fractions are equal: a ratio equation in fraction form.", "Zwei Brüche sind gleich: eine Verhältnisgleichung in Bruchform."),
    },
    {
      math: ratioSrc(r, v),
      arrows: r.form === "colon" ? [["t0", "t3"], ["t1", "t2"]] : [["t0", "t3"], ["t2", "t1"]],
      highlight: outerFirst ? ["t0", "t3"] : ["t1", "t2"],
      note: words,
    },
    {
      math: `${s(0)} \\cdot#m1 ${s(3)} =#rel ${s(1)} \\cdot#m2 ${s(2)}`,
      note: tx(`So $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`, `Also $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`),
    },
    {
      math: `${xSide} =#rel ${product}#p \\quad |#bar \\, :#q ${partner}#qk`,
      highlight: ["q", "qk"],
      note: tx(
        `${outerFirst ? "" : "Swap the sides. "}$${r.t[pair[0]]} \\cdot ${r.t[pair[1]]} = ${product}$. Now divide by $${partner}$.`,
        `${outerFirst ? "" : "Seiten tauschen. "}$${r.t[pair[0]]} \\cdot ${r.t[pair[1]]} = ${product}$. Jetzt teilst du durch $${partner}$.`,
      ),
    },
    { math: `${v}#t${pos} =#rel ${x}#p`, note: tx(`$${product} : ${partner} = ${x}$. So $${v} = ${x}$.`, `$${product} : ${partner} = ${x}$. Also ist $${v} = ${x}$.`) },
  ];
  const filled = r.t.map((t) => (t === null ? x : t)) as number[];
  const shownX = (i: number) => (filled[i] < 0 ? `(${filled[i]})` : String(filled[i]));
  frames.push({
    math: `${shownX(0)} \\cdot ${shownX(3)} = ${filled[0] * filled[3]} \\quad ${shownX(1)} \\cdot ${shownX(2)} = ${filled[1] * filled[2]}`,
    note: tx(`Check: both products are $${product}$. It works!`, `Probe: Beide Produkte sind $${product}$. Passt!`),
  });
  return smoothFracExits(frames);
}

/** Typical slips with ratios: the wrong pairs multiplied, or differences instead of ratios. */
export function ratioMistakes(r: Ratio, v: string): Mistake[] {
  const x = ratioValue(r);
  const pos = r.t.indexOf(null);
  const out: Mistake[] = [];
  const add = (value: number, title: Text, say: Text) => {
    if (!Number.isFinite(value) || Math.abs(value - x) < 1e-9 || out.some((m) => m.when.kind === "solutions" && Math.abs(m.when.values[0] - value) < 1e-9)) return;
    out.push({ when: { kind: "solutions", variable: v, values: [value] }, title, say });
  };
  // Straight pairs: t0·t2 = t1·t3.
  const other = pos % 2 === 0 ? r.t[2 - pos] : r.t[4 - pos];
  const rest = pos % 2 === 0 ? [r.t[1], r.t[3]] : [r.t[0], r.t[2]];
  const straight = ((rest[0] as number) * (rest[1] as number)) / (other as number);
  const pairText =
    r.form === "colon"
      ? tx(
          `Ah, I see what happened! You multiplied the wrong pairs. It's **outer** times **outer** and **inner** times **inner**: $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`,
          `Ah, ich seh, was passiert ist! Du hast die falschen Paare multipliziert. Es heißt **Außenglieder** mal **Außenglieder** und **Innenglieder** mal **Innenglieder**: $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`,
        )
      : tx(
          `Ah, I see what happened! You multiplied numerator with numerator and denominator with denominator. Crosswise means each numerator times the **other** denominator: $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`,
          `Ah, ich seh, was passiert ist! Du hast Zähler mit Zähler und Nenner mit Nenner multipliziert. Über Kreuz heißt: jeder Zähler mal den **anderen** Nenner: $${r.t[0] ?? v} \\cdot ${r.t[3] ?? v} = ${r.t[1] ?? v} \\cdot ${r.t[2] ?? v}$.`,
        );
  add(straight, tx("Wrong pairs multiplied", "Falsche Paare multipliziert"), pairText);
  // Thinking in differences: x : 4 = 6 : 8 → "8 is 2 more than 6, so x is 2 less than 4".
  if (pos === 0 || pos === 3) {
    const t = r.t as number[];
    // x : t1 = t2 : t3 → "x is as far below t1 as t2 is below t3"; t0 : t1 = t2 : x → the same gap after t2.
    const [b, c] = pos === 0 ? [t[2], t[3]] : [t[0], t[1]];
    const diff = pos === 0 ? t[1] - (t[3] - t[2]) : t[2] + (t[1] - t[0]);
    if (diff > 0)
      add(
        diff,
        tx("Difference instead of ratio", "Differenz statt Verhältnis"),
        tx(
          `I think I know what you did: you went by the **difference** between $${b}$ and $${c}$. But equal ratios are about **multiplying**: the same factor, not the same gap.`,
          `Ich glaub, ich weiß, was du gemacht hast: Du bist nach dem **Unterschied** zwischen $${b}$ und $${c}$ gegangen. Bei gleichen Verhältnissen geht es aber ums **Multiplizieren**: der gleiche Faktor, nicht der gleiche Abstand.`,
        ),
      );
  }
  // Divided the wrong way round at the end.
  const partner = r.t[3 - pos] as number;
  const pair = pos === 0 || pos === 3 ? [r.t[1], r.t[2]] : [r.t[0], r.t[3]];
  const product = (pair[0] as number) * (pair[1] as number);
  add(
    partner / product,
    tx("Divided the wrong way round", "Falsch herum geteilt"),
    tx(
      `Nearly! You have $${partner}${v} = ${product}$, so you divide **${product} by ${partner}**, not the other way round.`,
      `Fast! Da steht $${partner}${v} = ${product}$, also teilst du **${product} durch ${partner}**, nicht umgekehrt.`,
    ),
  );
  return out;
}

