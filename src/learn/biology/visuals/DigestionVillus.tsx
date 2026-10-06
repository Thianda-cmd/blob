"use client";

// A villus of the small intestine in longitudinal section (epithelium with brush border,
// capillary network, central lymph vessel, goblet cell) and a zoom into the epithelial cells
// with their microvilli.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { useId } from "react";
import { cos, sin } from "@/lib/stableMath";

export type VillusPart = "villus" | "epithelium" | "microvilli" | "blood" | "lymph" | "goblet";

export const VILLUS_PARTS: (FigurePart & { id: VillusPart })[] = [
  { id: "villus", label: tx("villus", "Darmzotte"), at: [133, 150], tag: [30, 70], info: tx("A finger-like fold of the gut lining, about 1 mm high. Millions of them enlarge the surface.", "Eine fingerförmige Ausstülpung der Darmschleimhaut, etwa 1 mm hoch. Millionen davon vergrößern die Oberfläche.") },
  { id: "epithelium", label: tx("epithelial cell (gut lining)", "Epithelzelle (Darmschleimhaut)"), at: [456, 168], info: tx("Takes up the building blocks from the gut and passes them on to the blood or lymph.", "Nimmt die Bausteine aus dem Darm auf und gibt sie an Blut oder Lymphe weiter.") },
  { id: "microvilli", label: tx("microvilli (brush border)", "Mikrovilli (Bürstensaum)"), at: [430, 93], tag: [540, 28], info: tx("Tiny projections of the cell membrane: they enlarge the surface once more, about 20-fold.", "Winzige Ausstülpungen der Zellmembran: Sie vergrößern die Oberfläche noch einmal, etwa 20-fach.") },
  { id: "blood", label: tx("blood capillaries", "Blutkapillaren"), at: [154, 236], tag: [30, 160], info: tx("Take up glucose, amino acids, water and minerals. The blood flows via the portal vein to the liver.", "Nehmen Glucose, Aminosäuren, Wasser und Mineralstoffe auf. Das Blut fließt über die Pfortader zur Leber.") },
  { id: "lymph", label: tx("lymph vessel (lacteal)", "Lymphgefäß"), at: [190, 190], tag: [30, 250], info: tx("Takes up the fat building blocks, packed as tiny fat droplets (chylomicrons).", "Nimmt die Fettbausteine auf, verpackt als winzige Fetttröpfchen (Chylomikronen).") },
  { id: "goblet", label: tx("goblet cell", "Becherzelle"), at: [242, 262], tag: [300, 150], info: tx("Makes mucus that protects the gut lining and lets the chyme slide.", "Bildet Schleim, der die Darmschleimhaut schützt und den Brei gleiten lässt.") },
];

const OUT = "var(--bio-outline)";
const EPI = "var(--bio-cell)";
const CORE = "color-mix(in oklab, var(--bio-flesh) 70%, var(--raised))";
const LYMPH = "color-mix(in oklab, var(--bio-sun) 30%, var(--raised))";

/** Points along the villus outline (left side up, round tip, right side down). */
function outline(cx: number, half: number, top: number, base: number, step: number) {
  const pts: { x: number; y: number; nx: number; ny: number }[] = [];
  for (let y = base; y > top; y -= step) pts.push({ x: cx - half, y, nx: -1, ny: 0 });
  const arc = Math.PI * half;
  const n = Math.round(arc / step);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (Math.PI * i) / n;
    pts.push({ x: cx + half * cos(a), y: top + half * sin(a), nx: cos(a), ny: sin(a) });
  }
  for (let y = top + step; y <= base; y += step) pts.push({ x: cx + half, y, nx: 1, ny: 0 });
  return pts;
}

const villusPath = (cx: number, half: number, top: number, base: number) => `M${cx - half} ${base} L${cx - half} ${top} A${half} ${half} 0 0 1 ${cx + half} ${top} L${cx + half} ${base}`;

function Villus({ cx, half, top, base, section }: { cx: number; half: number; top: number; base: number; section?: boolean }) {
  const edge = outline(cx, half, top, base - 4, 3.2);
  const cells = outline(cx, half - 8, top, base - 6, 13);
  const fringe = edge.map((p) => `M${(p.x).toFixed(1)} ${(p.y).toFixed(1)} l${(p.nx * 4).toFixed(1)} ${(p.ny * 4).toFixed(1)}`).join(" ");
  const walls = outline(cx, half, top, base - 6, 13)
    .map((p) => `M${p.x.toFixed(1)} ${p.y.toFixed(1)} l${(-p.nx * 16).toFixed(1)} ${(-p.ny * 16).toFixed(1)}`)
    .join(" ");
  return (
    <g>
      <path d={fringe} stroke="var(--bio-membrane)" strokeWidth={1.4} strokeLinecap="round" />
      <path d={`${villusPath(cx, half, top, base)} Z`} fill={EPI} stroke={OUT} strokeWidth={1.6} />
      {section && <path d={`${villusPath(cx, half - 16, top, base)} Z`} fill={CORE} stroke={OUT} strokeOpacity={0.5} strokeWidth={1.1} />}
      <path d={walls} stroke={OUT} strokeOpacity={0.35} strokeWidth={0.9} />
      {cells.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx={2.6} ry={2.6} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={0.7} />
      ))}
    </g>
  );
}

export function DigestionVillus({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const clip = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ZX = 452;
  const ZY = 152;
  const ZR = 92;
  return (
    <Figure title={tx("A villus of the small intestine", "Eine Darmzotte des Dünndarms")} width={560} height={344} parts={VILLUS_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <defs>
        <clipPath id={`${clip}-z`}>
          <circle cx={ZX} cy={ZY} r={ZR} />
        </clipPath>
      </defs>
      {/* gut wall at the base and two neighbouring villi (cut off-centre) */}
      <rect x={56} y={316} width={278} height={26} rx={6} fill="color-mix(in oklab, var(--bio-flesh-deep) 45%, var(--raised))" stroke={OUT} strokeOpacity={0.5} strokeWidth={1.2} />
      <Villus cx={88} half={26} top={214} base={320} />
      <Villus cx={292} half={26} top={214} base={320} />

      {/* the villus in section */}
      <g data-part="villus">
        <Villus cx={190} half={60} top={104} base={320} section />
      </g>
      <g data-part="goblet">
        <path d="M236 248 C246 248 249 258 248 270 C247 280 244 284 240 284 C236 284 233 280 232 270 C231 258 232 250 236 248 Z" fill="color-mix(in oklab, var(--bio-vacuole) 70%, var(--raised))" stroke={OUT} strokeWidth={1.2} />
        <circle cx={240} cy={262} r={1.8} fill={OUT} opacity={0.4} />
        <circle cx={238} cy={272} r={1.6} fill={OUT} opacity={0.4} />
      </g>
      <g data-part="lymph">
        <path d="M182 322 L182 112 A8 8 0 0 1 198 112 L198 322" fill={LYMPH} stroke="var(--bio-membrane)" strokeWidth={1.6} />
      </g>
      <g data-part="blood" fill="none" strokeLinecap="round">
        <path d="M152 330 L152 118 C152 102 166 96 172 106" stroke="var(--bio-blood)" strokeWidth={4} />
        <path d="M228 330 L228 118 C228 102 214 96 208 106" stroke="var(--bio-blood-low)" strokeWidth={4} />
        {[130, 160, 190, 220, 250, 280].map((y, i) => (
          <path key={y} d={`M152 ${y} C164 ${y - 10} 172 ${y + 8} 180 ${y - 2} M200 ${y - 2} C208 ${y + 8} 216 ${y - 10} 228 ${y + (i % 2 ? 4 : -4)}`} stroke="color-mix(in oklab, var(--bio-blood) 55%, var(--bio-blood-low))" strokeWidth={2} />
        ))}
        <path d="M172 106 C180 92 200 92 208 106" stroke="color-mix(in oklab, var(--bio-blood) 50%, var(--bio-blood-low))" strokeWidth={2.4} />
      </g>

      {/* zoom: where it comes from */}
      <circle cx={248} cy={122} r={9} fill="none" stroke="var(--ink-2)" strokeWidth={1.3} strokeDasharray="3 3" />
      <path d={`M255 116 L${ZX - 76} ${ZY - 52} M255 129 L${ZX - 82} ${ZY + 38}`} stroke="var(--ink-3)" strokeWidth={1.1} strokeDasharray="3 3" />

      {/* zoom: epithelial cells with microvilli */}
      <g clipPath={`url(#${clip}-z)`}>
        <rect x={ZX - ZR} y={ZY - ZR} width={2 * ZR} height={2 * ZR} fill="var(--raised)" />
        {[
          [394, 76],
          [470, 70],
          [510, 82],
          [430, 64],
        ].map(([x, y], i) => (
          <polygon key={i} points="0,-5 4.3,-2.5 4.3,2.5 0,5 -4.3,2.5 -4.3,-2.5" transform={`translate(${x} ${y})`} fill="var(--bio-sun)" stroke={OUT} strokeWidth={0.8} />
        ))}
        <g data-part="microvilli">
          {Array.from({ length: 24 }, (_, i) => 366 + i * 7.6).map((x) => (
            <rect key={x} x={x} y={86} width={4.6} height={22} rx={2.3} fill={EPI} stroke="var(--bio-membrane)" strokeWidth={1.1} />
          ))}
        </g>
        <g data-part="epithelium">
          {[360, 424, 488].map((x) => (
            <g key={x}>
              <rect x={x} y={104} width={64} height={160} fill={EPI} stroke={OUT} strokeWidth={1.4} />
              <ellipse cx={x + 32} cy={196} rx={14} ry={22} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />
              <ellipse cx={x + 18} cy={140} rx={7} ry={3.6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.9} transform={`rotate(-25 ${x + 18} 140)`} />
              <ellipse cx={x + 46} cy={156} rx={7} ry={3.6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.9} transform={`rotate(20 ${x + 46} 156)`} />
            </g>
          ))}
        </g>
      </g>
      <circle cx={ZX} cy={ZY} r={ZR} fill="none" stroke="var(--ink-2)" strokeWidth={1.6} />
    </Figure>
  );
}

export function DigestionVillusExplore() {
  return <DigestionVillus mode="explore" show={["villus", "epithelium", "microvilli", "blood", "lymph"]} />;
}
