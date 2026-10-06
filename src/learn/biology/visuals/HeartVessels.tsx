"use client";

// Artery, vein and capillary side by side (cross-sections), with a vein cut lengthwise to show
// its valves. Not to scale: a capillary is far thinner than an artery or a vein.

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { svgText } from "./HeartShared";
import { cos, sin } from "@/lib/stableMath";

const W = 540;
const H = 340;

const PARTS: FigurePart[] = [
  { id: "artery", label: tx("artery", "Arterie"), at: [100, 150], tag: [100, 205], info: tx("Carries blood away from the heart. Thick, elastic wall that withstands high pressure. This is where you feel the pulse.", "Führt Blut vom Herzen weg. Dicke, elastische Wand, die hohen Druck aushält. Hier spürst du den Puls.") },
  { id: "media", label: tx("muscle layer with elastic fibres", "Muskelschicht mit elastischen Fasern"), at: [100, 52], tag: [36, 30], info: tx("Very thick in arteries. It stretches with every heartbeat and springs back: that keeps the blood flowing evenly.", "Bei Arterien besonders dick. Sie dehnt sich bei jedem Herzschlag und federt zurück: So fließt das Blut gleichmäßiger.") },
  { id: "vein", label: tx("vein", "Vene"), at: [282, 140], tag: [282, 205], info: tx("Carries blood to the heart. Thinner wall, wide lumen, low pressure. Often looks squashed.", "Führt Blut zum Herzen hin. Dünnere Wand, weites Lumen, niedriger Druck. Wirkt oft zusammengedrückt.") },
  { id: "capillary", label: tx("capillary", "Kapillare"), at: [458, 112], tag: [458, 170], info: tx("Hair-thin (about 8 µm): just wide enough for one red blood cell. Here substances are exchanged with the cells.", "Haarfein (etwa 8 µm): gerade so breit wie ein rotes Blutkörperchen. Hier findet der Stoffaustausch mit den Zellen statt.") },
  { id: "endothelium", label: tx("wall of one cell layer", "Wand aus einer Zellschicht"), at: [478, 96], tag: [512, 60], info: tx("A capillary wall is a single thin layer of cells: substances pass through easily.", "Die Wand einer Kapillare ist nur eine dünne Zellschicht: Stoffe gelangen leicht hindurch.") },
  { id: "valve", label: tx("venous valve", "Venenklappe"), at: [300, 276], tag: [300, 324], info: tx("Works like a one-way valve: blood can only flow towards the heart.", "Wirkt wie ein Ventil: Das Blut kann nur zum Herzen hin fließen.") },
];

/** Wavy ring for elastic fibres. */
function ring(cx: number, cy: number, r: number, amp: number, n: number) {
  let d = "";
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const rr = r + sin(a * n) * amp;
    d += `${i ? "L" : "M"}${(cx + rr * cos(a)).toFixed(1)} ${(cy + rr * sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}

/** A squashed, slightly irregular outline (veins rarely look round in a section). */
function blob(cx: number, cy: number, rx: number, ry: number, wob: number) {
  let d = "";
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const k = 1 + sin(a * 3 + 0.7) * wob + cos(a * 2) * wob * 0.6;
    d += `${i ? "L" : "M"}${(cx + rx * k * cos(a)).toFixed(1)} ${(cy + ry * k * sin(a)).toFixed(1)} `;
  }
  return `${d}Z`;
}

function Rbc({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={0.9} />
      <circle cx={x} cy={y} r={r * 0.42} fill="var(--bio-flesh)" opacity={0.55} />
    </g>
  );
}

export function HeartVessels({ mode = "explore", show, ask, highlight, legend }: DrawingProps) {
  const t = useText();
  return (
    <Figure title={tx("Blood vessels in section (not to scale)", "Blutgefäße im Querschnitt (nicht maßstabsgetreu)")} width={W} height={H} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* Artery */}
      <g data-part="artery">
        <circle cx={100} cy={100} r={74} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={2} />
      </g>
      <g data-part="media">
        <circle cx={100} cy={100} r={64} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} />
        {[58, 51, 44].map((r) => (
          <path key={r} d={ring(100, 100, r, 1.6, 22)} fill="none" stroke="var(--bio-membrane)" strokeWidth={1.6} />
        ))}
      </g>
      <g data-part="artery">
        <circle cx={100} cy={100} r={38} fill="var(--bio-cell)" stroke="var(--bio-flesh-deep)" strokeWidth={1} />
        <circle cx={100} cy={100} r={34} fill="var(--bio-blood)" />
        <Rbc x={88} y={92} />
        <Rbc x={110} y={106} />
        <Rbc x={96} y={114} r={6} />
      </g>

      {/* Vein */}
      <g data-part="vein">
        <path d={blob(282, 100, 90, 58, 0.06)} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={2} />
        <path d={blob(282, 100, 82, 51, 0.06)} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1} />
        <path d={blob(282, 100, 77, 47, 0.06)} fill="var(--bio-cell)" />
        <path d={blob(282, 100, 74, 44, 0.06)} fill="var(--bio-blood-low)" />
        <Rbc x={250} y={92} />
        <Rbc x={300} y={86} />
        <Rbc x={282} y={116} />
        <Rbc x={320} y={110} r={6} />
      </g>

      {/* Capillary */}
      <g data-part="capillary">
        <circle cx={458} cy={100} r={21} fill="var(--bio-blood)" opacity={0.85} />
        <Rbc x={458} y={100} r={15} />
      </g>
      <g data-part="endothelium">
        <circle cx={458} cy={100} r={23.5} fill="none" stroke="var(--bio-cell)" strokeWidth={5} />
        <circle cx={458} cy={100} r={26} fill="none" stroke="var(--bio-outline)" strokeWidth={1.4} />
        <circle cx={458} cy={100} r={21} fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={1} />
        <ellipse cx={477} cy={88} rx={6} ry={3.6} transform="rotate(-55 477 88)" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
      </g>

      {/* Vein cut lengthwise with two valves; blood flows to the heart (right) */}
      <g data-part="vein">
        <rect x={110} y={236} width={360} height={60} rx={4} fill="var(--bio-blood-low)" />
        <path d="M110 230 L470 230 M110 302 L470 302" stroke="var(--bio-flesh)" strokeWidth={10} />
        <path d="M110 225 L470 225 M110 307 L470 307" stroke="var(--bio-outline)" strokeWidth={1.6} />
        <path d="M110 235 L470 235 M110 297 L470 297" stroke="var(--bio-flesh-deep)" strokeWidth={1} />
      </g>
      <g data-part="valve">
        {[200, 330].map((x) => (
          <g key={x}>
            <path d={`M${x - 26} 236 Q${x - 6} 240 ${x + 8} 258`} fill="none" stroke="var(--bio-outline)" strokeWidth={5.5} strokeLinecap="round" />
            <path d={`M${x - 26} 236 Q${x - 6} 240 ${x + 8} 258`} fill="none" stroke="var(--bio-bone)" strokeWidth={3} strokeLinecap="round" />
            <path d={`M${x - 26} 296 Q${x - 6} 292 ${x + 8} 274`} fill="none" stroke="var(--bio-outline)" strokeWidth={5.5} strokeLinecap="round" />
            <path d={`M${x - 26} 296 Q${x - 6} 292 ${x + 8} 274`} fill="none" stroke="var(--bio-bone)" strokeWidth={3} strokeLinecap="round" />
          </g>
        ))}
      </g>
      <g fill="none" stroke="var(--bio-bone)" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" opacity={0.95}>
        <path d="M128 266 L168 266 M160 259 L168 266 L160 273" />
        <path d="M250 266 L290 266 M282 259 L290 266 L282 273" />
        <path d="M384 266 L452 266 M444 259 L452 266 L444 273" />
      </g>
      <path d="M476 266 L506 266 M499 259 L506 266 L499 273" fill="none" stroke="var(--ink-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <text x={491} y={290} textAnchor="middle" fontSize={11} fill="var(--ink-2)" style={svgText}>
        {t(tx("to the", "zum"))}
      </text>
      <text x={491} y={303} textAnchor="middle" fontSize={11} fill="var(--ink-2)" style={svgText}>
        {t(tx("heart", "Herzen"))}
      </text>
    </Figure>
  );
}
