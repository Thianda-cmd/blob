"use client";

// Bacterium and virus as labelled textbook drawings (Figure kit), and a widget that compares
// the two side by side: is it a cell, genetic material, metabolism, reproduction, size and
// whether antibiotics work. With `explore` the widget also lets students tap through the parts.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";

const f = (v: number) => Math.round(v * 100) / 100;

// ---------------------------------------------------------------------------
// Bacterium (rod-shaped, Stäbchenbakterium)

export const BACTERIUM_PARTS: FigurePart[] = [
  { id: "capsule", label: tx("capsule (slime layer)", "Kapsel (Schleimhülle)"), at: [60, 150], tag: [24, 188], info: tx("Slimy outer layer: protects against drying out and makes it harder for phagocytes to grab the bacterium.", "Schleimige Außenschicht: schützt vor Austrocknung und erschwert es Fresszellen, das Bakterium zu packen.") },
  { id: "wall", label: tx("cell wall", "Zellwand"), at: [150, 67], tag: [150, 26], info: tx("Firm shell that gives shape and support. Many antibiotics (e.g. penicillin) attack it.", "Feste Hülle, gibt Form und Halt. Viele Antibiotika (z. B. Penicillin) greifen sie an.") },
  { id: "membrane", label: tx("cell membrane", "Zellmembran"), at: [262, 76], tag: [262, 26], info: tx("Encloses the cell and controls what goes in and out.", "Grenzt die Zelle ab und kontrolliert, was hinein- und hinausgelangt.") },
  { id: "cytoplasm", label: tx("cytoplasm", "Cytoplasma (Zellplasma)"), at: [118, 112], info: tx("Cell fluid in which the metabolism takes place.", "Zellflüssigkeit, in der der Stoffwechsel abläuft.") },
  { id: "chromosome", label: tx("bacterial chromosome (ring-shaped DNA)", "Bakterienchromosom (ringförmige DNA)"), at: [205, 128], info: tx("A DNA ring lying free in the cytoplasm. Bacteria have no nucleus.", "DNA-Ring, der frei im Cytoplasma liegt. Bakterien haben keinen Zellkern.") },
  { id: "plasmid", label: tx("plasmid", "Plasmid"), at: [306, 98], tag: [352, 26], info: tx("Small extra DNA ring, e.g. with genes for antibiotic resistance.", "Kleiner zusätzlicher DNA-Ring, z. B. mit Genen für Antibiotikaresistenz.") },
  { id: "ribosomes", label: tx("ribosomes", "Ribosomen"), at: [292, 160], tag: [300, 226], info: tx("Make proteins. They are smaller than the ribosomes in our cells.", "Stellen Proteine her. Sie sind kleiner als die Ribosomen unserer Zellen.") },
  { id: "pili", label: tx("pili (fimbriae)", "Pili (Fimbrien)"), at: [176, 196], tag: [176, 228], info: tx("Fine hairs for sticking to cells and surfaces.", "Feine Härchen, mit denen das Bakterium an Zellen und Oberflächen haftet.") },
  { id: "flagellum", label: tx("flagellum", "Geißel (Flagelle)"), at: [432, 112], tag: [452, 168], info: tx("Turns like a propeller: the bacterium can swim.", "Dreht sich wie ein Propeller: Das Bakterium kann schwimmen.") },
];

const RIBOSOMES: [number, number][] = [
  [100, 140], [112, 92], [140, 160], [158, 100], [176, 160], [182, 90], [248, 92], [256, 162], [272, 140], [286, 112], [292, 160], [320, 148], [336, 120], [342, 96], [132, 128], [96, 112], [230, 164], [322, 168],
];

function BacteriumDrawing() {
  const pili = [
    [96, 70, 84, 46],
    [126, 64, 120, 40],
    [300, 64, 306, 40],
    [336, 70, 350, 48],
    [120, 186, 112, 212],
    [176, 188, 176, 214],
    [246, 188, 252, 214],
    [320, 186, 332, 210],
  ];
  return (
    <>
      <g data-part="flagellum">
        <path d="M 372 125 c 14 -14 24 6 36 -6 s 22 -16 34 -4 s 22 10 34 -6" fill="none" stroke="var(--bio-wall-deep)" strokeWidth={3} strokeLinecap="round" />
      </g>
      <g data-part="pili">
        {pili.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--bio-wall-deep)" strokeWidth={1.6} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="capsule">
        <rect x={50} y={52} width={330} height={146} rx={73} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.4} strokeDasharray="5 4" />
      </g>
      <g data-part="wall">
        <rect x={62} y={64} width={306} height={122} rx={61} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={2.2} />
      </g>
      <g data-part="cytoplasm">
        <rect x={73} y={75} width={284} height={100} rx={50} fill="var(--bio-cell)" />
      </g>
      <g data-part="membrane">
        <rect x={71} y={73} width={288} height={104} rx={52} fill="none" stroke="var(--bio-membrane)" strokeWidth={3.2} />
      </g>
      <g data-part="chromosome">
        <path
          d="M 160 124 c 6 -22 34 -26 44 -12 c 8 -18 40 -14 40 6 c 16 4 14 30 -6 30 c -4 14 -32 16 -40 2 c -12 12 -40 6 -38 -10 c -10 -4 -8 -18 0 -16 Z"
          fill="none"
          stroke="var(--bio-nucleus-deep)"
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
        <path d="M 178 126 c 10 -10 22 4 32 -4 s 18 6 22 0" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} strokeLinecap="round" />
      </g>
      <g data-part="plasmid">
        <circle cx={306} cy={106} r={8} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
        <circle cx={118} cy={152} r={6} fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={2} />
      </g>
      <g data-part="ribosomes">
        {RIBOSOMES.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.8} fill="var(--bio-mito-deep)" />
        ))}
      </g>
    </>
  );
}

/** A rod-shaped bacterium with capsule, cell wall, membrane, DNA ring, plasmids, ribosomes, pili and flagellum. */
export function ImmuneBacterium({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Bacterium (rod-shaped)", "Bakterium (Stäbchen)")} width={500} height={250} parts={BACTERIUM_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <BacteriumDrawing />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Virus (enveloped, like the flu virus)

export const VIRUS_PARTS: FigurePart[] = [
  { id: "spikes", label: tx("surface proteins (spikes)", "Oberflächenproteine (Spikes)"), at: [289, 70], tag: [352, 36], info: tx("Fit receptors on the host cell like a key. The immune system recognises them as antigens.", "Passen wie ein Schlüssel zu Rezeptoren der Wirtszelle. Das Immunsystem erkennt sie als Antigene.") },
  { id: "envelope", label: tx("envelope (lipid membrane)", "Hülle (Lipidmembran)"), at: [126, 205], tag: [52, 262], info: tx("Taken from the host cell's membrane when the virus leaves it. Not every virus has one.", "Stammt aus der Membran der Wirtszelle, die das Virus beim Verlassen mitnimmt. Nicht jedes Virus hat sie.") },
  { id: "capsid", label: tx("capsid (protein coat)", "Kapsid (Proteinhülle)"), at: [250, 112], info: tx("Coat made of protein subunits. It protects the genetic material.", "Hülle aus Proteinbausteinen. Sie schützt die Erbinformation.") },
  { id: "genome", label: tx("genetic material (RNA or DNA)", "Erbinformation (RNA oder DNA)"), at: [210, 150], info: tx("The blueprint for new viruses. A virus has no metabolism and no ribosomes of its own.", "Der Bauplan für neue Viren. Ein Virus hat keinen eigenen Stoffwechsel und keine Ribosomen.") },
];

const VC: [number, number] = [210, 150];
const SPIKES = Array.from({ length: 14 }, (_, i) => i * (360 / 14) + 6);

function VirusDrawing() {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 90) * Math.PI) / 180;
    return [f(VC[0] + 60 * Math.cos(a)), f(VC[1] + 60 * Math.sin(a))];
  });
  return (
    <>
      <g data-part="spikes">
        {SPIKES.map((t, i) => (
          <g key={i} transform={`translate(${VC[0]} ${VC[1]}) rotate(${f(t)})`}>
            <line x1={98} y1={0} x2={116} y2={0} stroke="var(--bio-petal-deep)" strokeWidth={3.2} strokeLinecap="round" />
            {i % 2 ? <circle cx={120} cy={0} r={6} fill="var(--bio-petal-deep)" /> : <path d="M 114 -7 L 126 -5 L 126 5 L 114 7 Z" fill="var(--bio-petal-deep)" />}
          </g>
        ))}
      </g>
      <g data-part="envelope">
        <circle cx={VC[0]} cy={VC[1]} r={101} fill="var(--bio-membrane)" fillOpacity={0.3} stroke="var(--bio-membrane)" strokeWidth={2.6} />
        <circle cx={VC[0]} cy={VC[1]} r={91} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2.6} />
      </g>
      <g data-part="capsid">
        <path d={`M ${hex.map((p) => p.join(" ")).join(" L ")} Z`} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={2.6} strokeLinejoin="round" />
        {hex.map(([x, y], i) => (
          <line key={i} x1={VC[0]} y1={VC[1]} x2={x} y2={y} stroke="var(--bio-petal-deep)" strokeWidth={1} opacity={0.45} />
        ))}
        {hex.map(([x, y], i) => {
          const [nx, ny] = hex[(i + 1) % 6];
          return [0.25, 0.5, 0.75].map((k) => <circle key={`${i}-${k}`} cx={f(x + (nx - x) * k)} cy={f(y + (ny - y) * k)} r={3.2} fill="var(--bio-petal-deep)" opacity={0.7} />);
        })}
      </g>
      <g data-part="genome">
        <path
          d="M 176 136 c 8 -16 22 -2 30 -14 s 22 -2 22 12 s -18 10 -10 22 s 22 4 18 18 s -26 6 -34 -4 s -18 4 -24 -8 s 10 -16 -2 -26"
          fill="none"
          stroke="var(--bio-u)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}

/** An enveloped virus in section: spikes, lipid envelope, capsid and genetic material. */
export function ImmuneVirus({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Virus (with envelope)", "Virus (behülltes Virus)")} width={420} height={300} parts={VIRUS_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <VirusDrawing />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// The comparison widget

type Feature = { id: string; name: Text; bact: Text; virus: Text; hb: string[]; hv: string[]; detail?: boolean };

const FEATURES: Feature[] = [
  {
    id: "cell",
    name: tx("A cell?", "Eine Zelle?"),
    bact: tx("**Yes.** A living single cell with cell wall, cell membrane and cytoplasm.", "**Ja.** Ein lebender Einzeller mit Zellwand, Zellmembran und Cytoplasma."),
    virus: tx("**No.** Just genetic material in a protein coat, sometimes with an envelope.", "**Nein.** Nur Erbinformation in einer Proteinhülle, manchmal mit Hülle."),
    hb: ["wall", "membrane", "cytoplasm"],
    hv: ["capsid", "envelope"],
  },
  {
    id: "dna",
    name: tx("Genetic material", "Erbinformation"),
    bact: tx("DNA: a ring-shaped bacterial chromosome plus plasmids, free in the cytoplasm. **No nucleus.**", "DNA: ein ringförmiges Bakterienchromosom und Plasmide, frei im Cytoplasma. **Kein Zellkern.**"),
    virus: tx("DNA **or** RNA, packed inside the capsid.", "DNA **oder** RNA, im Kapsid verpackt."),
    hb: ["chromosome", "plasmid"],
    hv: ["genome"],
  },
  {
    id: "life",
    name: tx("Metabolism", "Stoffwechsel"),
    bact: tx("**Own metabolism:** takes in nutrients, gains energy, makes proteins on its own ribosomes.", "**Eigener Stoffwechsel:** nimmt Nährstoffe auf, gewinnt Energie, baut Proteine an eigenen Ribosomen."),
    virus: tx("**None.** No ribosomes, no energy supply. Outside a cell a virus is just a particle.", "**Keiner.** Keine Ribosomen, keine Energiegewinnung. Außerhalb einer Zelle ist ein Virus nur ein Teilchen."),
    hb: ["ribosomes", "cytoplasm"],
    hv: [],
  },
  {
    id: "repro",
    name: tx("Reproduction", "Vermehrung"),
    bact: tx("By **dividing in two**, in good conditions about every 20 minutes.", "Durch **Zweiteilung**, unter guten Bedingungen etwa alle 20 Minuten."),
    virus: tx("**Only inside a host cell:** the cell is forced to build new viruses.", "**Nur in einer Wirtszelle:** Die Zelle wird gezwungen, neue Viren herzustellen."),
    hb: ["chromosome"],
    hv: ["genome", "spikes"],
  },
  {
    id: "size",
    name: tx("Size", "Größe"),
    bact: tx("About **1 to 10 µm**: visible in a light microscope.", "Etwa **1 bis 10 µm**: im Lichtmikroskop sichtbar."),
    virus: tx("About **20 to 300 nm**: only visible in an electron microscope.", "Etwa **20 bis 300 nm**: nur im Elektronenmikroskop sichtbar."),
    hb: [],
    hv: [],
  },
  {
    id: "drug",
    name: tx("Antibiotics?", "Antibiotika?"),
    bact: tx("**Work.** They attack e.g. the cell wall or the ribosomes.", "**Wirken.** Sie greifen z. B. die Zellwand oder die Ribosomen an."),
    virus: tx("**Don't work.** There is no cell wall and no ribosome to attack.", "**Wirken nicht.** Es gibt keine Zellwand und keine Ribosomen zum Angreifen."),
    hb: ["wall", "ribosomes"],
    hv: [],
  },
];

/** True sizes: a 2 µm bacterium next to a 100 nm virus (and the virus drawn big for comparison). */
function SizeScale() {
  const t = useText();
  // 1 µm = 150 px
  return (
    <svg viewBox="0 0 560 190" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Size comparison", "Größenvergleich"))}>
      <g transform="translate(60 70)">
        <rect x={0} y={-36} width={300} height={72} rx={36} fill="var(--bio-wall)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
        <rect x={8} y={-28} width={284} height={56} rx={28} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
        <path d="M 110 0 c 10 -16 30 -14 40 -4 c 12 -12 34 -8 30 8 c -6 14 -28 12 -36 4 c -12 10 -36 8 -34 -8 Z" fill="none" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} />
      </g>
      <motion.g initial={{ scale: 8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 70, damping: 16, delay: 0.2 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
        <circle cx={430} cy={70} r={7.5} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} />
      </motion.g>
      <circle cx={430} cy={70} r={22} fill="none" stroke="var(--blob)" strokeWidth={1.4} strokeDasharray="3 3" />
      <g fontSize={13} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        <text x={210} y={130} textAnchor="middle">
          {t(tx("bacterium, 2 µm long", "Bakterium, 2 µm lang"))}
        </text>
        <text x={430} y={110} textAnchor="middle">
          {t(tx("virus, 100 nm", "Virus, 100 nm"))}
        </text>
      </g>
      <g transform="translate(60 160)">
        <line x1={0} y1={0} x2={150} y2={0} stroke="var(--ink)" strokeWidth={2.4} />
        <line x1={0} y1={-6} x2={0} y2={6} stroke="var(--ink)" strokeWidth={2} />
        <line x1={150} y1={-6} x2={150} y2={6} stroke="var(--ink)" strokeWidth={2} />
        <text x={75} y={22} textAnchor="middle" fontSize={13} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
          1 µm = 1000 nm
        </text>
      </g>
    </svg>
  );
}

/**
 * Bacterium and virus side by side. Tap a feature to compare. With `explore`, two more tabs
 * let students tap through the parts of each drawing.
 */
export function ImmuneCompare({ explore = false }: { explore?: boolean }) {
  const t = useText();
  const [tab, setTab] = useState<"compare" | "bact" | "virus">("compare");
  const [fid, setFid] = useState("cell");
  const feat = FEATURES.find((x) => x.id === fid)!;
  const tabs = [
    { id: "compare" as const, name: tx("Compare", "Vergleich") },
    { id: "bact" as const, name: tx("Bacterium", "Bakterium") },
    { id: "virus" as const, name: tx("Virus", "Virus") },
  ];

  return (
    <div className="space-y-4">
      {explore && (
        <div className="flex w-fit rounded-lg border border-line p-0.5">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTab(x.id)}
              className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", tab === x.id ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {tab === x.id && <motion.span layoutId="immune-compare-tab" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(x.name)}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "bact" && <ImmuneBacterium mode="explore" />}
      {tab === "virus" && <ImmuneVirus mode="explore" />}

      {tab === "compare" && (
        <>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {FEATURES.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={fid === x.id}
                onClick={() => setFid(x.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                  fid === x.id ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
                )}
              >
                {t(x.name)}
              </button>
            ))}
          </div>

          {fid === "size" ? (
            <div className="rounded-xl border border-line bg-surface p-3">
              <SizeScale />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(["bact", "virus"] as const).map((k) => (
                <div key={k} className="min-w-0 rounded-xl border border-line bg-surface p-2.5">
                  <div className="mb-1 px-1 text-[12.5px] font-semibold uppercase tracking-wide text-ink-3">{k === "bact" ? t(tx("Bacterium", "Bakterium")) : t(tx("Virus", "Virus"))}</div>
                  <div className="mx-auto max-w-[300px]">{k === "bact" ? <ImmuneBacterium mode="plain" highlight={feat.hb} /> : <ImmuneVirus mode="plain" highlight={feat.hv} />}</div>
                </div>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={fid} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-2 sm:grid-cols-2">
              <Statement who={tx("Bacterium", "Bakterium")} text={feat.bact} />
              <Statement who={tx("Virus", "Virus")} text={feat.virus} />
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

function Statement({ who, text }: { who: Text; text: Text }) {
  const t = useText();
  const parts = t(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-snug text-ink-2">
      <span className="font-semibold text-ink">{t(who)}: </span>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </p>
  );
}
