"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { StepButton, StepDots } from "./DnaKit";

type Seg = { id: string; nt: number; exon: boolean; color?: string };
const SEGS: Seg[] = [
  { id: "E1", nt: 120, exon: true, color: "var(--bio-g)" },
  { id: "I1", nt: 300, exon: false },
  { id: "E2", nt: 90, exon: true, color: "var(--bio-t)" },
  { id: "I2", nt: 420, exon: false },
  { id: "E3", nt: 150, exon: true, color: "var(--bio-c)" },
  { id: "I3", nt: 210, exon: false },
  { id: "E4", nt: 180, exon: true, color: "var(--bio-a)" },
];

const STEPS: { title: Text; note: Text }[] = [
  {
    title: tx("Transcription: pre-mRNA", "Transkription: prä-mRNA"),
    note: tx(
      "In eukaryotes, RNA polymerase II starts at the promoter (with the TATA box) once transcription factors have bound. The copy still contains everything: exons and introns. It is the pre-mRNA.",
      "Bei Eukaryoten startet die RNA-Polymerase II am Promotor (mit TATA-Box), nachdem Transkriptionsfaktoren gebunden haben. Die Abschrift enthält noch alles: Exons und Introns. Das ist die prä-mRNA.",
    ),
  },
  {
    title: tx("5′ cap", "5′-Cap"),
    note: tx("A modified guanine nucleotide (cap) is attached to the 5′ end. It protects the mRNA and helps the ribosome to bind.", "Am 5′-Ende wird ein verändertes Guanin-Nukleotid angehängt (Cap). Es schützt die mRNA und hilft dem Ribosom beim Andocken."),
  },
  {
    title: tx("Poly-A tail", "Poly-A-Schwanz"),
    note: tx("At the 3′ end, 100 to 250 adenine nucleotides are added. The tail protects against breakdown and helps with export from the nucleus.", "Am 3′-Ende werden 100 bis 250 Adenin-Nukleotide angehängt. Der Schwanz schützt vor Abbau und hilft beim Export aus dem Zellkern."),
  },
  {
    title: tx("Splicing", "Spleißen"),
    note: tx(
      "The spliceosome cuts out the introns and joins the exons. Only the mature mRNA leaves the nucleus. Try leaving out exon 3: alternative splicing makes a second protein from the same gene.",
      "Das Spleißosom schneidet die Introns heraus und verknüpft die Exons. Nur die reife mRNA verlässt den Zellkern. Lass Exon 3 weg: Durch alternatives Spleißen entsteht aus demselben Gen ein zweites Protein.",
    ),
  },
];

/** RNA processing step by step (cap, poly-A tail, splicing) with alternative splicing of exon 3. */
export function DnaSplicing() {
  const t = useText();
  const [i, setI] = useState(0);
  const [skip3, setSkip3] = useState(false);
  const spliced = i >= 3;
  const shown = SEGS.filter((s) => (spliced ? s.exon && !(skip3 && s.id === "E3") : true));
  const nt = shown.filter((s) => s.exon).reduce((a, s) => a + s.nt, 0);
  const total = shown.reduce((a, s) => a + s.nt, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface px-3 py-5">
        <div className="flex items-center gap-1">
          <span className="w-4 shrink-0 text-[12px] font-semibold text-ink-3">5′</span>
          <AnimatePresence initial={false}>
            {i >= 1 && (
              <motion.span
                key="cap"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="grid h-8 shrink-0 place-items-center rounded-full border-2 px-1.5 text-[11px] font-bold text-ink"
                style={{ borderColor: "var(--bio-nucleus-deep)", background: "color-mix(in oklab, var(--bio-nucleus) 60%, var(--raised))" }}
                title={t(tx("5′ cap", "5′-Cap"))}
              >
                m⁷G
              </motion.span>
            )}
          </AnimatePresence>
          <div className="flex min-w-0 flex-1 items-center">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((s) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scaleY: 0.4 }}
                  animate={{ opacity: 1, scaleY: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.6 }}
                  transition={{ type: "spring", stiffness: 260, damping: 28 }}
                  className={cn("grid h-9 min-w-[22px] place-items-center text-[11px] font-bold text-ink sm:min-w-[30px] sm:text-[11.5px]", s.exon ? "rounded-md border-2" : "rounded-sm border border-line-2")}
                  style={{
                    flexGrow: s.nt,
                    flexBasis: 0,
                    background: s.exon ? `color-mix(in oklab, ${s.color} 40%, var(--raised))` : "repeating-linear-gradient(135deg, var(--line) 0 5px, transparent 5px 10px)",
                    borderColor: s.exon ? s.color : undefined,
                  }}
                >
                  {s.id}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <AnimatePresence initial={false}>
            {i >= 2 && (
              <motion.span
                key="tail"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="shrink-0 overflow-hidden whitespace-nowrap rounded-r-full border-2 px-1.5 py-1 text-[11px] font-bold tracking-wider text-ink"
                style={{ borderColor: "var(--bio-a)", background: "color-mix(in oklab, var(--bio-a) 25%, var(--raised))" }}
              >
                AAAA…
              </motion.span>
            )}
          </AnimatePresence>
          <span className="w-4 shrink-0 text-right text-[12px] font-semibold text-ink-3">3′</span>
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-[12.5px] text-ink-3">
          <span>
            {spliced ? t(tx("mature mRNA", "reife mRNA")) : t(tx("pre-mRNA", "prä-mRNA"))}: {total} {t(tx("nucleotides (without cap and tail)", "Nukleotide (ohne Cap und Schwanz)"))}
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm border-2" style={{ borderColor: "var(--bio-g)" }} /> {t(tx("exon", "Exon"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-sm border border-line-2" style={{ background: "repeating-linear-gradient(135deg, var(--line) 0 4px, transparent 4px 8px)" }} /> {t(tx("intron", "Intron"))}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-4" />
        </StepButton>
        <StepButton primary onClick={() => setI(Math.min(3, i + 1))} disabled={i === 3} label={t(tx("Next step", "Nächster Schritt"))}>
          {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </StepButton>
        <label className={cn("flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-[13.5px] text-ink", !spliced && "opacity-40")}>
          <input type="checkbox" checked={skip3} disabled={!spliced} onChange={(e) => setSkip3(e.target.checked)} className="size-4 accent-blob" />
          {t(tx("Leave out exon 3", "Exon 3 weglassen"))}
        </label>
        <div className="ml-auto">
          <StepDots count={STEPS.length} at={i} onPick={setI} label={(k) => t(tx(`Step ${k + 1}`, `Schritt ${k + 1}`))} />
        </div>
      </div>

      <motion.div key={`${i}-${skip3}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
        <span className="font-semibold text-ink">
          {i + 1}. {t(STEPS[i].title)}:{" "}
        </span>
        <span className="text-ink-2">{t(STEPS[i].note)}</span>
        {spliced && (
          <span className="mt-1.5 block text-ink">
            {t(
              tx(
                `Simplified, the exons here are all coding: ${nt} nucleotides = ${nt / 3} codons → ${nt / 3 - 1} amino acids plus the stop codon.${skip3 ? " Exon 3 has 150 nucleotides, a multiple of 3: the reading frame stays intact, the protein is just 50 amino acids shorter." : ""}`,
                `Vereinfacht sind die Exons hier ganz codierend: ${nt} Nukleotide = ${nt / 3} Codons → ${nt / 3 - 1} Aminosäuren plus das Stoppcodon.${skip3 ? " Exon 3 hat 150 Nukleotide, ein Vielfaches von 3: Das Leseraster bleibt erhalten, das Protein ist nur 50 Aminosäuren kürzer." : ""}`,
              ),
            )}
          </span>
        )}
      </motion.div>
    </div>
  );
}
