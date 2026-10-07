"use client";

import { AnimatePresence, motion } from "motion/react";
import { Lightbulb, Minus, Plus, RotateCcw, Undo2 } from "lucide-react";
import { Fragment, useId, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { add, frac, mul, sub, type Frac } from "@/learn/engine/frac";
import { Plane, PlaneHandle, PlanePath, PlaneTag, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cn } from "@/lib/utils";
import { num, pt, side } from "../lines/level2";
import { backSolve, combine, elimFactors, isZeroRow, nextLabel, opSrc, tripleText, type Row, type V3 } from "./gauss";

// ---------------------------------------------------------------------------
// Level 3 widgets: a Gauss workshop (do the row operations yourself) and a
// parabola that always runs through three points you drag.

function Stepper({ label, value, onChange, min, max, skip }: { label: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; skip?: number }) {
  const t = useText();
  const step = (d: number) => {
    let v = value + d;
    if (v === skip) v += d;
    if (v >= min && v <= max) onChange(v);
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-math text-[15px] italic text-ink-2">{label}</span>
      <button
        onClick={() => step(-1)}
        disabled={value - 1 < min || (value - 1 === skip && value - 2 < min)}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
        aria-label={t(tx("Decrease", "Verringern"))}
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-7 text-center font-math text-[16px]">{String(value).replace("-", "−")}</span>
      <button
        onClick={() => step(1)}
        disabled={value + 1 > max || (value + 1 === skip && value + 2 > max)}
        className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-30"
        aria-label={t(tx("Increase", "Erhöhen"))}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

const R = (x: number, y: number, z: number, c: number): Row => ({ x, y, z, c });
const SYSTEMS: Row[][] = [
  [R(1, 1, 1, 6), R(2, -1, 1, 3), R(1, 2, -1, 2)],
  [R(1, 2, -1, 2), R(3, -1, 2, 9), R(2, 3, 1, 9)],
  [R(1, 1, 1, 3), R(1, 2, 3, 5), R(2, 3, 4, 9)],
  [R(1, 1, 1, 3), R(1, 2, 3, 5), R(2, 3, 4, 8)],
];
const START_LABELS = ["I", "II", "III"];
/** The cells that must become 0 for step form: [row, variable]. */
const TARGETS: [number, V3][] = [
  [1, "x"],
  [2, "x"],
  [2, "y"],
];
const minus = (n: number) => String(n).replace("-", "−");

type Board = { rows: Row[]; labels: string[] };

export function GaussLab() {
  const t = useText();
  const scope = useId();
  const [which, setWhich] = useState(0);
  const [board, setBoard] = useState<Board>({ rows: SYSTEMS[0], labels: START_LABELS });
  const [history, setHistory] = useState<Board[]>([]);
  const [target, setTarget] = useState(1);
  const [source, setSource] = useState(0);
  const [a, setA] = useState(1);
  const [b, setB] = useState(-1);
  const { rows, labels } = board;
  const preview = combine(a, rows[target], b, rows[source]);
  const step = rows[1].x === 0 && rows[2].x === 0 && rows[2].y === 0;
  const values = step ? backSolve(rows) : null;
  const done = TARGETS.filter(([r, v]) => rows[r][v] === 0).length;

  function load(i: number) {
    setWhich(i);
    setBoard({ rows: SYSTEMS[i], labels: START_LABELS });
    setHistory([]);
    setTarget(1);
    setSource(0);
    setA(1);
    setB(-1);
  }
  function apply() {
    setHistory((h) => [...h, board]);
    setBoard({ rows: rows.map((r, i) => (i === target ? preview : r)), labels: labels.map((l, i) => (i === target ? nextLabel(l) : l)) });
  }
  function undo() {
    const last = history[history.length - 1];
    if (!last) return;
    setHistory((h) => h.slice(0, -1));
    setBoard(last);
  }
  function suggest() {
    const next = TARGETS.find(([r, v]) => rows[r][v] !== 0);
    if (!next) return;
    const [r, v] = next;
    const s = v === "x" ? 0 : 1;
    const f = elimFactors(rows[r], rows[s], v);
    if (!f) return;
    setTarget(r);
    setSource(s);
    setA(f[0]);
    setB(f[1]);
  }
  function pickTarget(i: number) {
    setTarget(i);
    if (source === i) setSource(i === 1 ? 0 : 1);
  }

  const cell = (r: number, v: V3) => TARGETS.some(([tr, tv]) => tr === r && tv === v);
  const cols: (V3 | "c")[] = ["x", "y", "z", "c"];
  const status: { tone: "ok" | "danger" | "blob" | "ink"; text: Text } = !step
    ? {
        tone: "ink",
        text: tx(
          `Make the three dashed cells **zero** (${done} of 3 done). Pick a row to change and a row to combine it with, then set the factors so a variable cancels.`,
          `Mach die drei gestrichelten Felder zu **null** (${done} von 3 geschafft). Wähl eine Zeile, die du änderst, und eine, mit der du sie kombinierst. Stell dann die Faktoren so ein, dass eine Variable wegfällt.`,
        ),
      }
    : values
      ? {
          tone: "ok",
          text: tx(
            `**Step form!** Now solve from the bottom up: $z = ${fmt(values[2])}$, then $y = ${fmt(values[1])}$, then $x = ${fmt(values[0])}$. So $L = \\{ ${tripleText(values.map(round) as [number, number, number])} \\}$.`,
            `**Stufenform!** Jetzt von unten nach oben einsetzen: $z = ${fmt(values[2])}$, dann $y = ${fmt(values[1])}$, dann $x = ${fmt(values[0])}$. Also ist $L = \\{ ${tripleText(values.map(round) as [number, number, number])} \\}$.`,
          ),
        }
      : isZeroRow(rows[2]) && rows[2].c !== 0
        ? {
            tone: "danger",
            text: tx(
              `**No solution.** The last row says $0 = ${rows[2].c}$: that's false (a contradiction), whatever $x$, $y$ and $z$ are. So $L = \\{ \\}$.`,
              `**Keine Lösung.** Die letzte Zeile sagt $0 = ${rows[2].c}$: Das ist falsch (ein Widerspruch), egal was $x$, $y$ und $z$ sind. Also ist $L = \\{ \\}$.`,
            ),
          }
        : isZeroRow(rows[2])
          ? {
              tone: "blob",
              text: tx(
                "**Infinitely many solutions.** The last row says $0 = 0$: always true, it rules nothing out. So $z$ is free: set $z = t$ and express $y$ and $x$ with $t$.",
                "**Unendlich viele Lösungen.** Die letzte Zeile sagt $0 = 0$: Das ist immer wahr und schließt nichts aus. $z$ ist also frei: Setz $z = t$ und drück $y$ und $x$ mit $t$ aus.",
              ),
            }
          : {
              tone: "ink",
              text: tx(
                "Step form, but a pivot is 0. Undo a step and try another combination.",
                "Stufenform, aber ein Diagonalfeld ist 0. Mach einen Schritt rückgängig und probier eine andere Kombination.",
              ),
            };

  const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-[12.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35";
  const seg = (on: boolean) => cn("h-8 min-w-11 rounded-lg border px-2.5 font-sans text-[13px] font-semibold", on ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {SYSTEMS.map((_, i) => (
          <button key={i} onClick={() => load(i)} className={seg(i === which)}>
            {t(tx(`System ${i + 1}`, `LGS ${i + 1}`))}
          </button>
        ))}
      </div>
      <p className="text-[14px] leading-relaxed text-ink-2">
        <Inline
          text={tx(
            "Bring the system into **step form** with the Gauss algorithm: change a row into $a \\cdot$ (that row) $+ \\, b \\cdot$ (another row). Every coefficient and the right side change together.",
            "Bring das LGS mit dem Gauß-Verfahren auf **Stufenform**: Ersetze eine Zeile durch $a \\cdot$ (diese Zeile) $+ \\, b \\cdot$ (eine andere Zeile). Alle Koeffizienten und die rechte Seite ändern sich mit.",
          )}
        />
      </p>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3">
          <div className="overflow-x-auto rounded-xl border border-line bg-surface p-2">
            <table className="w-full min-w-[280px] border-separate border-spacing-y-1 text-center font-math text-[17px]">
              <thead>
                <tr className="text-[13px] text-ink-3">
                  <th className="w-14" />
                  <th className="font-normal italic">x</th>
                  <th className="font-normal italic">y</th>
                  <th className="font-normal italic">z</th>
                  <th className="w-4" />
                  <th className="font-normal">{t(tx("right", "rechts"))}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={cn("transition-colors", i === target && !step && "bg-blob-soft/50")}>
                    <th className="rounded-l-lg px-1 text-left">
                      <motion.span key={labels[i]} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="inline-block rounded-md bg-blob px-1.5 py-0.5 font-sans text-[12px] font-bold text-white">
                        {labels[i]}
                      </motion.span>
                    </th>
                    {cols.map((v) => {
                      const want = v !== "c" && cell(i, v);
                      const zero = v !== "c" && r[v] === 0;
                      return (
                        <Fragment key={v}>
                          {v === "c" && <td className="px-0 text-ink-3">=</td>}
                          <td className={cn("px-1 py-1", v === "c" && "rounded-r-lg")}>
                          <span
                            className={cn(
                              "inline-grid h-8 min-w-9 place-items-center rounded-md px-1 transition-colors",
                              want && !zero && "outline outline-[1.5px] outline-dashed outline-blob/60",
                              want && zero && "bg-ok/15 text-ok",
                              !want && zero && "text-ink-3",
                            )}
                          >
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={`${labels[i]}-${r[v]}`}
                                initial={{ opacity: 0, y: -8, scale: 0.85 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.85 }}
                                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                              >
                                {minus(r[v])}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${which}-${step}-${values ? "u" : rows[2].c}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn(
                "rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed",
                status.tone === "ok" ? "border-ok/35 bg-ok/[0.08] text-ink" : status.tone === "danger" ? "border-danger/30 bg-danger/[0.06] text-ink" : status.tone === "blob" ? "border-blob/30 bg-blob-soft/60 text-ink" : "border-line bg-surface text-ink-2",
              )}
            >
              <Inline text={status.text} />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="space-y-2.5 rounded-xl border border-line bg-surface px-3.5 py-3">
            <div className={cn("space-y-2.5 transition-opacity", step && "pointer-events-none opacity-40")} aria-disabled={step}>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span className="w-24 shrink-0">{t(tx("Change row", "Zeile ändern"))}</span>
              {[1, 2].map((i) => (
                <button key={i} onClick={() => pickTarget(i)} className={seg(i === target)} aria-pressed={i === target}>
                  {labels[i]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
              <span className="w-24 shrink-0">{t(tx("using row", "mit Zeile"))}</span>
              {[0, 1, 2]
                .filter((i) => i !== target)
                .map((i) => (
                  <button key={i} onClick={() => setSource(i)} className={seg(i === source)} aria-pressed={i === source}>
                    {labels[i]}
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Stepper label="a" value={a} onChange={setA} min={1} max={9} />
              <Stepper label="b" value={b} onChange={setB} min={-9} max={9} skip={0} />
            </div>
            <div className="rounded-lg bg-raised px-3 py-2">
              <MathView src={`"${nextLabel(labels[target])}" = ${opSrc(a, labels[target], b, labels[source])}`} size="md" scope={`${scope}-op`} />
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 text-[13px] text-ink-3">
                <span>{t(tx("gives", "ergibt"))}</span>
                <MathView src={`${side([[preview.x, "x", "px"], [preview.y, "y", "py"], [preview.z, "z", "pz"]])} = ${preview.c}`} size="md" scope={`${scope}-pv`} className="text-ink" />
              </div>
            </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={apply} disabled={step} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blob px-3.5 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
                {t(tx("Apply", "Anwenden"))}
              </button>
              <button onClick={suggest} disabled={step} className={btn}>
                <Lightbulb className="size-3.5" />
                {t(tx("Suggest", "Vorschlag"))}
              </button>
              <button onClick={undo} disabled={!history.length} className={btn}>
                <Undo2 className="size-3.5" />
                {t(tx("Undo", "Rückgängig"))}
              </button>
              <button onClick={() => load(which)} className={btn}>
                <RotateCcw className="size-3.5" />
                {t(tx("Start again", "Von vorn"))}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const fmt = (n: number) => String(round(n));

// ---------------------------------------------------------------------------
// Parabola through three points: drag A, B and C; the system for a, b, c and the
// parabola f(x) = ax² + bx + c follow.

type Coef = { a: Frac; b: Frac; c: Frac };

/** Lagrange form, worked out exactly: the parabola (or line) through three points with different x. */
function through(P: Pt[]): Coef | null {
  const [p, q, r] = P;
  if (p[0] === q[0] || p[0] === r[0] || q[0] === r[0]) return null;
  let a = frac(0);
  let b = frac(0);
  let c = frac(0);
  for (const [i, j, k] of [
    [p, q, r],
    [q, p, r],
    [r, p, q],
  ] as const) {
    const d = (i[0] - j[0]) * (i[0] - k[0]);
    const w = frac(i[1], d);
    a = add(a, w);
    b = sub(b, mul(w, frac(j[0] + k[0])));
    c = add(c, mul(w, frac(j[0] * k[0])));
  }
  return { a, b, c };
}

const value = (f: Frac) => f.n / f.d;

/** "f(x) = 2x² − 3x + 1" with fractions where needed. */
function fSrc({ a, b, c }: Coef): string {
  const out: string[] = [];
  const push = (k: Frac, v: string) => {
    if (k.n === 0) return;
    const neg = k.n < 0;
    const abs = frac(Math.abs(k.n), k.d);
    const body = v && abs.n === 1 && abs.d === 1 ? v : `${num(abs)}${v ? ` ${v}` : ""}`;
    out.push(`${neg ? "-" : out.length ? "+" : ""} ${body}`.trim());
  };
  push(a, "x^2");
  push(b, "x");
  push(c, "");
  return `f(x) = ${out.length ? out.join(" ") : "0"}`;
}

/** One point as an equation in a, b, c: "a − b + c = 6". */
function pointRow(P: Pt): string {
  return `${side([
    [P[0] * P[0], "a", "a"],
    [P[0], "b", "b"],
    [1, "c", "c"],
  ]).replace(/#[A-Za-z0-9_-]+/g, "")} = ${P[1]}`;
}

const NAMES = ["A", "B", "C"];
const STARTS: Pt[] = [
  [-2, 3],
  [0, -1],
  [2, 3],
];

export function ParabolaLab() {
  const scope = useId();
  const [P, setP] = useState<Pt[]>(STARTS);
  const [touched, setTouched] = useState(false);
  const sx = [useSpringTo(P[0][0]), useSpringTo(P[1][0]), useSpringTo(P[2][0])];
  const sy = [useSpringTo(P[0][1]), useSpringTo(P[1][1]), useSpringTo(P[2][1])];
  const coef = through(P);
  const ca = useSpringTo(coef ? value(coef.a) : 0);
  const cb = useSpringTo(coef ? value(coef.b) : 0);
  const cc = useSpringTo(coef ? value(coef.c) : 0);
  const line = coef !== null && coef.a.n === 0;

  function onMove(id: string, p: Pt) {
    const i = NAMES.indexOf(id);
    if (P.some((o, k) => k !== i && o[0] === p[0] && o[1] === p[1])) return;
    setTouched(true);
    setP((old) => old.map((o, k) => (k === i ? p : o)));
  }

  const curve = (): Pt[] => {
    const pts: Pt[] = [];
    for (let k = 0; k <= 80; k++) {
      const x = -5.5 + (11 * k) / 80;
      pts.push([x, ca.get() * x * x + cb.get() * x + cc.get()]);
    }
    return pts;
  };

  return (
    <div className="space-y-4">
      <p className="text-[14px] leading-relaxed text-ink-2">
        <Inline
          text={tx(
            "Drag the points $A$, $B$ and $C$. Each point gives one equation for $a$, $b$ and $c$, and the solution of the system is the parabola $f(x) = ax^2 + bx + c$ through all three.",
            "Zieh die Punkte $A$, $B$ und $C$. Jeder Punkt liefert eine Gleichung für $a$, $b$ und $c$, und die Lösung des LGS ist die Parabel $f(x) = ax^2 + bx + c$ durch alle drei.",
          )}
        />
      </p>
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[400px] rounded-xl border border-line bg-surface p-2">
          <Plane
            xRange={[-5, 5]}
            yRange={[-4, 7]}
            onMove={onMove}
            label={tx("Parabola through the points A, B and C", "Parabel durch die Punkte A, B und C")}
            overlay={P.map((p, i) => (
              <PlaneTag key={i} at={() => [sx[i].get(), sy[i].get()]} dy={-19}>
                <span className="text-ink">
                  <MathView src={pt(p[0], p[1], NAMES[i])} size="inline" animate={false} />
                </span>
              </PlaneTag>
            ))}
          >
            <PlanePath shape={curve} stroke="var(--blob)" width={1.1} opacity={coef ? 1 : 0} />
            {P.map((p, i) => (
              <PlaneHandle key={i} id={NAMES[i]} x={sx[i]} y={sy[i]} at={p} tone="ink" label={tx(`Point ${NAMES[i]}`, `Punkt ${NAMES[i]}`)} hint={!touched && i === 0} />
            ))}
          </Plane>
        </div>

        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-3">
            {P.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-[86px] shrink-0">
                  <MathView src={pt(p[0], p[1], NAMES[i])} size="sm" animate={false} />
                </span>
                <MathView src={pointRow(p)} size="md" scope={`${scope}-r${i}`} />
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={coef ? (line ? "line" : "ok") : "none"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("space-y-2 rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed", !coef ? "border-danger/30 bg-danger/[0.06]" : line ? "border-line bg-surface" : "border-blob/30 bg-blob-soft/50")}
            >
              {coef ? (
                <>
                  <MathView src={fSrc(coef)} size="lg" scope={`${scope}-f`} />
                  <div className="text-ink-2">
                    <Inline
                      text={
                        line
                          ? tx(
                              "The three points lie on a **straight line**: $a = 0$, so there is no real parabola through them.",
                              "Die drei Punkte liegen auf einer **Geraden**: $a = 0$, es gibt also keine echte Parabel durch sie.",
                            )
                          : tx(
                              `Solving the system gives $a = ${num(coef.a)}$, $b = ${num(coef.b)}$, $c = ${num(coef.c)}$. ${coef.a.n > 0 ? "$a > 0$: the parabola opens upwards." : "$a < 0$: the parabola opens downwards."}`,
                              `Das LGS liefert $a = ${num(coef.a)}$, $b = ${num(coef.b)}$, $c = ${num(coef.c)}$. ${coef.a.n > 0 ? "$a > 0$: Die Parabel ist nach oben geöffnet." : "$a < 0$: Die Parabel ist nach unten geöffnet."}`,
                            )
                      }
                    />
                  </div>
                </>
              ) : (
                <Inline
                  text={tx(
                    "Two points are exactly above each other. No function can go through both: the system has no solution.",
                    "Zwei Punkte liegen genau übereinander. Keine Funktion kann durch beide gehen: Das LGS hat keine Lösung.",
                  )}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
