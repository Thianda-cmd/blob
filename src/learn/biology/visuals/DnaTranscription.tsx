"use client";

import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, RotateCcw, SkipForward, StepForward } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { BASE_NAME, complement, toRna, triplets } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { baseTint, BASE_COLOR, StepButton } from "./DnaKit";

/** Coding strand of a tiny gene (5′→3′): Met–Phe–Gly–stop. */
const CODING = "ATGTTCGGATAA";
const TEMPLATE = complement(CODING);
const MRNA = toRna(CODING);
const N = CODING.length;

function Tile({ base, dim, pop, mark }: { base: string; dim?: boolean; pop?: boolean; mark?: boolean }) {
  const inner = (
    <span
      className={cn(
        "relative grid size-[22px] place-items-center rounded-[5px] border-2 text-[12px] font-semibold text-ink sm:size-[30px] sm:rounded-md sm:text-[15px]",
        dim && "opacity-45",
      )}
      style={{ background: baseTint(base), borderColor: mark ? "var(--blob)" : BASE_COLOR[base] }}
    >
      {base}
    </span>
  );
  if (!pop) return inner;
  return (
    <motion.span initial={{ y: 14, scale: 0.4, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 25 }} className="inline-grid">
      {inner}
    </motion.span>
  );
}

const End = ({ s }: { s: string }) => <span className="grid h-[22px] w-4 place-items-center text-[11px] font-semibold text-ink-3 sm:h-[30px] sm:w-5 sm:text-[12.5px]">{s}</span>;

/** Transcription base by base: RNA polymerase reads the template strand 3′→5′ and builds the mRNA 5′→3′. */
export function DnaTranscription() {
  const t = useText();
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const done = pos >= N;

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setPos(pos + 1);
      if (pos + 1 >= N) setPlaying(false);
    }, 650);
    return () => clearTimeout(id);
  }, [playing, pos]);

  const last = pos > 0 ? pos - 1 : null;
  const note: Text =
    last === null
      ? tx(
          "RNA polymerase has bound at the start of the gene. It reads the template strand (codogenic strand). Press Next.",
          "Die RNA-Polymerase hat am Anfang des Gens angedockt. Sie liest den codogenen Strang. Drück auf Weiter.",
        )
      : done
        ? tx(
            "Done! The mRNA (5′→3′) has the same sequence as the coding strand, only with U instead of T. It leaves the nucleus through a nuclear pore.",
            "Fertig! Die mRNA (5′→3′) hat dieselbe Basenfolge wie der codierende Strang, nur mit U statt T. Sie verlässt den Zellkern durch eine Kernpore.",
          )
        : TEMPLATE[last] === "A"
          ? tx(`Template base A → the mRNA gets U (uracil). RNA has no thymine!`, `Base A im codogenen Strang → die mRNA bekommt U (Uracil). RNA hat kein Thymin!`)
          : tx(
              `Template base ${TEMPLATE[last]} → the mRNA gets ${MRNA[last]} (${resolveText(BASE_NAME[MRNA[last]], "en")}).`,
              `Base ${TEMPLATE[last]} im codogenen Strang → die mRNA bekommt ${MRNA[last]} (${resolveText(BASE_NAME[MRNA[last]], "de")}).`,
            );

  const step = (n: number) => {
    setPlaying(false);
    setPos(Math.min(N, pos + n));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-1 pt-2">
        <div className="mx-auto flex w-max items-start gap-2 sm:gap-3">
          <div className="hidden flex-col gap-[6px] pt-[1px] text-right text-[12px] leading-[30px] text-ink-3 sm:flex">
            <span>{t(tx("coding strand", "codierender Strang"))}</span>
            <span className="font-semibold text-ink-2">{t(tx("template strand", "codogener Strang"))}</span>
            <span className="text-blob-ink">mRNA</span>
          </div>
          <div className="flex items-start gap-[2px]">
            <div className="flex flex-col gap-[6px]">
              <End s="5′" />
              <End s="3′" />
              <End s="5′" />
            </div>
            <div className="flex gap-2 sm:gap-3">
              {triplets(CODING).map((codon, ci) => (
                <div key={ci} className="flex gap-[2px] sm:gap-[3px]">
                  {[...codon].map((b, k) => {
                    const i = ci * 3 + k;
                    const active = i === pos && !done;
                    return (
                      <div key={i} className="relative flex flex-col gap-[6px]">
                        {active && (
                          <motion.span
                            layoutId="rna-polymerase"
                            className="absolute -inset-x-[5px] bottom-[-5px] top-[23px] rounded-xl sm:top-[31px]"
                            style={{ background: "color-mix(in oklab, var(--blob) 22%, transparent)", border: "2px solid var(--blob)" }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                        <span className={cn("transition-transform duration-300", Math.abs(i - pos) <= 1 && !done && "-translate-y-1")}>
                          <Tile base={b} dim />
                        </span>
                        <Tile base={TEMPLATE[i]} />
                        <span className="relative grid size-[22px] place-items-center sm:size-[30px]">
                          <span className="absolute inset-0 rounded-[5px] border-2 border-dashed border-line-2 sm:rounded-md" />
                          <AnimatePresence>{i < pos && <Tile key="m" base={MRNA[i]} pop mark={MRNA[i] === "U"} />}</AnimatePresence>
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-[6px]">
              <End s="3′" />
              <End s="5′" />
              {done ? <End s="3′" /> : <End s="" />}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-[12px] text-ink-3 sm:hidden">
        {t(tx("Top: coding strand · middle: template strand · bottom: mRNA", "Oben: codierender Strang · Mitte: codogener Strang · unten: mRNA"))}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton primary onClick={() => step(1)} disabled={done} label={t(tx("Next base", "Nächste Base"))}>
          <StepForward className="size-4" /> {t(tx("Next base", "Nächste Base"))}
        </StepButton>
        <StepButton onClick={() => step(3 - (pos % 3))} disabled={done} label={t(tx("Next codon", "Nächstes Triplett"))}>
          <SkipForward className="size-4" /> {t(tx("Triplet", "Triplett"))}
        </StepButton>
        <StepButton
          onClick={() => {
            if (done) setPos(0);
            setPlaying(done ? true : !playing);
          }}
          label={t(playing ? tx("Pause", "Pause") : tx("Play", "Abspielen"))}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </StepButton>
        <StepButton
          onClick={() => {
            setPlaying(false);
            setPos(0);
          }}
          disabled={pos === 0}
          label={t(tx("Start again", "Von vorn"))}
        >
          <RotateCcw className="size-4" />
        </StepButton>
        <span className="ml-auto text-[13px] tabular-nums text-ink-3">
          {pos}/{N} {t(tx("bases", "Basen"))}
        </span>
      </div>

      <motion.p key={pos} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-[3rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug text-ink" aria-live="polite">
        {t(note)}
      </motion.p>
    </div>
  );
}
