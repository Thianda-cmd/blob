"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Expand, PawPrint, Shuffle, Waves, Wind, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { DISPERSAL, MODES, plantById, type DispersalPlant, type Mode } from "@/learn/biology/topics/flowers-seeds/data";
import { cn } from "@/lib/utils";
import { mirror } from "./FlowerKit";

// How fruits and seeds travel: small schematic drawings of each fruit and a sorter where the
// student decides for each plant whether wind, animals, water or the plant itself spreads it.

const W = "var(--bio-wood)";
const WD = "var(--bio-wood-deep)";
const O = "var(--bio-outline)";

function Spines({ cx, cy, r, n }: { cx: number; cy: number; r: number; n: number }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * (r - 2);
    const y1 = cy + Math.sin(a) * (r - 2);
    const x2 = cx + Math.cos(a) * (r + 8);
    const y2 = cy + Math.sin(a) * (r + 8);
    const hx = x2 + Math.cos(a + 1.9) * 3;
    const hy = y2 + Math.sin(a + 1.9) * 3;
    out.push(<path key={i} d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} L ${hx.toFixed(1)} ${hy.toFixed(1)}`} fill="none" stroke={WD} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />);
  }
  return <>{out}</>;
}

const ICONS: Record<string, ReactNode> = {
  dandelion: (
    <g>
      {Array.from({ length: 11 }, (_, i) => {
        const a = ((-75 + i * 15) * Math.PI) / 180;
        const x = 40 + Math.sin(a) * 27;
        const y = 30 - Math.cos(a) * 22;
        return (
          <g key={i}>
            <line x1={40} y1={30} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke={O} strokeWidth={0.9} opacity={0.7} />
            <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={1.3} fill="var(--ink-3)" />
          </g>
        );
      })}
      <line x1={40} y1={30} x2={40} y2={58} stroke={O} strokeWidth={1.2} />
      <ellipse cx={40} cy={66} rx={2.8} ry={8} fill={W} stroke={WD} strokeWidth={1.2} />
    </g>
  ),
  maple: (
    <g>
      {[0, 1].map((k) => (
        <g key={k} transform={k ? mirror(80) : undefined}>
          <path d="M 36 62 C 26 58, 10 44, 9 24 C 9 14, 20 14, 25 26 C 29 38, 34 50, 39 57 Z" fill={W} stroke={WD} strokeWidth={1.3} opacity={0.9} />
          <path d="M 36 58 C 28 50, 16 36, 14 22 M 37 56 C 31 46, 24 34, 20 22" fill="none" stroke={WD} strokeWidth={0.8} opacity={0.6} />
          <ellipse cx={34} cy={62} rx={7} ry={5.5} fill={W} stroke={WD} strokeWidth={1.4} />
        </g>
      ))}
    </g>
  ),
  linden: (
    <g>
      <path d="M 12 10 C 30 6, 54 26, 64 44 C 66 50, 60 53, 55 48 C 44 36, 26 24, 12 10 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
      <path d="M 16 12 C 32 18, 48 32, 59 47" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={0.9} opacity={0.7} />
      <path d="M 38 28 L 40 52 M 40 52 L 33 62 M 40 52 L 42 66 M 40 52 L 50 60" fill="none" stroke={WD} strokeWidth={1.3} strokeLinecap="round" />
      {[
        [33, 64],
        [42, 69],
        [51, 62],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={4.8} fill={W} stroke={WD} strokeWidth={1.2} />
      ))}
    </g>
  ),
  birch: (
    <g>
      {[
        [40, 36, 1],
        [20, 62, 0.6],
        [60, 64, 0.6],
      ].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <ellipse cx={-11} cy={0} rx={11} ry={9} fill="var(--bio-bone)" stroke={WD} strokeWidth={1.2} />
          <ellipse cx={11} cy={0} rx={11} ry={9} fill="var(--bio-bone)" stroke={WD} strokeWidth={1.2} />
          <ellipse cx={0} cy={0} rx={4.5} ry={8} fill={W} stroke={WD} strokeWidth={1.3} />
          <path d="M -1.5 -8 L -3 -13 M 1.5 -8 L 3 -13" stroke={WD} strokeWidth={1.1} strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  burdock: (
    <g>
      <Spines cx={40} cy={46} r={15} n={20} />
      <circle cx={40} cy={46} r={15} fill={W} stroke={WD} strokeWidth={1.4} />
      {[-6, -3, 0, 3, 6].map((dx) => (
        <line key={dx} x1={40 + dx} y1={33} x2={40 + dx * 1.4} y2={22} stroke="var(--bio-petal-deep)" strokeWidth={2} strokeLinecap="round" />
      ))}
    </g>
  ),
  cherry: (
    <g>
      <path d="M 30 44 C 32 30, 38 18, 46 10 M 51 48 C 50 34, 48 20, 46 10" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M 46 10 C 54 4, 66 6, 70 12 C 62 16, 52 16, 46 10 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      <circle cx={29} cy={57} r={13.5} fill="var(--bio-blood)" stroke={O} strokeWidth={1.4} />
      <circle cx={52} cy={60} r={12.5} fill="var(--bio-blood)" stroke={O} strokeWidth={1.4} />
      <path d="M 21 52 Q 23 47 28 46" fill="none" stroke="var(--raised)" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d="M 45 56 Q 47 51 52 50" fill="none" stroke="var(--raised)" strokeWidth={2.2} strokeLinecap="round" opacity={0.75} />
    </g>
  ),
  oak: (
    <g>
      <line x1={40} y1={14} x2={40} y2={24} stroke={WD} strokeWidth={2} strokeLinecap="round" />
      <ellipse cx={40} cy={50} rx={12.5} ry={18} fill={W} stroke={WD} strokeWidth={1.4} />
      <path d="M 40 68 L 40 72" stroke={WD} strokeWidth={2} strokeLinecap="round" />
      <path d="M 24 38 C 24 22, 56 22, 56 38 Q 40 45 24 38 Z" fill={WD} stroke={O} strokeWidth={1.2} />
      {[
        [31, 31],
        [37, 28],
        [43, 28],
        [49, 31],
        [34, 36],
        [40, 34],
        [46, 36],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill={W} opacity={0.8} />
      ))}
    </g>
  ),
  hazel: (
    <g>
      <circle cx={40} cy={52} r={15} fill={W} stroke={WD} strokeWidth={1.4} />
      <ellipse cx={40} cy={63} rx={8} ry={3.5} fill="var(--bio-bone)" stroke={WD} strokeWidth={1} />
      <path d="M 40 52 C 36 46, 36 41, 40 37" fill="none" stroke={WD} strokeWidth={0.8} opacity={0.6} />
      <path d="M 22 46 L 20 36 L 26 38 L 25 28 L 32 33 L 33 22 L 40 30 L 47 22 L 48 33 L 55 28 L 54 38 L 60 36 L 58 46 C 50 40, 30 40, 22 46 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} strokeLinejoin="round" />
    </g>
  ),
  rowan: (
    <g>
      <path d="M 40 8 L 40 26 M 40 26 L 26 40 M 40 26 L 54 40 M 40 26 L 40 44 M 26 40 L 20 54 M 26 40 L 30 58 M 54 40 L 60 54 M 54 40 L 50 58" fill="none" stroke={WD} strokeWidth={1.3} strokeLinecap="round" />
      {[
        [20, 56],
        [31, 60],
        [40, 47],
        [49, 60],
        [60, 56],
        [26, 42],
        [54, 42],
        [40, 64],
      ].map(([x, y]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={6.2} fill="var(--bio-blood)" stroke={O} strokeWidth={1.1} />
          <circle cx={x} cy={y + 4} r={1} fill={O} />
        </g>
      ))}
    </g>
  ),
  balsam: (
    <g>
      <path d="M 10 72 C 18 64, 22 58, 26 52" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2} strokeLinecap="round" />
      {[0, 1, 2, 3].map((k) => (
        <path
          key={k}
          d={`M 26 52 C ${30 + k * 3} ${40 - k * 4}, ${44 + k * 4} ${38 - k * 6}, ${44 + k * 3} ${48 - k * 5} C ${42 + k * 2} ${54 - k * 4}, ${36 + k} ${50 - k * 3}, ${38 + k * 2} ${45 - k * 3}`}
          fill="none"
          stroke="var(--bio-leaf)"
          strokeWidth={3.4}
          strokeLinecap="round"
        />
      ))}
      {[
        [58, 22],
        [66, 36],
        [60, 52],
        [52, 12],
      ].map(([x, y], i) => (
        <g key={i}>
          <line x1={x - 9} y1={y + 3} x2={x - 4} y2={y + 1.5} stroke="var(--ink-3)" strokeWidth={1} strokeLinecap="round" />
          <ellipse cx={x} cy={y} rx={3.2} ry={2.6} fill={WD} />
        </g>
      ))}
    </g>
  ),
  lupin: (
    <g>
      <path d="M 14 66 C 22 50, 30 40, 44 30 C 54 22, 64 18, 70 16 C 62 26, 52 36, 40 46 C 30 54, 22 60, 14 66 Z" fill={W} stroke={WD} strokeWidth={1.3} />
      <path d="M 14 66 C 18 54, 20 42, 28 30 C 34 22, 40 18, 46 16 C 44 26, 38 38, 30 48 C 24 56, 18 62, 14 66 Z" fill="var(--bio-bone)" stroke={WD} strokeWidth={1.3} />
      {[
        [26, 46],
        [33, 37],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={3} fill={WD} />
      ))}
      {[
        [58, 50],
        [66, 60],
        [50, 62],
      ].map(([x, y]) => (
        <g key={x}>
          <line x1={x - 8} y1={y - 5} x2={x - 4} y2={y - 2.5} stroke="var(--ink-3)" strokeWidth={1} strokeLinecap="round" />
          <circle cx={x} cy={y} r={3} fill={WD} />
        </g>
      ))}
    </g>
  ),
  coconut: (
    <g>
      <ellipse cx={40} cy={44} rx={23} ry={18} fill={W} stroke={WD} strokeWidth={1.5} />
      {[-12, -4, 4, 12].map((dx) => (
        <path key={dx} d={`M ${40 + dx} 27 C ${40 + dx * 1.5} 38, ${40 + dx * 1.5} 50, ${40 + dx} 61`} fill="none" stroke={WD} strokeWidth={0.8} opacity={0.6} />
      ))}
      <path d="M 4 56 Q 12 51 20 56 T 36 56 T 52 56 T 68 56 T 84 56 L 84 80 L 0 80 L 0 56 Z" fill="var(--bio-water)" opacity={0.55} />
      <path d="M 4 56 Q 12 51 20 56 T 36 56 T 52 56 T 68 56 T 84 56" fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.5} />
    </g>
  ),
  waterlily: (
    <g>
      <path d="M 10 60 C 10 50, 30 46, 38 52 L 32 58 L 42 58 C 46 66, 24 72, 10 60 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      <ellipse cx={54} cy={44} rx={13} ry={10} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.3} />
      <ellipse cx={54} cy={45} rx={4.5} ry={3.5} fill={W} stroke={WD} strokeWidth={1.1} />
      <path d="M 48 39 Q 51 36 55 36" fill="none" stroke="var(--raised)" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      <path d="M 2 58 Q 10 53 18 58 T 34 58 T 50 58 T 66 58 T 82 58" fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.5} />
    </g>
  ),
};

/** A fruit or seed with its way of travelling, as a small drawing (80 × 80). */
export function DispersalIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={cn("block", className)} aria-hidden>
      {ICONS[id]}
    </svg>
  );
}

/** Task picture: the fruit drawing with the plant's name. */
export function FlowerFruitPicture({ id }: { id: string }) {
  const t = useText();
  const p = plantById(id);
  return (
    <figure className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-1">
      <DispersalIcon id={id} className="w-28" />
      <figcaption className="text-[14px] font-semibold text-ink">{t(p.name)}</figcaption>
    </figure>
  );
}

const MODE_ICON: Record<Mode, typeof Wind> = { wind: Wind, animal: PawPrint, self: Expand, water: Waves };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ORDER: Mode[] = ["wind", "animal", "self", "water"];
const ROUND = 6;

function deal(round: number): string[] {
  const rng = createRng(round * 7919 + 31);
  // One of each way of travelling, then two more.
  const first = ORDER.map((m) => rng.pick(DISPERSAL.filter((p) => p.mode === m)).id);
  const rest = rng.shuffle(DISPERSAL.filter((p) => !first.includes(p.id))).slice(0, ROUND - first.length).map((p) => p.id);
  return rng.shuffle([...first, ...rest]);
}

/** A small celebration for each way of travelling. */
const HOORAY: Record<Mode, { x?: number[]; y?: number[]; rotate?: number[] }> = {
  wind: { x: [0, 14, 22, 0], y: [0, -16, -6, 0], rotate: [0, 20, -10, 0] },
  animal: { y: [0, -12, 0, -6, 0] },
  self: { rotate: [0, -12, 12, -8, 0] },
  water: { y: [0, 4, -3, 2, 0], rotate: [0, 4, -4, 0] },
};

export function FlowerDispersal() {
  const t = useText();
  const reduce = useReducedMotion();
  const [round, setRound] = useState(1);
  const [cards, setCards] = useState(() => deal(1));
  const [picks, setPicks] = useState<Record<string, Mode>>({});
  const answered = Object.keys(picks).length;
  const right = cards.filter((id) => picks[id] === plantById(id).mode).length;

  const next = () => {
    setRound(round + 1);
    setCards(deal(round + 1));
    setPicks({});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-2">
          {answered < ROUND
            ? t(tx(`How does each one travel? ${answered} of ${ROUND} sorted`, `Wie reist jede Frucht? ${answered} von ${ROUND} sortiert`))
            : t(tx(`${right} of ${ROUND} right`, `${right} von ${ROUND} richtig`))}
        </div>
        <button type="button" onClick={next} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("New round", "Neue Runde"))}
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {cards.map((id, n) => (
            <Card key={`${round}-${id}`} plant={plantById(id)} picked={picks[id]} onPick={(m) => setPicks((p) => ({ ...p, [id]: m }))} index={n} reduce={!!reduce} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Card({ plant, picked, onPick, index, reduce }: { plant: DispersalPlant; picked?: Mode; onPick: (m: Mode) => void; index: number; reduce: boolean }) {
  const t = useText();
  const done = picked !== undefined;
  const ok = done && picked === plant.mode;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32, delay: index * 0.03 }}
      className={cn("rounded-xl border bg-surface p-3", !done ? "border-line" : ok ? "border-ok/40 bg-ok/[0.05]" : "border-danger/30 bg-danger/[0.04]")}
    >
      <div className="flex items-center gap-3">
        <motion.div className="shrink-0" animate={ok && !reduce ? HOORAY[plant.mode] : { x: 0, y: 0, rotate: 0 }} transition={{ duration: 0.9, ease: "easeInOut" }}>
          <DispersalIcon id={plant.id} className="size-14" />
        </motion.div>
        <div className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{t(plant.name)}</div>
        {done && (
          <motion.span
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 520, damping: 16 }}
            className={cn("grid size-6 shrink-0 place-items-center rounded-full text-white", ok ? "bg-ok" : "bg-danger")}
          >
            {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
          </motion.span>
        )}
      </div>
      {!done ? (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {ORDER.map((m) => {
            const Icon = MODE_ICON[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => onPick(m)}
                className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-line bg-raised px-1 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-blob/50 hover:bg-blob-soft/50 hover:text-ink"
              >
                <Icon className="size-4" />
                {t(MODES[m].short)}
              </button>
            );
          })}
        </div>
      ) : (
        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1.5 overflow-hidden text-[13px] leading-snug text-ink-2">
          <span className="font-semibold text-ink">{cap(t(MODES[plant.mode].kind))}.</span>{" "}
          {t(plant.why)}
        </motion.p>
      )}
    </motion.div>
  );
}
