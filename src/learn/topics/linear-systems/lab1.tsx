"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, Shuffle } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { Graph, type GraphProps } from "@/learn/visuals/Graph";
import { Plane, PlaneDot, PlaneHandle, PlaneLine, PlaneTag, StepSlider, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { plain, pt, side } from "../lines/level2";

// ---------------------------------------------------------------------------
// Pictures and widgets for level 1: a pair tester on the grid, a table of values
// that fills in step by step, and a plain table for tasks.

/** A linear equation, either a·x + b·y = c or y = m·x + n. */
export type Eq1 = { kind: "std"; a: number; b: number; c: number } | { kind: "y"; m: number; n: number };

/** The equation in the display language. */
export function eqSrc(e: Eq1): string {
  if (e.kind === "y") {
    // "y = 12 − 2x" reads better than "y = −2x + 12" when the slope is negative.
    const list: [number, string, string][] =
      e.m < 0 && e.n > 0
        ? [
            [e.n, "", "n"],
            [e.m, "x", "m"],
          ]
        : [
            [e.m, "x", "m"],
            [e.n, "", "n"],
          ];
    return plain(`y = ${side(list)}`);
  }
  const list: [number, string, string][] =
    e.a < 0 && e.b > 0
      ? [
          [e.b, "y", "b"],
          [e.a, "x", "a"],
        ]
      : [
          [e.a, "x", "a"],
          [e.b, "y", "b"],
        ];
  return plain(`${side(list)} = ${e.c}`);
}

/** Both sides of the equation for the pair p. */
export function sidesAt(e: Eq1, p: Pt): [number, number] {
  return e.kind === "y" ? [p[1], e.m * p[0] + e.n] : [e.a * p[0] + e.b * p[1], e.c];
}
export const fits = (e: Eq1, p: Pt) => {
  const [l, r] = sidesAt(e, p);
  return l === r;
};

/** "c · (v)" as one term of a sum, negative numbers in brackets. */
function product(c: number, v: number, first: boolean): string {
  const sign = c < 0 ? "- " : first ? "" : "+ ";
  const a = Math.abs(c);
  const value = v < 0 ? `(${v})` : `${v}`;
  return `${sign}${a === 1 ? value : `${a} \\cdot ${value}`}`;
}

/** The right side m·x + n of y = m·x + n with a number put in for x. */
export function rightAt(m: number, n: number, x: number): string {
  return m < 0 && n > 0 ? `${n} ${product(m, x, false)}` : `${product(m, x, true)}${n ? ` ${n > 0 ? "+" : "-"} ${Math.abs(n)}` : ""}`;
}

/** The equation with the numbers of p put in, and = or ≠ between the sides. */
export function filledSrc(e: Eq1, p: Pt): string {
  const ok = fits(e, p);
  const rel = ok ? "=" : "\\ne";
  if (e.kind === "y") return `${p[1]} ${rel} ${rightAt(e.m, e.n, p[0])}`;
  const left = e.a < 0 && e.b > 0 ? `${product(e.b, p[1], true)} ${product(e.a, p[0], false)}` : `${product(e.a, p[0], true)} ${product(e.b, p[1], false)}`;
  return `${left} ${rel} ${e.c}`;
}

/** A point on the line and its direction (for drawing it). */
function lineOf(e: Eq1): [Pt, Pt] {
  if (e.kind === "y") return [[0, e.n], [1, e.m]];
  if (e.b !== 0) return [[0, e.c / e.b], [e.b, -e.a]];
  return [[e.c / e.a, 0], [0, 1]];
}

const Chip = ({ children, tone }: { children: string; tone: "blob" | "ink" }) => (
  <span className={cn("grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-1 font-sans text-[12px] font-bold", tone === "blob" ? "bg-blob text-white" : "bg-ink text-paper")}>{children}</span>
);

// ---------------------------------------------------------------------------
// Pair tester: drag a point; each equation lights up green when the pair fits it.
// Pairs that fit leave a mark, and the marks of one equation line up.

const STD = (a: number, b: number, c: number): Eq1 => ({ kind: "std", a, b, c });
const SOLVED = (m: number, n: number): Eq1 => ({ kind: "y", m, n });
const TESTER: { eqs: [Eq1, Eq1]; start: Pt }[] = [
  { eqs: [STD(1, 1, 8), STD(1, 2, 11)], start: [2, 2] },
  { eqs: [SOLVED(2, 0), STD(1, 1, 9)], start: [1, 5] },
  { eqs: [STD(2, 1, 10), STD(1, -1, 2)], start: [1, 1] },
  { eqs: [SOLVED(1, 2), STD(1, 2, 10)], start: [6, 1] },
];
const RANGE: Pt = [0, 10];
const key = (p: Pt) => `${p[0]},${p[1]}`;
const unkey = (k: string): Pt => k.split(",").map(Number) as Pt;

export function PairTester() {
  const t = useText();
  const scope = useId();
  const [which, setWhich] = useState(0);
  const [P, setP] = useState<Pt>(TESTER[0].start);
  const [touched, setTouched] = useState(false);
  const [found, setFound] = useState<[string[], string[]]>([[], []]);
  const [lines, setLines] = useState(false);
  const px = useSpringTo(P[0]);
  const py = useSpringTo(P[1]);
  const { eqs } = TESTER[which];
  const ok = eqs.map((e) => fits(e, P));
  const both = ok[0] && ok[1];

  function onMove(_: string, p: Pt) {
    setP(p);
    setTouched(true);
    setFound((f) => f.map((list, i) => (fits(eqs[i], p) && !list.includes(key(p)) ? [...list, key(p)] : list)) as [string[], string[]]);
  }

  function nextSystem() {
    const n = (which + 1) % TESTER.length;
    setWhich(n);
    setP(TESTER[n].start);
    setFound([[], []]);
    setLines(false);
    setTouched(false);
  }

  const names = ["I", "II"];
  const tones = ["blob", "ink"] as const;

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-ink-2">
        <Inline
          text={tx(
            "Drag the point $P$ (or use the arrow keys). Each pair $(x | y)$ is put into both equations. **Green** means the equation is true.",
            "Zieh den Punkt $P$ (oder nimm die Pfeiltasten). Jedes Zahlenpaar $(x | y)$ wird in beide Gleichungen eingesetzt. **Grün** heißt: Die Gleichung stimmt.",
          )}
        />
      </p>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[400px] rounded-xl border border-line bg-surface p-2">
          <Plane
            xRange={RANGE}
            yRange={RANGE}
            onMove={onMove}
            label={tx("Grid with the point P", "Koordinatensystem mit dem Punkt P")}
            overlay={
              <PlaneTag at={() => [px.get(), py.get()]} dy={-20} className={both ? "shadow-[0_0_0_1.5px_var(--ok)]" : undefined}>
                <span className="text-ink">
                  <MathView src={pt(P[0], P[1], "P")} size="inline" animate={false} />
                </span>
              </PlaneTag>
            }
          >
            {eqs.map((e, i) => (
              <PlaneLine key={`${which}-${i}`} through={() => lineOf(e)} tone={tones[i]} width={0.8} dashed opacity={lines ? 0.9 : 0} />
            ))}
            {found.map((list, i) =>
              list.map((k) => {
                const q = unkey(k);
                return <PlaneDot key={`${which}-${i}-${k}`} at={() => q} tone={tones[i]} r={i === 0 ? 1.15 : 0.75} />;
              }),
            )}
            {both && <PlaneDot key={`hit-${key(P)}`} at={() => [px.get(), py.get()]} tone="ok" r={2.6} pulse={key(P)} />}
            <PlaneHandle id="P" x={px} y={py} at={P} label={tx("Point P", "Punkt P")} hint={!touched} />
          </Plane>
        </div>

        <div className="space-y-3">
          {eqs.map((e, i) => {
            const [l, r] = sidesAt(e, P);
            return (
              <div key={`${which}-${i}`} className={cn("rounded-xl border px-3.5 py-3 transition-colors", ok[i] ? "border-ok/40 bg-ok/[0.07]" : "border-line bg-surface")}>
                <div className="flex items-center gap-3">
                  <Chip tone={tones[i]}>{names[i]}</Chip>
                  <MathView src={eqSrc(e)} size="md" animate={false} />
                  <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold", ok[i] ? "bg-ok/15 text-ok" : "bg-danger/10 text-danger")}>
                    {ok[i] ? t(tx("true", "stimmt")) : t(tx("false", "stimmt nicht"))}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-9">
                  <MathView src={`\\${ok[i] ? "green" : "red"}{${filledSrc(e, P)}}`} size="md" scope={`${scope}-${i}`} />
                  <span className="text-[12.5px] text-ink-3">{t(tx(`left ${l}, right ${r}`, `links ${l}, rechts ${r}`)).replace(/-/g, "−")}</span>
                </div>
                <div className="mt-1.5 pl-9 text-[12.5px] text-ink-3">
                  {t(
                    found[i].length === 1
                      ? tx("1 fitting pair found so far", "1 passendes Paar gefunden")
                      : tx(`${found[i].length} fitting pairs found so far`, `${found[i].length} passende Paare gefunden`),
                  )}
                </div>
              </div>
            );
          })}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={both ? "yes" : "no"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", both ? "border-ok/35 bg-ok/[0.08] text-ink" : "border-line bg-surface text-ink-2")}
            >
              {both ? (
                <Inline
                  text={tx(
                    `**Got it!** $${pt(P[0], P[1])}$ makes **both** equations true. It is the solution of the system: $L = \\{ ${pt(P[0], P[1])} \\}$.`,
                    `**Treffer!** $${pt(P[0], P[1])}$ erfüllt **beide** Gleichungen. Es ist die Lösung des LGS: $L = \\{ ${pt(P[0], P[1])} \\}$.`,
                  )}
                />
              ) : (
                <Inline
                  text={tx(
                    "Look for the pair that fits **both** equations. Tip: the pairs that fit one equation all lie on a straight line.",
                    "Such das Zahlenpaar, das **beide** Gleichungen erfüllt. Tipp: Die Paare, die zu einer Gleichung passen, liegen alle auf einer Geraden.",
                  )}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setLines((v) => !v)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              {lines ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {t(lines ? tx("Hide the lines", "Geraden ausblenden") : tx("Show all fitting pairs", "Alle passenden Paare zeigen"))}
            </button>
            <button onClick={nextSystem} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
              <Shuffle className="size-3.5" />
              {t(tx("Another system", "Anderes LGS"))}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table of values: step x up, the table fills in, the points appear on a chart,
// and where both rows show the same y the two stories meet.

type Rule = { name: Text; m: number; n: number };
type Story = { tab: Text; text: Text; rules: [Rule, Rule]; xName: Text; yName: Text; xMax: number; yMax: number; yStep: number; meet: Text };

const STORIES: Story[] = [
  {
    tab: tx("Candles", "Kerzen"),
    text: tx(
      "Candle A is 12 cm long and burns 2 cm shorter every hour. Candle B is 8 cm long and burns 1 cm shorter every hour. When are they equally long?",
      "Kerze A ist 12 cm lang und brennt pro Stunde 2 cm ab. Kerze B ist 8 cm lang und brennt pro Stunde 1 cm ab. Wann sind beide gleich lang?",
    ),
    rules: [
      { name: tx("Candle A", "Kerze A"), m: -2, n: 12 },
      { name: tx("Candle B", "Kerze B"), m: -1, n: 8 },
    ],
    xName: tx("hours", "Stunden"),
    yName: tx("length in cm", "Länge in cm"),
    xMax: 6,
    yMax: 12,
    yStep: 2,
    meet: tx("After **4 hours** both candles are **4 cm** long.", "Nach **4 Stunden** sind beide Kerzen **4 cm** lang."),
  },
  {
    tab: tx("Taxi", "Taxi"),
    text: tx(
      "Taxi A costs 4 € to start plus 1 € per km. Taxi B costs 1 € to start plus 2 € per km. For which distance do both cost the same?",
      "Taxi A kostet 4 € Grundgebühr und 1 € pro km. Taxi B kostet 1 € Grundgebühr und 2 € pro km. Bei welcher Strecke kosten beide gleich viel?",
    ),
    rules: [
      { name: tx("Taxi A", "Taxi A"), m: 1, n: 4 },
      { name: tx("Taxi B", "Taxi B"), m: 2, n: 1 },
    ],
    xName: "km",
    yName: tx("price in €", "Preis in €"),
    xMax: 6,
    yMax: 14,
    yStep: 2,
    meet: tx("For **3 km** both taxis cost **7 €**.", "Bei **3 km** kosten beide Taxis **7 €**."),
  },
  {
    tab: tx("Saving", "Sparen"),
    text: tx(
      "Tom has 2 € and saves 3 € every week. Lea has 10 € and saves 1 € every week. When do both have the same amount?",
      "Tom hat 2 € und spart jede Woche 3 € dazu. Lea hat 10 € und spart jede Woche 1 € dazu. Wann haben beide gleich viel Geld?",
    ),
    rules: [
      { name: "Tom", m: 3, n: 2 },
      { name: "Lea", m: 1, n: 10 },
    ],
    xName: tx("weeks", "Wochen"),
    yName: tx("money in €", "Geld in €"),
    xMax: 6,
    yMax: 20,
    yStep: 4,
    meet: tx("After **4 weeks** both have **14 €**.", "Nach **4 Wochen** haben beide **14 €**."),
  },
];

const ruleEq = (r: Rule): Eq1 => ({ kind: "y", m: r.m, n: r.n });
const minus = (n: number) => String(n).replace("-", "−");

export function TableLab() {
  const t = useText();
  const scope = useId();
  const [which, setWhich] = useState(0);
  const [x, setX] = useState(0);
  const story = STORIES[which];
  const [A, B] = story.rules;
  const ya = A.m * x + A.n;
  const yb = B.m * x + B.n;
  const same = ya === yb;
  const meetX = (B.n - A.n) / (A.m - B.m);
  const xs = Array.from({ length: story.xMax + 1 }, (_, i) => i);
  const tones = ["blob", "ink"] as const;
  const names = ["A", "B"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {STORIES.map((s, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === which}
            onClick={() => {
              setWhich(i);
              setX(0);
            }}
            className={cn("h-8 rounded-lg border px-3 text-[12.5px] font-medium", i === which ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(s.tab)}
          </button>
        ))}
      </div>
      <p className="text-[14px] leading-relaxed text-ink-2">{t(story.text)}</p>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            {story.rules.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[13px] text-ink-2">
                <Chip tone={tones[i]}>{names[i]}</Chip>
                <span className="min-w-[64px]">{t(r.name)}</span>
                <MathView src={eqSrc(ruleEq(r))} size="sm" animate={false} />
              </div>
            ))}
            <div className="text-[12.5px] text-ink-3">
              <Inline text={`$x$: ${t(story.xName)}, $y$: ${t(story.yName)}`} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] table-fixed border-separate border-spacing-0 text-center font-math text-[15px]">
              <tbody>
                <tr>
                  <th className="w-10 border-b border-line px-1 py-1.5 text-left font-sans text-[12px] font-semibold italic text-ink-3">x</th>
                  {xs.map((v) => (
                    <th key={v} className={cn("border-b border-line px-1 py-1.5 font-normal", v === x ? "text-ink" : "text-ink-3")}>
                      {v}
                    </th>
                  ))}
                </tr>
                {story.rules.map((r, i) => (
                  <tr key={i}>
                    <th className="px-1 py-1.5 text-left">
                      <Chip tone={tones[i]}>{names[i]}</Chip>
                    </th>
                    {xs.map((v) => {
                      const shown = v <= x;
                      const hit = shown && A.m * v + A.n === B.m * v + B.n;
                      return (
                        <td key={v} className={cn("px-1 py-1.5 transition-colors", v === x && "bg-blob-soft/60", hit && "bg-ok/15 font-semibold text-ok")}>
                          <AnimatePresence initial={false} mode="popLayout">
                            {shown ? (
                              <motion.span key="v" initial={{ opacity: 0, y: -6, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 28 }} className="inline-block">
                                {minus(r.m * v + r.n)}
                              </motion.span>
                            ) : (
                              <span className="text-ink-3/50">·</span>
                            )}
                          </AnimatePresence>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="font-math text-[15px] italic text-ink-2">x</span>
              <div className="flex-1">
                <StepSlider value={x} count={story.xMax + 1} onChange={setX} label={tx("Value of x", "Wert von x")} valueText={String(x)} />
              </div>
              <span className="w-6 text-right font-math text-[15px]">{x}</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {story.rules.map((r, i) => (
                <span key={i} className="flex items-center gap-2">
                  <Chip tone={tones[i]}>{names[i]}</Chip>
                  <MathView src={`y = ${rightAt(r.m, r.n, x)} = ${r.m * x + r.n}`} size="sm" scope={`${scope}-c${i}`} />
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <ValueChart story={story} x={x} />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={same ? `meet-${which}` : "gap"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", same ? "border-ok/35 bg-ok/[0.08] text-ink" : "border-line bg-surface text-ink-2")}
            >
              {same ? (
                <Inline text={`${t(tx("**Same value!**", "**Gleicher Wert!**"))} ${t(story.meet)} ${t(tx("Solution:", "Lösung:"))} $${pt(x, ya)}$.`} />
              ) : (
                <Inline
                  text={
                    x < meetX
                      ? tx(
                          `For $x = ${x}$ the values differ by $${Math.abs(ya - yb)}$. Move $x$ on and watch the gap.`,
                          `Für $x = ${x}$ liegen die Werte $${Math.abs(ya - yb)}$ auseinander. Geh mit $x$ weiter und beobachte den Abstand.`,
                        )
                      : tx(
                          `For $x = ${x}$ the values differ by $${Math.abs(ya - yb)}$, and the gap is growing again. The equal values are further left.`,
                          `Für $x = ${x}$ liegen die Werte $${Math.abs(ya - yb)}$ auseinander, und der Abstand wächst wieder. Die gleichen Werte liegen weiter links.`,
                        )
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/** The table's points on a small chart: revealed up to x, with the gap between the two at x. */
function ValueChart({ story, x }: { story: Story; x: number }) {
  const t = useText();
  const W = 320;
  const H = 210;
  const L = 30;
  const R = 12;
  const T = 12;
  const Bm = 28;
  const sx = (v: number) => L + (v / story.xMax) * (W - L - R);
  const sy = (v: number) => H - Bm - (v / story.yMax) * (H - T - Bm);
  const xs = Array.from({ length: story.xMax + 1 }, (_, i) => i);
  const ys: number[] = [];
  for (let v = 0; v <= story.yMax; v += story.yStep) ys.push(v);
  const tones = ["var(--blob)", "var(--ink)"];
  const [A, B] = story.rules;
  const ya = A.m * x + A.n;
  const yb = B.m * x + B.n;
  const path = (r: Rule) =>
    xs
      .filter((v) => v <= x)
      .map((v, i) => `${i ? "L" : "M"}${sx(v).toFixed(1)} ${sy(r.m * v + r.n).toFixed(1)}`)
      .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-line bg-surface" role="img" aria-label={t(tx("Chart of the table of values", "Diagramm zur Wertetabelle"))}>
      <g stroke="var(--line)" strokeWidth={0.8}>
        {xs.map((v) => (
          <line key={`gx${v}`} x1={sx(v)} x2={sx(v)} y1={T} y2={H - Bm} />
        ))}
        {ys.map((v) => (
          <line key={`gy${v}`} x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} />
        ))}
      </g>
      <line x1={L} x2={W - R + 4} y1={sy(0)} y2={sy(0)} stroke="var(--ink-3)" strokeWidth={1.2} />
      <line x1={L} x2={L} y1={H - Bm} y2={T - 4} stroke="var(--ink-3)" strokeWidth={1.2} />
      <g fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        {xs.map((v) => (
          <text key={`lx${v}`} x={sx(v)} y={H - Bm + 14} textAnchor="middle">
            {v}
          </text>
        ))}
        {ys.map((v) => (
          <text key={`ly${v}`} x={L - 6} y={sy(v) + 4} textAnchor="end">
            {v}
          </text>
        ))}
        <text x={W - R} y={H - 3} textAnchor="end">
          {`x: ${t(story.xName)}`}
        </text>
      </g>
      {/* the gap between both values at the current x */}
      <motion.line
        initial={false}
        animate={{ x1: sx(x), x2: sx(x), y1: sy(ya), y2: sy(yb) }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        stroke="var(--danger)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
        opacity={ya === yb ? 0 : 0.8}
      />
      {story.rules.map((r, i) => (
        <path key={`p${i}`} d={path(r) || "M0 0"} fill="none" stroke={tones[i]} strokeWidth={1.6} opacity={0.55} />
      ))}
      {story.rules.map((r, i) =>
        xs
          .filter((v) => v <= x)
          .map((v) => (
            <motion.circle
              key={`d${i}-${v}`}
              cx={sx(v)}
              cy={sy(r.m * v + r.n)}
              r={i === 0 ? 4.5 : 3}
              fill={tones[i]}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
            />
          )),
      )}
      {ya === yb && (
        <motion.circle
          key={`meet-${x}`}
          cx={sx(x)}
          cy={sy(ya)}
          fill="none"
          stroke="var(--ok)"
          strokeWidth={2}
          initial={{ r: 5, opacity: 0.9 }}
          animate={{ r: 16, opacity: 0 }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// A table of values for tasks: x in the top row, one row per equation; empty cells
// are for the student to fill in.

export function ValueTable({ xs, rows }: { xs: number[]; rows: { name: string; values: (number | null)[] }[] }) {
  const t = useText();
  const tones = ["blob", "ink"] as const;
  return (
    <div className="overflow-x-auto">
      <table className="mx-auto border-separate border-spacing-0 text-center font-math text-[16px]" aria-label={t(tx("Table of values", "Wertetabelle"))}>
        <tbody>
          <tr>
            <th className="border-b border-r border-line px-2.5 py-2 italic text-ink-2">x</th>
            {xs.map((v) => (
              <th key={v} className="min-w-9 border-b border-line px-2 py-2 font-normal">
                {minus(v)}
              </th>
            ))}
          </tr>
          {rows.map((r, i) => (
            <tr key={i}>
              <th className={cn("border-r border-line px-2.5 py-2 text-left", i < rows.length - 1 && "border-b")}>
                <span className="flex items-center gap-1.5">
                  <Chip tone={tones[i % 2]}>{r.name}</Chip>
                  <span className="italic text-ink-2">y</span>
                </span>
              </th>
              {r.values.map((v, k) => (
                <td key={k} className={cn("px-2 py-2", i < rows.length - 1 && "border-b border-line")}>
                  {v === null ? <span className="inline-block h-5 w-7 rounded border border-dashed border-line-2 align-middle" /> : minus(v)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// A graph with a legend under it, so a picture on its own page still says which line
// belongs to which equation (line colours alone don't: the dark line is light in dark mode).

export function LegendGraph({ legend, ...graph }: GraphProps & { legend: { name: string; src: string }[] }) {
  const tones = ["blob", "ink"] as const;
  return (
    <div className="space-y-2">
      <Graph {...graph} />
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {legend.map((l, i) => (
          <span key={l.name} className="flex items-center gap-2">
            <Chip tone={tones[i % 2]}>{l.name}</Chip>
            <MathView src={l.src} size="sm" animate={false} />
          </span>
        ))}
      </div>
    </div>
  );
}
