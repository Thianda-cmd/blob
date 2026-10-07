"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { clean, dec, enDecimals, minusR, polish } from "./shared";
import { Chip, SPRING, Stepper, useNum, ValueSlider } from "./ui";

// ---------------------------------------------------------------------------
// x² = c on the parabola: the line y = c meets y = x² twice, once or never.

const RW = 362;
const RH = 250;
const RX = (x: number) => 160 + x * 21;
const RY = (y: number) => 200 - y * 5;
const C_VALUES = Array.from({ length: 45 }, (_, i) => i - 8); // −8 … 36

const PARABOLA = (() => {
  let d = "";
  for (let i = 0; i <= 124; i++) {
    const x = -6.2 + i * 0.1;
    d += `${i ? "L" : "M"}${RX(x).toFixed(2)},${RY(x * x).toFixed(2)}`;
  }
  return d;
})();

const COUNT: { k: number; label: Text }[] = [
  { k: 2, label: tx("two solutions", "zwei Lösungen") },
  { k: 1, label: tx("one solution", "eine Lösung") },
  { k: 0, label: tx("no solution", "keine Lösung") },
];

export function RootLab() {
  const t = useText();
  const show = useNum();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [c, setC] = useState(25);
  const [drag, setDrag] = useState(false);
  const r = c > 0 ? Math.sqrt(c) : 0;
  const exact = Number.isInteger(r);
  const kind = c > 0 ? 2 : c === 0 ? 1 : 0;
  const tone = kind === 2 ? "var(--blob)" : kind === 1 ? "var(--ink)" : "var(--danger)";
  const round2 = clean(Math.round(r * 100) / 100);

  function pick(clientY: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const y = ((clientY - box.top) / box.height) * RH;
    const v = Math.round((200 - y) / 5);
    setC(Math.max(-8, Math.min(36, v)));
  }

  const eq = `x^2 = ${dec(c)}`;
  const result: Text =
    kind === 2
      ? exact
        ? `x_1 = ${dec(r)} \\quad x_2 = -${dec(r)}`
        : `x = \\pm \\sqrt{${dec(c)}} \\approx \\pm ${dec(round2)}`
      : kind === 1
        ? "x = 0"
        : tx('"No number squared is negative."', '"Kein Quadrat ist negativ."');
  const set = kind === 2 ? (exact ? `L = \\{ -${dec(r)}; ${dec(r)} \\}` : `L = \\{ -\\sqrt{${dec(c)}}; \\sqrt{${dec(c)}} \\}`) : kind === 1 ? "L = \\{ 0 \\}" : "L = \\{ \\}";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-[13.5px] leading-snug text-ink-2">
          {t(tx("Drag the line y = c up and down (or use the slider).", "Zieh die Gerade y = c nach oben oder unten (oder nimm den Regler)."))}
        </p>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${RW} ${RH}`}
          className={cn("w-full touch-none select-none", drag ? "cursor-grabbing" : "cursor-grab")}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrag(true);
            pick(e.clientY);
          }}
          onPointerMove={(e) => drag && pick(e.clientY)}
          onPointerUp={() => setDrag(false)}
          onPointerCancel={() => setDrag(false)}
          role="img"
          aria-label={t(tx(`The parabola y = x² and the line y = ${c}`, `Die Parabel y = x² und die Gerade y = ${c}`))}
        >
          <defs>
            <clipPath id={`${scope}-clip`}>
              <rect x={4} y={6} width={RX(7.4) - 4} height={RH - 12} />
            </clipPath>
          </defs>
          <g stroke="var(--line)" strokeWidth={0.6}>
            {Array.from({ length: 13 }, (_, i) => i - 6).map((x) => (
              <line key={`v${x}`} x1={RX(x)} x2={RX(x)} y1={RY(38)} y2={RY(-8)} />
            ))}
            {[-5, 5, 10, 15, 20, 25, 30, 35].map((y) => (
              <line key={`h${y}`} x1={RX(-7)} x2={RX(7)} y1={RY(y)} y2={RY(y)} />
            ))}
          </g>
          <line x1={RX(-7)} x2={RX(7)} y1={RY(0)} y2={RY(0)} stroke="var(--ink-3)" strokeWidth={1} />
          <line x1={RX(0)} x2={RX(0)} y1={RY(-8)} y2={RY(38)} stroke="var(--ink-3)" strokeWidth={1} />
          <g fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-math)">
            {[-6, -4, -2, 2, 4, 6].map((x) => (
              <text key={x} x={RX(x)} y={RY(0) + 11} textAnchor="middle">
                {String(x).replace("-", "−")}
              </text>
            ))}
            {[10, 20, 30].map((y) => (
              <text key={y} x={RX(0) - 4} y={RY(y) + 3} textAnchor="end">
                {y}
              </text>
            ))}
            <text x={RX(7) - 2} y={RY(0) - 4} textAnchor="end" fontStyle="italic" fontSize={11}>
              x
            </text>
            <text x={RX(0) + 5} y={RY(38) + 8} fontStyle="italic" fontSize={11}>
              y
            </text>
          </g>
          <g clipPath={`url(#${scope}-clip)`}>
            <path d={PARABOLA} fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeLinecap="round" />
            <motion.line initial={false} animate={{ y1: RY(c), y2: RY(c), stroke: tone }} transition={SPRING} x1={RX(-7.4)} x2={RX(7.4)} strokeWidth={2.2} strokeLinecap="round" />
            {[1, -1].map((s) => (
              <motion.line
                key={s}
                initial={false}
                animate={{ x1: RX(s * r), x2: RX(s * r), y1: RY(Math.max(c, 0)), y2: RY(0), opacity: kind === 2 ? 0.7 : 0 }}
                transition={SPRING}
                stroke="var(--blob)"
                strokeWidth={1.2}
                strokeDasharray="3 3"
              />
            ))}
          </g>
          <motion.g initial={false} animate={{ x: RX(7.4) + 2, y: RY(c) }} transition={SPRING}>
            <rect x={0} y={-8} width={42} height={16} rx={8} fill="var(--raised)" stroke={tone} strokeWidth={1} />
            <text x={21} y={3.4} textAnchor="middle" fontSize={9.5} fill={tone} fontFamily="var(--font-math)">
              {`y = ${show(c)}`}
            </text>
          </motion.g>
          <AnimatePresence>
            {(kind === 2 ? [1, -1] : kind === 1 ? [0] : []).map((s) => (
              <motion.g
                key={s}
                initial={{ opacity: 0, scale: 0, x: RX(s * r), y: RY(c) }}
                animate={{ opacity: 1, scale: 1, x: RX(s * r), y: RY(Math.max(c, 0)) }}
                exit={{ opacity: 0, scale: 0 }}
                transition={SPRING}
              >
                <circle r={7} fill="var(--blob)" opacity={0.16} />
                <circle r={3.6} fill="var(--blob)" stroke="var(--raised)" strokeWidth={1.2} />
              </motion.g>
            ))}
          </AnimatePresence>
          <AnimatePresence>
            {kind === 2 &&
              [1, -1].map((s) => (
                <motion.text
                  key={`t${s}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, x: RX(s * r), y: RY(0) + 22 }}
                  exit={{ opacity: 0 }}
                  transition={SPRING}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontWeight={600}
                  fill="var(--blob-ink)"
                  stroke="var(--raised)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  fontFamily="var(--font-math)"
                >
                  {`${exact ? "" : "≈ "}${show(s * (exact ? r : round2))}`}
                </motion.text>
              ))}
          </AnimatePresence>
        </svg>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface px-4 py-3">
          <ValueSlider name="c" label={tx("Value of c", "Wert von c")} values={C_VALUES} index={c + 8} onChange={(i) => setC(C_VALUES[i])} />
          <div className="mt-2 flex flex-wrap gap-2">
            {[16, 10, 0, -4].map((v) => (
              <Chip key={v} active={c === v} onClick={() => setC(v)}>
                <span className="font-math">{`c = ${String(v).replace("-", "−")}`}</span>
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2 px-1">
          <div>
            <MathView src={eq} size="md" animate={false} />
          </div>
          <div className="min-h-[30px]">
            <MathView src={enDecimals(result)} size="sm" animate={false} className={kind === 0 ? "text-danger" : "text-ink"} />
          </div>
          <div>
            <MathView src={polish(set)} size="sm" animate={false} className="text-ink-2" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {COUNT.map((k) => (
            <div key={k.k} className={cn("relative rounded-xl border px-2.5 py-2 text-center", kind === k.k ? "border-transparent" : "border-line")}>
              {kind === k.k && (
                <motion.span
                  layoutId={`${scope}-count`}
                  className={cn("absolute inset-0 rounded-xl border", k.k === 0 ? "border-danger/40 bg-danger/[0.07]" : "border-blob/40 bg-blob-soft")}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <span className={cn("relative text-[12.5px] font-semibold leading-tight", kind === k.k ? (k.k === 0 ? "text-danger" : "text-blob-ink") : "text-ink-3")}>
                {t(k.label)}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-ink-3">
          {t(
            tx(
              "c > 0: the line crosses the parabola twice, at −√c and √c. c = 0: it only touches the vertex. c < 0: it passes underneath.",
              "c > 0: Die Gerade schneidet die Parabel zweimal, bei −√c und √c. c = 0: Sie berührt nur den Scheitel. c < 0: Sie läuft unten durch.",
            ),
          )}
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The zero product rule: slide x and watch the two factors and their product.
// The product is 0 exactly when one of the factors is 0.

const X_VALUES = Array.from({ length: 25 }, (_, i) => (i - 12) / 2); // −6 … 6 in halves
const ZW = 320;
const ZH = 170;
const ZX = (x: number) => 160 + x * 24;
const ZY = (y: number) => 95 - y * 3.4;

/** "(x + 1)" etc. as display source. */
const factorSrc = (r: number) => `(${minusR(r)})`;

export function ZeroProductLab() {
  const t = useText();
  const show = useNum();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [r1, setR1] = useState(-1);
  const [r2, setR2] = useState(4);
  const [xi, setXi] = useState(16); // x = 2
  const [found, setFound] = useState<number[]>([]);
  const [drag, setDrag] = useState(false);
  const x = X_VALUES[xi];
  const f1 = clean(x - r1);
  const f2 = clean(x - r2);
  const prod = clean(f1 * f2);
  const zeros = [...new Set([r1, r2])].sort((a, b) => a - b);
  const done = zeros.every((z) => found.includes(z));

  function moveTo(i: number) {
    setXi(i);
    const v = X_VALUES[i];
    if ((v === r1 || v === r2) && !found.includes(v)) setFound([...found, v]);
  }
  function setRoot(which: 1 | 2, v: number) {
    const [a, b] = which === 1 ? [v, r2] : [r1, v];
    setR1(a);
    setR2(b);
    setFound(x === a || x === b ? [x] : []);
  }
  function pick(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const box = svg.getBoundingClientRect();
    const sx = ((clientX - box.left) / box.width) * ZW;
    const v = Math.round(((sx - 160) / 24) * 2) / 2;
    const i = X_VALUES.indexOf(Math.max(-6, Math.min(6, v)));
    if (i >= 0 && i !== xi) moveTo(i);
  }

  let path = "";
  for (let i = 0; i <= 120; i++) {
    const px = -6 + i * 0.1;
    path += `${i ? "L" : "M"}${ZX(px).toFixed(2)},${ZY((px - r1) * (px - r2)).toFixed(2)}`;
  }

  const tile = (label: string, value: number, zero: boolean, big = false) => (
    <div className={cn("relative rounded-xl border px-3 py-2 transition-colors", zero ? "border-ok/50 bg-ok/[0.08]" : "border-line bg-surface")}>
      <MathView src={label} size="sm" animate={false} className={zero ? "text-ok" : "text-ink-2"} />
      <div className={cn("font-math tabular-nums", big ? "text-[24px]" : "text-[21px]", zero ? "font-semibold text-ok" : "text-ink")}>{show(value)}</div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3">
        <MathView src={`${factorSrc(r1)} \\cdot ${factorSrc(r2)} = 0`} size="lg" animate={false} />
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-ink-3">
          {([1, 2] as const).map((w) => (
            <div key={w} className="flex items-center gap-2">
              <span>{t(w === 1 ? tx("1st bracket", "1. Klammer") : tx("2nd bracket", "2. Klammer"))}</span>
              <Stepper
                value={-(w === 1 ? r1 : r2)}
                min={-5}
                max={5}
                onChange={(v) => setRoot(w, -v)}
                label={w === 1 ? tx("Number in the first bracket", "Zahl in der ersten Klammer") : tx("Number in the second bracket", "Zahl in der zweiten Klammer")}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${ZW} ${ZH}`}
            className={cn("w-full touch-none select-none", drag ? "cursor-grabbing" : "cursor-grab")}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(true);
              pick(e.clientX);
            }}
            onPointerMove={(e) => drag && pick(e.clientX)}
            onPointerUp={() => setDrag(false)}
            onPointerCancel={() => setDrag(false)}
            role="img"
            aria-label={t(tx("Graph of the product as x changes", "Graph des Produkts, wenn sich x ändert"))}
          >
            <defs>
              <clipPath id={`${scope}-clip`}>
                <rect x={0} y={4} width={ZW} height={ZH - 8} />
              </clipPath>
            </defs>
            <g stroke="var(--line)" strokeWidth={0.6}>
              {Array.from({ length: 13 }, (_, i) => i - 6).map((v) => (
                <line key={v} x1={ZX(v)} x2={ZX(v)} y1={6} y2={ZH - 6} />
              ))}
            </g>
            <line x1={ZX(-6.4)} x2={ZX(6.4)} y1={ZY(0)} y2={ZY(0)} stroke="var(--ink-3)" strokeWidth={1} />
            <g fontSize={9} fill="var(--ink-3)" fontFamily="var(--font-math)">
              {[-6, -4, -2, 2, 4, 6].map((v) => (
                <text key={v} x={ZX(v)} y={ZY(0) + 12} textAnchor="middle">
                  {String(v).replace("-", "−")}
                </text>
              ))}
            </g>
            <g clipPath={`url(#${scope}-clip)`}>
              <motion.path initial={false} animate={{ d: path }} transition={SPRING} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} />
              <motion.line initial={false} animate={{ x1: ZX(x), x2: ZX(x), y1: ZY(0), y2: ZY(prod) }} transition={SPRING} stroke="var(--blob)" strokeWidth={1.4} strokeDasharray="3 3" />
            </g>
            {zeros.map((z) => (
              <motion.circle
                key={`z${z}`}
                initial={false}
                animate={{ cx: ZX(z), cy: ZY(0), fill: found.includes(z) ? "var(--ok)" : "var(--raised)" }}
                transition={SPRING}
                r={4.4}
                stroke={found.includes(z) ? "var(--ok)" : "var(--ink-3)"}
                strokeWidth={1.4}
                strokeDasharray={found.includes(z) ? undefined : "2 2"}
              />
            ))}
            <motion.circle
              initial={false}
              animate={{ cx: ZX(x), cy: ZY(Math.max(-20, Math.min(25, prod))) }}
              transition={SPRING}
              r={5}
              fill={prod === 0 ? "var(--ok)" : "var(--blob)"}
              stroke="var(--raised)"
              strokeWidth={1.5}
            />
          </svg>
          <ValueSlider name="x" label={tx("Value of x", "Wert von x")} values={X_VALUES} index={xi} onChange={moveTo} className="mt-1" />
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {tile(minusR(r1), f1, f1 === 0)}
            {tile(minusR(r2), f2, f2 === 0)}
          </div>
          {tile(t(tx('"Product"', '"Produkt"')), prod, prod === 0, true)}
          <div className="min-h-[52px] rounded-xl bg-paper/60 px-3 py-2.5 text-[13.5px] leading-snug text-ink-2">
            {done ? (
              <span className="font-medium text-ok">
                {t(tx("Found both! The product is 0 only at these two places:", "Beide gefunden! Das Produkt ist nur an diesen beiden Stellen 0:"))}{" "}
                <MathView src={polish(zeros.length === 1 ? `L = \\{ ${dec(zeros[0])} \\}` : `L = \\{ ${dec(zeros[0])}; ${dec(zeros[1])} \\}`)} size="inline" animate={false} />
              </span>
            ) : (
              <span>
                {t(
                  tx(
                    `Slide x until the product is 0. Found: ${found.length} of ${zeros.length}.`,
                    `Schieb x, bis das Produkt 0 ist. Gefunden: ${found.length} von ${zeros.length}.`,
                  ),
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
