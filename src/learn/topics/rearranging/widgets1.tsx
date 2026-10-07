"use client";

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The rectangle lab: drag the corner of a rectangle on squared paper and watch
// A = a · b and u = 2 · a + 2 · b follow. A small challenge: find every
// rectangle with an area of 24 cm² (so b = 24 : a every time).

const COLS = 12;
const ROWS = 8;
const C = 26;
const LEFT = 74;
const TOP = 12;
const W = LEFT + COLS * C + 14;
const H = TOP + ROWS * C + 38;
const GOAL = 24;
const GOALS = [
  [3, 8],
  [4, 6],
  [6, 4],
  [8, 3],
  [12, 2],
] as const;
const spring = { type: "spring" as const, stiffness: 420, damping: 34 };

export function RectangleLab() {
  const t = useText();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [a, setA] = useState(5);
  const [b, setB] = useState(3);
  const [mode, setMode] = useState<"A" | "u">("A");
  const [found, setFound] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const A = a * b;
  const u = 2 * a + 2 * b;

  const setSides = (x: number, y: number) => {
    const na = Math.min(COLS, Math.max(1, Math.round(x)));
    const nb = Math.min(ROWS, Math.max(1, Math.round(y)));
    setA(na);
    setB(nb);
    if (na * nb === GOAL) setFound((f) => (f.includes(`${na}x${nb}`) ? f : [...f, `${na}x${nb}`]));
  };

  const moveTo = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    setSides((p.x - LEFT) / C, (p.y - TOP) / C);
  };

  const onKey = (e: React.KeyboardEvent) => {
    const step: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const d = step[e.key];
    if (!d) return;
    e.preventDefault();
    setSides(a + d[0], b + d[1]);
  };

  // The way around the rectangle, for the dot that walks the perimeter.
  const x0 = LEFT;
  const y0 = TOP;
  const x1 = LEFT + a * C;
  const y1 = TOP + b * C;
  const walk = `M${x0},${y0} L${x1},${y0} L${x1},${y1} L${x0},${y1} Z`;
  const inside = mode === "A" ? `${A} cm²` : `${u} cm`;
  const big = a >= 3 && b >= 2;

  return (
    <div className="space-y-4">
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,430px)_minmax(0,1fr)]">
        <div className="space-y-2">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className={cn("w-full max-w-[430px] touch-none select-none", dragging ? "cursor-grabbing" : "cursor-pointer")}
            role="img"
            aria-label={t(tx(`Rectangle with a = ${a} cm and b = ${b} cm`, `Rechteck mit a = ${a} cm und b = ${b} cm`))}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDragging(true);
              moveTo(e);
            }}
            onPointerMove={(e) => dragging && moveTo(e)}
            onPointerUp={() => setDragging(false)}
            onPointerCancel={() => setDragging(false)}
          >
            {/* squared paper */}
            <g stroke="var(--line)" strokeWidth={1}>
              {Array.from({ length: COLS + 1 }, (_, i) => (
                <line key={`v${i}`} x1={LEFT + i * C} y1={TOP} x2={LEFT + i * C} y2={TOP + ROWS * C} />
              ))}
              {Array.from({ length: ROWS + 1 }, (_, i) => (
                <line key={`h${i}`} x1={LEFT} y1={TOP + i * C} x2={LEFT + COLS * C} y2={TOP + i * C} />
              ))}
            </g>

            {/* the rectangle */}
            <motion.rect
              x={LEFT}
              y={TOP}
              initial={false}
              animate={{ width: a * C, height: b * C }}
              transition={spring}
              fill="var(--blob)"
              fillOpacity={mode === "A" ? 0.2 : 0.05}
              stroke="var(--blob)"
              strokeWidth={mode === "u" ? 4.5 : 2}
              strokeLinejoin="round"
            />
            {mode === "u" && (
              <circle r={6} fill="var(--blob)">
                <animateMotion key={walk} dur={`${Math.max(2.5, u / 6)}s`} repeatCount="indefinite" path={walk} />
              </circle>
            )}
            <motion.text
              initial={false}
              animate={{ x: LEFT + (a * C) / 2, y: TOP + (b * C) / 2 + 6, opacity: big ? 1 : 0 }}
              transition={spring}
              textAnchor="middle"
              fontSize={17}
              fontWeight={600}
              fill="var(--ink)"
              style={{ fontFamily: "var(--font-sans)" }}
            >
              {inside}
            </motion.text>

            {/* side labels */}
            <motion.text initial={false} animate={{ x: LEFT + (a * C) / 2, y: TOP + b * C + 24 }} transition={spring} textAnchor="middle" fontSize={15} fill="var(--ink)" className="font-math">
              a = {a} cm
            </motion.text>
            <motion.text initial={false} animate={{ x: LEFT - 10, y: TOP + (b * C) / 2 + 5 }} transition={spring} textAnchor="end" fontSize={15} fill="var(--ink)" className="font-math">
              b = {b} cm
            </motion.text>

            {/* the corner you drag */}
            <motion.g
              initial={false}
              animate={{ x: x1, y: y1 }}
              transition={spring}
              tabIndex={0}
              role="button"
              aria-label={t(tx("Corner of the rectangle. Arrow keys change a and b.", "Ecke des Rechtecks. Die Pfeiltasten ändern a und b."))}
              onKeyDown={onKey}
              className="outline-none [&:focus-visible>circle:first-child]:opacity-40"
            >
              <circle r={17} fill="var(--blob)" opacity={dragging ? 0.3 : 0.15} />
              <circle r={8} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2.5} />
            </motion.g>
          </svg>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2">
            <Stepper label="a" value={a} onChange={(v) => setSides(v, b)} max={COLS} />
            <Stepper label="b" value={b} onChange={(v) => setSides(a, v)} max={ROWS} />
            <span className="text-ink-3">{t(tx("1 square = 1 cm", "1 Kästchen = 1 cm"))}</span>
          </div>
        </div>

        <div className="space-y-3">
          {(["A", "u"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn("relative block w-full rounded-xl border px-4 py-3 text-left transition-colors", mode === m ? "border-blob bg-blob-soft/50" : "border-line hover:bg-hover")}
              aria-pressed={mode === m}
            >
              <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{m === "A" ? t(tx("Area: the inside", "Flächeninhalt: innen")) : t(tx("Perimeter: the way around", "Umfang: außen herum"))}</div>
              {m === "A" ? (
                <div className="space-y-1">
                  <div>
                    <MathView src="A = a \cdot b" size="sm" animate={false} />
                  </div>
                  <div>
                    <MathView src={`A#A =#e ${a}#a "cm"#ua \\cdot#d ${b}#b "cm"#ub =#e2 ${A}#r "cm²"#ur`} size="sm" scope={`${scope}-A`} />
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div>
                    <MathView src="u = 2 \cdot a + 2 \cdot b" size="sm" animate={false} />
                  </div>
                  <div>
                    <MathView src={`u#u =#e 2#t1 \\cdot#d1 ${a}#a "cm"#ua +#p 2#t2 \\cdot#d2 ${b}#b "cm"#ub =#e2 ${u}#r "cm"#ur`} size="sm" scope={`${scope}-u`} />
                  </div>
                </div>
              )}
            </button>
          ))}

          <div className="rounded-xl bg-surface px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-ink">
                <Inline text={tx("Challenge: every rectangle with $A = 24$ cm²", "Herausforderung: jedes Rechteck mit $A = 24$ cm²")} />
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                {found.length} / {GOALS.length}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GOALS.map(([ga, gb]) => {
                const got = found.includes(`${ga}x${gb}`);
                return (
                  <motion.span
                    key={`${ga}x${gb}`}
                    layout
                    className={cn("rounded-md border px-2 py-0.5 font-math text-[14px]", got ? "border-transparent bg-blob text-white" : "border-dashed border-line-2 text-ink-3")}
                  >
                    {got ? `${ga} · ${gb}` : "? · ?"}
                  </motion.span>
                );
              })}
            </div>
            <AnimatePresence initial={false}>
              {found.length === GOALS.length && (
                <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 text-[13px] text-ok">
                  <Inline text={tx("All five! Did you notice? Each time $b = 24 : a$.", "Alle fünf! Gemerkt? Jedes Mal ist $b = 24 : a$.")} />
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange, max }: { label: string; value: number; onChange: (v: number) => void; max: number }) {
  const t = useText();
  return (
    <span className="flex items-center gap-1.5">
      <span className="font-math text-[16px] italic text-ink">{label}</span>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-40" aria-label={t(tx(`${label} smaller`, `${label} kleiner`))}>
        <Minus className="size-3.5" />
      </button>
      <span className="w-12 text-center font-math tabular-nums text-ink">{value} cm</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover disabled:opacity-40" aria-label={t(tx(`${label} bigger`, `${label} größer`))}>
        <Plus className="size-3.5" />
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// The undo machine: a formula, a purple letter, four operations. Pick the one
// that gets the letter on its own; the step is done on both sides, line by line.

type Op = "+" | "-" | "*" | ":";
type Puzzle = {
  label: Text;
  legend: Text;
  S: string;
  T: string;
  /** What the letter is combined with. */
  x: string;
  /** How: S = x · T, S = T : x, S = T + x, S = T − x. */
  kind: Op;
  /** Is x written in front (4 · a) or behind (a · b with T = b → a · b)? */
  front?: boolean;
  /** A value for the probe, and the subject it gives. */
  sample: Record<string, number>;
};

const PUZZLES: Puzzle[] = [
  { label: tx("Square: perimeter", "Quadrat: Umfang"), legend: tx("$u$: perimeter, $a$: side", "$u$: Umfang, $a$: Seite"), S: "u", T: "a", x: "4", kind: "*", front: true, sample: { a: 9, u: 36 } },
  { label: tx("Price with 5 € shipping", "Preis mit 5 € Versand"), legend: tx("$G$: total, $P$: price of the item", "$G$: Gesamtpreis, $P$: Preis der Ware"), S: "G", T: "P", x: "5", kind: "+", sample: { P: 23, G: 28 } },
  { label: tx("Speed", "Geschwindigkeit"), legend: tx("$v$: speed, $s$: distance, $t$: time", "$v$: Geschwindigkeit, $s$: Strecke, $t$: Zeit"), S: "v", T: "s", x: "t", kind: ":", sample: { s: 150, t: 2, v: 75 } },
  { label: tx("Circle: diameter", "Kreis: Durchmesser"), legend: tx("$d$: diameter, $r$: radius", "$d$: Durchmesser, $r$: Radius"), S: "d", T: "r", x: "2", kind: "*", front: true, sample: { r: 7, d: 14 } },
  { label: tx("Lena is 3 years younger than Tom", "Lena ist 3 Jahre jünger als Tom"), legend: tx("$l$: Lena's age, $t$: Tom's age", "$l$: Lenas Alter, $t$: Toms Alter"), S: "l", T: "t", x: "3", kind: "-", sample: { t: 15, l: 12 } },
  { label: tx("Distance", "Strecke"), legend: tx("$s$: distance, $v$: speed, $t$: time", "$s$: Strecke, $v$: Geschwindigkeit, $t$: Zeit"), S: "s", T: "t", x: "v", kind: "*", front: true, sample: { v: 80, t: 3, s: 240 } },
  { label: tx("Rectangle: area", "Rechteck: Flächeninhalt"), legend: tx("$A$: area, $a$ and $b$: sides", "$A$: Flächeninhalt, $a$ und $b$: Seiten"), S: "A", T: "b", x: "a", kind: "*", front: true, sample: { a: 6, b: 4, A: 24 } },
];

const OPPOSITE: Record<Op, Op> = { "*": ":", ":": "*", "+": "-", "-": "+" };
const OP_SRC: Record<Op, string> = { "+": "+", "-": "-", "*": "\\cdot", ":": ":" };

/** The right-hand side: 4 · a, s : t, P + 5, t − 3. */
function rhs(p: Puzzle, mark = true) {
  const T = mark ? `\\blob{${p.T}}` : p.T;
  if (p.kind === "*") return p.front ? `${p.x} \\cdot ${T}` : `${T} \\cdot ${p.x}`;
  return `${T} ${OP_SRC[p.kind]} ${p.x}`;
}

/** Both sides with the chosen operation: u : 4 = 4 · a : 4, G · 5 = (P + 5) · 5. */
function applied(p: Puzzle, op: Op) {
  const needsBracket = (p.kind === "+" || p.kind === "-") && (op === "*" || op === ":");
  const right = needsBracket ? `(${rhs(p)})` : rhs(p);
  return `${p.S} ${OP_SRC[op]} ${p.x} = ${right} ${OP_SRC[op]} ${p.x}`;
}

function wrongNote(p: Puzzle, op: Op): Text {
  const same = op === p.kind;
  if (same) {
    return tx(
      `Now it's ${p.kind === "*" ? "multiplied" : p.kind === ":" ? "divided" : p.kind === "+" ? "added" : "taken away"} **twice**. $${p.T}$ is even less alone. Try the **opposite**.`,
      `Jetzt wird **doppelt** ${p.kind === "*" ? "multipliziert" : p.kind === ":" ? "geteilt" : p.kind === "+" ? "addiert" : "abgezogen"}. $${p.T}$ steht noch weniger allein. Probier die **Umkehrung**.`,
    );
  }
  const en = { "*": "times", ":": "divided by", "+": "plus", "-": "minus" }[op];
  const de = { "*": "Mal", ":": "Geteilt", "+": "Plus", "-": "Minus" }[op];
  const enK = { "*": "times", ":": "divided by", "+": "plus", "-": "minus" }[p.kind];
  const deK = { "*": "Mal", ":": "Geteilt", "+": "Plus", "-": "Minus" }[p.kind];
  return tx(
    `$${p.T}$ still isn't alone: ${en} doesn't undo ${enK}. Which operation is the opposite of ${enK}?`,
    `$${p.T}$ steht immer noch nicht allein: ${de} macht ${deK} nicht rückgängig. Was ist die Umkehrung von ${deK}?`,
  );
}

export function UndoMachine() {
  const t = useText();
  const [i, setI] = useState(0);
  const [tried, setTried] = useState<Op[]>([]);
  const p = PUZZLES[i % PUZZLES.length];
  const right = OPPOSITE[p.kind];
  const last = tried[tried.length - 1];
  const solved = tried.includes(right);
  const ops: Op[] = ["+", "-", "*", ":"];
  const next = () => {
    setI((n) => n + 1);
    setTried([]);
  };

  const solvedLine = `${p.S} ${OP_SRC[right]} ${p.x} = \\blob{${p.T}}`;
  const finalLine = `\\blob{${p.T}} = ${p.S} ${OP_SRC[right]} ${p.x}`;
  const v = p.sample;
  const subjectCalc = p.kind === "*" ? `${/\d/.test(p.x) ? p.x : v[p.x]} \\cdot ${v[p.T]}` : `${v[p.T]} ${OP_SRC[p.kind]} ${/\d/.test(p.x) ? p.x : v[p.x]}`;
  const back = `${v[p.S]} ${OP_SRC[right]} ${/\d/.test(p.x) ? p.x : v[p.x]}`;
  const probe = tx(
    `Check with numbers: $${p.T} = ${v[p.T]}$ gives $${p.S} = ${subjectCalc} = ${v[p.S]}$, and back: $${back} = ${v[p.T]}$.`,
    `Probe mit Zahlen: $${p.T} = ${v[p.T]}$ ergibt $${p.S} = ${subjectCalc} = ${v[p.S]}$, und zurück: $${back} = ${v[p.T]}$.`,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-blob-soft px-3 py-1 text-[12.5px] font-semibold text-blob-ink">{t(p.label)}</span>
        <div className="flex items-center gap-1" aria-hidden>
          {PUZZLES.map((_, n) => (
            <span key={n} className={cn("h-1.5 rounded-full transition-all", n === i % PUZZLES.length ? "w-5 bg-blob" : "w-1.5 bg-line-2")} />
          ))}
        </div>
      </div>

      <div className="relative grid min-h-[120px] place-items-center overflow-hidden rounded-2xl border border-line bg-surface px-4 py-6">
        <div className="bg-dots pointer-events-none absolute inset-0 opacity-30" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="relative text-center">
            <MathView src={`${p.S} = ${rhs(p)}`} size="xl" animate={false} />
            <div className="mt-1 text-[12.5px] text-ink-3">
              <Inline text={p.legend} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="text-[14px] text-ink-2">
        <Inline text={tx(`Which operation, done on both sides, gets $${p.T}$ on its own?`, `Mit welcher Rechnung auf beiden Seiten steht $${p.T}$ allein?`)} />
      </p>
      <div className="grid grid-cols-4 gap-2">
        {ops.map((op) => {
          const done = tried.includes(op);
          const ok = op === right;
          return (
            <motion.button
              key={op}
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={solved}
              onClick={() => setTried((list) => (list.includes(op) ? list : [...list, op]))}
              className={cn(
                "flex h-12 items-center justify-center rounded-xl border-2 bg-raised transition-colors disabled:cursor-default",
                done && ok && "border-ok bg-ok/10",
                done && !ok && "border-danger/60 bg-danger/5",
                !done && "border-line hover:border-line-2",
              )}
              aria-label={t(tx(`Both sides ${op === "*" ? "times" : op === ":" ? "divided by" : op === "+" ? "plus" : "minus"} ${p.x}`, `Beide Seiten ${op === "*" ? "mal" : op === ":" ? "geteilt durch" : op === "+" ? "plus" : "minus"} ${p.x}`))}
            >
              <MathView src={`${OP_SRC[op]} \\, ${p.x}`} size="md" animate={false} />
            </motion.button>
          );
        })}
      </div>

      <div className="min-h-[150px] rounded-xl bg-surface px-4 py-3">
        <AnimatePresence mode="wait" initial={false}>
          {!last ? (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6 text-center text-[13.5px] text-ink-3">
              {t(tx("Tap an operation above.", "Tippe oben auf eine Rechnung."))}
            </motion.p>
          ) : solved ? (
            <motion.div key={`ok-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1.5">
              <Line delay={0} src={`${applied(p, right)}`} />
              <Line delay={0.5} src={solvedLine} />
              <Line delay={1} src={finalLine} icon={<Check className="size-4 text-ok" />} />
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="pt-1 text-[13px] text-ink-2">
                <Inline text={probe} />
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key={`no-${last}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              <Line delay={0} src={applied(p, last)} icon={<X className="size-4 text-danger" />} />
              <p className="text-[13.5px] text-ink-2">
                <Inline text={wrongNote(p, last)} />
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={next} className={cn("flex h-10 items-center gap-1.5 rounded-lg px-4 text-[14px] font-medium transition-colors", solved ? "bg-blob text-white hover:bg-blob-deep" : "border border-line text-ink-2 hover:bg-hover")}>
          {t(tx("Next formula", "Nächste Formel"))} <ArrowRight className="size-4" />
        </button>
        {tried.length > 0 && !solved && (
          <button type="button" onClick={() => setTried([])} className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] text-ink-3 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> {t(tx("Start again", "Neu starten"))}
          </button>
        )}
      </div>
    </div>
  );
}

function Line({ src, delay, icon }: { src: string; delay: number; icon?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, type: "spring", stiffness: 380, damping: 30 }} className="flex items-center gap-2">
      <MathView src={src} size="md" animate={false} />
      {icon}
    </motion.div>
  );
}
