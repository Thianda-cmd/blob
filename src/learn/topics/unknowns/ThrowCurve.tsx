"use client";

import { useLocale } from "@/i18n/client";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { num } from "./kit";

// Level 3 picture: the height of a ball thrown straight up, h(t) = h0 + v·t − 5t². A height
// line meets the curve twice (on the way up and on the way down), the ground once after the throw.

const W = 380;
const H = 230;
const M = { l: 40, r: 16, t: 16, b: 34 };

export function ThrowCurve({ v = 20, h0 = 0, height = 15 }: { v?: number; h0?: number; height?: number }) {
  const t = useText();
  const locale = useLocale();
  const h = (s: number) => h0 + v * s - 5 * s * s;
  const land = (v + Math.sqrt(v * v + 20 * h0)) / 10;
  const top = h(v / 10);
  const T = Math.ceil(land);
  const Y = Math.ceil((top + 2) / 5) * 5;
  const px = (s: number) => M.l + (s / T) * (W - M.l - M.r);
  const py = (m: number) => H - M.b - (m / Y) * (H - M.t - M.b);
  let d = "";
  for (let i = 0; i <= 120; i++) {
    const s = (land * i) / 120;
    d += `${i ? "L" : "M"}${px(s).toFixed(1)} ${py(Math.max(0, h(s))).toFixed(1)}`;
  }
  // The two times at the given height.
  const disc = v * v - 20 * (height - h0);
  const t1 = disc >= 0 ? (v - Math.sqrt(disc)) / 10 : NaN;
  const t2 = disc >= 0 ? (v + Math.sqrt(disc)) / 10 : NaN;
  const n = (x: number) => num(Math.round(x * 100) / 100, locale);
  const tTicks = Array.from({ length: T + 1 }, (_, i) => i);
  const hTicks = Array.from({ length: Y / 5 + 1 }, (_, i) => i * 5);
  const label = (x: number, y: number, text: string, anchor: "start" | "end" | "middle", fill = "var(--ink)") => (
    <text x={x} y={y} textAnchor={anchor} fontSize={11.5} fontWeight={700} fill={fill} stroke="var(--raised)" strokeWidth={3.5} paintOrder="stroke" style={{ fontFamily: "var(--font-sans)" }}>
      {text}
    </text>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={t(tx("Height of the ball over time", "Höhe des Balls über der Zeit"))}>
      {hTicks.map((m) => (
        <g key={`h${m}`}>
          <line x1={M.l} x2={W - M.r} y1={py(m)} y2={py(m)} stroke={m === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={m === 0 ? 1.3 : 0.8} />
          <text x={M.l - 6} y={py(m) + 3.6} textAnchor="end" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {m}
          </text>
        </g>
      ))}
      {tTicks.map((s) => (
        <g key={`t${s}`}>
          <line x1={px(s)} x2={px(s)} y1={M.t} y2={H - M.b} stroke={s === 0 ? "var(--ink-3)" : "var(--line)"} strokeWidth={s === 0 ? 1.3 : 0.8} />
          <text x={px(s)} y={H - M.b + 14} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {s}
          </text>
        </g>
      ))}
      <text x={W - M.r} y={H - 5} textAnchor="end" fontSize={11} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        t in s
      </text>
      <text x={6} y={M.t - 4} fontSize={11} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        h in m
      </text>
      <line x1={M.l} x2={W - M.r} y1={py(height)} y2={py(height)} stroke="var(--blob)" strokeDasharray="5 4" strokeWidth={1.5} />
      {label(W - M.r - 2, py(height) - 6, `h = ${n(height)} m`, "end", "var(--blob)")}
      <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2.6} strokeLinecap="round" />
      {Number.isFinite(t1) && t1 > 0 && (
        <g>
          <circle cx={px(t1)} cy={py(height)} r={6} fill="var(--ok)" stroke="var(--raised)" strokeWidth={2} />
          {label(px(t1) - 8, py(height) + 18, t(tx(`t = ${n(t1)} s, up`, `t = ${n(t1)} s, hoch`)), "end")}
        </g>
      )}
      {Number.isFinite(t2) && (
        <g>
          <circle cx={px(t2)} cy={py(height)} r={6} fill="var(--ok)" stroke="var(--raised)" strokeWidth={2} />
          {label(px(t2) + 8, py(height) + 18, t(tx(`t = ${n(t2)} s, down`, `t = ${n(t2)} s, runter`)), "start")}
        </g>
      )}
      <circle cx={px(land)} cy={py(0)} r={6} fill="var(--blob)" stroke="var(--raised)" strokeWidth={2} />
      {label(px(land) - 4, py(0) - 10, t(tx(`lands: t = ${n(land)} s`, `landet: t = ${n(land)} s`)), "end")}
    </svg>
  );
}
