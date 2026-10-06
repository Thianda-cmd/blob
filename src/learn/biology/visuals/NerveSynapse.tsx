"use client";

// A chemical synapse (cholinergic, e.g. the motor end plate) for the "nervous-system" topic.
// Step through the transmission: action potential arrives → Ca²⁺ channels open → vesicles fuse
// (exocytosis) → acetylcholine diffuses and binds → ligand-gated Na⁺ channels open (EPSP) →
// acetylcholinesterase splits ACh → choline is taken back up. Level 3 adds a poison picker:
// curare, atropine, E 605 and botulinum toxin each block one step.

import { animate, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { ActionButton, GhostButton, lerp, Note, r1, Segmented, span, type Pt } from "./NerveKit";
import { sin } from "@/lib/stableMath";

const W = 560;
const H = 360;
const PRE_Y = 214;
const POST_Y = 238;
const BULB = "M250 0 L250 26 C250 52 146 62 140 122 C135 170 150 205 182 214 L378 214 C410 205 425 170 420 122 C414 62 310 52 310 26 L310 0";
const POST = "M96 360 L96 252 C96 244 103 238 112 238 L448 238 C457 238 464 244 464 252 L464 360 Z";
const RX = [206, 252, 298, 344]; // receptors
const EX = [229, 275, 321]; // acetylcholinesterase
const CA = [214, 348]; // Ca²⁺ channels
const CHT = 190; // choline transporter
const DOCK: Pt[] = [
  [240, 196],
  [280, 193],
  [320, 196],
];
const RESERVE: Pt[] = [
  [216, 150],
  [266, 128],
  [318, 152],
  [292, 92],
];
const IN_VESICLE: Pt[] = [
  [-4, -3],
  [4, -3],
  [-3, 4],
  [4.5, 3.5],
];

export type Poison = "none" | "curare" | "atropine" | "e605" | "botox";

const PARTS: FigurePart[] = [
  { id: "bulb", label: tx("synaptic end bulb (presynaptic)", "Endknöpfchen (präsynaptisch)"), at: [160, 120], tag: [64, 80], info: tx("The end of the axon. It turns the electrical signal into a chemical one.", "Das Ende des Axons. Hier wird das elektrische Signal in ein chemisches übersetzt.") },
  { id: "vesicle", label: tx("synaptic vesicle with transmitter", "Vesikel mit Transmitter"), at: [266, 128], tag: [64, 140], info: tx("Little bubbles filled with transmitter molecules (here acetylcholine).", "Kleine Bläschen, gefüllt mit Transmittermolekülen (hier Acetylcholin).") },
  { id: "mito", label: tx("mitochondrion", "Mitochondrium"), at: [192, 98], tag: [110, 24], info: tx("Supplies ATP, e.g. for making new transmitter and for pumps.", "Liefert ATP, z. B. für die Herstellung von neuem Transmitter und für Pumpen.") },
  { id: "pre", label: tx("presynaptic membrane", "Präsynaptische Membran"), at: [262, 214], tag: [64, 196], info: tx("The membrane of the end bulb facing the cleft. The vesicles fuse with it.", "Die Membran des Endknöpfchens zum Spalt hin. Mit ihr verschmelzen die Vesikel.") },
  { id: "cachannel", label: tx("Ca²⁺ channel (voltage-gated)", "Ca²⁺-Kanal (spannungsgesteuert)"), at: [348, 214], tag: [470, 150], info: tx("Opens when the action potential arrives. Ca²⁺ flows in and triggers the release.", "Öffnet sich, wenn das Aktionspotenzial ankommt. Ca²⁺ strömt ein und löst die Ausschüttung aus.") },
  { id: "cleft", label: tx("synaptic cleft", "Synaptischer Spalt"), at: [400, 226], tag: [500, 200], info: tx("A narrow gap (about 20 to 50 nm) between the two cells. The transmitter crosses it by diffusion.", "Ein schmaler Spalt (etwa 20 bis 50 nm) zwischen den Zellen. Der Transmitter überquert ihn durch Diffusion.") },
  { id: "receptor", label: tx("receptor (ligand-gated Na⁺ channel)", "Rezeptor (ligandengesteuerter Na⁺-Kanal)"), at: [344, 246], tag: [470, 300], info: tx("Fits the transmitter like a lock fits a key. When ACh binds, the channel opens and Na⁺ flows in.", "Passt zum Transmitter wie ein Schloss zum Schlüssel. Bindet ACh, öffnet sich der Kanal und Na⁺ strömt ein.") },
  { id: "ache", label: tx("acetylcholinesterase", "Acetylcholinesterase"), at: [275, 233], tag: [258, 320], info: tx("An enzyme in the cleft. It splits acetylcholine into acetate and choline, so the signal stops.", "Ein Enzym im Spalt. Es spaltet Acetylcholin in Acetat und Cholin, damit das Signal endet.") },
  { id: "post", label: tx("postsynaptic membrane", "Postsynaptische Membran"), at: [130, 238], tag: [64, 280], info: tx("The membrane of the next cell (here a muscle fibre). Here the chemical signal becomes electrical again.", "Die Membran der nachfolgenden Zelle (hier einer Muskelfaser). Hier wird das chemische Signal wieder elektrisch.") },
];

const SIMPLE_PARTS = ["bulb", "vesicle", "pre", "cleft", "receptor", "post"];
export const SYNAPSE_PARTS = PARTS;

/** What the synapse looks like at time t (0..8: stage = floor(t)). */
type View = { t: number; poison: Poison; simple?: boolean };

const blocksReceptor = (p: Poison) => p === "curare" || p === "atropine";

function stageOf(t: number) {
  const s = Math.min(7, Math.floor(t));
  return { s, k: Math.min(1, t - s) };
}

function moving(t: number, from: number, to: number, a: Pt, b: Pt): Pt {
  const k = span(t, from, to);
  const e = k * k * (3 - 2 * k);
  return [r1(lerp(a[0], b[0], e)), r1(lerp(a[1], b[1], e))];
}

function Dynamic({ t, poison, simple }: View) {
  const { s } = stageOf(t);
  const released = poison !== "botox" && t >= 3;
  const fuse = poison === "botox" ? 0 : span(t, 3, 3.6);
  const recept = !blocksReceptor(poison);
  const open = recept && poison !== "botox" && ((t >= 5 && t < 6.2) || (poison === "e605" && t >= 5));
  const out: ReactNode[] = [];
  const ves: ReactNode[] = [];

  // Action potential arriving (stage 1) and the depolarised end bulb.
  const ap = t >= 1 && t < 3 ? (t < 2 ? span(t, 1, 1.6) : 1 - span(t, 2.4, 3)) : 0;
  if (t >= 1 && t < 1.6) {
    const y = lerp(0, 70, span(t, 1, 1.6));
    out.push(<circle key="apdot" cx={280} cy={r1(y)} r={8} fill="var(--blob)" opacity={0.8} />);
  }
  if (ap > 0) out.push(<path key="apglow" d={BULB} fill="none" stroke="var(--blob)" strokeWidth={6} opacity={0.45 * ap} />);

  // Ca²⁺ ions: from the cleft through the channels into the bulb.
  if (!simple && t < 4.6) {
    CA.forEach((cx, c) =>
      [-1, 0, 1].forEach((d, i) => {
        const a: Pt = [cx + d * 7, 230 + (i % 2) * 4];
        const b: Pt = [cx + d * 9 + (c ? -8 : 8), 192 - (i % 2) * 6];
        const [x, y] = moving(t, 2 + i * 0.12, 2.75 + i * 0.12, a, b);
        const fade = t > 4 ? 1 - span(t, 4, 4.6) : 1;
        out.push(<circle key={`ca${c}${i}`} cx={x} cy={y} r={3.6} fill="var(--bio-g)" stroke="var(--bio-outline)" strokeWidth={0.6} opacity={fade} />);
      }),
    );
  }

  // Docked vesicles: fuse with the membrane in stage 3 (not with botulinum toxin).
  DOCK.forEach(([vx, vy], v) => {
    if (fuse < 1) {
      const y = lerp(vy, PRE_Y - 10, Math.min(1, fuse * 1.6));
      const r = lerp(12, 7, fuse);
      ves.push(<circle key={`dv${v}`} cx={vx} cy={r1(y)} r={r1(r)} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.3} opacity={r1(10 - fuse * 6) / 10} />);
    } else if (t < 7) {
      ves.push(<path key={`om${v}`} d={`M${vx - 9} ${PRE_Y} Q${vx} ${PRE_Y - 12} ${vx + 9} ${PRE_Y}`} fill="none" stroke="var(--bio-outline)" strokeWidth={1.2} opacity={0.6} />);
    }
  });
  // In stage 7 reserve vesicles move up to the docking sites again.
  if (t >= 7 && poison !== "botox") {
    DOCK.forEach((d, v) => {
      const [x, y] = moving(t, 7.1, 7.9, RESERVE[v], d);
      ves.push(
        <g key={`rv${v}`}>
          <circle cx={x} cy={y} r={12} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.3} />
          {IN_VESICLE.map(([ox, oy], i) => (
            <circle key={i} cx={r1(x + ox)} cy={r1(y + oy)} r={2.6} fill="var(--bio-a)" />
          ))}
        </g>,
      );
    });
  }
  RESERVE.forEach(([vx, vy], v) => {
    if (t >= 7 && v < 3 && poison !== "botox") return;
    ves.push(
      <g key={`res${v}`}>
        <circle cx={vx} cy={vy} r={12} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        {IN_VESICLE.map(([ox, oy], i) => (
          <circle key={i} cx={vx + ox} cy={vy + oy} r={2.6} fill="var(--bio-a)" />
        ))}
      </g>,
    );
  });

  // Acetylcholine molecules (4 per docked vesicle).
  DOCK.forEach(([vx, vy], v) =>
    IN_VESICLE.forEach(([ox, oy], i) => {
      const n = v * 4 + i;
      const inside: Pt = [vx + ox, vy + oy];
      if (!released) {
        const y = lerp(vy, PRE_Y - 10, Math.min(1, fuse * 1.6));
        out.push(<circle key={`ach${n}`} cx={r1(vx + ox)} cy={r1(y + oy)} r={2.8} fill="var(--bio-a)" />);
        return;
      }
      const cleft: Pt = [vx + ox * 2.4, 220 + (i % 2) * 3];
      const site: Pt = n < 8 ? [RX[n % 4] + (n < 4 ? -3.5 : 3.5), 224] : [222 + (n - 8) * 34, 222];
      const hover: Pt = [RX[n % 4] + (n < 4 ? -8 : 8) + (n >= 8 ? 6 : 0), 219 - (n % 3)];
      const target = recept ? site : hover;
      const enzyme: Pt = [EX[n % 3] + ((n % 2) * 2 - 1) * 2.5, 227];
      let p: Pt;
      if (t < 4) p = moving(t, 3 + v * 0.1, 3.9, inside, cleft);
      else if (t < 6) p = moving(t, 4 + (n % 4) * 0.08, 4.85, cleft, target);
      else if (poison === "e605") {
        // The enzyme is blocked: ACh keeps falling off and binding again.
        const w = Math.abs(sin((t - 6) * Math.PI * 1.5 + n));
        p = [r1(lerp(target[0], enzyme[0], w * 0.6)), r1(lerp(target[1], enzyme[1] - 6, w))];
      } else if (t < 6.6) p = moving(t, 6, 6.55, target, enzyme);
      else return;
      out.push(<circle key={`ach${n}`} cx={p[0]} cy={p[1]} r={2.8} fill="var(--bio-a)" stroke="var(--bio-outline)" strokeWidth={0.5} />);
    }),
  );

  // Split products: choline goes back into the end bulb, acetate drifts away.
  if (released && !simple && poison !== "e605" && t >= 6.5) {
    for (let n = 0; n < 12; n++) {
      const e: Pt = [EX[n % 3] + ((n % 2) * 2 - 1) * 2.5, 227];
      const cho = t < 7 ? moving(t, 6.5, 6.95, e, [e[0] + ((n % 4) - 1.5) * 4, 221]) : moving(t, 7 + (n % 4) * 0.08, 7.8, [e[0] + ((n % 4) - 1.5) * 4, 221], [CHT + ((n % 3) - 1) * 6, 194 - (n % 4) * 5]);
      const ace = moving(t, 6.5, 7.6, e, [e[0] + ((n % 3) - 1) * 14, 231]);
      out.push(<circle key={`cho${n}`} cx={cho[0]} cy={cho[1]} r={2.3} fill="var(--bio-petal)" stroke="var(--bio-outline)" strokeWidth={0.5} opacity={t > 7.8 ? 1 - span(t, 7.8, 8) : 1} />);
      out.push(<rect key={`ace${n}`} x={ace[0] - 1.8} y={ace[1] - 1.8} width={3.6} height={3.6} fill="var(--bio-wood)" opacity={1 - span(t, 7, 7.8)} />);
    }
  }

  // Na⁺ flowing into the next cell through open channels.
  if (open) {
    const base = poison === "e605" && t >= 6 ? 5 + ((t - 5) % 1) : t;
    RX.forEach((rx, r) =>
      [0, 1].forEach((i) => {
        const [x, y] = moving(base, 5.05 + i * 0.3 + r * 0.05, 5.65 + i * 0.3 + r * 0.05, [rx + (i ? 6 : -6), 216], [rx + (i ? 5 : -5), 272]);
        out.push(<circle key={`na${r}${i}`} cx={x} cy={y} r={3.4} fill="var(--bio-c)" stroke="var(--bio-outline)" strokeWidth={0.6} />);
      }),
    );
  }
  if (s >= 5 && open) out.push(<path key="postglow" d="M112 238 L448 238" stroke="var(--blob)" strokeWidth={6} opacity={0.4} />);
  return (
    <g style={{ pointerEvents: "none" }}>
      <g data-part="vesicle">{ves}</g>
      {out}
    </g>
  );
}

export function NerveSynapse({ mode = "names", show, ask, highlight, legend, t = 0, poison = "none", simple }: DrawingProps & { t?: number; poison?: Poison; simple?: boolean }) {
  const ids = show ?? (simple ? SIMPLE_PARTS : PARTS.map((p) => p.id));
  const parts = PARTS.filter((p) => ids.includes(p.id));
  const recept = !blocksReceptor(poison);
  const open = recept && poison !== "botox" && ((t >= 5 && t < 6.2) || (poison === "e605" && t >= 5));
  const caOpen = t >= 2 && t < 4.2;
  return (
    <Figure title={tx("A chemical synapse", "Eine chemische Synapse")} width={W} height={H} parts={parts} mode={mode} ask={ask} highlight={highlight} legend={legend}>
      <g data-part="post">
        <path d={POST} fill="var(--bio-flesh)" fillOpacity={0.5} />
        <path d="M112 238 L448 238" stroke="var(--bio-membrane)" strokeWidth={4} strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M110 ${282 + i * 26} L450 ${282 + i * 26}`} stroke="var(--bio-flesh-deep)" strokeWidth={1.2} strokeDasharray="10 6" opacity={0.35} />
        ))}
      </g>
      <g data-part="cleft">
        <rect x={182} y={PRE_Y + 2} width={196} height={POST_Y - PRE_Y - 4} fill="var(--bio-vacuole)" opacity={0.6} />
      </g>
      <g data-part="bulb">
        <path d={`${BULB} Z`} fill="var(--bio-nerve)" fillOpacity={0.35} />
        <path d={BULB} fill="none" stroke="var(--bio-outline)" strokeWidth={2} strokeLinejoin="round" />
      </g>
      <g data-part="pre">
        <path d={`M182 ${PRE_Y} L378 ${PRE_Y}`} stroke="var(--bio-membrane)" strokeWidth={4} strokeLinecap="round" />
      </g>
      <g data-part="mito">
        <ellipse cx={192} cy={98} rx={26} ry={12} transform="rotate(-24 192 98)" fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.4} />
        <path d="M176 104 q4 -10 8 0 q4 -10 8 -4 q4 -10 8 -6" transform="rotate(-24 192 98)" fill="none" stroke="var(--bio-mito-deep)" strokeWidth={1.1} />
      </g>
      {!simple && (
        <g data-part="cachannel">
          {CA.map((cx) => (
            <g key={cx}>
              <rect x={cx - (caOpen ? 10 : 7.5)} y={PRE_Y - 8} width={7} height={16} rx={3} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.1} />
              <rect x={cx + (caOpen ? 3 : 0.5)} y={PRE_Y - 8} width={7} height={16} rx={3} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.1} />
            </g>
          ))}
          <rect x={CHT - 6} y={PRE_Y - 7} width={12} height={14} rx={6} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.1} />
        </g>
      )}
      <g data-part="receptor">
        {RX.map((rx) => (
          <g key={rx}>
            <rect x={rx - (open ? 13 : 10.5)} y={POST_Y - 11} width={9} height={22} rx={3.5} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
            <rect x={rx + (open ? 4 : 1.5)} y={POST_Y - 11} width={9} height={22} rx={3.5} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
            {poison === "curare" && <path d={`M${rx - 6} ${POST_Y - 18} L${rx + 6} ${POST_Y - 18} L${rx} ${POST_Y - 10} Z`} fill="var(--ink)" />}
            {poison === "atropine" && <path d={`M${rx} ${POST_Y - 20} L${rx + 5} ${POST_Y - 15} L${rx} ${POST_Y - 10} L${rx - 5} ${POST_Y - 15} Z`} fill="var(--ink)" />}
          </g>
        ))}
      </g>
      <g data-part="ache">
        {EX.map((ex) => (
          <g key={ex}>
            <path d={`M${ex} ${POST_Y - 5} L${ex - 4} ${POST_Y - 11} A7 7 0 1 0 ${ex + 4} ${POST_Y - 11} Z`} fill="var(--bio-u)" stroke="var(--bio-outline)" strokeWidth={1} strokeLinejoin="round" />
            {poison === "e605" && <rect x={ex - 3} y={POST_Y - 13} width={6} height={6} rx={1} fill="var(--ink)" />}
          </g>
        ))}
      </g>
      {poison === "botox" &&
        DOCK.map(([vx]) => (
          <path key={vx} d={`M${vx - 5} ${PRE_Y - 9} l10 10 m0 -10 l-10 10`} stroke="var(--ink)" strokeWidth={2.4} strokeLinecap="round" />
        ))}
      <Dynamic t={t} poison={poison} simple={simple} />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// The postsynaptic membrane potential over the same time line (mini chart).

function potential(t: number, poison: Poison): number {
  if (poison !== "none" && poison !== "e605") return -70;
  if (t < 5) return -70;
  if (t < 5.25) return lerp(-70, 30, span(t, 5, 5.25));
  if (poison === "e605") return t < 5.7 ? lerp(30, -35, span(t, 5.25, 5.7)) : -35 + 3 * sin((t - 5.7) * 9);
  if (t < 5.7) return lerp(30, -78, span(t, 5.25, 5.7));
  if (t < 6.3) return lerp(-78, -70, span(t, 5.7, 6.3));
  return -70;
}

function PostChart({ t, poison }: { t: number; poison: Poison }) {
  const tt = useText();
  const px = (x: number) => 30 + (x / 8) * 170;
  const py = (v: number) => 10 + ((40 - v) / 130) * 70;
  const pts: string[] = [];
  for (let x = 0; x <= t + 1e-9; x += 0.04) pts.push(`${pts.length ? "L" : "M"}${px(x).toFixed(1)} ${py(potential(x, poison)).toFixed(1)}`);
  const v = potential(t, poison);
  return (
    <svg viewBox="0 0 210 92" className="block h-auto w-full max-w-[260px]" role="img" aria-label={tt(tx("Membrane potential of the next cell", "Membranpotenzial der nachfolgenden Zelle"))}>
      <line x1={30} x2={200} y1={py(-70)} y2={py(-70)} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 3" />
      <line x1={30} x2={200} y1={py(0)} y2={py(0)} stroke="var(--line)" strokeWidth={1} />
      <line x1={30} x2={30} y1={6} y2={84} stroke="var(--ink-3)" strokeWidth={1} />
      <text x={26} y={py(-70)} fontSize={9} textAnchor="end" dominantBaseline="central" fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        −70
      </text>
      <text x={26} y={py(0)} fontSize={9} textAnchor="end" dominantBaseline="central" fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        0
      </text>
      <text x={200} y={88} fontSize={9} textAnchor="end" fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
        mV
      </text>
      {pts.length > 1 && <path d={pts.join(" ")} fill="none" stroke="var(--blob)" strokeWidth={2.2} strokeLinejoin="round" />}
      <circle cx={px(Math.min(8, t)).toFixed(1)} cy={py(v).toFixed(1)} r={3.5} fill="var(--blob)" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Widget

const STEPS: { title: Text; text: Text; simple?: Text; lit: string[] }[] = [
  {
    title: tx("At rest", "In Ruhe"),
    text: tx("The end bulb is at rest. Vesicles full of **acetylcholine** (ACh) wait near the presynaptic membrane.", "Das Endknöpfchen ist in Ruhe. Vesikel voller **Acetylcholin** (ACh) warten an der präsynaptischen Membran."),
    simple: tx("The end bulb is at rest. Little bubbles (vesicles) are full of **transmitter**.", "Das Endknöpfchen ist in Ruhe. Kleine Bläschen (Vesikel) sind voller **Transmitter**."),
    lit: ["vesicle"],
  },
  {
    title: tx("Action potential arrives", "Aktionspotenzial kommt an"),
    text: tx("An **action potential** reaches the end bulb and depolarises the presynaptic membrane.", "Ein **Aktionspotenzial** erreicht das Endknöpfchen und depolarisiert die präsynaptische Membran."),
    simple: tx("An **electrical** signal arrives at the end bulb.", "Ein **elektrisches** Signal (Erregung) kommt am Endknöpfchen an."),
    lit: ["bulb"],
  },
  {
    title: tx("Ca²⁺ flows in", "Ca²⁺ strömt ein"),
    text: tx("**Voltage-gated Ca²⁺ channels** open. Ca²⁺ ions flow into the end bulb, down their concentration gradient.", "**Spannungsgesteuerte Ca²⁺-Kanäle** öffnen sich. Ca²⁺-Ionen strömen in das Endknöpfchen ein, ihrem Konzentrationsgefälle folgend."),
    lit: ["cachannel"],
  },
  {
    title: tx("Exocytosis", "Exocytose"),
    text: tx("Ca²⁺ triggers **exocytosis**: the vesicles fuse with the presynaptic membrane and pour ACh into the cleft.", "Ca²⁺ löst die **Exocytose** aus: Die Vesikel verschmelzen mit der präsynaptischen Membran und schütten ACh in den Spalt aus."),
    simple: tx("The vesicles fuse with the membrane and release the transmitter into the **synaptic cleft**. Now the signal is **chemical**.", "Die Vesikel verschmelzen mit der Membran und geben den Transmitter in den **synaptischen Spalt** ab. Jetzt ist das Signal **chemisch**."),
    lit: ["pre", "vesicle"],
  },
  {
    title: tx("Diffusion and binding", "Diffusion und Bindung"),
    text: tx("ACh **diffuses** across the cleft and binds to **receptors** in the postsynaptic membrane (lock and key).", "ACh **diffundiert** durch den Spalt und bindet an **Rezeptoren** der postsynaptischen Membran (Schlüssel-Schloss-Prinzip)."),
    simple: tx("The transmitter crosses the cleft and binds to **receptors** of the next cell, like a key in a lock.", "Der Transmitter wandert durch den Spalt und bindet an **Rezeptoren** der nachfolgenden Zelle, wie ein Schlüssel ins Schloss."),
    lit: ["receptor", "cleft"],
  },
  {
    title: tx("Na⁺ flows in: EPSP", "Na⁺ strömt ein: EPSP"),
    text: tx("The receptors are **ligand-gated** ion channels: they open and Na⁺ flows in. The postsynaptic membrane is depolarised (**EPSP**). If it reaches the threshold, a new action potential starts.", "Die Rezeptoren sind **ligandengesteuerte** Ionenkanäle: Sie öffnen sich, Na⁺ strömt ein. Die postsynaptische Membran wird depolarisiert (**EPSP**). Erreicht das den Schwellenwert, entsteht ein neues Aktionspotenzial."),
    simple: tx("The receptors open, charged particles flow in, and the next cell is excited: the signal is **electrical** again.", "Die Rezeptoren öffnen sich, geladene Teilchen strömen ein, und die nachfolgende Zelle wird erregt: Das Signal ist wieder **elektrisch**."),
    lit: ["receptor", "post"],
  },
  {
    title: tx("ACh is split", "ACh wird gespalten"),
    text: tx("**Acetylcholinesterase** splits ACh into acetate and choline. The channels close and the signal ends.", "Die **Acetylcholinesterase** spaltet ACh in Acetat und Cholin. Die Kanäle schließen sich, das Signal endet."),
    simple: tx("An enzyme breaks the transmitter down, so the signal stops and the synapse is ready again.", "Ein Enzym baut den Transmitter ab. So endet das Signal und die Synapse ist wieder bereit."),
    lit: ["ache"],
  },
  {
    title: tx("Recycling", "Recycling"),
    text: tx("Choline is taken back into the end bulb. With acetyl-CoA it is made into new ACh and packed into vesicles (this needs ATP from the mitochondria).", "Cholin wird ins Endknöpfchen zurückgeholt. Mit Acetyl-CoA wird daraus neues ACh gebildet und in Vesikel verpackt (das braucht ATP aus den Mitochondrien)."),
    lit: ["mito", "pre"],
  },
];

const POISONS: { id: Poison; label: Text; site: Text; effect: Text; lit: string[]; from: number }[] = [
  { id: "none", label: tx("no poison", "kein Gift"), site: tx("", ""), effect: tx("", ""), lit: [], from: 9 },
  {
    id: "curare",
    label: tx("curare", "Curare"),
    site: tx("receptors of the postsynaptic membrane", "Rezeptoren der postsynaptischen Membran"),
    effect: tx(
      "Arrow poison from South America. It sits in the ACh receptors (**competitive inhibition**) without opening them. No Na⁺ flows in, the muscle is not excited: **flaccid paralysis**, death by respiratory paralysis. Antidote: inhibitors of acetylcholinesterase, so more ACh can push curare out.",
      "Pfeilgift aus Südamerika. Es besetzt die ACh-Rezeptoren (**kompetitive Hemmung**), ohne sie zu öffnen. Kein Na⁺ strömt ein, der Muskel wird nicht erregt: **schlaffe Lähmung**, Tod durch Atemlähmung. Gegenmittel: Hemmstoffe der Acetylcholinesterase, damit mehr ACh das Curare verdrängt.",
    ),
    lit: ["receptor"],
    from: 4,
  },
  {
    id: "atropine",
    label: tx("atropine", "Atropin"),
    site: tx("ACh receptors (muscarinic type)", "ACh-Rezeptoren (muskarinischer Typ)"),
    effect: tx(
      "Poison of deadly nightshade. Like curare it blocks ACh receptors **competitively**, but mainly at synapses of the parasympathetic system (heart, gut, pupil muscle), hardly at skeletal muscles. Wide pupils, racing heart, dry mouth. Used as eye drops and as an **antidote to E 605**.",
      "Gift der Tollkirsche. Wie Curare blockiert es ACh-Rezeptoren **kompetitiv**, aber vor allem an Synapsen des Parasympathikus (Herz, Darm, Pupillenmuskel), kaum an Skelettmuskeln. Weite Pupillen, Herzrasen, trockener Mund. Verwendet in Augentropfen und als **Gegengift bei E 605**.",
    ),
    lit: ["receptor"],
    from: 4,
  },
  {
    id: "e605",
    label: tx("E 605", "E 605"),
    site: tx("acetylcholinesterase", "Acetylcholinesterase"),
    effect: tx(
      "An insecticide (parathion, an organophosphate). It **inhibits acetylcholinesterase** irreversibly. ACh is no longer split and keeps opening the channels: **permanent excitation**, cramps, then paralysis (spastic paralysis) and respiratory failure.",
      "Ein Insektizid (Parathion, ein Alkylphosphat). Es **hemmt die Acetylcholinesterase** irreversibel. ACh wird nicht mehr gespalten und öffnet die Kanäle immer wieder: **Dauererregung**, Krämpfe, dann Lähmung (Krampflähmung) und Atemstillstand.",
    ),
    lit: ["ache"],
    from: 6,
  },
  {
    id: "botox",
    label: tx("botulinum toxin", "Botulinumtoxin"),
    site: tx("release of ACh (exocytosis)", "Ausschüttung von ACh (Exocytose)"),
    effect: tx(
      "Bacterial toxin (Clostridium botulinum, in spoiled tins). It stops the vesicles fusing with the membrane, so **no ACh is released**. The muscle is not excited: **flaccid paralysis**. In tiny doses it is used as 'Botox' against wrinkles and muscle cramps.",
      "Bakteriengift (Clostridium botulinum, in verdorbenen Konserven). Es verhindert, dass die Vesikel mit der Membran verschmelzen: **Es wird kein ACh ausgeschüttet**. Der Muskel wird nicht erregt: **schlaffe Lähmung**. In winzigen Dosen als „Botox“ gegen Falten und Muskelkrämpfe.",
    ),
    lit: ["vesicle", "pre"],
    from: 3,
  },
];

export function NerveSynapseLab({ simple = false }: { simple?: boolean }) {
  const tt = useText();
  const reduce = useReducedMotion();
  const [t, setT] = useState(0);
  const [poison, setPoison] = useState<Poison>("none");
  const [labels, setLabels] = useState(true);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  // The simple version skips the Ca²⁺ step and the recycling.
  const order = simple ? [0, 1, 3, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6, 7];
  const s = Math.min(7, Math.floor(t + 1e-6));
  const pos = Math.max(0, order.indexOf(s) >= 0 ? order.indexOf(s) : order.findIndex((o) => o > s) - 1);
  const P = POISONS.find((p) => p.id === poison)!;
  const step = STEPS[order[pos]];
  const hit = poison !== "none" && order[pos] >= P.from;
  const end = simple ? 7 : 8;

  const go = (from: number, to: number, seconds: number) => {
    ctrl.current?.stop();
    if (reduce) {
      setT(to - 0.001);
      return;
    }
    ctrl.current = animate(from, to - 0.001, { duration: seconds, ease: "linear", onUpdate: setT });
  };
  const next = () => {
    if (t < 0.001) return go(1, 2, 1.6);
    const at = order[pos];
    // Finish the step we're in, or play the next one.
    if (t - at < 0.9) return go(t, at + 1, 1.6 * (at + 1 - t));
    const target = order[Math.min(order.length - 1, pos + 1)];
    if (target === at) return;
    // The simple version folds the Ca²⁺ step into the release.
    go(target === 3 && simple ? 2 : target, target + 1, target === 3 && simple ? 2.4 : 1.6);
  };
  const prev = () => {
    ctrl.current?.stop();
    setT(pos <= 1 ? 0 : order[pos - 1] + 0.999);
  };
  const play = () => {
    const from = t >= end - 0.01 ? 0 : t;
    go(from, end, (end - from) * 1.5);
  };

  const poisonNote: Text | null = hit
    ? poison === "curare" || poison === "atropine"
      ? tx("Blocked! The poison sits in the receptors, ACh cannot bind. The channels stay shut and the next cell is not excited.", "Blockiert! Das Gift sitzt in den Rezeptoren, ACh kann nicht binden. Die Kanäle bleiben zu, die nachfolgende Zelle wird nicht erregt.")
      : poison === "e605"
        ? tx("Blocked! The enzyme is inhibited. ACh stays in the cleft and keeps opening the channels: the next cell stays depolarised.", "Blockiert! Das Enzym ist gehemmt. ACh bleibt im Spalt und öffnet die Kanäle immer wieder: Die nachfolgende Zelle bleibt depolarisiert.")
        : tx("Blocked! The vesicles cannot fuse with the membrane. No ACh gets into the cleft, nothing reaches the next cell.", "Blockiert! Die Vesikel können nicht mit der Membran verschmelzen. Kein ACh gelangt in den Spalt, bei der nachfolgenden Zelle kommt nichts an.")
    : null;

  return (
    <div className="space-y-4">
      {!simple && (
        <div className="space-y-1.5">
          <div className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{tt(tx("Synaptic poison", "Synapsengift"))}</div>
          <Segmented
            value={poison}
            onChange={(p) => {
              setPoison(p);
              ctrl.current?.stop();
              setT(0);
            }}
            label={tx("Synaptic poison", "Synapsengift")}
            options={POISONS.map((p) => ({ id: p.id, label: p.label }))}
          />
        </div>
      )}
      <NerveSynapse mode={labels ? "names" : "plain"} legend="below" t={t} poison={poison} simple={simple} highlight={hit ? P.lit : t > 0 ? step.lit : []} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        {[
          { c: "var(--bio-a)", l: simple ? tx("transmitter", "Transmitter") : tx("acetylcholine", "Acetylcholin") },
          ...(simple
            ? []
            : [
                { c: "var(--bio-g)", l: tx("Ca²⁺", "Ca²⁺") },
                { c: "var(--bio-petal)", l: tx("choline", "Cholin") },
                { c: "var(--bio-wood)", l: tx("acetate", "Acetat"), sq: true },
              ]),
          { c: "var(--bio-c)", l: tx("Na⁺", "Na⁺") },
        ].map((k) => (
          <span key={tt(k.l)} className="flex items-center gap-1.5">
            <span className={cn("inline-block size-2.5", "sq" in k ? "rounded-[2px]" : "rounded-full")} style={{ background: k.c }} />
            {tt(k.l)}
          </span>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-3.5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blob text-[12px] font-bold text-white">{pos + 1}</span>
            <span className="text-[15px] font-semibold text-ink">{tt(step.title)}</span>
          </div>
          <div className="flex gap-1">
            {order.map((o, i) => (
              <span key={o} className={cn("h-1.5 flex-1 rounded-full", i <= pos && t > 0 ? "bg-blob" : "bg-line")} />
            ))}
          </div>
        </div>
        {!simple && (
          <div>
            <PostChart t={t} poison={poison} />
            <div className="text-[11.5px] text-ink-3">{tt(tx("membrane potential of the next cell", "Membranpotenzial der nachfolgenden Zelle"))}</div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <GhostButton label={tt(tx("Previous step", "Voriger Schritt"))} onClick={prev} disabled={t <= 0}>
          <ChevronLeft className="size-4" />
        </GhostButton>
        <ActionButton onClick={next}>
          {tt(tx("Next step", "Nächster Schritt"))} <ChevronRight className="size-4" />
        </ActionButton>
        <GhostButton onClick={play}>
          <Play className="size-4" /> {tt(tx("Play all", "Alles abspielen"))}
        </GhostButton>
        <GhostButton
          label={tt(tx("Start again", "Von vorn"))}
          onClick={() => {
            ctrl.current?.stop();
            setT(0);
          }}
        >
          <RotateCcw className="size-4" />
        </GhostButton>
        <GhostButton pressed={labels} onClick={() => setLabels(!labels)}>
          {tt(tx("Labels", "Beschriftung"))}
        </GhostButton>
      </div>
      <Note id={`${order[pos]}-${poison}-${hit}`} text={poisonNote ?? (simple && step.simple ? step.simple : step.text)} accent={!!poisonNote} />
      {poison !== "none" && (
        <div className="rounded-xl border border-line px-4 py-3 text-[14px] leading-relaxed text-ink-2">
          <div className="mb-1 text-[13px]">
            <span className="font-semibold text-ink">{tt(P.label)}</span> · {tt(tx("acts on:", "Wirkort:"))} <span className="font-semibold text-blob-ink">{tt(P.site)}</span>
          </div>
          <Note id={`fx-${poison}`} text={P.effect} className="bg-transparent px-0 py-0" />
        </div>
      )}
    </div>
  );
}

/** Level 2: the same synapse, simplified (no Ca²⁺, no poisons). */
export function NerveSynapseSimple() {
  return <NerveSynapseLab simple />;
}
