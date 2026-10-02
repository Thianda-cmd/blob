"use client";

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { topicMeta } from "@/learn/catalog";
import type { Rng } from "@/learn/engine/rng";
import { plainPoly, polyMul, type Poly } from "@/learn/engine/terms";
import type { Exercise, Frame, Level, Topic } from "@/learn/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Products of brackets as monomials (c·vᵖ), with stable token keys so each
// factor visibly travels into the products.

type Mono = { c: number; p: number };
type Factor = Mono[];

const m = (c: number, p = 0): Mono => ({ c, p });

/** Key names: sign s, coefficient c, variable v, exponent e, prefixed by an id. */
function mono(x: Mono, v: string, id: string, first: boolean, keys = true): string {
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
function productSrc(a: Factor, b: Factor, v: string, keys = true, square = false): string {
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

function toPoly(f: Factor): Poly {
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

function resultPoly(a: Factor, b: Factor): Poly {
  return polyMul(toPoly(a), toPoly(b));
}

// ---------------------------------------------------------------------------
// Exercise generator

const VARS = ["x", "x", "x", "a", "y", "b"];

const EXPAND = tx("Expand", "Multipliziere aus");
const EXPAND_SIMPLIFY = tx("Expand and simplify", "Multipliziere aus und fasse zusammen");

function make(a: Factor, b: Factor, v: string, hint: Text, square = false): Exercise {
  const p = resultPoly(a, b);
  return {
    instruction: EXPAND_SIMPLIFY,
    math: productSrc(a, b, v, false, square),
    answer: { kind: "expr", value: plainPoly(p, v), form: "simplified" },
    hint,
    solution: expandFrames(a, b, v, { square }),
  };
}

function generate(level: Level, rng: Rng): Exercise {
  const v = rng.pick(VARS);
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

const BINOMIAL_EN = "$(a + b)^2 = a^2 + 2ab + b^2$\n\n$(a - b)^2 = a^2 - 2ab + b^2$\n\n$(a + b)(a - b) = a^2 - b^2$";
const BINOMIAL_DE =
  "**1. binomische Formel:** $(a + b)^2 = a^2 + 2ab + b^2$\n\n**2. binomische Formel:** $(a - b)^2 = a^2 - 2ab + b^2$\n\n**3. binomische Formel:** $(a + b)(a - b) = a^2 - b^2$";

const expanding: Topic = {
  ...topicMeta("expanding"),
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
      body: tx("Shortcuts worth knowing by heart (die binomischen Formeln).", "Abkürzungen, die du auswendig können solltest: die 1., 2. und 3. binomische Formel."),
      examples: ["(a + b)^2 = a^2 + 2ab + b^2", "(a - b)^2 = a^2 - 2ab + b^2", "(a + b)(a - b) = a^2 - b^2"],
      tone: "tip",
    },
    {
      title: tx("Classic mistake", "Typischer Fehler"),
      body: tx("The middle term doesn't disappear when you square a sum.", "Wenn du eine Summe quadrierst, verschwindet der mittlere Term nicht."),
      examples: ["(a + b)^2 \\ne a^2 + b^2"],
      tone: "warning",
    },
  ],
  lesson: [
    {
      type: "explain",
      title: tx("A factor in front of a bracket", "Ein Faktor vor der Klammer"),
      blob: tx("Ausmultiplizieren means: the number in front visits everyone inside!", "Ausmultiplizieren heißt: Die Zahl davor besucht jeden in der Klammer!"),
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
      },
    },
  ],
  generate,
};

export default expanding;
