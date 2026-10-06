"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { AMINO, aminoLetter, anticodonOf, triplets } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { BASE_COLOR, baseTint, StepButton, StepDots } from "./DnaKit";

const LEAD = "GC";
const CODONS = triplets("AUGUUCGGAUGGAAAUAA");
const TRAIL = "GC";
const MRNA = LEAD + CODONS.join("") + TRAIL;
const BW = 20;
const P_CENTER = 280;
const MRNA_Y = 252;
const AA_Y = 136;
const center = (j: number) => (LEAD.length + 3 * j) * BW + 1.5 * BW;

type Site = "E" | "P" | "A";
type Stage = {
  p: number;
  trnas: { j: number; site: Site; leaving?: boolean }[];
  chainOn: number;
  len: number;
  rf?: boolean;
  end?: boolean;
  phase: Text;
  note: Text;
  noteSites: Text;
};

const aaName = (j: number, l: "en" | "de") => resolveText(AMINO[aminoLetter(CODONS[j])].name, l);
const abbr = (j: number) => AMINO[aminoLetter(CODONS[j])].abbr;

function buildStages(): Stage[] {
  const n = CODONS.length;
  const out: Stage[] = [
    {
      p: 0,
      trnas: [{ j: 0, site: "P" }],
      chainOn: 0,
      len: 1,
      phase: tx("Initiation", "Initiation"),
      note: tx(
        "Start: the small subunit finds the start codon AUG. The first tRNA (anticodon UAC) brings methionine, then the large subunit joins.",
        "Start: Die kleine Untereinheit findet das Startcodon AUG. Die erste tRNA (Anticodon UAC) bringt Methionin, dann kommt die große Untereinheit dazu.",
      ),
      noteSites: tx(
        "The small subunit binds the mRNA and finds the start codon AUG. The initiator tRNA with methionine (anticodon UAC) sits in the P site. Then the large subunit joins.",
        "Die kleine Untereinheit bindet die mRNA und sucht das Startcodon AUG. Die Start-tRNA mit Methionin (Anticodon UAC) sitzt an der P-Stelle. Dann lagert sich die große Untereinheit an.",
      ),
    },
  ];
  for (let j = 1; j < n - 1; j++) {
    const ac = anticodonOf(CODONS[j]);
    out.push({
      p: j - 1,
      trnas: [
        { j: j - 1, site: "P" },
        { j, site: "A" },
      ],
      chainOn: j - 1,
      len: j,
      phase: tx("Elongation: a tRNA binds", "Elongation: Bindung der tRNA"),
      note: tx(
        `Codon ${j + 1}: ${CODONS[j]}. The tRNA with the matching anticodon ${ac} brings ${aaName(j, "en")} (${abbr(j)}).`,
        `Codon ${j + 1}: ${CODONS[j]}. Die tRNA mit dem passenden Anticodon ${ac} bringt ${aaName(j, "de")} (${abbr(j)}).`,
      ),
      noteSites: tx(
        `The tRNA with the anticodon ${ac} pairs with the codon ${CODONS[j]} in the A site. It carries ${aaName(j, "en")}.`,
        `Die tRNA mit dem Anticodon ${ac} paart an der A-Stelle mit dem Codon ${CODONS[j]}. Sie trägt ${aaName(j, "de")}.`,
      ),
    });
    out.push({
      p: j - 1,
      trnas: [
        { j: j - 1, site: "P" },
        { j, site: "A" },
      ],
      chainOn: j,
      len: j + 1,
      phase: tx("Elongation: peptide bond", "Elongation: Peptidbindung"),
      note: tx(
        `Peptide bond: the chain is linked to ${abbr(j)}. Now it hangs on the new tRNA.`,
        `Peptidbindung: Die Kette wird mit ${abbr(j)} verknüpft. Jetzt hängt sie an der neuen tRNA.`,
      ),
      noteSites: tx(
        `The ribosome links the chain from the P site to ${abbr(j)} in the A site. The tRNA in the P site is now empty.`,
        `Das Ribosom verknüpft die Kette von der P-Stelle mit ${abbr(j)} an der A-Stelle. Die tRNA an der P-Stelle ist jetzt leer.`,
      ),
    });
    out.push({
      p: j,
      trnas: [
        { j: j - 1, site: "E", leaving: true },
        { j, site: "P" },
      ],
      chainOn: j,
      len: j + 1,
      phase: tx("Elongation: translocation", "Elongation: Translokation"),
      note: tx("The ribosome moves on by one codon (one triplet). The empty tRNA leaves and can pick up a new amino acid.", "Das Ribosom rückt um ein Codon (ein Triplett) weiter. Die leere tRNA löst sich und kann eine neue Aminosäure holen."),
      noteSites: tx(
        "The ribosome moves one codon towards the 3′ end. The empty tRNA goes to the E site and leaves; the tRNA with the chain is now in the P site, the A site is free.",
        "Das Ribosom rückt ein Codon in Richtung 3′-Ende. Die leere tRNA gelangt an die E-Stelle und verlässt das Ribosom; die tRNA mit der Kette sitzt jetzt an der P-Stelle, die A-Stelle ist frei.",
      ),
    });
  }
  const stop = CODONS[n - 1];
  const chainEn = CODONS.slice(0, -1).map((_, j) => abbr(j)).join("–");
  out.push({
    p: n - 2,
    trnas: [{ j: n - 2, site: "P" }],
    chainOn: n - 2,
    len: n - 1,
    rf: true,
    phase: tx("Termination", "Termination"),
    note: tx(`Stop codon ${stop}: no tRNA fits. A release factor binds instead.`, `Stoppcodon ${stop}: Keine tRNA passt. Stattdessen bindet ein Freisetzungsfaktor.`),
    noteSites: tx(
      `The stop codon ${stop} reaches the A site. No tRNA has a matching anticodon; a release factor binds.`,
      `Das Stoppcodon ${stop} erreicht die A-Stelle. Keine tRNA hat ein passendes Anticodon; ein Freisetzungsfaktor bindet.`,
    ),
  });
  out.push({
    p: n - 2,
    trnas: [],
    chainOn: n - 2,
    len: n - 1,
    end: true,
    phase: tx("Termination", "Termination"),
    note: tx(`The protein ${chainEn} is released. The ribosome falls apart into its two subunits.`, `Das Protein ${chainEn} wird frei. Das Ribosom zerfällt in seine beiden Untereinheiten.`),
    noteSites: tx(
      `The chain is cut off the last tRNA: the protein ${chainEn} is released, and the ribosome splits into its subunits. It can start again on any mRNA.`,
      `Die Kette wird von der letzten tRNA abgetrennt: Das Protein ${chainEn} wird frei, das Ribosom zerfällt in seine Untereinheiten. Es kann an einer beliebigen mRNA neu starten.`,
    ),
  });
  return out;
}

const STAGES = buildStages();

function Trna({ j, carry }: { j: number; carry: boolean }) {
  const x = center(j);
  const ac = anticodonOf(CODONS[j]);
  return (
    <g>
      <rect x={x - 5} y={AA_Y + 12} width={10} height={24} rx={3} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.6} />
      <path
        d={`M${x - 22} ${AA_Y + 40} Q${x - 30} ${AA_Y + 58} ${x - 20} ${AA_Y + 74} L${x - 26} ${AA_Y + 90} L${x + 26} ${AA_Y + 90} L${x + 20} ${AA_Y + 74} Q${x + 30} ${AA_Y + 58} ${x + 22} ${AA_Y + 40} Z`}
        fill="var(--bio-mito)"
        stroke="var(--bio-mito-deep)"
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      {[...ac].map((b, k) => (
        <g key={k}>
          <rect x={x - 30 + k * BW + 1} y={AA_Y + 92} width={BW - 2} height={20} rx={4} fill={baseTint(b, 45)} stroke={BASE_COLOR[b]} strokeWidth={1.5} />
          <text x={x - 30 + k * BW + BW / 2} y={AA_Y + 102} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
            {b}
          </text>
        </g>
      ))}
      {carry && <AminoBall x={x} y={AA_Y} label={abbr(j)} />}
    </g>
  );
}

function AminoBall({ x, y, label, start }: { x: number; y: number; label: string; start?: boolean }) {
  return (
    <g>
      <circle cx={x} cy={y} r={15} fill={start ? "var(--bio-nucleus)" : "var(--bio-leaf)"} stroke={start ? "var(--bio-nucleus-deep)" : "var(--bio-leaf-deep)"} strokeWidth={1.8} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {label}
      </text>
    </g>
  );
}

/** Translation codon by codon: tRNAs bring amino acids, the chain grows, the ribosome moves along the mRNA. */
export function DnaRibosome({ sites = false }: { sites?: boolean }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const st = STAGES[i];
  const last = STAGES.length - 1;
  const spring = reduce ? { duration: 0 } : { type: "spring" as const, stiffness: 120, damping: 20 };

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setI(i + 1);
      if (i + 1 >= last) setPlaying(false);
    }, 1500);
    return () => clearTimeout(id);
  }, [playing, i, last]);

  const go = (k: number) => {
    setPlaying(false);
    setI(k);
  };
  const offset = P_CENTER - center(st.p);
  const anchor = center(st.chainOn);
  const chain = Array.from({ length: st.len }, (_, k) => k);

  return (
    <div className="space-y-3">
      <svg viewBox="0 0 560 340" className="mx-auto block h-auto w-full max-w-[600px]" role="img" aria-label={t(tx("Translation at the ribosome", "Translation am Ribosom"))}>
        {/* small subunit */}
        <motion.path
          d="M176 284 Q176 268 196 266 L364 266 Q384 268 384 284 Q384 322 280 324 Q176 322 176 284 Z"
          fill="var(--bio-nucleus)"
          stroke="var(--bio-nucleus-deep)"
          strokeWidth={2}
          animate={{ y: st.end ? 12 : 0, opacity: st.end ? 0.45 : 0.9 }}
          transition={spring}
        />
        {/* large subunit with the three sites */}
        <motion.g animate={{ y: st.end ? -16 : 0, opacity: st.end ? 0.35 : 1 }} transition={spring}>
          <path d="M168 238 Q160 150 220 122 Q280 96 340 122 Q400 150 392 238 Z" fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={2} opacity={0.75} />
          {(["E", "P", "A"] as const).map((s, k) => (
            <g key={s}>
              <rect x={192 + k * 60} y={150} width={56} height={88} rx={12} fill="var(--raised)" opacity={0.5} stroke="var(--bio-nucleus-deep)" strokeDasharray="4 4" strokeWidth={1.4} />
              {sites && (
                <text x={220 + k * 60} y={138} textAnchor="middle" dominantBaseline="central" fontSize={15} fontWeight={800} fill="var(--bio-nucleus-deep)" style={{ fontFamily: "var(--font-sans)" }}>
                  {s}
                </text>
              )}
            </g>
          ))}
        </motion.g>

        {/* mRNA, tRNAs and the chain move together; the ribosome stays */}
        <motion.g initial={false} animate={{ x: offset }} transition={spring}>
          <line x1={-6} y1={MRNA_Y + 26} x2={MRNA.length * BW + 6} y2={MRNA_Y + 26} stroke="var(--ink-2)" strokeWidth={3} strokeLinecap="round" />
          {[...MRNA].map((b, k) => {
            const inCodon = k >= LEAD.length && k < LEAD.length + CODONS.length * 3;
            return (
              <g key={k}>
                <rect x={k * BW + 1} y={MRNA_Y} width={BW - 2} height={22} rx={4} fill={baseTint(b, inCodon ? 45 : 20)} stroke={BASE_COLOR[b]} strokeWidth={1.5} />
                <text x={k * BW + BW / 2} y={MRNA_Y + 11} textAnchor="middle" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                  {b}
                </text>
              </g>
            );
          })}
          <text x={-18} y={MRNA_Y + 12} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            5′
          </text>
          <text x={MRNA.length * BW + 18} y={MRNA_Y + 12} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            3′
          </text>

          <AnimatePresence>
            {st.trnas.map((tr) => (
              <motion.g
                key={`t${tr.j}`}
                initial={{ opacity: 0, y: -70, x: 30 }}
                animate={{ opacity: tr.leaving ? 0.35 : 1, y: tr.leaving ? -18 : 0, x: 0 }}
                exit={{ opacity: 0, y: -80, x: -20 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 20 }}
              >
                <Trna j={tr.j} carry={tr.site === "A" && st.chainOn !== tr.j} />
              </motion.g>
            ))}
          </AnimatePresence>

          {st.rf && (
            <motion.g initial={{ opacity: 0, y: -60 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
              <rect x={center(CODONS.length - 1) - 24} y={AA_Y + 36} width={48} height={74} rx={14} fill="var(--bio-blood)" opacity={0.85} stroke="var(--bio-outline)" strokeWidth={1.5} />
              <text x={center(CODONS.length - 1)} y={AA_Y + 72} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={800} fill="var(--raised)" style={{ fontFamily: "var(--font-sans)" }}>
                RF
              </text>
            </motion.g>
          )}

          {/* the growing chain: the newest amino acid sits on the tRNA, the first one (Met) leads out of the ribosome */}
          <motion.g animate={{ y: st.end ? 14 : 0, x: st.end ? -40 : 0 }} transition={spring}>
            {chain.map((k) => {
              const back = st.len - 1 - k;
              const x = anchor - 24 * back;
              const y = AA_Y - 26 * back;
              return (
                <motion.g key={`c${k}`} initial={false} animate={{ x, y }} transition={spring}>
                  {k > 0 && <line x1={0} y1={0} x2={24} y2={26} stroke="var(--bio-leaf-deep)" strokeWidth={3} transform="translate(-24 -26)" />}
                  <AminoBall x={0} y={0} label={abbr(k)} start={k === 0} />
                </motion.g>
              );
            })}
          </motion.g>
        </motion.g>
      </svg>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton onClick={() => go(Math.max(0, i - 1))} disabled={i === 0} label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-4" />
        </StepButton>
        <StepButton primary onClick={() => go(Math.min(last, i + 1))} disabled={i === last} label={t(tx("Next step", "Nächster Schritt"))}>
          {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </StepButton>
        <StepButton
          onClick={() => {
            if (i === last) setI(0);
            setPlaying(i === last ? true : !playing);
          }}
          label={t(playing ? tx("Pause", "Pause") : tx("Play", "Abspielen"))}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </StepButton>
        <StepButton onClick={() => go(0)} disabled={i === 0} label={t(tx("Start again", "Von vorn"))}>
          <RotateCcw className="size-4" />
        </StepButton>
        <div className="ml-auto">
          <StepDots count={STAGES.length} at={i} onPick={go} label={(k) => t(tx(`Step ${k + 1}`, `Schritt ${k + 1}`))} />
        </div>
      </div>

      <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-[3.5rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
        {sites && <span className={cn("mr-1.5 font-semibold text-blob-ink")}>{t(st.phase)}.</span>}
        <span className="text-ink">{t(sites ? st.noteSites : st.note)}</span>
      </motion.div>
    </div>
  );
}
