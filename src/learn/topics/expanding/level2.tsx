"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import type { Rng } from "@/learn/engine/rng";
import { equivalentText } from "@/learn/engine/expr";
import { plainPoly, polyAdd, polyMul, showPoly, type Poly } from "@/learn/engine/terms";
import type { Exercise, Frame, LevelLesson, Mistake } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Products of brackets as monomials (c·vᵖ), with stable token keys so each
// factor visibly travels into the products.

export type Mono = { c: number; p: number };
export type Factor = Mono[];

export const m = (c: number, p = 0): Mono => ({ c, p });

/** Key names: sign s, coefficient c, variable v, exponent e, prefixed by an id. */
export function mono(x: Mono, v: string, id: string, first: boolean, keys = true): string {
  const k = (name: string) => (keys ? `#${name}${id}` : "");
  const abs = Math.abs(x.c);
  const sign = x.c < 0 ? `-${k("s")}${first && !keys ? "" : " "}` : first ? "" : `+${k("s")} `;
  const coef = x.p > 0 && abs === 1 ? "" : `${abs}${k("c")}`;
  const pow = x.p === 0 ? "" : x.p === 1 ? `${v}${k("v")}` : keys ? `${v}${k("v")}^{${x.p}${k("e")}}` : `${v}^${x.p}`;
  return `${sign}${[coef, pow].filter(Boolean).join(keys ? " " : "")}`;
}

function factorSrc(f: Factor, v: string, id: string, keys = true, alone = false): string {
  const k = (name: string) => (keys ? `#${name}${id}` : "");
  if (f.length === 1 && alone) return mono(f[0], v, `${id}0`, true, keys);
  return `(${f.map((x, i) => mono(x, v, `${id}${i}`, i === 0, keys)).join(" ")})${k("b")}`;
}

/** "3(2x - 4)", "(x + 1)(x - 4)", "(x - 5)^2" as display source. */
export function productSrc(a: Factor, b: Factor, v: string, keys = true, square = false): string {
  if (square) return `${factorSrc(a, v, "A", keys)}${keys ? "^{2#sq}" : "^2"}`;
  return `${factorSrc(a, v, "A", keys, true)} ${factorSrc(b, v, "B", keys)}`;
}

/** Bare factor inside a product: |c| and the variable, e.g. "2x", "x", "4". */
function bare(x: Mono, v: string, ck: string, vk: string, ek: string): string {
  const abs = Math.abs(x.c);
  const coef = x.p > 0 && abs === 1 ? "" : `${abs}#${ck}`;
  const pow = x.p === 0 ? "" : x.p === 1 ? `${v}#${vk}` : `${v}#${vk}^{${x.p}#${ek}}`;
  return [coef, pow].filter(Boolean).join(" ");
}

export function toPoly(f: Factor): Poly {
  const out: number[] = [];
  for (const x of f) out[x.p] = (out[x.p] ?? 0) + x.c;
  return Array.from(out, (c) => c ?? 0);
}


/** Frames for expanding a·b (both lists of monomials): arrows, pairwise products, products worked out, combined. */
export function expandFrames(a: Factor, b: Factor, v: string, opts: { square?: boolean } = {}): Frame[] {
  const frames: Frame[] = [];
  if (opts.square) {
    frames.push({ math: productSrc(a, b, v, true, true), note: tx("Squared means: the bracket times **itself**.", "Hoch 2 heißt: die Klammer mal **sich selbst**.") });
  }
  const start = productSrc(a, b, v);
  const firstKey = (side: "A" | "B", i: number, x: Mono, single = false) => {
    const id = single ? `${side}0` : `${side}${i}`;
    return x.p > 0 && Math.abs(x.c) === 1 ? `v${id}` : `c${id}`;
  };
  const single = a.length === 1;
  a.forEach((x, i) => {
    const X = mono(x, v, "", true, false);
    frames.push({
      math: start,
      arrows: b.map((y, j) => [firstKey("A", i, x, single), firstKey("B", j, y)] as [string, string]),
      note:
        i === 0
          ? single
            ? tx(`Multiply $${X}$ by **each** term in the bracket.`, `Multipliziere $${X}$ mit **jedem** Term in der Klammer.`)
            : tx(`Every term of the first bracket meets every term of the second. Start with $${X}$.`, `Jeder Term der ersten Klammer trifft jeden Term der zweiten. Fang mit $${X}$ an.`)
          : tx(`Then $${X}$ meets every term too.`, `Dann trifft auch $${X}$ jeden Term.`),
    });
  });

  // Pairwise products: sign pulled to the front, then |a|·|b|.
  const pairs = a.flatMap((x, i) => b.map((y, j) => ({ x, y, i, j, id: `q${i}${j}` })));
  const productLine = pairs
    .map(({ x, y, i, j, id }, n) => {
      const neg = x.c * y.c < 0;
      const sign = neg ? `-#s${id} ` : n === 0 ? "" : `+#s${id} `;
      const left = bare(x, v, j === 0 ? `cA${i}` : `c${id}`, j === 0 ? `vA${i}` : `v${id}`, `e${id}`);
      const right = bare(y, v, i === 0 ? `cB${j}` : `d${id}`, i === 0 ? `vB${j}` : `w${id}`, `f${id}`);
      return `${sign}${left || `1#c${id}`} \\cdot#dot${id} ${right || `1#d${id}`}`;
    })
    .join(" ");
  frames.push({
    math: productLine,
    note: tx(
      "Write down every product. Sign rule: same signs give $+$, different signs give $-$.",
      "Schreib alle Produkte auf. Vorzeichenregel: Gleiche Vorzeichen ergeben $+$, verschiedene ergeben $-$.",
    ),
  });

  // Worked out, each product keeps the first factor's keys so it morphs in place.
  const worked = pairs.map(({ x, y, i, j, id }) => ({ c: x.c * y.c, p: x.p + y.p, id, ck: j === 0 ? `cA${i}` : `c${id}`, vk: j === 0 ? `vA${i}` : `v${id}` }));
  const workedSrc = (list: typeof worked) =>
    list
      .map((t, n) => {
        const abs = Math.abs(t.c);
        const sign = t.c < 0 ? `-#s${t.id} ` : n === 0 ? "" : `+#s${t.id} `;
        const coef = t.p > 0 && abs === 1 ? "" : `${abs}#${t.ck}`;
        const pow = t.p === 0 ? "" : t.p === 1 ? `${v}#${t.vk}` : `${v}#${t.vk}^{${t.p}#e${t.id}}`;
        return `${sign}${[coef, pow].filter(Boolean).join(" ") || `0#${t.ck}`}`;
      })
      .join(" ");
  frames.push({ math: workedSrc(worked), note: tx("Work out each product.", "Rechne jedes Produkt aus.") });

  // Combine terms with the same power; the first of each kind keeps its keys.
  const combined: typeof worked = [];
  for (const t of worked) {
    const prev = combined.find((x) => x.p === t.p);
    if (prev) prev.c += t.c;
    else combined.push({ ...t });
  }
  const result = combined.filter((t) => t.c !== 0).sort((x, y) => y.p - x.p);
  if (result.length < worked.length) {
    const middle = worked.filter((t) => worked.filter((u) => u.p === t.p).length > 1);
    const sum = middle.reduce((s, t) => s + t.c, 0);
    const middleText = middle.map((t, n) => mono({ c: t.c, p: t.p }, v, "", n === 0, false)).join(" ");
    const total = mono({ c: sum, p: middle[0].p }, v, "", true, false);
    const note =
      sum === 0
        ? tx(`The middle terms cancel: $${middleText} = 0$. Done!`, `Die mittleren Terme heben sich auf: $${middleText} = 0$. Fertig!`)
        : tx(`Combine like terms: $${middleText} = ${total}$. Done!`, `Fasse gleichartige Terme zusammen: $${middleText} = ${total}$. Fertig!`);
    frames.push({ math: workedSrc(result), note });
  } else {
    frames[frames.length - 1] = {
      ...frames[frames.length - 1],
      note: tx("Work out each product. Nothing to combine, so that's the result.", "Rechne jedes Produkt aus. Hier gibt es nichts zusammenzufassen, das ist schon das Ergebnis."),
    };
  }
  return frames;
}

export function resultPoly(a: Factor, b: Factor): Poly {
  return polyMul(toPoly(a), toPoly(b));
}

// ---------------------------------------------------------------------------
// Exercise generator

export const VARS = ["x", "x", "x", "a", "y", "b"];

/** Letters for tasks with a binomial formula: not a or b, which name the parts of the formulas in the notes. */
const LETTERS = ["x", "x", "y", "z"];

export const EXPAND = tx("Expand", "Multipliziere aus");
export const EXPAND_SIMPLIFY = tx("Expand and simplify", "Multipliziere aus und fasse zusammen");

/** Sum of chosen pairwise products, as a polynomial (to simulate skipped or mis-signed products). */
export function productsOf(a: Factor, b: Factor, pick: (i: number, j: number) => number): Poly {
  let out: Poly = [0];
  a.forEach((x, i) =>
    b.forEach((y, j) => {
      const k = pick(i, j);
      if (!k) return;
      const term: Poly = [];
      term[x.p + y.p] = k * x.c * y.c;
      out = polyAdd(out, Array.from(term, (c) => c ?? 0));
    }),
  );
  return out;
}

/** Typical expanding slips, worked out for this task. */
export function expandMistakes(a: Factor, b: Factor, v: string, right: string, square: boolean): Mistake[] {
  const out: Mistake[] = [];
  const add = (p: Poly, title: Text, say: Text) => {
    const value = plainPoly(p, v);
    if (equivalentText(value, right) || out.some((m) => m.when.kind === "expr" && equivalentText(m.when.value, value))) return;
    out.push({ when: { kind: "expr", value }, title, say });
  };
  const sameSquare = square || (a.length === 2 && b.length === 2 && a.every((x, i) => x.c === b[i].c && x.p === b[i].p));
  const conjugate = a.length === 2 && b.length === 2 && a[0].c === b[0].c && a[0].p === b[0].p && a[1].c === -b[1].c && a[1].p === b[1].p;

  if (a.length === 1) {
    const k = mono(a[0], v, "", true, false);
    add(
      polyAdd(productsOf(a, b, (_, j) => (j === 0 ? 1 : 0)), toPoly(b.slice(1))),
      tx("Only the first term multiplied", "Nur der erste Term multipliziert"),
      tx(
        `The $${k}$ only reached the first term! It has to multiply **every** term in the bracket.`,
        `Die $${k}$ hat nur den ersten Term erwischt! Sie muss **jeden** Term in der Klammer multiplizieren.`,
      ),
    );
  }
  // Minus times minus taken as minus.
  if (a.some((x) => x.c < 0) && b.some((y) => y.c < 0)) {
    add(
      productsOf(a, b, (i, j) => (a[i].c < 0 && b[j].c < 0 ? -1 : 1)),
      tx("Minus times minus", "Minus mal Minus"),
      tx("Careful with the signs: minus times minus gives **plus**!", "Achtung bei den Vorzeichen: Minus mal Minus ergibt **Plus**!"),
    );
  }
  if (a.length === 2 && b.length === 2) {
    if (sameSquare) {
      add(
        productsOf(a, b, (i, j) => (i === j ? 1 : 0)),
        tx("The middle term is missing", "Der Mittelterm fehlt"),
        tx(
          "The classic trap! $(a + b)^2$ is **not** $a^2 + b^2$: the middle term $2ab$ is missing. Write it as two brackets and you'll see it.",
          "Die klassische Falle! $(a + b)^2$ ist **nicht** $a^2 + b^2$: Der Mittelterm $2ab$ fehlt. Schreib es als zwei Klammern, dann siehst du ihn.",
        ),
      );
      if (a[1].c < 0) {
        add(
          productsOf(a, b, (i, j) => (i !== j ? -1 : 1)),
          tx("Sign of the middle term", "Vorzeichen vom Mittelterm"),
          tx(
            "Nearly! With $(a - b)^2$ the middle term gets a **minus**: $a^2 - 2ab + b^2$.",
            "Fast! Bei $(a - b)^2$ bekommt der Mittelterm ein **Minus**: $a^2 - 2ab + b^2$.",
          ),
        );
      }
    } else if (conjugate) {
      add(
        productsOf(a, b, (i, j) => (i === j ? (i === 1 ? -1 : 1) : 0)),
        tx("Plus instead of minus", "Plus statt Minus"),
        tx(
          "Almost! The middle terms cancel out, right, but the last one is **minus**: $(a + b)(a - b) = a^2 - b^2$.",
          "Fast! Die Mittelterme heben sich auf, stimmt, aber der letzte ist **minus**: $(a + b)(a - b) = a^2 - b^2$.",
        ),
      );
    } else {
      add(
        productsOf(a, b, (i, j) => (i === j ? 1 : 0)),
        tx("Only two of four products", "Nur zwei von vier Produkten"),
        tx(
          "You multiplied first with first and last with last. But **each** term meets **each** term: that's four products.",
          "Du hast Erstes mal Erstes und Letztes mal Letztes gerechnet. Aber **jeder** Term trifft **jeden**: Das sind vier Produkte.",
        ),
      );
    }
  }
  return out;
}

export function make(a: Factor, b: Factor, v: string, hint: Text, square = false): Exercise {
  const p = resultPoly(a, b);
  const value = plainPoly(p, v);
  return {
    instruction: EXPAND_SIMPLIFY,
    math: productSrc(a, b, v, false, square),
    answer: { kind: "expr", value, form: "simplified" },
    hint,
    solution: expandFrames(a, b, v, { square }),
    mistakes: expandMistakes(a, b, v, value, square),
  };
}

/** The practice of the one-lesson topic, in three difficulty tiers (now mixed into level 2). */
function tier(level: 1 | 2 | 3, rng: Rng): Exercise {
  const v = rng.pick(level === 1 ? VARS : LETTERS);
  if (level === 1) {
    const k = rng.nonZero(-9, 9, [1, -1]);
    const b: Factor = rng.chance(0.75) ? [m(rng.int(1, 6), 1), m(rng.nonZero(-9, 9))] : [m(rng.nonZero(-9, 9)), m(rng.nonZero(-6, 6), 1)];
    const hint =
      k < 0
        ? tx("The factor is negative: every sign in the result flips.", "Der Faktor ist negativ: Im Ergebnis dreht sich jedes Vorzeichen um.")
        : tx(`Multiply $${k}$ by each term in the bracket.`, `Multipliziere $${k}$ mit jedem Term in der Klammer.`);
    return make([m(k)], b, v, hint);
  }
  if (level === 2) {
    if (rng.chance(0.6)) {
      return make(
        [m(1, 1), m(rng.nonZero(-9, 9))],
        [m(1, 1), m(rng.nonZero(-9, 9))],
        v,
        tx("Each term of the first bracket times each term of the second: four products.", "Multipliziere jeden Term der ersten Klammer mit jedem Term der zweiten: vier Produkte."),
      );
    }
    const k = rng.nonZero(-5, 5);
    const K = mono(m(k, 1), v, "", true, false);
    return make(
      [m(k, 1)],
      [m(rng.int(1, 6), 1), m(rng.nonZero(-9, 9))],
      v,
      tx(`Multiply $${K}$ by each term. Remember $${v} \\cdot ${v} = ${v}^2$.`, `Multipliziere $${K}$ mit jedem Term. Denk dran: $${v} \\cdot ${v} = ${v}^2$.`),
    );
  }
  const kind = rng.int(0, 2);
  if (kind === 0) {
    return make(
      [m(rng.int(2, 5), 1), m(rng.nonZero(-7, 7))],
      [m(rng.int(1, 5), 1), m(rng.nonZero(-7, 7))],
      v,
      tx("Four products, then combine the two middle terms.", "Vier Produkte, dann die beiden mittleren Terme zusammenfassen."),
    );
  }
  if (kind === 1) {
    const f: Factor = [m(rng.chance(0.6) ? 1 : rng.int(2, 4), 1), m(rng.nonZero(-9, 9))];
    const hint = tx(
      "Write the square as two brackets, or use a binomial formula: $(a + b)^2 = a^2 + 2ab + b^2$.",
      "Schreib das Quadrat als zwei Klammern oder nutze eine binomische Formel: $(a + b)^2 = a^2 + 2ab + b^2$.",
    );
    return make(f, f, v, hint, true);
  }
  const p = rng.chance(0.5) ? 1 : rng.int(2, 5);
  const q = rng.int(1, 9);
  const s = rng.sign();
  const hint = tx(
    "Notice the brackets only differ in one sign. The middle terms will cancel: $(a + b)(a - b) = a^2 - b^2$.",
    "Die Klammern unterscheiden sich nur in einem Vorzeichen: 3. binomische Formel. Die mittleren Terme heben sich auf: $(a + b)(a - b) = a^2 - b^2$.",
  );
  return make([m(p, 1), m(s * q)], [m(p, 1), m(-s * q)], v, hint);
}

// ---------------------------------------------------------------------------
// Level 2 practice: the old tiers, plus gaps in a binomial formula, a classmate's mistake,
// mental maths with the formulas and differences of two products.

/** A polynomial with fixed keys per power (sign s, coefficient c, variable v, exponent e, then `id` and the power). */
export function polySrc(p: Poly, v: string, id: string, continued = false): string {
  const out: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (!c) continue;
    const k = (n: string) => `#${n}${id}${i}`;
    const abs = Math.abs(c);
    const sign = c < 0 ? `-${k("s")} ` : out.length === 0 && !continued ? "" : `+${k("s")} `;
    const coef = i > 0 && abs === 1 ? "" : `${abs}${k("c")}`;
    const pw = i === 0 ? "" : i === 1 ? `${v}${k("v")}` : `${v}${k("v")} ^{${i}${k("e")}}`;
    out.push(`${sign}${[coef, pw].filter(Boolean).join(" ")}`);
  }
  return out.length ? out.join(" ") : `0#c${id}0`;
}

const FILL_GAP = tx("Fill in the gap", "Ergänze die Lücke");
const FIND_MISTAKE = tx("Find the mistake", "Finde den Fehler");
const CLEVER = tx("Calculate cleverly with a binomial formula", "Rechne geschickt mit einer binomischen Formel");
const SIMPLIFY = tx("Simplify the term", "Vereinfache den Term");

const NAMES = ["Mia", "Tom", "Lena", "Jonas", "Emma", "Paul", "Elif", "Noah", "Anna", "Ben"];

/** "x", "3x": the first term of a bracket. */
const lead = (p: number, v: string) => (p === 1 ? v : `${p}${v}`);
/** "x^2", "9x^2". */
const leadSq = (p: number, v: string) => (p === 1 ? `${v}^2` : `${p * p}${v}^2`);

/** A gap in a binomial formula: the middle term, the last term or the b of the 3rd formula. */
function gap2(rng: Rng): Exercise {
  const v = rng.pick(LETTERS);
  const p = rng.chance(0.55) ? 1 : rng.int(2, 4);
  const q = rng.int(2, 9);
  const P = lead(p, v);
  const P2 = leadSq(p, v);
  const kind = rng.pick(["middle", "middle", "last", "third"] as const);
  let right = 0;
  const out: Mistake[] = [];
  const add = (value: number, title: Text, say: Text) => {
    if (value !== right && !out.some((x) => x.when.kind === "number" && x.when.value === value)) out.push({ when: { kind: "number", value }, title, say });
  };

  if (kind === "third") {
    right = q;
    add(q * q, tx("b, not b²", "b, nicht b²"), tx(`Ah, you put $${q * q}$ into the gap. But the gap is $b$, and $${q * q} = b^2$. Which number squared gives $${q * q}$?`, `Ah, du hast $${q * q}$ in die Lücke geschrieben. Die Lücke ist aber $b$, und $${q * q} = b^2$. Welche Zahl hoch 2 ergibt $${q * q}$?`));
    add(q * q / 2, tx("Halved instead of the root", "Halbiert statt Wurzel"), tx(`You halved $${q * q}$. But $b^2 = ${q * q}$, so you need the **square root**, not half.`, `Du hast $${q * q}$ halbiert. Aber $b^2 = ${q * q}$, du brauchst also die **Wurzel**, nicht die Hälfte.`));
    return {
      instruction: FILL_GAP,
      math: `(${P} + \\box{?}) (${P} - \\box{?}) = ${P2} - ${q * q}`,
      answer: { kind: "number", value: q, label: "? =" },
      hint: tx("Same terms, different signs: the 3rd binomial formula $(a + b)(a - b) = a^2 - b^2$.", "Gleiche Terme, verschiedene Vorzeichen: die 3. binomische Formel $(a + b)(a - b) = a^2 - b^2$."),
      solution: [
        {
          math: `(${P} + \\box{?#g}) (${P} - \\box{?#h}) = ${P2} - ${q * q}#q2`,
          note: tx("Same terms, only the sign differs: that's the **3rd binomial formula** $(a + b)(a - b) = a^2 - b^2$.", "Gleiche Terme, nur das Vorzeichen ist anders: Das ist die **3. binomische Formel** $(a + b)(a - b) = a^2 - b^2$."),
          highlight: ["q2"],
        },
        { math: `b^2 = ${q * q}#q2 \\quad \\Rightarrow \\quad b = ${q}#g`, note: tx(`The last term is $b^2 = ${q * q}$. So $b = ${q}$, because $${q}^2 = ${q * q}$.`, `Der letzte Term ist $b^2 = ${q * q}$. Also ist $b = ${q}$, denn $${q}^2 = ${q * q}$.`) },
        { math: `(${P} + \\hl{${q}#g}) (${P} - \\hl{${q}#h}) = ${P2} - ${q * q}#q2`, note: tx(`Both gaps get a $${q}$.`, `In beide Lücken kommt eine $${q}$.`) },
      ],
      mistakes: out,
    };
  }

  const s = rng.sign();
  const sg = s > 0 ? "+" : "-";
  const which = s > 0 ? tx("1st", "1.") : tx("2nd", "2.");
  const formula = s > 0 ? "(a + b)^2 = a^2 + 2ab + b^2" : "(a - b)^2 = a^2 - 2ab + b^2";
  const ab = txMap((t) => t(`with $a = ${P}$ and $b = ${q}$`, `mit $a = ${P}$ und $b = ${q}$`));
  const intro = txMap((t, l) => `${t("The", "Die")} **${resolveText(which, l)} ${t("binomial formula", "binomische Formel")}** $${formula}$, ${resolveText(ab, l)}.`);

  if (kind === "middle") {
    right = 2 * p * q;
    add(p * q, tx("The 2 is missing", "Die 2 fehlt"), tx(`Nearly! You took $a \\cdot b = ${p * q}$. The middle term is $2ab$: don't forget the **2**.`, `Fast! Du hast $a \\cdot b = ${p * q}$ gerechnet. Der Mittelterm ist aber $2ab$: Vergiss die **2** nicht.`));
    if (p > 1) add(2 * q, tx(`The ${p} got lost`, `Die ${p} ging verloren`), tx(`Careful: $a$ is $${P}$, not just $${v}$. So the middle term is $2 \\cdot ${P} \\cdot ${q}$, and the $${p}$ counts too.`, `Vorsicht: $a$ ist $${P}$, nicht nur $${v}$. Der Mittelterm ist also $2 \\cdot ${P} \\cdot ${q}$, und die $${p}$ zählt mit.`));
    add(q * q, tx("That's b²", "Das ist b²"), tx(`$${q * q}$ is $b^2$, the last term. The gap is the **middle** term $2ab$.`, `$${q * q}$ ist $b^2$, der letzte Term. Die Lücke ist der **Mittelterm** $2ab$.`));
    return {
      instruction: FILL_GAP,
      math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} \\box{?} ${v} + ${q * q}`,
      answer: { kind: "number", value: right, label: "? =" },
      hint: tx("The gap is the middle term $2ab$.", "Die Lücke ist der Mittelterm $2ab$."),
      solution: [
        { math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} \\box{?#g} ${v}#v + ${q * q}`, note: intro },
        { math: `2 \\cdot ${P} \\cdot ${q} = ${right}#g ${v}#v`, note: tx("The middle term is $2 \\cdot a \\cdot b$.", "Der Mittelterm ist $2 \\cdot a \\cdot b$.") },
        { math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} \\hl{${right}#g} ${v}#v + ${q * q}`, note: tx(`So the gap is $${right}$.`, `In die Lücke kommt also $${right}$.`) },
      ],
      mistakes: out,
    };
  }

  right = q * q;
  add(q, tx("b, not b²", "b, nicht b²"), tx(`The last term is $b^2$, not $b$. Square the $${q}$!`, `Der letzte Term ist $b^2$, nicht $b$. Nimm die $${q}$ hoch 2!`));
  add(2 * q, tx("Doubled, not squared", "Verdoppelt statt quadriert"), tx(`You doubled the $${q}$. But the last term is $b^2 = ${q} \\cdot ${q}$.`, `Du hast die $${q}$ verdoppelt. Der letzte Term ist aber $b^2 = ${q} \\cdot ${q}$.`));
  return {
    instruction: FILL_GAP,
    math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} ${2 * p * q}${v} + \\box{?}`,
    answer: { kind: "number", value: right, label: "? =" },
    hint: tx("The last term of a binomial square is always $+b^2$.", "Der letzte Term eines Binoms im Quadrat ist immer $+b^2$."),
    solution: [
      { math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} ${2 * p * q}${v} + \\box{?#g}`, note: intro },
      { math: `b^2 = ${q}^2 = ${right}#g`, note: tx(`The last term is $b^2$. Even with a minus in the bracket it stays **plus**: $(-${q})^2 = +${q * q}$.`, `Der letzte Term ist $b^2$. Auch mit Minus in der Klammer bleibt er **plus**: $(-${q})^2 = +${q * q}$.`) },
      { math: `(${P} ${sg} ${q})^2 = ${P2} ${sg} ${2 * p * q}${v} + \\hl{${right}#g}`, note: tx(`So the gap is $${right}$.`, `In die Lücke kommt also $${right}$.`) },
    ],
    mistakes: out,
  };
}

/** A classmate expanded wrongly: find the slip and write the right result. */
function findMistake2(rng: Rng): Exercise {
  const v = rng.pick(LETTERS);
  const name = rng.pick(NAMES);
  const kind = rng.pick(["noMiddle", "lastSign", "twoProducts", "negFactor", "coefNotSquared"] as const);
  let a: Factor;
  let b: Factor;
  let square = false;
  let wrong: Poly;
  let why: Text;
  if (kind === "noMiddle" || kind === "lastSign") {
    const q = rng.int(2, 9) * (kind === "lastSign" ? -1 : rng.sign());
    a = [m(1, 1), m(q)];
    b = a;
    square = true;
    wrong = kind === "noMiddle" ? [q > 0 ? q * q : -q * q, 0, 1] : [-q * q, 2 * q, 1];
    why =
      kind === "noMiddle"
        ? q > 0
          ? tx(`${name} squared each term on its own. But a bracket squared means the bracket **times itself**, and then the middle term $2ab$ appears.`, `${name} hat jeden Term einzeln quadriert. Aber Klammer hoch 2 heißt Klammer **mal sich selbst**, und dann entsteht der Mittelterm $2ab$.`)
          : tx(`${name} squared each term and kept the minus. But $(-${-q})^2 = +${q * q}$, and the middle term $-${-2 * q}${v}$ is missing: a bracket squared means the bracket **times itself**.`, `${name} hat jeden Term quadriert und das Minus behalten. Aber $(-${-q})^2 = +${q * q}$, und der Mittelterm $-${-2 * q}${v}$ fehlt: Klammer hoch 2 heißt Klammer **mal sich selbst**.`)
        : tx(`${name} has the middle term right, but the last one wrong: $(-${-q})^2 = +${q * q}$. Minus times minus is plus!`, `${name} hat den Mittelterm richtig, aber den letzten falsch: $(-${-q})^2 = +${q * q}$. Minus mal Minus ist Plus!`);
  } else if (kind === "twoProducts") {
    const r = rng.nonZero(-7, 7);
    const t = rng.nonZero(-7, 7, [r, -r]);
    a = [m(1, 1), m(r)];
    b = [m(1, 1), m(t)];
    wrong = [r * t, 0, 1];
    why = tx(`${name} only multiplied first with first and last with last. But **every** term meets **every** term: four products, so there's an $${v}$-term too.`, `${name} hat nur Erstes mal Erstes und Letztes mal Letztes gerechnet. Aber **jeder** Term trifft **jeden**: Das sind vier Produkte, also gibt es auch einen $${v}$-Term.`);
  } else if (kind === "negFactor") {
    const k = -rng.int(2, 9);
    const p = rng.int(1, 5);
    const q = rng.int(2, 9);
    a = [m(k)];
    b = [m(p, 1), m(-q)];
    wrong = [k * q, k * p];
    why = tx(`${name} forgot that minus times minus gives plus: $${k} \\cdot (-${q}) = +${-k * q}$.`, `${name} hat vergessen, dass Minus mal Minus Plus ergibt: $${k} \\cdot (-${q}) = +${-k * q}$.`);
  } else {
    const p = rng.int(2, 5);
    const q = rng.int(1, 9);
    a = [m(p, 1), m(q)];
    b = [m(p, 1), m(-q)];
    wrong = [-q * q, 0, p];
    why = tx(`The 3rd binomial formula is right, but $a = ${p}${v}$, so $a^2 = ${p}${v} \\cdot ${p}${v} = ${p * p}${v}^2$. ${name} forgot to square the $${p}$.`, `Die 3. binomische Formel passt, aber $a = ${p}${v}$, also $a^2 = ${p}${v} \\cdot ${p}${v} = ${p * p}${v}^2$. ${name} hat vergessen, die $${p}$ zu quadrieren.`);
  }
  const right = plainPoly(resultPoly(a, b), v);
  const task = productSrc(a, b, v, false, square);
  const wrongSrc = showPoly(wrong, v);
  const copiedValue = plainPoly(wrong, v);
  // German genitive: "Mias Ergebnis", but "Jonas’ Ergebnis".
  const genDe = /[sxzß]$/.test(name) ? `${name}’` : `${name}s`;
  const copied: Mistake = {
    when: { kind: "expr", value: copiedValue },
    title: tx(`That's ${name}'s result`, `Das ist ${genDe} Ergebnis`),
    say: tx(`That's exactly what ${name} wrote, so the mistake is still in there. Expand it step by step yourself.`, `Das ist genau das, was ${name} geschrieben hat, also steckt der Fehler noch drin. Multipliziere selbst Schritt für Schritt aus.`),
  };
  const rest = expandMistakes(a, b, v, right, square).filter((x) => x.when.kind === "expr" && !equivalentText(x.when.value, copiedValue));
  return {
    instruction: FIND_MISTAKE,
    text: tx(`${name} wrote: $${task} = ${wrongSrc}$. What went wrong? Write the correct result.`, `${name} hat gerechnet: $${task} = ${wrongSrc}$. Was ist schiefgelaufen? Gib das richtige Ergebnis an.`),
    math: task,
    answer: { kind: "expr", value: right, form: "simplified" },
    hint: tx("Expand it yourself step by step, then compare with the line above.", "Multipliziere selbst Schritt für Schritt aus und vergleiche dann mit der Zeile oben."),
    solution: [{ math: `${task} \\ne \\strike{${wrongSrc}}`, note: why }, ...expandFrames(a, b, v, { square })],
    mistakes: [copied, ...rest],
  };
}

/** Mental maths: 31², 49², 39 · 41 with a binomial formula. */
function clever2(rng: Rng): Exercise {
  const kind = rng.pick(["up", "down", "conj", "conj"] as const);
  let right = 0;
  const out: Mistake[] = [];
  const add = (value: number, title: Text, say: Text) => {
    if (value !== right && !out.some((x) => x.when.kind === "number" && x.when.value === value)) out.push({ when: { kind: "number", value }, title, say });
  };
  if (kind === "conj") {
    const base = rng.pick([20, 30, 40, 50, 60, 70, 80, 90, 100]);
    const d = rng.int(1, base === 100 ? 4 : 3);
    const n1 = base - d;
    const n2 = base + d;
    right = base * base - d * d;
    add(base * base + d * d, tx("Plus instead of minus", "Plus statt Minus"), tx("Close! The 3rd binomial formula ends with **minus** $b^2$: $(a - b)(a + b) = a^2 - b^2$.", "Knapp! Die 3. binomische Formel endet mit **minus** $b^2$: $(a - b)(a + b) = a^2 - b^2$."));
    add(base * base - d, tx("b not squared", "b nicht quadriert"), tx(`You subtracted $${d}$. But the formula subtracts $b^2 = ${d * d}$.`, `Du hast $${d}$ abgezogen. Die Formel zieht aber $b^2 = ${d * d}$ ab.`));
    add(base * base, tx("Forgot b²", "b² vergessen"), tx(`$${base}^2$ is a great start, but the product is a bit smaller: subtract $b^2 = ${d * d}$.`, `$${base}^2$ ist ein super Anfang, aber das Produkt ist etwas kleiner: Zieh noch $b^2 = ${d * d}$ ab.`));
    return {
      instruction: CLEVER,
      math: `${n1} \\cdot ${n2}`,
      answer: { kind: "number", value: right },
      hint: tx(`Both numbers are ${d} away from ${base}.`, `Beide Zahlen sind ${d} von ${base} entfernt.`),
      solution: [
        { math: `${n1}#x \\cdot#d ${n2}#y`, note: tx(`Both numbers are $${d}$ away from $${base}$: $${n1} = ${base} - ${d}$ and $${n2} = ${base} + ${d}$.`, `Beide Zahlen sind $${d}$ von $${base}$ entfernt: $${n1} = ${base} - ${d}$ und $${n2} = ${base} + ${d}$.`) },
        { math: `(${base}#a -#s ${d}#b)#p (${base}#a2 +#s2 ${d}#b2)#q`, note: tx("That's the 3rd binomial formula: $(a - b)(a + b) = a^2 - b^2$.", "Das ist die 3. binomische Formel: $(a - b)(a + b) = a^2 - b^2$.") },
        { math: `${base}#a ^{2#e} -#s ${d}#b ^{2#e2}`, note: tx(`So it's $${base}^2 - ${d}^2$.`, `Also $${base}^2 - ${d}^2$.`) },
        { math: `${base * base}#a -#s ${d * d}#b`, note: tx("Both squares are easy in your head.", "Beide Quadrate gehen leicht im Kopf.") },
        { math: `${right}#a`, note: tx(`So $${n1} \\cdot ${n2} = ${right}$.`, `Also ist $${n1} \\cdot ${n2} = ${right}$.`) },
      ],
      mistakes: out,
    };
  }
  const up = kind === "up";
  const base = rng.pick([20, 30, 40, 50, 60, 70, 80, 90, 100]);
  const d = rng.int(1, base === 100 ? 4 : 2);
  const n = up ? base + d : base - d;
  const sg = up ? "+" : "-";
  right = n * n;
  add(base * base + d * d, tx("The middle term is missing", "Der Mittelterm fehlt"), tx(`The classic trap! $(a ${sg} b)^2$ is not $a^2 + b^2$. The middle term $2ab = ${2 * base * d}$ is missing.`, `Die klassische Falle! $(a ${sg} b)^2$ ist nicht $a^2 + b^2$. Der Mittelterm $2ab = ${2 * base * d}$ fehlt.`));
  if (!up) add(base * base + 2 * base * d + d * d, tx("Sign of the middle term", "Vorzeichen vom Mittelterm"), tx(`$${n} = ${base} - ${d}$, so it's the **2nd** binomial formula: the middle term is subtracted.`, `$${n} = ${base} - ${d}$, also ist es die **2.** binomische Formel: Der Mittelterm wird abgezogen.`));
  if (!up) add(base * base - 2 * base * d - d * d, tx("b² is always plus", "b² ist immer plus"), tx(`Almost! The last term is $+b^2$, also in the 2nd formula: $(a - b)^2 = a^2 - 2ab + b^2$.`, `Fast! Der letzte Term ist $+b^2$, auch bei der 2. Formel: $(a - b)^2 = a^2 - 2ab + b^2$.`));
  add(base * base + (up ? 1 : -1) * base * d + d * d, tx("The 2 is missing", "Die 2 fehlt"), tx(`Nearly! The middle term is $2ab = 2 \\cdot ${base} \\cdot ${d}$, not just $${base} \\cdot ${d}$.`, `Fast! Der Mittelterm ist $2ab = 2 \\cdot ${base} \\cdot ${d}$, nicht nur $${base} \\cdot ${d}$.`));
  const formula = up ? "(a + b)^2 = a^2 + 2ab + b^2" : "(a - b)^2 = a^2 - 2ab + b^2";
  return {
    instruction: CLEVER,
    math: `${n}^2`,
    answer: { kind: "number", value: right },
    hint: tx(`Write $${n}$ as $${base} ${sg} ${d}$.`, `Schreib $${n}$ als $${base} ${sg} ${d}$.`),
    solution: [
      { math: `${n}#n ^{2#e}`, note: tx(`$${n}$ is close to $${base}$: $${n} = ${base} ${sg} ${d}$.`, `$${n}$ liegt nah an $${base}$: $${n} = ${base} ${sg} ${d}$.`) },
      { math: `(${base}#a ${sg}#s ${d}#b)#br ^{2#e}`, note: tx(`Now it's a binomial formula: $${formula}$.`, `Jetzt ist es eine binomische Formel: $${formula}$.`) },
      { math: `${base}#a ^{2#e} ${sg}#s 2#two \\cdot#d1 ${base}#a2 \\cdot#d2 ${d}#b2 +#s2 ${d}#b ^{2#e2}`, note: tx(`Insert $a = ${base}$ and $b = ${d}$.`, `Setze $a = ${base}$ und $b = ${d}$ ein.`) },
      { math: `${base * base}#a ${sg}#s ${2 * base * d}#a2 +#s2 ${d * d}#b`, note: tx("Each part is easy in your head.", "Jeder Teil geht leicht im Kopf.") },
      { math: `${right}#a`, note: tx(`So $${n}^2 = ${right}$.`, `Also ist $${n}^2 = ${right}$.`) },
    ],
    mistakes: out,
  };
}

type Product = { a: Factor; b: Factor; square: boolean; kind: "sq" | "conj" | "prod" };

function randomProduct(rng: Rng, kind: Product["kind"]): Product {
  if (kind === "sq") {
    const f: Factor = [m(1, 1), m(rng.nonZero(-6, 6))];
    return { a: f, b: f, square: true, kind };
  }
  if (kind === "conj") {
    const q = rng.int(1, 6);
    const s = rng.sign();
    return { a: [m(1, 1), m(s * q)], b: [m(1, 1), m(-s * q)], square: false, kind };
  }
  const r = rng.nonZero(-6, 6);
  const t = rng.nonZero(-6, 6, [r, -r]);
  return { a: [m(1, 1), m(r)], b: [m(1, 1), m(t)], square: false, kind };
}

const polyOf = (x: Product) => resultPoly(x.a, x.b);
const scalePoly = (p: Poly, k: number): Poly => p.map((c) => c * k);

/** A sum or difference of two products: (x + 3)² − (x − 1)(x + 1). */
function simplify2(rng: Rng): Exercise {
  const v = rng.pick(LETTERS);
  for (;;) {
    const A = randomProduct(rng, rng.pick(["sq", "sq", "prod"] as const));
    const B = randomProduct(rng, rng.pick(["conj", "sq", "prod"] as const));
    const minus = rng.chance(0.8);
    const pa = polyOf(A);
    const pb = polyOf(B);
    const res = polyAdd(pa, minus ? scalePoly(pb, -1) : pb);
    if (res.length < 2 || (res[1] ?? 0) === 0) continue;
    const op = minus ? "-" : "+";
    const right = plainPoly(res, v);
    const math = `${productSrc(A.a, A.b, v, false, A.square)} ${op} ${productSrc(B.a, B.b, v, false, B.square)}`;

    const out: Mistake[] = [];
    const add = (p: Poly, title: Text, say: Text) => {
      const value = plainPoly(p, v);
      if (equivalentText(value, right) || out.some((x) => x.when.kind === "expr" && equivalentText(x.when.value, value))) return;
      out.push({ when: { kind: "expr", value }, title, say });
    };
    if (minus) {
      const leadB: Poly = [0, 0, pb[2] ?? 0];
      add(
        polyAdd(polyAdd(pa, pb), scalePoly(leadB, -2)),
        tx("The minus only hit the first term", "Das Minus hat nur den ersten Term erwischt"),
        tx(
          `Ah, I see! The minus stands in front of the **whole** second product. Put its result in brackets first, then flip **every** sign: $-(${showPoly(pb, v)}) = ${showPoly(scalePoly(pb, -1), v)}$.`,
          `Ah, ich seh's! Das Minus steht vor dem **ganzen** zweiten Produkt. Setz sein Ergebnis erst in Klammern und dreh dann **jedes** Vorzeichen um: $-(${showPoly(pb, v)}) = ${showPoly(scalePoly(pb, -1), v)}$.`,
        ),
      );
    }
    for (const [X, other, first] of [[A, pb, true], [B, pa, false]] as const) {
      if (!X.square) continue;
      const q = X.a[1].c;
      const flat: Poly = [q * q, 0, 1];
      const wrong = first ? polyAdd(flat, minus ? scalePoly(other, -1) : other) : polyAdd(other, minus ? scalePoly(flat, -1) : flat);
      add(wrong, tx("The middle term is missing", "Der Mittelterm fehlt"), tx(`The classic trap! $${productSrc(X.a, X.b, v, false, true)}$ is not $${showPoly(flat, v)}$: the middle term $2ab$ is missing.`, `Die klassische Falle! $${productSrc(X.a, X.b, v, false, true)}$ ist nicht $${showPoly(flat, v)}$: Der Mittelterm $2ab$ fehlt.`));
    }
    if (B.kind === "conj") {
      const q = Math.abs(B.a[1].c);
      const wrongB: Poly = [q * q, 0, 1];
      add(polyAdd(pa, minus ? scalePoly(wrongB, -1) : wrongB), tx("3rd formula: minus b²", "3. Formel: minus b²"), tx("Careful with the 3rd binomial formula: $(a + b)(a - b) = a^2 - b^2$, the last term is **minus**.", "Vorsicht bei der 3. binomischen Formel: $(a + b)(a - b) = a^2 - b^2$, der letzte Term ist **minus**."));
    }

    // Frames: expand each product into brackets, drop the brackets (flip the signs after a minus), combine.
    const flipped = minus ? scalePoly(pb, -1) : pb;
    const flipKeys = minus ? pb.flatMap((c, i) => (c ? [`sb${i}`] : [])) : [];
    const resultSrc = res
      .map((c, i) => ({ c, i }))
      .reverse()
      .filter(({ c }) => c !== 0)
      .map(({ c, i }, n) => {
        const id = (pa[i] ?? 0) !== 0 ? "a" : "b";
        const abs = Math.abs(c);
        const k = (x: string) => `#${x}${id}${i}`;
        const sign = c < 0 ? `-${k("s")} ` : n === 0 ? "" : `+${k("s")} `;
        const coef = i > 0 && abs === 1 ? "" : `${abs}${k("c")}`;
        const pw = i === 0 ? "" : i === 1 ? `${v}${k("v")}` : `${v}${k("v")} ^{${i}${k("e")}}`;
        return `${sign}${[coef, pw].filter(Boolean).join(" ")}`;
      })
      .join(" ");
    const cancels = (pa[2] ?? 0) + (minus ? -(pb[2] ?? 0) : pb[2] ?? 0) === 0;
    const solution: Frame[] = [
      {
        math,
        note: tx("Two products. Expand each one first and **keep its result in brackets**.", "Zwei Produkte. Multipliziere jedes erst aus und **lass sein Ergebnis in Klammern**."),
      },
      {
        math: `(${polySrc(pa, v, "a")})#ka ${op}#op (${polySrc(pb, v, "b")})#kb`,
        note: tx(`$${productSrc(A.a, A.b, v, false, A.square)} = ${showPoly(pa, v)}$ and $${productSrc(B.a, B.b, v, false, B.square)} = ${showPoly(pb, v)}$.`, `$${productSrc(A.a, A.b, v, false, A.square)} = ${showPoly(pa, v)}$ und $${productSrc(B.a, B.b, v, false, B.square)} = ${showPoly(pb, v)}$.`),
      },
      {
        math: `${polySrc(pa, v, "a")} ${polySrc(flipped, v, "b", true)}`,
        note: minus
          ? tx("Minus in front of a bracket: drop the brackets and flip **every** sign inside.", "Minus vor der Klammer: Klammern weglassen und **jedes** Vorzeichen darin umdrehen.")
          : tx("Plus in front of a bracket: the brackets simply go.", "Plus vor der Klammer: Die Klammern fallen einfach weg."),
        highlight: flipKeys,
      },
      {
        math: resultSrc,
        note: cancels
          ? tx(`Combine like terms. The $${v}^2$ cancel out: $${showPoly(res, v)}$.`, `Fasse gleichartige Terme zusammen. Die $${v}^2$ heben sich auf: $${showPoly(res, v)}$.`)
          : tx(`Combine like terms: $${showPoly(res, v)}$.`, `Fasse gleichartige Terme zusammen: $${showPoly(res, v)}$.`),
      },
    ];
    return {
      instruction: SIMPLIFY,
      math,
      answer: { kind: "expr", value: right, form: "simplified" },
      hint: minus
        ? tx("Expand both products, put the second result in brackets, then mind the minus in front of it.", "Multipliziere beide Produkte aus, setz das zweite Ergebnis in Klammern und denk dann an das Minus davor.")
        : tx("Expand both products, then combine like terms.", "Multipliziere beide Produkte aus und fasse dann gleichartige Terme zusammen."),
      solution,
      mistakes: out,
    };
  }
}

/** Level 2 practice: mostly two brackets and the binomial formulas, in five task shapes. */
export function generate2(rng: Rng): Exercise {
  const r = rng.int(1, 100);
  if (r <= 10) return tier(1, rng);
  if (r <= 30) return tier(2, rng);
  if (r <= 52) return tier(3, rng);
  if (r <= 65) return gap2(rng);
  if (r <= 76) return findMistake2(rng);
  if (r <= 87) return clever2(rng);
  return simplify2(rng);
}

// ---------------------------------------------------------------------------
// Interactive area model: a rectangle's area is the product of its sides.

const X = 150;
const U = 24;

type Region = { id: string; x: number; y: number; w: number; h: number; label: string; tone: "xx" | "x" | "n" };

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const t = useText();
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 font-math text-[18px] italic text-ink-2">{label} =</span>
      <button onClick={() => onChange(Math.max(1, value - 1))} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx(`Decrease ${label}`, `${label} verkleinern`))}>
        <Minus className="size-3.5" />
      </button>
      <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-6 text-center font-math text-[20px] tabular-nums">
        {value}
      </motion.span>
      <button onClick={() => onChange(Math.min(6, value + 1))} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx(`Increase ${label}`, `${label} vergrößern`))}>
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function AreaModel() {
  const t = useText();
  const scope = useId();
  const [two, setTwo] = useState(false);
  const [a, setA] = useState(3);
  const [b, setB] = useState(2);
  const pad = 30;
  const top = two ? X : 0;
  const regions: Region[] = two
    ? [
        { id: "xx", x: 0, y: 0, w: X, h: X, label: "x²", tone: "xx" },
        { id: "bx", x: X, y: 0, w: b * U, h: X, label: `${b}x`, tone: "x" },
        { id: "ax", x: 0, y: top, w: X, h: a * U, label: `${a}x`, tone: "x" },
        { id: "ab", x: X, y: top, w: b * U, h: a * U, label: `${a * b}`, tone: "n" },
      ]
    : [
        { id: "ax", x: 0, y: 0, w: X, h: a * U, label: `${a}x`, tone: "x" },
        { id: "ab", x: X, y: 0, w: b * U, h: a * U, label: `${a * b}`, tone: "n" },
      ];
  const W = pad + X + 6 * U + 8;
  const H = pad + X + 6 * U + 8;
  const fill = { xx: "var(--blob)", x: "color-mix(in oklab, var(--blob) 30%, transparent)", n: "color-mix(in oklab, var(--ink) 10%, transparent)" };
  const text = { xx: "#fff", x: "var(--ink)", n: "var(--ink)" };
  const formula = two
    ? `(x#x1 + ${a}#a)#L (x#x2 + ${b}#b)#R =#eq x#t1^{2#t1e} + ${b}#t2c x#t2 + ${a}#t3c x#t3 + ${a * b}#t4 =#eq2 x#t1^{2#t1e} + ${a + b}#t2c x#t2 + ${a * b}#t4`
    : `${a}#a (x#x2 + ${b}#b)#R =#eq ${a}#t3c x#t3 + ${a * b}#t4`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex rounded-lg border border-line p-0.5">
          {[false, true].map((on) => (
            <button
              key={String(on)}
              onClick={() => setTwo(on)}
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", two === on ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {two === on && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{on ? t(tx("Two brackets", "Zwei Klammern")) : t(tx("One bracket", "Eine Klammer"))}</span>
            </button>
          ))}
        </div>
        <Stepper label="a" value={a} onChange={setA} />
        <Stepper label="b" value={b} onChange={setB} />
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[330px]" role="img" aria-label={t(tx("Area model", "Flächenmodell"))}>
          <g transform={`translate(${pad} ${pad})`}>
            {/* side lengths */}
            <text x={X / 2} y={-10} textAnchor="middle" className="fill-ink-2 font-math italic" fontSize={18}>x</text>
            <motion.text animate={{ x: X + (b * U) / 2 }} initial={false} y={-10} textAnchor="middle" className="fill-ink-2 font-math" fontSize={18}>{b}</motion.text>
            <AnimatePresence initial={false}>
              {two && (
                <motion.text key="x-left" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} x={-12} y={X / 2 + 6} textAnchor="middle" className="fill-ink-2 font-math italic" fontSize={18}>
                  x
                </motion.text>
              )}
            </AnimatePresence>
            <motion.text animate={{ y: top + (a * U) / 2 + 6 }} initial={false} x={-12} textAnchor="middle" className="fill-ink-2 font-math" fontSize={18}>{a}</motion.text>

            <AnimatePresence initial={false}>
              {regions.map((r) => (
                <motion.g key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.rect
                    initial={false}
                    animate={{ x: r.x + 1, y: r.y + 1, width: Math.max(0, r.w - 2), height: Math.max(0, r.h - 2) }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                    rx={6}
                    fill={fill[r.tone]}
                  />
                  <motion.text
                    initial={false}
                    animate={{ x: r.x + r.w / 2, y: r.y + r.h / 2 + 6 }}
                    transition={{ type: "spring", stiffness: 260, damping: 28 }}
                    textAnchor="middle"
                    fontSize={r.h < 40 || r.w < 40 ? 14 : 19}
                    className="font-math italic"
                    fill={text[r.tone]}
                  >
                    {r.label}
                  </motion.text>
                </motion.g>
              ))}
            </AnimatePresence>
          </g>
        </svg>
        <div className="space-y-3">
          <MathView src={formula} size="md" scope={`${scope}-f`} />
          <p className="max-w-[420px] text-[13.5px] leading-relaxed text-ink-2">
            {two
              ? t(
                  tx(
                    "Each of the four pieces is one product. Add them up and you've expanded the brackets. The two x-pieces combine.",
                    "Jedes der vier Teile ist ein Produkt. Addierst du sie, hast du die Klammern ausmultipliziert. Die beiden x-Teile lassen sich zusammenfassen.",
                  ),
                )
              : t(
                  tx(
                    "The big rectangle is split into two pieces. Their areas are the two products. Together they are the whole thing.",
                    "Das große Rechteck ist in zwei Teile zerlegt. Ihre Flächen sind die beiden Produkte. Zusammen ergeben sie das ganze Rechteck.",
                  ),
                )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const intro: Frame[] = [
  { math: "3#cA0 (x#vB0 +#sB1 4#cB1)#bB", note: tx("The $3$ in front multiplies the **whole** bracket.", "Die $3$ davor wird mit der **ganzen** Klammer multipliziert.") },
  {
    math: "3#cA0 (x#vB0 +#sB1 4#cB1)#bB",
    note: tx("So it reaches into **each** term: the $x$ and the $4$.", "Sie wirkt also auf **jeden** Term in der Klammer: auf das $x$ und auf die $4$."),
    arrows: [["cA0", "vB0"], ["cA0", "cB1"]],
  },
  { math: "3#cA0 \\cdot#d1 x#vB0 +#sB1 3#k2 \\cdot#d2 4#cB1", note: tx("Two products: $3 \\cdot x$ and $3 \\cdot 4$.", "Zwei Produkte: $3 \\cdot x$ und $3 \\cdot 4$.") },
  { math: "3#cA0 x#vB0 +#sB1 12#cB1", note: tx("Work them out: $3x + 12$. The bracket is gone!", "Ausrechnen: $3x + 12$. Die Klammer ist weg!") },
];

const negative = expandFrames([m(-2)], [m(3, 1), m(-5)], "x");
const twoBrackets = expandFrames([m(1, 1), m(2)], [m(1, 1), m(5)], "x");
const square = expandFrames([m(1, 1), m(3)], [m(1, 1), m(3)], "x", { square: true });

const BINOMIAL_EN =
  "**1st binomial formula:** $(a + b)^2 = a^2 + 2ab + b^2$\n\n**2nd binomial formula:** $(a - b)^2 = a^2 - 2ab + b^2$\n\n**3rd binomial formula:** $(a + b)(a - b) = a^2 - b^2$";
const BINOMIAL_DE =
  "**1. binomische Formel:** $(a + b)^2 = a^2 + 2ab + b^2$\n\n**2. binomische Formel:** $(a - b)^2 = a^2 - 2ab + b^2$\n\n**3. binomische Formel:** $(a + b)(a - b) = a^2 - b^2$";

export const level2: LevelLesson = {
  summary: [
    {
      title: tx("Factor in front", "Faktor vor der Klammer"),
      body: tx("Multiply the factor by **every** term in the bracket.", "Multipliziere den Faktor mit **jedem** Term in der Klammer."),
      examples: ["a(b + c) = ab + ac", "3(x - 4) = 3x - 12"],
      tone: "rule",
    },
    {
      title: tx("Sign rules", "Vorzeichenregeln"),
      body: tx("Same signs give plus, different signs give minus.", "Gleiche Vorzeichen ergeben Plus, verschiedene ergeben Minus."),
      examples: ["(+) \\cdot (+) = +", "(-) \\cdot (-) = +", "(+) \\cdot (-) = -"],
      tone: "rule",
    },
    {
      title: tx("Two brackets", "Zwei Klammern"),
      body: tx(
        "Every term of the first bracket times every term of the second. Then combine.",
        "Jeder Term der ersten Klammer wird mit jedem Term der zweiten multipliziert. Dann zusammenfassen.",
      ),
      examples: ["(a + b)(c + d) = ac + ad + bc + bd"],
      tone: "rule",
    },
    {
      title: tx("Binomial formulas", "Binomische Formeln"),
      body: tx("Shortcuts worth knowing by heart: the 1st, 2nd and 3rd binomial formula.", "Abkürzungen, die du auswendig können solltest: die 1., 2. und 3. binomische Formel."),
      examples: ["(a + b)^2 = a^2 + 2ab + b^2", "(a - b)^2 = a^2 - 2ab + b^2", "(a + b)(a - b) = a^2 - b^2"],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx("The middle term doesn't disappear when you square a sum.", "Wenn du eine Summe quadrierst, verschwindet der mittlere Term nicht."),
      examples: ["(a + b)^2 \\ne a^2 + b^2"],
      tone: "warning",
    },
    {
      title: tx("Calculate cleverly", "Geschickt rechnen"),
      body: tx("Write a number as a round number plus or minus a little. Then a binomial formula does the work.", "Schreib eine Zahl als runde Zahl plus oder minus ein bisschen. Dann erledigt eine binomische Formel die Arbeit."),
      examples: ["31^2 = (30 + 1)^2 = 900 + 60 + 1 = 961", "39 \\cdot 41 = (40 - 1)(40 + 1) = 40^2 - 1 = 1599"],
      tone: "tip",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("A factor in front of a bracket", "Ein Faktor vor der Klammer"),
      blob: tx("Expanding means: the number in front visits everyone inside!", "Ausmultiplizieren heißt: Die Zahl davor besucht jeden in der Klammer!"),
      body: tx(
        "When a number stands right in front of a bracket, it means **times**. To get rid of the bracket, multiply it by every term inside.",
        "Steht eine Zahl direkt vor einer Klammer, bedeutet das **mal**. Um die Klammer loszuwerden, multiplizierst du die Zahl mit jedem Term in der Klammer.",
      ),
      frames: intro,
    },
    {
      type: "widget",
      title: tx("Why it works", "Warum das funktioniert"),
      blob: tx("Think of it as the area of a rectangle. Change a and b!", "Stell es dir als Fläche eines Rechtecks vor. Verändere a und b!"),
      body: tx(
        "A rectangle with sides $a$ and $x + b$ has the area $a(x + b)$. Split it in two and you get $ax + ab$.",
        "Ein Rechteck mit den Seiten $a$ und $x + b$ hat den Flächeninhalt $a(x + b)$. Zerlegst du es in zwei Teile, bekommst du $ax + ab$.",
      ),
      widget: AreaModel,
    },
    {
      type: "check",
      blob: tx("Your turn. Multiply the 4 by both terms.", "Du bist dran. Multipliziere die 4 mit beiden Termen."),
      exercise: {
        instruction: EXPAND,
        math: "4(2x - 3)",
        answer: { kind: "expr", value: "8x-12", form: "simplified" },
        hint: tx("$4 \\cdot 2x$ and $4 \\cdot 3$. The minus stays.", "$4 \\cdot 2x$ und $4 \\cdot 3$. Das Minus bleibt."),
        solution: expandFrames([m(4)], [m(2, 1), m(-3)], "x"),
        mistakes: expandMistakes([m(4)], [m(2, 1), m(-3)], "x", "8x-12", false),
      },
    },
    {
      type: "explain",
      title: tx("A negative factor", "Ein negativer Faktor"),
      blob: tx("Careful: a minus in front changes every sign.", "Vorsicht: Ein Minus davor ändert jedes Vorzeichen."),
      body: tx("Multiply as usual, but use the sign rules: minus times minus is plus.", "Multipliziere wie gewohnt, aber denk an die Vorzeichenregeln: Minus mal Minus ergibt Plus."),
      frames: negative,
    },
    {
      type: "check",
      exercise: {
        instruction: EXPAND,
        math: "-5(2a - 3)",
        answer: { kind: "expr", value: "-10a+15", form: "simplified" },
        hint: tx("$-5 \\cdot 2a = -10a$ and $-5 \\cdot (-3) = +15$.", "$-5 \\cdot 2a = -10a$ und $-5 \\cdot (-3) = +15$."),
        solution: expandFrames([m(-5)], [m(2, 1), m(-3)], "a"),
        mistakes: expandMistakes([m(-5)], [m(2, 1), m(-3)], "a", "-10a+15", false),
      },
    },
    {
      type: "explain",
      title: tx("Two brackets: everyone meets everyone", "Zwei Klammern: Jeder trifft jeden"),
      blob: tx("Two brackets means four handshakes!", "Zwei Klammern, vier Handschläge!"),
      body: tx(
        "Each term of the first bracket multiplies each term of the second. With two terms each, that's four products.",
        "Jeder Term der ersten Klammer wird mit jedem Term der zweiten multipliziert. Bei je zwei Termen sind das vier Produkte.",
      ),
      frames: twoBrackets,
    },
    {
      type: "check",
      blob: tx("Four products, then combine the middle ones.", "Vier Produkte, dann die mittleren zusammenfassen."),
      exercise: {
        instruction: EXPAND_SIMPLIFY,
        math: "(x + 1)(x - 4)",
        answer: { kind: "expr", value: "x^2-3x-4", form: "simplified" },
        hint: tx("$x \\cdot x$, $x \\cdot (-4)$, $1 \\cdot x$ and $1 \\cdot (-4)$.", "$x \\cdot x$, $x \\cdot (-4)$, $1 \\cdot x$ und $1 \\cdot (-4)$."),
        solution: expandFrames([m(1, 1), m(1)], [m(1, 1), m(-4)], "x"),
        mistakes: expandMistakes([m(1, 1), m(1)], [m(1, 1), m(-4)], "x", "x^2-3x-4", false),
      },
    },
    {
      type: "explain",
      title: tx("Shortcuts: binomial formulas", "Abkürzung: die binomischen Formeln"),
      blob: tx("These three come up all the time. Learn them and you'll be super fast!", "Diese drei kommen ständig vor. Wenn du sie kannst, bist du superschnell!"),
      body: tx(BINOMIAL_EN, BINOMIAL_DE),
      frames: square,
    },
    {
      type: "check",
      blob: tx("Use the 2nd binomial formula, or just multiply it out.", "Nimm die 2. binomische Formel oder multipliziere einfach aus."),
      exercise: {
        instruction: EXPAND_SIMPLIFY,
        math: "(x - 5)^2",
        answer: { kind: "expr", value: "x^2-10x+25", form: "simplified" },
        hint: tx("$(a - b)^2 = a^2 - 2ab + b^2$ with $a = x$ and $b = 5$.", "$(a - b)^2 = a^2 - 2ab + b^2$ mit $a = x$ und $b = 5$."),
        solution: expandFrames([m(1, 1), m(-5)], [m(1, 1), m(-5)], "x", { square: true }),
        mistakes: expandMistakes([m(1, 1), m(-5)], [m(1, 1), m(-5)], "x", "x^2-10x+25", true),
      },
    },
    {
      type: "check",
      blob: tx("Last one. Spot which formula this is!", "Die letzte. Erkennst du, welche Formel das ist?"),
      exercise: {
        instruction: EXPAND_SIMPLIFY,
        math: "(2x + 3)(2x - 3)",
        answer: { kind: "expr", value: "4x^2-9", form: "simplified" },
        hint: tx("Same terms, different signs: that's the 3rd binomial formula.", "Gleiche Terme, verschiedene Vorzeichen: Das ist die 3. binomische Formel."),
        solution: expandFrames([m(2, 1), m(3)], [m(2, 1), m(-3)], "x"),
        mistakes: expandMistakes([m(2, 1), m(3)], [m(2, 1), m(-3)], "x", "4x^2-9", false),
      },
    },
  ],
};
