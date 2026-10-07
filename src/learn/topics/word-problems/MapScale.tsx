"use client";

// Widget: measure on a map. Two pins on a small town map (10 cm × 6 cm on paper); the
// distance between them is measured to the millimetre, and the chosen scale 1 : n
// turns it into the real distance (map cm · n = real cm, then into m or km).

import { motion } from "motion/react";
import { useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { mn, nf } from "./kit";
import { HowTo, Label, Segmented, spring } from "./ui";

const U = 36; // drawing units per map centimetre
const MW = 10; // map width in cm
const MH = 6; // map height in cm
const SNAP = 0.5;

type P = [number, number];

const SCALES = [10000, 25000, 50000, 100000] as const;
type Scale = (typeof SCALES)[number];

/** The scale bar (Maßstabsleiste) for each scale: its length on the map and what it stands for. */
const BAR: Record<Scale, { cm: number; label: string }> = {
  10000: { cm: 5, label: "500 m" },
  25000: { cm: 4, label: "1 km" },
  50000: { cm: 4, label: "2 km" },
  100000: { cm: 3, label: "3 km" },
};

const PLACES: { at: P; name: Text; dx?: number; dy?: number; anchor?: "start" | "middle" | "end" }[] = [
  { at: [1, 1], name: tx("Station", "Bahnhof"), dy: -0.42 },
  { at: [1, 5], name: tx("School", "Schule"), dy: 0.62 },
  { at: [7, 5], name: tx("Pool", "Freibad"), dy: 0.62 },
  { at: [9, 1], name: tx("Castle", "Burg"), dy: -0.42, anchor: "end", dx: 0.3 },
  { at: [5, 3], name: tx("Church", "Kirche"), dy: -0.42 },
];

/** Real length in cm → readable: metres below 1 km, else kilometres. */
function realText(cm: number, l: Locale): { value: string; unit: string; n: number; digits: number } {
  if (cm >= 100000) return { value: nf(cm / 100000, l, 3), unit: "km", n: cm / 100000, digits: 3 };
  return { value: nf(cm / 100, l, 1), unit: "m", n: cm / 100, digits: 1 };
}

const scaleLabel = (n: number, l: Locale) => `1 : ${nf(n, l, 0).replace(/[.,]/g, " ")}`;

export function MapScale() {
  const t = useText();
  const l = useLocale();
  const id = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const [pins, setPins] = useState<[P, P]>([
    [1, 5],
    [7, 5],
  ]);
  const [scale, setScale] = useState<Scale>(25000);
  const [drag, setDrag] = useState<number | null>(null);

  const [a, b] = pins;
  const exact = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const mapCm = Math.round(exact * 10) / 10; // measured to the millimetre
  const realCm = Math.round(mapCm * scale);
  const real = realText(realCm, l);
  const oneCm = realText(scale, l);

  function toMap(e: React.PointerEvent): P {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const x = Math.round(p.x / U / SNAP) * SNAP;
    const y = Math.round(p.y / U / SNAP) * SNAP;
    return [Math.min(MW - 0.5, Math.max(0.5, x)), Math.min(MH - 0.5, Math.max(0.5, y))];
  }

  function move(i: number, p: P) {
    setPins((old) => {
      const other = old[1 - i];
      if (p[0] === other[0] && p[1] === other[1]) return old;
      const next: [P, P] = [old[0], old[1]];
      next[i] = p;
      return next;
    });
  }

  function key(i: number, e: React.KeyboardEvent) {
    const d: Record<string, P> = { ArrowLeft: [-SNAP, 0], ArrowRight: [SNAP, 0], ArrowUp: [0, -SNAP], ArrowDown: [0, SNAP] };
    const step = d[e.key];
    if (!step) return;
    e.preventDefault();
    const p = pins[i];
    move(i, [Math.min(MW - 0.5, Math.max(0.5, p[0] + step[0])), Math.min(MH - 0.5, Math.max(0.5, p[1] + step[1]))]);
  }

  // The distance label sits beside the line (on the upper side), not on top of the places.
  const len = Math.max(exact, 1e-9);
  let nx = -(b[1] - a[1]) / len;
  let ny = (b[0] - a[0]) / len;
  if (ny > 0 || (ny === 0 && nx > 0)) {
    nx = -nx;
    ny = -ny;
  }
  const mid: P = [(a[0] + b[0]) / 2 + nx * 0.42, (a[1] + b[1]) / 2 + ny * 0.42];
  const bar = BAR[scale];
  const calc = `${mn(mapCm, l, "d", 1)} "cm"#u1 \\cdot#op ${mn(scale, l, "n")} =#e1 ${mn(realCm, l, "r")} "cm"#u2 =#e2 ${mn(real.n, l, "k", real.digits)} "${real.unit}"#u3`;

  return (
    <div className="space-y-4">
      <HowTo
        text={tx(
          "Drag the pins **A** and **B** (or select one and use the arrow keys). The map distance is measured to the millimetre; the scale turns it into the real distance.",
          "Zieh die Nadeln **A** und **B** (oder wähl eine aus und nimm die Pfeiltasten). Die Strecke auf der Karte wird auf den Millimeter gemessen, der Maßstab macht daraus die echte Entfernung.",
        )}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[13px] text-ink-2">{t(tx("Scale", "Maßstab"))}</span>
        <Segmented
          id={`${id}-scale`}
          label={tx("Scale", "Maßstab")}
          size="sm"
          value={scale}
          onChange={setScale}
          options={SCALES.map((n) => ({ value: n, label: scaleLabel(n, l) }))}
        />
      </div>

      <div className="mx-auto max-w-[620px]">
        <svg
          ref={svgRef}
          viewBox={`-8 -8 ${MW * U + 16} ${MH * U + 50}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label={t(tx("Town map with two pins", "Stadtplan mit zwei Nadeln"))}
          onPointerMove={(e) => {
            if (drag !== null) move(drag, toMap(e));
          }}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
        >
          <defs>
            <clipPath id={`${id}-clip`}>
              <rect x={0} y={0} width={MW * U} height={MH * U} rx={10} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-clip)`}>
            <rect x={0} y={0} width={MW * U} height={MH * U} fill="var(--surface)" />
            {/* map grid: every half centimetre */}
            {Array.from({ length: MW * 2 + 1 }, (_, i) => (
              <line key={`v${i}`} x1={(i * U) / 2} x2={(i * U) / 2} y1={0} y2={MH * U} stroke="var(--line)" strokeWidth={i % 2 ? 0.5 : 1} />
            ))}
            {Array.from({ length: MH * 2 + 1 }, (_, i) => (
              <line key={`h${i}`} x1={0} x2={MW * U} y1={(i * U) / 2} y2={(i * U) / 2} stroke="var(--line)" strokeWidth={i % 2 ? 0.5 : 1} />
            ))}
            {/* forest */}
            <path
              d={`M ${5.6 * U} ${-0.2 * U} C ${6.4 * U} ${0.9 * U}, ${7.6 * U} ${1.6 * U}, ${8.1 * U} ${2.2 * U} C ${8.9 * U} ${2.6 * U}, ${10.4 * U} ${2.4 * U}, ${10.4 * U} ${2.2 * U} L ${10.4 * U} ${-0.2 * U} Z`}
              fill="color-mix(in oklab, var(--ok) 20%, transparent)"
            />
            {[
              [6.6, 0.5],
              [7.4, 0.9],
              [8.2, 0.4],
              [8.6, 1.6],
              [9.5, 1.9],
              [7.9, 1.4],
            ].map(([x, y], i) => (
              <path key={i} d={`M ${x * U} ${(y - 0.22) * U} l ${0.16 * U} ${0.3 * U} h ${-0.32 * U} Z`} fill="color-mix(in oklab, var(--ok) 55%, transparent)" />
            ))}
            {/* lake */}
            <ellipse cx={8.6 * U} cy={3.9 * U} rx={1.1 * U} ry={0.6 * U} fill="color-mix(in oklab, var(--blob) 18%, transparent)" stroke="color-mix(in oklab, var(--blob) 35%, transparent)" />
            {/* river */}
            <path
              d={`M ${3.3 * U} ${-0.2 * U} C ${2.6 * U} ${1.5 * U}, ${3.9 * U} ${2.6 * U}, ${3.2 * U} ${3.8 * U} S ${2.4 * U} ${5.4 * U}, ${2.9 * U} ${6.2 * U}`}
              fill="none"
              stroke="color-mix(in oklab, var(--blob) 32%, transparent)"
              strokeWidth={7}
              strokeLinecap="round"
            />
            {/* roads */}
            <g fill="none" stroke="var(--ink-3)" strokeOpacity={0.45} strokeWidth={3.2} strokeLinecap="round">
              <path d={`M ${1 * U} ${1 * U} L ${1 * U} ${5 * U} L ${7 * U} ${5 * U}`} />
              <path d={`M ${1 * U} ${1 * U} C ${3 * U} ${1.4 * U}, ${4 * U} ${2.6 * U}, ${5 * U} ${3 * U} S ${6.6 * U} ${4.4 * U}, ${7 * U} ${5 * U}`} />
              <path d={`M ${5 * U} ${3 * U} C ${6.2 * U} ${2.3 * U}, ${8 * U} ${1.6 * U}, ${9 * U} ${1 * U}`} />
            </g>
          </g>
          <rect x={0} y={0} width={MW * U} height={MH * U} rx={10} fill="none" stroke="var(--line-2)" />

          {/* places */}
          {PLACES.map((p) => (
            <g key={p.at.join()}>
              <rect x={p.at[0] * U - 4.5} y={p.at[1] * U - 4.5} width={9} height={9} rx={2} fill="var(--raised)" stroke="var(--ink-2)" strokeWidth={1.5} />
              <text
                x={(p.at[0] + (p.dx ?? 0)) * U}
                y={(p.at[1] + (p.dy ?? 0)) * U}
                textAnchor={p.anchor ?? "middle"}
                fontSize={12}
                fill="var(--ink-2)"
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {t(p.name)}
              </text>
            </g>
          ))}

          {/* scale bar */}
          <g transform={`translate(0 ${MH * U + 30})`}>
            <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={scale}>
              {Array.from({ length: bar.cm }, (_, i) => (
                <rect key={i} x={i * U} y={-3} width={U} height={5} fill={i % 2 ? "var(--raised)" : "var(--ink)"} stroke="var(--ink)" strokeWidth={0.8} />
              ))}
              <text x={0} y={-6} fontSize={10.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                0
              </text>
              <text x={bar.cm * U} y={-6} fontSize={10.5} textAnchor="end" fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                {bar.label}
              </text>
            </motion.g>
          </g>

          {/* measuring line */}
          <motion.line
            initial={false}
            animate={{ x1: a[0] * U, y1: a[1] * U, x2: b[0] * U, y2: b[1] * U }}
            transition={spring}
            stroke="var(--blob)"
            strokeWidth={2.5}
            strokeDasharray="6 5"
            strokeLinecap="round"
          />
          <motion.g initial={false} animate={{ x: mid[0] * U, y: mid[1] * U }} transition={spring}>
            <rect x={-27} y={-9} width={54} height={18} rx={9} fill="var(--blob)" />
            <text y={4} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="white" style={{ fontFamily: "var(--font-sans)" }}>
              {nf(mapCm, l, 1)} cm
            </text>
          </motion.g>

          {/* pins */}
          {pins.map((p, i) => (
            <motion.g
              key={i}
              initial={false}
              animate={{ x: p[0] * U, y: p[1] * U }}
              transition={spring}
              tabIndex={0}
              role="slider"
              aria-label={t(tx(`Pin ${i ? "B" : "A"}`, `Nadel ${i ? "B" : "A"}`))}
              aria-valuetext={`${nf(p[0], l, 1)} | ${nf(p[1], l, 1)}`}
              onKeyDown={(e) => key(i, e)}
              onPointerDown={(e) => {
                (e.target as Element).setPointerCapture?.(e.pointerId);
                setDrag(i);
              }}
              style={{ cursor: drag === i ? "grabbing" : "grab", outline: "none" }}
              className="[&:focus-visible>circle:first-child]:opacity-40"
            >
              <circle r={17} fill="var(--blob)" opacity={drag === i ? 0.22 : 0.1} />
              <circle r={10} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
              <text y={4} textAnchor="middle" fontSize={11} fontWeight={700} fill="white" style={{ fontFamily: "var(--font-sans)" }}>
                {i ? "B" : "A"}
              </text>
            </motion.g>
          ))}
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-surface px-4 py-3">
          <Label>{t(tx("On the map", "Auf der Karte"))}</Label>
          <div className="mt-0.5 font-math text-[24px] tabular-nums text-ink">{nf(mapCm, l, 1)} cm</div>
          <div className="text-[12.5px] text-ink-3">{t(tx(`1 cm on the map is ${oneCm.value} ${oneCm.unit} in reality`, `1 cm auf der Karte sind ${oneCm.value} ${oneCm.unit} in Wirklichkeit`))}</div>
        </div>
        <div className="rounded-xl border border-blob/30 bg-blob-soft/50 px-4 py-3">
          <Label accent>{t(tx("In reality", "In Wirklichkeit"))}</Label>
          <motion.div key={`${real.value}${real.unit}`} initial={{ opacity: 0.4, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-0.5 font-math text-[24px] font-semibold tabular-nums text-blob-ink">
            {real.value} {real.unit}
          </motion.div>
          <div className="text-[12.5px] text-ink-3">{t(tx(`Scale ${scaleLabel(scale, l)}: multiply by ${nf(scale, l, 0)}`, `Maßstab ${scaleLabel(scale, l)}: mal ${nf(scale, l, 0)}`))}</div>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line px-4 py-3">
        <MathView src={calc} size="sm" scope={`${id}-calc`} />
        <p className="mt-1.5 text-[12.5px] text-ink-3">
          {t(tx("100 cm = 1 m and 100 000 cm = 1 km: cross out zeros in groups.", "100 cm = 1 m und 100 000 cm = 1 km: Streich die Nullen gruppenweise weg."))}
        </p>
      </div>
    </div>
  );
}
