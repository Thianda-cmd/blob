"use client";

// What you see through the eyepiece: a round field of view with a specimen (onion skin, cheek
// cells, an Elodea leaf or cork). `zoom` 1 is the view with the 40× objective; smaller zooms
// show the same tissue with weaker objectives. Used by the microscope lab and as a task picture.

import { useId } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cos, pow, sin } from "@/lib/stableMath";

export type Specimen = "onion" | "cheek" | "elodea" | "cork";

export const SPECIMENS: Record<Specimen, { name: Text; what: Text }> = {
  onion: {
    name: tx("onion skin", "Zwiebelhaut"),
    what: tx(
      "Onion skin cells: long, like bricks in a wall, each with a cell wall, a nucleus and a big vacuole. No chloroplasts: the onion grows in the dark.",
      "Zwiebelhautzellen: lang gestreckt wie Ziegel in einer Mauer, jede mit Zellwand, Zellkern und großer Vakuole. Keine Chloroplasten: Die Zwiebel wächst im Dunkeln.",
    ),
  },
  cheek: {
    name: tx("cheek cells (oral mucosa)", "Mundschleimhaut"),
    what: tx(
      "Cheek cells: flat, irregular and lying loosely. Each has a nucleus, but there is no cell wall and no vacuole.",
      "Mundschleimhautzellen: flach, unregelmäßig geformt und lose verteilt. Jede hat einen Zellkern, aber keine Zellwand und keine Vakuole.",
    ),
  },
  elodea: {
    name: tx("Elodea leaf", "Blatt der Wasserpest"),
    what: tx(
      "Elodea leaf cells: neat rows of cells with walls, full of green chloroplasts lining the walls.",
      "Zellen des Wasserpestblatts: ordentliche Reihen von Zellen mit Zellwänden, voller grüner Chloroplasten am Rand.",
    ),
  },
  cork: {
    name: tx("slice of cork", "Korkscheibe"),
    what: tx(
      "Cork: only empty cell walls are left, like a honeycomb. Robert Hooke saw this in 1665 and called the chambers 'cells'.",
      "Kork: Übrig sind nur leere Zellwände, wie Waben. Robert Hooke sah das 1665 und nannte die Kämmerchen „Zellen“.",
    ),
  },
};

// Small seeded wobble so tiles don't look machine-made (deterministic, the same on server and client).
const wob = (i: number, k = 1) => (((sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1) + 1) % 1;

const ONION = { w: 450, h: 120 };
const ONION_ROWS = [0, 70, 25, 108];
const ELODEA = { w: 330, h: 144 };
const CHEEK = { w: 320, h: 300 };
const CORK = { w: 90, h: 51.96 };

function OnionTile({ sw }: { sw: number }) {
  return (
    <>
      {ONION_ROWS.map((off, r) =>
        [-1, 0, 1, 2, 3].map((k) => {
          const x = off + k * 150;
          const i = r * 5 + ((k % 3) + 3) % 3 + 1;
          const nx = x + 30 + wob(i) * 90;
          const ny = r * 30 + 9 + wob(i, 2) * 12;
          return (
            <g key={`${r}-${k}`}>
              <rect x={x + 1} y={r * 30 + 1} width={148} height={28} rx={4} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={sw} />
              <ellipse cx={nx} cy={ny} rx={7} ry={5.5} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={sw * 0.7} />
            </g>
          );
        }),
      )}
    </>
  );
}

function ElodeaTile({ sw }: { sw: number }) {
  const rows = [0, 55, 20, 80];
  return (
    <>
      {rows.map((off, r) =>
        [-1, 0, 1, 2, 3].map((k) => {
          const x = off + k * 110;
          const y = r * 36;
          const i = r * 5 + ((k % 3) + 3) % 3 + 3;
          const chl: [number, number][] = [];
          for (let c = 0; c < 9; c++) chl.push([x + 10 + c * 11 + wob(i + c) * 3, y + 7 + wob(i, c) * 2]);
          for (let c = 0; c < 9; c++) chl.push([x + 12 + c * 11 + wob(i + c, 4) * 3, y + 29 - wob(i, c + 9) * 2]);
          chl.push([x + 7, y + 18], [x + 104, y + 16]);
          return (
            <g key={`${r}-${k}`}>
              <rect x={x + 1} y={y + 1} width={108} height={34} rx={4} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={sw} />
              {chl.map(([cx, cy], j) => (
                <ellipse key={j} cx={cx} cy={cy} rx={4.2} ry={3} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={sw * 0.5} />
              ))}
            </g>
          );
        }),
      )}
    </>
  );
}

const CHEEK_CELLS: [number, number, number, number][] = [
  [70, 70, 52, 0.3],
  [215, 95, 46, 1.4],
  [120, 215, 50, 2.2],
  [262, 240, 40, 0.9],
];

function cheekPath(cx: number, cy: number, r: number, rot: number, seed: number) {
  const n = 7;
  const pts = Array.from({ length: n }, (_, k) => {
    const a = rot + (k / n) * 2 * Math.PI;
    const rr = r * (0.78 + wob(seed * 9 + k) * 0.35);
    return [cx + rr * cos(a), cy + rr * sin(a) * 0.86];
  });
  // rounded polygon: quadratic curves through the edge midpoints
  const mid = (p: number[], q: number[]) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  let d = `M ${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const m = mid(pts[k], pts[(k + 1) % n]);
    d += ` Q ${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d} Z`;
}

function CheekTile({ sw }: { sw: number }) {
  return (
    <>
      {CHEEK_CELLS.flatMap(([cx, cy, r, rot], i) =>
        [
          [0, 0],
          [-CHEEK.w, 0],
          [0, -CHEEK.h],
          [CHEEK.w, 0],
          [0, CHEEK.h],
        ].map(([dx, dy]) => (
          <g key={`${i}-${dx}-${dy}`}>
            <path d={cheekPath(cx + dx, cy + dy, r, rot, i + 1)} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={sw} />
            <circle cx={cx + dx + 3} cy={cy + dy - 2} r={7.5} fill="var(--bio-water-deep)" opacity={0.8} />
            {[0, 1, 2, 3, 4].map((g) => (
              <circle key={g} cx={cx + dx - r * 0.45 + wob(i * 7 + g) * r * 0.9} cy={cy + dy - r * 0.4 + wob(i * 7 + g, 3) * r * 0.8} r={1.4} fill="var(--bio-water-deep)" opacity={0.45} />
            ))}
          </g>
        )),
      )}
    </>
  );
}

function CorkTile({ sw }: { sw: number }) {
  // a honeycomb of empty cells: two rows of hexagons per tile
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, k) => {
      const a = (Math.PI / 3) * k;
      return `${(cx + r * cos(a)).toFixed(1)},${(cy + r * sin(a)).toFixed(1)}`;
    }).join(" ");
  const cells: [number, number][] = [];
  for (let c = -1; c <= 3; c++) for (let r = -1; r <= 2; r++) cells.push([c * 45, r * 51.96 + (c % 2 ? 25.98 : 0)]);
  return (
    <>
      {cells.map(([x, y], i) => (
        <polygon key={i} points={hex(x, y, 28)} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={sw * 1.6} />
      ))}
    </>
  );
}

/** The field of view. `zoom` 1 = 40× objective, 0.25 = 10×, 0.1 = 4×. */
export function SpecimenField({ kind, zoom = 1, blur = 0, brightness = 1, contrast = 1, className }: { kind: Specimen; zoom?: number; blur?: number; brightness?: number; contrast?: number; className?: string }) {
  const t = useText();
  const id = `spec-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const size = kind === "onion" ? ONION : kind === "elodea" ? ELODEA : kind === "cheek" ? CHEEK : CORK;
  // Lines stay visible when zoomed out and don't get too fat when zoomed in.
  const sw = 1.3 / pow(zoom, 0.55);
  const filter = [blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : "", brightness !== 1 ? `brightness(${brightness.toFixed(2)})` : "", contrast !== 1 ? `contrast(${contrast.toFixed(2)})` : ""].filter(Boolean).join(" ");
  return (
    <div className={className ?? "relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-full border-[6px] border-ink/80 bg-raised shadow-card"}>
      <svg viewBox="0 0 260 260" className="block h-full w-full" style={filter ? { filter } : undefined} role="img" aria-label={t(SPECIMENS[kind].name)}>
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width={size.w} height={size.h} patternTransform={`translate(130 130) scale(${zoom}) translate(-37 -23)`}>
            <rect width={size.w} height={size.h} fill={kind === "cheek" ? "var(--raised)" : kind === "cork" ? "var(--bio-wood)" : "var(--bio-cell)"} />
            {kind === "onion" && <OnionTile sw={sw} />}
            {kind === "elodea" && <ElodeaTile sw={sw} />}
            {kind === "cheek" && <CheekTile sw={sw} />}
            {kind === "cork" && <CorkTile sw={sw} />}
          </pattern>
        </defs>
        <rect width={260} height={260} fill={`url(#${id})`} />
      </svg>
    </div>
  );
}

/** A task picture: what the student sees through the microscope (40× objective unless set). */
export function CellSpecimenView({ kind, zoom = 1 }: { kind: Specimen; zoom?: number }) {
  return <SpecimenField kind={kind} zoom={zoom} />;
}
