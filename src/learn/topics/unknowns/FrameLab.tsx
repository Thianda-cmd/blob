"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { cn } from "@/lib/utils";
import { num } from "./kit";
import { BlobSays, soft } from "./ui";

// Level 3: a picture with a frame of width x. The drawing (also the picture of the lesson's
// explain step) and the lab: slide x until picture and frame cover the target area, then show
// the parabola of the area: the equation has a second, negative solution that makes no sense.

const S = 5; // px per cm

/** A picture a × b (cm) with a frame of width x all around, labelled like in the exercise book. */
export function FrameDrawing({ a = 30, b = 18, x = 3, symbolic = true }: { a?: number; b?: number; x?: number; symbolic?: boolean }) {
  const t = useText();
  const locale = useLocale();
  const W = (a + 2 * x) * S;
  const H = (b + 2 * x) * S;
  const VW = 300;
  const VH = 230;
  const ox = (VW - W) / 2 + 12;
  const oy = (VH - H) / 2 + 10;
  const n = (v: number) => num(v, locale);
  const outerW = symbolic ? `${a} + 2x` : `${n(a + 2 * x)} cm`;
  const outerH = symbolic ? `${b} + 2x` : `${n(b + 2 * x)} cm`;
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="mx-auto block h-auto w-full max-w-[340px]" role="img" aria-label={t(tx(`A picture ${a} cm by ${b} cm with a frame of width x all around`, `Ein Bild, ${a} cm mal ${b} cm, mit einem ringsherum x breiten Rahmen`))}>
      <motion.rect initial={false} animate={{ x: ox, y: oy, width: W, height: H }} transition={soft} rx={3} fill="color-mix(in oklab, var(--blob) 32%, var(--raised))" stroke="var(--blob)" strokeWidth={1.5} />
      <motion.g initial={false} animate={{ x: ox + x * S, y: oy + x * S }} transition={soft}>
        <rect width={a * S} height={b * S} fill="var(--surface)" stroke="var(--ink-3)" strokeWidth={1} />
        {/* a little landscape */}
        <circle cx={a * S * 0.75} cy={b * S * 0.32} r={b * S * 0.12} fill="color-mix(in oklab, var(--blob) 55%, transparent)" />
        <path d={`M0 ${b * S * 0.78} Q ${a * S * 0.25} ${b * S * 0.45} ${a * S * 0.5} ${b * S * 0.72} T ${a * S} ${b * S * 0.6} V ${b * S} H 0 Z`} fill="color-mix(in oklab, var(--ok) 40%, transparent)" />
        <text x={(a * S) / 2} y={(b * S) / 2 + 5} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {`${a} × ${b}`}
        </text>
      </motion.g>
      {/* width on top */}
      <motion.g initial={false} animate={{ x: ox, y: oy - 12 }} transition={soft}>
        <line x1={0} x2={W} y1={0} y2={0} stroke="var(--ink-3)" strokeWidth={1} />
        <line x1={0} x2={0} y1={-4} y2={4} stroke="var(--ink-3)" />
        <line x1={W} x2={W} y1={-4} y2={4} stroke="var(--ink-3)" />
        <text x={W / 2} y={-5} textAnchor="middle" fontSize={13} fill="var(--ink)" className="font-math" stroke="var(--raised)" strokeWidth={4} paintOrder="stroke">
          {outerW}
        </text>
      </motion.g>
      {/* height on the left */}
      <motion.g initial={false} animate={{ x: ox - 12, y: oy }} transition={soft}>
        <line x1={0} x2={0} y1={0} y2={H} stroke="var(--ink-3)" strokeWidth={1} />
        <line x1={-4} x2={4} y1={0} y2={0} stroke="var(--ink-3)" />
        <line x1={-4} x2={4} y1={H} y2={H} stroke="var(--ink-3)" />
        <text x={-6} y={H / 2} textAnchor="middle" fontSize={13} fill="var(--ink)" className="font-math" transform={`rotate(-90 -6 ${H / 2})`} stroke="var(--raised)" strokeWidth={4} paintOrder="stroke">
          {outerH}
        </text>
      </motion.g>
      {/* the frame width x, bottom right */}
      {x > 0 && (
        <motion.g initial={false} animate={{ x: ox + W - x * S, y: oy + H + 9 }} transition={soft}>
          <line x1={0} x2={x * S} y1={0} y2={0} stroke="var(--blob)" strokeWidth={1.5} />
          <line x1={0} x2={0} y1={-3} y2={3} stroke="var(--blob)" />
          <line x1={x * S} x2={x * S} y1={-3} y2={3} stroke="var(--blob)" />
          <text x={(x * S) / 2} y={15} textAnchor="middle" fontSize={13} fill="var(--blob)" fontStyle="italic" className="font-math">
            {symbolic ? "x" : n(x)}
          </text>
        </motion.g>
      )}
    </svg>
  );
}

const A0 = 30;
const B0 = 18;
const TARGET = 864;
const area = (x: number) => (A0 + 2 * x) * (B0 + 2 * x);

export function FrameLab() {
  const t = useText();
  const locale = useLocale();
  const scope = useId();
  const [x, setX] = useState(1);
  const [graph, setGraph] = useState(false);
  const A = area(x);
  const n = (v: number) => num(v, locale);
  const hit = Math.abs(A - TARGET) < 1e-9;

  const say: { text: Text; mood: "happy" | "thinking" | "excited" } = hit
    ? graph
      ? {
          text: tx(
            "Exactly 864 cm² at $x = 3$! The parabola hits 864 a second time, at $x = -27$. That solves the equation too, but a frame can't be $-27$ cm wide. So only $x = 3$ makes sense.",
            "Genau 864 cm² bei $x = 3$! Die Parabel erreicht 864 noch ein zweites Mal, bei $x = -27$. Das löst die Gleichung auch, aber ein Rahmen kann nicht $-27$ cm breit sein. Sinnvoll ist also nur $x = 3$.",
          ),
          mood: "excited",
        }
      : { text: tx("Exactly 864 cm²! The frame is 3 cm wide. Now show the graph: the equation hides a second solution.", "Genau 864 cm²! Der Rahmen ist 3 cm breit. Blende jetzt den Graphen ein: Die Gleichung versteckt noch eine zweite Lösung."), mood: "excited" }
    : A < TARGET
      ? { text: tx(`${n(A)} cm² is too small. Make the frame wider!`, `${n(A)} cm² ist zu wenig. Mach den Rahmen breiter!`), mood: "thinking" }
      : { text: tx(`${n(A)} cm² is too much. Make the frame narrower!`, `${n(A)} cm² ist zu viel. Mach den Rahmen schmaler!`), mood: "thinking" };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed text-ink">
        {t(
          tx(
            "A picture is 30 cm wide and 18 cm high. How wide must a frame (equally wide all around) be, so that picture and frame together cover 864 cm²?",
            "Ein Bild ist 30 cm breit und 18 cm hoch. Wie breit muss ein Rahmen (ringsherum gleich breit) sein, damit Bild und Rahmen zusammen 864 cm² bedecken?",
          ),
        )}
      </div>

      <div className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-line bg-surface p-2">
          <FrameDrawing a={A0} b={B0} x={x} />
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface px-4 py-3">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Area outside", "Fläche außen"))}</div>
            <MathView src={`(30 + 2x)(18 + 2x) = ${TARGET}`} size="md" animate={false} className="mt-1 text-ink-2" />
            <MathView
              src={`(30 + 2 \\cdot ${n(x)})(18 + 2 \\cdot ${n(x)}) = ${n(A0 + 2 * x)} \\cdot ${n(B0 + 2 * x)} = ${hit ? `\\green{${n(A)}}` : n(A)}`}
              size="sm"
              animate={false}
              className="mt-1.5"
            />
            {/* area gauge with the target */}
            <div className="relative mt-3 h-3 rounded-full bg-line">
              <motion.div className={cn("absolute inset-y-0 left-0 rounded-full", hit ? "bg-ok" : A > TARGET ? "bg-danger" : "bg-blob")} initial={false} animate={{ width: `${Math.min(100, (A / 1300) * 100)}%` }} transition={soft} />
              <div className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${(TARGET / 1300) * 100}%` }} />
            </div>
            <div className="relative mt-1 h-4 text-[11.5px] text-ink-3">
              <span className="absolute left-0">0</span>
              <span className="absolute -translate-x-1/2 font-semibold text-ink-2" style={{ left: `${(TARGET / 1300) * 100}%` }}>
                {t(tx("goal: 864 cm²", "Ziel: 864 cm²"))}
              </span>
            </div>
          </div>
          <label className="flex items-center gap-3">
            <span className="shrink-0 font-math text-[17px] text-ink">
              <i>x</i> = <span className="tabular-nums">{n(x)}</span> cm
            </span>
            <input
              id={`${scope}-x`}
              type="range"
              min={0}
              max={6}
              step={0.5}
              value={x}
              onChange={(e) => setX(Number(e.target.value))}
              aria-label={t(tx("Width of the frame", "Breite des Rahmens"))}
              className="h-10 w-full cursor-pointer accent-[var(--blob)]"
            />
          </label>
          <button
            type="button"
            onClick={() => setGraph((v) => !v)}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors", graph ? "border-blob/40 bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {graph ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {graph ? t(tx("Hide the graph", "Graph ausblenden")) : t(tx("Show the graph of the area", "Graph der Fläche zeigen"))}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {graph && (
          <motion.div key="graph" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={soft} className="overflow-hidden">
            <AreaParabola x={x} />
          </motion.div>
        )}
      </AnimatePresence>

      <BlobSays text={say.text} mood={say.mood} />
    </div>
  );
}

const GW = 380;
const GH = 220;
const GM = { l: 44, r: 12, t: 12, b: 30 };
const X0 = -32;
const X1 = 8;
const Y0 = -200;
const Y1 = 1400;

function AreaParabola({ x }: { x: number }) {
  const t = useText();
  const locale = useLocale();
  const px = (v: number) => GM.l + ((v - X0) / (X1 - X0)) * (GW - GM.l - GM.r);
  const py = (v: number) => GH - GM.b - ((v - Y0) / (Y1 - Y0)) * (GH - GM.t - GM.b);
  let d = "";
  for (let i = 0; i <= 160; i++) {
    const v = X0 + ((X1 - X0) * i) / 160;
    const y = area(v);
    if (y > Y1) continue;
    d += `${d ? "L" : "M"}${px(v).toFixed(1)} ${py(y).toFixed(1)}`;
  }
  const xTicks = [-30, -20, -10, 0];
  const yTicks = [0, 400, 800, 1200];
  return (
    <svg viewBox={`0 0 ${GW} ${GH}`} className="block h-auto w-full rounded-xl border border-line bg-surface" role="img" aria-label={t(tx("Graph of the area (30 + 2x)(18 + 2x)", "Graph der Fläche (30 + 2x)(18 + 2x)"))}>
      <rect x={px(0)} y={GM.t} width={px(X1) - px(0)} height={GH - GM.t - GM.b} fill="color-mix(in oklab, var(--ok) 10%, transparent)" />
      {yTicks.map((v) => (
        <g key={`y${v}`}>
          <line x1={GM.l} x2={GW - GM.r} y1={py(v)} y2={py(v)} stroke={v === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={v === 0 ? 1.2 : 0.8} />
          <text x={GM.l - 5} y={py(v) + 3.5} textAnchor="end" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {v}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={`x${v}`}>
          <line x1={px(v)} x2={px(v)} y1={GM.t} y2={GH - GM.b} stroke={v === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={v === 0 ? 1.2 : 0.8} />
          <text x={px(v)} y={GH - GM.b + 13} textAnchor="middle" fontSize={10} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {String(v).replace("-", "−")}
          </text>
        </g>
      ))}
      <text x={GW - GM.r} y={GH - 4} textAnchor="end" fontSize={11} fill="var(--ink-2)" fontStyle="italic" className="font-math">
        x
      </text>
      <text x={px(0) + 6} y={GM.t + 10} fontSize={10.5} fill="var(--ok)" fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("real frames", "echte Rahmen"))}
      </text>
      <line x1={GM.l} x2={GW - GM.r} y1={py(TARGET)} y2={py(TARGET)} stroke="var(--blob)" strokeDasharray="5 4" strokeWidth={1.4} />
      <text x={GM.l + 4} y={py(TARGET) - 5} fontSize={10.5} fill="var(--blob)" fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
        864
      </text>
      <motion.path d={d} fill="none" stroke="var(--ink)" strokeWidth={2.4} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      <circle cx={px(-27)} cy={py(TARGET)} r={6} fill="none" stroke="var(--danger)" strokeWidth={2.4} />
      <text x={px(-27)} y={py(TARGET) + 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--danger)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" style={{ fontFamily: "var(--font-sans)" }}>
        x = −27
      </text>
      <circle cx={px(3)} cy={py(TARGET)} r={6} fill="none" stroke="var(--ok)" strokeWidth={2.4} />
      <text x={px(3) + 8} y={py(TARGET) + 20} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ok)" stroke="var(--surface)" strokeWidth={3} paintOrder="stroke" style={{ fontFamily: "var(--font-sans)" }}>
        x = 3
      </text>
      <motion.circle initial={false} animate={{ cx: px(x), cy: py(area(x)) }} transition={soft} r={5.5} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
      <text x={GW - GM.r - 2} y={GM.t + 10} textAnchor="end" fontSize={10.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {`(${num(x, locale)} | ${num(area(x), locale)})`}
      </text>
    </svg>
  );
}
