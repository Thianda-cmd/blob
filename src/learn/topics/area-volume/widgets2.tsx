"use client";

// Level 2 widgets: a triangle / parallelogram with a draggable apex (base and height, shearing,
// any side as the base), and a circle lab (roll a wheel to see π, cut a circle into sectors).

import { AnimatePresence, motion } from "motion/react";
import { Play, RotateCcw } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";
import { Segmented, Stepper, TINT, useNum } from "./ui";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
type V = [number, number];
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Base and height

const S = 30;
const X0 = -4;
const X1 = 12;
const Y1 = 7;
const PAD = { l: 16, r: 16, t: 16, b: 30 };

type Side = "c" | "a" | "b";

export function AreaVolumeBaseHeight() {
  const t = useText();
  const num = useNum();
  const scope = useId();
  const [mode, setMode] = useState<"tri" | "para">("tri");
  const [g, setG] = useState(6);
  const [apex, setApex] = useState<V>([2, 4]);
  const [side, setSide] = useState<Side>("c");
  const [drag, setDrag] = useState(false);
  const svg = useRef<SVGSVGElement>(null);

  const W = (X1 - X0) * S + PAD.l + PAD.r;
  const H = Y1 * S + PAD.t + PAD.b;
  const px = (p: V): V => [PAD.l + (p[0] - X0) * S, PAD.t + (Y1 - p[1]) * S];
  const pts = (list: V[]) => list.map((p) => px(p).join(",")).join(" ");

  function moveTo(e: PointerEvent) {
    const el = svg.current;
    const ctm = el?.getScreenCTM();
    if (!el || !ctm) return;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(ctm.inverse());
    const x = clamp(Math.round((p.x - PAD.l) / S + X0), X0, X1 - (mode === "para" ? g : 0));
    const y = clamp(Math.round(Y1 - (p.y - PAD.t) / S), 1, Y1);
    setApex([x, y]);
  }
  function onKey(e: KeyboardEvent) {
    const moves: Record<string, V> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setApex(([x, y]) => [clamp(x + m[0], X0, X1 - (mode === "para" ? g : 0)), clamp(y + m[1], 1, Y1)]);
  }
  function changeMode(m: "tri" | "para") {
    setMode(m);
    setSide("c");
    setApex(([x, y]) => [Math.min(x, X1 - (m === "para" ? g : 0)), y]);
  }
  function changeG(v: number) {
    setG(v);
    if (mode === "para") setApex(([x, y]) => [Math.min(x, X1 - v), y]);
  }

  const A: V = [0, 0];
  const B: V = [g, 0];
  const C: V = apex;
  const area2 = g * C[1]; // twice the triangle area
  const tri = mode === "tri";

  // The chosen base and the height onto it (triangle only; the parallelogram uses AB).
  const base: [V, V, V] = !tri || side === "c" ? [A, B, C] : side === "a" ? [B, C, A] : [C, A, B];
  const [P, Q, top] = base;
  const u: V = [Q[0] - P[0], Q[1] - P[1]];
  const gl = Math.hypot(u[0], u[1]);
  const un: V = [u[0] / gl, u[1] / gl];
  const tpos = (top[0] - P[0]) * un[0] + (top[1] - P[1]) * un[1];
  const foot: V = [P[0] + un[0] * tpos, P[1] + un[1] * tpos];
  const hl = Math.hypot(top[0] - foot[0], top[1] - foot[1]);
  const outside = tpos < -1e-9 || tpos > gl + 1e-9;
  const extFrom: V = tpos < 0 ? P : Q;
  const vUp: V = hl > 1e-9 ? [(top[0] - foot[0]) / hl, (top[1] - foot[1]) / hl] : [0, 1];
  const sideDir: V = tpos > gl / 2 ? [-un[0], -un[1]] : un;
  const k = 0.32;
  const mark: V[] = [
    [foot[0] + sideDir[0] * k, foot[1] + sideDir[1] * k],
    [foot[0] + sideDir[0] * k + vUp[0] * k, foot[1] + sideDir[1] * k + vUp[1] * k],
    [foot[0] + vUp[0] * k, foot[1] + vUp[1] * k],
  ];

  const D: V = [C[0] + g, C[1]];
  const shape: V[] = tri ? [A, B, C] : [A, B, D, C];
  const ghost: V[] = [B, [B[0] + C[0], C[1]], C];
  const exact = Number.isInteger(gl) && Number.isInteger(hl);
  const fmt = (v: number) => (Number.isInteger(r2(v)) ? num(r2(v)) : num(r2(v), 2));
  const areaText = tri ? (area2 % 2 === 0 ? num(area2 / 2) : num(area2 / 2, 1)) : num(area2);
  const formula = tri
    ? `A#A =#e \\frac{g#g \\cdot#m h#h}{2#two}#fr ${exact ? "=" : "\\approx"}#e2 \\frac{${fmt(gl)}#gv \\cdot#m2 ${fmt(hl)}#hv}{2#two2}#fr2 =#e3 ${areaText}#r "cm²"#u`
    : `A#A =#e g#g \\cdot#m h#h =#e2 ${g}#gv \\cdot#m2 ${C[1]}#hv =#e3 ${areaText}#r "cm²"#u`;
  const labelAt = (p: V, d: V, text: string, cls = "fill-ink") => {
    const [x, y] = px(p);
    return (
      <text x={x + d[0]} y={y + d[1]} textAnchor="middle" dominantBaseline="central" fontSize={15} className={cn("font-math italic", cls)} stroke="var(--raised)" strokeWidth={3.5} paintOrder="stroke">
        {text}
      </text>
    );
  };
  const names: [V, string][] = tri ? [[A, "A"], [B, "B"], [C, "C"]] : [[A, "A"], [B, "B"], [D, "C"], [C, "D"]];
  const cen: V = [shape.reduce((s, p) => s + p[0], 0) / shape.length, shape.reduce((s, p) => s + p[1], 0) / shape.length];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <Segmented
          options={[
            { id: "tri", label: tx("Triangle", "Dreieck") },
            { id: "para", label: tx("Parallelogram", "Parallelogramm") },
          ]}
          value={mode}
          onChange={changeMode}
        />
        <Stepper label="g" name={tx("base", "Grundseite")} value={g} min={2} max={8} onChange={changeG} />
      </div>

      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto w-full max-w-[560px] touch-none select-none"
        role="img"
        aria-label={t(tx(`${tri ? "Triangle" : "Parallelogram"} with base ${g} and height ${C[1]}`, `${tri ? "Dreieck" : "Parallelogramm"} mit Grundseite ${g} und Höhe ${C[1]}`))}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          setDrag(true);
          moveTo(e);
        }}
        onPointerMove={(e) => drag && moveTo(e)}
        onPointerUp={() => setDrag(false)}
        onPointerCancel={() => setDrag(false)}
      >
        <g stroke="var(--ink-3)" strokeOpacity={0.3} strokeWidth={0.7}>
          {Array.from({ length: X1 - X0 + 1 }, (_, i) => (
            <line key={`v${i}`} x1={PAD.l + i * S} x2={PAD.l + i * S} y1={PAD.t} y2={PAD.t + Y1 * S} />
          ))}
          {Array.from({ length: Y1 + 1 }, (_, i) => (
            <line key={`h${i}`} x1={PAD.l} x2={PAD.l + (X1 - X0) * S} y1={PAD.t + i * S} y2={PAD.t + i * S} />
          ))}
        </g>
        {tri && side === "c" && <polygon points={pts(ghost)} fill="color-mix(in oklab, var(--ink) 5%, transparent)" stroke="var(--ink-3)" strokeDasharray="5 4" strokeWidth={1.3} />}
        <polygon points={pts(shape)} fill={TINT.soft} stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
        <line x1={px(P)[0]} y1={px(P)[1]} x2={px(Q)[0]} y2={px(Q)[1]} stroke="var(--blob)" strokeWidth={4} strokeLinecap="round" />
        {outside && <line x1={px(extFrom)[0]} y1={px(extFrom)[1]} x2={px(foot)[0]} y2={px(foot)[1]} stroke="var(--ink-3)" strokeDasharray="4 4" strokeWidth={1.5} />}
        <line x1={px(top)[0]} y1={px(top)[1]} x2={px(foot)[0]} y2={px(foot)[1]} stroke="var(--blob)" strokeDasharray="6 4" strokeWidth={2} />
        <polyline points={pts(mark)} fill="none" stroke="var(--blob)" strokeWidth={1.4} />
        {labelAt([(P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2], [-un[1] * -16, un[0] * -16 * -1], "g", "fill-blob")}
        {labelAt([(top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2], [sideDir[0] * -14, -sideDir[1] * -14], "h", "fill-blob")}
        {names.map(([p, n]) => {
          const d: V = [p[0] - cen[0], p[1] - cen[1]];
          const l = Math.hypot(d[0], d[1]) || 1;
          return <g key={n}>{labelAt(p, [(d[0] / l) * 15, (-d[1] / l) * 15], n)}</g>;
        })}
        <g transform={`translate(${px(C)[0]} ${px(C)[1]})`}>
          <circle r={18} fill="var(--blob)" opacity={drag ? 0.22 : 0.12} />
          <circle
            r={8}
            fill="var(--blob)"
            stroke="var(--raised)"
            strokeWidth={2}
            tabIndex={0}
            role="slider"
            aria-label={t(tx("Top corner (arrow keys)", "Obere Ecke (Pfeiltasten)"))}
            aria-valuetext={t(tx(`height ${C[1]}`, `Höhe ${C[1]}`))}
            onKeyDown={onKey}
            style={{ cursor: drag ? "grabbing" : "grab", outline: "none" }}
          />
        </g>
      </svg>
      <p className="text-center text-[12.5px] text-ink-3">{t(tx("Drag the purple corner. One square = 1 cm.", "Zieh die lila Ecke. Ein Kästchen = 1 cm."))}</p>

      {tri && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-2">{t(tx("Base:", "Grundseite:"))}</span>
          {(["c", "a", "b"] as Side[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              aria-pressed={side === s}
              className={cn("rounded-lg border px-3 py-1 text-[13px] transition-colors", side === s ? "border-blob bg-blob text-white" : "border-line text-ink-2 hover:bg-hover")}
            >
              {s === "c" ? "c = AB" : s === "a" ? "a = BC" : "b = CA"}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="overflow-x-auto">
          <MathView src={formula} size="md" scope={`${scope}-f`} />
        </div>
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          <Inline
            text={
              tri
                ? side === "c"
                  ? tx("Two copies of the triangle make a parallelogram (dashed). So the triangle is half of $g \\cdot h$. Drag sideways: the height stays, so the area stays.", "Zwei gleiche Dreiecke ergeben ein Parallelogramm (gestrichelt). Das Dreieck ist also die Hälfte von $g \\cdot h$. Zieh zur Seite: Die Höhe bleibt, also bleibt die Fläche.")
                  : tx("Another side as the base, another height, but the same area. The height always stands at a right angle on the base (or its extension).", "Andere Seite als Grundseite, andere Höhe, aber dieselbe Fläche. Die Höhe steht immer senkrecht auf der Grundseite (oder ihrer Verlängerung).")
                : tx("Drag sideways: the parallelogram leans, but base and height stay, so the area stays the same.", "Zieh zur Seite: Das Parallelogramm wird schiefer, aber Grundseite und Höhe bleiben, also bleibt die Fläche gleich.")
            }
          />
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circle lab

const NS = [4, 6, 8, 12, 16, 24, 32];

function sectorPath(cx: number, cy: number, R: number, a0: number, a1: number, steps = 10) {
  const out: string[] = [`M${r2(cx)},${r2(cy)}`];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(`L${r2(cx + R * cos(a))},${r2(cy + R * sin(a))}`);
  }
  return `${out.join("")}Z`;
}

function RollTab() {
  const t = useText();
  const num = useNum();
  const scope = useId();
  const [d, setD] = useState(3);
  const [rolled, setRolled] = useState(false);
  const U = 26;
  const r = (d * U) / 2;
  // The wheel starts one biggest radius (d = 4) from the left edge, so it is never cut off.
  const x0 = 2 * U + 12;
  const ground = 14 + 4 * U;
  const len = Math.PI * d * U;
  const W = x0 + Math.PI * 4 * U + 60;
  const H = ground + 46;
  const transition = { duration: 2.6, ease: "easeInOut" as const };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Stepper
          label="d"
          name={tx("diameter", "Durchmesser")}
          value={d}
          min={2}
          max={4}
          unit="cm"
          onChange={(v) => {
            setD(v);
            setRolled(false);
          }}
        />
        <button
          type="button"
          onClick={() => setRolled((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blob px-3 py-1.5 text-[13px] font-medium text-white hover:bg-blob/90"
        >
          {rolled ? <RotateCcw className="size-3.5" /> : <Play className="size-3.5" />}
          {rolled ? t(tx("Roll back", "Zurückrollen")) : t(tx("Roll once", "Einmal abrollen"))}
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[520px]" role="img" aria-label={t(tx("A wheel rolls once along a line", "Ein Rad rollt einmal ab"))}>
        <line x1={6} x2={W - 6} y1={ground} y2={ground} stroke="var(--ink-3)" strokeWidth={1.5} />
        {[1, 2, 3].map((k) => (
          <g key={k}>
            <line x1={x0 + k * d * U} x2={x0 + k * d * U} y1={ground - 6} y2={ground + 6} stroke="var(--ink-2)" strokeWidth={1.5} />
            <text x={x0 + k * d * U} y={ground + 20} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
              {k}d
            </text>
          </g>
        ))}
        <motion.rect x={x0} y={ground - 2.5} height={5} rx={2.5} fill="var(--blob)" initial={false} animate={{ width: rolled ? len : 0 }} transition={transition} />
        <motion.g initial={false} animate={{ opacity: rolled ? 1 : 0 }} transition={{ delay: rolled ? 2.4 : 0, duration: 0.3 }}>
          <line x1={x0 + len} x2={x0 + len} y1={ground - 10} y2={ground + 10} stroke="var(--blob)" strokeWidth={2.5} />
          <text x={x0 + len} y={ground + 36} textAnchor="middle" fontSize={14} fontWeight={600} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
            {`u ≈ ${num(3.14, 2)} · d`}
          </text>
        </motion.g>
        <g transform={`translate(${x0} ${ground - r})`}>
          <motion.g initial={false} animate={{ x: rolled ? len : 0 }} transition={transition}>
            <motion.g initial={false} animate={{ rotate: rolled ? 360 : 0 }} transition={transition}>
              <circle r={r} fill={TINT.soft} stroke="var(--ink)" strokeWidth={2} />
              <line x1={0} y1={-r} x2={0} y2={r} stroke="var(--ink-3)" strokeWidth={1.2} />
              <circle r={2.5} fill="var(--ink)" />
              <circle cx={0} cy={r} r={5} fill="var(--blob)" />
            </motion.g>
          </motion.g>
        </g>
      </svg>
      <div className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={`u#u =#e \\pi#pi \\cdot#m d#d \\approx#e2 ${num(3.14, 2)}#p \\cdot#m2 ${d}#dv "cm"#c1 \\approx#e3 ${num(Math.PI * d, 2)}#r "cm"#c2`} size="md" scope={`${scope}-u`} />
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {t(tx("The purple dot touches the ground again after one turn. The track is a bit more than 3 diameters long: exactly π times the diameter.", "Der lila Punkt berührt nach einer Umdrehung wieder den Boden. Die Strecke ist etwas länger als 3 Durchmesser: genau π-mal der Durchmesser."))}
        </p>
      </div>
    </div>
  );
}

function SectorTab() {
  const t = useText();
  const scope = useId();
  const [idx, setIdx] = useState(2);
  const n = NS[idx];
  const R = 62;
  const th = (2 * Math.PI) / n;
  const c = 2 * R * sin(th / 2);
  const tint = (k: number) => (k % 2 === 0 ? TINT.mid : TINT.side);
  const stripW = (n / 2) * c + c / 2;
  const SW = Math.PI * R + 2 * R * sin(Math.PI / 4) / 2 + 60;
  const SH = R + 56;
  const bx = 30 + (Math.PI * R + c / 2 - stripW) / 2;
  const by = 20 + R;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-3 text-[14px] text-ink-2">
          <span>{t(tx("Pieces", "Stücke"))}</span>
          <input
            type="range"
            min={0}
            max={NS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            aria-valuetext={String(n)}
            className="w-40 accent-blob"
          />
          <motion.span key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-8 font-semibold tabular-nums text-ink">
            {n}
          </motion.span>
        </label>
      </div>
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)]">
        <svg viewBox={`0 0 ${2 * R + 20} ${2 * R + 20}`} className="mx-auto w-full max-w-[170px]" role="img" aria-label={t(tx(`Circle cut into ${n} pieces`, `Kreis in ${n} Stücke geschnitten`))}>
          {Array.from({ length: n }, (_, k) => (
            <path key={`${n}-${k}`} d={sectorPath(R + 10, R + 10, R, -Math.PI / 2 + k * th, -Math.PI / 2 + (k + 1) * th)} fill={tint(k)} stroke="var(--ink)" strokeWidth={n >= 16 ? 0.6 : 1} strokeLinejoin="round" />
          ))}
          <line x1={R + 10} y1={R + 10} x2={2 * R + 10} y2={R + 10} stroke="var(--blob)" strokeWidth={2.5} />
          <text x={R + 10 + R / 2} y={R + 4} textAnchor="middle" fontSize={15} className="fill-blob font-math italic" stroke="var(--raised)" strokeWidth={4} paintOrder="stroke">
            r
          </text>
        </svg>
        <svg viewBox={`0 0 ${SW} ${SH}`} className="mx-auto w-full max-w-[340px]" role="img" aria-label={t(tx("The pieces laid out side by side", "Die Stücke nebeneinander gelegt"))}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.g key={n} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {Array.from({ length: n }, (_, k) => {
                const up = k % 2 === 1;
                const ax = bx + (up ? ((k - 1) / 2) * c + c / 2 : (k / 2) * c);
                const ay = up ? by - R : by;
                const mid = up ? Math.PI / 2 : -Math.PI / 2;
                return <path key={k} d={sectorPath(ax, ay, R, mid - th / 2, mid + th / 2)} fill={tint(k)} stroke="var(--ink)" strokeWidth={n >= 16 ? 0.6 : 1} strokeLinejoin="round" />;
              })}
            </motion.g>
          </AnimatePresence>
          <line x1={bx} x2={bx + Math.PI * R} y1={by + 14} y2={by + 14} stroke="var(--blob)" strokeWidth={1.5} />
          <line x1={bx} x2={bx} y1={by + 9} y2={by + 19} stroke="var(--blob)" strokeWidth={1.5} />
          <line x1={bx + Math.PI * R} x2={bx + Math.PI * R} y1={by + 9} y2={by + 19} stroke="var(--blob)" strokeWidth={1.5} />
          <text x={bx + (Math.PI * R) / 2} y={by + 32} textAnchor="middle" fontSize={14} fill="var(--blob)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("half the circumference: π · r", "halber Umfang: π · r"))}
          </text>
          <line x1={bx - 10} x2={bx - 10} y1={by - R} y2={by} stroke="var(--blob)" strokeWidth={1.5} />
          <text x={bx - 16} y={by - R / 2 + 5} textAnchor="end" fontSize={14} className="fill-blob font-math italic">
            r
          </text>
        </svg>
      </div>
      <div className="space-y-1.5 rounded-xl border border-line bg-surface px-4 py-3">
        <MathView src={`A#A \\approx#e (\\pi#pi \\cdot#m r#r1)#br \\cdot#m2 r#r2 =#e2 \\pi#pi2 r#r3^{2#sq}`} size="md" scope={`${scope}-a`} />
        <p className="text-[13.5px] leading-relaxed text-ink-2">
          {t(tx("Half of the pieces point up, half point down. The more pieces, the more the shape looks like a rectangle: π · r long and r high.", "Die Hälfte der Stücke zeigt nach oben, die andere nach unten. Je mehr Stücke, desto mehr sieht die Figur aus wie ein Rechteck: π · r lang und r hoch."))}
        </p>
      </div>
    </div>
  );
}

export function AreaVolumeCircleLab() {
  const [tab, setTab] = useState<"roll" | "cut">("roll");
  return (
    <div className="space-y-4">
      <Segmented
        options={[
          { id: "roll", label: tx("Circumference", "Umfang") },
          { id: "cut", label: tx("Area", "Flächeninhalt") },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "roll" ? <RollTab /> : <SectorTab />}
    </div>
  );
}
