"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, RotateCcw, Target } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { mul, type Frac } from "@/learn/engine/frac";
import { Plane, PlaneDot, PlaneHandle, PlaneLine, PlanePath, PlaneTag, StepSlider, TONE, useSpringTo, type Pt } from "@/learn/visuals/LinesGraph";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { numIn } from "./kit";
import { Caption, lineSrc, plain, pt, q, qv, TRI_FILL } from "./level2";
import { QUADRANT_FILL, QuadrantNumerals, quadrantBox, quadrantOf, ROMAN } from "./visuals1";

// Widgets for level 1. Each one stands on its own (it also gets its own public page):
// its own short instructions inside, a sensible start, touch, mouse and keyboard.

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, Text][]; onChange: (v: T) => void }) {
  const t = useText();
  const scope = useId();
  return (
    <div className="flex w-fit rounded-lg border border-line p-0.5" role="tablist">
      {options.map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === key ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === key && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{t(label)}</span>
        </button>
      ))}
    </div>
  );
}

function Note({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13.5px] leading-relaxed text-ink-2", className)}>{children}</p>;
}

// ---------------------------------------------------------------------------
// Point hunt: drag P, read its coordinates and quadrant; or hit target points.

const TARGETS: [string, Pt][] = [
  ["A", [-3, 2]],
  ["B", [4, -1]],
  ["C", [-2, -4]],
  ["D", [0, 3]],
  ["E", [3, 4]],
  ["F", [-5, 0]],
  ["G", [1, -3]],
  ["H", [-4, -2]],
  ["K", [2, 0]],
  ["L", [-1, 5]],
];

function walkText(v: number, axis: "x" | "y"): Text {
  if (v === 0) return axis === "x" ? tx("not left or right", "weder nach links noch nach rechts") : tx("not up or down", "weder nach oben noch nach unten");
  const n = Math.abs(v);
  if (axis === "x") return v > 0 ? tx(`${n} to the right`, `${n} nach rechts`) : tx(`${n} to the left`, `${n} nach links`);
  return v > 0 ? tx(`${n} up`, `${n} nach oben`) : tx(`${n} down`, `${n} nach unten`);
}

function placeText(p: Pt): Text {
  const qd = quadrantOf(p);
  if (qd) {
    const signs = { 1: "(+ | +)", 2: "(− | +)", 3: "(− | −)", 4: "(+ | −)" }[qd];
    return tx(`in quadrant **${ROMAN[qd]}** ${signs}`, `im **${ROMAN[qd]}. Quadranten** ${signs}`);
  }
  if (p[0] === 0 && p[1] === 0) return tx("at the **origin**", "im **Ursprung**");
  return p[1] === 0 ? tx("on the **x-axis** (in no quadrant)", "auf der **x-Achse** (in keinem Quadranten)") : tx("on the **y-axis** (in no quadrant)", "auf der **y-Achse** (in keinem Quadranten)");
}

/** Drag a point around the grid; in target mode, put it on the point that's asked for. */
export function PointHunt() {
  const t = useText();
  const scope = useId();
  const [P, setP] = useState<Pt>([2, 3]);
  const [mode, setMode] = useState<"explore" | "target">("explore");
  const [ti, setTi] = useState(0);
  const [hits, setHits] = useState(0);
  const [solved, setSolved] = useState(false);
  const [touched, setTouched] = useState(false);
  const px = useSpringTo(P[0]);
  const py = useSpringTo(P[1]);
  const [name, target] = TARGETS[ti % TARGETS.length];
  const qd = quadrantOf(P);

  function move(_: string, p: Pt) {
    setTouched(true);
    setP(p);
    if (mode === "target" && !solved && p[0] === target[0] && p[1] === target[1]) {
      setSolved(true);
      setHits((h) => h + 1);
    }
  }

  function nextTarget() {
    setTi((i) => i + 1);
    setSolved(false);
  }

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          label={tx("Coordinate plane with the point P", "Koordinatensystem mit dem Punkt P")}
          onMove={move}
          overlay={
            <>
              {P[0] !== 0 && (
                <PlaneTag at={() => [px.get(), 0]} dy={P[1] >= 0 ? 13 : -13}>
                  <MathView src={String(P[0])} size="sm" animate={false} className="text-blob-ink" />
                </PlaneTag>
              )}
              {P[1] !== 0 && (
                <PlaneTag at={() => [0, py.get()]} anchor={P[0] >= 0 ? "right" : "left"} dx={P[0] >= 0 ? -8 : 8}>
                  <MathView src={String(P[1])} size="sm" animate={false} className="text-blob-ink" />
                </PlaneTag>
              )}
              <PlaneTag at={() => [px.get(), py.get()]} anchor={P[0] >= 3 ? "right" : "left"} dx={P[0] >= 3 ? -14 : 14} dy={P[1] >= 4 ? 14 : -14}>
                <MathView src={pt(P[0], P[1], "P")} size="sm" animate={false} className="text-ink" />
              </PlaneTag>
            </>
          }
        >
          {([1, 2, 3, 4] as const).map((k) => (
            <PlanePath key={k} shape={() => quadrantBox(k)} closed fill={QUADRANT_FILL} opacity={qd === k ? 1 : 0} />
          ))}
          <QuadrantNumerals active={qd || undefined} />
          <PlanePath
            shape={() => [
              [px.get(), 0],
              [px.get(), py.get()],
              [0, py.get()],
            ]}
            stroke={TONE.blob}
            width={0.5}
            dashed
          />
          {mode === "target" && solved && <PlaneDot at={() => target} tone="ok" hollow r={2.6} pulse={ti} />}
          <PlaneHandle id="P" x={px} y={py} at={P} label={tx("Point P", "Punkt P")} hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <Tabs
          value={mode}
          onChange={(m) => {
            setMode(m);
            setSolved(false);
          }}
          options={[
            ["explore", tx("Explore", "Erkunden")],
            ["target", tx("Targets", "Zielpunkte")],
          ]}
        />
        <div className="grid min-h-[76px] place-items-center rounded-xl border border-line bg-surface px-4 py-3">
          <MathView src={`P#P (${P[0] < 0 ? "-#sx " : ""}${Math.abs(P[0])}#x \\, |#bar ${P[1] < 0 ? "-#sy " : "\\, "}${Math.abs(P[1])}#y)#br`} size="lg" scope={`${scope}-p`} />
        </div>
        <div className="space-y-1.5 text-[14px] text-ink-2">
          <div className="flex items-baseline gap-2">
            <span className="w-14 shrink-0 font-math italic text-ink">x = {numIn(P[0], "en").replace("-", "−")}</span>
            <span>{t(walkText(P[0], "x"))}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="w-14 shrink-0 font-math italic text-ink">y = {numIn(P[1], "en").replace("-", "−")}</span>
            <span>{t(walkText(P[1], "y"))}</span>
          </div>
          <div className="pt-1">
            <Inline text={tx(`$P$ lies ${t(placeText(P))}.`, `$P$ liegt ${t(placeText(P))}.`)} />
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === "target" ? (
            <motion.div key="target" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("space-y-2 rounded-xl border px-4 py-3", solved ? "border-ok/40 bg-ok/[0.06]" : "border-blob/30 bg-blob-soft/40")}>
              <div className="flex items-center gap-2 text-[14.5px] text-ink">
                {solved ? <Check className="size-4 text-ok" /> : <Target className="size-4 text-blob-ink" />}
                <span>
                  {solved ? t(tx("Hit! ", "Getroffen! ")) : t(tx("Put P on ", "Setze P auf "))}
                  <MathView src={pt(target[0], target[1], name)} size="inline" animate={false} className="mx-1 align-middle font-semibold" />
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12.5px] text-ink-3">{t(tx(`Hits: ${hits}`, `Treffer: ${hits}`))}</span>
                {solved && (
                  <button onClick={nextTarget} className="rounded-lg bg-blob px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90">
                    {t(tx("Next point", "Nächster Punkt"))}
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="explore" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Note>
                {t(
                  tx(
                    "Drag P (or select it and use the arrow keys). First the x-coordinate: right or left. Then the y-coordinate: up or down.",
                    "Zieh P (oder wähl ihn aus und nimm die Pfeiltasten). Zuerst die x-Koordinate: nach rechts oder links. Dann die y-Koordinate: nach oben oder unten.",
                  ),
                )}
              </Note>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// From a table to the graph: fill the table value by value, every pair becomes a point.

type Rule = { m: number; b: number };
const RULES: Rule[] = [
  { m: 2, b: 0 },
  { m: 1, b: 2 },
  { m: 2, b: -1 },
  { m: -1, b: 1 },
  { m: -2, b: 3 },
];
const TABLE_XS = [-2, -1, 0, 1, 2];

/** "y = 2 · (−1) − 1 = −3" for one column. */
function calcSrc({ m, b }: Rule, x: number): string {
  const xs = x < 0 ? `(${x})` : String(x);
  const mx = m === 1 ? xs : m === -1 ? `-${xs}` : `${m} \\cdot ${xs}`;
  const rest = b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`;
  return `y = ${mx}${rest} = ${m * x + b}`;
}

export function TableBuilder() {
  const t = useText();
  const [ri, setRi] = useState(2);
  const [filled, setFilled] = useState<boolean[]>(() => TABLE_XS.map(() => false));
  const [last, setLast] = useState<number | null>(null);
  const rule = RULES[ri];
  const done = filled.every(Boolean);
  const count = filled.filter(Boolean).length;
  const src = (r: Rule) => plain(lineSrc(q(r.m), q(r.b)));

  function fill(i: number) {
    if (filled[i]) {
      setLast(i);
      return;
    }
    setFilled((f) => f.map((v, k) => v || k === i));
    setLast(i);
  }

  function pickRule(i: number) {
    setRi(i);
    setFilled(TABLE_XS.map(() => false));
    setLast(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1">
          <Caption>{t(tx("Rule", "Vorschrift"))}</Caption>
        </span>
        {RULES.map((r, i) => (
          <button
            key={i}
            onClick={() => pickRule(i)}
            className={cn("rounded-lg border px-2.5 py-1 transition-colors", i === ri ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover")}
            aria-pressed={i === ri}
          >
            <MathView src={src(r)} size="sm" animate={false} />
          </button>
        ))}
      </div>

      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[400px] rounded-xl border border-line bg-surface p-2">
          <Plane label={tx("The pairs of the table as points", "Die Wertepaare der Tabelle als Punkte")}>
            {done && <PlaneLine key={`line-${ri}`} through={() => [[0, rule.b], [1, rule.m]]} width={0.9} opacity={0.7} />}
            {TABLE_XS.map((x, i) => (filled[i] ? <PlaneDot key={`${ri}-${x}`} at={() => [x, rule.m * x + rule.b]} tone={last === i ? "blob" : "ink"} r={1.35} pulse={`${ri}-${x}`} /> : null))}
          </Plane>
        </div>

        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="mx-auto border-collapse text-[17px]">
              <tbody>
                <tr>
                  <th scope="row" className="border border-line bg-surface px-3 py-2 font-math text-[18px] italic text-ink">
                    x
                  </th>
                  {TABLE_XS.map((x, i) => (
                    <td key={x} className={cn("min-w-[46px] border border-line px-2 py-2 text-center", last === i ? "bg-blob-soft" : "bg-raised")}>
                      <MathView src={String(x)} size="sm" animate={false} />
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="border border-line bg-surface px-3 py-2 font-math text-[18px] italic text-ink">
                    y
                  </th>
                  {TABLE_XS.map((x, i) => (
                    <td key={x} className={cn("min-w-[46px] border border-line p-0 text-center", last === i ? "bg-blob-soft" : "bg-raised")}>
                      <button
                        onClick={() => fill(i)}
                        className={cn("grid h-11 w-full place-items-center px-2", !filled[i] && "font-semibold text-blob-ink hover:bg-hover")}
                        aria-label={t(tx(`Work out y for x = ${x}`, `y für x = ${x} ausrechnen`))}
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.span key={filled[i] ? `v${ri}` : "q"} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} transition={{ type: "spring", stiffness: 420, damping: 26 }}>
                            <MathView src={filled[i] ? String(rule.m * x + rule.b) : "?"} size="sm" animate={false} />
                          </motion.span>
                        </AnimatePresence>
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid min-h-[56px] place-items-center rounded-xl border border-line bg-surface px-4 py-3">
            {last === null ? (
              <span className="text-[13.5px] text-ink-3">{t(tx("Tap a ? to work out y.", "Tipp auf ein ?, um y auszurechnen."))}</span>
            ) : (
              <MathView key={`${ri}-${last}`} src={calcSrc(rule, TABLE_XS[last])} size="md" animate={false} />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                const i = filled.findIndex((f) => !f);
                if (i >= 0) fill(i);
              }}
              disabled={done}
              className="rounded-lg bg-blob px-3 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {t(tx("Next value", "Nächster Wert"))}
            </button>
            <button onClick={() => pickRule(ri)} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-hover">
              <RotateCcw className="size-3.5" />
              {t(tx("Start again", "Neu anfangen"))}
            </button>
            <span className="ml-auto text-[12.5px] text-ink-3">{t(tx(`${count} of 5 points`, `${count} von 5 Punkten`))}</span>
          </div>

          <AnimatePresence>
            {done && (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-blob-soft/50 px-4 py-2.5 text-[14px] text-ink">
                {t(tx("All five points lie on one straight line!", "Alle fünf Punkte liegen auf einer Geraden!"))}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lines through the origin: choose m, move P along the line, the quotient y : x stays m.

const PROP_M: Frac[] = [q(-2), q(-1), q(-1, 2), q(1, 2), q(1), q(3, 2), q(2), q(3)];
const YMAX = 6;

/** "1,5" / "1.5" or "-\frac{1}{2}"-free decimals for the panel. */
const dec = (f: Frac | number, l: Locale) => numIn(typeof f === "number" ? f : qv(f), l);

export function ProportionalLab() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const [mi, setMi] = useState(5);
  const m = PROP_M[mi];
  const M = qv(m);
  const maxX = Math.min(5, Math.floor(YMAX / Math.abs(M)));
  const [x, setX] = useState(2);
  const [seen, setSeen] = useState<number[]>([1, 2]);
  const [touched, setTouched] = useState(false);
  const X = Math.max(-maxX, Math.min(maxX, x));
  const Y = mul(m, q(X));
  const angle = useSpringTo(Math.atan(M));
  const pxS = useSpringTo(X);
  const pyS = useSpringTo(qv(Y));

  function moveTo(nx: number) {
    const c = Math.max(-maxX, Math.min(maxX, nx));
    setTouched(true);
    setX(c);
    setSeen((s) => (s.includes(c) || c === 0 ? s : [...s, c].slice(-4)));
  }

  function pickM(i: number) {
    setMi(i);
    const mm = Math.abs(qv(PROP_M[i]));
    const lim = Math.min(5, Math.floor(YMAX / mm));
    const nx = Math.max(-lim, Math.min(lim, X));
    setX(nx);
    setSeen([...new Set([1, 2, nx].filter((v) => v !== 0 && Math.abs(v) <= lim))]);
  }

  const cols = [...seen].sort((a, b) => a - b);
  const quotient = X === 0 ? null : `\\frac{y}{x} = \\frac{${dec(Y, l)}}{${X}} = ${dec(m, l)}`;
  const eqSrc = `y = ${dec(m, l)} \\cdot x`;

  return (
    <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-[420px] rounded-xl border border-line bg-surface p-2">
        <Plane
          xRange={[-5, 5]}
          yRange={[-YMAX, YMAX]}
          label={tx("A line through the origin with the point P", "Eine Ursprungsgerade mit dem Punkt P")}
          onMove={(_, p) => moveTo(p[0])}
          overlay={
            <>
              <PlaneTag at={() => [pxS.get(), pyS.get()]} anchor={X > 0 ? "left" : "right"} dx={X > 0 ? 12 : -12} dy={M * X > 0 || (X === 0 && M < 0) ? 14 : -14}>
                <MathView src={pt(dec(X, l), dec(Y, l), "P")} size="sm" animate={false} className="text-ink" />
              </PlaneTag>
              <PlaneTag at={() => [1, M / 2]} anchor="left" dx={7}>
                <MathView src={`m = ${dec(m, l)}`} size="sm" animate={false} className="text-blob-ink" />
              </PlaneTag>
            </>
          }
        >
          <PlanePath
            shape={() => {
              const s = Math.tan(angle.get());
              return [
                [0, 0],
                [1, 0],
                [1, s],
              ];
            }}
            closed
            fill={TRI_FILL}
          />
          <PlaneLine through={() => [[0, 0], [cos(angle.get()), sin(angle.get())]]} width={1.1} />
          <PlanePath
            shape={() => [
              [pxS.get(), 0],
              [pxS.get(), pyS.get()],
              [0, pyS.get()],
            ]}
            stroke={TONE.ink}
            width={0.45}
            dashed
          />
          <PlaneDot at={() => [0, 0]} tone="ink" r={0.9} />
          <PlaneHandle id="P" x={pxS} y={pyS} at={[X, qv(Y)]} label={tx("Point P on the line", "Punkt P auf der Geraden")} hint={!touched} />
        </Plane>
      </div>

      <div className="space-y-4">
        <div className="grid min-h-[64px] place-items-center rounded-xl border border-line bg-surface px-4 py-3">
          <MathView src={eqSrc} size="lg" scope={`${scope}-eq`} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption>{t(tx("Factor m", "Faktor m"))}</Caption>
            <MathView src={`m = ${dec(m, l)}`} size="sm" animate={false} className="text-blob-ink" />
          </div>
          <StepSlider value={mi} count={PROP_M.length} onChange={pickM} zero={2.5} label={tx("Proportionality factor m", "Proportionalitätsfaktor m")} valueText={`m = ${dec(m, l)}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="border-collapse text-[15px]">
            <tbody>
              {(
                [
                  ["x", (c: number) => String(c)],
                  ["y", (c: number) => dec(mul(m, q(c)), l)],
                  ["y : x", () => dec(m, l)],
                ] as [string, (c: number) => string][]
              ).map(([label, cell], r) => (
                <tr key={label}>
                  <th scope="row" className={cn("border border-line bg-surface px-2.5 py-1.5 text-left font-math italic", r === 2 ? "text-blob-ink" : "text-ink")}>
                    {label}
                  </th>
                  {cols.map((c) => (
                    <td key={c} className={cn("min-w-[44px] border border-line px-2 py-1.5 text-center", c === X ? "bg-blob-soft" : "bg-raised", r === 2 && "text-blob-ink")}>
                      <MathView src={cell(c)} size="sm" animate={false} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="min-h-[1.6em] text-[14px] text-ink-2">
          {quotient ? (
            <span className="text-ink">
              <MathView src={quotient} size="sm" animate={false} />
            </span>
          ) : (
            t(tx("At the origin x = 0: no quotient, but every line y = m · x goes through here.", "Im Ursprung ist x = 0: kein Quotient, aber jede Gerade y = m · x geht hier durch."))
          )}
        </div>
        <Note>
          {t(
            tx(
              "Drag P along the line (or use the arrow keys). Wherever P is, y divided by x gives the same factor m. At x = 1 the line is exactly at height m.",
              "Zieh P an der Geraden entlang (oder nimm die Pfeiltasten). Wo P auch ist: y geteilt durch x ergibt immer denselben Faktor m. Bei x = 1 ist die Gerade genau auf Höhe m.",
            ),
          )}
        </Note>
      </div>
    </div>
  );
}
