"use client";

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";

const LADDER = [5000, 3000, 2000, 1500, 1000, 750, 500, 250];

/**
 * An agarose gel after electrophoresis: a size ladder (M) and numbered sample lanes.
 * Short fragments run further (towards +). `lanes` lists the fragment sizes in bp per lane.
 */
export function DnaGel({ lanes, ladder = LADDER }: { lanes: number[][]; ladder?: number[] }) {
  const t = useText();
  const cols = lanes.length + 1;
  const laneW = 54;
  const gap = 16;
  const left = 64;
  const top = 46;
  const h = 210;
  const w = left + cols * laneW + (cols - 1) * gap + 24;
  const lo = Math.log10(200);
  const hi = Math.log10(6000);
  const y = (bp: number) => top + 12 + ((hi - Math.log10(bp)) / (hi - lo)) * (h - 24);
  const x = (k: number) => left + k * (laneW + gap);
  const text = (tx0: number, ty: number, s: string, size = 12, anchor: "start" | "middle" | "end" = "middle", fill = "var(--ink-2)") => (
    <text x={tx0} y={ty} textAnchor={anchor} dominantBaseline="central" fontSize={size} fill={fill} fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${w} ${top + h + 26}`} className="mx-auto block h-auto w-full" style={{ maxWidth: Math.min(520, w * 1.15) }} role="img" aria-label={t(tx("Gel electrophoresis", "Gelelektrophorese"))}>
      <rect x={left - 14} y={top - 8} width={cols * laneW + (cols - 1) * gap + 28} height={h + 16} rx={10} fill="color-mix(in oklab, var(--bio-vacuole) 55%, var(--raised))" stroke="var(--ink-3)" strokeWidth={1.4} />
      {text(left - 26, top - 2, "−", 18, "middle", "var(--ink)")}
      {text(left - 26, top + h + 4, "+", 18, "middle", "var(--ink)")}
      {Array.from({ length: cols }, (_, k) => (
        <g key={k}>
          {text(x(k) + laneW / 2, top - 22, k === 0 ? "M" : String(k), 14, "middle", "var(--ink)")}
          <rect x={x(k) + 4} y={top - 2} width={laneW - 8} height={7} rx={2} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.2} />
        </g>
      ))}
      {ladder.map((bp) => (
        <g key={`m${bp}`}>
          <rect x={x(0) + 5} y={y(bp) - 3} width={laneW - 10} height={6} rx={3} fill="var(--bio-nucleus-deep)" opacity={0.75} />
          {text(left - 18, y(bp), String(bp), 10.5, "end", "var(--ink-3)")}
        </g>
      ))}
      {lanes.map((frags, k) =>
        frags.map((bp, j) => <rect key={`${k}-${j}`} x={x(k + 1) + 5} y={y(bp) - 3.5} width={laneW - 10} height={7} rx={3.5} fill="var(--bio-nucleus-deep)" />),
      )}
      {text(left - 18, top + h + 18, "bp", 10.5, "end", "var(--ink-3)")}
    </svg>
  );
}
