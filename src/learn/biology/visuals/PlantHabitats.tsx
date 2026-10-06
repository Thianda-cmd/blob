"use client";

// Leaves adapted to their habitat, in cross-section: a xerophyte (oleander: thick cuticle,
// multi-layered epidermis, stomata sunken in hairy pits), a hygrophyte (thin leaf, raised
// stomata, living hairs), a hydrophyte (water lily floating leaf: stomata on top, aerenchyma)
// and the rolled leaf of marram grass. PlantHabitats lets the student switch between them.

import { Droplets, Sun, Waves, Wind } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useLocale } from "@/i18n/client";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { Inline } from "@/learn/components/Rich";
import { PlantNote, PlantSeg } from "./PlantUi";
import { cos, sin } from "@/lib/stableMath";

export type LeafKind = "xero" | "hygro" | "hydro" | "rolled";

const WALL = "var(--bio-wall-deep)";
const CELL = "var(--bio-cell)";
const CHL = "var(--bio-chloro)";
const CHL_D = "var(--bio-leaf-deep)";
const WAX = "var(--bio-membrane)";

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;

/** A row of rectangular cells between x0 and x1. */
function Row({ y, h, x0 = 0, x1 = 520, w = 16, skip, chloro = false }: { y: number; h: number; x0?: number; x1?: number; w?: number; skip?: (x: number) => boolean; chloro?: boolean }) {
  const cells: number[] = [];
  for (let x = x0; x < x1; x += w) if (!skip?.(x + w / 2)) cells.push(x);
  return (
    <g>
      {cells.map((x) => (
        <g key={x}>
          <rect x={x + 0.6} y={y} width={w - 1.2} height={h} rx={Math.min(5, w / 3)} fill={CELL} stroke={WALL} strokeWidth={1.1} />
          {chloro &&
            Array.from({ length: Math.max(1, Math.floor(h / 11)) }, (_, k) => (
              <ellipse key={k} cx={x + (k % 2 ? w - 4 : 4)} cy={y + 6 + k * 10} rx={2} ry={3.2} fill={CHL} stroke={CHL_D} strokeWidth={0.5} />
            ))}
        </g>
      ))}
    </g>
  );
}

/** Loose spongy cells in a band, leaving out a few areas. */
function Spongy({ y0, y1, dx = 34, rx = 14, ry = 9, avoid = [] as [number, number, number, number][] }: { y0: number; y1: number; dx?: number; rx?: number; ry?: number; avoid?: [number, number, number, number][] }) {
  const out: { x: number; y: number; a: number }[] = [];
  let row = 0;
  for (let y = y0 + ry; y <= y1 - ry + 2; y += ry * 2.1, row++) {
    for (let x = (row % 2) * (dx / 2); x < 530; x += dx) {
      if (avoid.some(([cx, cy, ax, ay]) => inEllipse(x, y, cx, cy, ax + rx, ay + ry))) continue;
      out.push({ x, y, a: (((x * 7 + row * 13) % 9) - 4) * 6 });
    }
  }
  return (
    <g>
      {out.map((c, i) => (
        <g key={i} transform={`translate(${c.x} ${c.y}) rotate(${c.a})`}>
          <ellipse rx={rx} ry={ry} fill={CELL} stroke={WALL} strokeWidth={1.1} />
          <ellipse cx={-rx * 0.45} cy={0} rx={2.6} ry={1.8} fill={CHL} />
          <ellipse cx={rx * 0.4} cy={ry * 0.3} rx={2.6} ry={1.8} fill={CHL} />
        </g>
      ))}
    </g>
  );
}

/** A stoma in cross-section: two small guard cells around a gap at (x, y). */
function Guard({ x, y, s = 1, up = false }: { x: number; y: number; s?: number; up?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${up ? -s : s})`}>
      {[-1, 1].map((k) => (
        <g key={k}>
          <path d={`M${k * 2.5} -7 C${k * 14} -9 ${k * 15} 7 ${k * 3} 7 C${k * 1.5} 3 ${k * 1.5} -3 ${k * 2.5} -7 Z`} fill={CELL} stroke={WALL} strokeWidth={1.3} />
          <path d={`M${k * 2.5} -6 C${k * 1.5} -3 ${k * 1.5} 3 ${k * 3} 6`} fill="none" stroke={WALL} strokeWidth={2.6} strokeLinecap="round" />
          <circle cx={k * 8} cy={-1} r={1.9} fill={CHL} />
        </g>
      ))}
    </g>
  );
}

function Bundle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <circle key={i} cx={cos(a) * 17} cy={sin(a) * 15} r={5.5} fill={CELL} stroke={WALL} strokeWidth={1} />;
      })}
      <circle cx={-5} cy={-4} r={4} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      <circle cx={5} cy={-5} r={3.3} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1.6} />
      <circle cx={0} cy={6} r={4.6} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// The four leaves

const CRYPTS = [300, 116];

function Xero() {
  const crypt = (cx: number) => `M${cx - 14} 214 C${cx - 16} 196 ${cx - 46} 186 ${cx - 40} 160 C${cx - 34} 138 ${cx + 34} 138 ${cx + 40} 160 C${cx + 46} 186 ${cx + 16} 196 ${cx + 14} 214`;
  return (
    <g>
      <g data-part="cuticle">
        <rect x={0} y={16} width={520} height={11} rx={3} fill={WAX} opacity={0.85} />
        <rect x={0} y={214} width={520} height={8} rx={3} fill={WAX} opacity={0.85} />
      </g>
      <g data-part="epidermis">
        <Row y={27} h={9} w={14} />
        <Row y={36} h={9} w={18} x0={-6} />
        <Row y={45} h={9} w={15} x0={-3} />
        <Row y={196} h={9} w={16} skip={(x) => CRYPTS.some((c) => Math.abs(x - c) < 28)} />
        <Row y={205} h={9} w={14} x0={-5} skip={(x) => CRYPTS.some((c) => Math.abs(x - c) < 20)} />
      </g>
      <g data-part="palisade">
        <Row y={55} h={44} w={12} chloro />
        <Row y={100} h={36} w={12} x0={-6} chloro />
      </g>
      <Spongy y0={136} y1={196} dx={30} rx={12} ry={8} avoid={[[CRYPTS[0], 176, 38, 38], [CRYPTS[1], 176, 38, 38], [430, 168, 22, 18]]} />
      <Bundle x={430} y={166} s={1} />
      {CRYPTS.map((cx) => (
        <g key={cx}>
          <path d={`${crypt(cx)} Z`} fill="var(--bio-vacuole)" opacity={0.5} />
          <path d={crypt(cx)} fill="none" stroke={WAX} strokeWidth={3} />
          <path d={crypt(cx)} fill="none" stroke={WALL} strokeWidth={1.2} />
        </g>
      ))}
      <g data-part="crypt">
        {CRYPTS.flatMap((cx) => [
          <Guard key={`${cx}a`} x={cx - 24} y={150} s={0.8} />,
          <Guard key={`${cx}b`} x={cx + 22} y={150} s={0.8} />,
          <Guard key={`${cx}c`} x={cx} y={141} s={0.8} />,
        ])}
      </g>
      <g data-part="hairs" stroke="var(--ink-3)" strokeWidth={1.3} strokeLinecap="round" fill="none">
        {CRYPTS.flatMap((cx) =>
          [-1, 1].flatMap((sd) =>
            [0, 1, 2, 3].map((k) => {
              const y = 196 - k * 11;
              const x = cx + sd * (16 + k * 6);
              return <path key={`${cx}${sd}${k}`} d={`M${x} ${y} q${-sd * 8} 2 ${-sd * 15} 8`} />;
            }),
          ),
        )}
      </g>
    </g>
  );
}

function Hygro() {
  const hairs = [80, 230, 380];
  return (
    <g>
      <g data-part="thin">
        <rect x={0} y={58} width={520} height={2.5} fill={WAX} opacity={0.85} />
      </g>
      <Row y={60} h={14} w={22} />
      <Row y={75} h={30} w={16} chloro />
      <g data-part="air">
        <rect x={0} y={106} width={520} height={44} fill="var(--bio-vacuole)" opacity={0.5} />
      </g>
      <Spongy y0={106} y1={150} dx={46} rx={16} ry={9} avoid={[[300, 150, 20, 10], [450, 150, 20, 10]]} />
      <Row y={150} h={13} w={22} skip={(x) => [300, 450].some((c) => Math.abs(x - c) < 10)} />
      <g data-part="raised">
        {[300, 450].map((x) => (
          <g key={x}>
            <path d={`M${x - 22} 163 Q${x - 18} 178 ${x} 180 Q${x + 18} 178 ${x + 22} 163`} fill={CELL} stroke={WALL} strokeWidth={1.2} />
            <Guard x={x} y={176} s={0.9} />
          </g>
        ))}
      </g>
      <g data-part="hairs" fill={CELL} stroke={WALL} strokeWidth={1.1}>
        {hairs.map((x) => (
          <g key={x}>
            <path d={`M${x - 4} 60 L${x - 4} 40 L${x - 3} 22 Q${x} 4 ${x + 3} 22 L${x + 4} 40 L${x + 4} 60 Z`} />
            <path d={`M${x - 4} 40 L${x + 4} 40 M${x - 3} 22 L${x + 3} 22`} />
          </g>
        ))}
        {[150, 520 - 150].map((x) => (
          <path key={x} d={`M${x - 3} 163 L${x - 3} 182 Q${x} 196 ${x + 3} 182 L${x + 3} 163 Z`} />
        ))}
      </g>
    </g>
  );
}

function Hydro() {
  const chambers = [
    [16, 110, 62, 64],
    [86, 102, 62, 72],
    [172, 112, 50, 62],
    [230, 104, 66, 70],
    [304, 110, 60, 64],
    [372, 102, 68, 72],
    [448, 110, 64, 62],
  ];
  return (
    <g>
      {/* water under the floating leaf */}
      <rect x={0} y={196} width={520} height={40} fill="var(--bio-water)" opacity={0.35} />
      <path d="M0 200 Q20 196 40 200 T80 200 T120 200 T160 200 T200 200 T240 200 T280 200 T320 200 T360 200 T400 200 T440 200 T480 200 T520 200" fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.4} />
      <rect x={0} y={16} width={520} height={5} rx={2} fill={WAX} opacity={0.9} />
      <Row y={21} h={14} w={20} skip={(x) => [180, 380].some((c) => Math.abs(x - c) < 14)} />
      <g data-part="topstoma">
        {[180, 380].map((x) => (
          <Guard key={x} x={x} y={28} s={0.95} up />
        ))}
      </g>
      <g data-part="palisade">
        <Row y={36} h={30} w={12} chloro />
        <Row y={66} h={28} w={12} x0={-6} chloro />
      </g>
      <g data-part="aerenchyma">
        <rect x={0} y={95} width={520} height={88} fill={CELL} stroke={WALL} strokeWidth={0.6} />
        {chambers.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={14} fill="var(--bio-vacuole)" stroke={WALL} strokeWidth={1.2} />
        ))}
      </g>
      <Bundle x={160} y={140} s={0.55} />
      <g data-part="lower">
        <Row y={183} h={11} w={22} />
      </g>
    </g>
  );
}

function Rolled() {
  const C = [260, 158];
  const pol = (r: number, deg: number): [number, number] => [C[0] + cos((deg * Math.PI) / 180) * r, C[1] + sin((deg * Math.PI) / 180) * r];
  const arc = (r: number, a0: number, a1: number) => {
    const [x0, y0] = pol(r, a0);
    const [x1, y1] = pol(r, a1);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 1 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const A0 = -72;
  const A1 = 252;
  const ribs = 9;
  const step = (A1 - A0) / ribs;
  return (
    <g>
      <g data-part="space">
        <circle cx={C[0]} cy={C[1]} r={78} fill="var(--bio-vacuole)" opacity={0.55} />
      </g>
      {/* blade: tissue between outer surface and groove bottoms */}
      <path d={`${arc(128, A0, A1)}`} fill="none" stroke="var(--bio-leaf)" strokeWidth={36} />
      <g data-part="outer">
        <path d={arc(141, A0, A1)} fill="none" stroke={WAX} strokeWidth={5} strokeLinecap="round" />
        <path d={arc(134, A0, A1)} fill="none" stroke="var(--bio-wall)" strokeWidth={9} />
        <path d={arc(134, A0, A1)} fill="none" stroke={WALL} strokeWidth={9} strokeDasharray="1.2 4.5" />
      </g>
      {/* ribs pointing inwards, each with a small bundle */}
      {Array.from({ length: ribs }, (_, i) => {
        const a = A0 + step * (i + 0.5);
        const w = step * 0.36;
        const [bx0, by0] = pol(112, a - w);
        const [bx1, by1] = pol(112, a + w);
        const [tx0, ty0] = pol(84, a - w * 0.45);
        const [tx1, ty1] = pol(84, a + w * 0.45);
        const [tip0, tip1] = pol(78, a);
        const [bx, by] = pol(98, a);
        return (
          <g key={i}>
            <path d={`M${bx0} ${by0} L${tx0} ${ty0} Q${tip0} ${tip1} ${tx1} ${ty1} L${bx1} ${by1} Z`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
            <circle cx={bx} cy={by} r={5} fill="var(--bio-mito)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
          </g>
        );
      })}
      <g data-part="grooves">
        {Array.from({ length: ribs - 1 }, (_, i) => {
          const a = A0 + step * (i + 1);
          const [x, y] = pol(108, a);
          return <circle key={i} cx={x} cy={y} r={4.6} fill={CELL} stroke={WALL} strokeWidth={1.6} />;
        })}
      </g>
      <g data-part="hairs" stroke="var(--ink-3)" strokeWidth={1.2} strokeLinecap="round">
        {Array.from({ length: ribs }, (_, i) => {
          const a = A0 + step * (i + 0.5);
          return [-1, 1].map((sd) => {
            const [x0, y0] = pol(90, a + sd * step * 0.18);
            const [x1, y1] = pol(84, a + sd * step * 0.42);
            return <line key={`${i}${sd}`} x1={x0} y1={y0} x2={x1} y2={y1} />;
          });
        })}
      </g>
    </g>
  );
}

const PARTS: Record<LeafKind, FigurePart[]> = {
  xero: [
    { id: "cuticle", label: tx("thick cuticle", "dicke Cuticula"), at: [470, 21], tag: [496, 6], info: tx("A thick wax layer: hardly any water escapes through the surface.", "Eine dicke Wachsschicht: Durch die Oberfläche verdunstet kaum Wasser.") },
    { id: "epidermis", label: tx("multi-layered epidermis", "mehrschichtige Epidermis"), at: [40, 41], tag: [14, 6], info: tx("Several layers of cells protect against drying out and strong sunlight.", "Mehrere Zellschichten schützen vor Austrocknung und starker Sonne.") },
    { id: "palisade", label: tx("dense palisade tissue", "dichtes Palisadengewebe"), at: [210, 80], tag: [210, 6], info: tx("Several rows of tightly packed palisade cells: lots of photosynthesis on a small leaf surface.", "Mehrere Reihen dicht gepackter Palisadenzellen: viel Fotosynthese auf kleiner Blattfläche.") },
    { id: "crypt", label: tx("sunken stomata in a pit", "eingesenkte Spaltöffnungen in einer Grube"), at: [300, 141], tag: [372, 244], info: tx("The stomata sit deep in a pit. Moist, still air collects there: the difference to the outside air is small, so less water evaporates.", "Die Spaltöffnungen liegen tief in einer Grube. Dort sammelt sich feuchte, windstille Luft: Der Unterschied zur Außenluft ist klein, also verdunstet weniger Wasser.") },
    { id: "hairs", label: tx("hairs in the pit", "Haare in der Grube"), at: [278, 190], tag: [230, 244], info: tx("Dead hairs keep the air in the pit still and moist.", "Tote Haare halten die Luft in der Grube still und feucht.") },
  ],
  hygro: [
    { id: "thin", label: tx("thin cuticle, thin leaf", "dünne Cuticula, dünnes Blatt"), at: [470, 59], tag: [496, 30], info: tx("A thin wax layer and a thin leaf: water evaporates easily even in humid air.", "Eine dünne Wachsschicht und ein dünnes Blatt: Wasser verdunstet leicht, selbst in feuchter Luft.") },
    { id: "raised", label: tx("raised stomata", "emporgehobene Spaltöffnungen"), at: [450, 176], tag: [496, 190], info: tx("The stomata sit on little bumps, right in the moving air: water vapour can escape more easily.", "Die Spaltöffnungen sitzen auf kleinen Erhebungen, direkt in der bewegten Luft: Wasserdampf entweicht leichter.") },
    { id: "hairs", label: tx("living hairs", "lebende Haare"), at: [230, 30], tag: [180, 14], info: tx("Living hairs enlarge the surface that gives off water.", "Lebende Haare vergrößern die Oberfläche, über die Wasser abgegeben wird.") },
    { id: "air", label: tx("large air spaces", "große Interzellularen"), at: [120, 128], tag: [24, 186], info: tx("Lots of air space inside: more surface for evaporation.", "Viel Luftraum im Blatt: mehr Oberfläche zum Verdunsten.") },
  ],
  hydro: [
    { id: "topstoma", label: tx("stomata on the upper side", "Spaltöffnungen auf der Oberseite"), at: [180, 28], tag: [180, 4], info: tx("The underside touches the water, so the stomata are on top, facing the air.", "Die Unterseite liegt auf dem Wasser, darum liegen die Spaltöffnungen oben, zur Luft hin.") },
    { id: "palisade", label: tx("palisade tissue", "Palisadengewebe"), at: [470, 60], tag: [496, 40], info: tx("Lots of light on the water surface: a well-developed palisade layer.", "Viel Licht auf der Wasseroberfläche: ein gut ausgebildetes Palisadengewebe.") },
    { id: "aerenchyma", label: tx("aerenchyma (air tissue)", "Aerenchym (Durchlüftungsgewebe)"), at: [262, 140], tag: [496, 140], info: tx("Huge air chambers: they keep the leaf afloat and bring oxygen to the parts in the mud.", "Riesige Luftkammern: Sie halten das Blatt schwimmend und bringen Sauerstoff zu den Teilen im Schlamm.") },
    { id: "lower", label: tx("lower epidermis without stomata", "untere Epidermis ohne Spaltöffnungen"), at: [330, 188], tag: [330, 222], info: tx("It lies on the water: no stomata and only a thin cuticle.", "Sie liegt auf dem Wasser: keine Spaltöffnungen und nur eine dünne Cuticula.") },
  ],
  rolled: [
    { id: "outer", label: tx("outer side: thick cuticle, no stomata", "Außenseite: dicke Cuticula, keine Spaltöffnungen"), at: [260 + 141 * cos(Math.PI * 0.25), 158 + 141 * sin(Math.PI * 0.25)], tag: [470, 280], info: tx("Facing the dry wind: a thick wax layer and supporting fibres, no stomata.", "Zum trockenen Wind hin: dicke Wachsschicht und Festigungsfasern, keine Spaltöffnungen.") },
    { id: "grooves", label: tx("stomata in the grooves", "Spaltöffnungen in den Rinnen"), at: [260 + 108 * cos((-72 + 36) * (Math.PI / 180)), 158 + 108 * sin((-72 + 36) * (Math.PI / 180))], tag: [470, 30], info: tx("The stomata lie deep in the grooves on the inside of the rolled leaf.", "Die Spaltöffnungen liegen tief in den Rinnen auf der Innenseite des eingerollten Blattes.") },
    { id: "hairs", label: tx("hairs", "Haare"), at: [260 + 86 * cos(Math.PI), 158], tag: [30, 158], info: tx("Hairs on the ribs slow down the air inside.", "Haare an den Rippen bremsen die Luft im Inneren.") },
    { id: "space", label: tx("still, moist inner space", "windstiller, feuchter Innenraum"), at: [260, 158], tag: [30, 280], info: tx("Rolled up in drought: the air inside stays moist, so little water escapes.", "Bei Trockenheit eingerollt: Die Luft innen bleibt feucht, also entweicht wenig Wasser.") },
  ],
};

const SIZE: Record<LeafKind, [number, number]> = { xero: [520, 256], hygro: [520, 200], hydro: [520, 236], rolled: [520, 310] };
const TITLE: Record<LeafKind, Text> = {
  xero: tx("Leaf of a xerophyte (oleander)", "Blatt eines Xerophyten (Oleander)"),
  hygro: tx("Leaf of a hygrophyte (touch-me-not)", "Blatt eines Hygrophyten (Springkraut)"),
  hydro: tx("Floating leaf of a hydrophyte (water lily)", "Schwimmblatt eines Hydrophyten (Seerose)"),
  rolled: tx("Rolled leaf of marram grass", "Rollblatt des Strandhafers"),
};

/** One adapted leaf in cross-section. */
export function PlantAdaptLeaf({ kind, mode = "names", show, ask, highlight, legend }: DrawingProps & { kind: LeafKind }) {
  const [w, h] = SIZE[kind];
  return (
    <Figure title={TITLE[kind]} width={w} height={h} parts={PARTS[kind]} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {kind === "xero" ? <Xero /> : kind === "hygro" ? <Hygro /> : kind === "hydro" ? <Hydro /> : <Rolled />}
    </Figure>
  );
}

const ABOUT: Record<LeafKind, Text> = {
  xero: tx(
    "**Xerophytes** live in dry places (oleander, cacti, pines). They save water: thick cuticle, several layers of epidermis, small leaves or spines, stomata sunken in hairy pits, water-storing tissue in succulents.",
    "**Xerophyten** leben an trockenen Standorten (Oleander, Kakteen, Kiefer). Sie sparen Wasser: dicke Cuticula, mehrschichtige Epidermis, kleine Blätter oder Dornen, eingesenkte Spaltöffnungen in behaarten Gruben, bei Sukkulenten Wasserspeichergewebe.",
  ),
  hygro: tx(
    "**Hygrophytes** live in damp, shady places (touch-me-not, wood sorrel). In humid air, water hardly evaporates, but they need the transpiration stream for their minerals. So they promote transpiration: large thin leaves, thin cuticle, raised stomata, living hairs.",
    "**Hygrophyten** leben an feuchten, schattigen Standorten (Springkraut, Sauerklee). In feuchter Luft verdunstet kaum Wasser, sie brauchen den Transpirationsstrom aber für ihre Mineralstoffe. Darum fördern sie die Transpiration: große, dünne Blätter, dünne Cuticula, emporgehobene Spaltöffnungen, lebende Haare.",
  ),
  hydro: tx(
    "**Hydrophytes** live in water (water lily, Canadian waterweed). Floating leaves have their stomata on top. Aerenchyma gives buoyancy and oxygen. Water carries them, so they need little supporting tissue and xylem. Submerged leaves have no stomata and take up substances over their whole surface.",
    "**Hydrophyten** leben im Wasser (Seerose, Wasserpest). Schwimmblätter haben ihre Spaltöffnungen oben. Das Aerenchym sorgt für Auftrieb und Sauerstoff. Das Wasser trägt sie, darum brauchen sie wenig Festigungsgewebe und Xylem. Untergetauchte Blätter haben keine Spaltöffnungen und nehmen Stoffe über die ganze Oberfläche auf.",
  ),
  rolled: tx(
    "**Marram grass** grows on dry, windy dunes. In drought its leaves roll up: the stomata lie in hairy grooves on the inside, where the air stays still and moist. The outside facing the wind has a thick cuticle and no stomata.",
    "**Strandhafer** wächst auf trockenen, windigen Dünen. Bei Trockenheit rollen sich seine Blätter ein: Die Spaltöffnungen liegen in behaarten Rinnen auf der Innenseite, wo die Luft still und feucht bleibt. Die Außenseite zum Wind hat eine dicke Cuticula und keine Spaltöffnungen.",
  ),
};

/** Switch between the four leaf types and explore their adaptations. */
export function PlantHabitats() {
  const t = useText();
  const locale = useLocale();
  const [kind, setKind] = useState<LeafKind>("xero");
  const icon = { xero: <Sun className="size-4" />, hygro: <Droplets className="size-4" />, hydro: <Waves className="size-4" />, rolled: <Wind className="size-4" /> }[kind];
  return (
    <div className="space-y-4">
      <PlantSeg
        label={t(tx("Habitat", "Standort"))}
        value={kind}
        onChange={setKind}
        options={[
          { id: "xero", label: t(tx("Dry", "Trocken")) },
          { id: "hygro", label: t(tx("Damp", "Feucht")) },
          { id: "hydro", label: t(tx("Water", "Wasser")) },
          { id: "rolled", label: t(tx("Dune", "Düne")) },
        ]}
      />
      <PlantAdaptLeaf key={kind} kind={kind} mode="explore" />
      <PlantNote id={`${kind}-${locale}`}>
        <span className="flex gap-2">
          <span className="mt-1 shrink-0 text-blob-ink">{icon}</span>
          <span>
            <Inline text={ABOUT[kind]} />
          </span>
        </span>
      </PlantNote>
    </div>
  );
}
