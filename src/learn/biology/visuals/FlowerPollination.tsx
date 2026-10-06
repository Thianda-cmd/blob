"use client";

import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "motion/react";
import { Check, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Bee, Bold, CherryFlower, PollenGrain } from "./FlowerKit";

// A bee visits a cherry blossom on tree A, carries pollen to a blossom on tree B (pollination),
// the pollen tube grows down the style (still no fertilisation) and finally a sperm cell fuses
// with the egg cell (fertilisation). Drag the bee or use the button.

const W = 640;
const H = 296;
const S = 0.6;
/** Where each flower's drawing starts (its 480 × 360 drawing is scaled by S). */
const FA = { x: 8, y: 54 };
const FB = { x: 344, y: 54 };
/** After pollination the view zooms in on the pistil of flower B. */
const FULL = `0 0 ${W} ${H}`;
const ZOOM = `${FB.x + 240 * S - 160} ${FB.y + 78 * S} 320 148`;
const at = (f: { x: number; y: number }, x: number, y: number) => [f.x + x * S, f.y + y * S] as const;

const BEE_START = [W / 2, 30] as const;
const BEE_A = at(FA, 262, 112);
const BEE_B = at(FB, 282, 78);
const BEE_AWAY = [W - 52, 30] as const;

/** The pollen tube in flower B (drawing units): from a grain on the stigma down the style to the ovule. */
const TUBE: [number, number][] = [
  [243, 89],
  [242, 120],
  [241.5, 160],
  [241, 200],
  [238, 212],
  [236, 218],
];
const tubePath = TUBE.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");

type Stage = 0 | 1 | 2 | 3 | 4;

const CAPTION: Record<Stage, Text> = {
  0: tx(
    "The bee is looking for nectar. Drag it to the blossom of cherry tree A, or press the button.",
    "Die Biene sucht Nektar. Zieh sie zur Blüte von Kirschbaum A oder drück auf den Knopf.",
  ),
  1: tx(
    "While the bee sips nectar it brushes past the anthers. Pollen sticks in its fur. Now off to tree B!",
    "Beim Nektarsaugen streift die Biene die Staubbeutel. Pollen bleibt in ihrem Pelz hängen. Jetzt ab zu Baum B!",
  ),
  2: tx(
    "**Pollination!** Pollen from tree A sticks to the sticky stigma of the blossom on tree B. Nothing has been fertilised yet.",
    "**Bestäubung!** Pollen von Baum A bleibt auf der klebrigen Narbe der Blüte von Baum B hängen. Befruchtet ist noch nichts.",
  ),
  3: tx(
    "A pollen grain germinates: a **pollen tube** grows down through the style to the ovule in the ovary.",
    "Ein Pollenkorn keimt: Ein **Pollenschlauch** wächst durch den Griffel bis zur Samenanlage im Fruchtknoten.",
  ),
  4: tx(
    "**Fertilisation!** A sperm cell from the pollen tube fuses with the egg cell. Only now can the ovule become a seed.",
    "**Befruchtung!** Eine Spermazelle aus dem Pollenschlauch verschmilzt mit der Eizelle. Erst jetzt kann aus der Samenanlage ein Samen werden.",
  ),
};

const ACTION: Record<Exclude<Stage, 4>, Text> = {
  0: tx("Fly to tree A", "Zu Baum A fliegen"),
  1: tx("Fly to tree B", "Zu Baum B fliegen"),
  2: tx("Let the pollen tube grow", "Pollenschlauch wachsen lassen"),
  3: tx("Fertilise", "Befruchten"),
};

export function FlowerPollination({ start = 0 }: { start?: Stage }) {
  const t = useText();
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>(start);
  const [note, setNote] = useState<Text | null>(null);
  const [run, setRun] = useState(0);

  const go = (to: Stage) => {
    setNote(null);
    setStage(to);
  };
  const advance = () => (stage < 4 ? go((stage + 1) as Stage) : reset());
  const reset = () => {
    setStage(0);
    setNote(null);
    setRun((r) => r + 1);
  };

  const bee = stage === 0 ? BEE_START : stage === 1 ? BEE_A : stage === 2 ? BEE_B : BEE_AWAY;

  function onDrop(_: unknown, info: PanInfo) {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = ((info.point.x - window.scrollX - r.left) / r.width) * W;
    const y = ((info.point.y - window.scrollY - r.top) / r.height) * H;
    const near = (p: readonly [number, number]) => Math.hypot(x - p[0], (y - p[1]) * 0.8) < 110;
    if (near(BEE_A) && x < W / 2) {
      if (stage === 0) go(1);
      else if (stage === 1) setNote(tx("The bee is already full of pollen. Off to the other tree!", "Die Biene ist schon voller Pollen. Ab zum anderen Baum!"));
    } else if (near(BEE_B) && x > W / 2) {
      if (stage === 1) go(2);
      else if (stage === 0) setNote(tx("The bee has no pollen with it yet. Visit tree A first!", "Die Biene hat noch keinen Pollen dabei. Flieg zuerst zu Baum A!"));
    }
  }

  const chip = (done: boolean, label: Text) => (
    <span
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
        done ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-3",
      )}
    >
      <span className={cn("grid size-4 place-items-center rounded-full", done ? "bg-blob text-white" : "border border-line-2")}>{done && <Check className="size-3" strokeWidth={3} />}</span>
      {t(label)}
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chip(stage >= 2, tx("Pollination", "Bestäubung"))}
        {chip(stage >= 4, tx("Fertilisation", "Befruchtung"))}
      </div>

      <div ref={box} className="relative mx-auto w-full touch-none select-none" style={{ maxWidth: 680, aspectRatio: `${W} / ${H}` }}>
        <motion.svg
          viewBox={FULL}
          initial={false}
          animate={{ viewBox: stage >= 3 ? ZOOM : FULL }}
          transition={reduce ? { duration: 0 } : { duration: 1.1, ease: "easeInOut" }}
          className="absolute inset-0 size-full"
          role="img" aria-label={t(tx("Two cherry blossoms on different trees and a bee", "Zwei Kirschblüten an verschiedenen Bäumen und eine Biene"))}
        >
          {/* flower A */}
          <g transform={`translate(${FA.x} ${FA.y}) scale(${S})`}>
            <CherryFlower part={false} />
          </g>
          {/* flower B */}
          <g transform={`translate(${FB.x} ${FB.y}) scale(${S})`}>
            <CherryFlower part={false} />
            <AnimatePresence>
              {stage >= 2 && (
                <motion.g key={`p${run}`} initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <PollenGrain x={243} y={87} r={3.4} />
                  <PollenGrain x={234} y={89} r={3.4} />
                  <PollenGrain x={249} y={90} r={3.4} />
                </motion.g>
              )}
            </AnimatePresence>
            {stage >= 3 && (
              <motion.path
                key={`t${run}`}
                d={tubePath}
                fill="none"
                stroke="var(--bio-pollen)"
                strokeWidth={3.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduce ? 0 : 1.8, delay: reduce ? 0 : 0.9, ease: "easeInOut" }}
              />
            )}
            {stage >= 4 && (
              <>
                <motion.circle
                  key={`s${run}`}
                  r={2.6}
                  fill="var(--bio-nucleus-deep)"
                  initial={{ cx: TUBE[0][0], cy: TUBE[0][1], opacity: 1 }}
                  animate={{ cx: [...TUBE.map((p) => p[0]), 240], cy: [...TUBE.map((p) => p[1]), 232], opacity: [1, 1, 1, 1, 1, 1, 0] }}
                  transition={{ duration: reduce ? 0 : 1.4, ease: "easeInOut" }}
                />
                <motion.circle
                  cx={240}
                  cy={228}
                  fill="none"
                  stroke="var(--blob)"
                  strokeWidth={2.5}
                  initial={{ r: 4, opacity: 0 }}
                  animate={{ r: [4, 18, 12], opacity: [0, 1, 0.9] }}
                  transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : 1.35 }}
                />
              </>
            )}
          </g>
          {/* tree labels */}
          {[
            [FA.x + 240 * S, tx("Cherry tree A", "Kirschbaum A")],
            [FB.x + 240 * S, tx("Cherry tree B", "Kirschbaum B")],
          ].map(([x, label]) => (
            <text key={String(x)} x={x as number} y={H - 3} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
              {t(label as Text)}
            </text>
          ))}
        </motion.svg>

        {/* the bee: an HTML layer so it can be dragged with mouse or finger */}
        <motion.div
          className="absolute z-10 -ml-8 -mt-6 w-16 cursor-grab active:cursor-grabbing"
          initial={false}
          animate={{ left: `${(bee[0] / W) * 100}%`, top: `${(bee[1] / H) * 100}%`, opacity: stage >= 3 ? 0 : 1 }}
          transition={{ type: "spring", stiffness: 90, damping: 15 }}
          drag={stage < 2}
          dragSnapToOrigin
          dragMomentum={false}
          onDragEnd={onDrop}
          whileDrag={{ scale: 1.15 }}
          aria-hidden
        >
          <motion.svg viewBox="-32 -24 64 48" className="block w-16" animate={reduce ? undefined : { y: [0, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}>
            <Bee pollen={stage === 1 ? 5 : stage >= 2 ? 2 : 0} />
          </motion.svg>
        </motion.div>
      </div>

      <div className="min-h-[4.5rem] rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14.5px] leading-snug text-ink-2" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p key={`${stage}-${note ? 1 : 0}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            {note ? <span className="text-ink">{t(note)}</span> : <Bold text={t(CAPTION[stage])} />}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={advance}
          className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white shadow-card transition-transform hover:brightness-110 active:scale-[0.98]"
        >
          {stage < 4 ? t(ACTION[stage as Exclude<Stage, 4>]) : t(tx("Once more", "Nochmal"))}
        </button>
        {stage > 0 && stage < 4 && (
          <button type="button" onClick={reset} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
          </button>
        )}
      </div>
    </div>
  );
}
