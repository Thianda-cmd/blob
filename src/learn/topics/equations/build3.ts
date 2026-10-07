// Level 3 builders: absolute value equations and inequalities (distance on the number line,
// case analysis) and root equations (square, solve, and the check against false solutions).

import { tx, txMap, type Text } from "@/i18n/text";
import { frac, show as qshow, value as qvalue, type Frac } from "@/learn/engine/frac";
import type { Frame, Mistake } from "@/learn/types";
import { decTex, setOf } from "./build2";

// ---------------------------------------------------------------------------
// Small display helpers

/** "3x - 2", "x + 4", "-x", "5" (no keys). */
export function lin(u: number, b: number, v = "x"): string {
  const x = u === 0 ? "" : u === 1 ? v : u === -1 ? `-${v}` : `${u}${v}`;
  if (!x) return String(b);
  return b === 0 ? x : `${x} ${b > 0 ? "+" : "-"} ${Math.abs(b)}`;
}
/** A number in brackets when negative: "(-3)". */
const par = (n: number | string) => (String(n).startsWith("-") ? `(${n})` : String(n));
/** Maths with one or more "or"s: the words differ, the maths doesn't. */
const withOr = (build: (or: string) => string): Text => txMap((t) => build(t('\\quad "or" \\quad', '\\quad "oder" \\quad')));

const solutionsSpec = (v: string, values: number[]) => ({ kind: "solutions" as const, variable: v, values, allowNone: true });

/** Collects typical mistakes for "solutions" answers: never the right set, never twice the same. */
function bag(right: number[], v: string) {
  const key = (vals: number[]) => [...new Set(vals.map((x) => Math.round(x * 1e6)))].sort((a, b) => a - b).join(",");
  const seen = new Set([key(right)]);
  const out: Mistake[] = [];
  return {
    out,
    push(values: number[] | null, title: Text, say: Text, close = false) {
      if (!values || !values.length || values.some((x) => !Number.isFinite(x)) || out.length >= 5) return;
      const k = key(values);
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ when: solutionsSpec(v, values), title, say, close });
    },
  };
}

// ---------------------------------------------------------------------------
// |x − a| = r: the distance from a is r.

export type AbsSimple = { a: number; r: number };

export const absSimpleSrc = ({ a, r }: AbsSimple, v = "x", keys = true) => {
  const K = (k: string) => (keys ? `#${k}` : "");
  const inside = a === 0 ? `${v}${K("x")}` : `${v}${K("x")} ${a > 0 ? "-" : "+"}${K("s")} ${Math.abs(a)}${K("a")}`;
  return `|${K("b1")} ${inside} |${K("b2")} =${K("rel")} ${r < 0 ? `-${K("n")} ` : ""}${Math.abs(r)}${K("r")}`;
};

export function absSimpleSolve({ a, r }: AbsSimple): number[] {
  if (r < 0) return [];
  return r === 0 ? [a] : [a - r, a + r];
}

export function absSimpleFrames(t: AbsSimple, v = "x"): Frame[] {
  const { a, r } = t;
  const center = a === 0 ? `${v}` : `${v} ${a > 0 ? "-" : "+"} ${Math.abs(a)}`;
  const first: Frame = {
    math: absSimpleSrc(t, v),
    note:
      a < 0
        ? tx(
            `$|${center}| = |${v} - (${a})|$ is the distance between $${v}$ and $${a}$ on the number line.`,
            `$|${center}| = |${v} - (${a})|$ ist der Abstand zwischen $${v}$ und $${a}$ an der Zahlengeraden.`,
          )
        : tx(`$|${center}|$ is the distance between $${v}$ and $${a}$ on the number line.`, `$|${center}|$ ist der Abstand zwischen $${v}$ und $${a}$ an der Zahlengeraden.`),
  };
  if (r < 0)
    return [
      first,
      { math: "L = \\{ \\}", note: tx(`A distance is never negative, so it can't be $${r}$. No solution.`, `Ein Abstand ist nie negativ, kann also nicht $${r}$ sein. Keine Lösung.`) },
    ];
  if (r === 0)
    return [
      first,
      { math: `${v}#x =#rel ${a}#v1`, note: tx(`Distance $0$ means: $${v}$ is $${a}$ itself.`, `Abstand $0$ heißt: $${v}$ ist $${a}$ selbst.`) },
      { math: setOf([a]), note: tx("Just one solution.", "Nur eine Lösung.") },
    ];
  const sA = a === 0 ? "" : ` ${a > 0 ? "-" : "+"}#s ${Math.abs(a)}#a`;
  const sA2 = a === 0 ? "" : ` ${a > 0 ? "-" : "+"}#s2 ${Math.abs(a)}#a2`;
  return [
    first,
    {
      math: withOr((or) => `${v}#x${sA} =#rel ${r}#r ${or} ${v}#x2${sA2} =#rel2 -#n ${r}#r2`),
      note: tx(`So the inside, $${center}$, is either $${r}$ or $-${r}$.`, `Also ist das Innere, $${center}$, entweder $${r}$ oder $-${r}$.`),
    },
    {
      math: withOr((or) => `${v}#x =#rel ${a + r}#v1 ${or} ${v}#x2 =#rel2 ${a - r}#v2`),
      note:
        a === 0
          ? tx(`$${r}$ steps to the right of $0$, or $${r}$ steps to the left.`, `$${r}$ Schritte rechts von $0$ oder $${r}$ Schritte links davon.`)
          : tx(
              `${a > 0 ? "Add" : "Subtract"} $${Math.abs(a)}$: $${a} + ${r} = ${a + r}$ and $${a} - ${r} = ${a - r}$.`,
              `${a > 0 ? "Addiere" : "Subtrahiere"} $${Math.abs(a)}$: $${a} + ${r} = ${a + r}$ und $${a} - ${r} = ${a - r}$.`,
            ),
    },
    { math: setOf([a - r, a + r]), note: tx(`Two solutions, $${r}$ to the left and $${r}$ to the right of $${a}$.`, `Zwei Lösungen, $${r}$ links und $${r}$ rechts von $${a}$.`) },
  ];
}

export function absSimpleMistakes(t: AbsSimple, v = "x"): Mistake[] {
  const { a, r } = t;
  const right = absSimpleSolve(t);
  const b = bag(right, v);
  if (r < 0) {
    b.push(
      [a - Math.abs(r), a + Math.abs(r)],
      tx("A distance can't be negative", "Ein Abstand ist nie negativ"),
      tx(
        `Careful: an absolute value is a distance, and distances are never negative. $|…| = ${r}$ can't happen, so there's no solution.`,
        `Vorsicht: Ein Betrag ist ein Abstand, und Abstände sind nie negativ. $|…| = ${r}$ ist unmöglich, also gibt es keine Lösung.`,
      ),
    );
    b.push(
      [a + r],
      tx("A distance can't be negative", "Ein Abstand ist nie negativ"),
      tx(`An absolute value is never negative, so $|…| = ${r}$ has no solution at all.`, `Ein Betrag ist nie negativ, also hat $|…| = ${r}$ gar keine Lösung.`),
    );
    return b.out;
  }
  if (a !== 0 && r > 0)
    b.push(
      [-a - r, -a + r],
      tx("Wrong centre", "Falscher Mittelpunkt"),
      a > 0
        ? tx(`Nearly! $|${v} - ${a}|$ is the distance from $+${a}$, not from $-${a}$. Count from $${a}$.`, `Fast! $|${v} - ${a}|$ ist der Abstand von $+${a}$, nicht von $-${a}$. Zähl von $${a}$ aus.`)
        : tx(
            `Nearly! $|${v} + ${-a}| = |${v} - (${a})|$ is the distance from $${a}$, not from $${-a}$. Count from $${a}$.`,
            `Fast! $|${v} + ${-a}| = |${v} - (${a})|$ ist der Abstand von $${a}$, nicht von $${-a}$. Zähl von $${a}$ aus.`,
          ),
      true,
    );
  if (r > 0) {
    b.push(
      [a + r],
      tx("Only one solution", "Nur eine Lösung"),
      tx(`Good start! But there are two numbers at distance $${r}$ from $${a}$: one to the right and one to the left.`, `Guter Anfang! Aber es gibt zwei Zahlen im Abstand $${r}$ von $${a}$: eine rechts und eine links.`),
      true,
    );
    b.push(
      [r, -r],
      tx("Bars just dropped", "Betragsstriche einfach weggelassen"),
      tx(
        `I think I know what you did: you took $${v} = \\pm ${r}$. But it's the **inside**, $${a > 0 ? `${v} - ${a}` : `${v} + ${-a}`}$, that equals $\\pm ${r}$.`,
        `Ich glaub, ich weiß, was du gemacht hast: Du hast $${v} = \\pm ${r}$ genommen. Aber das **Innere**, $${a > 0 ? `${v} - ${a}` : `${v} + ${-a}`}$, ist $\\pm ${r}$.`,
      ),
    );
  }
  return b.out;
}

// ---------------------------------------------------------------------------
// |ux + b| = c with u ≥ 2: the inside is c or −c.

export type AbsLinear = { u: number; b: number; c: number };

export const absLinearSrc = ({ u, b, c }: AbsLinear, v = "x") => `|${lin(u, b, v)}| = ${c}`;
export const absLinearSolve = ({ u, b, c }: AbsLinear) => (c < 0 ? [] : c === 0 ? [-b / u] : [(c - b) / u, (-c - b) / u]);

export function absLinearFrames({ u, b, c }: AbsLinear, v = "x"): Frame[] {
  const inside = lin(u, b, v);
  const s1 = (c - b) / u;
  const s2 = (-c - b) / u;
  const bText = b > 0 ? tx(`Subtract $${b}$.`, `Subtrahiere $${b}$.`) : tx(`Add $${-b}$.`, `Addiere $${-b}$.`);
  return [
    { math: `|#b1 ${inside} |#b2 =#rel ${c}#c`, note: tx(`The inside, $${inside}$, is either $${c}$ or $-${c}$.`, `Das Innere, $${inside}$, ist entweder $${c}$ oder $-${c}$.`) },
    { math: withOr((or) => `${inside} = ${c} ${or} ${inside} = -${c}`), note: tx("Two equations, one for each sign.", "Zwei Gleichungen, eine für jedes Vorzeichen.") },
    { math: withOr((or) => `${u}${v} = ${c - b} ${or} ${u}${v} = ${-c - b}`), note: bText },
    { math: withOr((or) => `${v} = ${s1} ${or} ${v} = ${s2}`), note: tx(`Divide by $${u}$.`, `Teile durch $${u}$.`) },
    { math: setOf([s1, s2]), note: tx("Two solutions.", "Zwei Lösungen.") },
  ];
}

export function absLinearMistakes(t: AbsLinear, v = "x"): Mistake[] {
  const { u, b, c } = t;
  const out = bag(absLinearSolve(t), v);
  out.push(
    [(c - b) / u],
    tx("The negative case is missing", "Der negative Fall fehlt"),
    tx(`Good start! But $${lin(u, b, v)}$ could also be $-${c}$: that gives the second solution.`, `Guter Anfang! Aber $${lin(u, b, v)}$ kann auch $-${c}$ sein: Das liefert die zweite Lösung.`),
    true,
  );
  out.push(
    [(c - b) / u, (-c + b) / u],
    tx("Minus on one term only", "Minus nur bei einem Term"),
    tx(
      `In the second case the **whole** inside is $-${c}$: $${lin(u, b, v)} = -${c}$. Then ${b > 0 ? "subtract" : "add"} $${Math.abs(b)}$ as usual.`,
      `Im zweiten Fall ist das **ganze** Innere $-${c}$: $${lin(u, b, v)} = -${c}$. Dann ${b > 0 ? "subtrahierst" : "addierst"} du wie gewohnt $${Math.abs(b)}$.`,
    ),
  );
  out.push(
    [c - b, -c - b],
    tx("Not divided", "Nicht geteilt"),
    tx(`Nearly! $${u}${v} = ${c - b}$ still means $${u} \\cdot ${v}$. Divide by $${u}$ at the end.`, `Fast! $${u}${v} = ${c - b}$ heißt noch $${u} \\cdot ${v}$. Teile am Ende durch $${u}$.`),
    true,
  );
  return out.out;
}

// ---------------------------------------------------------------------------
// |ux + b| = wx + d: case analysis (Fallunterscheidung).

export type AbsCases = { u: number; b: number; w: number; d: number };

export const absCasesSrc = ({ u, b, w, d }: AbsCases, v = "x") => `|${lin(u, b, v)}| = ${lin(w, d, v)}`;

/** Both case solutions and whether each fits its case. */
export function absCasesSolve({ u, b, w, d }: AbsCases) {
  const x1 = u - w === 0 ? null : frac(d - b, u - w);
  const x2 = u + w === 0 ? null : frac(d + b, -u - w);
  const ok1 = !!x1 && u * qvalue(x1) + b >= 0;
  const ok2 = !!x2 && u * qvalue(x2) + b < 0;
  return { x1, x2, ok1, ok2, values: [...(ok1 && x1 ? [qvalue(x1)] : []), ...(ok2 && x2 ? [qvalue(x2)] : [])] };
}

const CASE1 = (rest: string) => txMap((t) => `${t('"Case 1:"', '"1. Fall:"')} \\; ${rest}`);
const CASE2 = (rest: string) => txMap((t) => `${t('"Case 2:"', '"2. Fall:"')} \\; ${rest}`);

/** Solve ax + b = cx + d in one line: "3x − 2 = x + 6 ⇒ 2x = 8 ⇒ x = 4". */
function lineSolve(lhs: string, rhs: string, A: number, C: number, v: string, x: Frac) {
  const mid = A === 1 ? "" : ` \\;\\Rightarrow\\; ${lin(A, 0, v)} = ${C}`;
  return `${lhs} = ${rhs}${mid} \\;\\Rightarrow\\; ${v} = ${qshow(x)}`;
}

export function absCasesFrames(t: AbsCases, v = "x", intro?: Text): Frame[] {
  const { u, b, w, d } = t;
  const { x1, x2, ok1, ok2, values } = absCasesSolve(t);
  const inside = lin(u, b, v);
  const bound = frac(-b, u);
  const B = qshow(bound);
  const frames: Frame[] = [
    {
      math: absCasesSrc(t, v),
      note:
        intro ??
        tx(
          `There's an $${v}$ on the right too, so split into two cases: is the inside, $${inside}$, positive or negative?`,
          `Rechts steht auch ein $${v}$, also unterscheidest du zwei Fälle: Ist das Innere, $${inside}$, positiv oder negativ?`,
        ),
    },
    {
      math: CASE1(`${inside} \\ge 0 \\;\\Rightarrow\\; ${v} \\ge ${B}`),
      note: tx(`Case 1: the inside is not negative. Then the bars change nothing: $|${inside}| = ${inside}$.`, `1. Fall: Das Innere ist nicht negativ. Dann ändern die Striche nichts: $|${inside}| = ${inside}$.`),
    },
  ];
  if (x1) {
    frames.push({ math: lineSolve(inside, lin(w, d, v), u - w, d - b, v, x1), note: tx("Solve as usual.", "Löse wie gewohnt.") });
    frames.push({
      math: ok1 ? `\\green{${v} = ${qshow(x1)} \\ge ${B}}` : `\\red{${v} = ${qshow(x1)} < ${B}}`,
      note: ok1
        ? tx(`$${qshow(x1)}$ fits the condition $${v} \\ge ${B}$. A solution!`, `$${qshow(x1)}$ erfüllt die Bedingung $${v} \\ge ${B}$. Eine Lösung!`)
        : tx(`$${qshow(x1)}$ is **not** $\\ge ${B}$. It doesn't fit case 1, so it's no solution.`, `$${qshow(x1)}$ ist **nicht** $\\ge ${B}$. Es passt nicht zum 1. Fall, ist also keine Lösung.`),
    });
  }
  frames.push({
    math: CASE2(`${inside} < 0 \\;\\Rightarrow\\; ${v} < ${B}`),
    note: tx(`Case 2: the inside is negative. Then the bars flip its sign: $|${inside}| = -(${inside})$.`, `2. Fall: Das Innere ist negativ. Dann drehen die Striche sein Vorzeichen um: $|${inside}| = -(${inside})$.`),
  });
  if (x2) {
    frames.push({ math: `-(${inside}) = ${lin(w, d, v)}`, note: tx("Write the bracket with the minus in front.", "Schreib die Klammer mit dem Minus davor.") });
    frames.push({ math: lineSolve(lin(-u, -b, v), lin(w, d, v), -u - w, d + b, v, x2), note: tx("Minus in front of the bracket: flip both signs. Then solve.", "Minus vor der Klammer: Beide Vorzeichen drehen. Dann lösen.") });
    frames.push({
      math: ok2 ? `\\green{${v} = ${qshow(x2)} < ${B}}` : `\\red{${v} = ${qshow(x2)} \\ge ${B}}`,
      note: ok2
        ? tx(`$${qshow(x2)}$ fits the condition $${v} < ${B}$. A solution!`, `$${qshow(x2)}$ erfüllt die Bedingung $${v} < ${B}$. Eine Lösung!`)
        : tx(`$${qshow(x2)}$ is **not** $< ${B}$. It doesn't fit case 2, so it's no solution.`, `$${qshow(x2)}$ ist **nicht** $< ${B}$. Es passt nicht zum 2. Fall, ist also keine Lösung.`),
    });
  }
  frames.push({
    math: setOf(values),
    note: values.length
      ? tx("Collect the solutions that fit their case.", "Sammle die Lösungen, die zu ihrem Fall passen.")
      : tx("Neither case gives a solution that fits.", "Keiner der Fälle liefert eine passende Lösung."),
  });
  return frames;
}

export function absCasesMistakes(t: AbsCases, v = "x"): Mistake[] {
  const { u, b, w, d } = t;
  const { x1, x2, ok1, ok2, values } = absCasesSolve(t);
  const out = bag(values, v);
  const n = (q: Frac | null) => (q ? qvalue(q) : NaN);
  if (x1 && x2 && (!ok1 || !ok2)) {
    const bad = !ok1 ? x1 : x2;
    out.push(
      [n(x1), n(x2)],
      tx("A solution that doesn't fit its case", "Eine Lösung passt nicht zu ihrem Fall"),
      tx(
        `Nearly! $${v} = ${qshow(bad)}$ came out of a case whose condition it breaks. Check each result against its case, or put it into the original equation.`,
        `Fast! $${v} = ${qshow(bad)}$ kommt aus einem Fall, dessen Bedingung es verletzt. Prüf jedes Ergebnis an seinem Fall oder setz es in die ursprüngliche Gleichung ein.`,
      ),
      true,
    );
  }
  if (x1 && ok1 && ok2)
    out.push(
      [n(x1)],
      tx("Only case 1", "Nur der 1. Fall"),
      tx(`Good, $${v} = ${qshow(x1)}$ works! But case 2, where the inside is negative, gives a second solution.`, `Gut, $${v} = ${qshow(x1)}$ passt! Aber der 2. Fall, in dem das Innere negativ ist, liefert eine zweite Lösung.`),
      true,
    );
  // −(ux + b) written as −ux + b.
  if (u + w !== 0) {
    const wrong = frac(d - b, -u - w);
    const vals = [...(ok1 && x1 ? [n(x1)] : []), qvalue(wrong)];
    out.push(
      vals,
      tx("Minus only on the first term", "Minus nur beim ersten Term"),
      tx(
        `Careful in case 2: $-(${lin(u, b, v)}) = ${lin(-u, -b, v)}$. The minus flips **both** signs in the bracket.`,
        `Vorsicht im 2. Fall: $-(${lin(u, b, v)}) = ${lin(-u, -b, v)}$. Das Minus dreht **beide** Vorzeichen in der Klammer um.`,
      ),
    );
  }
  return out.out;
}

// ---------------------------------------------------------------------------
// |x − a| < r and friends: an interval, or everything outside it.

export type AbsIneq = { a: number; r: number; rel: "<" | "≤" | ">" | "≥" };
const RT: Record<AbsIneq["rel"], string> = { "<": "<", "≤": "\\le", ">": ">", "≥": "\\ge" };

export const absIneqSrc = ({ a, r, rel }: AbsIneq, v = "x") => `|${lin(1, -a, v)}| ${RT[rel]} ${r}`;

/** The set inside the braces: "−1 < x < 5" or "x < −1 or x > 5". */
export function absIneqSet(lo: number, hi: number, rel: AbsIneq["rel"], v = "x"): Text {
  const inner = rel === "<" || rel === "≤";
  const r = RT[rel];
  const flip = rel === ">" ? "<" : "\\le";
  return txMap((t, l) =>
    inner
      ? `L = \\{ ${v} \\,|\\, ${decTex(lo, l)} ${r} ${v} ${r} ${decTex(hi, l)} \\}`
      : `L = \\{ ${v} \\,|\\, ${v} ${flip} ${decTex(lo, l)} \\; ${t('"or"', '"oder"')} \\; ${v} ${r} ${decTex(hi, l)} \\}`,
  );
}

export function absIneqFrames(t: AbsIneq, v = "x"): Frame[] {
  const { a, r, rel } = t;
  const inner = rel === "<" || rel === "≤";
  const R = RT[rel];
  const inside = lin(1, -a, v);
  const lo = a - r;
  const hi = a + r;
  const shift = a === 0 ? null : a > 0 ? tx(`Add $${a}$ everywhere.`, `Addiere überall $${a}$.`) : tx(`Subtract $${-a}$ everywhere.`, `Subtrahiere überall $${-a}$.`);
  const close = rel === "≤" || rel === "≥";
  const frames: Frame[] = [
    {
      math: absIneqSrc(t, v),
      note: inner
        ? tx(
            `All $${v}$ whose distance from $${a}$ is ${rel === "<" ? "less than" : "at most"} $${r}$.`,
            `Alle $${v}$, deren Abstand von $${a}$ ${rel === "<" ? "kleiner als" : "höchstens"} $${r}$ ist.`,
          )
        : tx(
            `All $${v}$ whose distance from $${a}$ is ${rel === ">" ? "more than" : "at least"} $${r}$.`,
            `Alle $${v}$, deren Abstand von $${a}$ ${rel === ">" ? "größer als" : "mindestens"} $${r}$ ist.`,
          ),
    },
    inner
      ? { math: `-${r} ${R} ${inside} ${R} ${r}`, note: tx(`So the inside lies between $-${r}$ and $${r}$.`, `Also liegt das Innere zwischen $-${r}$ und $${r}$.`) }
      : {
          math: withOr((or) => `${inside} ${rel === ">" ? "<" : "\\le"} -${r} ${or} ${inside} ${R} ${r}`),
          note: tx(`So the inside is below $-${r}$ or above $${r}$.`, `Also liegt das Innere unter $-${r}$ oder über $${r}$.`),
        },
  ];
  if (shift)
    frames.push(
      inner
        ? { math: `${lo} ${R} ${v} ${R} ${hi}`, note: shift }
        : { math: withOr((or) => `${v} ${rel === ">" ? "<" : "\\le"} ${lo} ${or} ${v} ${R} ${hi}`), note: shift },
    );
  frames.push({
    math: absIneqSet(lo, hi, rel, v),
    note: inner
      ? tx(
          `On the number line: the stretch from $${lo}$ to $${hi}$, ends ${close ? "included" : "left out"}.`,
          `An der Zahlengeraden: die Strecke von $${lo}$ bis $${hi}$, Enden ${close ? "eingeschlossen" : "ausgeschlossen"}.`,
        )
      : tx(
          `On the number line: everything outside $${lo}$ and $${hi}$, ends ${close ? "included" : "left out"}.`,
          `An der Zahlengeraden: alles außerhalb von $${lo}$ und $${hi}$, Enden ${close ? "eingeschlossen" : "ausgeschlossen"}.`,
        ),
  });
  return frames;
}

// ---------------------------------------------------------------------------
// Root equations √(ux + a) = x − b: square, solve the quadratic, check (Probe).

export type RootQuad = { u: number; a: number; b: number };

const rootLhs = ({ u, a }: { u: number; a: number }, v = "x") => `\\sqrt{${lin(u, a, v)}}`;
export const rootQuadSrc = (t: RootQuad, v = "x") => `${rootLhs(t, v)} = ${lin(1, -t.b, v)}`;

/** The candidates from squaring, and which of them really solve the equation. */
export function rootQuadSolve({ u, a, b }: RootQuad) {
  // ux + a = (x − b)²  ⇔  x² − (2b + u)x + (b² − a) = 0
  const p = -(2 * b + u);
  const q = b * b - a;
  const D = (p * p) / 4 - q;
  if (D < 0) return { p, q, cands: [] as number[], good: [] as number[] };
  const r = Math.sqrt(D);
  const cands = D === 0 ? [-p / 2] : [-p / 2 + r, -p / 2 - r];
  const good = cands.filter((x) => x - b >= 0 && u * x + a >= 0);
  return { p, q, cands, good };
}

const numSrc = (x: number) => (Number.isInteger(x) ? String(x) : qshow(frac(Math.round(x * 2), 2)));

/** The check of one candidate in the original equation. */
function rootCheck({ u, a, b }: RootQuad, x: number, v: string): Frame {
  const rad = u * x + a;
  const left = Math.sqrt(rad);
  const right = x - b;
  const ok = Math.abs(left - right) < 1e-9;
  const inside = `${u === 1 ? x : `${u} \\cdot ${par(x)}`}${a === 0 ? "" : ` ${a > 0 ? "+" : "-"} ${Math.abs(a)}`}`;
  const rhs = b === 0 ? String(x) : `${x} ${b > 0 ? "-" : "+"} ${Math.abs(b)}`;
  const line = b === 0 ? `\\sqrt{${inside}} = ${left} ${ok ? "=" : "\\ne"} ${x}` : `\\sqrt{${inside}} = ${left} \\quad ${rhs} = ${right}`;
  return {
    math: ok ? `\\green{${line}}` : `\\red{${line}}`,
    note: ok
      ? tx(`Check $${v} = ${x}$: both sides give $${left}$. A real solution!`, `Probe für $${v} = ${x}$: Beide Seiten ergeben $${left}$. Eine echte Lösung!`)
      : tx(
          `Check $${v} = ${x}$: the root gives $${left}$, the right side $${right}$. Not equal: a **false solution** that only came in through squaring.`,
          `Probe für $${v} = ${x}$: Die Wurzel ergibt $${left}$, die rechte Seite $${right}$. Nicht gleich: eine **Scheinlösung**, die erst durchs Quadrieren dazukam.`,
        ),
  };
}

export function rootQuadFrames(t: RootQuad, v = "x", opts: { isolate?: number } = {}): Frame[] {
  const { u, a, b } = t;
  const { p, q, cands, good } = rootQuadSolve(t);
  const frames: Frame[] = [];
  const minX = qshow(frac(-a, u));
  if (opts.isolate !== undefined) {
    const c = opts.isolate;
    frames.push({
      math: `${rootLhs(t, v)} ${c > 0 ? "+" : "-"} ${Math.abs(c)} = ${v} \\quad | \\, ${c > 0 ? "-" : "+"}${Math.abs(c)}`,
      note: tx("First get the root on its own.", "Bring zuerst die Wurzel allein auf eine Seite."),
    });
  }
  frames.push({
    math: `${rootQuadSrc(t, v)} \\quad | \\, (\\;)^2`,
    note: tx(
      `Under the root must not be negative: $${lin(u, a, v)} \\ge 0$, so $${v} \\ge ${minX}$. To undo the root, square both sides.`,
      `Unter der Wurzel darf nichts Negatives stehen: $${lin(u, a, v)} \\ge 0$, also $${v} \\ge ${minX}$. Um die Wurzel aufzuheben, quadrierst du beide Seiten.`,
    ),
  });
  const rhs = b === 0 ? `${v}^2` : `(${lin(1, -b, v)})^2`;
  frames.push({ math: `${lin(u, a, v)} = ${rhs}`, note: tx("The root is gone. The right side is squared **as a whole**.", "Die Wurzel ist weg. Die rechte Seite wird **als Ganzes** quadriert.") });
  if (b !== 0)
    frames.push({
      math: `${lin(u, a, v)} = ${v}^2 ${-2 * b > 0 ? "+" : "-"} ${Math.abs(2 * b) === 1 ? "" : Math.abs(2 * b)}${v} + ${b * b}`,
      note: tx(`Binomial formula: $(${lin(1, -b, v)})^2 = ${v}^2 ${-2 * b > 0 ? "+" : "-"} ${Math.abs(2 * b)}${v} + ${b * b}$.`, `Binomische Formel: $(${lin(1, -b, v)})^2 = ${v}^2 ${-2 * b > 0 ? "+" : "-"} ${Math.abs(2 * b)}${v} + ${b * b}$.`),
    });
  const normal = `0 = ${v}^2${p === 0 ? "" : ` ${p > 0 ? "+" : "-"} ${Math.abs(p) === 1 ? "" : Math.abs(p)}${v}`}${q === 0 ? "" : ` ${q > 0 ? "+" : "-"} ${Math.abs(q)}`}`;
  frames.push({ math: normal, note: tx("Bring everything to one side: the normal form.", "Bring alles auf eine Seite: die Normalform.") });
  if (q === 0) {
    frames.push({
      math: withOr((or) => `0 = ${v}(${lin(1, p, v)}) \\;\\Rightarrow\\; ${v} = 0 ${or} ${v} = ${-p}`),
      note: tx(`No constant term: factor out $${v}$. A product is $0$ when one factor is $0$.`, `Kein Absolutglied: Klammere $${v}$ aus. Ein Produkt ist $0$, wenn ein Faktor $0$ ist.`),
    });
  } else if (cands.length) {
    const half = frac(-p, 2);
    const sq = frac(p * p, 4);
    frames.push({
      math: `${v}_{1,2} = ${qshow(half)} \\pm \\sqrt{${qshow(sq)} ${q > 0 ? "-" : "+"} ${Math.abs(q)}}`,
      note: tx(`pq formula with $p = ${p}$ and $q = ${q}$.`, `pq-Formel mit $p = ${p}$ und $q = ${q}$.`),
    });
    const D = frac(p * p - 4 * q, 4);
    const rootD = Math.sqrt(qvalue(D));
    frames.push({
      math: `${v}_{1,2} = ${qshow(half)} \\pm ${numSrc(rootD)}`,
      note: tx(`$${qshow(sq)} ${q > 0 ? "-" : "+"} ${Math.abs(q)} = ${qshow(D)}$, and its root is $${numSrc(rootD)}$.`, `$${qshow(sq)} ${q > 0 ? "-" : "+"} ${Math.abs(q)} = ${qshow(D)}$, und die Wurzel daraus ist $${numSrc(rootD)}$.`),
    });
    frames.push({
      math: cands.length === 2 ? `${v}_1 = ${cands[0]} \\quad ${v}_2 = ${cands[1]}` : `${v} = ${cands[0]}`,
      note: tx("Two candidates. Now the important part: the check!", "Zwei Kandidaten. Jetzt kommt das Wichtigste: die Probe!"),
    });
  }
  for (const x of cands) frames.push(rootCheck(t, x, v));
  frames.push({
    math: setOf(good),
    note: good.length === cands.length ? tx("Both candidates pass the check.", "Beide Kandidaten bestehen die Probe.") : tx("Only what passes the check goes into $L$.", "In $L$ kommt nur, was die Probe besteht."),
  });
  return frames;
}

export function rootQuadMistakes(t: RootQuad, v = "x"): Mistake[] {
  const { cands, good } = rootQuadSolve(t);
  const out = bag(good, v);
  const bad = cands.filter((x) => !good.includes(x));
  if (bad.length) {
    const x = bad[0];
    const left = Math.sqrt(t.u * x + t.a);
    out.push(
      cands,
      tx("False solution kept", "Scheinlösung behalten"),
      tx(
        `So close! Squaring brought in an extra candidate. Check $${v} = ${x}$: the root gives $${left}$, but the right side is $${x - t.b}$. A root is never negative, so it's a false solution.`,
        `Ganz knapp! Durchs Quadrieren ist ein Kandidat dazugekommen. Probe für $${v} = ${x}$: Die Wurzel ergibt $${left}$, die rechte Seite aber $${x - t.b}$. Eine Wurzel ist nie negativ, also ist das eine Scheinlösung.`,
      ),
      true,
    );
    out.push(
      bad,
      tx("The wrong one kept", "Die falsche behalten"),
      tx(
        `Other way round! Put $${v} = ${x}$ into the original equation: $${left} \\ne ${x - t.b}$. The other candidate is the one that works.`,
        `Genau andersherum! Setz $${v} = ${x}$ in die ursprüngliche Gleichung ein: $${left} \\ne ${x - t.b}$. Der andere Kandidat ist der, der passt.`,
      ),
    );
  }
  // (x − b)² taken as x² − b² or x² + b².
  if (t.b !== 0) {
    for (const sq of [-1, 1]) {
      // ux + a = x² + sq·b²  ⇔  x² − ux + (sq·b² − a) = 0
      const P = -t.u;
      const Q = sq * t.b * t.b - t.a;
      const D = (P * P) / 4 - Q;
      if (D < 0) continue;
      const r = Math.sqrt(D);
      const roots = [...new Set([-P / 2 + r, -P / 2 - r])].filter((x) => Number.isInteger(x));
      if (roots.length === 0) continue;
      out.push(
        roots,
        tx("Binomial formula forgotten", "Binomische Formel vergessen"),
        tx(
          `Careful: $(${lin(1, -t.b, v)})^2$ is **not** $${v}^2 ${sq < 0 ? "-" : "+"} ${t.b * t.b}$. Use the binomial formula, the middle term $${-2 * t.b}${v}$ is missing.`,
          `Vorsicht: $(${lin(1, -t.b, v)})^2$ ist **nicht** $${v}^2 ${sq < 0 ? "-" : "+"} ${t.b * t.b}$. Nimm die binomische Formel, der Mittelterm $${-2 * t.b}${v}$ fehlt.`,
        ),
      );
    }
  }
  return out.out;
}

// ---------------------------------------------------------------------------
// √(ux + a) = c and √(ux + a) = √(wx + d): one squaring gives a linear equation.

export type RootLin = { u: number; a: number; c: number };

export const rootLinSrc = ({ u, a, c }: RootLin, v = "x") => `\\sqrt{${lin(u, a, v)}} = ${c}`;
export const rootLinSolve = ({ u, a, c }: RootLin) => (c < 0 ? [] : [(c * c - a) / u]);

export function rootLinFrames(t: RootLin, v = "x"): Frame[] {
  const { u, a, c } = t;
  if (c < 0)
    return [
      { math: rootLinSrc(t, v), note: tx(`A square root is never negative, so it can't be $${c}$.`, `Eine Quadratwurzel ist nie negativ, kann also nicht $${c}$ sein.`) },
      { math: "L = \\{ \\}", note: tx("No solution, no calculation needed.", "Keine Lösung, ohne jede Rechnung.") },
    ];
  const x = (c * c - a) / u;
  return [
    { math: `${rootLinSrc(t, v)} \\quad | \\, (\\;)^2`, note: tx("Square both sides to undo the root.", "Quadriere beide Seiten, um die Wurzel aufzuheben.") },
    { math: `${lin(u, a, v)} = ${c * c}`, note: tx(`$${c}^2 = ${c * c}$.`, `$${c}^2 = ${c * c}$.`) },
    {
      math: u === 1 ? `${v} = ${x}` : `${u}${v} = ${c * c - a} \\;\\Rightarrow\\; ${v} = ${x}`,
      note: tx("Solve the linear equation.", "Löse die lineare Gleichung."),
    },
    {
      math: `\\green{\\sqrt{${u === 1 ? x : `${u} \\cdot ${par(x)}`} ${a >= 0 ? "+" : "-"} ${Math.abs(a)}} = \\sqrt{${c * c}} = ${c}}`,
      note: tx(`Check: $${v} = ${x}$ gives $\\sqrt{${c * c}} = ${c}$. It works!`, `Probe: $${v} = ${x}$ ergibt $\\sqrt{${c * c}} = ${c}$. Passt!`),
    },
    { math: setOf([x]), note: tx("The check works, so that's the solution.", "Die Probe passt, also ist das die Lösung.") },
  ];
}

export function rootLinMistakes(t: RootLin, v = "x"): Mistake[] {
  const { u, a, c } = t;
  const out = bag(rootLinSolve(t), v);
  if (c < 0) {
    out.push(
      [(c * c - a) / u],
      tx("Check missing", "Probe vergessen"),
      tx(
        `Squaring made the $${c}$ positive, so you got a number. But put it back in: the root gives $${-c}$, not $${c}$. A root is never negative: no solution.`,
        `Durchs Quadrieren wurde die $${c}$ positiv, deshalb kam eine Zahl heraus. Aber setz sie ein: Die Wurzel ergibt $${-c}$, nicht $${c}$. Eine Wurzel ist nie negativ: keine Lösung.`,
      ),
    );
    return out.out;
  }
  out.push(
    [(c - a) / u],
    tx("Not squared", "Nicht quadriert"),
    tx(`Nearly! The root goes away by **squaring**, so the right side becomes $${c}^2 = ${c * c}$, not $${c}$.`, `Fast! Die Wurzel verschwindet durch **Quadrieren**, rechts steht dann $${c}^2 = ${c * c}$, nicht $${c}$.`),
  );
  out.push(
    [(2 * c - a) / u],
    tx("Squared means times itself", "Quadrieren heißt mal sich selbst"),
    tx(`Careful: $${c}^2 = ${c} \\cdot ${c} = ${c * c}$, not $${c} \\cdot 2$.`, `Vorsicht: $${c}^2 = ${c} \\cdot ${c} = ${c * c}$, nicht $${c} \\cdot 2$.`),
  );
  return out.out;
}

export type RootRoot = { u: number; a: number; w: number; d: number };

export const rootRootSrc = ({ u, a, w, d }: RootRoot, v = "x") => `\\sqrt{${lin(u, a, v)}} = \\sqrt{${lin(w, d, v)}}`;
export function rootRootSolve({ u, a, w, d }: RootRoot) {
  const x = (d - a) / (u - w);
  return { x, ok: u * x + a >= 0 && w * x + d >= 0 };
}

export function rootRootFrames(t: RootRoot, v = "x"): Frame[] {
  const { u, a, w, d } = t;
  const { x, ok } = rootRootSolve(t);
  const l = u * x + a;
  const r = w * x + d;
  const ins = (k: number, c: number) => `${k === 1 ? x : `${k} \\cdot ${par(x)}`}${c === 0 ? "" : ` ${c > 0 ? "+" : "-"} ${Math.abs(c)}`}`;
  return [
    { math: `${rootRootSrc(t, v)} \\quad | \\, (\\;)^2`, note: tx("Square both sides: both roots disappear.", "Quadriere beide Seiten: Beide Wurzeln verschwinden.") },
    { math: `${lin(u, a, v)} = ${lin(w, d, v)}`, note: tx("A linear equation.", "Eine lineare Gleichung.") },
    { math: `${lin(u - w, 0, v)} = ${d - a}${u - w === 1 ? "" : ` \\;\\Rightarrow\\; ${v} = ${x}`}`, note: tx("Solve it as usual.", "Löse sie wie gewohnt.") },
    ok
      ? {
          math: `\\green{\\sqrt{${ins(u, a)}} = \\sqrt{${l}} \\quad \\sqrt{${ins(w, d)}} = \\sqrt{${r}}}`,
          note: tx(`Check: both radicands are $${l}$, not negative. It works!`, `Probe: Beide Radikanden sind $${l}$, also nicht negativ. Passt!`),
        }
      : {
          math: `\\red{\\sqrt{${ins(u, a)}} = \\sqrt{${l}}}`,
          note: tx(
            `Check: under the root you'd get $${l}$, a negative number. That root doesn't exist, so $${v} = ${x}$ is a false solution.`,
            `Probe: Unter der Wurzel stünde $${l}$, eine negative Zahl. Diese Wurzel gibt es nicht, also ist $${v} = ${x}$ eine Scheinlösung.`,
          ),
        },
    { math: ok ? setOf([x]) : "L = \\{ \\}", note: ok ? tx("One solution.", "Eine Lösung.") : tx("No solution.", "Keine Lösung.") },
  ];
}

export function rootRootMistakes(t: RootRoot, v = "x"): Mistake[] {
  const { x, ok } = rootRootSolve(t);
  const out = bag(ok ? [x] : [], v);
  if (!ok) {
    out.push(
      [x],
      tx("Check missing", "Probe vergessen"),
      tx(
        `The calculation is right, but do the check: for $${v} = ${x}$ the number under the root is negative. Such a root doesn't exist, so it's a false solution.`,
        `Die Rechnung stimmt, aber mach die Probe: Für $${v} = ${x}$ steht unter der Wurzel eine negative Zahl. Diese Wurzel gibt es nicht, also ist es eine Scheinlösung.`,
      ),
      true,
    );
  }
  return out.out;
}

