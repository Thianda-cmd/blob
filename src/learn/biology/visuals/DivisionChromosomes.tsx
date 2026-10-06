"use client";

// How a chromosome is built: one-chromatid vs two-chromatid chromosome, chromatid, centromere,
// and a homologous pair with a gene locus at the same place on both.

import { tx } from "@/i18n/text";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { Chromatid, PARENT_FILL } from "./DivisionChromatid";

const PARTS: FigurePart[] = [
  {
    id: "one",
    label: tx("one-chromatid chromosome", "Ein-Chromatid-Chromosom"),
    at: [62, 64],
    tag: [26, 30],
    info: tx("A single chromatid, one DNA molecule. This is how chromosomes look in the G1 phase and after a division.", "Ein einziges Chromatid, also ein DNA-Molekül. So liegen Chromosomen in der G1-Phase und nach einer Teilung vor."),
  },
  {
    id: "two",
    label: tx("two-chromatid chromosome", "Zwei-Chromatid-Chromosom"),
    at: [168, 162],
    tag: [134, 200],
    info: tx("After replication in the S phase: two identical sister chromatids, joined at the centromere.", "Nach der Replikation in der S-Phase: zwei identische Schwesterchromatiden, am Zentromer verbunden."),
  },
  {
    id: "chromatid",
    label: tx("chromatid", "Chromatid"),
    at: [196, 62],
    tag: [232, 28],
    info: tx("One of the two identical halves of a two-chromatid chromosome. Each chromatid holds one DNA double helix.", "Eine der beiden identischen Hälften eines Zwei-Chromatid-Chromosoms. Jedes Chromatid enthält eine DNA-Doppelhelix."),
  },
  {
    id: "centromere",
    label: tx("centromere", "Zentromer"),
    at: [188, 102],
    tag: [244, 112],
    info: tx("The constriction that holds the sister chromatids together. The spindle fibres attach here.", "Die Einschnürung, die die Schwesterchromatiden zusammenhält. Hier setzen die Spindelfasern an."),
  },
  {
    id: "homologs",
    label: tx("homologous chromosomes", "homologe Chromosomen"),
    at: [362, 34],
    tag: [362, 14],
    info: tx("A pair: one from the mother (red), one from the father (blue). Same size, same centromere position, same genes.", "Ein Paar: eins von der Mutter (rot), eins vom Vater (blau). Gleiche Größe, gleiche Lage des Zentromers, gleiche Gene."),
  },
  {
    id: "locus",
    label: tx("gene locus", "Genort"),
    at: [404, 133],
    tag: [450, 160],
    info: tx("The same gene sits at the same place on both homologues. Its versions (alleles) can differ.", "Dasselbe Gen liegt auf beiden Homologen an derselben Stelle. Seine Varianten (Allele) können verschieden sein."),
  },
];

const S = 2;
const LEN = 40 * S;
const CF = 0.42;
const BANDS = [-0.55, 0.3, 0.62];

/** Chromatid of the big drawing, straight up and down, centromere at (x, y). */
function Arm({ x, y, fill, splay = 0 }: { x: number; y: number; fill: string; splay?: number }) {
  return <Chromatid x={x} y={y} pa={270 + splay} qa={90 - splay} len={LEN} cf={CF} cond={1} fill={fill} bands={BANDS} scale={S * 0.85} />;
}

export function DivisionChromosomes({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const red = PARENT_FILL[0];
  const blue = PARENT_FILL[1];
  const yC = 102;
  // q arm of the homologues: where the marked gene sits (share 0.62 of the q arm).
  const gap = 2.2 * S * 0.85;
  const locusY = yC + gap + (LEN * (1 - CF) - gap) * 0.62;
  return (
    <Figure title={tx("How a chromosome is built", "Bau eines Chromosoms")} width={480} height={220} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="one">
        <Arm x={62} y={yC} fill={red} />
      </g>
      <g data-part="two">
        <Arm x={182} y={yC} fill={red} splay={-5} />
        <Arm x={194} y={yC} fill={red} splay={5} />
      </g>
      {/* One chromatid outlined, on top of the two-chromatid chromosome. */}
      <g data-part="chromatid">
        <path d={`M194 ${yC - 2}L${194 + 3} ${yC - LEN * CF * 0.95} M194 ${yC + 2}L${194 + 4} ${yC + LEN * (1 - CF) * 0.95}`} stroke="var(--blob)" strokeOpacity={0.65} strokeWidth={14} strokeLinecap="round" fill="none" opacity={0.28} />
      </g>
      <g data-part="centromere">
        <circle cx={188} cy={yC} r={9} fill="none" stroke="var(--blob)" strokeWidth={2} strokeDasharray="3 2.5" />
      </g>
      <g data-part="homologs">
        <Arm x={342} y={yC} fill={red} splay={-4} />
        <Arm x={354} y={yC} fill={red} splay={4} />
        <Arm x={384} y={yC} fill={blue} splay={-4} />
        <Arm x={396} y={yC} fill={blue} splay={4} />
      </g>
      <g data-part="locus">
        <line x1={334} x2={404} y1={locusY} y2={locusY} stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="4 3" />
      </g>
    </Figure>
  );
}
