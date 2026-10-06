"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { topicMeta } from "@/learn/catalog";
import { add, div, mul, sub, type Frac } from "@/learn/engine/frac";
import { gcd, lcm, type Rng } from "@/learn/engine/rng";
import type { AnswerSpec, Exercise, Frame, Level, Mistake, SingleLessonTopic as Topic } from "@/learn/types";
import { alongLine, crossing, Plane, PlaneDot, PlaneLine, PlanePath, PlaneTag, planeGeo, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { graphVisual, lineSrc, mistakeList, num, opDivide, opRemove, plain, pt, q, qv, side, term, termKeys, val, valWrap, type Msg } from "./lines";

// ---------------------------------------------------------------------------
// Equations in x and y, rendered with stable keys: equation I uses the ids
// "1x", "1y", "1c" (terms) and "e1" (its equals sign), equation II "2x", "2y",
// "2c", "e2". So when II is multiplied, numbers change in place, and when the
// equations are added, every term glides into the sum.

type V = "x" | "y";
/** Standard form: x·x + y·y = c. */
type Std = { x: number; y: number; c: number };
/** Solved form: v = m·(other) + n. */
type Solved = { v: V; m: number; n: number };

const other = (v: V): V => (v === "x" ? "y" : "x");

/** Display source of a frame (the keys are the same in both languages). */
const srcOf = (t: Text) => (typeof t === "string" ? t : t.en);
/** Sentences joined with a space; empty parts are skipped. */
const joinText = (...parts: (Text | undefined)[]): Text =>
  txMap((_, locale) =>
    parts
      .map((p) => resolveText(p, locale))
      .filter(Boolean)
      .join(" "),
  );
const VARS: V[] = ["x", "y"];

/** Write "y − 2x" rather than "−2x + y", so an equation doesn't start with a minus. */
const yFirst = (e: Std) => e.x < 0 && e.y > 0;

function stdSrc(e: Std, id: string): string {
  const xs: [number, string, string] = [e.x, "x", `${id}x`];
  const ys: [number, string, string] = [e.y, "y", `${id}y`];
  return `${side(yFirst(e) ? [ys, xs] : [xs, ys])} =#e${id} ${val(e.c, `${id}c`)}`;
}

/** Both coefficients negative? Flip the whole equation, it reads nicer. */
const tidy = (e: Std): Std => (e.x < 0 && e.y < 0 ? { x: -e.x, y: -e.y, c: -e.c } : e);

function rhsSrc(e: Solved, id: string): string {
  return side([
    [e.m, other(e.v), `${id}${other(e.v)}`],
    [e.n, "", `${id}c`],
  ]);
}

function solvedSrc(e: Solved, id: string): string {
  return `${e.v}#w${id} =#e${id} ${rhsSrc(e, id)}`;
}

/**
 * Both equations, labelled (I) and (II). Each one is a style group so it never
 * breaks in the middle: when space is short, (II) moves below (I) as a whole.
 */
function sysSrc(a: string, b: string, la = "(I)", lb = "(II)", tone: [string, string] = ["blob", "blob"]): string {
  return `\\${tone[0]}{"${la}"#L1 ${a}}#G1 \\quad \\${tone[1]}{"${lb}"#L2 ${b}}#G2`;
}

/** The solution set L = {(x | y)}. */
const resultSrc = (x: number, y: number) => `L#Lr =#Er "{"#Lo (${val(x, "rx")} \\, |#rb${y < 0 ? "" : " \\,"} ${val(y, "ry")})#rp "}"#Lc`;

/** c·value as a term of a sum, e.g. "− 3 · (−2)". The coefficient keeps the term's keys. */
function prodTerm(c: number, value: number, id: string, first: boolean): string {
  const sign = c < 0 ? `-#s${id} ` : first ? "" : `+#s${id} `;
  const a = Math.abs(c);
  // Negative numbers go in brackets when they're put in for a variable.
  if (a === 1) return `${sign}${valWrap(value, `k${id}`)}`;
  return `${sign}${a}#c${id} \\cdot#d${id} ${valWrap(value, `k${id}`)}`;
}

const scale = (e: Std, k: number): Std => ({ x: e.x * k, y: e.y * k, c: e.c * k });
const holds = (e: Std, x: number, y: number) => e.x * x + e.y * y === e.c;

function checkNote(e: Std, x: number, y: number, name: string): Text {
  const calc = `$${plain(`${prodTerm(e.x, x, "a", true)} ${prodTerm(e.y, y, "b", false)}`)} = ${e.c}$`;
  return tx(`Check in ${name}: ${calc}. True!`, `Probe mit ${name}: ${calc}. Stimmt!`);
}

// ---------------------------------------------------------------------------
// Worked-solution builders

/** Finish K·v + D = R: take D away, divide by K. */
function solveSteps(o: { K: number; v: V; D: number; R: number; vid: string; did: string; rid: string; eq: string; dFirst?: boolean; lead: Text }): Frame[] {
  const { K, v, D, R, vid, did, rid, eq } = o;
  const left = (withD: boolean) => {
    const list: [number, string, string][] = [[K, v, vid]];
    if (withD && D !== 0) {
      if (o.dFirst) list.unshift([D, "", did]);
      else list.push([D, "", did]);
    }
    return side(list);
  };
  const R2 = R - D;
  const U = R2 / K;
  const frames: Frame[] = [];
  const lead = (s: Text) => (frames.length === 0 ? joinText(o.lead, s) : s);
  if (D !== 0) {
    const d = Math.abs(D);
    frames.push({
      math: `${left(true)} =#${eq} ${val(R, rid)}${opRemove(D)}`,
      note: lead(tx(`${D > 0 ? "Subtract" : "Add"} $${d}$ on both sides.`, `${D > 0 ? "Subtrahiere" : "Addiere"} $${d}$ auf beiden Seiten.`)),
    });
  }
  if (K !== 1) frames.push({ math: `${left(false)} =#${eq} ${val(R2, rid)}${opDivide(K)}`, note: lead(tx(`Divide both sides by $${K}$.`, `Teile beide Seiten durch $${K}$.`)) });
  frames.push({ math: `${v}#v${vid} =#${eq} ${val(U, rid)}`, note: lead(tx(`So $${v} = ${U}$.`, `Also ist $${v} = ${U}$.`)) });
  return frames;
}

/** Put a known value into equation e and solve for the other variable. */
function backSteps(e: Std, id: string, name: string, known: V, value: number): Frame[] {
  const u = other(known);
  const kid = `${id}${known}`;
  const uid = `${id}${u}`;
  const first = yFirst(e) ? known === "y" : known === "x";
  const withProd = first ? `${prodTerm(e[known], value, kid, true)} ${term(e[u], u, uid, false)}` : `${term(e[u], u, uid, true)} ${prodTerm(e[known], value, kid, false)}`;
  const put = tx(`Put $${known} = ${value}$ into ${name}.`, `Setze $${known} = ${value}$ in ${name} ein.`);
  const args = { K: e[u], v: u, D: e[known] * value, R: e.c, vid: uid, did: kid, rid: `${id}c`, eq: `e${id}`, dFirst: first };
  const rest = solveSteps({ ...args, lead: tx("Work it out.", "Rechne aus.") });
  const shown = `${withProd} =#e${id} ${val(e.c, `${id}c`)}`;
  // With a plain value (no product to work out) the first step is already the next picture.
  if (plain(srcOf(rest[0].math)).startsWith(plain(shown).trim())) {
    const bare = solveSteps({ ...args, lead: "" });
    return [{ ...bare[0], note: joinText(put, bare[0].note) }, ...bare.slice(1)];
  }
  return [{ math: shown, note: put }, ...rest];
}

const specialFrame = (left: string, right: string, eq: string, ok: boolean): string => `${ok ? "\\green" : "\\red"}{${left} =#${eq} ${right}}`;
const NONE_NOTE = tx("**No solution**: the lines are parallel and never meet.", "**Keine Lösung**: Die Geraden sind parallel und schneiden sich nie.");
const MANY_NOTE = tx("**Infinitely many** solutions: both equations describe the same line.", "**Unendlich viele** Lösungen: Beide Gleichungen beschreiben dieselbe Gerade.");

/** Einsetzungsverfahren: I is solved for a variable, put it into II. */
function substitution(s: Solved, e: Std, sol: [number, number] | null): Frame[] {
  const sv = s.v;
  const ov = other(sv);
  const qs = e[sv];
  const qo = e[ov];
  const bracket = `(${rhsSrc(s, "1")})#br`;
  const sTerm = (first: boolean) => {
    const sign = qs < 0 ? `-#s2${sv} ` : first ? "" : `+#s2${sv} `;
    return `${sign}${Math.abs(qs) === 1 ? "" : `${Math.abs(qs)}#c2${sv} `}${bracket}`;
  };
  const subbed = VARS.map((v, i) => (v === sv ? sTerm(i === 0) : term(qo, ov, `2${ov}`, i === 0))).join(" ");
  const expandedList: [number, string, string][] = VARS.flatMap((v): [number, string, string][] =>
    v === sv
      ? [
          [qs * s.m, ov, `1${ov}`],
          [qs * s.n, "", "1c"],
        ]
      : [[qo, ov, `2${ov}`]],
  );
  const ovTerms = expandedList.filter(([c, v]) => v === ov && c !== 0);
  const K = qs * s.m + qo;
  const D = qs * s.n;
  const right = val(e.c, "2c");
  const frames: Frame[] = [
    {
      math: sysSrc(solvedSrc(s, "1"), stdSrc(e, "2")),
      highlight: [...termKeys(`1${ov}`), ...termKeys("1c")],
      note: tx(`Equation (I) already says what $${sv}$ is.`, `Gleichung (I) ist schon nach $${sv}$ aufgelöst.`),
    },
    {
      math: `${subbed} =#e2 ${right}`,
      highlight: ["br(", "br)"],
      note: tx(
        `**Substitute**: in (II), put $(${plain(rhsSrc(s, "1"))})$ in place of $${sv}$. Keep the brackets!`,
        `**Einsetzen**: Setze in (II) $(${plain(rhsSrc(s, "1"))})$ für $${sv}$ ein. Klammern nicht vergessen!`,
      ),
    },
    {
      math: `${side(expandedList)} =#e2 ${right}`,
      note:
        qs === 1
          ? tx("A plus in front: just drop the brackets.", "Ein Plus davor: Lass die Klammern einfach weg.")
          : qs === -1
            ? tx("A minus in front: drop the brackets and flip every sign inside.", "Ein Minus davor: Lass die Klammern weg und dreh jedes Vorzeichen darin um.")
            : tx(`Multiply out: $${qs}$ times each term in the bracket.`, `Ausmultiplizieren: $${qs}$ mal jeden Term in der Klammer.`),
    },
  ];
  const sum = `$${plain(side(ovTerms))} = ${plain(side([[K, ov, "k"]]))}$`;
  const combine = tx(`Combine the $${ov}$-terms: ${sum}.`, `Fasse die $${ov}$-Terme zusammen: ${sum}.`);
  if (K === 0) {
    const ok = D === e.c;
    const said = ok
      ? tx(`The $${ov}$-terms cancel. $${D} = ${e.c}$ is always true, whatever $${ov}$ is.`, `Die $${ov}$-Terme fallen weg. $${D} = ${e.c}$ ist immer wahr, egal was $${ov}$ ist.`)
      : tx(`The $${ov}$-terms cancel. $${D} = ${e.c}$ is false.`, `Die $${ov}$-Terme fallen weg. $${D} = ${e.c}$ ist falsch.`);
    frames.push({ math: specialFrame(val(D, "1c"), right, "e2", ok), note: joinText(said, ok ? MANY_NOTE : NONE_NOTE) });
    return frames;
  }
  frames.push(...solveSteps({ K, v: ov, D, R: e.c, vid: ovTerms[0][2], did: "1c", rid: "2c", eq: "e2", lead: combine }));
  const known = (e.c - D) / K;
  const value = s.m * known + s.n;
  frames.push({
    math: `${sv}#w1 =#e1 ${prodTerm(s.m, known, `1${ov}`, true)} ${term(s.n, "", "1c", false)} =#e3 ${val(value, "res")}`,
    note: putInto(ov, known, sv, value),
  });
  const [x, y] = sv === "y" ? [known, value] : [value, known];
  if (sol) frames.push({ math: resultSrc(x, y), note: joinText(solutionIs(x, y), checkNote(e, x, y, "(II)")) });
  return frames;
}

/** "Put y = 3 into (I): x = 5." */
const putInto = (o: V, known: number, v: V, value: number) =>
  tx(`Put $${o} = ${known}$ into (I): $${v} = ${value}$.`, `Setze $${o} = ${known}$ in (I) ein: $${v} = ${value}$.`);
const solutionIs = (x: number, y: number) => tx(`The solution is $x = ${x}$, $y = ${y}$.`, `Die Lösung ist $x = ${x}$, $y = ${y}$.`);

/** Gleichsetzungsverfahren: both equations are solved for the same variable. */
function equalization(s1: Solved, s2: Solved, sol: [number, number] | null): Frame[] {
  const v = s1.v;
  const o = other(v);
  const frames: Frame[] = [
    { math: sysSrc(solvedSrc(s1, "1"), solvedSrc(s2, "2")), highlight: ["w1", "w2"], note: tx(`Both equations are solved for $${v}$.`, `Beide Gleichungen sind nach $${v}$ aufgelöst.`) },
  ];
  const setEqual = tx(
    `**Set them equal**: both right sides are equal to $${v}$, so they are equal to each other.`,
    `**Gleichsetzen**: Beide rechten Seiten stehen für $${v}$, also sind sie gleich.`,
  );
  const K = s1.m - s2.m;
  if (s2.m !== 0) {
    frames.push({
      math: `${rhsSrc(s1, "1")} =#e1 ${rhsSrc(s2, "2")}${opRemove(s2.m, o)}`,
      note: joinText(setEqual, tx(`Then bring the $${o}$-terms to the left.`, `Bring dann die $${o}$-Terme nach links.`)),
    });
  }
  const lead = s2.m !== 0 ? tx(`Now all $${o}$-terms are on the left.`, `Jetzt stehen alle $${o}$-Terme links.`) : setEqual;
  if (K === 0) {
    const ok = s1.n === s2.n;
    const said = tx(
      `The $${o}$-terms cancel and $${s1.n} = ${s2.n}$ is ${ok ? "always true" : "false"}.`,
      `Die $${o}$-Terme fallen weg und $${s1.n} = ${s2.n}$ ist ${ok ? "immer wahr" : "falsch"}.`,
    );
    frames.push({ math: specialFrame(val(s1.n, "1c"), val(s2.n, "2c"), "e1", ok), note: joinText(said, ok ? MANY_NOTE : NONE_NOTE) });
    return frames;
  }
  frames.push(...solveSteps({ K, v: o, D: s1.n, R: s2.n, vid: `1${o}`, did: "1c", rid: "2c", eq: "e1", lead }));
  const known = (s2.n - s1.n) / K;
  const value = s1.m * known + s1.n;
  frames.push({
    math: `${v}#w1 =#e1 ${prodTerm(s1.m, known, `1${o}`, true)} ${term(s1.n, "", "1c", false)} =#e3 ${val(value, "res")}`,
    note: putInto(o, known, v, value),
  });
  const [x, y] = v === "y" ? [known, value] : [value, known];
  if (sol) {
    const S = `$${pt(x, y, "S")}$`;
    frames.push({ math: resultSrc(x, y), note: joinText(solutionIs(x, y), tx(`The lines cross at ${S}.`, `Die Geraden schneiden sich in ${S}.`)) });
  }
  return frames;
}

type Plan = { ev: V; m1: number; m2: number; subtract: boolean };

/** Which variable to eliminate, and what to multiply I and II by (smallest numbers win). */
function plan(e1: Std, e2: Std): Plan {
  const [a, b] = (["y", "x"] as V[]).map((ev) => {
    const l = lcm(e1[ev], e2[ev]);
    const m1 = l / Math.abs(e1[ev]);
    const m2 = l / Math.abs(e2[ev]);
    const subtract = Math.sign(e1[ev]) === Math.sign(e2[ev]);
    return { ev, m1, m2, subtract, cost: m1 + m2 + (subtract ? 0.3 : 0) };
  });
  return a.cost <= b.cost ? a : b;
}

const times = (k: number, name: string) => (k === 1 ? name : `${k} · ${name}`);

/** Additionsverfahren: add or subtract so one variable cancels (multiplying first if needed). */
function elimination(e1: Std, e2: Std, sol: [number, number] | null, lead?: Text): Frame[] {
  const { ev, m1, m2, subtract } = plan(e1, e2);
  const ov = other(ev);
  const E1 = scale(e1, m1);
  const E2 = scale(e2, m2);
  const raw = subtract ? E1[ov] - E2[ov] : E1[ov] + E2[ov];
  const swap = subtract && raw < 0;
  const [A, B, a, b] = swap ? [E2, E1, "2", "1"] : [E1, E2, "1", "2"];
  const sg = subtract ? -1 : 1;
  const K = subtract ? Math.abs(raw) : raw;
  const R = A.c + sg * B.c;
  const evKeys = [...termKeys(`1${ev}`), ...termKeys(`2${ev}`)];
  const multiply = m1 !== 1 || m2 !== 1;
  const t = (e: Std) => plain(term(e[ev], ev, "t", true));
  const intro = multiply
    ? tx(
        `Nothing cancels yet. Multiply so that the $${ev}$-terms ${subtract ? "match" : "become opposites"}.`,
        `Noch fällt nichts weg. Multipliziere so, dass ${subtract ? `die $${ev}$-Terme gleich sind` : `sich die $${ev}$-Terme nur im Vorzeichen unterscheiden`}.`,
      )
    : subtract
      ? tx(`Both equations have $${t(e1)}$. **Subtract** them and the $${ev}$-terms cancel.`, `Beide Gleichungen enthalten $${t(e1)}$. **Subtrahiere** sie, dann fallen die $${ev}$-Terme weg.`)
      : tx(
          `The $${ev}$-terms $${t(e1)}$ and $${t(e2)}$ are opposites. **Add** the equations and they cancel.`,
          `Die $${ev}$-Terme $${t(e1)}$ und $${t(e2)}$ unterscheiden sich nur im Vorzeichen. **Addiere** die Gleichungen, dann fallen sie weg.`,
        );
  const frames: Frame[] = [{ math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), highlight: evKeys, note: joinText(lead, intro) }];
  if (multiply) {
    const which = (by: string, and: string) =>
      m1 !== 1 && m2 !== 1 ? `(I) ${by} $${m1}$ ${and} (II) ${by} $${m2}$` : m1 !== 1 ? `(I) ${by} $${m1}$` : `(II) ${by} $${m2}$`;
    const now = `$${t(E1)}$`;
    const then = `$${t(E2)}$`;
    frames.push({
      math: sysSrc(stdSrc(E1, "1"), stdSrc(E2, "2"), times(m1, "(I)"), times(m2, "(II)")),
      highlight: evKeys,
      note: tx(
        `Multiply ${which("by", "and")}, every term on both sides. Now the $${ev}$-terms are ${now} and ${then}.`,
        `Multipliziere ${which("mit", "und")}, und zwar jeden Term auf beiden Seiten. Jetzt sind die $${ev}$-Terme ${now} und ${then}.`,
      ),
    });
  }
  const sumLeft: [number, string, string][] = VARS.flatMap((v): [number, string, string][] => [
    [A[v], v, `${a}${v}`],
    [sg * B[v], v, `${b}${v}`],
  ]);
  const sumRight = side([
    [A.c, "", `${a}c`],
    [sg * B.c, "", `${b}c`],
  ]);
  const labelText = subtract ? (swap ? "(II) − (I):" : "(I) − (II):") : "(I) + (II):";
  frames.push({
    math: `"${labelText}"#L1 ${side(sumLeft)} =#e${a} ${sumRight}`,
    highlight: evKeys,
    note: subtract
      ? tx(
          `Subtract ${swap ? "(I) from (II)" : "(II) from (I)"}: left side minus left side, right side minus right side. Careful: every sign of ${swap ? "(I)" : "(II)"} flips.`,
          `Subtrahiere ${swap ? "(I) von (II)" : "(II) von (I)"}: linke Seite minus linke Seite, rechte Seite minus rechte Seite. Vorsicht: Alle Vorzeichen von ${swap ? "(I)" : "(II)"} drehen sich um.`,
        )
      : tx("Add the equations: left side plus left side, right side plus right side.", "Addiere die Gleichungen: linke Seite plus linke Seite, rechte Seite plus rechte Seite."),
  });
  if (K === 0) {
    const ok = R === 0;
    const said = tx(
      `Everything with $x$ and $y$ cancels and $0 = ${R}$ is ${ok ? "always true" : "false"}.`,
      `Alles mit $x$ und $y$ fällt weg und $0 = ${R}$ ist ${ok ? "immer wahr" : "falsch"}.`,
    );
    frames.push({ math: specialFrame(`0#z${a}`, val(R, `${a}c`), `e${a}`, ok), note: joinText(said, ok ? MANY_NOTE : NONE_NOTE) });
    return frames;
  }
  frames.push(
    ...solveSteps({
      K,
      v: ov,
      D: 0,
      R,
      vid: `${a}${ov}`,
      did: "dz",
      rid: `${a}c`,
      eq: `e${a}`,
      lead: tx(`The $${ev}$-terms cancel. Only $${ov}$ is left.`, `Die $${ev}$-Terme fallen weg. Nur $${ov}$ bleibt übrig.`),
    }),
  );
  const known = R / K;
  // Put it back into the original equation with the simpler other coefficient.
  const back = Math.abs(e2[ev]) < Math.abs(e1[ev]) ? 2 : 1;
  const be = back === 1 ? e1 : e2;
  frames.push(...backSteps(be, String(back), back === 1 ? "(I)" : "(II)", ov, known));
  const value = (be.c - be[ov] * known) / be[ev];
  const [x, y] = ov === "x" ? [known, value] : [value, known];
  if (sol) frames.push({ math: resultSrc(x, y), note: joinText(solutionIs(x, y), checkNote(back === 1 ? e2 : e1, x, y, back === 1 ? "(II)" : "(I)")) });
  return frames;
}

// ---------------------------------------------------------------------------
// Typical mistakes. Each wrong pair is simulated from the task's own numbers: the slip is
// made at the step where students make it, and the rest is worked out the way they would.

type Collector = ReturnType<typeof mistakeList>;
type Choice = Extract<AnswerSpec, { kind: "choice" }>;

const XY: [string, string] = ["x", "y"];
const xyWhen = (x: number, y: number): AnswerSpec => ({ kind: "pair", names: XY, values: [x, y] });
/** The pair (x | y) when the variable v has the value a and the other one has b. */
const xyOf = (v: V, a: number, b: number): AnswerSpec => (v === "x" ? xyWhen(a, b) : xyWhen(b, a));
/** "3x", "-y" for messages. */
const termOf = (c: number, v: string) => plain(term(c, v, "t", true));
const wrapNum = (n: number) => (n < 0 ? `(${n})` : `${n}`);

const SIGN_FLIP: Text = tx("Sign flip missing", "Vorzeichenwechsel vergessen");

/** A known value is put back in, and the sign of the product m·value slips. */
function backSign(o: V, known: number, m: number, name: string): Msg {
  const rule =
    m < 0 && known < 0
      ? ["minus times minus is **plus**", "Minus mal Minus ist **Plus**"]
      : m < 0
        ? ["minus times plus is **minus**", "Minus mal Plus ist **Minus**"]
        : ["plus times minus is **minus**", "Plus mal Minus ist **Minus**"];
  return [
    tx("Sign when putting back", "Vorzeichen beim Einsetzen"),
    tx(
      `$${o} = ${known}$ is right! But when you put it into ${name}, watch the sign of $${m} \\cdot ${wrapNum(known)}$: ${rule[0]}.`,
      `$${o} = ${known}$ stimmt! Aber achte beim Einsetzen in ${name} auf das Vorzeichen von $${m} \\cdot ${wrapNum(known)}$: ${rule[1]}.`,
    ),
  ];
}

/** K·o = R solved with the wrong sign: dividing by a negative number. */
function negDivide(o: V, K: number): Msg {
  return [
    tx("Dividing by a negative", "Geteilt durch eine negative Zahl"),
    tx(
      `Nearly! To get $${o}$ alone you divide by $${K}$, and dividing by a negative number flips the sign.`,
      `Fast! Um $${o}$ allein zu bekommen, teilst du durch $${K}$, und beim Teilen durch eine negative Zahl dreht sich das Vorzeichen um.`,
    ),
  ];
}

/** Adds the "putting back" slip for v = m·o + n with o = known. */
function addBackSign(mk: Collector, v: V, m: number, n: number, known: number, name: string) {
  const prod = m * known;
  if (prod !== 0 && (m < 0 || (known < 0 && m !== 1))) mk.add(xyOf(other(v), known, -prod + n), ...backSign(other(v), known, m, name));
}

/** Einsetzungsverfahren: (I) v = m·o + n put into (II). */
function substitutionMistakes(s: Solved, e: Std): Mistake[] {
  const sv = s.v;
  const ov = other(sv);
  const qs = e[sv];
  const K = qs * s.m + e[ov];
  const D = qs * s.n;
  const known = (e.c - D) / K;
  const via = (o: number) => xyOf(ov, o, s.m * o + s.n);
  const mk = mistakeList(via(known));
  const rhs = plain(rhsSrc(s, "1"));
  // Without brackets only the o-term gets multiplied: qs·m·o + n instead of qs·m·o + qs·n.
  if (qs !== 1) {
    mk.add(
      via((e.c - s.n) / K),
      tx("Brackets forgotten", "Klammern vergessen"),
      qs === -1
        ? tx(
            `Ah, I see what happened! You put $${rhs}$ in without brackets, so the minus only reached the first term. With brackets, it flips **every** sign inside.`,
            `Ah, ich seh, was passiert ist! Du hast $${rhs}$ ohne Klammern eingesetzt, deshalb hat das Minus nur den ersten Term erwischt. Mit Klammern dreht es **jedes** Vorzeichen darin um.`,
          )
        : tx(
            `Ah, I see what happened! You put $${rhs}$ in without brackets, so the $${qs}$ only reached the first term. It has to multiply **every** term in the bracket.`,
            `Ah, ich seh, was passiert ist! Du hast $${rhs}$ ohne Klammern eingesetzt, deshalb hat die $${qs}$ nur den ersten Term erwischt. Sie muss **jeden** Term in der Klammer multiplizieren.`,
          ),
    );
  }
  if (D !== 0) {
    mk.add(
      via((e.c + D) / K),
      SIGN_FLIP,
      tx(
        `Nearly! After multiplying out, the $${D}$ has to go to the other side, and on the way its sign flips.`,
        `Fast! Nach dem Ausmultiplizieren muss die $${D}$ auf die andere Seite, und dabei dreht sich ihr Vorzeichen um.`,
      ),
    );
  }
  if (K < 0) mk.add(via(-known), ...negDivide(ov, K));
  addBackSign(mk, sv, s.m, s.n, known, "(I)");
  return mk.list;
}

/** Gleichsetzungsverfahren: m1·o + n1 = m2·o + n2. */
function equalizationMistakes(s1: Solved, s2: Solved): Mistake[] {
  const v = s1.v;
  const o = other(v);
  const K = s1.m - s2.m;
  const known = (s2.n - s1.n) / K;
  const via = (val: number) => xyOf(o, val, s1.m * val + s1.n);
  const mk = mistakeList(via(known));
  if (s2.m !== 0 && s1.m + s2.m !== 0) {
    mk.add(
      via((s2.n - s1.n) / (s1.m + s2.m)),
      SIGN_FLIP,
      tx(`Nearly! When $${termOf(s2.m, o)}$ moves to the left side, it has to change its sign.`, `Fast! Wenn $${termOf(s2.m, o)}$ auf die linke Seite wandert, muss sich sein Vorzeichen ändern.`),
    );
  }
  if (s1.n !== 0) {
    mk.add(
      via((s2.n + s1.n) / K),
      SIGN_FLIP,
      tx(`Nearly! When the $${s1.n}$ moves to the right side, it has to change its sign.`, `Fast! Wenn die $${s1.n}$ auf die rechte Seite wandert, muss sich ihr Vorzeichen ändern.`),
    );
  }
  if (K < 0) mk.add(via(-known), ...negDivide(o, K));
  addBackSign(mk, v, s1.m, s1.n, known, "(I)");
  return mk.list;
}

/** Additionsverfahren, with the same plan as the worked solution. `first`: story-specific slips. */
function eliminationMistakes(e1: Std, e2: Std, first: [AnswerSpec, Msg][] = []): Mistake[] {
  const { ev, m1, m2, subtract } = plan(e1, e2);
  const ov = other(ev);
  const sg = subtract ? -1 : 1;
  const E1 = scale(e1, m1);
  const E2 = scale(e2, m2);
  const [A, B] = subtract && E1[ov] - E2[ov] < 0 ? [E2, E1] : [E1, E2];
  const K = A[ov] + sg * B[ov];
  const R = A.c + sg * B.c;
  const known = R / K;
  // Like the solution: ev comes from the equation with the simpler ev-coefficient.
  const back = Math.abs(e2[ev]) < Math.abs(e1[ev]) ? 2 : 1;
  const be = back === 1 ? e1 : e2;
  const name = back === 1 ? "(I)" : "(II)";
  const via = (o: number) => xyOf(ov, o, (be.c - be[ov] * o) / be[ev]);
  /** ov after combining a ± b, as if the ev-terms had cancelled. */
  const solve = (a: Std, b: Std, s: number) => (a[ov] + s * b[ov] === 0 ? NaN : (a.c + s * b.c) / (a[ov] + s * b[ov]));
  const multiply = m1 !== 1 || m2 !== 1;
  const t = (e: Std) => `$${termOf(e[ev], ev)}$`;
  const wrongOp: Msg = subtract
    ? [
        tx("Added instead of subtracted", "Addiert statt subtrahiert"),
        tx(
          `Hmm, I think you added the equations. But the $${ev}$-terms are ${t(E1)} and ${t(E2)}: they only cancel if you **subtract**.`,
          `Hm, ich glaub, du hast die Gleichungen addiert. Aber die $${ev}$-Terme sind ${t(E1)} und ${t(E2)}: Die fallen nur weg, wenn du **subtrahierst**.`,
        ),
      ]
    : [
        tx("Subtracted instead of added", "Subtrahiert statt addiert"),
        tx(
          `Hmm, I think you subtracted the equations. But the $${ev}$-terms are ${t(E1)} and ${t(E2)}: they only cancel if you **add**.`,
          `Hm, ich glaub, du hast die Gleichungen subtrahiert. Aber die $${ev}$-Terme sind ${t(E1)} und ${t(E2)}: Die fallen nur weg, wenn du **addierst**.`,
        ),
      ];
  const mk = mistakeList(via(known));
  for (const [when, msg] of first) mk.add(when, ...msg);
  if (multiply) {
    mk.add(
      via(solve({ ...E1, c: e1.c }, { ...E2, c: e2.c }, sg)),
      tx("Right side not multiplied", "Rechte Seite nicht multipliziert"),
      tx(
        "Ah, I see what happened! You multiplied the left side, but the number on the **right side** has to be multiplied too.",
        "Ah, ich seh, was passiert ist! Du hast die linke Seite multipliziert, aber die Zahl auf der **rechten Seite** muss auch multipliziert werden.",
      ),
    );
  }
  mk.add(via(solve(E1, E2, -sg)), ...wrongOp);
  if (subtract) {
    const notFlipped = tx("Not every sign flipped", "Nicht jedes Vorzeichen gedreht");
    mk.add(
      via((A.c + B.c) / K),
      notFlipped,
      tx(
        "Close! When you subtract an equation, **every** term in it flips its sign, the number on the right side too.",
        "Knapp! Wenn du eine Gleichung subtrahierst, dreht sich **jedes** Vorzeichen darin um, auch das der Zahl auf der rechten Seite.",
      ),
    );
    if (!multiply && A[ov] + B[ov] !== 0) {
      mk.add(
        via(R / (A[ov] + B[ov])),
        notFlipped,
        tx(
          `Close! When you subtract an equation, **every** term in it flips its sign, the $${ov}$-term too.`,
          `Knapp! Wenn du eine Gleichung subtrahierst, dreht sich **jedes** Vorzeichen darin um, auch das vom $${ov}$-Term.`,
        ),
      );
    }
  }
  if (K < 0) mk.add(via(-known), ...negDivide(ov, K));
  if (!multiply && Math.abs(K) !== 1) {
    mk.add(
      via(R),
      tx("Not divided yet", "Noch nicht geteilt"),
      tx(
        `Almost! After the $${ev}$-terms cancel, there's still $${termOf(K, ov)}$ on the left. One more step to get $${ov}$ alone.`,
        `Fast! Nachdem die $${ev}$-Terme weggefallen sind, steht links noch $${termOf(K, ov)}$. Ein Schritt fehlt noch, bis $${ov}$ allein steht.`,
      ),
    );
  }
  if (be[ov] * known !== 0) {
    mk.add(
      xyOf(ov, known, (be.c + be[ov] * known) / be[ev]),
      tx(`Sign slip solving for ${ev}`, `Vorzeichenfehler beim Auflösen nach ${ev}`),
      tx(
        `$${ov} = ${known}$ is right! But when you put it into ${name} and solved for $${ev}$, a term crossed to the other side without changing its sign.`,
        `$${ov} = ${known}$ stimmt! Aber als du es in ${name} eingesetzt und nach $${ev}$ aufgelöst hast, ist ein Term ohne Vorzeichenwechsel auf die andere Seite gewandert.`,
      ),
    );
  }
  if (multiply) {
    const only = (e: Std, k: number): Std => (ev === "x" ? { ...e, x: e.x * k } : { ...e, y: e.y * k });
    mk.add(
      via(solve(only(e1, m1), only(e2, m2), sg)),
      tx("Only one term multiplied", "Nur ein Term multipliziert"),
      tx(
        `You got the $${ev}$-terms to cancel, nice! But multiplying an equation means **every** term on both sides, not just the $${ev}$-term.`,
        `Die $${ev}$-Terme fallen jetzt weg, gut! Aber eine Gleichung multiplizieren heißt: **jeden** Term auf beiden Seiten, nicht nur den $${ev}$-Term.`,
      ),
    );
  }
  // The five most likely ones (in the order above) are plenty.
  return mk.list.slice(0, 5);
}

/** Reading the solution off a graph: a point on just one of the lines instead of the crossing. */
function graphSystemMistakes(x: number, y: number, lines: [number, number][]): Mistake[] {
  const mk = mistakeList(xyWhen(x, y));
  const names = ["I", "II"];
  lines.forEach(([, n], i) =>
    mk.add(
      xyWhen(0, n),
      tx("That's a y-intercept", "Das ist ein y-Achsenabschnitt"),
      tx(
        `Ooh, that's where line ${names[i]} crosses the $y$-axis. The solution is the point where the **two lines** cross each other.`,
        `Ooh, da schneidet Gerade ${names[i]} die $y$-Achse. Die Lösung ist der Punkt, an dem sich **die beiden Geraden** schneiden.`,
      ),
    ),
  );
  lines.forEach(([m, n], i) => {
    const zero = -n / m;
    if (Number.isInteger(zero)) {
      mk.add(
        xyWhen(zero, 0),
        tx("That's a zero", "Das ist eine Nullstelle"),
        tx(
          `Ooh, that's where line ${names[i]} crosses the $x$-axis. The solution is the point where the **two lines** cross each other.`,
          `Ooh, da schneidet Gerade ${names[i]} die $x$-Achse. Die Lösung ist der Punkt, an dem sich **die beiden Geraden** schneiden.`,
        ),
      );
    }
  });
  return mk.list;
}

/** Does (p0 | p1) solve (I), (II)? Options: both, only (I), only (II), neither. */
function checkPairMistakes(e1: Std, e2: Std, p: Pt, answer: Choice): Mistake[] {
  const eqs = [e1, e2];
  const names = ["(I)", "(II)"];
  const ok = eqs.map((e) => holds(e, p[0], p[1]));
  const claims = [
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ];
  // A slip with a negative number that would make the statement come out true.
  const signSlip = (e: Std) => {
    const products = [e.x * p[0], e.y * p[1]];
    const negative = [e.x < 0 || p[0] < 0, e.y < 0 || p[1] < 0];
    return products.some((v, i) => v !== 0 && negative[i] && products[0] + products[1] - 2 * v === e.c);
  };
  const mk = mistakeList(answer);
  claims.forEach((c, k) => {
    if (k === answer.correct) return;
    const wrongTrue = [0, 1].find((i) => c[i] && !ok[i]);
    const i = wrongTrue ?? [0, 1].find((j) => !c[j] && ok[j]) ?? 0;
    const e = eqs[i];
    const name = names[i];
    let msg: Msg;
    if (wrongTrue !== undefined && holds(e, p[1], p[0])) {
      msg = [
        tx("x and y swapped?", "x und y vertauscht?"),
        tx(
          `Careful in ${name}: did you put $x$ and $y$ in the right places? $x = ${p[0]}$ goes with the $x$-term and $y = ${p[1]}$ with the $y$-term.`,
          `Vorsicht bei ${name}: Hast du $x$ und $y$ an der richtigen Stelle eingesetzt? $x = ${p[0]}$ gehört zum $x$-Term, $y = ${p[1]}$ zum $y$-Term.`,
        ),
      ];
    } else if (wrongTrue !== undefined && signSlip(e)) {
      msg = [
        tx("Watch the signs", "Achtung, Vorzeichen"),
        tx(
          `Check the signs in ${name} again: minus times minus is **plus**, and plus times minus is **minus**.`,
          `Prüf die Vorzeichen in ${name} noch mal: Minus mal Minus ist **Plus**, und Plus mal Minus ist **Minus**.`,
        ),
      ];
    } else if (wrongTrue !== undefined && k === 0) {
      msg = [
        tx("Both have to fit", "Beide müssen passen"),
        tx(
          "A solution of the system has to make **both** equations true. Put the pair into each one and compare both sides exactly.",
          "Eine Lösung des LGS muss **beide** Gleichungen erfüllen. Setz das Zahlenpaar in jede ein und vergleich beide Seiten genau.",
        ),
      ];
    } else if (wrongTrue !== undefined) {
      msg = [
        tx(`Recheck ${name}`, `${name} noch mal prüfen`),
        tx(`Work out the left side of ${name} once more, step by step. Does it really give $${e.c}$?`, `Rechne die linke Seite von ${name} noch mal Schritt für Schritt aus. Kommt da wirklich $${e.c}$ heraus?`),
      ];
    } else {
      msg = [
        tx(`Recheck ${name}`, `${name} noch mal prüfen`),
        tx(
          `Have another look at ${name}: put the numbers in again, multiply first, then add. Careful with the signs!`,
          `Schau dir ${name} noch mal an: Setz die Zahlen noch mal ein, erst multiplizieren, dann addieren. Vorsicht bei den Vorzeichen!`,
        ),
      ];
    }
    mk.add({ ...answer, correct: k }, ...msg);
  });
  return mk.list;
}

const NOT_TRUE: Msg = [
  tx("True or false?", "Wahr oder falsch?"),
  tx(
    "Right, both variables vanish! But that alone doesn't mean infinitely many. Look closely at the statement that's left: is it true?",
    "Stimmt, beide Variablen fallen weg! Aber das allein heißt noch nicht unendlich viele. Schau dir die Aussage genau an, die übrig bleibt: Stimmt sie?",
  ),
];
const NOT_FALSE: Msg = [
  tx("True or false?", "Wahr oder falsch?"),
  tx(
    "Right, both variables vanish! But that doesn't automatically mean no solution. Is the statement that's left true or false?",
    "Stimmt, beide Variablen fallen weg! Aber das heißt nicht automatisch keine Lösung. Ist die Aussage, die übrig bleibt, wahr oder falsch?",
  ),
];
const X_DROPS: Msg = [
  tx("x drops out", "x fällt weg"),
  tx(
    "Ooh, careful! Substitute and multiply out: the $x$-terms cancel completely, so there's no single value for $x$.",
    "Ooh, Vorsicht! Setz ein und multiplizier aus: Die $x$-Terme heben sich komplett auf, es gibt also keinen einzelnen Wert für $x$.",
  ),
];
const REALLY_VANISH: Msg = [
  tx("Do they really vanish?", "Fallen sie wirklich weg?"),
  tx("Did $x$ and $y$ really both vanish? Solve it step by step and see what comes out.", "Sind $x$ und $y$ wirklich beide weggefallen? Löse es Schritt für Schritt und schau, was herauskommt."),
];

/**
 * One, none or infinitely many? `notOne`: why it isn't a single solution (shown when the
 * student picks "one" for a special case); `one`: why it is (when they pick a special case).
 */
function specialMistakes(answer: Choice, notOne: Msg, one: Msg): Mistake[] {
  const mk = mistakeList(answer);
  const pick = (i: number): AnswerSpec => ({ ...answer, correct: i });
  if (answer.correct === 0) {
    mk.add(pick(1), ...one);
    mk.add(pick(2), ...one);
  } else {
    mk.add(pick(answer.correct === 1 ? 2 : 1), ...(answer.correct === 1 ? NOT_TRUE : NOT_FALSE));
    mk.add(pick(0), ...notOne);
  }
  return mk.list;
}

// ---------------------------------------------------------------------------
// Exercise generator: always designed backwards from a whole-number solution.

const sysMath = (a: string, b: string) => plain(sysSrc(a, b));
const pairAnswer = (x: number, y: number) => ({ kind: "pair" as const, names: ["x", "y"] as [string, string], values: [x, y] as [number, number] });

function pickSol(rng: Rng): [number, number] {
  for (;;) {
    const x = rng.int(-5, 6);
    const y = rng.int(-5, 6);
    if ((x !== 0 || y !== 0) && (x !== y || rng.chance(0.25))) return [x, y];
  }
}

/** A random standard-form equation through (x, y). */
function stdThrough(rng: Rng, x: number, y: number, max = 5): Std {
  const a = rng.nonZero(-max, max);
  const b = rng.nonZero(-max, max);
  return tidy({ x: a, y: b, c: a * x + b * y });
}

const det = (e1: Std, e2: Std) => e1.x * e2.y - e1.y * e2.x;
const HINT_SUB = (v: V) =>
  tx(
    `Equation (I) says what $${v}$ is. Put that expression, in brackets, in place of $${v}$ in (II). Then solve for the other variable.`,
    `Gleichung (I) ist nach $${v}$ aufgelöst. Setze diesen Term in Klammern für $${v}$ in (II) ein. Löse dann nach der anderen Variable auf.`,
  );
const HINT_EQ = (v: V) =>
  tx(
    `Both right sides equal $${v}$. Set them equal, solve for the other variable, then put it back in.`,
    `Beide rechten Seiten sind gleich $${v}$. Setze sie gleich, löse nach der anderen Variable auf und setze das Ergebnis dann ein.`,
  );
const HINT_ELIM = tx(
  "Add or subtract the equations so that one variable cancels. If nothing cancels yet, multiply an equation first.",
  "Addiere oder subtrahiere die Gleichungen so, dass eine Variable wegfällt. Fällt noch nichts weg, multipliziere vorher eine Gleichung.",
);
const SOLVE_SUB = tx("Solve by substitution", "Löse mit dem Einsetzungsverfahren");
const SOLVE_EQ = tx("Solve by equalization", "Löse mit dem Gleichsetzungsverfahren");
const SOLVE_ELIM = tx("Solve by elimination", "Löse mit dem Additionsverfahren");

/** L1: one equation is already solved for a variable. */
function substitutionTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const sol = { x, y };
    const sv: V = rng.chance(0.7) ? "y" : "x";
    const ov = other(sv);
    const m = rng.nonZero(-3, 3);
    const n = sol[sv] - m * sol[ov];
    if (Math.abs(n) > 10) continue;
    const qs = rng.pick([1, 1, 2, 3, -1, -2]);
    const qo = rng.nonZero(-5, 5);
    if (qs * m + qo === 0) continue;
    const raw: Std = sv === "y" ? { x: qo, y: qs, c: 0 } : { x: qs, y: qo, c: 0 };
    const e = tidy({ ...raw, c: raw.x * x + raw.y * y });
    if (Math.abs(e.c) > 40) continue;
    const s: Solved = { v: sv, m, n };
    return {
      instruction: SOLVE_SUB,
      math: sysMath(solvedSrc(s, "1"), stdSrc(e, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_SUB(sv),
      solution: substitution(s, e, [x, y]),
      mistakes: substitutionMistakes(s, e),
    };
  }
}

/** L1: does a given pair solve the system? */
function checkPairTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const e1 = stdThrough(rng, x, y, 4);
    const e2 = stdThrough(rng, x, y, 4);
    if (det(e1, e2) === 0) continue;
    const kind = rng.pick(["both", "I", "II", "none"] as const);
    const step = (e: Std): Pt => {
      const g = gcd(e.x, e.y);
      return [e.y / g, -e.x / g];
    };
    const d1 = step(e1);
    const d2 = step(e2);
    const p: Pt = kind === "both" ? [x, y] : kind === "I" ? [x + d1[0], y + d1[1]] : kind === "II" ? [x + d2[0], y + d2[1]] : [x + 1, y + rng.pick([0, 1, -1])];
    const ok1 = holds(e1, p[0], p[1]);
    const ok2 = holds(e2, p[0], p[1]);
    if (Math.abs(p[0]) > 9 || Math.abs(p[1]) > 9 || (kind === "none" && (ok1 || ok2))) continue;
    const correct = ok1 && ok2 ? 0 : ok1 ? 1 : ok2 ? 2 : 3;
    const lhs = (e: Std, id: string) =>
      yFirst(e) ? `${prodTerm(e.y, p[1], `${id}y`, true)} ${prodTerm(e.x, p[0], `${id}x`, false)}` : `${prodTerm(e.x, p[0], `${id}x`, true)} ${prodTerm(e.y, p[1], `${id}y`, false)}`;
    const value = (e: Std, id: string) => val(e.x * p[0] + e.y * p[1], `${id}x`);
    const verdict = (e: Std, id: string, ok: boolean) => `${value(e, id)} ${ok ? "=" : "\\ne"}#e${id} ${val(e.c, `${id}c`)}`;
    const end = [
      tx("Both statements are true, so the pair is **the** solution of the system.", "Beide Aussagen sind wahr, also ist das Zahlenpaar **die** Lösung des LGS."),
      tx("Only (I) is true. A solution of the system has to make **both** equations true.", "Nur (I) ist wahr. Eine Lösung des LGS muss **beide** Gleichungen erfüllen."),
      tx("Only (II) is true. A solution of the system has to make **both** equations true.", "Nur (II) ist wahr. Eine Lösung des LGS muss **beide** Gleichungen erfüllen."),
      tx("Neither statement is true, so the pair solves neither equation.", "Keine der beiden Aussagen ist wahr, also löst das Zahlenpaar keine der Gleichungen."),
    ][correct];
    const put = `$x = ${p[0]}$`;
    const putY = `$y = ${p[1]}$`;
    const answer: Choice = {
      kind: "choice",
      options: [
        tx("It solves **both** equations: it's the solution of the system.", "Es löst **beide** Gleichungen: Es ist die Lösung des LGS."),
        tx("It solves only equation (I).", "Es löst nur Gleichung (I)."),
        tx("It solves only equation (II).", "Es löst nur Gleichung (II)."),
        tx("It solves **neither** equation.", "Es löst **keine** der beiden Gleichungen."),
      ],
      correct,
    };
    return {
      instruction: tx("Check a solution", "Prüfe ein Zahlenpaar"),
      text: tx(`Put in ${put} and ${putY}. Which equations does this pair solve?`, `Setze ${put} und ${putY} ein. Welche Gleichungen löst dieses Zahlenpaar?`),
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer,
      mistakes: checkPairMistakes(e1, e2, p, answer),
      hint: tx(
        "Put the two numbers into each equation and work out the left side. Is it equal to the right side?",
        "Setze die beiden Zahlen in jede Gleichung ein und rechne die linke Seite aus. Kommt die rechte Seite heraus?",
      ),
      solution: [
        { math: sysSrc(stdSrc(e1, "1"), stdSrc(e2, "2")), note: tx(`Put ${put} and ${putY} into both equations.`, `Setze ${put} und ${putY} in beide Gleichungen ein.`) },
        { math: sysSrc(`${lhs(e1, "1")} =#e1 ${val(e1.c, "1c")}`, `${lhs(e2, "2")} =#e2 ${val(e2.c, "2c")}`), note: tx("Work out each left side.", "Rechne jeweils die linke Seite aus.") },
        { math: sysSrc(verdict(e1, "1", ok1), verdict(e2, "2", ok2), "(I)", "(II)", [ok1 ? "green" : "red", ok2 ? "green" : "red"]), note: end },
      ],
    };
  }
}

/** L1: read the solution off a graph. */
function graphTask(rng: Rng): Exercise {
  for (;;) {
    const x = rng.int(-4, 4);
    const y = rng.int(-4, 4);
    const m1 = rng.nonZero(-3, 3);
    const m2 = rng.nonZero(-3, 3);
    if (m1 === m2) continue;
    const n1 = y - m1 * x;
    const n2 = y - m2 * x;
    if (Math.abs(n1) > 6 || Math.abs(n2) > 6 || n1 === n2) continue;
    const s1: Solved = { v: "y", m: m1, n: n1 };
    const s2: Solved = { v: "y", m: m2, n: n2 };
    const sys = sysSrc(solvedSrc(s1, "1"), solvedSrc(s2, "2"));
    return {
      instruction: tx("Solve graphically", "Löse grafisch"),
      text: tx("Each equation is one of the lines. Read the solution of the system off the graph.", "Jede Gleichung gehört zu einer der Geraden. Lies die Lösung des LGS am Graphen ab."),
      math: plain(sys),
      visual: graphVisual({
        xRange: [-6, 6],
        yRange: [-6, 6],
        functions: [
          { f: (t) => m1 * t + n1, key: "I", color: "blob", label: "I" },
          { f: (t) => m2 * t + n2, key: "II", color: "ink", label: "II" },
        ],
      }),
      answer: pairAnswer(x, y),
      mistakes: graphSystemMistakes(x, y, [
        [m1, n1],
        [m2, n2],
      ]),
      hint: tx(
        "Find the point where the two lines cross. Its $x$- and $y$-coordinates are the solution.",
        "Suche den Schnittpunkt der beiden Geraden. Seine $x$- und $y$-Koordinate sind die Lösung.",
      ),
      solution: [
        { math: sys, note: tx("Each equation is a line. A point on **both** lines solves both equations.", "Jede Gleichung ist eine Gerade. Ein Punkt auf **beiden** Geraden löst beide Gleichungen.") },
        { math: `S#S ${pt(`${x}#rx`, `${y}#ry`)}`, note: tx(`The lines cross at $${pt(x, y, "S")}$.`, `Die Geraden schneiden sich in $${pt(x, y, "S")}$.`) },
        {
          math: sysSrc(`${valWrap(y, "1v")} =#e1 ${prodTerm(m1, x, "1x", true)} ${term(n1, "", "1c", false)}`, `${valWrap(y, "2v")} =#e2 ${prodTerm(m2, x, "2x", true)} ${term(n2, "", "2c", false)}`),
          note: tx(`Check: put $x = ${x}$ and $y = ${y}$ into both equations. Both are true.`, `Probe: Setze $x = ${x}$ und $y = ${y}$ in beide Gleichungen ein. Beide stimmen.`),
        },
        { math: resultSrc(x, y), note: tx(`So the solution is $x = ${x}$, $y = ${y}$.`, `Die Lösung ist also $x = ${x}$, $y = ${y}$.`) },
      ],
    };
  }
}

/** L2: both solved for the same variable. */
function equalizationTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const sol = { x, y };
    const v: V = rng.chance(0.8) ? "y" : "x";
    const o = other(v);
    const m1 = rng.int(-4, 4);
    const m2 = rng.int(-4, 4);
    if (m1 === m2 || m1 === 0) continue;
    const n1 = sol[v] - m1 * sol[o];
    const n2 = sol[v] - m2 * sol[o];
    if (Math.abs(n1) > 12 || Math.abs(n2) > 12) continue;
    const s1: Solved = { v, m: m1, n: n1 };
    const s2: Solved = { v, m: m2, n: n2 };
    return {
      instruction: SOLVE_EQ,
      math: sysMath(solvedSrc(s1, "1"), solvedSrc(s2, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_EQ(v),
      solution: equalization(s1, s2, [x, y]),
      mistakes: equalizationMistakes(s1, s2),
    };
  }
}

/** L2: elimination where the coefficients already match. */
function matchingTask(rng: Rng): Exercise {
  for (;;) {
    const [x, y] = pickSol(rng);
    const ev: V = rng.chance(0.65) ? "y" : "x";
    const k = rng.int(1, 4) * rng.sign();
    const adding = rng.chance(0.65);
    const a1 = rng.nonZero(-5, 5);
    const a2 = rng.nonZero(-5, 5);
    if (adding ? a1 + a2 === 0 : a1 === a2) continue;
    const build = (a: number, kk: number): Std => {
      const e = ev === "y" ? { x: a, y: kk, c: 0 } : { x: kk, y: a, c: 0 };
      e.c = e.x * x + e.y * y;
      return e;
    };
    const e1 = tidy(build(a1, k));
    const e2 = tidy(build(a2, adding ? -k : k));
    if (Math.abs(e1.c) > 40 || Math.abs(e2.c) > 40) continue;
    const p = plan(e1, e2);
    if (p.m1 !== 1 || p.m2 !== 1) continue;
    return {
      instruction: SOLVE_ELIM,
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer: pairAnswer(x, y),
      hint: adding
        ? tx(
            "Look at the coefficients: one variable has opposite numbers in front. Add the equations.",
            "Schau dir die Koeffizienten an: Vor einer Variable stehen Gegenzahlen. Addiere die Gleichungen.",
          )
        : tx(
            "One variable has the same number in front in both equations. Subtract the equations.",
            "Vor einer Variable steht in beiden Gleichungen dieselbe Zahl. Subtrahiere die Gleichungen.",
          ),
      solution: elimination(e1, e2, [x, y]),
      mistakes: eliminationMistakes(e1, e2),
    };
  }
}

/** L3: elimination that needs one or both equations multiplied first. */
function multiplyTask(rng: Rng): Exercise {
  const both = rng.chance(0.4);
  for (;;) {
    const [x, y] = pickSol(rng);
    const e1 = stdThrough(rng, x, y, both ? 6 : 5);
    const e2 = stdThrough(rng, x, y, both ? 6 : 5);
    if (det(e1, e2) === 0 || Math.abs(e1.c) > 50 || Math.abs(e2.c) > 50) continue;
    const p = plan(e1, e2);
    const big = Math.max(p.m1, p.m2);
    const small = Math.min(p.m1, p.m2);
    if (both ? small < 2 || big > 5 : small !== 1 || big < 2 || big > 4) continue;
    return {
      instruction: tx("Solve the system", "Löse das Gleichungssystem"),
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      answer: pairAnswer(x, y),
      hint: HINT_ELIM,
      solution: elimination(e1, e2, [x, y]),
      mistakes: eliminationMistakes(e1, e2),
    };
  }
}

/** L3: a short word problem. */
function wordTask(rng: Rng): Exercise {
  const kind = rng.pick(["tickets", "animals", "numbers", "cafe"] as const);
  for (;;) {
    let text: Text;
    let e1: Std;
    let e2: Std;
    let x: number;
    let y: number;
    let setup: Text;
    let answer: Text;
    /** What Blob says when x and y come out swapped. */
    let swapped: Text;
    if (kind === "tickets") {
      const pa = rng.int(8, 14);
      const pc = rng.int(4, pa - 2);
      x = rng.int(4, 30);
      y = rng.int(4, 30);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: pa, y: pc, c: pa * x + pc * y };
      text = tx(
        `A cinema sells adult tickets for ${pa} € and child tickets for ${pc} €. On Sunday it sold ${e1.c} tickets and took ${e2.c} €. How many adult tickets ($x$) and child tickets ($y$) did it sell?`,
        `Ein Kino verkauft Karten für Erwachsene zu ${pa} € und Kinderkarten zu ${pc} €. Am Sonntag hat es ${e1.c} Karten verkauft und ${e2.c} € eingenommen. Wie viele Erwachsenenkarten ($x$) und Kinderkarten ($y$) waren das?`,
      );
      setup = tx("Set up: (I) counts the tickets, (II) counts the money.", "Aufstellen: (I) zählt die Karten, (II) das Geld.");
      answer = tx(`So it sold ${x} adult tickets and ${y} child tickets.`, `Es wurden also ${x} Erwachsenenkarten und ${y} Kinderkarten verkauft.`);
      swapped = tx(
        `Ha, swapped! Which tickets cost ${pa} €? $x$ counts the **adult** tickets, $y$ the child tickets.`,
        `Ha, vertauscht! Welche Karten kosten ${pa} €? $x$ zählt die **Erwachsenenkarten**, $y$ die Kinderkarten.`,
      );
    } else if (kind === "animals") {
      x = rng.int(3, 25);
      y = rng.int(3, 25);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: 2, y: 4, c: 2 * x + 4 * y };
      text = tx(
        `On a farm there are chickens and rabbits. Together they have ${e1.c} heads and ${e2.c} legs. How many chickens ($x$) and rabbits ($y$) are there?`,
        `Auf einem Bauernhof leben Hühner und Kaninchen. Zusammen haben sie ${e1.c} Köpfe und ${e2.c} Beine. Wie viele Hühner ($x$) und Kaninchen ($y$) sind es?`,
      );
      setup = tx(
        "Set up: every animal has one head, that's (I). A chicken has 2 legs and a rabbit 4, that's (II).",
        "Aufstellen: Jedes Tier hat einen Kopf, das ist (I). Ein Huhn hat 2 Beine und ein Kaninchen 4, das ist (II).",
      );
      answer = tx(`So there are ${x} chickens and ${y} rabbits.`, `Es sind also ${x} Hühner und ${y} Kaninchen.`);
      swapped = tx(
        "Ha, swapped! Did you give the chickens 4 legs? A chicken has 2, a rabbit 4, and $x$ counts the **chickens**.",
        "Ha, vertauscht! Hast du den Hühnern 4 Beine gegeben? Ein Huhn hat 2, ein Kaninchen 4, und $x$ zählt die **Hühner**.",
      );
    } else if (kind === "numbers") {
      x = rng.int(8, 40);
      y = rng.int(2, x - 1);
      e1 = { x: 1, y: 1, c: x + y };
      e2 = { x: 1, y: -1, c: x - y };
      text = tx(
        `The sum of two numbers is ${e1.c} and their difference is ${e2.c}. Find the larger number $x$ and the smaller number $y$.`,
        `Die Summe zweier Zahlen ist ${e1.c}, ihre Differenz ist ${e2.c}. Bestimme die größere Zahl $x$ und die kleinere Zahl $y$.`,
      );
      setup = tx("Set up: (I) is the sum, (II) the difference.", "Aufstellen: (I) ist die Summe, (II) die Differenz.");
      answer = tx(`The numbers are ${x} and ${y}.`, `Die Zahlen sind ${x} und ${y}.`);
      swapped = tx("Ha, swapped! $x$ is the **larger** number, $y$ the smaller one.", "Ha, vertauscht! $x$ ist die **größere** Zahl, $y$ die kleinere.");
    } else {
      x = rng.int(2, 5);
      y = rng.int(2, 5);
      const [a1, b1, a2, b2] = [rng.int(2, 5), rng.int(2, 5), rng.int(2, 5), rng.int(2, 5)];
      e1 = { x: a1, y: b1, c: a1 * x + b1 * y };
      e2 = { x: a2, y: b2, c: a2 * x + b2 * y };
      if (x === y || det(e1, e2) === 0) continue;
      text = tx(
        `${a1} coffees and ${b1} muffins cost ${e1.c} €. ${a2} coffees and ${b2} muffins cost ${e2.c} €. What does one coffee ($x$) and one muffin ($y$) cost?`,
        `${a1} Kaffee und ${b1} Muffins kosten ${e1.c} €. ${a2} Kaffee und ${b2} Muffins kosten ${e2.c} €. Was kosten ein Kaffee ($x$) und ein Muffin ($y$)?`,
      );
      setup = tx("Set up one equation for each sentence.", "Stell für jeden Satz eine Gleichung auf.");
      answer = tx(`So a coffee costs ${x} € and a muffin ${y} €.`, `Ein Kaffee kostet also ${x} € und ein Muffin ${y} €.`);
      swapped = tx("Ha, swapped! $x$ is the price of **one coffee**, $y$ the price of one muffin.", "Ha, vertauscht! $x$ ist der Preis für **einen Kaffee**, $y$ der für einen Muffin.");
    }
    const p = plan(e1, e2);
    if (Math.max(p.m1, p.m2) > 6) continue;
    const frames = elimination(e1, e2, [x, y], setup);
    frames[frames.length - 1] = { ...frames[frames.length - 1], note: joinText(answer, checkNote(e2, x, y, "(II)")) };
    return {
      instruction: tx("Word problem", "Textaufgabe"),
      text,
      answer: pairAnswer(x, y),
      hint: tx(
        "Write one equation for each piece of information, then solve the system, e.g. with the elimination method.",
        "Stell für jede Information eine Gleichung auf und löse dann das LGS, z. B. mit dem Additionsverfahren.",
      ),
      solution: frames,
      mistakes: eliminationMistakes(e1, e2, [[xyWhen(y, x), [tx("Swapped", "Vertauscht"), swapped]]]),
    };
  }
}

const COUNT_OPTIONS = [
  tx("Exactly one solution", "Genau eine Lösung"),
  tx("No solution", "Keine Lösung"),
  tx("Infinitely many solutions", "Unendlich viele Lösungen"),
];
const HOW_MANY = tx("How many solutions?", "Wie viele Lösungen?");
const HOW_MANY_TEXT = tx("How many solutions does the system have?", "Wie viele Lösungen hat das Gleichungssystem?");

/** L3: one, none or infinitely many solutions? */
function specialTask(rng: Rng): Exercise {
  const outcome = rng.pick(["none", "none", "many", "many", "one"] as const);
  const variant = rng.pick(outcome === "many" ? (["mixed", "std"] as const) : (["mixed", "std", "solved"] as const));
  const correct = outcome === "one" ? 0 : outcome === "none" ? 1 : 2;
  const base = { instruction: HOW_MANY, text: HOW_MANY_TEXT, answer: { kind: "choice" as const, options: COUNT_OPTIONS, correct } };
  const hint = tx(
    "Try to solve it. If both variables disappear, look at what's left: a true statement or a false one?",
    "Versuch es zu lösen. Fallen beide Variablen weg, schau, was übrig bleibt: eine wahre oder eine falsche Aussage?",
  );
  for (;;) {
    const [x, y] = pickSol(rng);
    if (variant === "mixed") {
      const m = rng.nonZero(-3, 3);
      const n = y - m * x;
      const qy = rng.pick([1, 2, 3, -1, -2]);
      let qx = -qy * m;
      if (outcome === "one") qx += rng.nonZero(-3, 3);
      let r = qx * x + qy * y;
      if (outcome === "none") r += rng.nonZero(-6, 6);
      if (Math.abs(n) > 9 || Math.abs(r) > 30 || qx === 0) continue;
      const s: Solved = { v: "y", m, n };
      const e: Std = { x: qx, y: qy, c: r };
      return {
        ...base,
        math: sysMath(solvedSrc(s, "1"), stdSrc(e, "2")),
        hint,
        solution: substitution(s, e, outcome === "one" ? [x, y] : null),
        mistakes: specialMistakes(base.answer, X_DROPS, REALLY_VANISH),
      };
    }
    if (variant === "solved") {
      const m = rng.nonZero(-3, 3);
      const m2 = outcome === "one" ? m + rng.nonZero(-2, 2) : m;
      const n1 = y - m * x;
      const n2 = outcome === "one" ? y - m2 * x : n1 + rng.nonZero(-5, 5);
      if (Math.abs(n1) > 9 || Math.abs(n2) > 9) continue;
      const s1: Solved = { v: "y", m, n: n1 };
      const s2: Solved = { v: "y", m: m2, n: n2 };
      const sameSlope: Msg = [
        tx("Same slope", "Gleiche Steigung"),
        tx(
          `Look at the slopes: both lines have $m = ${m}$. Lines with the same slope never cross in exactly one point.`,
          `Schau auf die Steigungen: Beide Geraden haben $m = ${m}$. Geraden mit gleicher Steigung schneiden sich nie in genau einem Punkt.`,
        ),
      ];
      const differentSlopes: Msg = [
        tx("Same slope?", "Gleiche Steigung?"),
        tx("Compare the slopes of the two lines: are they really the same?", "Vergleich die Steigungen der beiden Geraden: Sind sie wirklich gleich?"),
      ];
      return {
        ...base,
        math: sysMath(solvedSrc(s1, "1"), solvedSrc(s2, "2")),
        hint,
        solution: equalization(s1, s2, outcome === "one" ? [x, y] : null),
        mistakes: specialMistakes(base.answer, sameSlope, differentSlopes),
      };
    }
    const e1 = stdThrough(rng, x, y, 4);
    const k = rng.pick([2, 3]);
    let e2 = scale(e1, k);
    if (outcome === "none") e2 = { ...e2, c: e2.c + rng.nonZero(-5, 5) };
    if (outcome === "one") e2 = stdThrough(rng, x, y, 5);
    if (outcome === "one" && det(e1, e2) === 0) continue;
    if (Math.abs(e2.c) > 40) continue;
    const multiple: Msg = [
      tx("A multiple of (I)", "Ein Vielfaches von (I)"),
      tx(
        `Look closely: the left side of (II) is exactly $${k}$ times the left side of (I). What does that mean for the lines?`,
        `Schau genau hin: Die linke Seite von (II) ist genau das $${k}$-Fache der linken Seite von (I). Was heißt das für die Geraden?`,
      ),
    ];
    const notMultiple: Msg = [
      tx("A multiple?", "Ein Vielfaches?"),
      tx(
        "Is (II) really just a multiple of (I)? Check **every** number in front of $x$ and $y$, then solve it.",
        "Ist (II) wirklich nur ein Vielfaches von (I)? Prüf **jede** Zahl vor $x$ und $y$ und löse es dann.",
      ),
    ];
    return {
      ...base,
      math: sysMath(stdSrc(e1, "1"), stdSrc(e2, "2")),
      hint,
      solution: elimination(e1, e2, outcome === "one" ? [x, y] : null),
      mistakes: specialMistakes(base.answer, multiple, notMultiple),
    };
  }
}

function generate(level: Level, rng: Rng): Exercise {
  if (level === 1) {
    const r = rng.next();
    if (r < 0.65) return substitutionTask(rng);
    if (r < 0.85) return checkPairTask(rng);
    return graphTask(rng);
  }
  if (level === 2) return rng.chance(0.45) ? equalizationTask(rng) : matchingTask(rng);
  const r = rng.next();
  if (r < 0.45) return multiplyTask(rng);
  if (r < 0.72) return wordTask(rng);
  return specialTask(rng);
}

// ---------------------------------------------------------------------------
// Widget: two lines whose equations you change. The intersection point is the
// solution; parallel and identical lines show the special cases.

const SYS_M: Frac[] = [q(-3), q(-2), q(-1), q(-1, 2), q(0), q(1, 2), q(1), q(2), q(3)];
type LineState = { m: number; b: number };
const START: [LineState, LineState] = [
  { m: 7, b: -1 },
  { m: 2, b: 5 },
];

function Stepper({ label, onDown, onUp, canDown, canUp }: { label: ReactNode; onDown: () => void; onUp: () => void; canDown: boolean; canUp: boolean }) {
  const t = useText();
  return (
    <div className="flex items-center gap-1">
      <button onClick={onDown} disabled={!canDown} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx("Decrease", "Verringern"))}>
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-6 text-center">{label}</span>
      <button onClick={onUp} disabled={!canUp} className="grid size-7 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30" aria-label={t(tx("Increase", "Erhöhen"))}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function LineRow({ name, tone, line, onChange, scope }: { name: string; tone: "blob" | "ink"; line: LineState; onChange: (l: LineState) => void; scope: string }) {
  const m = SYS_M[line.m];
  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className={cn("grid h-6 min-w-6 place-items-center rounded-md px-1 font-sans text-[12px] font-bold", tone === "blob" ? "bg-blob text-white" : "bg-ink text-paper")}>{name}</span>
        <MathView src={lineSrc(m, q(line.b))} size="md" scope={scope} />
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pl-9 text-[13px] text-ink-3">
        <div className="flex items-center gap-2">
          <span className="font-math italic">m</span>
          <Stepper label={<MathView src={num(m)} size="sm" animate={false} />} canDown={line.m > 0} canUp={line.m < SYS_M.length - 1} onDown={() => onChange({ ...line, m: line.m - 1 })} onUp={() => onChange({ ...line, m: line.m + 1 })} />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-math italic">b</span>
          <Stepper label={<MathView src={String(line.b)} size="sm" animate={false} />} canDown={line.b > -5} canUp={line.b < 5} onDown={() => onChange({ ...line, b: line.b - 1 })} onUp={() => onChange({ ...line, b: line.b + 1 })} />
        </div>
      </div>
    </div>
  );
}

function SystemLab() {
  const t = useText();
  const scope = useId();
  const [l1, setL1] = useState(START[0]);
  const [l2, setL2] = useState(START[1]);
  const m1 = SYS_M[l1.m];
  const m2 = SYS_M[l2.m];
  const sameSlope = m1.n === m2.n && m1.d === m2.d;
  const kind = sameSlope ? (l1.b === l2.b ? "same" : "parallel") : "one";
  let S: [Frac, Frac] | null = null;
  if (kind === "one") {
    const sx = div(q(l2.b - l1.b), sub(m1, m2));
    S = [sx, add(mul(m1, sx), q(l1.b))];
  }
  const onGrid = S !== null && Math.abs(qv(S[0])) <= 5 && Math.abs(qv(S[1])) <= 5;
  const a1 = useSpringTo(Math.atan(qv(m1)));
  const a2 = useSpringTo(Math.atan(qv(m2)));
  const b1 = useSpringTo(l1.b);
  const b2 = useSpringTo(l2.b);
  const geo = planeGeo([-5, 5], [-5, 5]);
  const dir = (a: number): Pt => [Math.cos(a), Math.sin(a)];
  const meet = () => crossing([0, b1.get()], dir(a1.get()), [0, b2.get()], dir(a2.get()));
  const band = (): Pt[] => {
    const t = Math.tan(a1.get());
    const [u, w] = [b1.get(), b2.get()];
    return [
      [-6, -6 * t + u],
      [6, 6 * t + u],
      [6, 6 * t + w],
      [-6, -6 * t + w],
    ];
  };
  const presets: { label: Text; run: () => void }[] = [
    {
      label: tx("Crossing", "Schnittpunkt"),
      run: () => {
        setL1(START[0]);
        setL2(START[1]);
      },
    },
    { label: tx("Parallel", "Parallel"), run: () => setL2({ m: l1.m, b: l1.b <= 1 ? l1.b + 3 : l1.b - 3 }) },
    { label: tx("Same line", "Identisch"), run: () => setL2({ ...l1 }) },
  ];

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label={t(tx("Two lines and their intersection", "Zwei Geraden und ihr Schnittpunkt"))}
          overlay={
            <>
              <PlaneTag at={() => alongLine(geo, [0, b1.get()], dir(a1.get()), 0.94)} dy={-13}>
                <span className="font-sans text-[12px] font-bold text-blob-ink">I</span>
              </PlaneTag>
              <PlaneTag at={() => alongLine(geo, [0, b2.get()], dir(a2.get()), 0.94)} dy={13}>
                <span className="font-sans text-[12px] font-bold text-ink">II</span>
              </PlaneTag>
              {S && (
                <PlaneTag at={meet} dy={-22} className="shadow-[0_0_0_1.5px_var(--blob)]">
                  <span className="text-ink">
                    <MathView src={pt(S[0], S[1], "S")} size="inline" animate={false} />
                  </span>
                </PlaneTag>
              )}
            </>
          }
        >
          <PlanePath shape={band} closed fill="color-mix(in oklab, var(--danger) 10%, transparent)" opacity={kind === "parallel" ? 1 : 0} />
          <PlaneLine through={() => [[0, b1.get()], dir(a1.get())]} width={1.1} />
          <PlaneLine through={() => [[0, b2.get()], dir(a2.get())]} tone="ink" width={kind === "same" ? 0.8 : 1} dashed={kind === "same"} />
          <PlaneDot at={meet} tone="blob" r={1.5} pulse={S ? `${S[0].n}/${S[0].d},${S[1].n}/${S[1].d}` : "none"} />
        </Plane>
      </div>

      <div className="space-y-3">
        <LineRow name="I" tone="blob" line={l1} onChange={setL1} scope={`${scope}-1`} />
        <LineRow name="II" tone="ink" line={l2} onChange={setL2} scope={`${scope}-2`} />
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={resolveText(p.label, "en")} onClick={p.run} className="h-8 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              {t(p.label)}
            </button>
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={kind}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn("rounded-xl border px-4 py-3", kind === "one" ? "border-blob/30 bg-blob-soft/50" : kind === "parallel" ? "border-danger/25 bg-danger/[0.05]" : "border-ok/30 bg-ok/[0.07]")}
          >
            <div className="font-display text-[16px] font-semibold">{t(COUNT_OPTIONS[kind === "one" ? 0 : kind === "parallel" ? 1 : 2])}</div>
            <div className="mt-1 text-[13.5px] leading-relaxed text-ink-2">
              {kind === "one" && S ? (
                <Inline
                  text={tx(
                    `The lines cross at $${pt(S[0], S[1], "S")}$. ${onGrid ? "That point" : "That point (off the grid here)"} makes **both** equations true: $x = ${num(S[0])}$, $y = ${num(S[1])}$.`,
                    `Die Geraden schneiden sich in $${pt(S[0], S[1], "S")}$. ${onGrid ? "Dieser Punkt" : "Dieser Punkt (hier außerhalb des Bildes)"} erfüllt **beide** Gleichungen: $x = ${num(S[0])}$, $y = ${num(S[1])}$.`,
                  )}
                />
              ) : kind === "parallel" ? (
                <Inline
                  text={tx(
                    "Same slope, different y-intercepts: the lines are parallel and never meet. No point is on both.",
                    "Gleiche Steigung, verschiedene y-Achsenabschnitte: Die Geraden sind parallel und schneiden sich nie. Kein Punkt liegt auf beiden.",
                  )}
                />
              ) : (
                <Inline
                  text={tx(
                    "Same slope, same y-intercept: it's the same line twice. Every point on it solves both equations.",
                    "Gleiche Steigung, gleicher y-Achsenabschnitt: Es ist zweimal dieselbe Gerade. Jeder Punkt darauf löst beide Gleichungen.",
                  )}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const v = (n: number, k: string) => `${n}#${k}`;
const introFrames: Frame[] = [
  {
    math: sysSrc(stdSrc({ x: 1, y: 1, c: 5 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
    note: tx(
      "Two equations with the same two unknowns $x$ and $y$: a **linear system** (lineares Gleichungssystem, LGS).",
      "Zwei Gleichungen mit denselben zwei Unbekannten $x$ und $y$: ein **lineares Gleichungssystem** (LGS).",
    ),
  },
  {
    math: sysSrc(stdSrc({ x: 1, y: 1, c: 5 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
    highlight: ["v1x", "s1y", "v1y", "e1", "c1c"],
    note: tx(
      `On its own, $x + y = 5$ has lots of solutions: $${pt(1, 4)}$, $${pt(2, 3)}$, $${pt(3, 2)}$ and many more.`,
      `Für sich allein hat $x + y = 5$ viele Lösungen: $${pt(1, 4)}$, $${pt(2, 3)}$, $${pt(3, 2)}$ und noch viele mehr.`,
    ),
  },
  {
    math: sysSrc(`${v(2, "v1x")} +#s1y ${v(3, "v1y")} =#e1 5#c1c`, `${v(2, "v2x")} -#s2y ${v(3, "v2y")} \\ne#e2 1#c2c`, "(I)", "(II)", ["green", "red"]),
    note: tx(
      "Try $x = 2$, $y = 3$: equation (I) is true. But (II) gives $2 - 3 = -1$, not $1$.",
      "Probier $x = 2$, $y = 3$: Gleichung (I) stimmt. Aber (II) ergibt $2 - 3 = -1$, nicht $1$.",
    ),
  },
  {
    math: sysSrc(`${v(3, "v1x")} +#s1y ${v(2, "v1y")} =#e1 5#c1c`, `${v(3, "v2x")} -#s2y ${v(2, "v2y")} =#e2 1#c2c`, "(I)", "(II)", ["green", "green"]),
    note: tx("Try $x = 3$, $y = 2$: **both** are true!", "Probier $x = 3$, $y = 2$: **Beide** stimmen!"),
  },
  {
    math: resultSrc(3, 2),
    note: tx(
      "So the solution is the pair $(3 | 2)$. We write the solution set as $L$. Next: how to find it without guessing.",
      "Die Lösung ist also das Zahlenpaar $(3 | 2)$. Die Lösungsmenge schreiben wir als $L$. Gleich lernst du, wie du sie ohne Raten findest.",
    ),
  },
];

const specialFrames: Frame[] = [
  ...equalization({ v: "y", m: 2, n: 1 }, { v: "y", m: 2, n: -3 }, null),
  ...substitution({ v: "y", m: 2, n: 1 }, { x: 4, y: -2, c: -2 }, null),
];
specialFrames[0] = {
  ...specialFrames[0],
  note: tx(
    "First system: both lines have slope $2$ but different y-intercepts. Set them equal.",
    "Erstes LGS: Beide Geraden haben die Steigung $2$, aber verschiedene y-Achsenabschnitte. Setze sie gleich.",
  ),
};
const parallelEnd = specialFrames.findIndex((f) => srcOf(f.math).startsWith("\\red"));
specialFrames[parallelEnd + 1] = {
  ...specialFrames[parallelEnd + 1],
  note: tx("Second system. Equation (I) is solved for $y$, so substitute.", "Zweites LGS: Gleichung (I) ist nach $y$ aufgelöst, also setzt du ein."),
};

const linearSystems: Topic = {
  ...topicMeta("linear-systems"),
  summary: [
    {
      title: tx("What a solution is", "Was eine Lösung ist"),
      body: tx(
        "A pair $(x | y)$ that makes **both** equations true. In a graph it's the point where the two lines cross.",
        "Ein Zahlenpaar $(x | y)$, das **beide** Gleichungen erfüllt. Im Koordinatensystem ist es der Schnittpunkt der beiden Geraden.",
      ),
      examples: ['"(I)" x + y = 5 \\quad "(II)" x - y = 1', 'L = "{" (3 \\, | \\, 2) "}"'],
      tone: "rule",
    },
    {
      title: tx("Equalization (Gleichsetzungsverfahren)", "Gleichsetzungsverfahren"),
      body: tx(
        "Both equations are solved for the same variable: set the right sides equal.",
        "Beide Gleichungen sind nach derselben Variable aufgelöst: Setze die rechten Seiten gleich.",
      ),
      examples: ["y = 2x - 1 , \\quad y = -x + 5", "2x - 1 = -x + 5"],
      tone: "rule",
    },
    {
      title: tx("Substitution (Einsetzungsverfahren)", "Einsetzungsverfahren"),
      body: tx(
        "One equation is solved for a variable: put that expression, in brackets, into the other one.",
        "Eine Gleichung ist nach einer Variable aufgelöst: Setze diesen Term in Klammern in die andere ein.",
      ),
      examples: ["y = 2x + 1 , \\quad 3x + y = 11", "3x + (2x + 1) = 11"],
      tone: "rule",
    },
    {
      title: tx("Elimination (Additionsverfahren)", "Additionsverfahren"),
      body: tx(
        "Add or subtract the equations so that one variable cancels. Multiply an equation first if needed.",
        "Addiere oder subtrahiere die Gleichungen so, dass eine Variable wegfällt. Multipliziere vorher eine Gleichung, falls nötig.",
      ),
      examples: ["2x + y = 7 , \\quad 3x - y = 8", "5x = 15"],
      tone: "rule",
    },
    {
      title: tx("Special cases", "Sonderfälle"),
      body: tx(
        "Both variables vanish? A false statement like $0 = 4$ means no solution (parallel lines). A true one like $0 = 0$ means infinitely many solutions (same line).",
        "Beide Variablen fallen weg? Eine falsche Aussage wie $0 = 4$ heißt: keine Lösung (parallele Geraden). Eine wahre wie $0 = 0$ heißt: unendlich viele Lösungen (identische Geraden).",
      ),
      examples: [tx('0 = 4 \\quad "false: no solution"', '0 = 4 \\quad "falsch: keine Lösung"'), tx('0 = 0 \\quad "true: infinitely many"', '0 = 0 \\quad "wahr: unendlich viele"')],
      tone: "tip",
    },
    {
      title: tx("Don't stop halfway", "Nicht auf halbem Weg aufhören"),
      body: tx(
        "Once you have $x$, put it back into an equation to get $y$. Then check both equations.",
        "Hast du $x$, setze es in eine Gleichung ein, um $y$ zu bekommen. Mach dann die Probe mit beiden Gleichungen.",
      ),
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Two equations, two unknowns", "Zwei Gleichungen, zwei Unbekannte"),
      blob: tx(
        "One equation, two unknowns: too many answers. Two equations: now we can pin it down!",
        "Eine Gleichung, zwei Unbekannte: viel zu viele Antworten. Mit zwei Gleichungen kriegen wir sie!",
      ),
      body: tx(
        "A solution of a system is a pair of numbers $(x | y)$ that makes **both** equations true at the same time.",
        "Eine Lösung eines LGS ist ein Zahlenpaar $(x | y)$, das **beide** Gleichungen gleichzeitig erfüllt.",
      ),
      frames: introFrames,
    },
    {
      type: "widget",
      title: tx("Each equation is a line", "Jede Gleichung ist eine Gerade"),
      blob: tx("Change the lines and watch where they cross!", "Verändere die Geraden und schau, wo sie sich schneiden!"),
      body: tx(
        "Solve each equation for $y$ and you get a line. A point on **both** lines solves both equations: the intersection is the solution. Try the special cases too.",
        "Löst du jede Gleichung nach $y$ auf, bekommst du eine Gerade. Ein Punkt auf **beiden** Geraden löst beide Gleichungen: Der Schnittpunkt ist die Lösung. Probier auch die Sonderfälle aus.",
      ),
      widget: SystemLab,
    },
    {
      type: "explain",
      title: tx("Equalization (Gleichsetzungsverfahren)", "Gleichsetzungsverfahren"),
      blob: tx("Both say what y is? Then they must be equal!", "Beide sagen, was y ist? Dann müssen sie gleich sein!"),
      body: tx(
        "Use it when both equations are solved for the same variable, for example both for $y$.",
        "Nimm es, wenn beide Gleichungen nach derselben Variable aufgelöst sind, zum Beispiel beide nach $y$.",
      ),
      frames: equalization({ v: "y", m: 2, n: -1 }, { v: "y", m: -1, n: 5 }, [2, 3]),
    },
    {
      type: "check",
      blob: tx("Your turn. Set the right sides equal.", "Jetzt du! Setze die rechten Seiten gleich."),
      exercise: {
        instruction: SOLVE_EQ,
        math: sysMath(solvedSrc({ v: "y", m: 3, n: -4 }, "1"), solvedSrc({ v: "y", m: 1, n: 2 }, "2")),
        answer: pairAnswer(3, 5),
        hint: tx(
          "$3x - 4 = x + 2$. Solve for $x$, then put it into one of the equations.",
          "$3x - 4 = x + 2$. Löse nach $x$ auf und setze das Ergebnis in eine der Gleichungen ein.",
        ),
        solution: equalization({ v: "y", m: 3, n: -4 }, { v: "y", m: 1, n: 2 }, [3, 5]),
        mistakes: equalizationMistakes({ v: "y", m: 3, n: -4 }, { v: "y", m: 1, n: 2 }),
      },
    },
    {
      type: "explain",
      title: tx("Substitution (Einsetzungsverfahren)", "Einsetzungsverfahren"),
      blob: tx("Swap in what you know. Brackets are your friend here.", "Setz ein, was du schon weißt. Klammern sind hier deine Freunde."),
      body: tx(
        "Use it when **one** equation is solved for a variable. Put that expression into the other equation, then only one unknown is left.",
        "Nimm es, wenn **eine** Gleichung nach einer Variable aufgelöst ist. Setze diesen Term in die andere Gleichung ein, dann bleibt nur eine Unbekannte übrig.",
      ),
      frames: substitution({ v: "y", m: 2, n: 1 }, { x: 3, y: 1, c: 11 }, [2, 5]),
    },
    {
      type: "check",
      blob: tx("This time it's x that's on its own. Same idea!", "Diesmal steht x allein. Gleiche Idee!"),
      exercise: {
        instruction: SOLVE_SUB,
        math: sysMath(solvedSrc({ v: "x", m: 3, n: -2 }, "1"), stdSrc({ x: 2, y: 1, c: 10 }, "2")),
        answer: pairAnswer(4, 2),
        hint: tx("Put $(3y - 2)$ in place of $x$ in (II): $2(3y - 2) + y = 10$.", "Setze $(3y - 2)$ für $x$ in (II) ein: $2(3y - 2) + y = 10$."),
        solution: substitution({ v: "x", m: 3, n: -2 }, { x: 2, y: 1, c: 10 }, [4, 2]),
        mistakes: substitutionMistakes({ v: "x", m: 3, n: -2 }, { x: 2, y: 1, c: 10 }),
      },
    },
    {
      type: "explain",
      title: tx("Elimination (Additionsverfahren)", "Additionsverfahren"),
      blob: tx("Add two equations and watch a variable vanish. Magic? No, maths!", "Addiere zwei Gleichungen und sieh zu, wie eine Variable verschwindet. Zauberei? Nein, Mathe!"),
      body: tx(
        "If a variable has opposite numbers in front, adding the equations makes it cancel.",
        "Stehen vor einer Variable Gegenzahlen (wie $1$ und $-1$), fällt sie beim Addieren der Gleichungen weg.",
      ),
      frames: elimination({ x: 2, y: 1, c: 7 }, { x: 3, y: -1, c: 8 }, [3, 1]),
    },
    {
      type: "explain",
      title: tx("Multiply first", "Erst multiplizieren"),
      blob: tx("Nothing cancels? Make it cancel!", "Nichts fällt weg? Dann sorg dafür!"),
      body: tx(
        "Multiply an equation (every term on both sides!) so that one variable gets opposite numbers. Then add.",
        "Multipliziere eine Gleichung (jeden Term auf beiden Seiten!) so, dass vor einer Variable Gegenzahlen stehen. Dann addierst du.",
      ),
      frames: elimination({ x: 1, y: 2, c: 8 }, { x: 3, y: -1, c: 3 }, [2, 3]),
    },
    {
      type: "check",
      blob: tx("Which equation should you multiply, and by what?", "Welche Gleichung multiplizierst du, und womit?"),
      exercise: {
        instruction: SOLVE_ELIM,
        math: sysMath(stdSrc({ x: 3, y: 2, c: 13 }, "1"), stdSrc({ x: 1, y: -1, c: 1 }, "2")),
        answer: pairAnswer(3, 2),
        hint: tx("Multiply (II) by $2$: then the $y$-terms are $+2y$ and $-2y$.", "Multipliziere (II) mit $2$: Dann sind die $y$-Terme $+2y$ und $-2y$."),
        solution: elimination({ x: 3, y: 2, c: 13 }, { x: 1, y: -1, c: 1 }, [3, 2]),
        mistakes: eliminationMistakes({ x: 3, y: 2, c: 13 }, { x: 1, y: -1, c: 1 }),
      },
    },
    {
      type: "explain",
      title: tx("No solution or infinitely many", "Keine oder unendlich viele Lösungen"),
      blob: tx("Sometimes x and y both disappear. Then read what's left!", "Manchmal verschwinden x und y beide. Dann lies, was übrig bleibt!"),
      body: tx(
        "If both variables vanish, look at the statement that is left. **False** (like $1 = -3$): no solution, the lines are parallel. **True** (like $-2 = -2$): infinitely many, it's the same line.",
        "Fallen beide Variablen weg, schau dir die Aussage an, die übrig bleibt. **Falsch** (wie $1 = -3$): keine Lösung, die Geraden sind parallel. **Wahr** (wie $-2 = -2$): unendlich viele Lösungen, die Geraden sind identisch.",
      ),
      frames: specialFrames,
    },
    {
      type: "check",
      blob: tx("Last one! Solve it and see what's left.", "Die letzte! Löse sie und schau, was übrig bleibt."),
      exercise: {
        instruction: HOW_MANY,
        text: HOW_MANY_TEXT,
        math: sysMath(solvedSrc({ v: "y", m: -1, n: 4 }, "1"), stdSrc({ x: 2, y: 2, c: 8 }, "2")),
        answer: { kind: "choice", options: COUNT_OPTIONS, correct: 2 },
        hint: tx("Substitute $y = -x + 4$ into (II). What happens to $x$?", "Setze $y = -x + 4$ in (II) ein. Was passiert mit $x$?"),
        solution: substitution({ v: "y", m: -1, n: 4 }, { x: 2, y: 2, c: 8 }, null),
        mistakes: specialMistakes({ kind: "choice", options: COUNT_OPTIONS, correct: 2 }, X_DROPS, REALLY_VANISH),
      },
    },
  ],
  generate,
};

export default linearSystems;
