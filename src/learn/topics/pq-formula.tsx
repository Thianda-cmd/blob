"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import type { Exercise, Frame, Level, Mistake, Topic } from "@/learn/types";
import { Graph } from "@/learn/visuals/Graph";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Equations as lists of terms c·x^p with stable ids, so every term glides to
// its new place while the equation is brought into normal form. The x² term of
// the normal form gets the id "a", the x term "p" and the number "q".

type Term = { id: string; c: number; p: 0 | 1 | 2 };

const T = (id: string, c: number, p: 0 | 1 | 2): Term => ({ id, c, p });

/** Rounds away floating point noise. */
const clean = (v: number) => Math.round(v * 1e9) / 1e9;

/** Decimal comma, as in German schools: "2,5", "-0,75". */
function dec(v: number): string {
  return String(clean(v)).replace(".", ",");
}

/** In brackets when negative: "(-3)". */
const par = (v: number) => (v < 0 ? `(${dec(v)})` : dec(v));

/** A keyed number: "4#k" or "-#ks 4#k". */
const num = (v: number, k: string) => (v < 0 ? `-#${k}s ${dec(-v)}#${k}` : `${dec(v)}#${k}`);

function termSrc(t: Term, first: boolean, keys: boolean): string {
  const k = (name: string) => (keys ? `#${name}${t.id}` : "");
  const abs = Math.abs(t.c);
  const sign = t.c < 0 ? `-${k("s")} ` : first ? "" : `+${k("s")} `;
  const coef = t.p > 0 && abs === 1 ? "" : `${dec(abs)}${k("c")} `;
  const v = t.p === 0 ? "" : t.p === 1 ? `x${k("v")}` : `x${k("v")}^{2${k("e")}}`;
  return `${sign}${coef}${v}`.trim();
}

function sideSrc(ts: Term[], keys = true, zeroKey = "z"): string {
  const list = ts.filter((t) => t.c !== 0);
  if (!list.length) return keys ? `0#${zeroKey}` : "0";
  return list.map((t, i) => termSrc(t, i === 0, keys)).join(" ");
}

function eqSrc(left: Term[], right: Term[], keys = true): string {
  return keys ? `${sideSrc(left, true, "zl")} =#eq ${sideSrc(right)}` : `${sideSrc(left, false)} = ${sideSrc(right, false)}`;
}

/** Plain text of a few terms for notes, e.g. "3x - 2x". */
const plainTerms = (ts: Term[]) => sideSrc(ts, false);

/** The first term of each power (in sorted order) gets the normal-form id a, p or q. */
function assignIds(left: Term[], right: Term[]): [Term[], Term[]] {
  const moved = [...left, ...right].filter((t) => t.c !== 0).sort((a, b) => b.p - a.p);
  const first = new Map<number, string>();
  for (const t of moved) if (!first.has(t.p)) first.set(t.p, t.id);
  const rename = (t: Term): Term => (first.get(t.p) === t.id ? { ...t, id: ["q", "p", "a"][t.p] } : t);
  return [left.map(rename), right.map(rename)];
}

const normalSrc = (p: number, q: number) => `${sideSrc([T("a", 1, 2), T("p", p, 1), T("q", q, 0)])} =#eq 0#z`;

/** Joins bilingual pieces, language by language. */
const cat = (...parts: (Text | undefined)[]): Text => txMap((_, locale) => parts.map((part) => resolveText(part, locale)).join(""));

const NO_SOLUTION: Text = tx('"no solution"#none', '"keine Lösung"#none');

// ---------------------------------------------------------------------------
// Worked solutions

/** Read off p and q, put them into the formula, compute D, and the results. */
function pqFrames(p: number, q: number): Frame[] {
  const half = clean(-p / 2);
  const hq = clean((p / 2) ** 2);
  const D = clean(hq - q);
  const lead = "x#xx _{1,2#xs} =#eq";
  const pTok = (k: string) => (p < 0 ? `-#s${k} ${dec(-p)}#c${k}` : `${dec(p)}#c${k}`);
  const halfSrc = half < 0 ? `-#m1 ${dec(-half)}#h` : `${dec(half)}#h`;
  const frames: Frame[] = [
    {
      math: normalSrc(p, q),
      highlight: Math.abs(p) === 1 ? ["sp", "vp", "sq", "cq"] : ["sp", "cp", "sq", "cq"],
      note: cat(
        tx(
          `Normal form, so read off $p = ${dec(p)}$ and $q = ${dec(q)}$. The sign belongs to the number.`,
          `Das ist die Normalform. Lies $p = ${dec(p)}$ und $q = ${dec(q)}$ ab. Das Vorzeichen gehört zur Zahl.`,
        ),
        Math.abs(p) === 1 ? tx(` (A lone $x$ means $${dec(Math.abs(p))}x$.)`, ` (Ein einzelnes $x$ bedeutet $${dec(Math.abs(p))}x$.)`) : "",
      ),
    },
    {
      math: `${lead} -#m1 \\frac{${pTok("p")}}{2#t1}#F1 \\pm#pm \\sqrt{(\\frac{${pTok("p2")}}{2#t2}#F2)#B2^{2#two} -#m2 ${q < 0 ? `(-#sq ${dec(-q)}#cq)#B3` : `${dec(q)}#cq`}}#R`,
      highlight: ["sp", "cp", "sp2", "cp2", "sq", "cq"],
      note: tx("Put $p$ and $q$ into the pq formula. Negative numbers go in brackets.", "Setz $p$ und $q$ in die pq-Formel ein. Negative Zahlen kommen in Klammern."),
    },
    {
      math: `${lead} ${halfSrc} \\pm#pm \\sqrt{${dec(hq)}#hq ${q < 0 ? `+#m2 ${dec(-q)}#cq` : `-#m2 ${dec(q)}#cq`}}#R`,
      note: cat(
        tx(
          `$-\\frac{${dec(p)}}{2} = ${dec(half)}$ and $(\\frac{${dec(p)}}{2})^2 = ${dec(hq)}$.`,
          `$-\\frac{${dec(p)}}{2} = ${dec(half)}$ und $(\\frac{${dec(p)}}{2})^2 = ${dec(hq)}$.`,
        ),
        q < 0 ? tx(` And $-(${dec(q)}) = +${dec(-q)}$.`, ` Und $-(${dec(q)}) = +${dec(-q)}$.`) : "",
      ),
    },
    {
      math: `${lead} ${halfSrc} \\pm#pm \\sqrt{${num(D, "D")}}#R`,
      highlight: ["D", "Ds"],
      note:
        D > 0
          ? tx(
              `Under the root is the discriminant $D = ${dec(D)}$. It's positive, so there are **two** solutions.`,
              `Unter der Wurzel steht die Diskriminante $D = ${dec(D)}$. Sie ist positiv, also gibt es **zwei** Lösungen.`,
            )
          : D === 0
            ? tx(
                "The discriminant is $D = 0$. Plus or minus $0$ is the same, so there's only **one** solution.",
                "Die Diskriminante ist $D = 0$. Plus oder minus $0$ ist dasselbe, also gibt es nur **eine** Lösung.",
              )
            : tx(
                `The discriminant $D = ${dec(D)}$ is negative. There is no square root of a negative number.`,
                `Die Diskriminante $D = ${dec(D)}$ ist negativ. Aus einer negativen Zahl kann man keine Wurzel ziehen.`,
              ),
    },
  ];
  if (D > 0) {
    const r = clean(Math.sqrt(D));
    const x1 = clean(half + r);
    const x2 = clean(half - r);
    frames.push({ math: `${lead} ${halfSrc} \\pm#pm ${dec(r)}#rt`, note: `$\\sqrt{${dec(D)}} = ${dec(r)}$.` });
    frames.push({
      math: `x#xx _{1#xs} =#eq ${num(x1, "h")} \\quad x#x2 _{2#x2s} =#eq2 ${num(x2, "r2")}`,
      note: tx(
        `$x_1 = ${dec(half)} + ${dec(r)} = ${dec(x1)}$ and $x_2 = ${dec(half)} - ${dec(r)} = ${dec(x2)}$.`,
        `$x_1 = ${dec(half)} + ${dec(r)} = ${dec(x1)}$ und $x_2 = ${dec(half)} - ${dec(r)} = ${dec(x2)}$.`,
      ),
    });
  } else if (D === 0) {
    frames.push({ math: `x#xx =#eq ${halfSrc}`, note: tx(`So $x = ${dec(half)}$.`, `Also ist $x = ${dec(half)}$.`) });
  } else {
    frames.push({ math: NO_SOLUTION, note: tx("So the equation has **no solution**.", "Die Gleichung hat also **keine Lösung**: $L = \\{ \\}$.") });
  }
  return frames;
}

/** x² + px = 0: factor out x. */
function qZeroFrames(p: number): Frame[] {
  const sign = p < 0 ? "-" : "+";
  return [
    {
      math: normalSrc(p, 0),
      note: tx(
        "There's no number on its own: $q = 0$. Faster than the formula: factor out $x$.",
        "Es gibt keine Zahl ohne $x$: $q = 0$. Schneller als mit der Formel: Klammere $x$ aus.",
      ),
    },
    { math: `x#va (x#vp ${sign}#sp ${dec(Math.abs(p))}#cp)#B =#eq 0#z`, note: `$x^2 ${sign} ${dec(Math.abs(p))}x = x \\cdot (x ${sign} ${dec(Math.abs(p))})$.` },
    {
      math: `x#xx _{1#xs} =#eq 0#r1 \\quad x#x2 _{2#x2s} =#eq2 ${num(-p, "cp")}`,
      note: tx(
        `A product is $0$ when one factor is $0$: $x = 0$ or $x ${sign} ${dec(Math.abs(p))} = 0$, so $x = ${dec(-p)}$.`,
        `Ein Produkt ist $0$, wenn ein Faktor $0$ ist: $x = 0$ oder $x ${sign} ${dec(Math.abs(p))} = 0$, also $x = ${dec(-p)}$.`,
      ),
    },
  ];
}

/** x² + q = 0: get x² alone and take the root. */
function pZeroFrames(q: number): Frame[] {
  const rhs = -q;
  const frames: Frame[] = [
    {
      math: normalSrc(0, q),
      note: tx(
        "There's no $x$-term: $p = 0$. Faster than the formula: get $x^2$ on its own.",
        "Es fehlt der $x$-Term: $p = 0$. Schneller als mit der Formel: Löse nach $x^2$ auf.",
      ),
    },
    {
      math: `x#va^{2#ea} =#eq ${num(rhs, "cq")}`,
      note: tx(
        `Bring the $${dec(Math.abs(q))}$ to the other side. It changes its sign.`,
        `Bring die $${dec(Math.abs(q))}$ auf die andere Seite. Dabei ändert sich ihr Vorzeichen.`,
      ),
    },
  ];
  if (rhs > 0) {
    const r = clean(Math.sqrt(rhs));
    frames.push({
      math: `x#va =#eq \\pm#pm ${dec(r)}#cq`,
      note: tx(
        `Take the root. Don't forget the minus: $${dec(r)}^2 = ${dec(rhs)}$ and $(-${dec(r)})^2 = ${dec(rhs)}$ too.`,
        `Zieh die Wurzel. Vergiss das Minus nicht: $${dec(r)}^2 = ${dec(rhs)}$ und auch $(-${dec(r)})^2 = ${dec(rhs)}$.`,
      ),
    });
    frames.push({
      math: `x#va _{1#xs} =#eq ${dec(r)}#cq \\quad x#x2 _{2#x2s} =#eq2 -#r2s ${dec(r)}#r2`,
      note: tx(`Two solutions: $x_1 = ${dec(r)}$ and $x_2 = -${dec(r)}$.`, `Zwei Lösungen: $x_1 = ${dec(r)}$ und $x_2 = -${dec(r)}$.`),
    });
  } else {
    frames.push({
      math: NO_SOLUTION,
      note: tx(
        `A square is never negative, so $x^2 = ${dec(rhs)}$ has **no solution**.`,
        `Ein Quadrat ist nie negativ, also hat $x^2 = ${dec(rhs)}$ **keine Lösung**: $L = \\{ \\}$.`,
      ),
    });
  }
  return frames;
}

function combineNote(ts: Term[]): Text {
  const parts: string[] = [];
  for (const p of [2, 1, 0] as const) {
    const list = ts.filter((t) => t.p === p && t.c !== 0);
    if (list.length < 2) continue;
    const sum = clean(list.reduce((s, t) => s + t.c, 0));
    parts.push(`$${plainTerms(list)} = ${sum === 0 ? "0" : plainTerms([T("s", sum, p)])}$`);
  }
  return tx(parts.join(" and "), parts.length > 2 ? `${parts.slice(0, -1).join(", ")} und ${parts[parts.length - 1]}` : parts.join(" und "));
}

/**
 * The whole worked solution for left = right (ids already assigned with
 * assignIds): normal form, then the pq formula or a shortcut.
 */
function solutionFrames(left: Term[], right: Term[], startNote?: Text): Frame[] {
  const frames: Frame[] = [];
  let cur = left.filter((t) => t.c !== 0);
  const moving = right.filter((t) => t.c !== 0);
  if (moving.length) {
    frames.push({
      math: eqSrc(left, right),
      note: startNote ?? tx("First bring the equation into normal form $x^2 + px + q = 0$.", "Bring die Gleichung zuerst in die Normalform $x^2 + px + q = 0$."),
    });
    cur = [...cur, ...moving.map((t) => ({ ...t, c: -t.c }))];
    frames.push({
      math: `${sideSrc(cur)} =#eq 0#z`,
      note: tx(
        "Bring everything to the left side. Terms that change sides flip their sign.",
        "Bring alles auf die linke Seite. Terme, die die Seite wechseln, ändern ihr Vorzeichen.",
      ),
      highlight: moving.flatMap((t) => [`s${t.id}`, `c${t.id}`]),
    });
  }
  const sorted = [...cur].sort((a, b) => b.p - a.p);
  if (sorted.some((t, i) => t.id !== cur[i].id)) {
    frames.push({
      math: `${sideSrc(sorted)} =#eq 0#z`,
      note: tx(
        "Sort the terms: $x^2$ first, then $x$, then the numbers. Each term takes its sign along.",
        "Sortiere die Terme: erst $x^2$, dann $x$, dann die Zahlen. Jeder Term nimmt sein Vorzeichen mit.",
      ),
    });
    cur = sorted;
  }
  const combined: Term[] = [];
  for (const t of cur) {
    const prev = combined.find((x) => x.p === t.p);
    if (prev) prev.c = clean(prev.c + t.c);
    else combined.push({ ...t });
  }
  if (combined.length < cur.length) {
    frames.push({ math: `${sideSrc(combined)} =#eq 0#z`, note: cat(tx("Combine like terms: ", "Fasse gleichartige Terme zusammen: "), combineNote(cur), ".") });
  }
  cur = combined.filter((t) => t.c !== 0);
  const coefOf = (p: number) => cur.find((t) => t.p === p)?.c ?? 0;
  const A = coefOf(2);
  if (A !== 1) {
    const by = A === 0.5 ? "\\cdot#dv 2#da" : `:#dv ${par(A)}#da`;
    frames.push({
      math: `${sideSrc(cur)} =#eq 0#z \\quad |#bar ${by}`,
      highlight: ["bar", "dv", "da"],
      note:
        A === 0.5
          ? tx(
              "Multiply **every** term by $2$ (the same as dividing by $0,5$), so that $x^2$ stands alone.",
              "Multipliziere **jeden** Term mit $2$ (das ist dasselbe wie durch $0,5$ teilen), damit vor $x^2$ keine Zahl mehr steht.",
            )
          : tx(
              `There's a $${dec(A)}$ in front of $x^2$. Divide **every** term by $${par(A)}$, so that $x^2$ stands alone.`,
              `Vor $x^2$ steht eine $${dec(A)}$. Teile **jeden** Term durch $${par(A)}$, damit vor $x^2$ keine Zahl mehr steht.`,
            ),
    });
  }
  const p = clean(coefOf(1) / A);
  const q = clean(coefOf(0) / A);
  const rest = q === 0 ? qZeroFrames(p) : p === 0 ? pZeroFrames(q) : pqFrames(p, q);
  // Combining often lands exactly on the normal form: show it once, with both notes.
  const last = frames[frames.length - 1];
  if (last && last.math === rest[0].math) frames[frames.length - 1] = { ...rest[0], note: cat(last.note, " ", rest[0].note) };
  else frames.push(rest[0]);
  return [...frames, ...rest.slice(1)];
}

// ---------------------------------------------------------------------------
// Typical mistakes, simulated: each wrong set of solutions is exactly what a
// student with that misconception gets (roots that don't come out evenly are
// rounded to two decimals, the way students type them). Kept only when it
// differs from the right answer and from the mistakes before it.

type Coefs = { a: number; b: number; c: number };

/** left = right as a·x² + b·x + c = 0. */
function coefsOf(left: Term[], right: Term[]): Coefs {
  const all = [...left, ...right.map((t) => ({ ...t, c: -t.c }))];
  const k = (p: number) => clean(all.filter((t) => t.p === p).reduce((s, t) => s + t.c, 0));
  return { a: k(2), b: k(1), c: k(0) };
}

/** The pq formula with its middle (normally −p/2) and the part under the root (normally D). */
function pqValues(mid: number, D: number): number[] {
  if (D < -1e-9) return [];
  if (Math.abs(D) < 1e-9) return [clean(mid)];
  const r = Math.sqrt(D);
  return [clean(mid + r), clean(mid - r)];
}

/** Solutions of a·x² + b·x + c = 0, solved correctly from there (null if it isn't quadratic). */
function solveCoefs({ a, b, c }: Coefs): number[] | null {
  if (Math.abs(a) < 1e-9) return null;
  const p = b / a;
  return pqValues(-p / 2, (p / 2) ** 2 - c / a);
}

const near = (u: number, v: number) => Math.abs(u - v) < 1e-6;
const sameSet = (u: number[], v: number[]) => u.length === v.length && u.every((x) => v.some((y) => near(x, y)));
/** As a student types it: two decimals at most. */
const typed = (v: number) => clean(Math.round(v * 100) / 100);

/** When the slip led to "no solution", Blob opens differently. */
const NONE_LEAD = tx("Hmm, no solution? I think I see why. ", "Hm, keine Lösung? Ich glaub, ich weiß, warum. ");
const T_MOVED = tx("Sign kept when moving", "Vorzeichen nicht gedreht");

type WrongStart = { left: Term[]; title: Text; lead: Text; body: Text };

/**
 * Typical slips for left = right with the given solutions: brackets expanded
 * wrongly (`wrong`), terms moved without flipping the sign, the shortcuts for
 * q = 0 and p = 0, not dividing by a, and the classic slips inside the formula.
 */
function pqMistakes(left: Term[], right: Term[], values: number[], wrong: WrongStart[] = []): Mistake[] {
  const list: Mistake[] = [];
  /** `part`: may be just one of the right solutions. `close`: a near miss, Blob looks thoughtful. */
  const add = (sol: number[] | null, title: Text, lead: Text, body: Text, { part = false, close = false } = {}) => {
    if (!sol || list.length >= 5) return;
    const vals = [...new Set(sol.map(typed))];
    if (sameSet(vals, values) || list.some((m) => m.when.kind === "solutions" && sameSet(m.when.values, vals))) return;
    // Only part of the right answer: the general "one more to find" says that better.
    if (!part && vals.length && vals.length < values.length && vals.every((v) => values.some((w) => near(v, w)))) return;
    const when = { kind: "solutions" as const, variable: "x", values: vals, allowNone: true };
    list.push({ when, title, say: cat(vals.length ? lead : NONE_LEAD, body), ...(close ? { close } : {}) });
  };

  const { a: A, b: B, c: C } = coefsOf(left, right);
  const p = clean(B / A);
  const q = clean(C / A);
  const D = clean((p / 2) ** 2 - q);

  for (const w of wrong) add(solveCoefs(coefsOf(w.left, right)), w.title, w.lead, w.body);

  const moving = right.filter((t) => t.c !== 0);
  if (moving.length) {
    const R = plainTerms(moving);
    const one = moving.length === 1;
    add(
      solveCoefs(coefsOf([...left, ...moving], [])),
      T_MOVED,
      tx("Ah, I see what happened! ", "Ah, ich seh, was passiert ist! "),
      one
        ? tx(
            `You brought $${R}$ over to the left but kept its sign. A term that changes sides flips its sign.`,
            `Du hast $${R}$ nach links gebracht, aber das Vorzeichen behalten. Ein Term, der die Seite wechselt, ändert sein Vorzeichen.`,
          )
        : tx(
            `You brought $${R}$ over to the left but kept the signs. Every term that changes sides flips its sign.`,
            `Du hast $${R}$ nach links gebracht, aber die Vorzeichen behalten. Jeder Term, der die Seite wechselt, ändert sein Vorzeichen.`,
          ),
    );
  }

  const nearly = tx("Nearly! ", "Fast! ");
  if (C === 0 && B !== 0) {
    add(
      [-p],
      tx("A solution got lost", "Eine Lösung ging verloren"),
      nearly,
      tx(
        "Did you divide by $x$? That quietly throws away a solution. Factor out $x$ instead: a product is $0$ when **one** of its factors is $0$.",
        "Hast du durch $x$ geteilt? Dabei geht heimlich eine Lösung verloren. Klammere lieber $x$ aus: Ein Produkt ist $0$, wenn **einer** der Faktoren $0$ ist.",
      ),
      { part: true, close: true },
    );
    const s = p < 0 ? "-" : "+";
    add(
      [0, p],
      tx("Sign in the last step", "Vorzeichen im letzten Schritt"),
      nearly,
      tx(
        `$x = 0$ is right! For the other one, $x ${s} ${dec(Math.abs(p))} = 0$: when the $${dec(Math.abs(p))}$ moves over, its sign flips.`,
        `$x = 0$ stimmt! Für die andere gilt $x ${s} ${dec(Math.abs(p))} = 0$: Wenn die $${dec(Math.abs(p))}$ auf die andere Seite wandert, dreht sich ihr Vorzeichen.`,
      ),
      { close: true },
    );
  } else if (B === 0 && C !== 0) {
    const rhs = -q;
    if (rhs > 0) {
      add(
        [rhs / 2, -rhs / 2],
        tx("A root isn't half", "Wurzel ist nicht die Hälfte"),
        tx("Ah, I see what happened! ", "Ah, ich seh, was passiert ist! "),
        tx(
          `You halved $${dec(rhs)}$. But the root asks which number **times itself** gives $${dec(rhs)}$.`,
          `Du hast $${dec(rhs)}$ halbiert. Aber die Wurzel fragt, welche Zahl **mal sich selbst** $${dec(rhs)}$ ergibt.`,
        ),
      );
      add(
        [],
        T_MOVED,
        "",
        tx(
          `When the $${dec(Math.abs(C))}$ moves to the other side, its sign flips. Then $x^2$ equals a **positive** number.`,
          `Wenn die $${dec(Math.abs(C))}$ auf die andere Seite wandert, dreht sich ihr Vorzeichen. Dann ist $x^2$ gleich einer **positiven** Zahl.`,
        ),
      );
      if (A !== 1 && -C > 0)
        add(
          [Math.sqrt(-C), -Math.sqrt(-C)],
          tx("Not divided yet", "Noch nicht geteilt"),
          nearly,
          tx(
            `Before taking the root, $x^2$ has to stand alone: divide by the $${dec(A)}$ in front first.`,
            `Bevor du die Wurzel ziehst, muss $x^2$ allein stehen: Teile zuerst durch die $${dec(A)}$ davor.`,
          ),
        );
    } else {
      const r = Math.sqrt(q);
      add(
        [r, -r],
        tx("A square is never negative", "Ein Quadrat ist nie negativ"),
        tx("Careful! ", "Vorsicht! "),
        tx(
          `Put your answer back in: $${dec(clean(r))}^2 = ${dec(q)}$, but you'd need $x^2 = ${dec(rhs)}$. Can a square ever be negative?`,
          `Setz deine Lösung mal ein: $${dec(clean(r))}^2 = ${dec(q)}$, du bräuchtest aber $x^2 = ${dec(rhs)}$. Kann ein Quadrat überhaupt negativ sein?`,
        ),
      );
    }
  } else if (A !== 1) {
    add(
      solveCoefs({ a: 1, b: B, c: C }),
      tx("Not in normal form yet", "Noch nicht in Normalform"),
      tx("Ah, I see what happened! ", "Ah, ich seh, was passiert ist! "),
      A === -1
        ? tx(
            "You read off $p$ and $q$ straight away. But there's a minus in front of $x^2$! Multiply **every** term by $-1$ first.",
            "Du hast $p$ und $q$ direkt abgelesen. Aber vor $x^2$ steht ein Minus! Multipliziere zuerst **jeden** Term mit $-1$.",
          )
        : A === 0.5
          ? tx(
              "You read off $p$ and $q$ straight away. But there's a $0,5$ in front of $x^2$! Multiply **every** term by $2$ first.",
              "Du hast $p$ und $q$ direkt abgelesen. Aber vor $x^2$ steht $0,5$! Multipliziere zuerst **jeden** Term mit $2$.",
            )
          : tx(
              `You read off $p$ and $q$ straight away. But there's a $${dec(A)}$ in front of $x^2$! Divide **every** term by $${par(A)}$ first.`,
              `Du hast $p$ und $q$ direkt abgelesen. Aber vor $x^2$ steht eine $${dec(A)}$! Teile zuerst **jeden** Term durch $${par(A)}$.`,
            ),
    );
  }

  // Slips inside the formula.
  const halfP = `-\\frac{${dec(p)}}{2} = ${dec(-p / 2)}`;
  if (D >= 0) {
    const flipped = pqValues(p / 2, D);
    add(
      flipped,
      tx("Sign of −p/2", "Vorzeichen von −p/2"),
      flipped.length > 1 ? tx("Nearly, just the signs are off! ", "Fast, nur die Vorzeichen stimmen nicht! ") : tx("Nearly, just the sign is off! ", "Fast, nur das Vorzeichen stimmt nicht! "),
      tx(
        `The formula starts with **minus** $\\frac{p}{2}$: with $p = ${dec(p)}$ that's $${halfP}$.`,
        `Die Formel beginnt mit **minus** $\\frac{p}{2}$: Mit $p = ${dec(p)}$ ist das $${halfP}$.`,
      ),
      { close: true },
    );
  }
  if (q !== 0)
    add(
      pqValues(-p / 2, (p / 2) ** 2 + q),
      tx("Sign of q", "Vorzeichen von q"),
      tx("Ah, I see what happened! ", "Ah, ich seh, was passiert ist! "),
      q < 0
        ? tx(
            `Under the root it's $(\\frac{p}{2})^2 - q$, and with $q = ${dec(q)}$ that's minus minus, so **plus** $${dec(-q)}$. I think you subtracted it.`,
            `Unter der Wurzel steht $(\\frac{p}{2})^2 - q$, und mit $q = ${dec(q)}$ ist das minus minus, also **plus** $${dec(-q)}$. Ich glaub, du hast $${dec(-q)}$ abgezogen.`,
          )
        : tx(
            `Under the root it's $(\\frac{p}{2})^2 - q$, so you **subtract** $q = ${dec(q)}$. I think you added it.`,
            `Unter der Wurzel steht $(\\frac{p}{2})^2 - q$, du ziehst also $q = ${dec(q)}$ **ab**. Ich glaub, du hast $${dec(q)}$ addiert.`,
          ),
      { close: true },
    );
  if (p !== 0) {
    const close = tx("Close! ", "Knapp! ");
    add(
      pqValues(-p / 2, p * p - q),
      tx("p instead of p/2", "p statt p/2"),
      close,
      tx(
        "Under the root it's $(\\frac{p}{2})^2$, not $p^2$. Halve $p$ first, then square it.",
        "Unter der Wurzel steht $(\\frac{p}{2})^2$, nicht $p^2$. Halbiere $p$ zuerst, dann quadrier es.",
      ),
      { close: true },
    );
    add(
      pqValues(-p, D),
      tx("p instead of p/2", "p statt p/2"),
      close,
      tx("The formula starts with $-\\frac{p}{2}$, not $-p$. Halve $p$ there too.", "Die Formel beginnt mit $-\\frac{p}{2}$, nicht mit $-p$. Halbiere $p$ auch dort."),
      { close: true },
    );
  }
  if (D < 0)
    add(
      pqValues(-p / 2, -D),
      tx("Negative under the root", "Negativ unter der Wurzel"),
      tx("Careful! ", "Vorsicht! "),
      tx(
        `Look under the root: $(\\frac{p}{2})^2 - q = ${dec(D)}$. I think you dropped its minus. Can you take the root of a negative number?`,
        `Schau unter die Wurzel: $(\\frac{p}{2})^2 - q = ${dec(D)}$. Ich glaub, du hast das Minus weggelassen. Kann man aus einer negativen Zahl die Wurzel ziehen?`,
      ),
    );
  return list;
}

// ---------------------------------------------------------------------------
// Exercise generator: designed backwards from the solutions.

type Target = { p: number; q: number; values: number[] };

function twoRoots(rng: Rng, parity: "even" | "odd" | "any", max = 9, qMax = 45): Target | null {
  const x1 = rng.nonZero(-max, max);
  const x2 = rng.nonZero(-max, max);
  const p = -(x1 + x2);
  const q = x1 * x2;
  if (x1 === x2 || p === 0 || Math.abs(q) > qMax) return null;
  if (parity === "even" && p % 2 !== 0) return null;
  if (parity === "odd" && p % 2 === 0) return null;
  return { p, q, values: [Math.max(x1, x2), Math.min(x1, x2)] };
}

function doubleRoot(rng: Rng): Target {
  const r = rng.nonZero(-8, 8);
  return { p: -2 * r, q: r * r, values: [r] };
}

function noRoot(rng: Rng): Target {
  const p = 2 * rng.nonZero(-4, 4);
  const q = (p * p) / 4 + rng.int(1, 12);
  return { p, q, values: [] };
}

/** Two half-integer roots: p stays whole, q gets ,25 or ,75. */
function halfRoots(rng: Rng): Target | null {
  const r1 = rng.int(-5, 4) + 0.5;
  const r2 = rng.int(-5, 4) + 0.5;
  const p = clean(-(r1 + r2));
  const q = clean(r1 * r2);
  if (r1 === r2 || p === 0 || Math.abs(q) > 20) return null;
  return { p, q, values: [Math.max(r1, r2), Math.min(r1, r2)] };
}

function anyTarget(rng: Rng): Target | null {
  const roll = rng.next();
  return roll < 0.75 ? twoRoots(rng, "any", 8, 40) : roll < 0.87 ? noRoot(rng) : doubleRoot(rng);
}

const answer = (values: number[]) => ({ kind: "solutions" as const, variable: "x", values, allowNone: true });

const HINT_FORMULA = tx(
  "Read off $p$ and $q$ with their signs. Then $x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$.",
  "Lies $p$ und $q$ mit Vorzeichen ab. Dann gilt $x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$.",
);
const HINT_D = tx(
  "Work out the discriminant $D = (\\frac{p}{2})^2 - q$ first. Its sign tells you how many solutions there are.",
  "Berechne zuerst die Diskriminante $D = (\\frac{p}{2})^2 - q$. Ihr Vorzeichen verrät dir, wie viele Lösungen es gibt.",
);
const SOLVE = tx("Solve for x", "Löse die Gleichung");
const divideFirst = (a: number) =>
  tx(`Divide by $${a}$ first. Then look at the discriminant.`, `Teile zuerst durch $${a}$. Dann schau dir die Diskriminante an.`);

function normalTask(target: Target, a: number, hint: Text): Exercise {
  const left = [T("a", a, 2), T("p", clean(a * target.p), 1), T("q", clean(a * target.q), 0)];
  return {
    instruction: SOLVE,
    math: eqSrc(left, [], false),
    answer: answer(target.values),
    hint,
    solution: solutionFrames(left, []),
    mistakes: pqMistakes(left, [], target.values),
  };
}

function level1(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.55) {
    const t = twoRoots(rng, "even", 10, 50);
    return t && normalTask(t, 1, HINT_FORMULA);
  }
  if (roll < 0.8) {
    const t = twoRoots(rng, "odd", 8);
    return (
      t &&
      normalTask(
        t,
        1,
        tx("$p$ is odd, so $\\frac{p}{2}$ is a decimal number like $1,5$. That's fine!", "$p$ ist ungerade, also ist $\\frac{p}{2}$ eine Dezimalzahl wie $1,5$. Das ist okay!"),
      )
    );
  }
  if (rng.chance(0.5)) {
    const r = rng.nonZero(-12, 12);
    return normalTask({ p: -r, q: 0, values: [0, r] }, 1, tx("There's no number on its own. Factor out $x$.", "Es gibt keine Zahl ohne $x$. Klammere $x$ aus."));
  }
  const r = rng.int(2, 12);
  return normalTask(
    { p: 0, q: -r * r, values: [r, -r] },
    1,
    tx(
      "There's no $x$-term. Solve for $x^2$ and take the root. Two solutions!",
      "Es fehlt der $x$-Term. Löse nach $x^2$ auf und zieh die Wurzel. Zwei Lösungen!",
    ),
  );
}

function level2(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.5) {
    const t = twoRoots(rng, "any", 7, 30);
    const a = rng.pick([2, 2, 3, 4, 5, -1, -2, -3]);
    if (!t || Math.abs(a * t.q) > 80 || Math.abs(a * t.p) > 40) return null;
    return normalTask(
      t,
      a,
      a === -1
        ? tx("Multiply everything by $-1$ (or divide by $-1$) first.", "Multipliziere zuerst alles mit $-1$ (oder teile durch $-1$).")
        : tx(`Divide every term by $${par(a)}$ first.`, `Teile zuerst jeden Term durch $${par(a)}$.`),
    );
  }
  if (roll < 0.65) {
    const t = doubleRoot(rng);
    const a = rng.pick([1, 1, 2, 3]);
    if (Math.abs(a * t.q) > 80) return null;
    return normalTask(t, a, a === 1 ? HINT_D : divideFirst(a));
  }
  if (roll < 0.8) {
    const t = noRoot(rng);
    const a = rng.pick([1, 1, 1, 2, 3]);
    if (Math.abs(a * t.q) > 80) return null;
    return normalTask(t, a, a === 1 ? HINT_D : divideFirst(a));
  }
  const a = rng.pick([2, 3, 4, 5]);
  const kind = rng.pick([0, 0, 1, 1, 2]);
  if (kind === 0) {
    const r = rng.nonZero(-8, 8);
    return normalTask(
      { p: -r, q: 0, values: [0, r] },
      a,
      tx("There's no number on its own. Factor out $x$, or divide first.", "Es gibt keine Zahl ohne $x$. Klammere $x$ aus oder teile vorher."),
    );
  }
  if (kind === 1) {
    const r = rng.int(2, 6);
    return normalTask(
      { p: 0, q: -r * r, values: [r, -r] },
      a,
      tx("There's no $x$-term. Solve for $x^2$ and take the root.", "Es fehlt der $x$-Term. Löse nach $x^2$ auf und zieh die Wurzel."),
    );
  }
  const k = rng.int(1, 9);
  return normalTask({ p: 0, q: k, values: [] }, 1, tx("Solve for $x^2$. Can a square be negative?", "Löse nach $x^2$ auf. Kann ein Quadrat negativ sein?"));
}

/** Terms on both sides of the equation. */
function bothSides(rng: Rng): Exercise | null {
  const t = anyTarget(rng);
  if (!t) return null;
  const A = rng.pick([1, 1, 1, 2]);
  const ar = rng.chance(0.3) ? rng.int(1, 2) : 0;
  const d = rng.int(-6, 6);
  const e = rng.int(-15, 15);
  const bl = A * t.p + d;
  const cl = A * t.q + e;
  if ((d === 0 && e === 0 && ar === 0) || Math.abs(bl) > 14 || Math.abs(cl) > 40) return null;
  const [left, right] = assignIds([T("l1", A + ar, 2), T("l2", bl, 1), T("l3", cl, 0)], [T("r1", ar, 2), T("r2", d, 1), T("r3", e, 0)]);
  if (left.filter((x) => x.c !== 0).length < 2) return null;
  return {
    instruction: SOLVE,
    math: eqSrc(left, right, false),
    answer: answer(t.values),
    hint: tx("Bring everything to one side first, sort the terms and combine them.", "Bring zuerst alles auf eine Seite, sortiere die Terme und fasse sie zusammen."),
    solution: solutionFrames(left, right),
    mistakes: pqMistakes(left, right, t.values),
  };
}

const bracket = (u: number) => `(x ${u < 0 ? "-" : "+"} ${Math.abs(u)})`;

/** Brackets to expand first: (x + u)(x + v) = dx + e, x(x + u) = dx + e, (x + u)² = dx + e. */
function withBrackets(rng: Rng): Exercise | null {
  const t = rng.chance(0.85) ? twoRoots(rng, "any", 8, 40) : noRoot(rng);
  if (!t) return null;
  const kind = rng.pick(["two", "two", "x", "square"] as const);
  const u = rng.nonZero(-6, 6);
  const v = kind === "two" ? rng.nonZero(-6, 6) : kind === "square" ? u : 0;
  // Expanded left side: x² + (u + v)x + uv (for "x": v = 0 and no constant).
  const bx = kind === "x" ? u : u + v;
  const c0 = kind === "x" ? 0 : u * v;
  const d = bx - t.p;
  const e = c0 - t.q;
  if ((d === 0 && e === 0) || Math.abs(d) > 9 || Math.abs(e) > 30) return null;
  const rawLeft =
    kind === "two"
      ? [T("l1", 1, 2), T("l2", v, 1), T("l3", u, 1), T("l4", u * v, 0)]
      : kind === "x"
        ? [T("l1", 1, 2), T("l2", u, 1)]
        : [T("l1", 1, 2), T("l2", 2 * u, 1), T("l3", u * u, 0)];
  const [left, right] = assignIds(rawLeft, [T("r1", d, 1), T("r2", e, 0)]);
  const head = kind === "two" ? `${bracket(u)} ${bracket(v)}` : kind === "x" ? `x ${bracket(u)}` : `${bracket(u)}^2`;
  // The same task with the brackets expanded the way a student with a misconception would.
  const wrong: WrongStart =
    kind === "two"
      ? {
          left: [T("l1", 1, 2), T("l4", u * v, 0)],
          title: tx("Only two of four products", "Nur zwei von vier Produkten"),
          lead: tx("Ah, I see what happened! ", "Ah, ich seh, was passiert ist! "),
          body: tx(
            `You multiplied first with first and last with last. But in $${head}$ **each** term meets **each** term: that's four products.`,
            `Du hast Erstes mal Erstes und Letztes mal Letztes gerechnet. Aber bei $${head}$ trifft **jeder** Term **jeden**: Das sind vier Produkte.`,
          ),
        }
      : kind === "x"
        ? {
            left: [T("l1", 1, 2), T("l2", u, 0)],
            title: tx("Only the first term multiplied", "Nur der erste Term multipliziert"),
            lead: tx("Nearly! ", "Fast! "),
            body: tx(
              `The $x$ in front only reached the $x$ in the bracket. It multiplies the $${Math.abs(u)}$ too.`,
              `Das $x$ davor hat nur das $x$ in der Klammer erwischt. Es multipliziert auch die $${Math.abs(u)}$.`,
            ),
          }
        : {
            left: [T("l1", 1, 2), T("l3", u * u, 0)],
            title: tx("Middle term missing", "Mittelterm fehlt"),
            lead: tx("Ooh, classic trap! ", "Ooh, die klassische Falle! "),
            body: tx(
              `$${head}$ is **not** $x^2 + ${u * u}$: the middle term is missing. Use the binomial formula.`,
              `$${head}$ ist **nicht** $x^2 + ${u * u}$: Der Mittelterm fehlt. Nimm die binomische Formel.`,
            ),
          };
  const keyedHead = kind === "two" ? `${bracket(u)}#B1 ${bracket(v)}#B2` : kind === "x" ? `x#B0 ${bracket(u)}#B1` : `${bracket(u)}#B1^{2#B1e}`;
  const expandNote =
    kind === "two"
      ? tx("Expand the brackets: every term times every term.", "Multipliziere die Klammern aus: jeder Term mal jeder Term.")
      : kind === "x"
        ? tx(
            `Multiply the $x$ into the bracket: $x ${bracket(u)} = ${plainTerms(rawLeft)}$.`,
            `Multipliziere die Klammer aus: $x ${bracket(u)} = ${plainTerms(rawLeft)}$.`,
          )
        : tx(`Binomial formula: $${bracket(u)}^2 = ${plainTerms(rawLeft)}$.`, `Binomische Formel: $${bracket(u)}^2 = ${plainTerms(rawLeft)}$.`);
  return {
    instruction: SOLVE,
    math: `${head} = ${sideSrc(right, false)}`,
    answer: answer(t.values),
    hint: tx("Expand the brackets first. Then bring everything to one side.", "Multipliziere zuerst die Klammern aus. Dann bring alles auf eine Seite."),
    solution: [
      {
        math: `${keyedHead} =#eq ${sideSrc(right)}`,
        note: tx("Brackets first. The pq formula only works for the normal form.", "Erst die Klammern. Die pq-Formel funktioniert nur mit der Normalform."),
      },
      ...solutionFrames(left, right, expandNote),
    ],
    mistakes: pqMistakes(rawLeft, right, t.values, [wrong]),
  };
}

/** Decimal p and q, or a decimal factor in front of x². */
function decimals(rng: Rng): Exercise | null {
  const roll = rng.next();
  if (roll < 0.5) {
    const t = halfRoots(rng);
    return (
      t &&
      normalTask(
        t,
        1,
        tx(
          "Careful with the decimals: work out $(\\frac{p}{2})^2$ first, then subtract $q$.",
          "Vorsicht mit den Dezimalzahlen: Berechne erst $(\\frac{p}{2})^2$, dann zieh $q$ ab.",
        ),
      )
    );
  }
  if (roll < 0.75) {
    const t = halfRoots(rng);
    if (!t || Math.abs(4 * t.q) > 60) return null;
    return normalTask(t, 4, tx("Divide every term by $4$ first. Decimals are fine.", "Teile zuerst jeden Term durch $4$. Dezimalzahlen sind okay."));
  }
  const t = twoRoots(rng, "any", 8, 30);
  return (
    t &&
    normalTask(
      t,
      0.5,
      tx("Multiply every term by $2$ first, so that $x^2$ stands alone.", "Multipliziere zuerst jeden Term mit $2$, damit vor $x^2$ keine Zahl mehr steht."),
    )
  );
}

function generate(level: Level, rng: Rng): Exercise {
  for (let tries = 0; tries < 60; tries++) {
    let ex: Exercise | null;
    if (level === 1) ex = level1(rng);
    else if (level === 2) ex = level2(rng);
    else {
      const roll = rng.next();
      ex = roll < 0.3 ? bothSides(rng) : roll < 0.65 ? withBrackets(rng) : decimals(rng);
    }
    if (ex) return ex;
  }
  return normalTask({ p: -4, q: -5, values: [5, -1] }, 1, HINT_FORMULA);
}

// ---------------------------------------------------------------------------
// Interactive: a parabola y = x² + px + q with sliders for p and q. The zeros
// glide along the x-axis; the vertex sits D below the axis and each zero lies
// √D away from the middle −p/2.

const XR: [number, number] = [-8, 8];
const YR: [number, number] = [-9, 6];
const P_RANGE: [number, number] = [-4, 4];
const Q_RANGE: [number, number] = [-4, 5];
// Same coordinates as <Graph> (it scales x to keep units square, height 100).
const GW = 100 * ((XR[1] - XR[0]) / (YR[1] - YR[0]));
const GH = 100;
const gx = (x: number) => ((x - XR[0]) / (XR[1] - XR[0])) * GW;
const gy = (y: number) => GH - ((y - YR[0]) / (YR[1] - YR[0])) * GH;
const spring = { type: "spring" as const, stiffness: 260, damping: 28 };

function Slider({ name, value, min, max, onChange }: { name: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const pct = (value - min) / (max - min);
  const zero = (0 - min) / (max - min);
  const ticks = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <div className="flex items-center gap-3">
      <span className="w-5 font-math text-[21px] italic text-ink-2">{name}</span>
      <div className="group relative h-9 flex-1">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={name}
          className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none absolute inset-x-2 top-0 bottom-0">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line" />
          {ticks.map((t) => (
            <span
              key={t}
              className={cn("absolute top-[calc(50%+9px)] w-px -translate-x-1/2 bg-ink-3/50", t === 0 ? "h-2" : "h-1")}
              style={{ left: `${((t - min) / (max - min)) * 100}%` }}
            />
          ))}
          <motion.div
            className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blob"
            initial={false}
            animate={{ left: `${Math.min(pct, zero) * 100}%`, width: `${Math.abs(pct - zero) * 100}%` }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
          <motion.div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blob bg-raised shadow-card ring-blob/25 group-focus-within:ring-4"
            initial={false}
            animate={{ left: `${pct * 100}%` }}
            transition={{ type: "spring", stiffness: 500, damping: 40 }}
          />
        </div>
      </div>
      <span className="w-8 text-right font-math text-[20px] tabular-nums">{dec(value).replace("-", "−")}</span>
    </div>
  );
}

const CASES: { k: number; cond: string; label: Text; pic: Text }[] = [
  { k: 2, cond: "D > 0", label: tx("two solutions", "zwei Lösungen"), pic: tx("Crosses the x‑axis.", "Schneidet die x‑Achse.") },
  { k: 1, cond: "D = 0", label: tx("one solution", "eine Lösung"), pic: tx("Touches the x‑axis.", "Berührt die x‑Achse.") },
  { k: 0, cond: "D < 0", label: tx("no solution", "keine Lösung"), pic: tx("Misses the x‑axis.", "Trifft die x‑Achse nicht.") },
];

function ParabolaLab() {
  const scope = useId();
  const t = useText();
  const [p, setP] = useState(-2);
  const [q, setQ] = useState(-3);
  const half = clean(-p / 2);
  const D = clean((p * p) / 4 - q);
  const r = D > 0 ? Math.sqrt(D) : 0;
  const kind = D > 0 ? 2 : D === 0 ? 1 : 0;
  const zeros = kind === 0 ? [] : [clean(half + r), clean(half - r)];
  const exact = Math.abs(r * 2 - Math.round(r * 2)) < 1e-9;
  const round2 = (v: number) => dec(Math.round(v * 100) / 100);

  const clampP = (v: number) => Math.max(P_RANGE[0], Math.min(P_RANGE[1], v));
  const clampQ = (v: number) => Math.max(Q_RANGE[0], Math.min(Q_RANGE[1], v));

  const eq = `${sideSrc([T("a", 1, 2), T("p", p, 1), T("q", q, 0)], false)} = 0`;
  const dSrc = `D = (\\frac{p}{2})^2 - q = ${par(clean(p / 2))}^2 - ${par(q)} = ${dec(D)}`;
  const sol: Text =
    kind === 2
      ? `x_{1,2} = ${dec(half)} \\pm \\sqrt{${dec(D)}} \\quad x_1 ${exact ? "=" : "\\approx"} ${exact ? dec(zeros[0]) : round2(zeros[0])} \\quad x_2 ${exact ? "=" : "\\approx"} ${exact ? dec(zeros[1]) : round2(zeros[1])}`
      : kind === 1
        ? `x = ${dec(half)}`
        : tx(`\\sqrt{${dec(D)}} "doesn't exist"`, `\\sqrt{${dec(D)}} "gibt es nicht"`);
  const tone = kind === 2 ? "var(--blob)" : kind === 1 ? "var(--ink)" : "var(--danger)";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="relative">
        <Graph
          xRange={XR}
          yRange={YR}
          height={400}
          className="aspect-[112/110] h-auto!"
          functions={[{ f: (x) => x * x + p * x + q, key: "parabola", color: "blob" }]}
          points={[
            {
              key: "S",
              x: half,
              y: -D,
              label: "S",
              color: "ink",
              draggable: true,
              onDrag: (x, y) => {
                setP(clampP(Math.round(-2 * x)));
                setQ(clampQ(Math.round(x * x + y)));
              },
            },
          ]}
          snap={0.5}
        />
        <svg viewBox={`-6 -4 ${GW + 12} ${GH + 10}`} preserveAspectRatio="xMidYMid meet" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <motion.line initial={false} animate={{ x1: gx(half), x2: gx(half), y1: gy(YR[0]), y2: gy(YR[1]) }} transition={spring} stroke="var(--ink-3)" strokeWidth={0.35} strokeDasharray="1.4 1.2" />
          <motion.line
            initial={false}
            animate={{ x1: gx(half), x2: gx(half), y1: gy(0), y2: gy(-D), stroke: tone }}
            transition={spring}
            strokeWidth={0.9}
            strokeLinecap="round"
          />
          <motion.text
            initial={false}
            animate={{ x: gx(half) + 1.8, y: gy(-D / 2) + 1.2, opacity: D === 0 ? 0 : 1 }}
            transition={spring}
            fontSize={4}
            fill={tone}
            stroke="var(--raised)"
            strokeWidth={0.9}
            paintOrder="stroke"
            fontFamily="var(--font-math)"
          >
            {`D = ${dec(D).replace("-", "−")}`}
          </motion.text>
          {[1, -1].map((s) => (
            <motion.line
              key={s}
              initial={false}
              animate={{ x1: gx(half), x2: gx(half + s * r), y1: gy(0), y2: gy(0), opacity: kind === 2 ? 0.55 : 0 }}
              transition={spring}
              stroke="var(--blob)"
              strokeWidth={1.7}
              strokeLinecap="round"
            />
          ))}
          {[1, -1].map((s) => (
            <motion.text
              key={`l${s}`}
              initial={false}
              animate={{ x: gx(half + (s * r) / 2), y: gy(0) - 2, opacity: kind === 2 && r >= 1.6 ? 1 : 0 }}
              transition={spring}
              fontSize={3.8}
              textAnchor="middle"
              fill="var(--blob-ink)"
              fontFamily="var(--font-math)"
            >
              √D
            </motion.text>
          ))}
          <AnimatePresence>
            {zeros.map((z, i) => (
              <motion.g
                key={i === 0 ? "x1" : "x2"}
                initial={{ opacity: 0, scale: 0, x: gx(z), y: gy(0) }}
                animate={{ opacity: 1, scale: 1, x: gx(z), y: gy(0) }}
                exit={{ opacity: 0, scale: 0 }}
                transition={spring}
              >
                <circle r={3} fill="var(--blob)" opacity={0.16} />
                <circle r={1.6} fill="var(--blob)" stroke="var(--raised)" strokeWidth={0.6} />
                {(kind === 2 || i === 0) && (
                  <text
                    x={i === 0 && kind === 2 ? 2.4 : -2.4}
                    y={-3}
                    textAnchor={i === 0 && kind === 2 ? "start" : "end"}
                    fontSize={4.2}
                    fill="var(--blob-ink)"
                    stroke="var(--raised)"
                    strokeWidth={0.9}
                    paintOrder="stroke"
                    fontFamily="var(--font-math)"
                    fontStyle="italic"
                  >
                    {kind === 1 ? "x" : i === 0 ? "x₁" : "x₂"}
                  </text>
                )}
              </motion.g>
            ))}
          </AnimatePresence>
        </svg>
      </div>

      <div className="space-y-4">
        <div className="space-y-1 rounded-xl border border-line bg-surface px-4 py-3">
          <Slider name="p" value={p} min={P_RANGE[0]} max={P_RANGE[1]} onChange={setP} />
          <Slider name="q" value={q} min={Q_RANGE[0]} max={Q_RANGE[1]} onChange={setQ} />
        </div>
        <div className="space-y-2.5 px-1">
          <div>
            <MathView src={eq} size="md" animate={false} />
          </div>
          <div>
            <MathView src={dSrc} size="sm" animate={false} className="text-ink-2" />
          </div>
          <div className="min-h-[30px]">
            <MathView src={sol} size="sm" animate={false} className={kind === 0 ? "text-danger" : "text-ink"} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {CASES.map((c) => (
            <div key={c.k} className={cn("relative rounded-xl border px-3 py-2.5 transition-colors", kind === c.k ? "border-transparent" : "border-line")}>
              {kind === c.k && (
                <motion.span
                  layoutId={`${scope}-case`}
                  className={cn("absolute inset-0 rounded-xl border", c.k === 0 ? "border-danger/40 bg-danger/[0.07]" : "border-blob/40 bg-blob-soft")}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <div className="relative">
                <MathView src={c.cond} size="sm" animate={false} className={kind === c.k ? (c.k === 0 ? "text-danger" : "text-blob-ink") : "text-ink-3"} />
                <div className={cn("text-[13px] font-semibold", kind === c.k ? "text-ink" : "text-ink-3")}>{t(c.label)}</div>
                <div className={cn("text-[12px] leading-snug", kind === c.k ? "text-ink-2" : "text-ink-3/80")}>{t(c.pic)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson

const spotFrames: Frame[] = [
  {
    math: "x#va^{2#ea} +#sp 6#cp x#vp +#sq 8#cq =#eq 0#z",
    note: tx(
      "A quadratic equation in **normal form**: $x^2$ with no number in front, then an $x$-term, then a number. On the right: $0$.",
      "Eine quadratische Gleichung in **Normalform**: $x^2$ ohne Zahl davor, dann ein $x$-Term, dann eine Zahl. Rechts steht $0$.",
    ),
  },
  {
    math: "x#va^{2#ea} +#sp 6#cp x#vp +#sq 8#cq =#eq 0#z",
    highlight: ["sp", "cp"],
    note: tx("The number in front of $x$ is called $p$. Here $p = 6$.", "Die Zahl vor dem $x$ heißt $p$. Hier ist $p = 6$."),
  },
  {
    math: "x#va^{2#ea} +#sp 6#cp x#vp +#sq 8#cq =#eq 0#z",
    highlight: ["sq", "cq"],
    note: tx("The number on its own is called $q$. Here $q = 8$.", "Die Zahl ohne $x$ heißt $q$. Hier ist $q = 8$."),
  },
  {
    math: "x#va^{2#ea} -#sp 2#cp x#vp -#sq 15#cq =#eq 0#z",
    highlight: ["sp", "cp", "sq", "cq"],
    note: tx("The sign belongs to the number! Here $p = -2$ and $q = -15$.", "Das Vorzeichen gehört zur Zahl! Hier ist $p = -2$ und $q = -15$."),
  },
];

const FORMULA = "x#xx _{1,2#xs} =#eq -#m1 \\frac{p#P1}{2#t1}#F1 \\pm#pm \\sqrt{(\\frac{p#P2}{2#t2}#F2)#B2^{2#two} -#m2 q#Q}#R";

const formulaFrames: Frame[] = [
  {
    math: FORMULA,
    note: tx(
      "This is the **pq formula**. The $\\pm$ means: once with plus, once with minus. That's where the two solutions come from.",
      "Das ist die **pq-Formel**. Das $\\pm$ heißt: einmal mit Plus, einmal mit Minus. Daher kommen die zwei Lösungen.",
    ),
  },
  ...pqFrames(-4, -5).map((f, i) =>
    i === 0
      ? {
          ...f,
          note: tx(
            "Let's use it for $x^2 - 4x - 5 = 0$. Read off $p = -4$ and $q = -5$, with their signs.",
            "Wir wenden sie auf $x^2 - 4x - 5 = 0$ an. Lies $p = -4$ und $q = -5$ ab, mit Vorzeichen.",
          ),
        }
      : f,
  ),
];

const discFrames: Frame[] = [
  {
    math: "x#xx _{1,2#xs} =#eq -#m1 \\frac{p#P1}{2#t1}#F1 \\pm#pm \\sqrt{\\hl{(\\frac{p#P2}{2#t2}#F2)#B2^{2#two} -#m2 q#Q}}#R",
    note: tx(
      "Look at the part under the root. It's called the **discriminant** $D$.",
      "Schau dir den Teil unter der Wurzel an. Er heißt **Diskriminante** $D$.",
    ),
  },
  {
    math: "D#D =#eq (\\frac{p#P2}{2#t2}#F2)#B2^{2#two} -#m2 q#Q",
    note: tx(
      "$D = (\\frac{p}{2})^2 - q$. Before you solve, it tells you how many solutions there are.",
      "$D = (\\frac{p}{2})^2 - q$. Sie verrät dir schon vor dem Lösen, wie viele Lösungen es gibt.",
    ),
  },
  {
    math: "x#a1^{2#a2} -#b1 6#b2 x#b3 +#c1 5#q =#e1 0#z \\quad D#D =#e2 9#h -#mm 5#q2 =#e3 4#Dv >#rel 0#z2",
    highlight: ["Dv", "rel", "z2"],
    note: tx(
      "$x^2 - 6x + 5 = 0$: $D = 9 - 5 = 4 > 0$. **Two** solutions: $x = 3 \\pm 2$, so $5$ and $1$.",
      "$x^2 - 6x + 5 = 0$: $D = 9 - 5 = 4 > 0$. **Zwei** Lösungen: $x = 3 \\pm 2$, also $5$ und $1$.",
    ),
  },
  {
    math: "x#a1^{2#a2} -#b1 6#b2 x#b3 +#c1 9#q =#e1 0#z \\quad D#D =#e2 9#h -#mm 9#q2 =#e3 0#Dv =#rel 0#z2",
    highlight: ["q", "q2", "Dv", "rel", "z2"],
    note: tx(
      "Now $q = 9$: $D = 0$. And $3 \\pm 0$ is just $3$. **One** solution.",
      "Jetzt ist $q = 9$: $D = 0$. Und $3 \\pm 0$ ist einfach $3$. **Eine** Lösung.",
    ),
  },
  {
    math: "x#a1^{2#a2} -#b1 6#b2 x#b3 +#c1 13#q =#e1 0#z \\quad D#D =#e2 9#h -#mm 13#q2 =#e3 -#Dvs 4#Dv <#rel 0#z2",
    highlight: ["q", "q2", "Dv", "Dvs", "rel", "z2"],
    note: tx(
      "Now $q = 13$: $D = -4 < 0$. There's no root of a negative number. **No** solution.",
      "Jetzt ist $q = 13$: $D = -4 < 0$. Aus einer negativen Zahl gibt es keine Wurzel. **Keine** Lösung.",
    ),
  },
];

const normalFormFrames: Frame[] = [
  {
    math: "3#ca x#va^{2#ea} +#sp 6#cp x#vp -#sq 24#cq =#eq 0#z",
    note: tx("A $3$ in front of $x^2$: this is not the normal form yet.", "Eine $3$ vor $x^2$: Das ist noch nicht die Normalform."),
  },
  {
    math: "3#ca x#va^{2#ea} +#sp 6#cp x#vp -#sq 24#cq =#eq 0#z \\quad |#bar :#dv 3#da",
    highlight: ["bar", "dv", "da"],
    note: tx("Divide **every** term by $3$, not just the first one.", "Teile **jeden** Term durch $3$, nicht nur den ersten."),
  },
  {
    math: "x#va^{2#ea} +#sp 2#cp x#vp -#sq 8#cq =#eq 0#z",
    note: tx("Normal form! Now $p = 2$ and $q = -8$.", "Normalform! Jetzt ist $p = 2$ und $q = -8$."),
  },
  {
    math: "x#wa^{2#wae} =#weq 4#wcp x#wvp +#wsq 5#wcq",
    note: tx("Terms on both sides? Bring everything to the left first.", "Terme auf beiden Seiten? Bring zuerst alles nach links."),
  },
  {
    math: "x#wa^{2#wae} -#wsq 4#wcp x#wvp -#wsq2 5#wcq =#weq 0#wz",
    highlight: ["wsq", "wcp", "wsq2", "wcq"],
    note: tx(
      "$4x$ and $5$ change sides, so their signs flip. Now it's normal form with $p = -4$ and $q = -5$.",
      "$4x$ und $5$ wechseln die Seite, also ändern sich ihre Vorzeichen. Jetzt ist es die Normalform mit $p = -4$ und $q = -5$.",
    ),
  },
];

const shortcutFrames: Frame[] = [...qZeroFrames(-5), ...pZeroFrames(-16)];

const vietaFrames: Frame[] = [
  {
    math: "x#s1 _{1#s1i} +#plus x#s2 _{2#s2i} =#se -#sm p#sp \\quad x#t1 _{1#t1i} \\cdot#tdot x#t2 _{2#t2i} =#te q#tq",
    note: tx(
      "Vieta's theorem: the two solutions **add up** to $-p$ and **multiply** to $q$.",
      "Satz von Vieta: Die **Summe** der beiden Lösungen ist $-p$, ihr **Produkt** ist $q$.",
    ),
  },
  {
    math: "5#s1 +#plus (-#s2s 1#s2)#s2b =#sr 4#sv =#se -#sm p#sp",
    note: tx(
      "For $x^2 - 4x - 5 = 0$ we found $5$ and $-1$. Their sum is $4$, and $-p = 4$. Correct!",
      "Für $x^2 - 4x - 5 = 0$ haben wir $5$ und $-1$ gefunden. Ihre Summe ist $4$, und $-p = 4$. Passt!",
    ),
  },
  {
    math: "5#t1 \\cdot#tdot (-#t2s 1#t2)#t2b =#tr -#tvs 5#tv =#te q#tq",
    note: tx(
      "Their product is $-5$, and $q = -5$. Both fit, so the solutions are right. A quick check without a calculator!",
      "Ihr Produkt ist $-5$, und $q = -5$. Beides passt, also stimmen die Lösungen. Eine schnelle Probe ohne Taschenrechner!",
    ),
  },
];

const lessonTask = (left: Term[], right: Term[], values: number[], hint: Text): Exercise => ({
  instruction: SOLVE,
  math: eqSrc(left, right, false),
  answer: answer(values),
  hint,
  solution: solutionFrames(...assignIds(left, right)),
  mistakes: pqMistakes(left, right, values),
});

const pqFormula: Topic = {
  ...topicMeta("pq-formula"),
  summary: [
    {
      title: tx("Normal form first", "Erst die Normalform"),
      body: tx(
        "The pq formula needs $x^2 + px + q = 0$. Bring everything to one side. If there's a number in front of $x^2$, divide every term by it.",
        "Die pq-Formel braucht $x^2 + px + q = 0$. Bring alles auf eine Seite. Steht eine Zahl vor $x^2$, teile jeden Term durch diese Zahl.",
      ),
      examples: ["2x^2 - 8x - 10 = 0 \\quad | : 2", "x^2 - 4x - 5 = 0"],
      tone: "rule",
    },
    {
      title: tx("The pq formula", "Die pq-Formel"),
      body: tx("Read off $p$ and $q$ with their signs and put them in.", "Lies $p$ und $q$ mit Vorzeichen ab und setz sie ein."),
      examples: ["x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}"],
      tone: "rule",
    },
    {
      title: tx("The discriminant", "Die Diskriminante"),
      body: tx("The part under the root decides how many solutions there are.", "Der Teil unter der Wurzel entscheidet, wie viele Lösungen es gibt."),
      examples: [
        "D = (\\frac{p}{2})^2 - q",
        tx('D > 0 \\Rightarrow "two solutions"', 'D > 0 \\Rightarrow "zwei Lösungen"'),
        tx('D = 0 \\Rightarrow "one solution"', 'D = 0 \\Rightarrow "eine Lösung"'),
        tx('D < 0 \\Rightarrow "no solution"', 'D < 0 \\Rightarrow "keine Lösung"'),
      ],
      tone: "rule",
    },
    {
      title: tx("Faster special cases", "Schnellere Sonderfälle"),
      body: tx(
        "No number on its own: factor out $x$. No $x$-term: take the root.",
        "Keine Zahl ohne $x$: Klammere $x$ aus. Kein $x$-Term: Zieh die Wurzel.",
      ),
      examples: ["x^2 - 5x = 0 \\Rightarrow x(x - 5) = 0", "x^2 - 16 = 0 \\Rightarrow x = \\pm 4"],
      tone: "tip",
    },
    {
      title: tx("Check with Vieta", "Probe mit Vieta"),
      body: tx("The solutions add up to $-p$ and multiply to $q$.", "Die Summe der Lösungen ist $-p$, ihr Produkt ist $q$."),
      examples: ["x_1 + x_2 = -p", "x_1 \\cdot x_2 = q"],
      tone: "tip",
    },
    {
      title: tx("Classic mistakes", "Typische Fehler"),
      body: tx(
        "The sign belongs to $p$ and $q$. And divide **every** term by the number in front of $x^2$, not just the first one.",
        "Das Vorzeichen gehört zu $p$ und $q$. Und teile **jeden** Term durch die Zahl vor $x^2$, nicht nur den ersten.",
      ),
      examples: ["x^2 - 4x - 5 = 0 \\Rightarrow p = -4", "-\\frac{-4}{2} = +2"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("Normal form: spot p and q", "Normalform: p und q finden"),
      blob: tx(
        "Quadratic equations! Sounds scary, but there's a formula that does the work.",
        "Quadratische Gleichungen! Klingt gruselig, aber es gibt eine Formel, die dir die Arbeit abnimmt.",
      ),
      body: tx(
        "The pq formula (pq-Formel) solves every quadratic equation in **normal form**. First you need to find $p$ and $q$.",
        "Die pq-Formel löst jede quadratische Gleichung in **Normalform**. Zuerst musst du $p$ und $q$ finden.",
      ),
      frames: spotFrames,
    },
    {
      type: "explain",
      title: tx("The pq formula", "Die pq-Formel"),
      blob: tx("Here it is! Watch how p and q slide into the formula.", "Da ist sie! Schau, wie p und q in die Formel rutschen."),
      body: tx(
        "For $x^2 + px + q = 0$ the solutions are $x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$.",
        "Für $x^2 + px + q = 0$ sind die Lösungen $x_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$.",
      ),
      frames: formulaFrames,
    },
    {
      type: "check",
      blob: tx("Your turn! Find p and q first.", "Du bist dran! Finde zuerst p und q."),
      exercise: lessonTask(
        [T("a", 1, 2), T("p", 2, 1), T("q", -8, 0)],
        [],
        [2, -4],
        tx("$p = 2$ and $q = -8$. Start with $-\\frac{p}{2} = -1$.", "$p = 2$ und $q = -8$. Fang mit $-\\frac{p}{2} = -1$ an."),
      ),
    },
    {
      type: "explain",
      title: tx("Two, one or no solution", "Zwei, eine oder keine Lösung"),
      blob: tx("The number under the root is a little fortune teller.", "Die Zahl unter der Wurzel ist eine kleine Wahrsagerin."),
      body: tx(
        "Before you finish the formula, look at the part under the root.",
        "Bevor du die Formel zu Ende rechnest, schau auf den Teil unter der Wurzel.",
      ),
      frames: discFrames,
    },
    {
      type: "widget",
      title: tx("See it on the parabola", "Ein Blick auf die Parabel"),
      blob: tx(
        "Move p and q and watch the zeros slide. Can you make them meet?",
        "Verschieb p und q und schau, wie die Nullstellen wandern. Schaffst du es, dass sie sich treffen?",
      ),
      body: tx(
        "The solutions are where the parabola $y = x^2 + px + q$ meets the $x$-axis. Use the sliders or drag the vertex $S$. The vertex lies exactly $D$ below the axis.",
        "Die Lösungen sind die Nullstellen der Parabel $y = x^2 + px + q$, also die Stellen, an denen sie die $x$-Achse trifft. Nutze die Regler oder zieh den Scheitelpunkt $S$. Er liegt genau $D$ unter der Achse.",
      ),
      widget: ParabolaLab,
    },
    {
      type: "check",
      blob: tx(
        "Check the discriminant first. If there's nothing to find, there's a button for that.",
        "Prüf zuerst die Diskriminante. Gibt es keine Lösung, gibt es dafür einen eigenen Knopf.",
      ),
      exercise: lessonTask([T("a", 1, 2), T("p", -2, 1), T("q", 5, 0)], [], [], HINT_D),
    },
    {
      type: "explain",
      title: tx("Normal form first", "Erst die Normalform"),
      blob: tx("The formula is picky. It only takes the normal form!", "Die Formel ist wählerisch. Sie nimmt nur die Normalform!"),
      body: tx(
        "A number in front of $x^2$? Divide by it. Terms on both sides? Bring them to one side.",
        "Eine Zahl vor $x^2$? Teile durch sie. Terme auf beiden Seiten? Bring alles auf eine Seite.",
      ),
      frames: normalFormFrames,
    },
    {
      type: "check",
      blob: tx("Divide first, then the formula.", "Erst teilen, dann die Formel."),
      exercise: lessonTask([T("a", 2, 2), T("p", -4, 1), T("q", -30, 0)], [], [5, -3], tx("Divide every term by $2$ first.", "Teile zuerst jeden Term durch $2$.")),
    },
    {
      type: "explain",
      title: tx("Shortcuts: q = 0 or p = 0", "Abkürzungen: q = 0 oder p = 0"),
      blob: tx("Sometimes you don't need the formula at all. Lazy is smart!", "Manchmal brauchst du die Formel gar nicht. Faul ist schlau!"),
      body: tx(
        "If $q$ or $p$ is missing, there's a quicker way. The formula still works, but this is faster.",
        "Fehlt $q$ oder $p$, geht es schneller. Die Formel funktioniert trotzdem, aber so bist du flotter.",
      ),
      frames: shortcutFrames,
    },
    {
      type: "explain",
      title: tx("Check with Vieta", "Probe mit Vieta"),
      blob: tx("A secret trick to check your answers in seconds.", "Ein geheimer Trick, mit dem du deine Lösungen in Sekunden prüfst."),
      frames: vietaFrames,
    },
    {
      type: "check",
      blob: tx("Last one! What do you do first?", "Letzte Aufgabe! Was machst du zuerst?"),
      exercise: lessonTask([T("a", 1, 2), T("p", 3, 1)], [T("q", 10, 0)], [2, -5], tx("Bring the $10$ to the left first.", "Bring zuerst die $10$ nach links.")),
    },
  ],
  generate,
};

export default pqFormula;
