"use client";

// Task pictures for transpiration experiments: the classic Vaseline experiment as a bar chart
// (mass loss of four leaves coated on different sides) and a potometer whose air bubble moves
// as the shoot takes up water.

import { useText } from "@/i18n/useText";
import { tx } from "@/i18n/text";
import { useLocale } from "@/i18n/client";

export type Coat = "none" | "top" | "bottom" | "both";

/** A little leaf seen in cross-section; coated sides get a thick grey layer. */
function LeafIcon({ x, y, coat }: { x: number; y: number; coat: Coat | null }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-26 0 Q0 -11 26 0 Q0 11 -26 0 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      {coat === null && (
        <text y={22} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          ?
        </text>
      )}
      {(coat === "top" || coat === "both") && <path d="M-25 -2 Q0 -14 25 -2" fill="none" stroke="var(--ink-3)" strokeWidth={4} strokeLinecap="round" />}
      {(coat === "bottom" || coat === "both") && <path d="M-25 2 Q0 14 25 2" fill="none" stroke="var(--ink-3)" strokeWidth={4} strokeLinecap="round" />}
    </g>
  );
}

/** Mass loss of leaves A–D after some days; `coat` per leaf (null = to be found out). */
export function PlantVaselineChart({ values, coat }: { values: number[]; coat: (Coat | null)[] }) {
  const t = useText();
  const locale = useLocale();
  const top = Math.max(...values) * 1.12;
  const step = top <= 1.2 ? 0.2 : top <= 3 ? 0.5 : top <= 6 ? 1 : 2;
  const max = Math.ceil(top / step) * step;
  const W = 460;
  const H = 270;
  const x0 = 64;
  const y0 = 196;
  const h = 160;
  const bw = 52;
  const gap = (W - x0 - 20 - values.length * bw) / values.length;
  const fmt = (v: number) => (locale === "de" ? v.toFixed(1).replace(".", ",") : v.toFixed(1));
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Math.round(i * step * 10) / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(tx("Bar chart: mass loss of four leaves", "Säulendiagramm: Massenverlust von vier Blättern"))}>
      <text x={14} y={y0 - h / 2} transform={`rotate(-90 14 ${y0 - h / 2})`} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("mass loss in g", "Massenverlust in g"))}
      </text>
      {ticks.map((v) => {
        const y = y0 - (v / max) * h;
        return (
          <g key={v}>
            <line x1={x0} x2={W - 12} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
            <text x={x0 - 8} y={y + 4} textAnchor="end" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
              {fmt(v)}
            </text>
          </g>
        );
      })}
      <line x1={x0} x2={x0} y1={y0 - h - 6} y2={y0} stroke="var(--ink-3)" strokeWidth={1.4} />
      <line x1={x0} x2={W - 12} y1={y0} y2={y0} stroke="var(--ink-3)" strokeWidth={1.4} />
      {values.map((v, i) => {
        const x = x0 + gap / 2 + i * (bw + gap);
        const bh = (v / max) * h;
        return (
          <g key={i}>
            <rect x={x} y={y0 - bh} width={bw} height={bh} rx={4} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.4} />
            <text x={x + bw / 2} y={y0 - bh - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {fmt(v)}
            </text>
            <text x={x + bw / 2} y={y0 + 20} textAnchor="middle" fontSize={15} fontWeight={800} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
              {"ABCD"[i]}
            </text>
            <LeafIcon x={x + bw / 2} y={y0 + 44} coat={coat[i]} />
          </g>
        );
      })}
    </svg>
  );
}

/** A potometer: the shoot takes up water, and the air bubble in the capillary moves towards it. */
export function PlantPotometer({ start, end, max = 60 }: { start: number; end?: number; max?: number }) {
  const t = useText();
  const x0 = 96;
  const x1 = 396;
  const y = 214;
  const px = (mm: number) => x0 + ((x1 - x0) * mm) / max;
  return (
    <svg viewBox="0 0 480 260" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("A potometer with a leafy shoot", "Ein Potometer mit einem beblätterten Spross"))}>
      {/* water reservoir on the left */}
      <path d="M14 168 L14 236 Q14 244 22 244 L60 244 Q68 244 68 236 L68 168" fill="var(--bio-vacuole)" stroke="var(--ink-3)" strokeWidth={1.8} />
      <rect x={16} y={186} width={50} height={56} fill="var(--bio-water)" opacity={0.45} />
      {/* capillary with water */}
      <rect x={40} y={y - 5} width={380} height={10} rx={3} fill="var(--bio-water)" opacity={0.45} />
      <path d={`M40 ${y - 5} L420 ${y - 5} M40 ${y + 5} L420 ${y + 5}`} stroke="var(--ink-3)" strokeWidth={1.6} />
      {/* scale */}
      {Array.from({ length: max / 5 + 1 }, (_, i) => {
        const mm = i * 5;
        const x = px(mm);
        return (
          <g key={mm}>
            <line x1={x} x2={x} y1={y + 8} y2={y + (mm % 10 === 0 ? 18 : 13)} stroke="var(--ink-2)" strokeWidth={1.2} />
            {mm % 10 === 0 && (
              <text x={x} y={y + 31} textAnchor="middle" fontSize={11} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                {mm}
              </text>
            )}
          </g>
        );
      })}
      <text x={x1 + 12} y={y + 31} fontSize={11} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        mm
      </text>
      {/* tube up to the shoot */}
      <path d="M420 209 L432 209 L432 120 M420 219 L442 219 L442 120" fill="none" stroke="var(--ink-3)" strokeWidth={1.6} />
      <rect x={433} y={122} width={8} height={96} fill="var(--bio-water)" opacity={0.45} />
      <rect x={420} y={209.8} width={13} height={8.4} fill="var(--bio-water)" opacity={0.45} />
      <rect x={426} y={108} width={22} height={16} rx={3} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
      {/* leafy shoot */}
      <path d="M437 118 L437 30" stroke="var(--bio-leaf-deep)" strokeWidth={5} strokeLinecap="round" />
      <path d="M437 118 L437 30" stroke="var(--bio-leaf)" strokeWidth={2.5} strokeLinecap="round" />
      {[
        [437, 96, -150],
        [437, 76, -30],
        [437, 56, -155],
        [437, 40, -35],
      ].map(([x, yy, a], i) => (
        <path key={i} d="M0 0 C8 -9 26 -9 34 0 C26 9 8 9 0 0 Z" transform={`translate(${x} ${yy}) rotate(${a})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      ))}
      {/* the air bubble: where it started (faded) and where it is now */}
      {end !== undefined && (
        <g>
          <ellipse cx={px(start)} cy={y} rx={7} ry={4.2} fill="none" stroke="var(--ink-3)" strokeWidth={1.4} strokeDasharray="2 2" />
          <path d={`M${px(start) + 10} ${y - 16} L${px(end) - 10} ${y - 16}`} stroke="var(--blob)" strokeWidth={2} markerEnd="url(#pot-arrow)" />
        </g>
      )}
      <ellipse cx={px(end ?? start)} cy={y} rx={7} ry={4.2} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.6} />
      <defs>
        <marker id="pot-arrow" viewBox="0 0 10 10" refX={6} refY={5} markerWidth={5} markerHeight={5} orient="auto">
          <path d="M0 0 L10 5 L0 10 Z" fill="var(--blob)" />
        </marker>
      </defs>
    </svg>
  );
}
