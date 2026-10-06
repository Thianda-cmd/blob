"use client";

// The specific immune response as a stepper: viruses invade, a macrophage eats one and presents
// its antigens, a matching T helper cell recognises them and gets activated, it activates the
// B cell that has bound the same antigen, the B cell divides into plasma cells and memory cells,
// antibodies clump the viruses, T killer cells destroy an infected body cell, and the memory
// cells stay. Every cell type has its own colour (see ImmuneCells).

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import {
  Antibody,
  BCell,
  BODY_WOBBLE,
  BodyCell,
  blobRadius,
  bumpPath,
  CELL_NAMES,
  CellIcon,
  clump,
  cupHeight,
  Macrophage,
  MACRO_WOBBLE,
  MemoryCell,
  PAINT,
  PlasmaCell,
  THelper,
  TKiller,
  VirusParticle,
  type CellKind,
} from "./ImmuneCells";

const RP = 13;
const S = 3.4;
const SHAPE = "tri" as const;
const DOCK_ANGLES = [180, -120, -60, 0, 60, 120];

const CLUMP = clump(
  [
    { a: 0, b: 1, beta: 10, side: 1 },
    { a: 1, b: 2, beta: -35, side: -1 },
    { a: 1, b: 3, beta: 70, side: -1 },
  ],
  RP,
  S,
  [175, 74],
);
const FREE: [number, number][] = [
  [52, 40],
  [140, 26],
  [250, 36],
  [86, 108],
];

const MAC: [number, number] = [170, 210];
const MAC_R = 40;
const BODY: [number, number] = [86, 306];
const BODY_R = 36;
const B: [number, number] = [432, 96];
const TK_REST: [number, number] = [452, 304];
const TH_REST: [number, number] = [334, 226];
/** Where a T cell sits when its receptor binds an antigen on the right edge of a cell. */
const dockX = (cx: number, edge: number) => cx + edge + 20 + 4 + cupHeight(S);
const TH_DOCK: [number, number] = [dockX(MAC[0], blobRadius(MAC_R, MACRO_WOBBLE, 0)), MAC[1]];
const TK_DOCK: [number, number] = [dockX(BODY[0], blobRadius(BODY_R, BODY_WOBBLE, 0)), BODY[1]];
const VB: [number, number] = [B[0] + 49 * Math.cos((-120 * Math.PI) / 180), B[1] + 49 * Math.sin((-120 * Math.PI) / 180)];
const PLASMA: [number, number][] = [
  [528, 58],
  [586, 124],
  [516, 166],
];
const MEM_B: [number, number] = [592, 222];
const MEM_T: [number, number] = [592, 296];
const EXTRA_AB: [number, number, number][] = [
  [470, 40, -30],
  [468, 140, 40],
  [560, 180, 110],
];

type Step = { name: Text; text: Text; cells: CellKind[] };

const STEPS: Step[] = [
  { name: tx("Invasion", "Eindringen"), text: tx("Viruses get into the body. Some enter body cells and multiply inside them.", "Viren gelangen in den Körper. Einige dringen in Körperzellen ein und vermehren sich darin."), cells: ["virus", "body"] },
  { name: tx("Macrophage", "Makrophage"), text: tx("Macrophages eat viruses (phagocytosis) and display fragments of them, the antigens, on their surface.", "Makrophagen fressen Viren (Phagocytose) und präsentieren Bruchstücke davon, die Antigene, auf ihrer Oberfläche."), cells: ["macro"] },
  { name: tx("T helper cell", "T-Helferzelle"), text: tx("A T helper cell whose receptor fits exactly this antigen recognises it on the macrophage. It is activated and multiplies.", "Eine T-Helferzelle, deren Rezeptor genau zu diesem Antigen passt, erkennt es auf der Makrophage. Sie wird aktiviert und vermehrt sich."), cells: ["macro", "th"] },
  { name: tx("B cell", "B-Zelle"), text: tx("A B cell with a matching receptor has bound the antigen. The T helper cell activates it with messenger substances.", "Eine B-Zelle mit passendem Rezeptor hat das Antigen gebunden. Die T-Helferzelle aktiviert sie mit Botenstoffen."), cells: ["th", "b", "virus"] },
  { name: tx("Division", "Teilung"), text: tx("The B cell divides many times. Plasma cells and memory cells are formed.", "Die B-Zelle teilt sich vielfach. Es entstehen Plasmazellen und Gedächtniszellen."), cells: ["plasma", "mem"] },
  { name: tx("Antibodies", "Antikörper"), text: tx("Plasma cells release huge amounts of antibodies. They bind the viruses and clump them together (antigen-antibody reaction).", "Plasmazellen geben große Mengen Antikörper ab. Diese binden die Viren und verklumpen sie (Antigen-Antikörper-Reaktion)."), cells: ["plasma", "ab", "virus"] },
  { name: tx("T killer cell", "T-Killerzelle"), text: tx("The T helper cell also activates T killer cells. They recognise infected body cells by the virus antigens on their surface and kill them, and with them the virus factories.", "Die T-Helferzelle aktiviert auch T-Killerzellen. Sie erkennen befallene Körperzellen an den Virus-Antigenen auf ihrer Oberfläche und töten sie, und damit die Virusfabriken."), cells: ["th", "tk", "body"] },
  { name: tx("Memory", "Gedächtnis"), text: tx("Phagocytes clear away the clumps. The plasma cells die, but the memory cells remain, often for years.", "Fresszellen beseitigen die Klumpen. Die Plasmazellen sterben ab, aber die Gedächtniszellen bleiben, oft jahrelang."), cells: ["macro", "mem"] },
];

const spring = { type: "spring" as const, stiffness: 60, damping: 15 };

/** Little dots travelling from one cell to another (messenger substances). */
function Signal({ from, to, show, delay = 0 }: { from: [number, number]; to: [number, number]; show: boolean; delay?: number }) {
  if (!show) return null;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <motion.circle
          key={i}
          r={3.2}
          fill="var(--blob)"
          initial={{ cx: from[0], cy: from[1], opacity: 0 }}
          animate={{ cx: [from[0], to[0]], cy: [from[1], to[1]], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.3, delay: delay + i * 0.25, repeat: 2, repeatDelay: 0.4 }}
        />
      ))}
    </>
  );
}

export function ImmuneResponse() {
  const t = useText();
  const [s, setS] = useState(0);
  const dim = (kind: CellKind) => (STEPS[s].cells.includes(kind) ? 1 : 0.5);
  const at = (p: [number, number]) => ({ x: p[0], y: p[1] });
  const clumped = s >= 5;
  const eaten = s >= 7;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-1.5 sm:p-3">
        <svg viewBox="0 0 640 360" className="mx-auto block h-auto w-full max-w-[660px]" role="img" aria-label={t(tx("Course of an immune response", "Ablauf einer Immunreaktion"))}>
          {/* body cell, infected */}
          <motion.g initial={at(BODY)} animate={{ ...at(BODY), opacity: s >= 7 ? 0 : s === 6 ? 1 : dim("body"), scale: s === 6 ? [1, 1, 0.85] : 1 }} transition={{ duration: s === 6 ? 2.6 : 0.5, times: s === 6 ? [0, 0.6, 1] : undefined }}>
            <BodyCell r={BODY_R} infected dying={s >= 6} />
            {s >= 6 && <path d={bumpPath(SHAPE, S)} transform={`rotate(90) translate(0 ${-blobRadius(BODY_R, BODY_WOBBLE, 0)})`} fill={PAINT.virus.stroke} />}
          </motion.g>

          {/* macrophage with presented antigen */}
          <motion.g initial={at(MAC)} animate={{ ...at(MAC), opacity: dim("macro") }}>
            <Macrophage r={MAC_R} glow={s === 1 || s === 7} />
            <motion.path d={bumpPath(SHAPE, S)} transform={`rotate(90) translate(0 ${-blobRadius(MAC_R, MACRO_WOBBLE, 0)})`} fill={PAINT.virus.stroke} initial={{ opacity: 0 }} animate={{ opacity: s >= 1 ? 1 : 0 }} transition={{ delay: s === 1 ? 1 : 0 }} />
          </motion.g>

          {/* viruses: the clump group, one eaten by the macrophage, one bound by the B cell, one infecting */}
          {CLUMP.pathogens.map((v, i) => (
            <motion.g
              key={`c${i}`}
              initial={{ x: -40, y: -40 }}
              animate={eaten ? { x: MAC[0], y: MAC[1], opacity: 0, scale: 0.5 } : clumped ? { x: v.x, y: v.y, opacity: 1, scale: 1 } : { x: FREE[i][0], y: FREE[i][1], opacity: dim("virus"), scale: 1 }}
              transition={{ ...spring, delay: clumped && !eaten ? 0.8 : 0 }}
            >
              <VirusParticle r={RP} s={S} shape={SHAPE} angles={v.angles} />
            </motion.g>
          ))}
          <motion.g initial={{ x: -40, y: 80 }} animate={s >= 1 ? { x: MAC[0] + 6, y: MAC[1] - 4, opacity: 0, scale: 0.6 } : { x: 238, y: 132, opacity: 1, scale: 1 }} transition={spring}>
            <VirusParticle r={RP} s={S} shape={SHAPE} />
          </motion.g>
          <motion.g initial={{ x: 300, y: -40 }} animate={s >= 4 ? { x: VB[0], y: VB[1], opacity: 0 } : s >= 3 ? { ...at(VB), opacity: 1 } : { x: 330, y: 44, opacity: dim("virus") }} transition={spring}>
            <VirusParticle r={RP} s={S} shape={SHAPE} />
          </motion.g>
          <motion.g initial={{ x: -40, y: 220 }} animate={{ x: BODY[0] + 4, y: BODY[1] - 6, opacity: 0, scale: 0.5 }} transition={{ duration: 1.6 }}>
            <VirusParticle r={RP} s={S} shape={SHAPE} />
          </motion.g>

          {/* B cell, plasma cells, memory cells */}
          <motion.g initial={at(B)} animate={{ ...at(B), opacity: s >= 4 ? 0 : dim("b"), scale: s >= 4 ? 0.6 : 1 }} transition={{ duration: 0.6 }}>
            <BCell r={20} shape={SHAPE} s={S} angles={DOCK_ANGLES} glow={s === 3} />
          </motion.g>
          {PLASMA.map((p, i) => (
            <motion.g key={`p${i}`} initial={{ ...at(B), opacity: 0, scale: 0.4 }} animate={s >= 4 ? { ...at(p), opacity: s >= 7 ? 0.3 : dim("plasma"), scale: 1 } : { ...at(B), opacity: 0, scale: 0.4 }} transition={{ ...spring, delay: s === 4 ? 0.2 + i * 0.25 : 0 }}>
              <PlasmaCell r={21} glow={s === 4 || s === 5} />
            </motion.g>
          ))}
          <motion.g initial={{ ...at(B), opacity: 0, scale: 0.4 }} animate={s >= 4 ? { ...at(MEM_B), opacity: dim("mem"), scale: 1 } : { ...at(B), opacity: 0, scale: 0.4 }} transition={{ ...spring, delay: s === 4 ? 1 : 0 }}>
            <MemoryCell r={15} shape={SHAPE} kind="b" glow={s === 4 || s === 7} />
          </motion.g>

          {/* antibodies */}
          {CLUMP.antibodies.map((a, i) => (
            <motion.g
              key={`a${i}`}
              initial={{ x: PLASMA[i][0], y: PLASMA[i][1], opacity: 0, rotate: 0 }}
              animate={eaten ? { x: MAC[0], y: MAC[1], opacity: 0, rotate: a.rot } : clumped ? { x: a.x, y: a.y, opacity: 1, rotate: a.rot } : { x: PLASMA[i][0], y: PLASMA[i][1], opacity: 0, rotate: 0 }}
              transition={{ ...spring, delay: clumped && !eaten ? 0.3 + i * 0.15 : 0 }}
            >
              <Antibody shape={SHAPE} s={S} width={2.8} />
            </motion.g>
          ))}
          {EXTRA_AB.map(([x, y, r], i) => (
            <motion.g key={`x${i}`} initial={{ x: PLASMA[i][0], y: PLASMA[i][1], opacity: 0 }} animate={s >= 5 && !eaten ? { x, y, opacity: 0.9, rotate: r } : { x: PLASMA[i][0], y: PLASMA[i][1], opacity: 0, rotate: 0 }} transition={{ ...spring, delay: s === 5 ? 0.5 + i * 0.2 : 0 }}>
              <Antibody shape={SHAPE} s={S} width={2.8} />
            </motion.g>
          ))}

          {/* T helper cells */}
          <motion.g initial={at(TH_REST)} animate={{ ...at(s >= 2 ? TH_DOCK : TH_REST), opacity: s === 6 ? 1 : dim("th") }} transition={spring}>
            <THelper r={20} shape={SHAPE} s={S} angles={DOCK_ANGLES} glow={s >= 2 && s <= 3} />
          </motion.g>
          <motion.g
            initial={{ ...at(TH_REST), opacity: 0 }}
            animate={s >= 3 ? { x: B[0] - 36, y: B[1] + 54, opacity: dim("th"), scale: 1 } : s === 2 ? { x: TH_DOCK[0] + 18, y: TH_DOCK[1] + 46, opacity: 1, scale: 1 } : { ...at(TH_REST), opacity: 0, scale: 0.5 }}
            transition={{ ...spring, delay: s === 2 ? 1.2 : 0 }}
          >
            <THelper r={20} shape={SHAPE} s={S} angles={DOCK_ANGLES} glow={s === 3} />
          </motion.g>

          {/* T killer cell */}
          <motion.g initial={at(TK_REST)} animate={{ ...at(s >= 6 ? TK_DOCK : TK_REST), opacity: s === 7 ? 0.45 : dim("tk") }} transition={{ ...spring, delay: s === 6 ? 1.4 : 0 }}>
            <TKiller r={20} shape={SHAPE} s={S} angles={DOCK_ANGLES} glow={s === 6} />
          </motion.g>
          <motion.g initial={{ ...at(TK_REST), opacity: 0 }} animate={s >= 7 ? { ...at(MEM_T), opacity: 1, scale: 1 } : { ...at(TK_REST), opacity: 0, scale: 0.4 }} transition={spring}>
            <MemoryCell r={15} shape={SHAPE} kind="t" glow={s === 7} />
          </motion.g>

          <Signal key={`s3-${s}`} show={s === 3} from={[B[0] - 36, B[1] + 54]} to={B} delay={0.8} />
          <Signal key={`s6-${s}`} show={s === 6} from={TH_DOCK} to={TK_REST} />
          {s === 6 &&
            [0, 1, 2, 3].map((i) => (
              <motion.circle key={`perf${i}`} r={2.4} fill={PAINT.tk.stroke} initial={{ cx: TK_DOCK[0] - 22, cy: TK_DOCK[1] - 8 + i * 6, opacity: 0 }} animate={{ cx: BODY[0] + 26, opacity: [0, 1, 0] }} transition={{ duration: 0.9, delay: 2.4 + i * 0.12 }} />
            ))}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 px-1">
        {(["virus", "macro", "th", "b", "plasma", "ab", "mem", "tk", "body"] as CellKind[]).map((k) => (
          <span key={k} className={cn("flex items-center gap-1.5 text-[12.5px] transition-opacity", STEPS[s].cells.includes(k) ? "font-semibold text-ink" : "text-ink-3 opacity-70")}>
            <CellIcon kind={k} size={20} /> {t(CELL_NAMES[k])}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setS(Math.max(0, s - 1))} disabled={s === 0} className="grid size-10 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40" aria-label={t(tx("Back", "Zurück"))}>
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex min-w-0 flex-1 justify-center gap-1.5">
          {STEPS.map((st, i) => (
            <button key={i} type="button" onClick={() => setS(i)} className="group grid h-8 min-w-6 place-items-center" aria-label={`${i + 1}. ${t(st.name)}`}>
              <span className={cn("block h-2 rounded-full transition-all", i === s ? "w-6 bg-blob" : i < s ? "w-2 bg-ink-3" : "w-2 bg-line group-hover:bg-ink-3")} />
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setS(Math.min(STEPS.length - 1, s + 1))} disabled={s === STEPS.length - 1} className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink text-paper disabled:opacity-40" aria-label={t(tx("Next step", "Nächster Schritt"))}>
          <ChevronRight className="size-5" />
        </button>
      </div>

      <motion.p key={s} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">
          {s + 1}. {t(STEPS[s].name)}:{" "}
        </span>
        {t(STEPS[s].text)}
      </motion.p>
    </div>
  );
}
