"use client";

// Stems in cross-section: the young (primary) stem of a dicot with a ring of vascular bundles
// or of a monocot with scattered bundles, and a woody stem after secondary growth with bark,
// bast, cambium, annual rings (early and late wood), rays and pith.

import { useId } from "react";
import { tx, type Text } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const WALL = "var(--bio-wall-deep)";
const CELL = "var(--bio-cell)";

// ---------------------------------------------------------------------------
// Young stem: dicot or monocot

const CX = 180;
const CY = 180;

function cellPattern(id: string) {
  return (
    <pattern id={id} width={14} height={12} patternUnits="userSpaceOnUse">
      <rect width={14} height={12} fill={CELL} />
      <circle cx={7} cy={6} r={5.4} fill="none" stroke={WALL} strokeWidth={0.6} opacity={0.55} />
      <circle cx={0} cy={0} r={5.4} fill="none" stroke={WALL} strokeWidth={0.6} opacity={0.55} />
      <circle cx={14} cy={0} r={5.4} fill="none" stroke={WALL} strokeWidth={0.6} opacity={0.55} />
      <circle cx={0} cy={12} r={5.4} fill="none" stroke={WALL} strokeWidth={0.6} opacity={0.55} />
      <circle cx={14} cy={12} r={5.4} fill="none" stroke={WALL} strokeWidth={0.6} opacity={0.55} />
    </pattern>
  );
}

/** One open bundle pointing outwards at angle a (radians): phloem outside, cambium, xylem inside. */
function OpenBundle({ a, r }: { a: number; r: number }) {
  const deg = (a * 180) / Math.PI;
  return (
    <g transform={`translate(${CX + Math.cos(a) * r} ${CY + Math.sin(a) * r}) rotate(${deg + 90})`}>
      <path d="M-15 -16 Q0 -30 15 -16 L12 -4 L-12 -4 Z" fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.2} />
      <path d="M-14 -16 Q0 -25 14 -16" fill="none" stroke="var(--raised)" strokeWidth={4} opacity={0.6} />
      <path d="M-12 -4 Q0 -2 12 -4 L9 18 Q0 26 -9 18 Z" fill="var(--bio-wood)" fillOpacity={0.35} stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      {[
        [-5, 4, 3.6],
        [4, 3, 3.2],
        [-2, 12, 2.6],
        [5, 12, 2.2],
      ].map(([x, y, rr], i) => (
        <circle key={i} cx={x} cy={y} r={rr} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
      ))}
    </g>
  );
}

/** A closed monocot bundle: two big vessels, phloem, a sheath of fibres. */
function ClosedBundle({ x, y, s, a }: { x: number; y: number; s: number; a: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${(a * 180) / Math.PI + 90}) scale(${s})`}>
      <ellipse rx={11} ry={13} fill="var(--bio-wall)" stroke={WALL} strokeWidth={2} />
      <path d="M-6 -11 Q0 -14 6 -11 L5 -3 L-5 -3 Z" fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={0.8} />
      <circle cx={-5} cy={2} r={3.4} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      <circle cx={5} cy={2} r={3.4} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      <circle cx={0} cy={8} r={2} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={1} />
    </g>
  );
}

/** Scattered positions for monocot bundles: denser and smaller towards the edge. */
const SCATTER = (() => {
  const out: { x: number; y: number; s: number; a: number }[] = [];
  const rings = [
    { r: 136, n: 22, s: 0.62 },
    { r: 112, n: 17, s: 0.78 },
    { r: 86, n: 13, s: 0.92 },
    { r: 58, n: 9, s: 1 },
    { r: 28, n: 4, s: 1 },
  ];
  rings.forEach((g, gi) => {
    for (let i = 0; i < g.n; i++) {
      const a = (i / g.n) * Math.PI * 2 + gi * 0.37 + ((i * 7) % 5) * 0.03;
      const rr = g.r + (((i * 13 + gi) % 5) - 2) * 3;
      out.push({ x: CX + Math.cos(a) * rr, y: CY + Math.sin(a) * rr, s: g.s, a });
    }
  });
  return out;
})();

const PRIMARY_DICOT: FigurePart[] = [
  { id: "epidermis", label: tx("epidermis", "Epidermis"), at: [CX + 108, CY - 108], tag: [342, 22], info: tx("The outer skin of the young stem, with a cuticle.", "Die Außenhaut des jungen Sprosses, mit Cuticula.") },
  { id: "cortex", label: tx("cortex", "Rinde"), at: [CX - 132, CY + 40], tag: [22, 260], info: tx("Ground tissue between the epidermis and the ring of bundles.", "Grundgewebe zwischen Epidermis und Leitbündelring.") },
  { id: "bundle", label: tx("vascular bundle", "Leitbündel"), at: [CX + 105, CY + 4], tag: [342, 196], info: tx("Open bundles arranged in a ring: phloem outside, xylem inside.", "Offene Leitbündel, im Kreis angeordnet: Phloem außen, Xylem innen.") },
  { id: "cambium", label: tx("cambium", "Kambium"), at: [CX + 74, CY + 74], tag: [342, 330], info: tx("Dividing layer between xylem and phloem. Joined into a ring, it makes the stem grow thicker.", "Teilungsfähige Schicht zwischen Xylem und Phloem. Zum Ring geschlossen, lässt sie den Spross in die Dicke wachsen.") },
  { id: "pith", label: tx("pith", "Mark"), at: [CX - 20, CY - 10], tag: [22, 40], info: tx("Ground tissue in the centre, often used for storage.", "Grundgewebe in der Mitte, oft als Speicher.") },
];
const PRIMARY_MONO: FigurePart[] = [
  { id: "epidermis", label: tx("epidermis", "Epidermis"), at: [CX + 108, CY - 108], tag: [342, 22], info: tx("The outer skin, with a cuticle. Below it lies a firm ring of fibres.", "Die Außenhaut mit Cuticula. Darunter liegt ein fester Faserring.") },
  { id: "ground", label: tx("ground tissue", "Grundgewebe"), at: [CX + 43, CY + 8], tag: [22, 260], info: tx("Parenchyma filling the whole stem; there is no clear cortex or pith.", "Parenchym, das den ganzen Spross füllt; Rinde und Mark sind nicht getrennt.") },
  { id: "bundle", label: tx("vascular bundles (scattered)", "Leitbündel (zerstreut)"), at: [SCATTER[30].x, SCATTER[30].y], tag: [342, 196], info: tx("Closed bundles without cambium, scattered over the whole cross-section.", "Geschlossene Leitbündel ohne Kambium, über den ganzen Querschnitt verstreut.") },
];

/** A young stem in cross-section: dicot (ring of open bundles) or monocot (scattered closed bundles). */
export function PlantStemPrimary({ mode = "names", show, ask, highlight, legend, kind = "dicot" }: DrawingProps & { kind?: "dicot" | "monocot" }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const pat = `cells-${uid}`;
  const mono = kind === "monocot";
  return (
    <Figure
      title={mono ? tx("Young stem of a monocot (maize)", "Junger Spross einer Einkeimblättrigen (Mais)") : tx("Young stem of a dicot (sunflower)", "Junger Spross einer Zweikeimblättrigen (Sonnenblume)")}
      width={360}
      height={360}
      parts={mono ? PRIMARY_MONO : PRIMARY_DICOT}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <defs>{cellPattern(pat)}</defs>
      <g data-part="epidermis">
        <circle cx={CX} cy={CY} r={158} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} />
      </g>
      {mono ? (
        <>
          <circle cx={CX} cy={CY} r={152} fill="var(--bio-wall)" stroke={WALL} strokeWidth={1} />
          <g data-part="ground">
            <circle cx={CX} cy={CY} r={146} fill={`url(#${pat})`} />
          </g>
          <g data-part="bundle">
            {SCATTER.map((b, i) => (
              <ClosedBundle key={i} {...b} />
            ))}
          </g>
        </>
      ) : (
        <>
          <g data-part="cortex">
            <circle cx={CX} cy={CY} r={153} fill={`url(#${pat})`} />
          </g>
          <g data-part="pith">
            <circle cx={CX} cy={CY} r={78} fill={`url(#${pat})`} stroke={WALL} strokeWidth={0.8} strokeDasharray="3 3" />
          </g>
          <g data-part="cambium">
            <circle cx={CX} cy={CY} r={104} fill="none" stroke="var(--bio-chloro)" strokeWidth={2.4} strokeDasharray="5 4" />
          </g>
          <g data-part="bundle">
            {Array.from({ length: 10 }, (_, i) => (
              <OpenBundle key={i} a={(i / 10) * Math.PI * 2 + 0.2} r={104} />
            ))}
          </g>
        </>
      )}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Woody stem with annual rings

const SX = 200;
const SY = 200;

/** How far a ring reaches at angle t (all rings share the shape, like real wood). */
const wk = (t: number) => 1 + 0.014 * Math.sin(3 * t + 1) + 0.01 * Math.sin(5 * t + 2.2) + 0.006 * Math.sin(8 * t + 0.4);

/** A slightly irregular circle. */
function wobble(r: number) {
  const n = 90;
  let d = "";
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    d += `${i ? "L" : "M"}${(SX + Math.cos(t) * r * wk(t)).toFixed(1)} ${(SY + Math.sin(t) * r * wk(t)).toFixed(1)} `;
  }
  return `${d}Z`;
}

const EARLY = "color-mix(in oklab, var(--bio-wood) 38%, var(--bio-cell))";
const LATE = "var(--bio-wood-deep)";

export type RingsInfo = { radii: number[]; pith: number; wood: number; bast: number; bark: number };

/** Ring radii: `widths` are relative ring widths (1 = normal); `unit` px per unit, or fit into `fit` px. */
export function ringGeometry(widths: number[], opts: { unit?: number; fit?: number }): RingsInfo {
  const pith = 13;
  const barkW = 8 + Math.min(10, widths.length * 0.9);
  const bastW = 6;
  const sum = widths.reduce((a, b) => a + b, 0);
  const unit = opts.fit ? (opts.fit - pith - barkW - bastW) / Math.max(sum, 0.001) : (opts.unit ?? 12);
  const radii: number[] = [];
  let r = pith;
  for (const w of widths) {
    r += w * unit;
    radii.push(r);
  }
  return { radii, pith, wood: r, bast: r + bastW, bark: r + bastW + barkW };
}

function stemParts(g: RingsInfo, marked: number | null): FigurePart[] {
  // Tags sit in a column right of the disc (left for ray and pith), spread over its height.
  const R = Math.max(g.bark, 120);
  const rx = Math.min(452, SX + g.bark + 46);
  const lx = Math.max(24, SX - g.bark - 46);
  const ry = (i: number) => Math.max(20, Math.min(380, SY - R * 0.85 + ((R * 1.7) / 5) * i));
  const at = (r: number, deg: number): [number, number] => {
    const t = (deg * Math.PI) / 180;
    return [SX + Math.cos(t) * r * wk(t), SY + Math.sin(t) * r * wk(t)];
  };
  const parts: FigurePart[] = [
    { id: "bark", label: tx("bark (outer bark)", "Borke"), at: at((g.bast + g.bark) / 2, -30), tag: [rx, ry(0)], info: tx("Dead tissue on the outside, made by the cork cambium. It cracks as the trunk grows thicker.", "Abgestorbenes Gewebe außen, vom Korkkambium gebildet. Sie reißt auf, wenn der Stamm dicker wird.") },
    { id: "bast", label: tx("bast (secondary phloem)", "Bast (sekundäres Phloem)"), at: at((g.wood + g.bast) / 2, -12), tag: [rx, ry(1)], info: tx("Carries sugar solution. The cambium adds new bast on its outer side.", "Leitet Zuckerlösung. Das Kambium bildet nach außen neuen Bast.") },
    { id: "cambium", label: tx("cambium", "Kambium"), at: at(g.wood, 8), tag: [rx, ry(2)], info: tx("A thin layer of dividing cells: wood inwards, bast outwards.", "Eine dünne Schicht teilungsfähiger Zellen: nach innen Holz, nach außen Bast.") },
    { id: "wood", label: tx("wood (secondary xylem)", "Holz (sekundäres Xylem)"), at: at(g.pith + (g.wood - g.pith) * 0.4, 40), tag: [rx, ry(3)], info: tx("Carries water and minerals and makes the trunk strong.", "Leitet Wasser und Mineralstoffe und macht den Stamm fest.") },
  ];
  if (marked !== null) {
    const outer = g.radii[marked];
    const inner = marked ? g.radii[marked - 1] : g.pith;
    const lateR = outer - (outer - inner) * 0.15;
    const earlyR = inner + (outer - inner) * 0.4;
    parts.push(
      { id: "early", label: tx("early wood", "Frühholz"), at: at(earlyR, 70), tag: [rx, ry(4)], info: tx("Formed in spring: wide, thin-walled cells, light in colour. Lots of water for the new leaves.", "Im Frühjahr gebildet: weite, dünnwandige Zellen, hell. Viel Wasser für den Austrieb.") },
      { id: "late", label: tx("late wood", "Spätholz"), at: at(lateR, 85), tag: [rx, ry(5)], info: tx("Formed in summer: narrow, thick-walled cells, dark. Where it meets next year's early wood you see the ring boundary.", "Im Sommer gebildet: enge, dickwandige Zellen, dunkel. Wo es an das Frühholz des nächsten Jahres grenzt, siehst du die Jahresgrenze.") },
    );
  }
  parts.push(
    { id: "ray", label: tx("wood ray", "Holzstrahl"), at: at(g.pith + (g.wood - g.pith) * 0.6, 202.5), tag: [lx, Math.min(380, SY + R * 0.55)], info: tx("Carries substances sideways, from the inside to the outside, and stores food.", "Leitet Stoffe quer von innen nach außen und speichert Nährstoffe.") },
    { id: "pith", label: tx("pith", "Mark"), at: [SX, SY], tag: [lx, Math.min(390, SY + R * 0.85)], info: tx("Ground tissue in the centre, left over from the young shoot.", "Grundgewebe in der Mitte, ein Rest aus der Jugend des Sprosses.") },
  );
  return parts;
}

/**
 * A woody stem with annual rings. `widths`: relative width of each year's ring (inner to outer).
 * `fit` scales the disc to the picture; otherwise it grows with `unit` px per ring width.
 * `firstYear` writes the year of each ring along a radius.
 */
export function PlantStemSection({
  mode = "names",
  show,
  ask,
  highlight,
  legend,
  widths,
  fit = true,
  unit = 12,
  firstYear,
}: DrawingProps & { widths: number[]; fit?: boolean; unit?: number; firstYear?: number }) {
  const g = ringGeometry(widths, fit ? { fit: 182 } : { unit });
  const n = widths.length;
  const marked = n >= 2 ? n - 2 : n === 1 ? 0 : null;
  const parts = stemParts(g, marked);
  const rings = g.radii.map((outer, i) => {
    const inner = i ? g.radii[i - 1] : g.pith;
    return { outer, late: outer - (outer - inner) * 0.3 };
  });
  const ringEls = (from: number, to: number) =>
    rings.slice(from, to).map((r, k) => (
      <g key={from + k}>
        <path d={wobble(r.outer)} fill={LATE} fillOpacity={0.78} />
        <path d={wobble(r.late)} fill={EARLY} />
      </g>
    ));
  const order = rings.map((_, i) => n - 1 - i);
  const ann = 25;
  return (
    <Figure title={tx("Cross-section of a woody stem", "Querschnitt durch einen verholzten Stamm")} width={480} height={400} parts={parts} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="bark">
        <path d={wobble(g.bark)} fill="var(--bio-wood-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} strokeOpacity={0.5} />
        <g stroke="var(--bio-outline)" strokeWidth={1.4} opacity={0.45}>
          {Array.from({ length: 28 }, (_, i) => {
            const t = (i / 28) * Math.PI * 2 + 0.05 * (i % 3);
            const r0 = g.bast + (g.bark - g.bast) * (0.25 + 0.2 * (i % 2));
            return <line key={i} x1={SX + Math.cos(t) * r0 * wk(t)} y1={SY + Math.sin(t) * r0 * wk(t)} x2={SX + Math.cos(t) * g.bark * wk(t)} y2={SY + Math.sin(t) * g.bark * wk(t)} />;
          })}
        </g>
      </g>
      <g data-part="bast">
        <path d={wobble(g.bast)} fill="color-mix(in oklab, var(--bio-mito) 75%, var(--bio-wood))" />
      </g>
      <g data-part="cambium">
        <path d={wobble(g.wood + 1.5)} fill="none" stroke="var(--bio-chloro)" strokeWidth={2.4} />
      </g>
      {/* rings, outermost first so inner ones paint over */}
      {marked !== null ? (
        <>
          <g data-part="wood">{ringEls(marked + 1, n).reverse()}</g>
          <g data-part="late">
            <path d={wobble(rings[marked].outer)} fill={LATE} fillOpacity={0.78} />
          </g>
          <g data-part="early">
            <path d={wobble(rings[marked].late)} fill={EARLY} />
          </g>
          <g data-part="wood">{ringEls(0, marked).reverse()}</g>
        </>
      ) : (
        <g data-part="wood">{order.map((i) => ringEls(i, i + 1))}</g>
      )}
      <g data-part="ray" stroke="var(--bio-wood-deep)" strokeWidth={1} opacity={0.5}>
        {Array.from({ length: 16 }, (_, i) => {
          const t = ((i * 22.5 + 0) * Math.PI) / 180;
          return <line key={i} x1={SX + Math.cos(t) * g.pith} y1={SY + Math.sin(t) * g.pith} x2={SX + Math.cos(t) * g.wood} y2={SY + Math.sin(t) * g.wood} />;
        })}
      </g>
      <g data-part="pith">
        <circle cx={SX} cy={SY} r={g.pith} fill={CELL} stroke="var(--bio-wood-deep)" strokeWidth={1} />
      </g>
      {firstYear !== undefined && (
        <g>
          <line x1={SX} y1={SY} x2={SX + Math.cos((-ann * Math.PI) / 180) * g.wood * wk((-ann * Math.PI) / 180)} y2={SY + Math.sin((-ann * Math.PI) / 180) * g.wood * wk((-ann * Math.PI) / 180)} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          {rings.map((r, i) => {
            const inner = i ? rings[i - 1].outer : g.pith;
            const mid = (inner + r.outer) / 2;
            const t = (-ann * Math.PI) / 180;
            const x = SX + Math.cos(t) * mid * wk(t);
            const y = SY + Math.sin(t) * mid * wk(t);
            return (
              <g key={i}>
                <rect x={x - 15} y={y - 8} width={30} height={15} rx={4} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={0.8} />
                <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize={9.5} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                  {firstYear + i}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </Figure>
  );
}

/** Words for the rings widget (exported so the lesson can reuse them). */
export const RING_WORDS: Record<"wet" | "dry", Text> = { wet: tx("good year", "gutes Jahr"), dry: tx("dry year", "trockenes Jahr") };
