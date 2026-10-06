"use client";

import { AnimatePresence, motion } from "motion/react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";

const MX = 150;
const PX = 290;

/** A chromosome (one chromatid) with a centromere waist, centred at x. */
function rodPath(x: number, top = 30, bottom = 270, w = 22, waist = 118) {
  return `M ${x - w} ${top + w} A ${w} ${w} 0 0 1 ${x + w} ${top + w} V ${waist - 10} Q ${x + w - 8} ${waist} ${x + w} ${waist + 10} V ${bottom - w} A ${w} ${w} 0 0 1 ${x - w} ${bottom - w} V ${waist + 10} Q ${x - w + 8} ${waist} ${x - w} ${waist - 10} Z`;
}

function Band({ x, y, letter }: { x: number; y: number; letter: string }) {
  return (
    <g>
      <rect x={x - 22} y={y - 12} width={44} height={24} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.2} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central" fontSize={19} fontStyle="italic" fontWeight={600} fill="var(--ink)" style={{ fontFamily: "var(--font-math)" }}>
        {letter}
      </text>
    </g>
  );
}

function Stripes({ x }: { x: number }) {
  return (
    <g opacity={0.2}>
      {[96, 140, 212, 236].map((y) => (
        <rect key={y} x={x - 22} y={y} width={44} height={y === 140 ? 9 : 5} fill="var(--bio-outline)" />
      ))}
    </g>
  );
}

const PARTS: FigurePart[] = [
  { id: "mother", label: tx("chromosome from the mother", "Chromosom von der Mutter"), at: [MX, 246], tag: [62, 246], info: tx("One chromosome of each pair comes from the mother, through the egg cell.", "Ein Chromosom jedes Paares stammt von der Mutter, über die Eizelle.") },
  { id: "father", label: tx("chromosome from the father", "Chromosom vom Vater"), at: [PX, 246], tag: [378, 246], info: tx("The other one comes from the father, through the sperm cell. Both carry the same genes.", "Das andere stammt vom Vater, über die Spermienzelle. Beide tragen dieselben Gene.") },
  { id: "locus", label: tx("gene (locus) for flower colour", "Gen (Genort) für die Blütenfarbe"), at: [220, 66], tag: [220, 24], info: tx("A gene is a section of DNA for one trait. It sits at the same place on both chromosomes.", "Ein Gen ist ein DNA-Abschnitt für ein Merkmal. Es liegt auf beiden Chromosomen an derselben Stelle.") },
  { id: "alleleA", label: tx("allele A (dominant)", "Allel A (dominant)"), at: [MX - 17, 66], tag: [62, 66], info: tx("One variant of the gene: A for purple. A capital letter means dominant.", "Eine Variante des Gens: A für violett. Ein Großbuchstabe heißt dominant.") },
  { id: "allelea", label: tx("allele a (recessive)", "Allel a (rezessiv)"), at: [PX + 17, 66], tag: [378, 66], info: tx("The other variant: a for white. Small letter = recessive. With A and a the plant is heterozygous.", "Die andere Variante: a für weiß. Kleinbuchstabe = rezessiv. Mit A und a ist die Pflanze mischerbig.") },
  { id: "homo", label: tx("two equal alleles R (homozygous)", "zwei gleiche Allele R (reinerbig)"), at: [220, 176], tag: [220, 214], info: tx("For seed shape both chromosomes carry R: the plant is homozygous (pure-breeding), RR.", "Für die Samenform tragen beide Chromosomen R: Die Pflanze ist reinerbig (homozygot), RR.") },
];

/** A chromosome pair of a pea plant: one from the mother, one from the father, with two genes. */
export function GeneticsChromosomes({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("A pair of chromosomes with two genes", "Ein Chromosomenpaar mit zwei Genen")} width={440} height={290} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="mother">
        <path d={rodPath(MX)} fill="var(--bio-petal)" stroke="var(--bio-outline)" strokeWidth={2} />
        <Stripes x={MX} />
      </g>
      <g data-part="father">
        <path d={rodPath(PX)} fill="var(--bio-water)" stroke="var(--bio-outline)" strokeWidth={2} />
        <Stripes x={PX} />
      </g>
      <g data-part="locus">
        <line x1={MX + 22} y1={66} x2={PX - 22} y2={66} stroke="var(--ink-2)" strokeWidth={1.6} strokeDasharray="5 4" />
      </g>
      <g data-part="alleleA">
        <Band x={MX} y={66} letter="A" />
      </g>
      <g data-part="allelea">
        <Band x={PX} y={66} letter="a" />
      </g>
      <g data-part="homo">
        <line x1={MX + 22} y1={176} x2={PX - 22} y2={176} stroke="var(--ink-2)" strokeWidth={1.6} strokeDasharray="5 4" />
        <Band x={MX} y={176} letter="R" />
        <Band x={PX} y={176} letter="R" />
      </g>
    </Figure>
  );
}

/** Explore mode for the lesson. */
export function GeneticsChromosomesExplore() {
  return <GeneticsChromosomes mode="explore" />;
}

/** A small chromosome pair with the current alleles of two genes (for the allele lab). */
export function MiniPair({ a, b }: { a: [string, string]; b: [string, string] }) {
  const t = useText();
  const L = (x: number, y: number, letter: string, k: string) => (
    <g>
      <rect x={x - 15} y={y - 10} width={30} height={20} fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1} />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.text
          key={k + letter}
          x={x}
          y={y + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={15}
          fontStyle="italic"
          fontWeight={600}
          fill="var(--ink)"
          style={{ fontFamily: "var(--font-math)" }}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {letter}
        </motion.text>
      </AnimatePresence>
    </g>
  );
  return (
    <svg viewBox="0 0 130 190" className="h-auto w-[110px] shrink-0" role="img" aria-label={t(tx("Chromosome pair", "Chromosomenpaar"))}>
      <path d={rodPath(38, 8, 170, 15, 70)} fill="var(--bio-petal)" stroke="var(--bio-outline)" strokeWidth={1.6} />
      <path d={rodPath(92, 8, 170, 15, 70)} fill="var(--bio-water)" stroke="var(--bio-outline)" strokeWidth={1.6} />
      {L(38, 40, a[0], "a0")}
      {L(92, 40, a[1], "a1")}
      {L(38, 118, b[0], "b0")}
      {L(92, 118, b[1], "b1")}
      <text x={38} y={184} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        ♀
      </text>
      <text x={92} y={184} textAnchor="middle" fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        ♂
      </text>
    </svg>
  );
}
