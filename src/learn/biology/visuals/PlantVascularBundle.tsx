"use client";

// A vascular bundle (Leitbündel): on the left in cross-section (xylem on top, as in a leaf;
// an open bundle with cambium, or a closed one without), on the right in longitudinal
// section: a vessel with spiral thickenings and sieve tubes with sieve plates and companion
// cells. With `flow`, water rises in the vessel and sugar solution moves up and down.

import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cos, sin } from "@/lib/stableMath";

const XYLEM_INFO = tx("Wood part: dead, lignified tubes (vessels). Carries water and minerals upwards.", "Holzteil: tote, verholzte Röhren (Gefäße). Leitet Wasser und Mineralstoffe nach oben.");
const PHLOEM_INFO = tx("Bast part: living sieve tubes with companion cells. Carries sugar solution up and down.", "Siebteil: lebende Siebröhren mit Geleitzellen. Leitet Zuckerlösung nach oben und nach unten.");

const PARTS_OPEN: FigurePart[] = [
  { id: "xylem", label: tx("xylem", "Xylem (Holzteil)"), at: [176, 150], tag: [28, 110], info: XYLEM_INFO },
  { id: "cambium", label: tx("cambium", "Kambium"), at: [196, 197], tag: [28, 176], info: tx("A thin layer of cells that can divide: new xylem inwards, new phloem outwards. Only dicots have it.", "Eine dünne Schicht teilungsfähiger Zellen: bildet nach innen Xylem, nach außen Phloem. Nur bei Zweikeimblättrigen.") },
  { id: "phloem", label: tx("phloem", "Phloem (Siebteil)"), at: [150, 232], tag: [28, 236], info: PHLOEM_INFO },
  { id: "fibers", label: tx("supporting fibres", "Festigungsgewebe (Fasern)"), at: [166, 278], tag: [28, 296], info: tx("Thick-walled, dead fibre cells (sclerenchyma): they make the bundle tough.", "Dickwandige, tote Faserzellen (Sklerenchym): Sie machen das Leitbündel zugfest.") },
  { id: "vessel", label: tx("vessel (longitudinal)", "Gefäß (längs)"), at: [366, 120], tag: [366, 16], info: tx("A long tube of dead cells without cross walls. Ring and spiral thickenings keep it from collapsing.", "Eine lange Röhre aus toten Zellen ohne Querwände. Ring- und Schraubenverdickungen verhindern, dass sie zusammenfällt.") },
  { id: "sieve", label: tx("sieve tube", "Siebröhre"), at: [442, 160], tag: [442, 322], info: tx("Living cells without a nucleus, joined end to end. Sugar solution flows through them.", "Lebende Zellen ohne Zellkern, hintereinander gereiht. Durch sie fließt Zuckerlösung.") },
  { id: "plate", label: tx("sieve plate", "Siebplatte"), at: [516, 212], tag: [530, 322], info: tx("A cross wall full of pores between two sieve tube cells.", "Eine Querwand voller Poren zwischen zwei Siebröhrenzellen.") },
  { id: "companion", label: tx("companion cell", "Geleitzelle"), at: [463, 75], tag: [480, 16], info: tx("A small cell with a nucleus. It supplies the sieve tube next to it.", "Eine kleine Zelle mit Zellkern. Sie versorgt die Siebröhre daneben.") },
];
const PARTS_CLOSED: FigurePart[] = PARTS_OPEN.filter((p) => p.id !== "cambium").map((p) =>
  p.id === "fibers" ? { ...p, label: tx("sclerenchyma sheath", "Sklerenchymscheide"), at: [244, 190], info: tx("A ring of thick-walled fibres around the whole bundle: typical of monocots.", "Ein Ring aus dickwandigen Fasern um das ganze Bündel: typisch für Einkeimblättrige.") } : p,
);

const WALL = "var(--bio-wall-deep)";
const CELL = "var(--bio-cell)";

const X_OPEN: [number, number, number][] = [
  [130, 166, 15],
  [176, 160, 18],
  [152, 128, 12],
  [197, 124, 10],
  [116, 128, 9],
  [158, 97, 7],
  [138, 96, 6],
  [180, 95, 6],
];
const X_CLOSED: [number, number, number][] = [
  [118, 150, 17],
  [202, 150, 17],
  [160, 118, 8],
  [160, 96, 6],
];

/** Small filler cells between the vessels (tracheids and xylem parenchyma). */
function fillers(vessels: [number, number, number][], box: [number, number, number, number], closed: boolean) {
  const out: [number, number][] = [];
  for (let y = box[1]; y <= box[3]; y += 11) {
    for (let x = box[0] + ((y / 11) % 2) * 5; x <= box[2]; x += 11) {
      const free = vessels.every(([vx, vy, r]) => Math.hypot(x - vx, y - vy) > r + 6);
      const inside = closed ? ((x - 160) / 64) ** 2 + ((y - 146) / 62) ** 2 < 1 && y < 176 : ((x - 160) / 70) ** 2 + ((y - 150) / 70) ** 2 < 1;
      if (free && inside) out.push([x, y]);
    }
  }
  return out;
}

function Dot({ phase, x, y0, y1, offset, color, r = 3.2 }: { phase: MotionValue<number>; x: number; y0: number; y1: number; offset: number; color: string; r?: number }) {
  const f = useTransform(phase, (p) => (p + offset) % 1);
  const y = useTransform(f, (v) => y0 + (y1 - y0) * v);
  const opacity = useTransform(f, (v) => (v < 0.08 ? v / 0.08 : v > 0.92 ? (1 - v) / 0.08 : 1));
  return <motion.circle cx={x} cy={y} r={r} fill={color} style={{ opacity }} />;
}

function Cross({ closed }: { closed: boolean }) {
  const vessels = closed ? X_CLOSED : X_OPEN;
  const fill = fillers(vessels, [92, 76, 228, 186], closed);
  return (
    <g>
      {/* surrounding ground tissue */}
      <g fill={CELL} stroke={WALL} strokeWidth={1} opacity={0.75}>
        {Array.from({ length: 22 }, (_, i) => {
          const a = (i / 22) * Math.PI * 2;
          return <circle key={i} cx={160 + cos(a) * 112} cy={182 + sin(a) * 124} r={15} />;
        })}
      </g>
      {closed ? (
        <g data-part="fibers">
          {Array.from({ length: 34 }, (_, i) => {
            const a = (i / 34) * Math.PI * 2;
            return <circle key={i} cx={160 + cos(a) * 88} cy={182 + sin(a) * 104} r={6.4} fill="var(--raised)" stroke={WALL} strokeWidth={4} />;
          })}
        </g>
      ) : (
        <g data-part="fibers">
          {Array.from({ length: 13 }, (_, i) => {
            const a = Math.PI * (0.12 + (0.76 * i) / 12);
            return <circle key={i} cx={160 + cos(a) * 66} cy={238 + sin(a) * 40} r={6.2} fill="var(--raised)" stroke={WALL} strokeWidth={4} />;
          })}
        </g>
      )}
      <g data-part="phloem">
        <path d={closed ? "M96 196 Q160 186 224 196 Q214 252 160 262 Q106 252 96 196 Z" : "M90 212 Q160 200 230 212 Q222 262 160 268 Q98 262 90 212 Z"} fill="var(--bio-mito)" opacity={0.35} />
        {(closed
          ? [
              [128, 214, 10],
              [158, 210, 11],
              [190, 214, 10],
              [142, 238, 9],
              [176, 238, 9],
            ]
          : [
              [110, 226, 10],
              [140, 222, 11],
              [172, 222, 11],
              [204, 228, 10],
              [125, 250, 9],
              [158, 248, 10],
              [190, 250, 9],
            ]
        ).map(([x, y, r], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={r} fill={CELL} stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
            {i % 2 === 0 && <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1} strokeDasharray="1.5 2" />}
            <circle cx={x + r + 2.5} cy={y - r * 0.4} r={3.6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1} />
          </g>
        ))}
      </g>
      {!closed && (
        <g data-part="cambium">
          {[0, 1].map((row) =>
            Array.from({ length: 12 }, (_, i) => <rect key={`${row}-${i}`} x={98 + i * 11 + row * 5} y={190 + row * 6.5} width={11} height={6.5} fill="var(--bio-leaf)" fillOpacity={0.35} stroke={WALL} strokeWidth={0.8} />),
          )}
        </g>
      )}
      <g data-part="xylem">
        <path d={closed ? "M92 168 Q100 80 160 74 Q220 80 228 168 Q160 186 92 168 Z" : "M86 186 Q92 82 160 72 Q228 82 234 186 Z"} fill="var(--bio-wood)" opacity={0.22} />
        {fill.map(([x, y], i) => (
          <circle key={`f${i}`} cx={x} cy={y} r={4.6} fill={CELL} stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
        ))}
        {vessels.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={r > 10 ? 3.2 : 2.4} />
        ))}
        {closed && <ellipse cx={160} cy={150} rx={11} ry={9} fill="var(--raised)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} strokeDasharray="2 2" />}
      </g>
    </g>
  );
}

function Long({ flow }: { flow: boolean }) {
  const reduce = useReducedMotion();
  const phase = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (!flow || reduce) return;
    phase.set(phase.get() + Math.min(0.05, delta / 1000) * 0.22);
  });
  const segs = [40, 128, 216, 304];
  return (
    <g>
      {/* vessel with spiral thickenings */}
      <g data-part="vessel">
        <rect x={346} y={40} width={40} height={264} fill="var(--bio-vacuole)" />
        <path d="M346 40 L346 304 M386 40 L386 304" stroke="var(--bio-wood-deep)" strokeWidth={2.4} />
        <g stroke="var(--bio-wood-deep)" strokeWidth={2.4} fill="none" strokeLinecap="round">
          {Array.from({ length: 22 }, (_, i) => (
            <path key={i} d={`M346 ${46 + i * 12} Q366 ${40 + i * 12} 386 ${52 + i * 12}`} />
          ))}
        </g>
        {[128, 216].map((y) => (
          <path key={y} d={`M346 ${y} l7 0 M386 ${y} l-7 0`} stroke="var(--bio-wood-deep)" strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
      {/* two sieve tubes, each with companion cells */}
      {[426, 498].map((x0, k) => (
        <g key={x0}>
          <g data-part={k === 0 ? "sieve" : undefined}>
            <rect x={x0} y={40} width={32} height={264} fill="var(--bio-mito)" fillOpacity={0.35} stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
          </g>
          <g data-part={k === 1 ? "plate" : undefined}>
            {segs.slice(1, 3).map((y) => (
              <path key={y} d={`M${x0} ${y} L${x0 + 32} ${y}`} stroke="var(--bio-mito-deep)" strokeWidth={4} strokeDasharray="3.5 2.5" />
            ))}
          </g>
          <g data-part={k === 0 ? "companion" : undefined}>
            {segs.slice(0, 3).map((y, i) => (
              <g key={y}>
                <rect x={x0 + 32} y={y + 4 + i * 6} width={16} height={74} rx={6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.3} />
                <ellipse cx={x0 + 40} cy={y + 38 + i * 6} rx={4} ry={6} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
              </g>
            ))}
          </g>
        </g>
      ))}
      {flow && (
        <g>
          {Array.from({ length: 7 }, (_, i) => (
            <Dot key={`w${i}`} phase={phase} x={366} y0={296} y1={48} offset={i / 7} color="var(--bio-water-deep)" r={4} />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <Dot key={`a${i}`} phase={phase} x={442} y0={296} y1={48} offset={i / 5 + 0.1} color="var(--bio-nerve-deep)" />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <Dot key={`b${i}`} phase={phase} x={514} y0={48} y1={296} offset={i / 5 + 0.3} color="var(--bio-nerve-deep)" />
          ))}
        </g>
      )}
      {/* direction arrows */}
      <g fill="none" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M366 330 L366 312 M360 318 L366 311 L372 318" stroke="var(--bio-water-deep)" />
        <path d="M570 230 L570 120 M564 128 L570 120 L576 128 M564 222 L570 230 L576 222" stroke="var(--bio-nerve-deep)" />
      </g>
    </g>
  );
}

/** A vascular bundle in cross-section and longitudinal section. `kind`: "open" (dicot, with cambium) or "closed" (monocot). */
export function PlantVascularBundle({ mode = "names", show, ask, highlight, legend, kind = "open", flow = false }: DrawingProps & { kind?: "open" | "closed"; flow?: boolean }) {
  const closed = kind === "closed";
  return (
    <Figure
      title={closed ? tx("A closed vascular bundle (monocot)", "Ein geschlossenes Leitbündel (einkeimblättrig)") : tx("A vascular bundle: cross-section and longitudinal section", "Ein Leitbündel im Quer- und Längsschnitt")}
      width={600}
      height={340}
      parts={closed ? PARTS_CLOSED : PARTS_OPEN}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <line x1={300} y1={30} x2={300} y2={320} stroke="var(--line-2)" strokeWidth={1.4} strokeDasharray="4 5" />
      <Cross closed={closed} />
      <Long flow={flow} />
    </Figure>
  );
}
