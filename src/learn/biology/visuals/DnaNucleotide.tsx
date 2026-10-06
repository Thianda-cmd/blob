"use client";

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { HBONDS, PAIR } from "@/learn/biology/topics/dna/data";
import { BASE_COLOR } from "./DnaKit";

// Three base pairs of a DNA double strand, drawn as a ladder: both strands with phosphate,
// deoxyribose and base, the hydrogen bonds between the bases, and the antiparallel 5′/3′ ends.

const ROWS = [75, 180, 285];
const LEFT = "AGT";
/** Purines (two rings) are wider than pyrimidines (one ring): every pair has the same width. */
const WIDE: Record<string, number> = { A: 112, G: 112, T: 92, C: 92 };
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Pentagon of a deoxyribose around (cx, cy); flipped for the antiparallel strand. Order: O, C1′, C2′, C3′, C4′. */
function sugarPoints(cx: number, cy: number, flip: boolean): [number, number][] {
  const base: [number, number][] = [
    [0, -22],
    [20.9, -6.8],
    [12.9, 17.8],
    [-12.9, 17.8],
    [-20.9, -6.8],
  ];
  return base.map(([x, y]) => (flip ? [r1(cx - x), r1(cy - y)] : [r1(cx + x), r1(cy + y)]));
}

const PARTS: FigurePart[] = [
  { id: "phosphate", label: tx("phosphate group", "Phosphatrest"), at: [55, 132], tag: [18, 132], info: tx("Links the sugars of one strand: sugar, phosphate, sugar, phosphate…", "Verbindet die Zucker eines Strangs: Zucker, Phosphat, Zucker, Phosphat …") },
  { id: "sugar", label: tx("deoxyribose (sugar)", "Desoxyribose (Zucker)"), at: [100, 180], tag: [160, 132], info: tx("A sugar with five carbon atoms (1′ to 5′). The base sits on carbon 1′.", "Ein Zucker mit fünf C-Atomen (1′ bis 5′). Am C-Atom 1′ hängt die Base.") },
  { id: "base", label: tx("base (here adenine)", "Base (hier Adenin)"), at: [188, 75], tag: [188, 28], info: tx("A, G (two rings) or T, C (one ring). The order of the bases is the information.", "A, G (zwei Ringe) oder T, C (ein Ring). Die Reihenfolge der Basen ist die Information.") },
  { id: "hbond", label: tx("hydrogen bonds", "Wasserstoffbrücken"), at: [270, 180], tag: [270, 132], info: tx("Hold the pairs together: 2 between A and T, 3 between G and C.", "Halten die Paare zusammen: 2 zwischen A und T, 3 zwischen G und C.") },
  { id: "nucleotide", label: tx("nucleotide", "Nukleotid"), at: [32, 262], tag: [18, 300], info: tx("One building block: phosphate + deoxyribose + base.", "Ein Baustein: Phosphat + Desoxyribose + Base.") },
  { id: "backbone", label: tx("sugar-phosphate backbone", "Zucker-Phosphat-Rückgrat"), at: [452, 128], tag: [500, 128], info: tx("The outside of each strand. The bases point inwards.", "Die Außenseite jedes Strangs. Die Basen zeigen nach innen.") },
];

export function DnaNucleotide({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const label = (x: number, y: number, s: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );
  const small = (x: number, y: number, s: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );

  // Backbone lines: left strand 5′ (top) → 3′ (bottom), right strand 3′ (top) → 5′ (bottom).
  const leftLines: string[] = [];
  const rightLines: string[] = [];
  ROWS.forEach((y, i) => {
    const s = sugarPoints(100, y, false);
    leftLines.push(`M55 ${y - 48} L${s[4][0]} ${s[4][1]}`);
    leftLines.push(i < 2 ? `M${s[3][0]} ${s[3][1]} L55 ${ROWS[i + 1] - 48}` : `M${s[3][0]} ${s[3][1]} L72 ${y + 44}`);
    const r = sugarPoints(420, y, true);
    rightLines.push(`M${r[4][0]} ${r[4][1]} L465 ${y + 48}`);
    rightLines.push(i > 0 ? `M${r[3][0]} ${r[3][1]} L465 ${ROWS[i - 1] + 48}` : `M${r[3][0]} ${r[3][1]} L448 ${y - 44}`);
  });

  return (
    <Figure title={tx("Two antiparallel strands built from nucleotides", "Zwei antiparallele Stränge aus Nukleotiden")} width={520} height={360} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* one nucleotide framed */}
      <g data-part="nucleotide">
        <rect x={32} y={222} width={100 + WIDE[LEFT[2]] + 8} height={88} rx={14} fill="none" stroke="var(--blob)" strokeWidth={2} strokeDasharray="6 5" />
      </g>
      {/* backbones */}
      <g data-part="backbone-left">
        {leftLines.map((d) => (
          <path key={d} d={d} stroke="var(--bio-outline)" strokeWidth={3} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="backbone">
        {rightLines.map((d) => (
          <path key={d} d={d} stroke="var(--bio-outline)" strokeWidth={3} strokeLinecap="round" />
        ))}
        {ROWS.map((y) => (
          <polygon key={`rs${y}`} points={sugarPoints(420, y, true).map((p) => p.join(",")).join(" ")} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={2} />
        ))}
        {ROWS.map((y) => (
          <circle key={`rp${y}`} cx={465} cy={y + 48} r={11} fill="var(--bio-membrane)" stroke="var(--bio-outline)" strokeWidth={2} />
        ))}
      </g>
      {/* left strand: phosphates and sugars */}
      <g data-part="phosphate">
        {ROWS.map((y) => (
          <circle key={`lp${y}`} cx={55} cy={y - 48} r={11} fill="var(--bio-membrane)" stroke="var(--bio-outline)" strokeWidth={2} />
        ))}
      </g>
      <g data-part="sugar">
        {ROWS.map((y) => (
          <polygon key={`ls${y}`} points={sugarPoints(100, y, false).map((p) => p.join(",")).join(" ")} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={2} />
        ))}
      </g>
      {/* carbon numbers of the first sugar */}
      {small(100, 59, "O")}
      {small(128, 58, "1′")}
      {small(122, 104, "2′")}
      {small(95, 106, "3′")}
      {small(66, 70, "4′")}
      {small(82, 40, "5′")}
      {/* bases and hydrogen bonds */}
      {ROWS.map((y, i) => {
        const b = LEFT[i];
        const p = PAIR[b];
        const wl = WIDE[b];
        const wr = WIDE[p];
        const x1 = 132 + wl;
        const x2 = 388 - wr;
        const n = HBONDS[b];
        const ys = n === 2 ? [y - 6, y + 6] : [y - 9, y, y + 9];
        const sl = sugarPoints(100, y, false)[1];
        const sr = sugarPoints(420, y, true)[1];
        const leftBase = (
          <g>
            <line x1={sl[0]} y1={sl[1]} x2={132} y2={y} stroke="var(--bio-outline)" strokeWidth={2.5} />
            <rect x={132} y={y - 15} width={wl} height={30} rx={8} fill={BASE_COLOR[b]} stroke="var(--bio-outline)" strokeWidth={1.8} />
            {label(132 + wl / 2, y, b)}
          </g>
        );
        return (
          <g key={y}>
            {i === 0 ? <g data-part="base">{leftBase}</g> : leftBase}
            <line x1={sr[0]} y1={sr[1]} x2={388} y2={y} stroke="var(--bio-outline)" strokeWidth={2.5} />
            <rect x={x2} y={y - 15} width={wr} height={30} rx={8} fill={BASE_COLOR[p]} stroke="var(--bio-outline)" strokeWidth={1.8} />
            {label(x2 + wr / 2, y, p)}
            <g data-part={i === 1 ? "hbond" : undefined}>
              {ys.map((yy) => (
                <line key={yy} x1={x1 + 5} y1={yy} x2={x2 - 5} y2={yy} stroke="var(--ink-2)" strokeWidth={2.2} strokeDasharray="4 4" strokeLinecap="round" />
              ))}
            </g>
          </g>
        );
      })}
      {/* ends */}
      {label(24, 26, "5′")}
      {label(64, 342, "3′")}
      {label(462, 24, "3′")}
      {label(498, 340, "5′")}
    </Figure>
  );
}
