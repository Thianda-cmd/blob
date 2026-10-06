"use client";

// Level 3: the light-dependent reactions on the thylakoid membrane. Photosystem II (P680) with
// water splitting, plastoquinone, the cytochrome b6f complex, plastocyanin, photosystem I (P700),
// ferredoxin, NADP+ reductase and ATP synthase. The widget steps through the electron's way with
// moving electrons, protons, O2, NADPH and ATP, and shows the same step on the Z-scheme.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { PhotoH2O, PhotoIon, PhotoO2, PhotoPill } from "./PhotoMolecules";

const OUT = "var(--bio-outline)";
const W = 600;
const H = 360;
const MT = 126; // membrane top
const MB = 190; // membrane bottom

export const THYLAKOID_PARTS: FigurePart[] = [
  { id: "ps2", label: tx("photosystem II (P680)", "Fotosystem II (P680)"), at: [104, 136], info: tx("Its reaction centre P680 is excited by light and passes electrons on. On its lumen side water is split.", "Sein Reaktionszentrum P680 wird durch Licht angeregt und gibt Elektronen weiter. An seiner Lumenseite wird Wasser gespalten.") },
  { id: "pq", label: tx("plastoquinone (PQ)", "Plastochinon (PQ)"), at: [182, 160], tag: [182, 92], info: tx("A mobile carrier in the membrane. It takes up electrons and protons from the stroma.", "Ein beweglicher Überträger in der Membran. Er nimmt Elektronen und Protonen aus dem Stroma auf.") },
  { id: "b6f", label: tx("cytochrome b₆f complex", "Cytochrom-b₆f-Komplex"), at: [250, 136], info: tx("Passes electrons on to plastocyanin and pumps protons into the lumen.", "Gibt Elektronen an Plastocyanin weiter und pumpt dabei Protonen ins Lumen.") },
  { id: "pc", label: tx("plastocyanin (PC)", "Plastocyanin (PC)"), at: [316, 228], tag: [316, 292], info: tx("A small copper protein in the lumen. It carries electrons to photosystem I.", "Ein kleines Kupferprotein im Lumen. Es bringt Elektronen zum Fotosystem I.") },
  { id: "ps1", label: tx("photosystem I (P700)", "Fotosystem I (P700)"), at: [380, 136], info: tx("Light excites P700 a second time; the electron goes on to ferredoxin.", "Licht regt P700 ein zweites Mal an; das Elektron geht weiter zum Ferredoxin.") },
  { id: "fd", label: tx("ferredoxin (Fd)", "Ferredoxin (Fd)"), at: [452, 96], tag: [430, 40], info: tx("Carries electrons on the stroma side to the NADP⁺ reductase.", "Bringt die Elektronen auf der Stromaseite zur NADP⁺-Reduktase.") },
  { id: "fnr", label: tx("NADP⁺ reductase", "NADP⁺-Reduktase"), at: [496, 107], tag: [490, 40], info: tx("Reduces NADP⁺ to NADPH with two electrons and a proton.", "Reduziert NADP⁺ mit zwei Elektronen und einem Proton zu NADPH.") },
  { id: "atp", label: tx("ATP synthase", "ATP-Synthase"), at: [557, 62], info: tx("Protons flow through it from the lumen into the stroma. This drives the making of ATP (chemiosmosis).", "Protonen strömen hindurch, vom Lumen ins Stroma. Das treibt die ATP-Bildung an (Chemiosmose).") },
  { id: "lumen", label: tx("thylakoid lumen", "Thylakoidinnenraum (Lumen)"), at: [430, 300], info: tx("High proton concentration in the light (pH about 5).", "Im Licht hohe Protonenkonzentration (pH etwa 5).") },
  { id: "stroma", label: tx("stroma", "Stroma"), at: [300, 40], info: tx("Low proton concentration (pH about 8). The Calvin cycle runs here.", "Niedrige Protonenkonzentration (pH etwa 8). Hier läuft der Calvin-Zyklus.") },
];

function Label({ x, y, children, size = 13, weight = 700 }: { x: number; y: number; children: ReactNode; size?: number; weight?: number }) {
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size} fontWeight={weight} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
      {children}
    </text>
  );
}

/** The membrane with its complexes. `labels`: short names inside the complexes (not in tasks). */
function Membrane({ labels, lit = [], spin }: { labels: boolean; lit?: string[]; spin?: boolean }) {
  const t = useText();
  const reduce = useReducedMotion();
  const glow = (id: string) => (lit.includes(id) ? { filter: "drop-shadow(0 0 4px var(--blob)) drop-shadow(0 0 1px var(--blob))" } : undefined);
  return (
    <g>
      <g data-part="stroma">
        <rect x={0} y={0} width={W} height={MT} fill="var(--bio-leaf)" opacity={0.14} />
      </g>
      <g data-part="lumen">
        <rect x={0} y={MB} width={W} height={H - MB} fill="var(--bio-vacuole)" opacity={0.6} />
      </g>
      {labels && (
        <g>
          <text x={10} y={18} fontSize={12.5} fontWeight={700} className="fill-ink-2">
            {t(tx("Stroma · pH ≈ 8", "Stroma · pH ≈ 8"))}
          </text>
          <text x={10} y={H - 10} fontSize={12.5} fontWeight={700} className="fill-ink-2">
            {t(tx("Thylakoid lumen · pH ≈ 5", "Thylakoidinnenraum · pH ≈ 5"))}
          </text>
        </g>
      )}
      {/* lipid bilayer */}
      <rect x={0} y={MT} width={W} height={MB - MT} fill="var(--bio-membrane)" opacity={0.18} />
      {Array.from({ length: 71 }, (_, i) => (
        <g key={i} stroke="var(--bio-membrane)" strokeWidth={1.1}>
          <line x1={i * 8.5 + 4} x2={i * 8.5 + 3} y1={MT + 6} y2={MT + 26} />
          <line x1={i * 8.5 + 4} x2={i * 8.5 + 5} y1={MB - 6} y2={MB - 26} />
          <circle cx={i * 8.5 + 4} cy={MT + 4} r={3.8} fill="var(--bio-membrane)" stroke="none" />
          <circle cx={i * 8.5 + 4} cy={MB - 4} r={3.8} fill="var(--bio-membrane)" stroke="none" />
        </g>
      ))}

      <g data-part="ps2" style={glow("ps2")}>
        <ellipse cx={52} cy={158} rx={15} ry={34} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
        <ellipse cx={40} cy={158} rx={9} ry={24} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <rect x={68} y={106} width={72} height={106} rx={16} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
        <circle cx={104} cy={216} r={10} fill="var(--bio-nucleus)" stroke={OUT} strokeWidth={1.3} />
        {labels && (
          <>
            <Label x={104} y={146}>PS II</Label>
            <Label x={104} y={168} size={11} weight={600}>P680</Label>
          </>
        )}
      </g>
      <g data-part="pq" style={glow("pq")}>
        <ellipse cx={182} cy={160} rx={19} ry={12} fill="var(--bio-bone)" stroke={OUT} strokeWidth={1.4} />
        {labels && <Label x={182} y={160} size={11.5}>PQ</Label>}
      </g>
      <g data-part="b6f" style={glow("b6f")}>
        <rect x={218} y={102} width={64} height={112} rx={14} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
        {labels && (
          <>
            <Label x={250} y={146} size={12}>Cyt</Label>
            <Label x={250} y={164} size={12}>b₆f</Label>
          </>
        )}
      </g>
      <g data-part="pc" style={glow("pc")}>
        <circle cx={316} cy={228} r={15} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.8} />
        {labels && <Label x={316} y={228} size={11.5}>PC</Label>}
      </g>
      <g data-part="ps1" style={glow("ps1")}>
        <ellipse cx={430} cy={158} rx={11} ry={28} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        <rect x={344} y={106} width={74} height={106} rx={16} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2} />
        {labels && (
          <>
            <Label x={381} y={146}>PS I</Label>
            <Label x={381} y={168} size={11} weight={600}>P700</Label>
          </>
        )}
      </g>
      <g data-part="fd" style={glow("fd")}>
        <circle cx={452} cy={98} r={14} fill="var(--bio-flesh)" stroke="var(--bio-flesh-deep)" strokeWidth={1.6} />
        {labels && <Label x={452} y={98} size={11.5}>Fd</Label>}
      </g>
      <g data-part="fnr" style={glow("fnr")}>
        <rect x={474} y={90} width={46} height={36} rx={10} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} />
        {labels && <Label x={497} y={108} size={11}>FNR</Label>}
      </g>
      <g data-part="atp" style={glow("atp")}>
        <clipPath id="photo-thyl-cf0">
          <rect x={532} y={128} width={50} height={60} rx={9} />
        </clipPath>
        <rect x={532} y={128} width={50} height={60} rx={9} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} />
        <g clipPath="url(#photo-thyl-cf0)">
          <motion.g animate={spin && !reduce ? { x: [0, 14] } : { x: 0 }} transition={spin && !reduce ? { duration: 0.5, repeat: Infinity, ease: "linear" } : { duration: 0.2 }}>
            {Array.from({ length: 6 }, (_, i) => (
              <line key={i} x1={526 + i * 14} x2={526 + i * 14} y1={130} y2={186} stroke="var(--bio-nucleus-deep)" strokeWidth={2.4} opacity={0.6} />
            ))}
          </motion.g>
        </g>
        <rect x={552} y={84} width={10} height={46} rx={3} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.4} />
        <ellipse cx={557} cy={62} rx={36} ry={28} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.8} />
        {labels && (
          <>
            <Label x={557} y={55} size={10.5}>ATP-</Label>
            <Label x={557} y={69} size={10.5}>{t(tx("synthase", "Synthase"))}</Label>
          </>
        )}
      </g>
    </g>
  );
}

/** The thylakoid membrane as a labelled drawing (tasks and exploring). */
export function PhotoThylakoidFigure({ mode = "numbers", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Thylakoid membrane in the light", "Thylakoidmembran im Licht")} width={W} height={H} parts={THYLAKOID_PARTS} mode={mode} show={show ?? THYLAKOID_PARTS.filter((p) => p.id !== "lumen" && p.id !== "stroma").map((p) => p.id)} ask={ask} highlight={highlight} legend={legend}>
      <Membrane labels={false} />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Moving particles

type Pt = [number, number];
function Mover({ path, at, dur, children, stay }: { path: Pt[]; at: number; dur: number; children: ReactNode; stay?: boolean }) {
  return (
    <motion.g
      initial={{ x: path[0][0], y: path[0][1], opacity: 0 }}
      animate={{ x: path.map((p) => p[0]), y: path.map((p) => p[1]), opacity: stay ? [0, 1, 1] : [0, 1, 1, 0] }}
      transition={{ delay: at, duration: dur, ease: "easeInOut", opacity: { delay: at, duration: dur, times: stay ? [0, 0.15, 1] : [0, 0.12, 0.85, 1] } }}
    >
      {children}
    </motion.g>
  );
}

function Photon({ from, to, at }: { from: Pt; to: Pt; at: number }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const n = 7;
  const dx = (x2 - x1) / n;
  const dy = (y2 - y1) / n;
  const len = Math.hypot(dx, dy);
  const px = (-dy / len) * 6;
  const py = (dx / len) * 6;
  const d = `M ${x1} ${y1} ` + Array.from({ length: n }, (_, i) => `Q ${x1 + dx * (i + 0.5) + (i % 2 ? -px : px)} ${y1 + dy * (i + 0.5) + (i % 2 ? -py : py)} ${x1 + dx * (i + 1)} ${y1 + dy * (i + 1)}`).join(" ");
  return (
    <motion.path d={d} fill="none" stroke="var(--bio-sun)" strokeWidth={3.2} strokeLinecap="round" initial={{ pathLength: 0, opacity: 1 }} animate={{ pathLength: 1, opacity: [1, 1, 0] }} transition={{ delay: at, duration: 1.1, opacity: { delay: at, duration: 1.6, times: [0, 0.7, 1] } }} />
  );
}

const E = () => <PhotoIon label="e⁻" fill="var(--bio-nerve)" r={10} />;
const HP = () => <PhotoIon label="H⁺" fill="var(--bio-water)" r={10} />;

/** Protons waiting in the lumen (shown up to the step's count). */
const LUMEN_H: Pt[] = [
  [170, 250],
  [212, 300],
  [262, 262],
  [372, 262],
  [404, 318],
  [470, 250],
  [498, 300],
  [150, 318],
  [300, 318],
  [540, 252],
  [226, 244],
  [350, 300],
  [440, 286],
];
const LUMEN_COUNT = [5, 5, 8, 10, 10, 10, 7];

function StepParticles({ step }: { step: number }) {
  switch (step) {
    case 1:
      return (
        <g>
          <Photon from={[8, 26]} to={[44, 118]} at={0} />
          <Mover path={[[104, 160], [140, 150], [182, 160]]} at={1.1} dur={1.2} stay>
            <E />
          </Mover>
        </g>
      );
    case 2:
      return (
        <g>
          <Mover path={[[60, 300], [86, 252], [100, 222]]} at={0} dur={1}>
            <PhotoH2O s={1.5} />
          </Mover>
          <Mover path={[[140, 312], [124, 260], [108, 224]]} at={0.1} dur={1}>
            <PhotoH2O s={1.5} />
          </Mover>
          <Mover path={[[104, 222], [74, 270], [40, 330]]} at={1.1} dur={1.4} stay>
            <PhotoO2 s={1.7} />
          </Mover>
          {[
            [150, 318],
            [170, 250],
            [212, 300],
          ].map((p, i) => (
            <Mover key={i} path={[[104, 222], [130 + i * 10, 250], p as Pt]} at={1.2 + i * 0.12} dur={1}>
              <HP />
            </Mover>
          ))}
          <Mover path={[[104, 216], [104, 190], [104, 172]]} at={1.2} dur={0.9} stay>
            <E />
          </Mover>
        </g>
      );
    case 3:
      return (
        <g>
          <Mover path={[[160, 46], [172, 100], [176, 150]]} at={0} dur={0.9}>
            <HP />
          </Mover>
          <Mover path={[[204, 52], [194, 100], [188, 150]]} at={0.1} dur={0.9}>
            <HP />
          </Mover>
          <Mover path={[[182, 160], [214, 160], [236, 160]]} at={0.9} dur={0.8} stay>
            <E />
          </Mover>
          <Mover path={[[244, 214], [236, 240], [226, 244]]} at={1.6} dur={0.8}>
            <HP />
          </Mover>
          <Mover path={[[258, 214], [262, 236], [262, 262]]} at={1.7} dur={0.8}>
            <HP />
          </Mover>
          <Mover path={[[252, 200], [290, 222], [316, 228]]} at={1.7} dur={0.8} stay>
            <E />
          </Mover>
        </g>
      );
    case 4:
      return (
        <g>
          <Photon from={[318, 18]} to={[364, 104]} at={0.4} />
          <Mover path={[[316, 228], [342, 206], [372, 172]]} at={0} dur={0.9}>
            <E />
          </Mover>
          <Mover path={[[381, 160], [420, 120], [452, 98]]} at={1.5} dur={0.9} stay>
            <E />
          </Mover>
        </g>
      );
    case 5:
      return (
        <g>
          <Mover path={[[452, 98], [474, 104], [492, 108]]} at={0} dur={0.7}>
            <E />
          </Mover>
          <Mover path={[[520, 22], [508, 52], [498, 84]]} at={0} dur={0.9}>
            <PhotoPill label="NADP⁺" fill="var(--bio-petal)" w={46} />
          </Mover>
          <Mover path={[[440, 30], [470, 60], [490, 88]]} at={0.2} dur={0.8}>
            <HP />
          </Mover>
          <Mover path={[[498, 84], [470, 50], [430, 22]]} at={1.2} dur={1} stay>
            <PhotoPill label="NADPH" fill="var(--bio-petal)" w={50} />
          </Mover>
        </g>
      );
    case 6:
      return (
        <g>
          {[
            [540, 252],
            [498, 300],
            [470, 250],
          ].map((p, i) => (
            <Mover key={i} path={[p as Pt, [557, 210], [557, 158], [544, 116], [512, 96]]} at={i * 0.45} dur={1.6}>
              <HP />
            </Mover>
          ))}
          <Mover path={[[440, 24], [476, 34], [506, 44]]} at={0.3} dur={0.9}>
            <PhotoPill label="ADP + P" fill="var(--bio-cell)" w={52} />
          </Mover>
          <Mover path={[[506, 44], [480, 26], [446, 14]]} at={1.5} dur={1} stay>
            <PhotoPill label="ATP" fill="var(--bio-mito)" w={38} />
          </Mover>
        </g>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Z-scheme (energy of the electron along its way)

type ZP = { id: string; x: number; e: number; label: string };
const ZPTS: ZP[] = [
  { id: "h2o", x: 22, e: 0.82, label: "H₂O" },
  { id: "p680", x: 56, e: 1.1, label: "P680" },
  { id: "p680s", x: 56, e: -0.75, label: "P680*" },
  { id: "pq", x: 100, e: 0, label: "PQ" },
  { id: "b6f", x: 134, e: 0.28, label: "b₆f" },
  { id: "pc", x: 166, e: 0.37, label: "PC" },
  { id: "p700", x: 198, e: 0.48, label: "P700" },
  { id: "p700s", x: 198, e: -1.25, label: "P700*" },
  { id: "fd", x: 238, e: -0.42, label: "Fd" },
  { id: "nadp", x: 280, e: -0.32, label: "NADP⁺" },
];
const zy = (e: number) => 22 + ((e + 1.4) / 2.7) * 170;
const zp = (id: string) => ZPTS.find((p) => p.id === id)!;
const ZSEG: Record<number, [string, string][]> = {
  1: [
    ["p680", "p680s"],
    ["p680s", "pq"],
  ],
  2: [["h2o", "p680"]],
  3: [
    ["pq", "b6f"],
    ["b6f", "pc"],
  ],
  4: [
    ["pc", "p700"],
    ["p700", "p700s"],
    ["p700s", "fd"],
  ],
  5: [["fd", "nadp"]],
};
const LIGHT_JUMPS = [
  ["p680", "p680s"],
  ["p700", "p700s"],
];

function ZScheme({ step }: { step: number }) {
  const t = useText();
  const order = ["h2o", "p680", "p680s", "pq", "b6f", "pc", "p700", "p700s", "fd", "nadp"];
  const lit = new Set((ZSEG[step] ?? []).map(([a, b]) => `${a}>${b}`));
  return (
    <svg viewBox="0 0 300 214" className="block h-auto w-full" role="img" aria-label={t(tx("Z-scheme: energy of the electrons", "Z-Schema: Energie der Elektronen"))}>
      <line x1={8} x2={8} y1={200} y2={14} stroke="var(--ink-3)" strokeWidth={1.2} />
      <path d="M4 20 L 8 12 L 12 20" fill="none" stroke="var(--ink-3)" strokeWidth={1.2} />
      <text x={14} y={14} fontSize={10.5} className="fill-ink-3">
        {t(tx("energy", "Energie"))}
      </text>
      {order.slice(1).map((id, i) => {
        const a = zp(order[i]);
        const b = zp(id);
        const on = lit.has(`${a.id}>${b.id}`);
        const light = LIGHT_JUMPS.some(([p, q]) => p === a.id && q === b.id);
        return (
          <line
            key={id}
            x1={a.x}
            x2={b.x}
            y1={zy(a.e)}
            y2={zy(b.e)}
            stroke={light ? "var(--bio-sun)" : on ? "var(--blob)" : "var(--ink-3)"}
            strokeWidth={on ? 4 : light ? 3 : 1.8}
            strokeDasharray={light ? "5 4" : undefined}
            strokeLinecap="round"
            opacity={on || light ? 1 : 0.55}
          />
        );
      })}
      {ZPTS.map((p) => (
        <g key={p.id}>
          <circle cx={p.x} cy={zy(p.e)} r={3.6} fill="var(--raised)" stroke="var(--ink-2)" strokeWidth={1.4} />
          <text x={p.x + (p.id === "nadp" ? 2 : 5)} y={zy(p.e) + (p.id.endsWith("s") || p.id === "fd" ? -7 : 15)} textAnchor={p.id === "nadp" ? "end" : "start"} fontSize={10.5} className="fill-ink-2">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The widget

const STEPS: { title: Text; text: Text; lit: string[] }[] = [
  {
    title: tx("Overview", "Überblick"),
    text: tx(
      "The thylakoid membrane separates the stroma from the lumen. Its protein complexes form a chain. Press play or step through.",
      "Die Thylakoidmembran trennt das Stroma vom Lumen. Ihre Proteinkomplexe bilden eine Kette. Drück auf Abspielen oder geh Schritt für Schritt.",
    ),
    lit: [],
  },
  {
    title: tx("1. Light excites photosystem II", "1. Licht regt Fotosystem II an"),
    text: tx(
      "Antenna pigments catch light and pass the energy to the reaction centre P680. Excited P680 gives an electron to plastoquinone.",
      "Antennenpigmente fangen Licht ein und leiten die Energie zum Reaktionszentrum P680. Angeregtes P680 gibt ein Elektron an Plastochinon ab.",
    ),
    lit: ["ps2", "pq"],
  },
  {
    title: tx("2. Photolysis of water", "2. Fotolyse des Wassers"),
    text: tx(
      "P680 now lacks an electron and takes it from water: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. The oxygen is released, the protons stay in the lumen.",
      "P680 fehlt nun ein Elektron, es holt es sich aus Wasser: 2 H₂O → O₂ + 4 H⁺ + 4 e⁻. Der Sauerstoff wird frei, die Protonen bleiben im Lumen.",
    ),
    lit: ["ps2"],
  },
  {
    title: tx("3. Plastoquinone and cytochrome b₆f", "3. Plastochinon und Cytochrom-b₆f"),
    text: tx(
      "Plastoquinone takes up protons from the stroma and carries the electrons to the cytochrome b₆f complex. The protons are released into the lumen: the gradient grows.",
      "Plastochinon nimmt Protonen aus dem Stroma auf und bringt die Elektronen zum Cytochrom-b₆f-Komplex. Die Protonen werden ins Lumen abgegeben: Der Gradient wächst.",
    ),
    lit: ["pq", "b6f"],
  },
  {
    title: tx("4. Plastocyanin and photosystem I", "4. Plastocyanin und Fotosystem I"),
    text: tx(
      "Plastocyanin carries the electron to P700. Light excites P700 a second time and lifts the electron high enough to reach ferredoxin.",
      "Plastocyanin bringt das Elektron zu P700. Licht regt P700 ein zweites Mal an und hebt das Elektron so hoch, dass es Ferredoxin erreicht.",
    ),
    lit: ["pc", "ps1", "fd"],
  },
  {
    title: tx("5. NADPH is formed", "5. NADPH entsteht"),
    text: tx(
      "Ferredoxin passes the electrons to the NADP⁺ reductase: NADP⁺ + 2 e⁻ + H⁺ → NADPH. This happens in the stroma, where the Calvin cycle needs it.",
      "Ferredoxin gibt die Elektronen an die NADP⁺-Reduktase: NADP⁺ + 2 e⁻ + H⁺ → NADPH. Das passiert im Stroma, wo der Calvin-Zyklus es braucht.",
    ),
    lit: ["fd", "fnr"],
  },
  {
    title: tx("6. ATP synthase: chemiosmosis", "6. ATP-Synthase: Chemiosmose"),
    text: tx(
      "Many protons in the lumen, few in the stroma: a proton gradient. The protons can only flow back through ATP synthase. The flow turns its rotor, and ADP + P becomes ATP.",
      "Viele Protonen im Lumen, wenige im Stroma: ein Protonengradient. Zurück können die Protonen nur durch die ATP-Synthase. Der Strom dreht ihren Rotor, aus ADP + P wird ATP.",
    ),
    lit: ["atp"],
  },
];

export function PhotoThylakoid() {
  const t = useText();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const go = (s: number) => {
    setStep(s);
    setRun((r) => r + 1);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      setStep((s) => (s >= 6 ? 1 : s + 1));
      setRun((r) => r + 1);
    }, step === 0 ? 300 : 3300);
    return () => clearTimeout(id);
  }, [playing, step, run]);

  const S = STEPS[step];
  const nH = LUMEN_COUNT[step];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Light reactions on the thylakoid membrane", "Lichtreaktionen an der Thylakoidmembran"))}>
            <Membrane labels lit={S.lit} spin={step === 6 || playing} />
            {LUMEN_H.slice(0, nH).map(([x, y], i) => (
              <motion.g key={i} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: step === 2 ? 1.9 : step === 3 ? 2.3 : 0 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
                <g transform={`translate(${x} ${y})`}>
                  <HP />
                </g>
              </motion.g>
            ))}
            {[
              [120, 44],
              [330, 76],
              [400, 30],
            ].map(([x, y], i) => (
              <g key={i} transform={`translate(${x} ${y})`} opacity={0.75}>
                <HP />
              </g>
            ))}
            {!reduce && (
              <g key={run}>
                <StepParticles step={step} />
              </g>
            )}
          </svg>
        </div>
        <div className="rounded-xl border border-line bg-surface p-2">
          <div className="px-1 pb-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Z-scheme", "Z-Schema"))}</div>
          <ZScheme step={step} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            go(Math.max(0, step - 1));
          }}
          disabled={step === 0}
          className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          aria-label={t(tx("Previous step", "Vorheriger Schritt"))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : t(tx("Play", "Abspielen"))}
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setPlaying(false);
                go(i);
              }}
              className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-blob" : "w-2 bg-line-2 hover:bg-ink-3")}
              aria-label={t(s.title)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setPlaying(false);
            go(step >= 6 ? 0 : step + 1);
          }}
          className="flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          {t(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className="rounded-xl bg-blob-soft/70 px-4 py-3 text-[14.5px] leading-relaxed text-ink"
          aria-live="polite"
        >
          <span className="font-semibold">{t(S.title)}.</span> {t(S.text)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
