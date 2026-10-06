"use client";

// Labelled enzyme drawings for lessons and tasks:
// - EnzymeProcess: the three stages of an enzyme reaction (enzyme + substrate, enzyme-substrate
//   complex, enzyme + products), with markers for the parts.
// - EnzymeFit: an enzyme and three candidate substrates ("which one fits?").
// - EnzymeInhibition: an enzyme with a competitive or an allosteric inhibitor bound.

import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { ALLO_PATH, bodyShape, C, EnzymeBody, inhibitorPath, pocketPath, StageArrow, substrateHalves, SubstrateShape, type Tooth } from "./EnzymeShapes";

// ---------------------------------------------------------------------------
// The three stages

const S = 0.62;
const X = [112, 320, 528];
const Y = 168;

const PROCESS_PARTS: FigurePart[] = [
  {
    id: "substrate",
    label: tx("substrate", "Substrat"),
    at: [107, 122],
    tag: [60, 52],
    info: tx("The substance the enzyme works on. Here it will be split into two parts.", "Der Stoff, den das Enzym umsetzt. Hier wird er in zwei Teile gespalten."),
  },
  {
    id: "enzyme",
    label: tx("enzyme", "Enzym"),
    at: [55, 200],
    tag: [24, 254],
    info: tx("A protein that speeds up the reaction. It comes out of the reaction unchanged.", "Ein Protein, das die Reaktion beschleunigt. Es geht unverändert aus der Reaktion hervor."),
  },
  {
    id: "active",
    label: tx("active site", "aktives Zentrum"),
    at: [112, 180],
    tag: [214, 104],
    info: tx("The pocket where the substrate fits exactly, like a key in a lock. Here the reaction happens.", "Die Tasche, in die das Substrat genau passt wie ein Schlüssel ins Schloss. Hier läuft die Reaktion ab."),
  },
  {
    id: "complex",
    label: tx("enzyme-substrate complex", "Enzym-Substrat-Komplex"),
    at: [320, 166],
    tag: [320, 64],
    info: tx("For a short moment the substrate is bound in the active site. Now the bond can break.", "Für einen kurzen Moment ist das Substrat im aktiven Zentrum gebunden. Jetzt kann die Bindung brechen."),
  },
  {
    id: "products",
    label: tx("products", "Produkte"),
    at: [486, 124],
    tag: [604, 52],
    info: tx("What comes out of the reaction. They leave the active site, and the enzyme is free for the next substrate.", "Das, was bei der Reaktion entsteht. Sie lösen sich vom aktiven Zentrum, und das Enzym ist frei für das nächste Substrat."),
  },
];

export function EnzymeProcess({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const h = substrateHalves();
  return (
    <Figure
      title={tx("How an enzyme works: enzyme and substrate, enzyme-substrate complex, enzyme and products", "So arbeitet ein Enzym: Enzym und Substrat, Enzym-Substrat-Komplex, Enzym und Produkte")}
      width={640}
      height={272}
      parts={PROCESS_PARTS}
      mode={mode}
      show={show}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      {/* stage 1: enzyme and substrate */}
      <g transform={`translate(${X[0]} ${Y}) scale(${S})`}>
        <EnzymeBody part="enzyme" />
        <g data-part="active">
          <path d={pocketPath(bodyShape("fit"))} fill={C.pocket} />
        </g>
        <g data-part="substrate" transform="translate(-8 -76) rotate(-8)">
          <SubstrateShape />
        </g>
      </g>
      <StageArrow x1={206} x2={232} y={186} />
      {/* stage 2: enzyme-substrate complex */}
      <g data-part="complex" transform={`translate(${X[1]} ${Y}) scale(${S})`}>
        <EnzymeBody />
        <SubstrateShape />
      </g>
      <StageArrow x1={414} x2={440} y={186} />
      {/* stage 3: enzyme and products */}
      <g transform={`translate(${X[2]} ${Y}) scale(${S})`}>
        <EnzymeBody part="enzyme" />
        <g data-part="products">
          <path d={h.left} fill={C.sub} stroke={C.subLine} strokeWidth={2.2} strokeLinejoin="round" transform="translate(-68 -72) rotate(-24)" />
          <path d={h.right} fill={C.sub} stroke={C.subLine} strokeWidth={2.2} strokeLinejoin="round" transform="translate(68 -72) rotate(24)" />
        </g>
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Which substrate fits?

export function EnzymeFit({ pocket, options }: { pocket: [Tooth, Tooth]; options: [Tooth, Tooth][] }) {
  const t = useText();
  const xs = options.length === 3 ? [92, 240, 388] : [140, 340];
  return (
    <svg viewBox="0 0 480 300" className="mx-auto block h-auto w-full" style={{ maxWidth: 520 }} role="img" aria-label={t(tx("An enzyme and three substrates, numbered 1 to 3", "Ein Enzym und drei Substrate, nummeriert von 1 bis 3"))}>
      {options.map((o, i) => (
        <g key={i}>
          <g transform={`translate(${xs[i]} 66) scale(0.72)`}>
            <SubstrateShape teeth={o} />
          </g>
          <circle cx={xs[i]} cy={124} r={12} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.6} />
          <text x={xs[i]} y={124} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
            {i + 1}
          </text>
        </g>
      ))}
      <g transform="translate(240 200) scale(0.8)">
        <EnzymeBody teeth={pocket} />
        <path d={pocketPath(bodyShape("fit", pocket[0], pocket[1]))} fill={C.pocket} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Inhibitors

const INHIB_PARTS: FigurePart[] = [
  { id: "enzyme", label: tx("enzyme", "Enzym"), at: [148, 200], tag: [70, 252], info: tx("The protein that catalyses the reaction.", "Das Protein, das die Reaktion katalysiert.") },
  {
    id: "active",
    label: tx("active site", "aktives Zentrum"),
    at: [228, 172],
    tag: [400, 92],
    info: tx("Where the substrate binds and reacts.", "Hier bindet das Substrat und wird umgesetzt."),
  },
  {
    id: "allosteric",
    label: tx("allosteric site", "allosterisches Zentrum"),
    at: [316, 246],
    tag: [420, 268],
    info: tx("A second binding site. A molecule bound here changes the shape of the whole enzyme.", "Eine zweite Bindungsstelle. Ein Molekül, das hier bindet, verändert die Form des ganzen Enzyms."),
  },
  { id: "substrate", label: tx("substrate", "Substrat"), at: [104, 62], tag: [40, 30], info: tx("The molecule the enzyme should convert.", "Das Molekül, das das Enzym umsetzen soll.") },
  {
    id: "inhibitor",
    label: tx("inhibitor", "Hemmstoff"),
    at: [250, 132],
    tag: [470, 150],
    info: tx("A molecule that lowers the enzyme's activity.", "Ein Molekül, das die Aktivität des Enzyms senkt."),
  },
];

export type InhibitionKind = "competitive" | "allosteric" | "none";

export function EnzymeInhibition({ kind = "competitive", mode = "names", show, ask, highlight, legend }: DrawingProps & { kind?: InhibitionKind }) {
  const sh = bodyShape(kind === "allosteric" ? "distorted" : "fit");
  const parts = INHIB_PARTS.map((p) =>
    p.id === "inhibitor" && kind === "allosteric" ? { ...p, at: [316, 254] as [number, number], tag: [470, 214] as [number, number] } : p.id === "substrate" && kind === "allosteric" ? { ...p, at: [236, 70] as [number, number], tag: [130, 40] as [number, number] } : p,
  );
  const visible = show ?? parts.filter((p) => (kind === "none" ? p.id !== "inhibitor" : true)).map((p) => p.id);
  return (
    <Figure
      title={
        kind === "competitive"
          ? tx("Enzyme with an inhibitor in the active site", "Enzym mit einem Hemmstoff im aktiven Zentrum")
          : kind === "allosteric"
            ? tx("Enzyme with an inhibitor at the allosteric site", "Enzym mit einem Hemmstoff am allosterischen Zentrum")
            : tx("Enzyme with substrate", "Enzym mit Substrat")
      }
      width={500}
      height={290}
      parts={parts}
      mode={mode}
      show={visible}
      ask={ask}
      highlight={highlight}
      legend={legend}
    >
      <g transform="translate(250 148) scale(0.9)">
        <EnzymeBody part="enzyme" variant={kind === "allosteric" ? "distorted" : "fit"} allo />
        <g data-part="active">
          <path d={pocketPath(sh)} fill={C.pocket} />
        </g>
        <g data-part="allosteric">
          <path d="M 90 94 L 56 94 L 52 118 L 94 112 Z" fill={C.pocket} />
        </g>
        {kind === "competitive" && (
          <g data-part="inhibitor">
            <path d={inhibitorPath()} fill={C.comp} stroke={C.compLine} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        )}
        {kind === "allosteric" && (
          <g data-part="inhibitor">
            <path d={ALLO_PATH} fill={C.allo} stroke={C.alloLine} strokeWidth={2.2} strokeLinejoin="round" />
          </g>
        )}
        <g data-part="substrate" transform={kind === "competitive" ? "translate(-160 -96) rotate(-10)" : kind === "allosteric" ? "translate(-14 -86) rotate(-6)" : undefined}>
          <SubstrateShape />
        </g>
      </g>
    </Figure>
  );
}
