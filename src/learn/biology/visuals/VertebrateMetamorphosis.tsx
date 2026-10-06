"use client";

// From spawn to frog: a scrubber through the metamorphosis of the common frog (seen from above).
// External gills disappear, the hind legs grow first, then the front legs break through, the tail
// is broken down and the froglet climbs onto the bank. A table shows breathing, food and habitat.

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

type Stage = { name: Text; when: Text; breath: Text; food: Text; move: Text; home: Text };

export const META_STAGES: Stage[] = [
  {
    name: tx("Spawn", "Laich"),
    when: tx("day 0", "Tag 0"),
    breath: tx("through the jelly (diffusion)", "durch die Gallerthülle (Diffusion)"),
    food: tx("yolk", "Dottervorrat"),
    move: tx("none", "keine"),
    home: tx("water: eggs without a shell, in jelly", "Wasser: Eier ohne Schale, in Gallerte"),
  },
  {
    name: tx("Larva hatches", "Larve schlüpft"),
    when: tx("after 1 to 3 weeks", "nach 1 bis 3 Wochen"),
    breath: tx("external gills", "Außenkiemen"),
    food: tx("rest of the yolk", "Rest des Dottervorrats"),
    move: tx("clings to water plants", "hält sich an Wasserpflanzen fest"),
    home: tx("water", "Wasser"),
  },
  {
    name: tx("Tadpole", "Kaulquappe"),
    when: tx("weeks 3 to 6", "Woche 3 bis 6"),
    breath: tx("internal gills, under a fold of skin", "Innenkiemen unter einer Hautfalte"),
    food: tx("algae: a plant-eater with horny jaws", "Algen: Pflanzenfresser mit Hornkiefer"),
    move: tx("swims with its tail fin", "schwimmt mit dem Ruderschwanz"),
    home: tx("water", "Wasser"),
  },
  {
    name: tx("Hind legs grow", "Hinterbeine wachsen"),
    when: tx("from about week 6", "ab etwa Woche 6"),
    breath: tx("gills; lungs start to form", "Kiemen; Lungen entstehen"),
    food: tx("algae", "Algen"),
    move: tx("tail, legs not used yet", "Schwanz, Beine noch ungenutzt"),
    home: tx("water", "Wasser"),
  },
  {
    name: tx("Front legs break through", "Vorderbeine brechen durch"),
    when: tx("about week 9", "etwa Woche 9"),
    breath: tx("lungs: comes up for air; gills are lost", "Lungen: holt an der Oberfläche Luft; Kiemen werden abgebaut"),
    food: tx("stops eating: the gut is rebuilt", "frisst nicht: Der Darm wird umgebaut"),
    move: tx("tail and legs", "Schwanz und Beine"),
    home: tx("water", "Wasser"),
  },
  {
    name: tx("Froglet", "Jungfrosch"),
    when: tx("about week 12", "etwa Woche 12"),
    breath: tx("lungs and skin", "Lungen und Haut"),
    food: tx("lives off its tail, which is broken down", "lebt vom Schwanz, der abgebaut wird"),
    move: tx("hops and swims with its legs", "hüpft und schwimmt mit den Beinen"),
    home: tx("leaves the water", "verlässt das Wasser"),
  },
  {
    name: tx("Frog", "Frosch"),
    when: tx("adult after 2 to 3 years", "nach 2 bis 3 Jahren erwachsen"),
    breath: tx("lungs and moist skin", "Lungen und feuchte Haut"),
    food: tx("insects, worms, snails: a meat-eater", "Insekten, Würmer, Schnecken: Fleischfresser"),
    move: tx("jumps, swims with webbed feet", "springt, schwimmt mit Schwimmhäuten"),
    home: tx("land and water; spawns in water", "Land und Wasser; laicht im Wasser"),
  },
];

// Shape of the animal per stage (seen from above, head to the left).
const BODY_RX = [0, 22, 28, 30, 32, 32, 38];
const BODY_RY = [0, 14, 21, 22, 22, 25, 30];
const TAIL = [0, 56, 86, 92, 84, 34, 0];
const TAIL_W = [0, 6, 11, 11, 10, 6, 0];
const HIND = [0, 0, 0, 0.45, 1, 1, 1.15];
const FRONT = [0, 0, 0, 0, 0.85, 1, 1.1];
const EYE = [0, 2.8, 3.6, 3.8, 5.5, 6.5, 7.5];
const GILLS = [0, 1, 0, 0, 0, 0, 0];
const X = [300, 300, 300, 300, 300, 260, 150];
const spring = { type: "spring" as const, stiffness: 120, damping: 18 };

function Leg({ side, k, front, cx, cy, rx, ry, color, line }: { side: 1 | -1; k: number; front: boolean; cx: number; cy: number; rx: number; ry: number; color: string; line: string }) {
  // A bent leg: thigh out to the side, shin back, foot with webbed toes.
  const bx = front ? cx - rx * 0.45 : cx + rx * 0.55;
  const by = cy + side * ry * 0.75;
  const pts = front
    ? [
        [bx, by],
        [bx - 6 * k, by + side * 16 * k],
        [bx - 16 * k, by + side * 20 * k],
      ]
    : [
        [bx, by],
        [bx - 14 * k, by + side * 26 * k],
        [bx + 22 * k, by + side * 34 * k],
        [bx + 44 * k, by + side * 30 * k],
      ];
  const d = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")}`;
  const [fx, fy] = pts[pts.length - 1];
  const toes = [-0.5, 0, 0.5];
  const base = front ? Math.PI * 0.85 : 0.15;
  return (
    <motion.g initial={false} animate={{ opacity: k > 0 ? 1 : 0 }} transition={{ duration: 0.3 }}>
      <path d={d} fill="none" stroke={line} strokeWidth={(front ? 6 : 8.5) * Math.max(0.5, k)} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={(front ? 3.6 : 6) * Math.max(0.5, k)} strokeLinecap="round" strokeLinejoin="round" />
      {toes.map((a, i) => {
        const dir = base + a * 0.6;
        const len = (front ? 7 : 12) * k;
        return <line key={i} x1={fx} y1={fy} x2={fx + cos(dir) * len} y2={fy + side * sin(dir) * len} stroke={line} strokeWidth={2} strokeLinecap="round" />;
      })}
    </motion.g>
  );
}

function Scene({ s }: { s: number }) {
  const t = useText();
  const cy = 130;
  const cx = X[s];
  const rx = BODY_RX[s];
  const ry = BODY_RY[s];
  const frogLike = s >= 5;
  const color = frogLike ? "var(--bio-leaf)" : "var(--bio-wood)";
  const line = frogLike ? "var(--bio-leaf-deep)" : "var(--bio-wood-deep)";
  const tail = TAIL[s];
  const tw = TAIL_W[s];
  const tx0 = cx + rx * 0.7;
  return (
    <svg viewBox="0 0 560 260" className="mx-auto block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(META_STAGES[s].name)}>
      <rect x={0} y={0} width={560} height={260} rx={18} fill="color-mix(in oklab, var(--bio-water) 22%, var(--raised))" />
      {/* bank with grass appears at the end */}
      <motion.g initial={false} animate={{ opacity: s >= 5 ? 1 : 0.0, x: s >= 5 ? 0 : -40 }} transition={{ duration: 0.5 }}>
        <path d="M0 0 L 210 0 C 190 60, 230 120, 196 180 C 180 210, 200 240, 190 260 L 0 260 Z" fill="color-mix(in oklab, var(--bio-soil) 55%, var(--raised))" />
        <g stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinecap="round">
          {[30, 60, 92, 130, 40, 110, 160].map((x, i) => (
            <path key={i} d={`M${x} ${40 + (i % 3) * 70} l -4 -12 M${x} ${40 + (i % 3) * 70} l 4 -14 M${x} ${40 + (i % 3) * 70} l 9 -9`} />
          ))}
        </g>
      </motion.g>
      {/* water plant */}
      <g stroke="var(--bio-leaf-deep)" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7}>
        <path d="M420 260 C 410 200, 440 160, 420 100 C 410 70, 430 40, 424 10" />
        <path d="M420 190 C 440 180, 456 170, 470 150" />
        <path d="M424 120 C 404 110, 392 96, 384 80" />
      </g>

      {/* spawn */}
      <motion.g initial={false} animate={{ opacity: s === 0 ? 1 : 0, scale: s === 0 ? 1 : 0.6 }} transition={{ duration: 0.4 }} style={{ transformOrigin: "300px 130px" }}>
        {[
          [270, 104],
          [296, 98],
          [322, 106],
          [258, 128],
          [284, 124],
          [310, 128],
          [336, 132],
          [270, 152],
          [296, 150],
          [322, 156],
          [286, 174],
          [312, 178],
          [246, 152],
          [348, 112],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={13} fill="color-mix(in oklab, var(--bio-vacuole) 70%, var(--raised))" stroke="var(--bio-water-deep)" strokeWidth={1.2} opacity={0.95} />
            <circle cx={x - 1} cy={y - 1} r={4.5} fill="var(--bio-outline)" />
            <circle cx={x - 2} cy={y - 2.5} r={1.2} fill="var(--raised)" opacity={0.7} />
          </g>
        ))}
      </motion.g>

      {/* the animal */}
      <motion.g initial={false} animate={{ opacity: s === 0 ? 0 : 1 }} transition={{ duration: 0.4 }}>
        {/* tail with fin */}
        <motion.path
          initial={false}
          animate={{
            d: `M${tx0} ${cy - tw} C ${tx0 + tail * 0.35} ${cy - tw * 1.6}, ${tx0 + tail * 0.75} ${cy - tw * 0.8}, ${tx0 + tail} ${cy} C ${tx0 + tail * 0.75} ${cy + tw * 0.8}, ${tx0 + tail * 0.35} ${cy + tw * 1.6}, ${tx0} ${cy + tw} Z`,
            opacity: tail > 0 ? 1 : 0,
          }}
          transition={spring}
          fill="color-mix(in oklab, var(--bio-wood) 60%, var(--raised))"
          stroke={line}
          strokeWidth={1.5}
        />
        <motion.path initial={false} animate={{ d: `M${tx0} ${cy} L ${tx0 + tail * 0.92} ${cy}`, opacity: tail > 0 ? 0.8 : 0 }} transition={spring} stroke={line} strokeWidth={2.4} />
        {/* legs */}
        {([1, -1] as const).map((side) => (
          <g key={`h${side}`}>
            <Leg side={side} k={HIND[s]} front={false} cx={cx} cy={cy} rx={rx} ry={ry} color={color} line={line} />
            <Leg side={side} k={FRONT[s]} front cx={cx} cy={cy} rx={rx} ry={ry} color={color} line={line} />
          </g>
        ))}
        {/* external gills */}
        {([1, -1] as const).map((side) => (
          <motion.g key={`g${side}`} initial={false} animate={{ opacity: GILLS[s] }} transition={{ duration: 0.3 }}>
            {[0, 1, 2].map((k) => (
              <path key={k} d={`M${cx - rx * 0.2 + k * 4} ${cy + side * ry * 0.8} q ${-6 + k * 4} ${side * 9}, ${-2 + k * 6} ${side * 15}`} fill="none" stroke="var(--bio-blood)" strokeWidth={2.6} strokeLinecap="round" />
            ))}
          </motion.g>
        ))}
        {/* body */}
        <motion.ellipse initial={false} animate={{ cx, rx, ry }} cy={cy} transition={spring} fill={color} stroke={line} strokeWidth={2} />
        {frogLike && (
          <g opacity={0.35} fill={line}>
            <ellipse cx={cx + 6} cy={cy - 6} rx={5} ry={3} />
            <ellipse cx={cx + 16} cy={cy + 8} rx={4} ry={2.6} />
            <ellipse cx={cx - 4} cy={cy + 10} rx={3} ry={2} />
          </g>
        )}
        {/* eyes */}
        {([1, -1] as const).map((side) => (
          <motion.g key={`e${side}`} initial={false} animate={{ x: cx - rx * 0.55, y: cy + side * ry * (s >= 4 ? 0.45 : 0.6) }} transition={spring}>
            <motion.circle r={EYE[s] + 1.8} initial={false} animate={{ r: EYE[s] + 1.8 }} fill={color} stroke={line} strokeWidth={1.4} />
            <motion.circle initial={false} animate={{ r: EYE[s] }} fill="var(--bio-outline)" />
          </motion.g>
        ))}
        {/* mouth: small horny jaws (tadpole) or wide mouth (frog) */}
        <motion.path initial={false} animate={{ d: s >= 5 ? `M${cx - rx + 2} ${cy - 12} Q ${cx - rx - 6} ${cy}, ${cx - rx + 2} ${cy + 12}` : `M${cx - rx + 1} ${cy - 3} Q ${cx - rx - 2} ${cy}, ${cx - rx + 1} ${cy + 3}` }} transition={spring} fill="none" stroke={line} strokeWidth={2} strokeLinecap="round" />
      </motion.g>

      {/* air bubble when it starts to use its lungs */}
      <AnimatePresence>
        {s === 4 && (
          <motion.g initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <circle cx={cx - 46} cy={70} r={6} fill="var(--raised)" stroke="var(--bio-water-deep)" strokeWidth={1.4} />
            <circle cx={cx - 38} cy={48} r={4} fill="var(--raised)" stroke="var(--bio-water-deep)" strokeWidth={1.4} />
            <circle cx={cx - 50} cy={30} r={3} fill="var(--raised)" stroke="var(--bio-water-deep)" strokeWidth={1.4} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

const ROWS: { key: keyof Omit<Stage, "name" | "when">; label: Text }[] = [
  { key: "breath", label: tx("Breathing", "Atmung") },
  { key: "food", label: tx("Food", "Nahrung") },
  { key: "move", label: tx("Moves with", "Fortbewegung") },
  { key: "home", label: tx("Lives in", "Lebensraum") },
];

/** Task picture: one stage of the metamorphosis, without the table. */
export function VertebrateMetaStage({ stage }: { stage: number }) {
  return <Scene s={stage} />;
}

export function VertebrateMetamorphosis() {
  const t = useText();
  const [s, setS] = useState(0);
  const st = META_STAGES[s];
  return (
    <div className="space-y-4">
      <Scene s={s} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setS(Math.max(0, s - 1))} disabled={s === 0} className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink disabled:opacity-40" aria-label={t(tx("Previous stage", "Vorherige Stufe"))}>
          <ChevronLeft className="size-4" />
        </button>
        <input type="range" min={0} max={6} step={1} value={s} onChange={(e) => setS(Number(e.target.value))} className="h-2 w-full cursor-pointer" style={{ accentColor: "var(--blob)" }} aria-label={t(tx("Stage of the metamorphosis", "Stufe der Metamorphose"))} />
        <button type="button" onClick={() => setS(Math.min(6, s + 1))} disabled={s === 6} className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-2 hover:text-ink disabled:opacity-40" aria-label={t(tx("Next stage", "Nächste Stufe"))}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="flex justify-between px-11 text-[11px] text-ink-3">
        {META_STAGES.map((_, i) => (
          <button key={i} type="button" onClick={() => setS(i)} className={cn("size-5 rounded-full text-center font-semibold", i === s ? "bg-blob text-white" : "hover:text-ink")}>
            {i + 1}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={s} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }} className="rounded-xl border border-line bg-surface">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line px-4 py-2.5">
            <span className="font-display text-[19px] font-bold">{t(st.name)}</span>
            <span className="text-[13px] text-ink-3">{t(st.when)}</span>
          </div>
          <dl className="divide-y divide-line">
            {ROWS.map((r) => (
              <div key={r.key} className="grid gap-0.5 px-4 py-2 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-3">
                <dt className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(r.label)}</dt>
                <dd className="text-[15px] text-ink">{t(st[r.key])}</dd>
              </div>
            ))}
          </dl>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
