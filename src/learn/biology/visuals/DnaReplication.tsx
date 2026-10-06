"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Segmented, StepButton } from "./DnaKit";

type Model = "semi" | "cons" | "disp";
/** A strand as its share of heavy (old, ¹⁵N) DNA: 1 = all old, 0 = all new. */
type Mol = [number, number];

const HEAVY = "var(--bio-nucleus-deep)";
const LIGHT = "var(--bio-water)";
const MAX_GEN = 3;

function molecules(model: Model, gen: number): Mol[] {
  let mols: Mol[] = [[1, 1]];
  for (let g = 0; g < gen; g++) {
    const next: Mol[] = [];
    for (const [a, b] of mols) {
      if (model === "semi") next.push([a, 0], [b, 0]);
      else if (model === "cons") next.push([a, b], [0, 0]);
      else next.push([a / 2, b / 2], [a / 2, b / 2]);
    }
    mols = next;
  }
  return mols;
}

/** Where a molecule settles in the density gradient: 0 = light (top) … 1 = heavy (bottom). */
const density = ([a, b]: Mol) => (a + b) / 2;

function bands(mols: Mol[]) {
  const map = new Map<number, number>();
  for (const m of mols) {
    const d = Math.round(density(m) * 1000) / 1000;
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return [...map].map(([d, n]) => ({ d, share: n / mols.length }));
}

/** One strand: heavy and light pieces (dispersive strands are patchworks). */
function StrandBar({ heavy }: { heavy: number }) {
  const pieces = heavy === 1 || heavy === 0 ? 1 : Math.round(1 / heavy);
  return (
    <span className="flex h-2.5 w-full overflow-hidden rounded-full">
      {Array.from({ length: pieces }, (_, i) => (
        <span key={i} className="h-full flex-1" style={{ background: heavy === 1 ? HEAVY : heavy === 0 ? LIGHT : i === 0 ? HEAVY : LIGHT }} />
      ))}
    </span>
  );
}

function Tube({ title, items, accent }: { title: string; items: { d: number; share: number }[]; accent?: boolean }) {
  const y = (d: number) => 46 + d * 96;
  const gid = `tube-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 70 190" className="h-[176px] w-auto" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--bio-vacuole)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--bio-water)" stopOpacity={0.45} />
          </linearGradient>
        </defs>
        <path d="M14 10 L14 150 Q14 182 35 182 Q56 182 56 150 L56 10" fill={`url(#${gid})`} stroke={accent ? "var(--blob)" : "var(--ink-2)"} strokeWidth={2} />
        <line x1={9} y1={10} x2={61} y2={10} stroke={accent ? "var(--blob)" : "var(--ink-2)"} strokeWidth={2.5} strokeLinecap="round" />
        <AnimatePresence>
          {items.map((b) => (
            <motion.rect
              key={b.d}
              initial={{ opacity: 0, scaleX: 0.2, y: y(b.d) }}
              animate={{ opacity: 0.25 + 0.75 * b.share, scaleX: 1, y: y(b.d) }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
              x={17}
              y={0}
              width={36}
              height={7}
              rx={3.5}
              fill="var(--ink)"
              style={{ transformBox: "fill-box", transformOrigin: "center" }}
            />
          ))}
        </AnimatePresence>
      </svg>
      <figcaption className={cn("text-center text-[12px] leading-tight", accent ? "font-medium text-blob-ink" : "text-ink-3")}>{title}</figcaption>
    </figure>
  );
}

const NOTES: Record<Model, Text[]> = {
  semi: [
    tx("Start: bacteria grown for a long time on heavy nitrogen (¹⁵N). All DNA is heavy: one band at the bottom.", "Start: Bakterien, die lange mit schwerem Stickstoff (¹⁵N) gewachsen sind. Alle DNA ist schwer: eine Bande ganz unten."),
    tx("After one copy on light ¹⁴N: every molecule has one old strand and one new strand. All hybrid: one band in the middle.", "Nach einer Verdopplung auf leichtem ¹⁴N: Jedes Molekül hat einen alten und einen neuen Strang. Alles Hybrid-DNA: eine Bande in der Mitte."),
    tx("After two copies: half hybrid, half completely light. Two bands, middle and top.", "Nach zwei Verdopplungen: halb Hybrid-DNA, halb ganz leicht. Zwei Banden, Mitte und oben."),
    tx("After three copies: still only 2 hybrid molecules, now 6 light ones. The old strands are never lost.", "Nach drei Verdopplungen: weiterhin nur 2 Hybrid-Moleküle, dazu 6 leichte. Die alten Stränge gehen nie verloren."),
  ],
  cons: [
    tx("Start: all DNA is heavy (¹⁵N).", "Start: Alle DNA ist schwer (¹⁵N)."),
    tx("Conservative copying would keep the old double strand whole and make a completely new one: a heavy and a light band. Meselson and Stahl saw only ONE middle band. Model ruled out!", "Bei konservativer Verdopplung bliebe der alte Doppelstrang ganz und ein völlig neuer käme dazu: eine schwere und eine leichte Bande. Meselson und Stahl sahen aber nur EINE mittlere Bande. Modell widerlegt!"),
    tx("Still a heavy band here. It never appeared in the experiment.", "Hier gäbe es immer noch eine schwere Bande. Im Versuch tauchte sie nie auf."),
    tx("The heavy band would stay forever. Not what was measured.", "Die schwere Bande bliebe für immer. So wurde es nicht gemessen."),
  ],
  disp: [
    tx("Start: all DNA is heavy (¹⁵N).", "Start: Alle DNA ist schwer (¹⁵N)."),
    tx("Dispersive copying mixes old and new pieces in every strand. After one copy: one middle band. That still fits!", "Bei dispersiver Verdopplung stecken in jedem Strang alte und neue Stücke. Nach einer Verdopplung: eine mittlere Bande. Das passt noch!"),
    tx("After two copies all molecules would be a quarter heavy: ONE band between middle and top. Measured were TWO bands. Model ruled out!", "Nach zwei Verdopplungen wären alle Moleküle zu einem Viertel schwer: EINE Bande zwischen Mitte und oben. Gemessen wurden aber ZWEI Banden. Modell widerlegt!"),
    tx("The single band would just creep upwards. Not what was measured.", "Die eine Bande würde nur immer weiter nach oben wandern. So wurde es nicht gemessen."),
  ],
};

/** Semiconservative replication and the Meselson–Stahl experiment: step through generations and compare models. */
export function DnaReplication() {
  const t = useText();
  const [gen, setGen] = useState(0);
  const [model, setModel] = useState<Model>("semi");
  const mols = molecules(model, gen);
  const predicted = bands(mols);
  const measured = bands(molecules("semi", gen));
  const fits = JSON.stringify(predicted.map((b) => b.d).sort()) === JSON.stringify(measured.map((b) => b.d).sort());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Model>
          value={model}
          onChange={setModel}
          label={t(tx("Model of replication", "Modell der Replikation"))}
          options={[
            { id: "semi", label: t(tx("semiconservative", "semikonservativ")) },
            { id: "cons", label: t(tx("conservative", "konservativ")) },
            { id: "disp", label: t(tx("dispersive", "dispersiv")) },
          ]}
        />
        <div className="flex items-center gap-2">
          <StepButton onClick={() => setGen(Math.max(0, gen - 1))} disabled={gen === 0} label={t(tx("Previous generation", "Vorige Generation"))}>
            <ChevronLeft className="size-4" />
          </StepButton>
          <span className="min-w-[96px] text-center text-[14px] font-medium tabular-nums text-ink">{t(tx(`Generation ${gen}`, `Generation ${gen}`))}</span>
          <StepButton primary onClick={() => setGen(Math.min(MAX_GEN, gen + 1))} disabled={gen === MAX_GEN} label={t(tx("Copy once more on ¹⁴N", "Noch einmal auf ¹⁴N verdoppeln"))}>
            {t(tx("Copy", "Verdoppeln"))} <ChevronRight className="size-4" />
          </StepButton>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="min-h-[150px] rounded-xl border border-line bg-surface p-3">
          <motion.div layout className="grid grid-cols-4 gap-x-3 gap-y-4">
            <AnimatePresence mode="popLayout">
              {mols.map((m, i) => (
                <motion.div
                  key={`${model}-${gen}-${i}`}
                  layout
                  initial={{ opacity: 0, scale: 0.6, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.04 * i }}
                  className="flex flex-col gap-1.5"
                  aria-label={t(tx(`Molecule ${i + 1}`, `Molekül ${i + 1}`))}
                >
                  <StrandBar heavy={m[0]} />
                  <StrandBar heavy={m[1]} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full" style={{ background: HEAVY }} /> {t(tx("old strand (heavy, ¹⁵N)", "alter Strang (schwer, ¹⁵N)"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-5 rounded-full" style={{ background: LIGHT }} /> {t(tx("new strand (light, ¹⁴N)", "neuer Strang (leicht, ¹⁴N)"))}
            </span>
          </div>
        </div>
        <div className="flex items-start justify-center gap-4">
          <Tube title={t(tx("model predicts", "Modell sagt vorher"))} items={predicted} />
          <Tube title={t(tx("measured", "gemessen"))} items={measured} accent />
          <div className="flex h-[176px] flex-col justify-between py-[34px] text-[11.5px] leading-none text-ink-3">
            <span>{t(tx("light", "leicht"))}</span>
            <span>{t(tx("hybrid", "mittel"))}</span>
            <span>{t(tx("heavy", "schwer"))}</span>
          </div>
        </div>
      </div>

      <motion.p
        key={`${model}-${gen}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("rounded-xl border px-3.5 py-2.5 text-[14px] leading-snug", fits ? "border-line bg-surface text-ink" : "border-danger/40 bg-danger/5 text-ink")}
        aria-live="polite"
      >
        {t(NOTES[model][gen])}
      </motion.p>
    </div>
  );
}
