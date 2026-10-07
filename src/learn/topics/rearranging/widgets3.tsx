"use client";

import { motion } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { dec } from "./kit";

// ---------------------------------------------------------------------------
// The lens lab: an optical bench with a converging lens. Drag the candle (the
// object) along the axis; the rays and the image follow, and the lens equation
// 1/f = 1/g + 1/b, solved for b, is worked out with the numbers.

const VW = 660;
const VH = 280;
const AX = 150; // optical axis
const LX = 330; // lens
const S = 12; // px per cm
const G = 3.5; // object height in cm
const FOCALS = [4, 5, 6, 8];

/** Where a line through two points meets the vertical x = X. */
const atX = (x1: number, y1: number, x2: number, y2: number, X: number) => y1 + ((y2 - y1) * (X - x1)) / (x2 - x1);

export function LensLab() {
  const t = useText();
  const l = useLocale();
  const scope = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [f, setF] = useState(6);
  const [g, setG] = useState(15);
  const [dragging, setDragging] = useState(false);

  const setObject = (v: number) => setG(Math.min(26, Math.max(1, Math.round(v * 2) / 2)));
  const moveTo = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    setObject((LX - p.x) / S);
  };

  const atFocus = Math.abs(g - f) < 1e-9;
  const b = atFocus ? Infinity : (f * g) / (g - f);
  const real = b > 0 && Number.isFinite(b);
  const virtual = b < 0;
  const B = atFocus ? 0 : (-G * b) / g; // image height, negative = upside down

  // Object tip and image tip in px.
  const ox = LX - g * S;
  const oy = AX - G * S;
  const ix = LX + b * S;
  const iy = AX - B * S;
  const fx = LX + f * S; // focal point behind the lens
  const fxl = LX - f * S; // focal point in front

  // Ray 1: parallel to the axis, then through the focal point behind the lens.
  const r1 = { x1: ox, y1: oy, x2: LX, y2: oy, x3: VW, y3: atX(LX, oy, fx, AX, VW) };
  // Ray 2: straight through the centre of the lens.
  const r2 = { x1: ox, y1: oy, x3: VW, y3: atX(ox, oy, LX, AX, VW) };
  // Ray 3: through the focal point in front (or coming from its direction), then parallel.
  const y3lens = g > f ? atX(ox, oy, fxl, AX, LX) : atX(fxl, AX, ox, oy, LX);
  const showR3 = Math.abs(g - f) > 0.4 && Math.abs(y3lens - AX) < 125;

  const num = (v: number, d = 1) => dec(Math.round(v * 10 ** d) / 10 ** d, l, d);
  const bText = real ? num(b) : virtual ? num(b) : "";
  const approx = Number.isFinite(b) && Math.abs(b * 10 - Math.round(b * 10)) > 1e-9 ? "\\approx" : "=";
  const formula = atFocus
    ? `b = \\frac{f \\cdot g}{g - f} = \\frac{${f} \\cdot ${num(g)}}{${num(g)} - ${f}} = \\frac{${num(f * g)}}{\\red{0}}`
    : `b = \\frac{f \\cdot g}{g - f} = \\frac{${f} \\cdot ${num(g)}}{${num(g)} - ${f}} ${approx} ${bText} "cm"`;
  const status = atFocus
    ? tx("$g = f$: the denominator $g - f$ is $0$. The rays leave the lens parallel and never meet: **no image**.", "$g = f$: Der Nenner $g - f$ ist $0$. Die Strahlen verlassen die Linse parallel und treffen sich nie: **kein Bild**.")
    : virtual
      ? tx("$g < f$: $b$ comes out **negative**. The rays spread out; your eye traces them back to an upright, enlarged **virtual** image on the candle's side (a magnifying glass).", "$g < f$: $b$ wird **negativ**. Die Strahlen laufen auseinander; dein Auge verlängert sie rückwärts zu einem aufrechten, vergrößerten **virtuellen** Bild auf der Seite der Kerze (eine Lupe).")
      : Math.abs(g - 2 * f) < 1e-9
        ? tx("$g = 2f$: a **real** image, upside down and exactly as big as the candle, because $b = g$.", "$g = 2f$: ein **reelles** Bild, umgedreht und genau so groß wie die Kerze, denn $b = g$.")
        : g > 2 * f
        ? tx("$g > 2f$: a **real** image behind the lens, upside down and smaller (like in a camera).", "$g > 2f$: ein **reelles** Bild hinter der Linse, umgedreht und verkleinert (wie in einer Kamera).")
        : tx("$f < g < 2f$: a **real** image, upside down and **enlarged** (like a projector).", "$f < g < 2f$: ein **reelles** Bild, umgedreht und **vergrößert** (wie bei einem Beamer).");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-ink-2">{t(tx("Focal length", "Brennweite"))}</span>
        <div className="flex gap-1">
          {FOCALS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setF(v)}
              className={cn("relative h-9 rounded-lg border px-3 font-math text-[15px] transition-colors", f === v ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
              aria-pressed={f === v}
            >
              {f === v && <motion.span layoutId={`${scope}-f`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
              <span className="relative">f = {v} cm</span>
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        className={cn("w-full touch-none select-none rounded-xl border border-line bg-surface", dragging ? "cursor-grabbing" : "cursor-grab")}
        role="img"
        aria-label={t(tx(`Lens with f = ${f} cm, candle at g = ${g} cm`, `Linse mit f = ${f} cm, Kerze bei g = ${g} cm`))}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDragging(true);
          moveTo(e);
        }}
        onPointerMove={(e) => dragging && moveTo(e)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        <defs>
          <clipPath id={`${scope}-clip`}>
            <rect x={0} y={0} width={VW} height={VH} />
          </clipPath>
        </defs>
        {/* ruler in cm along the axis */}
        <g stroke="var(--line)" strokeWidth={1}>
          {Array.from({ length: 53 }, (_, i) => i - 26).map((c) => (
            <line key={c} x1={LX + c * S} y1={AX - (c % 5 === 0 ? 5 : 2.5)} x2={LX + c * S} y2={AX + (c % 5 === 0 ? 5 : 2.5)} />
          ))}
        </g>
        <line x1={0} y1={AX} x2={VW} y2={AX} stroke="var(--ink-3)" strokeWidth={1} />

        {/* lens */}
        <ellipse cx={LX} cy={AX} rx={7} ry={118} fill="var(--blob)" fillOpacity={0.12} stroke="var(--blob)" strokeWidth={1.5} />
        {/* focal points */}
        {[fxl, fx].map((x, i) => (
          <g key={i}>
            <motion.circle initial={false} animate={{ cx: x }} cy={AX} r={3.5} fill="var(--ink)" />
            <motion.text initial={false} animate={{ x }} y={AX + 20} textAnchor="middle" fontSize={13} fill="var(--ink-2)" className="font-math" fontStyle="italic">
              F
            </motion.text>
          </g>
        ))}
        {[2 * f * S, -2 * f * S].map((d, i) => (
          <motion.text key={i} initial={false} animate={{ x: LX - d }} y={AX + 20} textAnchor="middle" fontSize={11} fill="var(--ink-3)" className="font-math">
            2F
          </motion.text>
        ))}

        <g clipPath={`url(#${scope}-clip)`} strokeWidth={1.6} fill="none">
          {/* ray 1 */}
          <polyline points={`${r1.x1},${r1.y1} ${r1.x2},${r1.y2} ${r1.x3},${r1.y3}`} stroke="var(--blob)" />
          {/* ray 2 */}
          <line x1={r2.x1} y1={r2.y1} x2={r2.x3} y2={r2.y3} stroke="var(--blob)" strokeOpacity={0.7} />
          {/* ray 3 */}
          {showR3 && <polyline points={`${ox},${oy} ${LX},${y3lens} ${VW},${y3lens}`} stroke="var(--blob)" strokeOpacity={0.45} />}
          {/* virtual image: rays traced back */}
          {virtual && (
            <g stroke="var(--ink-3)" strokeDasharray="4 4" strokeWidth={1.2}>
              <line x1={LX} y1={oy} x2={ix} y2={iy} />
              <line x1={LX} y1={AX} x2={ix} y2={iy} />
              {showR3 && <line x1={LX} y1={y3lens} x2={ix} y2={y3lens} />}
            </g>
          )}
          {/* the image */}
          {!atFocus && (
            <g stroke={virtual ? "var(--ink-2)" : "var(--ok)"} strokeWidth={3} strokeDasharray={virtual ? "5 4" : undefined}>
              <line x1={ix} y1={AX} x2={ix} y2={iy} />
              <path d={`M${ix - 6},${iy + (B > 0 ? 9 : -9)} L${ix},${iy} L${ix + 6},${iy + (B > 0 ? 9 : -9)}`} />
            </g>
          )}
        </g>

        {/* the candle you drag */}
        <motion.g initial={false} animate={{ x: ox }} transition={{ type: "spring", stiffness: 500, damping: 38 }}>
          <rect x={-5} y={oy} width={10} height={G * S} rx={2} fill="var(--ink-2)" />
          <path d={`M0,${oy - 15} C6,${oy - 7} 5,${oy - 1} 0,${oy} C-5,${oy - 1} -6,${oy - 7} 0,${oy - 15} Z`} fill="var(--blob)" />
          <circle cx={0} cy={AX} r={14} fill="var(--blob)" opacity={dragging ? 0.25 : 0.12} />
          <text x={0} y={AX + 36} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("drag", "ziehen"))}
          </text>
        </motion.g>
        <text x={12} y={22} fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("object", "Gegenstand"))}
        </text>
        <text x={VW - 12} y={22} textAnchor="end" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {real ? t(tx("real image", "reelles Bild")) : virtual ? t(tx("virtual image", "virtuelles Bild")) : t(tx("no image", "kein Bild"))}
        </text>
        {real && ix > VW - 4 && (
          <text x={VW - 12} y={VH - 12} textAnchor="end" fontSize={12} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("image off the bench →", "Bild außerhalb →"))}
          </text>
        )}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex items-center gap-1.5">
          <span className="font-math text-[16px] italic text-ink">g</span>
          <button type="button" onClick={() => setObject(g - 0.5)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover" aria-label={t(tx("Candle closer to the lens", "Kerze näher an die Linse"))}>
            <Minus className="size-3.5" />
          </button>
          <span className="w-16 text-center font-math tabular-nums text-ink">{num(g)} cm</span>
          <button type="button" onClick={() => setObject(g + 0.5)} className="grid size-8 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover" aria-label={t(tx("Candle further away", "Kerze weiter weg"))}>
            <Plus className="size-3.5" />
          </button>
        </span>
        <button type="button" onClick={() => setObject(f)} className="h-8 rounded-lg px-3 text-[13px] text-ink-2 hover:bg-hover hover:text-ink">
          {t(tx("Put it at F", "Auf F setzen"))}
        </button>
        <button type="button" onClick={() => setObject(2 * f)} className="h-8 rounded-lg px-3 text-[13px] text-ink-2 hover:bg-hover hover:text-ink">
          {t(tx("Put it at 2F", "Auf 2F setzen"))}
        </button>
      </div>

      <div className="space-y-2 rounded-xl bg-blob-soft/50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <MathView src="\frac{1}{f} = \frac{1}{g} + \frac{1}{b}" size="sm" animate={false} />
          <span className="text-ink-3">⇒</span>
          <MathView src={formula} size="sm" animate={false} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <Inline text={status} />
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The pendulum lab: choose how long one swing should take. The rearranged
// formula l = g·T²/(4π²) gives the length, and the pendulum swings with
// exactly that period, in real time.

const GRAV = 9.81;
const PX_PER_M = 88;

export function PendulumLab() {
  const t = useText();
  const l = useLocale();
  const [T, setT] = useState(2);
  const len = (GRAV * T * T) / (4 * Math.PI * Math.PI);
  const px = len * PX_PER_M;
  const n = (v: number, d = 2) => dec(Math.round(v * 10 ** d) / 10 ** d, l, d);
  const check = 2 * Math.PI * Math.sqrt(len / GRAV);

  return (
    <div className="grid items-start gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[250px] w-[200px] overflow-hidden rounded-xl border border-line bg-surface">
        {/* ceiling */}
        <div className="absolute inset-x-6 top-3 h-1.5 rounded-full bg-ink-3" />
        {/* metre ruler */}
        <div className="absolute right-2 top-[18px] flex flex-col items-end text-[10px] text-ink-3" aria-hidden>
          {[0, 1, 2].map((m) => (
            <span key={m} className="absolute right-0 flex items-center gap-1" style={{ top: m * PX_PER_M - 6 }}>
              {m} m <span className="inline-block h-px w-2 bg-ink-3" />
            </span>
          ))}
        </div>
        <motion.div
          key={T}
          className="absolute left-1/2 top-[18px]"
          style={{ transformOrigin: "0px 0px" }}
          initial={{ rotate: 14 }}
          animate={{ rotate: [14, -14] }}
          transition={{ duration: T / 2, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        >
          <div className="absolute left-[-1px] top-0 w-[2px] bg-ink-2" style={{ height: px }} />
          <div className="absolute size-5 rounded-full bg-blob shadow-card" style={{ left: -10, top: px - 10 }} />
        </motion.div>
      </div>

      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="flex items-baseline justify-between gap-3 text-[13px] text-ink-2">
            <span>{t(tx("Period T: one swing there and back", "Periodendauer T: einmal hin und zurück"))}</span>
            <span className="font-math text-[17px] tabular-nums text-ink">T = {n(T, 1)} s</span>
          </span>
          <input type="range" min={0.8} max={2.8} step={0.1} value={T} onChange={(e) => setT(Number(e.target.value))} className="w-full accent-[var(--blob)]" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[1, 1.5, 2, 2.5].map((v) => (
            <button key={v} type="button" onClick={() => setT(v)} className={cn("h-8 rounded-lg border px-3 text-[13px] transition-colors", Math.abs(T - v) < 1e-9 ? "border-blob bg-blob-soft/60 text-ink" : "border-line text-ink-2 hover:bg-hover")}>
              {n(v, 1)} s{v === 2 ? t(tx(" (seconds pendulum)", " (Sekundenpendel)")) : ""}
            </button>
          ))}
        </div>
        <div className="space-y-2 rounded-xl bg-blob-soft/50 px-4 py-3">
          <MathView src="T = 2 \pi \sqrt{\frac{l}{g}} \quad \Rightarrow \quad l = \frac{g \cdot T^2}{4 \pi^2}" size="sm" animate={false} />
          <MathView src={`l = \\frac{${n(GRAV)} \\cdot ${n(T, 1)}^2}{4 \\pi^2} \\approx ${n(len)} "m"`} size="sm" animate={false} />
          <p className="text-[13px] text-ink-2">
            <Inline
              text={tx(
                `Check: $T = 2\\pi \\sqrt{\\frac{${n(len, 3)}}{${n(GRAV)}}} \\approx ${n(check, 1)}$ s. Four times the length only doubles the period: $T$ grows with the **root** of $l$.`,
                `Probe: $T = 2\\pi \\sqrt{\\frac{${n(len, 3)}}{${n(GRAV)}}} \\approx ${n(check, 1)}$ s. Die vierfache Länge verdoppelt die Periodendauer nur: $T$ wächst mit der **Wurzel** aus $l$.`,
              )}
            />
          </p>
        </div>
      </div>
    </div>
  );
}
