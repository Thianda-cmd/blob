"use client";

import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { StepButton, StepDots } from "./DnaKit";

// The replication fork step by step: helicase, primase, DNA polymerase III, polymerase I and ligase.
// Top template: 3′ (left) … 5′ (right) → its new strand grows towards the fork: leading strand.
// Bottom template: 5′ (left) … 3′ (right) → its new strand grows away from the fork: lagging strand.

const OLD = "var(--bio-nucleus-deep)";
const NEW = "var(--bio-water)";
const RNA = "var(--bio-a)";
const T_TOP = 70;
const N_TOP = 92;
const T_BOT = 234;
const N_BOT = 212;
const D_TOP = 140;
const D_BOT = 164;

type Seg = { id: string; x0: number; x1: number; y: number; kind: "dna" | "rna" };
type Enzyme = { id: "helicase" | "primase" | "pol3" | "pol1" | "ligase"; x: number; y: number };
type Step = { fork: number; segs: Seg[]; enzymes: Enzyme[]; title: Text; note: Text; nick?: boolean; sealed?: boolean; fragments: number };

const STEPS: Step[] = [
  {
    fork: 70,
    segs: [],
    enzymes: [],
    fragments: 0,
    title: tx("Origin of replication", "Startpunkt (Origin)"),
    note: tx(
      "Replication starts at an origin. The two strands are antiparallel: top 3′→5′, bottom 5′→3′ (from left to right).",
      "Die Replikation beginnt an einem Startpunkt (Origin). Die beiden Stränge sind antiparallel: oben 3′→5′, unten 5′→3′ (von links nach rechts).",
    ),
  },
  {
    fork: 300,
    segs: [],
    enzymes: [{ id: "helicase", x: 306, y: 152 }],
    fragments: 0,
    title: tx("Helicase opens the helix", "Die Helikase entwindet"),
    note: tx(
      "Helicase breaks the hydrogen bonds and separates the strands: the replication fork. (Topoisomerase ahead of it relieves the twisting.)",
      "Die Helikase löst die Wasserstoffbrücken und trennt die Stränge: die Replikationsgabel. (Davor entspannt die Topoisomerase die Verdrillung.)",
    ),
  },
  {
    fork: 300,
    segs: [
      { id: "lp", x0: 24, x1: 54, y: N_TOP, kind: "rna" },
      { id: "p1", x0: 210, x1: 240, y: N_BOT, kind: "rna" },
    ],
    enzymes: [
      { id: "helicase", x: 306, y: 152 },
      { id: "primase", x: 225, y: N_BOT + 20 },
    ],
    fragments: 0,
    title: tx("Primase lays RNA primers", "Die Primase setzt RNA-Primer"),
    note: tx(
      "DNA polymerase can't start from nothing: it needs a free 3′-OH end. Primase builds short RNA primers as starting points.",
      "Die DNA-Polymerase kann nicht aus dem Nichts anfangen: Sie braucht ein freies 3′-OH-Ende. Die Primase baut kurze RNA-Primer als Startpunkte.",
    ),
  },
  {
    fork: 300,
    segs: [
      { id: "lp", x0: 24, x1: 54, y: N_TOP, kind: "rna" },
      { id: "lead", x0: 54, x1: 240, y: N_TOP, kind: "dna" },
      { id: "p1", x0: 210, x1: 240, y: N_BOT, kind: "rna" },
      { id: "f1", x0: 24, x1: 210, y: N_BOT, kind: "dna" },
    ],
    enzymes: [
      { id: "helicase", x: 306, y: 152 },
      { id: "pol3", x: 246, y: N_TOP },
      { id: "pol3", x: 20, y: N_BOT },
    ],
    fragments: 1,
    title: tx("DNA polymerase III works 5′→3′ only", "DNA-Polymerase III arbeitet nur 5′→3′"),
    note: tx(
      "It reads the template 3′→5′ and adds nucleotides only to the 3′ end. Top: straight towards the fork, continuously (leading strand). Bottom: away from the fork, so only a piece (Okazaki fragment).",
      "Sie liest die Matrize 3′→5′ und hängt Nukleotide nur am 3′-Ende an. Oben: direkt auf die Gabel zu, kontinuierlich (Leitstrang). Unten: von der Gabel weg, deshalb nur ein Stück (Okazaki-Fragment).",
    ),
  },
  {
    fork: 470,
    segs: [
      { id: "lp", x0: 24, x1: 54, y: N_TOP, kind: "rna" },
      { id: "lead", x0: 54, x1: 410, y: N_TOP, kind: "dna" },
      { id: "p1", x0: 210, x1: 240, y: N_BOT, kind: "rna" },
      { id: "f1", x0: 24, x1: 210, y: N_BOT, kind: "dna" },
      { id: "p2", x0: 380, x1: 410, y: N_BOT, kind: "rna" },
      { id: "f2", x0: 240, x1: 380, y: N_BOT, kind: "dna" },
    ],
    enzymes: [
      { id: "helicase", x: 476, y: 152 },
      { id: "pol3", x: 416, y: N_TOP },
      { id: "pol3", x: 236, y: N_BOT },
    ],
    fragments: 2,
    title: tx("The fork moves on", "Die Gabel wandert weiter"),
    note: tx(
      "The leading strand simply keeps growing. On the lagging strand a new primer is needed near the fork, and the next Okazaki fragment grows back to the previous one.",
      "Der Leitstrang wächst einfach weiter. Am Folgestrang braucht es nahe der Gabel einen neuen Primer, und das nächste Okazaki-Fragment wächst zurück bis zum vorigen.",
    ),
  },
  {
    fork: 470,
    segs: [
      { id: "lp", x0: 24, x1: 54, y: N_TOP, kind: "rna" },
      { id: "lead", x0: 54, x1: 410, y: N_TOP, kind: "dna" },
      { id: "p1", x0: 210, x1: 240, y: N_BOT, kind: "dna" },
      { id: "f1", x0: 24, x1: 210, y: N_BOT, kind: "dna" },
      { id: "p2", x0: 380, x1: 410, y: N_BOT, kind: "rna" },
      { id: "f2", x0: 240, x1: 380, y: N_BOT, kind: "dna" },
    ],
    enzymes: [
      { id: "helicase", x: 476, y: 152 },
      { id: "pol1", x: 222, y: N_BOT + 20 },
    ],
    fragments: 2,
    nick: true,
    title: tx("DNA polymerase I replaces the primer", "DNA-Polymerase I ersetzt den Primer"),
    note: tx(
      "DNA polymerase I removes the RNA primer between the fragments and fills the gap with DNA. One gap in the backbone is left: a nick.",
      "Die DNA-Polymerase I entfernt den RNA-Primer zwischen den Fragmenten und füllt die Lücke mit DNA. Übrig bleibt eine Lücke im Rückgrat (Nick).",
    ),
  },
  {
    fork: 470,
    segs: [
      { id: "lp", x0: 24, x1: 54, y: N_TOP, kind: "rna" },
      { id: "lead", x0: 54, x1: 410, y: N_TOP, kind: "dna" },
      { id: "p1", x0: 210, x1: 240, y: N_BOT, kind: "dna" },
      { id: "f1", x0: 24, x1: 210, y: N_BOT, kind: "dna" },
      { id: "p2", x0: 380, x1: 410, y: N_BOT, kind: "rna" },
      { id: "f2", x0: 240, x1: 380, y: N_BOT, kind: "dna" },
    ],
    enzymes: [
      { id: "helicase", x: 476, y: 152 },
      { id: "ligase", x: 210, y: N_BOT + 20 },
    ],
    fragments: 2,
    sealed: true,
    title: tx("Ligase joins the fragments", "Die Ligase verknüpft die Fragmente"),
    note: tx(
      "DNA ligase closes the nick (a bond between sugar and phosphate). Each daughter molecule has one old and one new strand: semiconservative. DNA polymerase also proofreads and fixes most wrong bases.",
      "Die DNA-Ligase schließt die Lücke (eine Bindung zwischen Zucker und Phosphat). Jedes Tochtermolekül hat einen alten und einen neuen Strang: semikonservativ. Die DNA-Polymerase liest außerdem Korrektur und behebt die meisten falschen Basen.",
    ),
  },
];

const ENZ: Record<Enzyme["id"], { name: Text; fill: string; stroke: string }> = {
  helicase: { name: tx("helicase", "Helikase"), fill: "var(--bio-sun)", stroke: "var(--bio-wood-deep)" },
  primase: { name: tx("primase", "Primase"), fill: "var(--bio-petal)", stroke: "var(--bio-petal-deep)" },
  pol3: { name: tx("DNA polymerase III", "DNA-Polymerase III"), fill: "var(--bio-leaf)", stroke: "var(--bio-leaf-deep)" },
  pol1: { name: tx("DNA polymerase I", "DNA-Polymerase I"), fill: "var(--bio-mito)", stroke: "var(--bio-mito-deep)" },
  ligase: { name: tx("DNA ligase", "DNA-Ligase"), fill: "var(--bio-wall)", stroke: "var(--bio-wall-deep)" },
};

const End = ({ x, y, s }: { x: number; y: number; s: string }) => (
  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
    {s}
  </text>
);

function EnzymeShape({ e }: { e: Enzyme }) {
  const s = ENZ[e.id];
  if (e.id === "helicase")
    return (
      <polygon
        points={[0, 1, 2, 3, 4, 5].map((k) => `${Math.round((e.x + 17 * Math.cos((k * Math.PI) / 3)) * 10) / 10},${Math.round((e.y + 17 * Math.sin((k * Math.PI) / 3)) * 10) / 10}`).join(" ")}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={2}
        opacity={0.95}
      />
    );
  return <ellipse cx={e.x} cy={e.y} rx={e.id === "pol3" ? 18 : 14} ry={e.id === "pol3" ? 15 : 11} fill={s.fill} stroke={s.stroke} strokeWidth={2} opacity={0.95} />;
}

/** Step through the replication fork: leading and lagging strand, primers, Okazaki fragments, ligase. */
export function DnaFork() {
  const t = useText();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const st = STEPS[i];
  const f = st.fork;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 90, damping: 18 };
  const topPath = `M20 ${T_TOP} L${f - 56} ${T_TOP} L${f} ${D_TOP} L540 ${D_TOP}`;
  const botPath = `M20 ${T_BOT} L${f - 56} ${T_BOT} L${f} ${D_BOT} L540 ${D_BOT}`;
  const active = new Set(st.enzymes.map((e) => e.id));

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 560 280" className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={t(tx("Replication fork", "Replikationsgabel"))}>
        {/* the two old (template) strands */}
        <motion.path initial={false} animate={{ d: topPath }} transition={spring} fill="none" stroke={OLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <motion.path initial={false} animate={{ d: botPath }} transition={spring} fill="none" stroke={OLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <End x={20} y={T_TOP - 18} s="3′" />
        <End x={540} y={D_TOP - 18} s="5′" />
        <End x={20} y={T_BOT + 20} s="5′" />
        <End x={540} y={D_BOT + 20} s="3′" />

        {/* new strands */}
        {st.segs.map((s) => (
          <motion.line
            key={s.id}
            initial={s.id.startsWith("f") ? { x1: s.x1, x2: s.x1, opacity: 0 } : s.id === "lead" ? { x1: s.x0, x2: s.x0, opacity: 0 } : { x1: s.x0, x2: s.x1, opacity: 0 }}
            animate={{ x1: s.x0, x2: s.x1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 60, damping: 16 }}
            y1={s.y}
            y2={s.y}
            stroke={s.kind === "rna" ? RNA : NEW}
            strokeWidth={9}
            strokeLinecap="butt"
          />
        ))}
        {/* 5′/3′ of the new strands */}
        {st.segs.some((s) => s.id === "lead") && (
          <>
            <End x={24} y={N_TOP + 18} s="5′" />
            <motion.g initial={false} animate={{ x: (st.segs.find((s) => s.id === "lead")?.x1 ?? 0) + 4 }} transition={spring}>
              <polygon points={`0,${N_TOP - 8} 10,${N_TOP} 0,${N_TOP + 8}`} fill={NEW} stroke="var(--bio-water-deep)" strokeWidth={1.2} />
            </motion.g>
          </>
        )}
        {st.fragments > 0 &&
          [
            { x3: 24, x5: 240 },
            { x3: 240, x5: 410 },
          ]
            .slice(0, st.fragments)
            .map((fr, k) => (
              <g key={k}>
                {!(st.sealed && k === 1) && <polygon points={`${fr.x3 + 2},${N_BOT - 8} ${fr.x3 - 8},${N_BOT} ${fr.x3 + 2},${N_BOT + 8}`} fill={NEW} stroke="var(--bio-water-deep)" strokeWidth={1.2} />}
                <text x={(fr.x3 + fr.x5) / 2} y={T_BOT + 30} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(tx(`Okazaki fragment ${k + 1}`, `Okazaki-Fragment ${k + 1}`))}
                </text>
              </g>
            ))}
        {st.nick && <line x1={210} y1={N_BOT - 7} x2={210} y2={N_BOT + 7} stroke="var(--raised)" strokeWidth={3} />}
        {st.sealed && (
          <motion.circle cx={210} cy={N_BOT} r={6} fill="none" stroke="var(--blob)" strokeWidth={2.5} initial={{ scale: 0.4, opacity: 1 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 1, repeat: reduce ? 0 : 2 }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        )}

        {/* strand names */}
        {st.segs.some((s) => s.id === "lead") && (
          <text x={140} y={N_TOP + 26} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("leading strand →", "Leitstrang →"))}
          </text>
        )}
        {st.fragments > 0 && (
          <text x={140} y={N_BOT - 26} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("← lagging strand", "← Folgestrang"))}
          </text>
        )}

        {/* enzymes */}
        {st.enzymes.map((e, k) => (
          <motion.g key={`${e.id}-${k}`} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <EnzymeShape e={e} />
          </motion.g>
        ))}
      </svg>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px]">
        {(Object.keys(ENZ) as Enzyme["id"][]).map((id) => (
          <span key={id} className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 transition-colors", active.has(id) ? "bg-blob-soft text-ink" : "text-ink-3")}>
            <span className="size-3 rounded-full border" style={{ background: ENZ[id].fill, borderColor: ENZ[id].stroke }} /> {t(ENZ[id].name)}
          </span>
        ))}
        <span className="flex items-center gap-1.5 px-2 py-0.5 text-ink-3">
          <span className="h-2 w-4 rounded-full" style={{ background: RNA }} /> {t(tx("RNA primer", "RNA-Primer"))}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 text-ink-3">
          <span className="h-2 w-4 rounded-full" style={{ background: OLD }} /> {t(tx("old strand", "alter Strang"))}
        </span>
        <span className="flex items-center gap-1.5 px-2 py-0.5 text-ink-3">
          <span className="h-2 w-4 rounded-full" style={{ background: NEW }} /> {t(tx("new strand", "neuer Strang"))}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-4" />
        </StepButton>
        <StepButton primary onClick={() => setI(Math.min(STEPS.length - 1, i + 1))} disabled={i === STEPS.length - 1} label={t(tx("Next step", "Nächster Schritt"))}>
          {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </StepButton>
        <StepButton onClick={() => setI(0)} disabled={i === 0} label={t(tx("Start again", "Von vorn"))}>
          <RotateCcw className="size-4" />
        </StepButton>
        <div className="ml-auto">
          <StepDots count={STEPS.length} at={i} onPick={setI} label={(k) => t(tx(`Step ${k + 1}`, `Schritt ${k + 1}`))} />
        </div>
      </div>

      <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-[4rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
        <span className="font-semibold text-ink">
          {i + 1}. {t(st.title)}:{" "}
        </span>
        <span className="text-ink-2">{t(st.note)}</span>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task picture: a fork with labelled ends; which new strand is the leading strand?

/**
 * A replication fork without new strands. `dir` is where the fork moves (1 right, -1 left),
 * `topLeft` the label at the left end of the top template strand.
 */
export function DnaForkFigure({ dir = 1, topLeft = "3" }: { dir?: 1 | -1; topLeft?: "3" | "5" }) {
  const t = useText();
  const f = 280;
  const open = dir === 1 ? -1 : 1; // the separated strands lie behind the moving fork
  const xFar = dir === 1 ? 30 : 530;
  const xDup = dir === 1 ? 530 : 30;
  const top = `M${xFar} 60 L${f + open * 70} 60 L${f} 120 L${xDup} 120`;
  const bot = `M${xFar} 200 L${f + open * 70} 200 L${f} 144 L${xDup} 144`;
  const tl = topLeft === "3" ? "3′" : "5′";
  const tr = topLeft === "3" ? "5′" : "3′";
  const leftX = 18;
  const rightX = 542;
  const label = (x: number, y: number, s: string) => (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={16} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
      {s}
    </text>
  );
  const num = (x: number, y: number, n: string) => (
    <g>
      <circle cx={x} cy={y} r={12} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.6} />
      {label(x, y, n)}
    </g>
  );
  const sepX = (f + open * 70 + xFar) / 2;
  return (
    <svg viewBox="0 0 560 260" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Replication fork with labelled ends", "Replikationsgabel mit beschrifteten Enden"))}>
      <path d={top} fill="none" stroke={OLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <path d={bot} fill="none" stroke={OLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      {/* ends: the label at a given end belongs to the strand that ends there */}
      {label(leftX, dir === 1 ? 60 : 120, tl)}
      {label(rightX, dir === 1 ? 120 : 60, tr)}
      {label(leftX, dir === 1 ? 200 : 144, tr)}
      {label(rightX, dir === 1 ? 144 : 200, tl)}
      {num(sepX, 34, "1")}
      {num(sepX, 226, "2")}
      {/* direction of fork movement */}
      <g>
        <line x1={f + dir * 24} y1={92} x2={f + dir * 76} y2={92} stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" />
        <path d={`M${f + dir * 90} 92 l${-dir * 15} -9 l0 18 Z`} fill="var(--blob)" />
        <text x={f + dir * 56} y={70} textAnchor="middle" dominantBaseline="central" fontSize={13} fill="var(--blob)" fontWeight={600} style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("fork moves", "Gabel wandert"))}
        </text>
      </g>
    </svg>
  );
}
