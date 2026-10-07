import { tx, type Text } from "@/i18n/text";
import type { Frame } from "@/learn/types";
import { mathN, sayN } from "./kit";
import { bar } from "./sys";

// Quadratic equations for level 3: polynomials with stable keys, the way to the normal form,
// the pq formula, and the check which solution makes sense.

type Fmt = (v: number) => string;

/** A·v² + B·v + C with keys: x² term "a", x term "b", number "c". */
export function polySrc(A: number, B: number, C: number, n: Fmt, v = "x"): string {
  const out: string[] = [];
  const term = (c: number, pow: number, id: string) => {
    if (c === 0) return;
    const first = out.length === 0;
    const sign = c < 0 ? `-#s${id} ` : first ? "" : `+#s${id} `;
    const a = Math.abs(c);
    const coef = pow > 0 && a === 1 ? "" : `${n(a)}#c${id}${pow > 0 ? " " : ""}`;
    const body = pow === 2 ? `${v}#v${id}^{2#e${id}}` : pow === 1 ? `${v}#v${id}` : "";
    out.push(`${sign}${coef}${body}`);
  };
  term(A, 2, "a");
  term(B, 1, "b");
  term(C, 0, "c");
  return out.length ? out.join(" ") : "0";
}

/** The same without keys (for notes). */
export const polyPlain = (A: number, B: number, C: number, n: Fmt, v = "x") => polySrc(A, B, C, n, v).replace(/#[A-Za-z0-9_]+/g, "");

/** Exact enough: 0.1 + 0.2 = 0.3. */
const clean = (v: number) => Math.round(v * 1e6) / 1e6;

/**
 * From A·v² + B·v + C = R to the normal form v² + pv + q = 0: take R over, divide by A.
 * The first frame shows the equation as it is (with the step that follows).
 */
export function normalFrames(A: number, B: number, C: number, R: number, v = "x"): { frames: Frame[]; p: number; q: number } {
  const frames: Frame[] = [];
  const C0 = clean(C - R);
  const p = clean(B / A);
  const q = clean(C0 / A);
  if (R !== 0) {
    frames.push({
      math: mathN((n) => `${polySrc(A, B, C, n, v)} =#eq ${n(R)}#r${bar(R > 0 ? `- ${n(R)}` : `+ ${n(-R)}`)}`),
      note: tx("Bring everything to one side, so that the right side is 0.", "Bring alles auf eine Seite, damit rechts 0 steht."),
    });
  }
  if (A !== 1) {
    frames.push({
      math: mathN((n) => `${polySrc(A, B, C0, n, v)} =#eq 0#r${bar(`: ${A < 0 ? `(${n(A)})` : n(A)}`)}`),
      note: sayN(({ n }) => [
        `For the pq formula, $${v}^2$ must stand alone: divide **every** term by ${A < 0 ? `$(${n(A)})$` : n(A)}.`,
        `Für die pq-Formel muss $${v}^2$ allein stehen: Teile **jeden** Term durch ${A < 0 ? `$(${n(A)})$` : n(A)}.`,
      ]),
    });
  }
  frames.push({
    math: mathN((n) => `${polySrc(1, p, q, n, v)} =#eq 0#r`),
    note: sayN(({ n }) => [`Normal form with $p = ${n(p)}$ and $q = ${n(q)}$.`, `Normalform mit $p = ${n(p)}$ und $q = ${n(q)}$.`]),
  });
  return { frames, p, q };
}

/** The pq formula with numbers, down to v₁ and v₂ (assumes two solutions). */
export function pqFrames(p: number, q: number, v = "x"): { frames: Frame[]; roots: [number, number] } {
  const h = clean(p / 2);
  const D = clean(h * h - q);
  const r = clean(Math.sqrt(D));
  const x1 = clean(-h + r);
  const x2 = clean(-h - r);
  const lead = `${v}_{1,2}#L =#eq`;
  const minusH = (n: Fmt) => (h > 0 ? `-#mh ${n(h)}#h` : h < 0 ? `${n(-h)}#h` : "");
  const hSq = (n: Fmt) => (h < 0 ? `(${n(h)})#hb^{2#e2}` : `${n(h)}#hs^{2#e2}`);
  const minusQ = (n: Fmt) => (q < 0 ? `+#mq ${n(-q)}#q` : `-#mq ${n(q)}#q`);
  const frames: Frame[] = [
    {
      math: mathN((n) => `${lead} ${minusH(n)} \\pm#pm \\sqrt{${h === 0 ? "" : `${hSq(n)} `}${minusQ(n)}}#R`),
      note: sayN(({ n }) => [
        `pq formula: $${v}_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$ with $\\frac{p}{2} = ${n(h)}$.`,
        `pq-Formel: $${v}_{1,2} = -\\frac{p}{2} \\pm \\sqrt{(\\frac{p}{2})^2 - q}$ mit $\\frac{p}{2} = ${n(h)}$.`,
      ]),
    },
    {
      math: mathN((n) => `${lead} ${minusH(n)} \\pm#pm \\sqrt{${n(D)}#D}#R`),
      note: sayN(({ n }) => [
        `Under the root: ${h === 0 ? "" : `$${h < 0 ? `(${n(h)})` : n(h)}^2 = ${n(h * h)}$, and `}$${n(h * h)} ${q < 0 ? "+" : "-"} ${n(Math.abs(q))} = ${n(D)}$.`,
        `Unter der Wurzel: ${h === 0 ? "" : `$${h < 0 ? `(${n(h)})` : n(h)}^2 = ${n(h * h)}$, und `}$${n(h * h)} ${q < 0 ? "+" : "-"} ${n(Math.abs(q))} = ${n(D)}$.`,
      ]),
    },
    {
      math: mathN((n) => `${lead} ${minusH(n)} \\pm#pm ${n(r)}#rt`),
      note: sayN(({ n }) => [`$\\sqrt{${n(D)}} = ${n(r)}$`, `$\\sqrt{${n(D)}} = ${n(r)}$`]),
    },
    {
      math: mathN((n) => `${v}_1#x1 =#eq1 ${n(x1)}#v1 \\quad ${v}_2#x2 =#eq2 ${n(x2)}#v2`),
      highlight: ["x1", "eq1", "v1", "x2", "eq2", "v2"],
      note: sayN(({ n }) => [
        `Plus: $${n(-h)} + ${n(r)} = ${n(x1)}$. Minus: $${n(-h)} - ${n(r)} = ${n(x2)}$. Two solutions!`,
        `Plus: $${n(-h)} + ${n(r)} = ${n(x1)}$. Minus: $${n(-h)} - ${n(r)} = ${n(x2)}$. Zwei Lösungen!`,
      ]),
    },
  ];
  return { frames, roots: [x1, x2] };
}

/** v₁ and v₂ with the ones that make no sense struck out. */
export function senseFrame(roots: [number, number], sense: [boolean, boolean], note: Text, v = "x"): Frame {
  const one = (i: 0 | 1, n: Fmt) => {
    const src = `${v}_${i + 1}#x${i + 1} =#eq${i + 1} ${n(roots[i])}#v${i + 1}`;
    return sense[i] ? `\\green{${src}}` : `\\strike{${src}}`;
  };
  return { math: mathN((n) => `${one(0, n)} \\quad ${one(1, n)}`), note };
}
