"use client";

// The sodium-potassium pump step by step (topic "cell", level 3): 3 Na⁺ out, 2 K⁺ in, one ATP
// per cycle, against both concentration gradients (primary active transport).

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

const W = 520;
const H = 330;
const MEM_TOP = 112;
const MEM_BOT = 192;

type Step = { title: Text; body: Text; open: "in" | "out"; na: [number, number][]; k: [number, number][]; atp: "atp" | "adp" | "gone"; p: "none" | "bound" | "free" };

const NA_IN: [number, number][] = [
  [196, 262],
  [252, 286],
  [318, 266],
];
const NA_SITE: [number, number][] = [
  [260, 186],
  [260, 160],
  [260, 134],
];
const NA_OUT: [number, number][] = [
  [196, 54],
  [262, 34],
  [330, 58],
];
const K_OUT: [number, number][] = [
  [140, 70],
  [392, 66],
];
const K_SITE: [number, number][] = [
  [260, 140],
  [260, 168],
];
const K_IN: [number, number][] = [
  [206, 276],
  [306, 290],
];

const STEPS: Step[] = [
  {
    title: tx("Start: open to the inside", "Start: nach innen geöffnet"),
    body: tx("The pump is a carrier protein in the membrane. Its binding sites face the cytoplasm, where there is little Na⁺.", "Die Pumpe ist ein Carrierprotein in der Membran. Ihre Bindestellen zeigen ins Zellplasma, wo wenig Na⁺ ist."),
    open: "in",
    na: NA_IN,
    k: K_OUT,
    atp: "atp",
    p: "none",
  },
  {
    title: tx("3 Na⁺ bind", "3 Na⁺ binden"),
    body: tx("Three sodium ions from the cytoplasm bind to the pump.", "Drei Natrium-Ionen aus dem Zellplasma binden an die Pumpe."),
    open: "in",
    na: NA_SITE,
    k: K_OUT,
    atp: "atp",
    p: "none",
  },
  {
    title: tx("ATP is split", "ATP wird gespalten"),
    body: tx("ATP → ADP + P. The phosphate group stays on the pump (phosphorylation). This is where the energy comes in.", "ATP → ADP + P. Die Phosphatgruppe bleibt an der Pumpe hängen (Phosphorylierung). Hier steckt die Energie drin."),
    open: "in",
    na: NA_SITE,
    k: K_OUT,
    atp: "adp",
    p: "bound",
  },
  {
    title: tx("Change of shape: 3 Na⁺ out", "Formänderung: 3 Na⁺ hinaus"),
    body: tx("The pump changes its shape and opens to the outside. It releases the three Na⁺, although there is already a lot of Na⁺ outside: against the gradient.", "Die Pumpe ändert ihre Form und öffnet sich nach außen. Sie gibt die drei Na⁺ ab, obwohl außen schon viel Na⁺ ist: gegen das Konzentrationsgefälle."),
    open: "out",
    na: NA_OUT,
    k: K_OUT,
    atp: "gone",
    p: "bound",
  },
  {
    title: tx("2 K⁺ bind", "2 K⁺ binden"),
    body: tx("Now two potassium ions from outside bind.", "Jetzt binden zwei Kalium-Ionen von außen."),
    open: "out",
    na: NA_OUT,
    k: K_SITE,
    atp: "gone",
    p: "bound",
  },
  {
    title: tx("Phosphate leaves: back to the start shape", "Phosphat löst sich: zurück in die Ausgangsform"),
    body: tx("The phosphate group comes off (dephosphorylation). The pump flips back and opens to the inside again.", "Die Phosphatgruppe löst sich (Dephosphorylierung). Die Pumpe klappt zurück und öffnet sich wieder nach innen."),
    open: "in",
    na: NA_OUT,
    k: K_SITE,
    atp: "gone",
    p: "free",
  },
  {
    title: tx("2 K⁺ in: one cycle done", "2 K⁺ hinein: ein Zyklus geschafft"),
    body: tx("The two K⁺ are released into the cytoplasm. Balance per ATP: 3 Na⁺ out, 2 K⁺ in. So one positive charge more leaves the cell each time.", "Die zwei K⁺ werden ins Zellplasma abgegeben. Bilanz pro ATP: 3 Na⁺ hinaus, 2 K⁺ hinein. Pro Zyklus verlässt also eine positive Ladung mehr die Zelle."),
    open: "in",
    na: NA_OUT,
    k: K_IN,
    atp: "gone",
    p: "none",
  },
];

// Background ions show the gradients: Na⁺ mostly outside, K⁺ mostly inside.
const BG: { x: number; y: number; ion: "na" | "k" }[] = [
  ...[
    [30, 30], [80, 88], [120, 30], [230, 84], [300, 22], [356, 92], [440, 30], [490, 86], [60, 62], [420, 98], [478, 48], [168, 98],
  ].map(([x, y]) => ({ x, y, ion: "na" as const })),
  ...[
    [36, 230], [96, 300], [150, 244], [380, 238], [430, 300], [486, 250], [70, 270], [460, 214], [356, 306], [130, 312],
  ].map(([x, y]) => ({ x, y, ion: "k" as const })),
  ...[
    [470, 80], [44, 96],
  ].map(([x, y]) => ({ x, y, ion: "k" as const })),
  ...[
    [110, 214], [404, 296],
  ].map(([x, y]) => ({ x, y, ion: "na" as const })),
];

const spring = { type: "spring" as const, stiffness: 90, damping: 16 };

function Ion({ x, y, kind }: { x: number; y: number; kind: "na" | "k" }) {
  return (
    <motion.g initial={false} animate={{ x, y }} transition={spring}>
      <circle r={kind === "na" ? 11 : 12.5} fill={kind === "na" ? "var(--bio-sun)" : "var(--bio-nucleus)"} stroke={kind === "na" ? "var(--bio-nerve-deep)" : "var(--bio-nucleus-deep)"} strokeWidth={1.6} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={kind === "na" ? 9.5 : 10.5} fontWeight={700} fill="var(--bio-outline)" style={{ fontFamily: "var(--font-sans)" }}>
        {kind === "na" ? "Na⁺" : "K⁺"}
      </text>
    </motion.g>
  );
}

export function CellPump({ start = 0 }: { start?: number }) {
  const t = useText();
  const [i, setI] = useState(start);
  const S = STEPS[i];
  const tilt = S.open === "in" ? -9 : 9;
  const last = i === STEPS.length - 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] md:items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Sodium-potassium pump", "Natrium-Kalium-Pumpe"))}>
          <rect x={0} y={0} width={W} height={MEM_TOP} fill="var(--bio-water)" opacity={0.1} />
          <rect x={0} y={MEM_BOT} width={W} height={H - MEM_BOT} fill="var(--bio-cell)" opacity={0.7} />
          <text x={W - 10} y={20} textAnchor="end" fontSize={12.5} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("outside", "außen"))}
          </text>
          <text x={W - 10} y={H - 10} textAnchor="end" fontSize={12.5} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("inside (cytoplasm)", "innen (Cytoplasma)"))}
          </text>
          {BG.map((b, k) => (
            <circle key={k} cx={b.x} cy={b.y} r={4} fill={b.ion === "na" ? "var(--bio-sun)" : "var(--bio-nucleus)"} stroke={b.ion === "na" ? "var(--bio-nerve-deep)" : "var(--bio-nucleus-deep)"} strokeWidth={0.8} opacity={0.75} />
          ))}
          {/* the membrane: heads and tails, simplified */}
          {Array.from({ length: 31 }, (_, k) => 8 + k * 17)
            .filter((x) => x < 198 || x > 322)
            .map((x) => (
              <g key={x}>
                <line x1={x - 2.5} x2={x - 2.5} y1={MEM_TOP + 7} y2={MEM_TOP + 36} stroke="var(--bio-nerve-deep)" strokeWidth={1.4} />
                <line x1={x + 2.5} x2={x + 2.5} y1={MEM_TOP + 7} y2={MEM_TOP + 36} stroke="var(--bio-nerve-deep)" strokeWidth={1.4} />
                <line x1={x - 2.5} x2={x - 2.5} y1={MEM_BOT - 7} y2={MEM_BOT - 36} stroke="var(--bio-nerve-deep)" strokeWidth={1.4} />
                <line x1={x + 2.5} x2={x + 2.5} y1={MEM_BOT - 7} y2={MEM_BOT - 36} stroke="var(--bio-nerve-deep)" strokeWidth={1.4} />
                <circle cx={x} cy={MEM_TOP} r={6.5} fill="var(--bio-membrane)" stroke="var(--bio-nerve-deep)" strokeWidth={1} />
                <circle cx={x} cy={MEM_BOT} r={6.5} fill="var(--bio-membrane)" stroke="var(--bio-nerve-deep)" strokeWidth={1} />
              </g>
            ))}
          {/* the pump: two halves that tilt open to one side */}
          {[-1, 1].map((side) => (
            <motion.g key={side} initial={false} animate={{ rotate: side * tilt }} transition={spring} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
              <rect x={side < 0 ? 206 : 272} y={92} width={42} height={120} rx={18} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={2} />
            </motion.g>
          ))}
          {/* ATP and its phosphate */}
          <AnimatePresence>
            {S.atp !== "gone" && (
              <motion.g key="atp" initial={{ opacity: 0 }} animate={{ opacity: 1, x: S.atp === "atp" ? 352 : 404, y: S.atp === "atp" ? 236 : 262 }} exit={{ opacity: 0 }} transition={spring}>
                <rect x={-22} y={-12} width={44} height={24} rx={12} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.5} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="var(--bio-outline)" style={{ fontFamily: "var(--font-sans)" }}>
                  {S.atp === "atp" ? "ATP" : "ADP"}
                </text>
              </motion.g>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {S.p !== "none" && (
              <motion.g key="p" initial={{ opacity: 0, x: 352, y: 236 }} animate={{ opacity: S.p === "free" ? 0.6 : 1, x: S.p === "bound" ? 304 : 360, y: S.p === "bound" ? 206 : 280 }} exit={{ opacity: 0 }} transition={spring}>
                <circle r={10} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.5} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="var(--bio-outline)" style={{ fontFamily: "var(--font-sans)" }}>
                  P
                </text>
              </motion.g>
            )}
          </AnimatePresence>
          {S.na.map(([x, y], k) => (
            <Ion key={`na${k}`} x={x} y={y} kind="na" />
          ))}
          {S.k.map(([x, y], k) => (
            <Ion key={`k${k}`} x={x} y={y} kind="k" />
          ))}
        </svg>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl bg-surface px-3.5 py-3 text-[14px] leading-relaxed text-ink-2" aria-live="polite">
            <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-blob-ink">
              {t(tx("Step", "Schritt"))} {i + 1}/{STEPS.length}
            </div>
            <div className="mb-1 font-semibold text-ink">{t(S.title)}</div>
            {t(S.body)}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} className="flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-[14px] font-medium text-ink-2 hover:bg-hover disabled:opacity-40">
          <ChevronLeft className="size-4" /> {t(tx("Back", "Zurück"))}
        </button>
        <button type="button" onClick={() => setI(last ? 0 : i + 1)} className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]">
          {last ? (
            <>
              <RotateCcw className="size-4" /> {t(tx("Next cycle", "Nächster Zyklus"))}
            </>
          ) : (
            <>
              {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
            </>
          )}
        </button>
        <div className="ml-auto flex gap-1.5" aria-hidden>
          {STEPS.map((_, k) => (
            <span key={k} className={cn("size-2 rounded-full transition-colors", k === i ? "bg-blob" : k < i ? "bg-blob/40" : "bg-line-2")} />
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-ink-3" style={{ background: "var(--bio-sun)" }} /> {t(tx("sodium ions: many outside", "Natrium-Ionen: außen viele"))}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full border border-ink-3" style={{ background: "var(--bio-nucleus)" }} /> {t(tx("potassium ions: many inside", "Kalium-Ionen: innen viele"))}
        </span>
      </div>
    </div>
  );
}
