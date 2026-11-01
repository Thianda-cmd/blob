"use client";

import { useId } from "react";
import { cos, sin } from "@/lib/stableMath";
import { cn } from "@/lib/utils";

/** A small picture for each Atlas model, for cards (320 × 200). */
export function AtlasArt({ slug, className }: { slug: string; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg viewBox="0 0 320 200" className={cn("block h-auto w-full", className)} aria-hidden>
      <defs>
        <radialGradient id={`c${uid}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="var(--bio-cell)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--bio-cell) 80%, var(--bio-membrane))" />
        </radialGradient>
      </defs>
      <Picture slug={slug} cell={`url(#c${uid})`} />
    </svg>
  );
}

function wave(x: number, y: number, len: number, amp: number, wl: number, dir = 1) {
  const pts: string[] = [];
  for (let s = 0; s <= len; s += 3) pts.push(`${(x + dir * s).toFixed(1)} ${(y + amp * Math.min(1, s / wl) * sin((s / wl) * 2 * Math.PI)).toFixed(1)}`);
  return `M ${pts.join(" L ")}`;
}

function Picture({ slug, cell }: { slug: string; cell: string }) {
  switch (slug) {
    case "bacterial-cell":
      return (
        <g>
          <path d={wave(246, 104, 66, 8, 24)} fill="none" stroke="var(--bio-outline)" strokeWidth={2.6} strokeLinecap="round" />
          {Array.from({ length: 18 }, (_, i) => {
            const t = (i / 18) * Math.PI * 2;
            const x = 160 + cos(t) * 104;
            const y = 100 + sin(t) * 52;
            return <line key={i} x1={x.toFixed(1)} y1={y.toFixed(1)} x2={(x + cos(t) * 14).toFixed(1)} y2={(y + sin(t) * 14).toFixed(1)} stroke="var(--bio-wood-deep)" strokeWidth={1.4} strokeLinecap="round" />;
          })}
          <rect x={52} y={46} width={216} height={108} rx={54} fill="color-mix(in oklab, var(--bio-capsule) 70%, transparent)" stroke="var(--bio-capsule-deep)" strokeDasharray="4 4" />
          <rect x={64} y={58} width={192} height={84} rx={42} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.4} />
          <rect x={72} y={66} width={176} height={68} rx={34} fill={cell} stroke="var(--bio-membrane)" strokeWidth={2} />
          <path d="M 120 96 c 10 -18 30 -10 36 2 s 24 18 40 -2 s -30 -20 -50 0 s -20 14 -26 0 Z" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
          {[
            [92, 84],
            [100, 112],
            [214, 88],
            [222, 112],
            [176, 120],
            [134, 120],
            [196, 76],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={3} fill="var(--bio-ribo)" />
          ))}
          <circle cx={98} cy={100} r={7} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
        </g>
      );
    case "cell-wall":
      return (
        <g>
          <rect x={0} y={128} width={320} height={72} fill="var(--bio-cell)" />
          {Array.from({ length: 20 }, (_, i) => (
            <g key={i}>
              {Array.from({ length: 3 + ((i * 5) % 4) }, (_, k) => (
                <rect key={k} x={6 + i * 16 - 3.5} y={60 - k * 9} width={7} height={7} rx={2} fill="var(--bio-sugar)" stroke="var(--bio-sugar-deep)" strokeWidth={0.8} />
              ))}
              <circle cx={6 + i * 16} cy={72} r={3.6} fill="var(--bio-lps)" stroke="var(--bio-lps-deep)" strokeWidth={0.8} />
            </g>
          ))}
          <rect x={0} y={78} width={320} height={16} fill="var(--bio-head)" />
          <rect x={0} y={83} width={320} height={6} fill="var(--bio-tail)" />
          <rect x={0} y={94} width={320} height={30} fill="color-mix(in oklab, var(--bio-capsule) 60%, transparent)" />
          <rect x={0} y={102} width={320} height={10} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" />
          <rect x={0} y={124} width={320} height={16} fill="var(--bio-head)" />
          <rect x={0} y={129} width={320} height={6} fill="var(--bio-tail)" />
          <rect x={136} y={74} width={18} height={24} rx={6} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" />
          <rect x={158} y={74} width={18} height={24} rx={6} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" />
        </g>
      );
    case "gram-stain":
      return (
        <g>
          <rect x={40} y={80} width={110} height={52} rx={26} fill="var(--bio-murein)" stroke="var(--bio-murein-deep)" strokeWidth={1.4} />
          <rect x={50} y={90} width={90} height={32} rx={16} fill="var(--bio-gpos)" />
          <rect x={174} y={80} width={110} height={52} rx={26} fill="none" stroke="var(--bio-lps-deep)" strokeWidth={2.4} />
          <rect x={180} y={86} width={98} height={40} rx={20} fill="var(--bio-gneg)" stroke="var(--bio-murein-deep)" />
          <path d="M 150 30 h 22 v 30 l -11 12 l -11 -12 Z" fill="var(--bio-gpos)" stroke="var(--ink-2)" strokeWidth={1.4} />
          <circle cx={161} cy={82} r={4} fill="var(--bio-gpos)" />
          <text x={95} y={160} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--bio-gpos)" style={{ fontFamily: "var(--font-sans)" }}>
            +
          </text>
          <text x={229} y={160} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--bio-gneg)" style={{ fontFamily: "var(--font-sans)" }}>
            −
          </text>
        </g>
      );
    case "endospores":
      return (
        <g>
          <rect x={40} y={72} width={168} height={56} rx={28} fill={cell} stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
          <ellipse cx={176} cy={100} rx={26} ry={20} fill="var(--bio-spore)" stroke="var(--bio-spore-deep)" strokeWidth={2} />
          <ellipse cx={258} cy={100} rx={40} ry={30} fill="color-mix(in oklab, var(--bio-spore-deep) 70%, var(--bio-outline))" />
          <ellipse cx={258} cy={100} rx={33} ry={23} fill="var(--bio-murein)" />
          <ellipse cx={258} cy={100} rx={22} ry={15} fill="var(--bio-spore)" stroke="var(--bio-head)" strokeWidth={2} />
          <path d="M 246 100 c 4 -8 10 -6 12 0 s 8 8 12 0" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
        </g>
      );
    case "history":
      return (
        <g>
          <circle cx={128} cy={130} r={44} fill="color-mix(in oklab, var(--bio-capsule) 40%, var(--raised))" stroke="var(--ink-2)" strokeWidth={2} />
          <path d="M 84 134 h 88 a 44 44 0 0 1 -88 0 Z" fill="#e2a64a" />
          <circle cx={128} cy={130} r={44} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
          <path d="M 120 88 C 118 48, 160 40, 176 66 C 188 86, 208 80, 214 50 M 136 88 C 134 60, 160 56, 170 74 C 182 96, 214 96, 222 54" fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeLinecap="round" />
          <g transform="translate(244 74)">
            <rect x={-12} y={-30} width={24} height={60} rx={5} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            <circle cx={0} cy={-12} r={5} fill="var(--bio-capsule)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
            <path d="M 12 -12 h 14 M 26 -24 v 36" stroke="var(--bio-wood-deep)" strokeWidth={2} />
          </g>
        </g>
      );
    case "eukaryotic-cell":
      return (
        <g>
          <ellipse cx={160} cy={100} rx={128} ry={84} fill={cell} stroke="var(--bio-membrane)" strokeWidth={3} />
          <circle cx={146} cy={100} r={38} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={3} strokeDasharray="20 4" />
          <circle cx={152} cy={94} r={12} fill="var(--bio-nucleus-deep)" />
          <path d="M 196 70 a 50 50 0 0 1 4 60 M 208 62 a 62 62 0 0 1 6 76" fill="none" stroke="color-mix(in oklab, var(--bio-nucleus) 60%, white)" strokeWidth={5} strokeLinecap="round" />
          <g transform="translate(88 62) rotate(20)">
            <rect x={-20} y={-9} width={40} height={18} rx={9} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
          </g>
          <g transform="translate(236 128) rotate(-30)">
            <rect x={-20} y={-9} width={40} height={18} rx={9} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
          </g>
          <path d="M 70 128 q 20 -14 40 0 M 74 138 q 16 -10 32 0" fill="none" stroke="var(--bio-petal-deep)" strokeWidth={4} strokeLinecap="round" />
        </g>
      );
    case "membrane-transport":
      return (
        <g>
          <rect x={0} y={0} width={320} height={84} fill="color-mix(in oklab, var(--bio-capsule) 55%, transparent)" />
          <rect x={0} y={116} width={320} height={84} fill="var(--bio-cell)" />
          {Array.from({ length: 28 }, (_, i) => 6 + i * 11.5)
            .filter((x) => Math.abs(x - 120) > 22 && Math.abs(x - 216) > 26)
            .map((x) => (
              <g key={x}>
                <circle cx={x} cy={88} r={4.6} fill="var(--bio-head)" />
                <circle cx={x} cy={112} r={4.6} fill="var(--bio-head)" />
                <path d={`M ${x} 92 v 16`} stroke="var(--bio-head)" strokeWidth={1.4} />
              </g>
            ))}
          <rect x={100} y={76} width={16} height={48} rx={7} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" />
          <rect x={124} y={76} width={16} height={48} rx={7} fill="var(--bio-protein)" stroke="var(--bio-protein-deep)" />
          <rect x={192} y={72} width={48} height={56} rx={16} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" />
          <circle cx={120} cy={40} r={8} fill="var(--bio-nucleus-deep)" />
          <circle cx={120} cy={160} r={8} fill="var(--bio-nucleus-deep)" />
          <path d="M 120 52 v 92 m -6 -8 l 6 8 l 6 -8" fill="none" stroke="var(--ink-3)" strokeWidth={2} />
          <path d="M 216 150 v -100 m -6 8 l 6 -8 l 6 8" fill="none" stroke="var(--ink-3)" strokeWidth={2} />
          <circle cx={216} cy={164} r={8} fill="var(--bio-mito-deep)" />
        </g>
      );
    default:
      return null;
  }
}
