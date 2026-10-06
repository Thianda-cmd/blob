"use client";

// Antigen presentation on MHC molecules. MHC class I: every nucleated body cell shows peptides
// of the proteins it makes; a T killer cell (CD8) docks onto a viral peptide and kills the cell.
// A healthy cell's own peptides don't fit. MHC class II: an antigen-presenting cell (macrophage)
// shows fragments of an eaten pathogen; a T helper cell (CD4) docks, interleukins activate it.

import { motion } from "motion/react";
import { Link2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { BODY_WOBBLE, BodyCell, blobRadius, bumpPath, cupHeight, Macrophage, MACRO_WOBBLE, PAINT, THelper, TKiller, type Epitope } from "./ImmuneCells";

const C: [number, number] = [160, 150];
const R = 90;
const TR = 32;
const S = 5;
const MHC_ANGLES = [-38, 0, 38];
const TCELL_ANGLES = [180, -130, -60, 0, 60, 130];
const MHC1 = "var(--bio-c)";
const MHC2 = "var(--bio-u)";

/** An MHC molecule on a surface (angle in degrees) holding a peptide between its two prongs. */
function Mhc({ angle, edge, color, peptide, peptideColor }: { angle: number; edge: number; color: string; peptide: Epitope; peptideColor: string }) {
  return (
    <g transform={`rotate(${angle + 90}) translate(0 ${-edge})`}>
      <path d="M -12 1 L -12 -10 M 12 1 L 12 -10 M -12 0 L 12 0" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <path d={bumpPath(peptide, S)} transform="translate(0 -2)" fill={peptideColor} />
    </g>
  );
}

/** The co-receptor (CD4 or CD8) next to the T cell receptor. */
function CoReceptor({ r, angle, color }: { r: number; angle: number; color: string }) {
  return (
    <g transform={`rotate(${angle - 90})`}>
      <line x1={0} y1={r - 1} x2={0} y2={r + 9} stroke={color} strokeWidth={2.4} />
      <circle cx={0} cy={r + 12} r={3.6} fill={color} />
    </g>
  );
}

export function ImmuneMHC() {
  const t = useText();
  const [mode, setMode] = useState<"I" | "II">("I");
  const [healthy, setHealthy] = useState(false);
  const [docked, setDocked] = useState(false);
  const one = mode === "I";
  const edge = one ? blobRadius(R, BODY_WOBBLE, 0) : blobRadius(R, MACRO_WOBBLE, 0);
  const peptide: Epitope = one ? (healthy ? "round" : "tri") : "square";
  const pepColor = one ? (healthy ? PAINT.body.stroke : PAINT.virus.stroke) : PAINT.bact.stroke;
  const tcrShape: Epitope = one ? "tri" : "square";
  const fits = !one || !healthy;
  const dockX = C[0] + edge + 2 + TR + 4 + cupHeight(S);
  const rest = 470;
  const killed = one && docked && fits;

  const text: Text = one
    ? !docked
      ? tx(
          "MHC class I molecules sit on all nucleated body cells. They display fragments (peptides) of the proteins the cell is making. In a cell infected by viruses, viral peptides are among them.",
          "MHC-I-Moleküle sitzen auf allen kernhaltigen Körperzellen. Sie präsentieren Bruchstücke (Peptide) der Proteine, die die Zelle gerade herstellt. Ist die Zelle von Viren befallen, sind auch Virus-Peptide dabei.",
        )
      : healthy
        ? tx(
            "The cell's own peptides don't fit the T cell receptor: the T killer cell leaves the healthy cell alone. T cells that would react to self were sorted out in the thymus.",
            "Körpereigene Peptide passen nicht zum T-Zell-Rezeptor: Die T-Killerzelle lässt die gesunde Zelle in Ruhe. T-Zellen, die auf Eigenes reagieren würden, wurden im Thymus aussortiert.",
          )
        : tx(
            "The receptor of a T killer cell fits the viral peptide in MHC I; its co-receptor CD8 binds to MHC I. The T killer cell releases perforin: pores form and the cell dies (apoptosis), together with the viruses inside.",
            "Der Rezeptor einer T-Killerzelle passt zum Virus-Peptid im MHC-I, ihr Corezeptor CD8 bindet an das MHC-I. Die T-Killerzelle schüttet Perforin aus: Poren entstehen, und die Zelle stirbt (Apoptose), mitsamt den Viren darin.",
          )
    : !docked
      ? tx(
          "Only antigen-presenting cells carry MHC class II: macrophages, dendritic cells and B cells. They show fragments of pathogens that they took up and digested.",
          "MHC-II-Moleküle tragen nur antigenpräsentierende Zellen: Makrophagen, dendritische Zellen und B-Zellen. Sie zeigen Bruchstücke von Erregern, die sie aufgenommen und verdaut haben.",
        )
      : tx(
          "A T helper cell with a matching receptor binds (co-receptor CD4). The macrophage releases interleukin 1, the T helper cell is activated, divides and releases interleukin 2, which activates B cells and T killer cells.",
          "Eine T-Helferzelle mit passendem Rezeptor bindet (Corezeptor CD4). Die Makrophage schüttet Interleukin-1 aus, die T-Helferzelle wird aktiviert, teilt sich und schüttet Interleukin-2 aus. Das aktiviert B-Zellen und T-Killerzellen.",
        );

  const choose = (m: "I" | "II") => {
    setMode(m);
    setDocked(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-line p-0.5">
          {(["I", "II"] as const).map((m) => (
            <button key={m} type="button" onClick={() => choose(m)} className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", mode === m ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {mode === m && <motion.span layoutId="immune-mhc-mode" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{m === "I" ? t(tx("MHC I: body cell", "MHC-I: Körperzelle")) : t(tx("MHC II: macrophage", "MHC-II: Makrophage"))}</span>
            </button>
          ))}
        </div>
        {one && (
          <div className="flex rounded-lg border border-line p-0.5">
            {[false, true].map((h) => (
              <button
                key={String(h)}
                type="button"
                onClick={() => {
                  setHealthy(h);
                  setDocked(false);
                }}
                className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", healthy === h ? "text-ink" : "text-ink-3 hover:text-ink")}
              >
                {healthy === h && <motion.span layoutId="immune-mhc-health" className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                <span className="relative">{h ? t(tx("healthy", "gesund")) : t(tx("infected", "infiziert"))}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 600 300" className="mx-auto block h-auto w-full max-w-[620px]" role="img" aria-label={t(tx("Antigen presentation on MHC", "Antigenpräsentation über MHC"))}>
          <motion.g key={`${mode}-${healthy}`} initial={{ x: C[0], y: C[1], opacity: 0 }} animate={{ x: C[0], y: C[1], opacity: killed ? 0.45 : 1, scale: killed ? 0.9 : 1 }} transition={{ duration: killed ? 1.2 : 0.4, delay: killed ? 1.8 : 0 }}>
            {one ? (
              <BodyCell r={R} infected={!healthy} dying={killed} />
            ) : (
              <Macrophage r={R}>
                <circle cx={-6} cy={-34} r={20} fill="var(--bio-mito-deep)" fillOpacity={0.25} stroke={PAINT.macro.stroke} strokeWidth={1.6} />
                {[
                  [-12, -38],
                  [0, -30],
                  [-4, -42],
                ].map(([x, y], i) => (
                  <path key={i} d={bumpPath("square", 4)} transform={`translate(${x} ${y}) rotate(${i * 50})`} fill={PAINT.bact.stroke} />
                ))}
              </Macrophage>
            )}
            {MHC_ANGLES.map((a) => (
              <Mhc key={a} angle={a} edge={one ? blobRadius(R, BODY_WOBBLE, (a * Math.PI) / 180) : blobRadius(R, MACRO_WOBBLE, (a * Math.PI) / 180)} color={one ? MHC1 : MHC2} peptide={peptide} peptideColor={pepColor} />
            ))}
          </motion.g>

          {/* the T cell */}
          <motion.g
            key={`t-${mode}`}
            initial={{ x: rest, y: C[1] }}
            animate={docked ? (fits ? { x: dockX, y: C[1] } : { x: [rest, dockX + 26, rest], y: C[1] }) : { x: rest, y: C[1] }}
            transition={docked && !fits ? { duration: 2.2, times: [0, 0.5, 1] } : { type: "spring", stiffness: 60, damping: 15 }}
          >
            <CoReceptor r={TR} angle={156} color={one ? PAINT.tk.stroke : PAINT.th.stroke} />
            {one ? <TKiller r={TR} shape={tcrShape} s={S} angles={TCELL_ANGLES} glow={docked && fits} /> : <THelper r={TR} shape={tcrShape} s={S} angles={TCELL_ANGLES} glow={docked} />}
          </motion.g>
          {!one && (
            <motion.g initial={{ x: dockX, y: C[1], opacity: 0, scale: 0.5 }} animate={docked ? { x: dockX + 70, y: C[1] + 82, opacity: 1, scale: 0.9 } : { x: dockX, y: C[1], opacity: 0, scale: 0.5 }} transition={{ type: "spring", stiffness: 60, damping: 15, delay: docked ? 2.6 : 0 }}>
              <THelper r={TR} shape={tcrShape} s={S} angles={TCELL_ANGLES} />
            </motion.g>
          )}

          {/* perforin, interleukins */}
          {killed &&
            [0, 1, 2, 3, 4].map((i) => (
              <motion.circle key={`pf${i}`} r={3} fill={PAINT.tk.stroke} initial={{ cx: dockX - TR, cy: C[1] - 16 + i * 8, opacity: 0 }} animate={{ cx: C[0] + edge - 14, opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: 1 + i * 0.12 }} />
            ))}
          {!one &&
            docked &&
            [0, 1, 2].map((i) => (
              <motion.circle key={`il1-${i}`} r={3.4} fill={PAINT.macro.stroke} initial={{ cx: C[0] + edge - 6, cy: C[1] - 40 + i * 10, opacity: 0 }} animate={{ cx: dockX - 10, cy: C[1] - 30 + i * 6, opacity: [0, 1, 0] }} transition={{ duration: 1.1, delay: 0.9 + i * 0.2 }} />
            ))}
          {!one &&
            docked &&
            [0, 1, 2, 3].map((i) => (
              <motion.circle key={`il2-${i}`} r={3.4} fill="var(--blob)" initial={{ cx: dockX + 20, cy: C[1] - 20, opacity: 0 }} animate={{ cx: 590, cy: C[1] - 90 + i * 16, opacity: [0, 1, 1, 0] }} transition={{ duration: 1.4, delay: 2 + i * 0.18, repeat: 1, repeatDelay: 0.3 }} />
            ))}
        </svg>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pb-1 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: one ? MHC1 : MHC2 }} /> {one ? t(tx("MHC I", "MHC-I")) : t(tx("MHC II", "MHC-II"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm" style={{ background: pepColor }} /> {one ? (healthy ? t(tx("own peptide", "körpereigenes Peptid")) : t(tx("viral peptide", "Virus-Peptid"))) : t(tx("bacterial peptide", "Bakterien-Peptid"))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full" style={{ background: one ? PAINT.tk.stroke : PAINT.th.stroke }} /> {one ? t(tx("T killer cell with CD8", "T-Killerzelle mit CD8")) : t(tx("T helper cell with CD4", "T-Helferzelle mit CD4"))}
          </span>
          {!one && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blob" /> {t(tx("interleukins", "Interleukine"))}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => setDocked(true)} disabled={docked} className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper disabled:opacity-50">
          <Link2 className="size-4" /> {one ? t(tx("Send a T killer cell", "T-Killerzelle schicken")) : t(tx("Send a T helper cell", "T-Helferzelle schicken"))}
        </motion.button>
        <button type="button" onClick={() => setDocked(false)} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Start again", "Neu starten"))}>
          <RotateCcw className="size-4" />
        </button>
      </div>

      <motion.p key={`${mode}-${healthy}-${docked}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        {t(text)}
      </motion.p>
    </div>
  );
}
