"use client";

// A motor neuron for the "nervous-system" topic: dendrites, cell body with nucleus, axon hillock,
// the axon wrapped in Schwann cells (myelin sheath) with nodes of Ranvier, and the synaptic end
// bulbs. The level 2 widget sends an impulse that jumps from node to node.

import { animate, useReducedMotion } from "motion/react";
import { Zap } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { ActionButton, chain, cubic, Note, r1, span, track } from "./NerveKit";

const W = 620;
const H = 230;
const AY = 115; // axon level
const SEG0 = 192;
const SEG_LEN = 52;
const SEG_STEP = 60;
const SEGS = 5;
/** Centres of the nodes of Ranvier (gaps between Schwann cells). */
export const NODES = Array.from({ length: SEGS - 1 }, (_, i) => SEG0 + i * SEG_STEP + SEG_LEN + 4);

const DENDRITES: [string, number][] = [
  ["M100 94 C88 80 76 70 60 60", 6],
  ["M60 60 C50 52 44 44 36 30", 3.5],
  ["M60 60 C50 60 40 62 26 58", 3],
  ["M90 112 C76 110 60 112 44 118", 6],
  ["M44 118 C34 116 26 110 16 104", 3],
  ["M44 118 C34 124 26 132 18 140", 3],
  ["M100 136 C88 150 78 162 64 174", 6],
  ["M64 174 C56 182 52 192 46 204", 3],
  ["M64 174 C54 176 44 176 32 172", 3],
  ["M118 82 C118 66 114 52 108 38", 5.5],
  ["M108 38 C104 30 98 24 90 18", 3],
  ["M108 38 C112 30 118 24 126 18", 3],
  ["M124 148 C126 164 124 178 118 194", 5.5],
  ["M118 194 C114 202 108 208 100 214", 3],
  ["M118 194 C122 202 128 208 136 212", 3],
  ["M138 88 C146 76 154 66 164 58", 4],
  ["M164 58 C170 52 178 50 186 50", 2.5],
];
const SOMA = "M118 80 C138 80 150 96 152 106 L176 111 L176 119 L152 124 C150 136 136 150 118 150 C98 150 84 136 84 115 C84 94 98 80 118 80 Z";
const TERMINALS: { d: string; end: [number, number] }[] = [
  { d: "M540 115 C556 100 566 80 584 66", end: [586, 64] },
  { d: "M540 115 C560 112 576 106 596 104", end: [599, 104] },
  { d: "M540 115 C558 126 572 140 592 146", end: [595, 147] },
  { d: "M540 115 C552 136 560 160 574 180", end: [576, 183] },
];

const PARTS: FigurePart[] = [
  { id: "dendrites", label: tx("dendrites", "Dendriten"), at: [56, 60], tag: [22, 22], info: tx("Short, branched extensions. They receive signals from other cells.", "Kurze, verzweigte Fortsätze. Sie nehmen Erregungen von anderen Zellen auf.") },
  { id: "soma", label: tx("cell body", "Zellkörper"), at: [132, 138], tag: [160, 192], info: tx("Contains the nucleus and most organelles. The signals from the dendrites come together here.", "Enthält den Zellkern und die meisten Organellen. Hier laufen die Erregungen der Dendriten zusammen.") },
  { id: "nucleus", label: tx("nucleus", "Zellkern"), at: [112, 112], info: tx("Contains the genetic information and controls the cell.", "Enthält die Erbinformation und steuert die Zelle.") },
  { id: "hillock", label: tx("axon hillock", "Axonhügel"), at: [162, 115], tag: [184, 40], info: tx("Where the axon leaves the cell body. Here it is decided whether an action potential starts.", "Übergang vom Zellkörper zum Axon. Hier entscheidet sich, ob ein Aktionspotenzial entsteht.") },
  { id: "axon", label: tx("axon (neurite)", "Axon (Neurit)"), at: [512, 115], tag: [500, 190], info: tx("The long extension, up to over a metre. It carries the impulse away from the cell body.", "Der lange Fortsatz, bis über 1 m lang. Er leitet die Erregung vom Zellkörper weg.") },
  { id: "myelin", label: tx("myelin sheath (Schwann cell)", "Myelinscheide (Schwann-Zelle)"), at: [338, 105], tag: [338, 40], info: tx("Schwann cells wrap around the axon many times. They insulate it and make conduction much faster.", "Schwann-Zellen wickeln sich viele Male um das Axon. Sie isolieren es und machen die Leitung viel schneller.") },
  { id: "node", label: tx("node of Ranvier", "Ranvierscher Schnürring"), at: [NODES[1], AY], tag: [NODES[1] - 24, 190], info: tx("A small gap between two Schwann cells. Only here is the impulse regenerated: it jumps from node to node.", "Eine kleine Lücke zwischen zwei Schwann-Zellen. Nur hier wird die Erregung neu gebildet: Sie springt von Schnürring zu Schnürring.") },
  { id: "terminal", label: tx("synaptic end bulbs", "Endknöpfchen"), at: [599, 104], tag: [604, 20], info: tx("The thickened ends of the axon. They release transmitter onto the next cell (synapse).", "Die verdickten Enden des Axons. Sie geben Transmitter an die nächste Zelle ab (Synapse).") },
];

export const NEURON_PARTS = PARTS;

function Tube({ d, w, fill = "var(--bio-nerve)" }: { d: string; w: number; fill?: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 2.6} strokeLinecap="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={w} strokeLinecap="round" />
    </>
  );
}

export function NerveNeuron({ mode = "names", show, ask, highlight, legend, overlay, selected, onSelect }: DrawingProps & { overlay?: ReactNode; selected?: string | null; onSelect?: (id: string | null) => void }) {
  const parts = show ? PARTS.filter((p) => show.includes(p.id)) : PARTS;
  return (
    <Figure title={tx("A nerve cell (neuron)", "Eine Nervenzelle (Neuron)")} width={W} height={H} parts={parts} mode={mode} ask={ask} highlight={highlight} legend={legend} selected={selected} onSelect={onSelect}>
      <g data-part="dendrites">
        {DENDRITES.map(([d, w]) => (
          <path key={d} d={d} fill="none" stroke="var(--bio-outline)" strokeWidth={w + 2.6} strokeLinecap="round" />
        ))}
        {DENDRITES.map(([d, w]) => (
          <path key={d} d={d} fill="none" stroke="var(--bio-nerve)" strokeWidth={w} strokeLinecap="round" />
        ))}
      </g>
      <g data-part="axon">
        <Tube d={`M176 ${AY} L540 ${AY}`} w={8} />
        {TERMINALS.map((tm) => (
          <Tube key={tm.d} d={tm.d} w={3.6} />
        ))}
      </g>
      <g data-part="soma">
        <path d={SOMA} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
      </g>
      <g data-part="hillock">
        <path d="M150 104 L176 111 L176 119 L150 126 C153 118 153 112 150 104 Z" fill="var(--bio-nerve-deep)" opacity={0.45} />
      </g>
      <g data-part="nucleus">
        <circle cx={112} cy={112} r={14} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.6} />
        <circle cx={115} cy={109} r={4} fill="var(--bio-nucleus-deep)" />
      </g>
      <g data-part="myelin">
        {Array.from({ length: SEGS }, (_, i) => {
          const x = SEG0 + i * SEG_STEP;
          return (
            <g key={i}>
              <rect x={x} y={AY - 11} width={SEG_LEN} height={22} rx={11} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.5} />
              <path d={`M${x + 8} ${AY - 5} L${x + SEG_LEN - 8} ${AY - 5} M${x + 8} ${AY + 5} L${x + SEG_LEN - 8} ${AY + 5}`} stroke="var(--bio-outline)" strokeWidth={0.8} opacity={0.35} />
              {i === 2 && <ellipse cx={x + 26} cy={AY - 11} rx={9} ry={4.5} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />}
            </g>
          );
        })}
      </g>
      <g data-part="node">
        {NODES.map((x) => (
          <rect key={x} x={x - 4} y={AY - 5} width={8} height={10} rx={2} fill="var(--bio-nerve-deep)" opacity={0.55} />
        ))}
      </g>
      <g data-part="terminal">
        {TERMINALS.map((tm) => (
          <g key={tm.d}>
            <circle cx={tm.end[0]} cy={tm.end[1]} r={8.5} fill="var(--bio-nerve)" stroke="var(--bio-outline)" strokeWidth={1.6} />
            <circle cx={tm.end[0] - 2.5} cy={tm.end[1] - 2} r={1.6} fill="var(--bio-nerve-deep)" />
            <circle cx={tm.end[0] + 2.5} cy={tm.end[1] + 1.5} r={1.6} fill="var(--bio-nerve-deep)" />
          </g>
        ))}
      </g>
      {overlay}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Level 2 widget: send an impulse through the neuron.

const IN_PATH = track(chain(cubic([36, 30], [44, 44], [50, 52], [60, 60]), cubic([60, 60], [76, 70], [88, 80], [100, 94]), [[118, 115]]));
/** Where the impulse is regenerated along the axon: start of the axon, every node, the end. */
const STOPS = [184, ...NODES, 500, 540];

const PHASES: { until: number; text: Text }[] = [
  { until: 0.2, text: tx("A **dendrite** receives a signal from another cell and passes it to the cell body.", "Ein **Dendrit** nimmt eine Erregung von einer anderen Zelle auf und leitet sie zum Zellkörper.") },
  { until: 0.3, text: tx("At the **axon hillock** the decision is made: strong enough? Then an impulse starts down the axon.", "Am **Axonhügel** fällt die Entscheidung: stark genug? Dann startet eine Erregung über das Axon.") },
  { until: 0.84, text: tx("The impulse **jumps** from one node of Ranvier to the next. The myelin sheath insulates the stretches in between. That makes it very fast.", "Die Erregung **springt** von Schnürring zu Schnürring. Die Myelinscheide isoliert die Abschnitte dazwischen. Das macht die Leitung sehr schnell.") },
  { until: 1.01, text: tx("The impulse arrives at the **end bulbs**. There it is passed on to the next cell via a synapse.", "Die Erregung kommt an den **Endknöpfchen** an. Dort wird sie über eine Synapse an die nächste Zelle weitergegeben.") },
];

function impulseOverlay(t: number) {
  if (t <= 0 || t >= 1) return null;
  const glow = (x: number, y: number, r: number, o = 1) => <circle cx={r1(x)} cy={r1(y)} r={r} fill="var(--blob)" opacity={0.85 * o} />;
  if (t < 0.2) {
    const [x, y] = IN_PATH.at(t / 0.2);
    return (
      <g style={{ pointerEvents: "none" }}>
        {glow(x, y, 9, 0.35)}
        {glow(x, y, 5)}
      </g>
    );
  }
  if (t < 0.3) {
    const k = span(t, 0.2, 0.3);
    return (
      <g style={{ pointerEvents: "none" }}>
        {glow(118 + 50 * k, 115, 16 - 6 * k, 0.3)}
        {glow(118 + 50 * k, 115, 6)}
      </g>
    );
  }
  if (t < 0.84) {
    const k = span(t, 0.3, 0.84) * (STOPS.length - 1);
    const i = Math.min(STOPS.length - 2, Math.floor(k));
    const f = k - i;
    // Most of the time the impulse is "being regenerated" at a node; the jump itself is quick.
    const jump = span(f, 0.55, 1);
    const x = STOPS[i] + (STOPS[i + 1] - STOPS[i]) * jump;
    return (
      <g style={{ pointerEvents: "none" }}>
        {STOPS.slice(0, i + 1).map((sx, j) => (
          <circle key={sx} cx={sx} cy={AY} r={6} fill="var(--blob)" opacity={j === i ? 0.75 : 0.18} />
        ))}
        <path d={`M${STOPS[i]} ${AY - 14} Q${(STOPS[i] + STOPS[i + 1]) / 2} ${AY - 40} ${STOPS[i + 1]} ${AY - 14}`} fill="none" stroke="var(--blob)" strokeWidth={1.8} strokeDasharray="3 3" opacity={0.7} />
        {glow(x, AY, 10, 0.3)}
        {glow(x, AY, 5.5)}
      </g>
    );
  }
  const k = span(t, 0.84, 1);
  return (
    <g style={{ pointerEvents: "none" }}>
      {TERMINALS.map((tm) => (
        <g key={tm.d}>
          {glow(540 + (tm.end[0] - 540) * Math.min(1, k * 2), 115 + (tm.end[1] - 115) * Math.min(1, k * 2), 5)}
          {k > 0.5 && <circle cx={tm.end[0]} cy={tm.end[1]} r={9 + 10 * (k - 0.5)} fill="none" stroke="var(--blob)" strokeWidth={2} opacity={1 - k} />}
        </g>
      ))}
    </g>
  );
}

export function NerveNeuronLab() {
  const t = useText();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const phase = time <= 0 || time >= 1 ? -1 : PHASES.findIndex((p) => time < p.until);

  const fire = () => {
    ctrl.current?.stop();
    setPicked(null);
    if (reduce) {
      const next = PHASES.find((p) => p.until > time + 0.001);
      setTime(next && time > 0 ? Math.min(0.995, next.until - 0.02) : 0.1);
      return;
    }
    ctrl.current = animate(0.001, 1, { duration: 5.5, ease: "linear", onUpdate: setTime });
  };

  return (
    <div className="space-y-4">
      <NerveNeuron mode="explore" overlay={impulseOverlay(time)} selected={picked} onSelect={setPicked} highlight={phase === 1 ? ["hillock"] : phase === 2 ? ["node"] : phase === 3 ? ["terminal"] : phase === 0 ? ["dendrites"] : []} />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={fire}>
          <Zap className="size-4" /> {t(tx("Send an impulse", "Erregung losschicken"))}
        </ActionButton>
      </div>
      {phase >= 0 && <Note id={`p${phase}`} text={PHASES[phase].text} accent />}
    </div>
  );
}
