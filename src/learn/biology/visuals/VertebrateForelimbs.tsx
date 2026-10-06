"use client";

// Homologous forelimbs: human arm, whale flipper, bat wing and mole digging hand. The same bones
// in the same order, each bone group in the same colour in all four. Tap a bone to light it up
// everywhere. As a task picture: one limb in neutral bone colour with one bone group asked.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type BoneId = "humerus" | "radius" | "ulna" | "carpals" | "metacarpals" | "phalanges";
export type LimbId = "human" | "whale" | "bat" | "mole";

export const BONES: Record<BoneId, { name: Text; color: string }> = {
  humerus: { name: tx("upper arm bone (humerus)", "Oberarmknochen"), color: "var(--bio-mito)" },
  radius: { name: tx("radius", "Speiche"), color: "var(--bio-water)" },
  ulna: { name: tx("ulna", "Elle"), color: "var(--bio-leaf)" },
  carpals: { name: tx("wrist bones (carpals)", "Handwurzelknochen"), color: "var(--bio-sun)" },
  metacarpals: { name: tx("palm bones (metacarpals)", "Mittelhandknochen"), color: "var(--bio-petal)" },
  phalanges: { name: tx("finger bones (phalanges)", "Fingerknochen"), color: "var(--bio-nucleus)" },
};
export const BONE_IDS = Object.keys(BONES) as BoneId[];

export const LIMBS: Record<LimbId, { name: Text; use: Text; x: number; w: number }> = {
  human: { name: tx("Human", "Mensch"), use: tx("grasping", "Greifen"), x: 0, w: 130 },
  whale: { name: tx("Whale", "Wal"), use: tx("swimming (flipper)", "Schwimmen (Flosse)"), x: 130, w: 140 },
  bat: { name: tx("Bat", "Fledermaus"), use: tx("flying (wing membrane)", "Fliegen (Flughaut)"), x: 270, w: 220 },
  mole: { name: tx("Mole", "Maulwurf"), use: tx("digging (shovel hand)", "Graben (Grabschaufel)"), x: 490, w: 150 },
};
export const LIMB_IDS = Object.keys(LIMBS) as LimbId[];

type Seg = { b: BoneId; d: string; w: number };
const L = "var(--bio-outline)";

/** Bone segments per limb, in local coordinates of the limb's panel (shoulder at the top). */
const SEGS: Record<LimbId, Seg[]> = {
  human: [
    { b: "humerus", d: "M65 26 L 65 128", w: 12 },
    { b: "radius", d: "M58 136 L 50 226", w: 7 },
    { b: "ulna", d: "M74 130 L 78 226", w: 7 },
    ...[
      [48, 234],
      [58, 232],
      [68, 232],
      [78, 234],
      [50, 244],
      [60, 244],
      [70, 244],
      [80, 244],
    ].map(([x, y]): Seg => ({ b: "carpals", d: `M${x} ${y} L ${x + 2} ${y + 1}`, w: 7 })),
    { b: "metacarpals", d: "M46 252 L 34 276", w: 5 },
    { b: "metacarpals", d: "M56 254 L 54 292", w: 5 },
    { b: "metacarpals", d: "M66 254 L 66 294", w: 5 },
    { b: "metacarpals", d: "M76 254 L 78 292", w: 5 },
    { b: "metacarpals", d: "M85 252 L 90 286", w: 5 },
    { b: "phalanges", d: "M32 282 L 26 298", w: 4.5 },
    { b: "phalanges", d: "M25 303 L 21 314", w: 4 },
    ...[
      [53, 299, -1],
      [66, 301, 0],
      [79, 299, 1],
      [91, 292, 2],
    ].flatMap(([x, y, s]): Seg[] => [
      { b: "phalanges", d: `M${x} ${y} L ${x + s * 1.2} ${y + 18}`, w: 4.5 },
      { b: "phalanges", d: `M${x + s * 1.5} ${y + 24} L ${x + s * 2.2} ${y + 36}`, w: 4 },
      { b: "phalanges", d: `M${x + s * 2.6} ${y + 41} L ${x + s * 3} ${y + 49}`, w: 3.6 },
    ]),
  ],
  whale: [
    { b: "humerus", d: "M70 28 L 70 72", w: 22 },
    { b: "radius", d: "M60 84 L 56 128", w: 15 },
    { b: "ulna", d: "M82 84 L 86 128", w: 15 },
    ...[
      [52, 142],
      [70, 142],
      [88, 142],
      [60, 160],
      [80, 160],
    ].map(([x, y]): Seg => ({ b: "carpals", d: `M${x} ${y} L ${x + 3} ${y}`, w: 11 })),
    ...[
      [46, 176, -4],
      [62, 178, -1],
      [78, 178, 1],
      [94, 176, 4],
    ].map(([x, y, s]): Seg => ({ b: "metacarpals", d: `M${x} ${y} L ${x + s} ${y + 18}`, w: 9 })),
    ...[
      [42, 3, -5],
      [61, 7, -2],
      [79, 8, 2],
      [98, 4, 6],
    ].flatMap(([x, n, s]): Seg[] => Array.from({ length: n }, (_, i) => ({ b: "phalanges" as BoneId, d: `M${x + s * (i + 0.6)} ${206 + i * 17} L ${x + s * (i + 1)} ${216 + i * 17}`, w: 7.5 - i * 0.5 }))),
  ],
  bat: [
    { b: "humerus", d: "M30 26 L 52 96", w: 9 },
    { b: "radius", d: "M56 102 L 112 188", w: 6 },
    { b: "ulna", d: "M60 98 L 76 128", w: 3 },
    { b: "carpals", d: "M114 192 L 118 194", w: 7 },
    { b: "carpals", d: "M120 186 L 122 186", w: 6 },
    { b: "metacarpals", d: "M118 186 L 122 172", w: 4 },
    { b: "phalanges", d: "M124 166 L 127 156", w: 3.5 },
    { b: "phalanges", d: "M128 152 L 129 145", w: 3 },
    { b: "metacarpals", d: "M122 196 L 196 206", w: 4.2 },
    { b: "metacarpals", d: "M122 200 L 194 252", w: 4.2 },
    { b: "metacarpals", d: "M120 202 L 164 286", w: 4 },
    { b: "metacarpals", d: "M116 202 L 120 290", w: 4 },
    { b: "phalanges", d: "M200 208 L 210 214", w: 3.4 },
    { b: "phalanges", d: "M198 256 L 208 290", w: 3.4 },
    { b: "phalanges", d: "M209 296 L 210 326", w: 3 },
    { b: "phalanges", d: "M166 291 L 172 322", w: 3.4 },
    { b: "phalanges", d: "M173 327 L 175 346", w: 3 },
    { b: "phalanges", d: "M120 296 L 118 324", w: 3.4 },
    { b: "phalanges", d: "M118 330 L 116 346", w: 3 },
  ],
  mole: [
    { b: "humerus", d: "M75 30 L 75 64", w: 30 },
    { b: "radius", d: "M62 80 L 58 124", w: 11 },
    { b: "ulna", d: "M90 76 L 96 124", w: 11 },
    ...[
      [52, 136],
      [68, 134],
      [84, 134],
      [100, 136],
      [60, 150],
      [78, 150],
      [96, 150],
    ].map(([x, y]): Seg => ({ b: "carpals", d: `M${x} ${y} L ${x + 3} ${y}`, w: 10 })),
    { b: "carpals", d: "M36 132 C 26 150, 26 172, 34 188", w: 8 },
    ...[
      [46, -6],
      [62, -2],
      [78, 0],
      [94, 3],
      [110, 7],
    ].map(([x, s]): Seg => ({ b: "metacarpals", d: `M${x} 166 L ${x + s} 182`, w: 9 })),
    ...[
      [40, -7],
      [60, -2],
      [78, 0],
      [97, 4],
      [117, 9],
    ].flatMap(([x, s]): Seg[] => [
      { b: "phalanges", d: `M${x} 194 L ${x + s * 0.5} 206`, w: 8 },
      { b: "phalanges", d: `M${x + s * 0.7} 214 L ${x + s} 224`, w: 7 },
    ]),
  ],
};

/** Soft outline of the living limb around the bones. */
const SKIN: Record<LimbId, string> = {
  human: "M50 18 C 80 14, 84 24, 82 60 L 92 230 C 102 250, 106 300, 98 340 C 80 352, 50 352, 40 338 L 16 316 C 14 300, 26 280, 34 262 L 40 230 L 46 60 Z",
  whale: "M44 20 C 80 12, 104 24, 104 60 C 112 120, 124 200, 112 270 C 104 320, 88 340, 72 330 C 50 320, 36 300, 32 260 C 26 200, 30 120, 44 20 Z",
  bat: "M24 22 C 40 30, 56 60, 66 100 L 120 186 L 212 214 C 218 250, 214 300, 212 330 C 200 336, 190 330, 176 348 C 160 340, 146 352, 120 350 C 100 352, 80 340, 60 344 C 40 320, 30 260, 24 200 Z",
  mole: "M46 22 C 80 14, 110 22, 108 60 L 114 130 C 132 150, 134 200, 128 232 C 110 244, 60 244, 34 232 C 18 200, 20 150, 40 130 L 44 60 Z",
};

/** Where to put a "?" for a bone group in each limb (local coordinates). */
const ASK_AT: Record<LimbId, Record<BoneId, [number, number]>> = {
  human: { humerus: [65, 78], radius: [52, 180], ulna: [78, 180], carpals: [64, 238], metacarpals: [66, 274], phalanges: [66, 330] },
  whale: { humerus: [70, 50], radius: [56, 106], ulna: [86, 106], carpals: [72, 150], metacarpals: [70, 186], phalanges: [66, 260] },
  bat: { humerus: [41, 60], radius: [84, 145], ulna: [68, 113], carpals: [116, 192], metacarpals: [158, 229], phalanges: [208, 300] },
  mole: { humerus: [75, 47], radius: [58, 102], ulna: [94, 100], carpals: [76, 142], metacarpals: [78, 174], phalanges: [78, 214] },
};

function Limb({ id, lit, neutral, ask, onPick }: { id: LimbId; lit: BoneId | null; neutral?: boolean; ask?: BoneId; onPick?: (b: BoneId) => void }) {
  const segs = SEGS[id];
  return (
    <g>
      <path d={SKIN[id]} fill="color-mix(in oklab, var(--bio-flesh) 35%, transparent)" stroke="var(--bio-flesh-deep)" strokeWidth={1.2} strokeDasharray={id === "bat" ? undefined : "4 4"} opacity={0.9} />
      {segs.map((s, i) => {
        const on = !lit || lit === s.b;
        const fill = neutral ? (ask === s.b ? "color-mix(in oklab, var(--blob) 30%, var(--bio-bone))" : "var(--bio-bone)") : BONES[s.b].color;
        return (
          <g key={i} style={{ opacity: on ? 1 : 0.18, transition: "opacity .25s" }} onClick={onPick ? () => onPick(s.b) : undefined} className={onPick ? "cursor-pointer" : undefined}>
            <path d={s.d} fill="none" stroke={L} strokeWidth={s.w + 2.2} strokeLinecap="round" />
            <path d={s.d} fill="none" stroke={fill} strokeWidth={s.w} strokeLinecap="round" />
          </g>
        );
      })}
      {id === "mole" &&
        [40, 60, 78, 97, 117].map((x, i) => {
          const s = [-7, -2, 0, 4, 9][i];
          return <path key={x} d={`M${x + s - 4} 228 L ${x + s * 1.3} 248 L ${x + s + 4} 228 Z`} fill="var(--bio-bone)" stroke={L} strokeWidth={1.2} opacity={lit ? 0.18 : 1} />;
        })}
    </g>
  );
}

function AskMarker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <motion.circle cx={x} cy={y} r={14} fill="none" stroke="var(--blob)" strokeWidth={2} initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.7, opacity: 0 }} transition={{ duration: 1.4, repeat: Infinity }} style={{ transformBox: "fill-box", transformOrigin: "center" }} />
      <circle cx={x} cy={y} r={12} fill="var(--blob)" stroke="var(--blob)" />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={14} fontWeight={700} fill="var(--paper)" style={{ fontFamily: "var(--font-sans)", pointerEvents: "none" }}>
        ?
      </text>
    </g>
  );
}

/** Task picture: one limb, neutral bone colour, one bone group asked with "?". */
export function VertebrateLimb({ limb, ask }: { limb: LimbId; ask: BoneId }) {
  const t = useText();
  const w = LIMBS[limb].w;
  const [x, y] = ASK_AT[limb][ask];
  return (
    <svg viewBox={`0 0 ${w} 360`} className="mx-auto block h-auto w-full" style={{ maxWidth: Math.round(w * 1.25) }} role="img" aria-label={t(tx(`Forelimb skeleton: ${(LIMBS[limb].name as { en: string }).en}`, `Skelett der Vordergliedmaße: ${(LIMBS[limb].name as { de: string }).de}`))}>
      <Limb id={limb} lit={null} neutral ask={ask} />
      <AskMarker x={x} y={y} />
    </svg>
  );
}

export function VertebrateForelimbs() {
  const t = useText();
  const [lit, setLit] = useState<BoneId | null>(null);
  const toggle = (b: BoneId) => setLit(lit === b ? null : b);
  return (
    <div className="space-y-4">
      <svg viewBox="0 0 640 360" className="block h-auto w-full" style={{ maxWidth: 680 }} role="img" aria-label={t(tx("Forelimbs of human, whale, bat and mole", "Vordergliedmaßen von Mensch, Wal, Fledermaus und Maulwurf"))}>
        {LIMB_IDS.map((id) => (
          <g key={id} transform={`translate(${LIMBS[id].x} 0)`}>
            <Limb id={id} lit={lit} onPick={toggle} />
          </g>
        ))}
      </svg>
      <div className="grid grid-cols-4 gap-1 text-center">
        {LIMB_IDS.map((id) => (
          <div key={id} className="min-w-0">
            <div className="text-[13px] font-semibold text-ink sm:text-[14.5px]">{t(LIMBS[id].name)}</div>
            <div className="text-[11.5px] leading-tight text-ink-3 sm:text-[12.5px]">{t(LIMBS[id].use)}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {BONE_IDS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => toggle(b)}
            aria-pressed={lit === b}
            className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1 text-[13px] transition-colors", lit === b ? "border-blob bg-blob-soft text-ink" : "border-line bg-surface text-ink-2 hover:text-ink")}
          >
            <span className="size-3 shrink-0 rounded-full border border-[var(--bio-outline)]" style={{ background: BONES[b].color }} />
            {t(BONES[b].name)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={lit ?? "none"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="min-h-[3em] text-[14.5px] text-ink-2">
          {lit ? t(NOTE[lit]) : t(tx("Tap a bone or a colour. Same colour = same bone: one basic plan, four different jobs.", "Tipp auf einen Knochen oder eine Farbe. Gleiche Farbe = gleicher Knochen: ein Grundbauplan, vier verschiedene Aufgaben."))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

const NOTE: Record<BoneId, Text> = {
  humerus: tx("Upper arm bone: long in human and bat, short and broad in whale and mole, where it has to carry huge forces.", "Oberarmknochen: lang bei Mensch und Fledermaus, kurz und breit bei Wal und Maulwurf, wo er große Kräfte aushalten muss."),
  radius: tx("Radius: in the bat it forms almost the whole long forearm.", "Speiche: Bei der Fledermaus bildet sie fast den ganzen langen Unterarm."),
  ulna: tx("Ulna: in the bat it is thin and reduced; in the mole it is strong with a large lever for the digging muscles.", "Elle: Bei der Fledermaus ist sie dünn und zurückgebildet, beim Maulwurf kräftig mit einem großen Hebel für die Grabmuskeln."),
  carpals: tx("Wrist bones: the mole has an extra sickle-shaped bone that widens its shovel.", "Handwurzelknochen: Der Maulwurf hat einen zusätzlichen sichelförmigen Knochen, der seine Schaufel verbreitert."),
  metacarpals: tx("Palm bones: extremely long in the bat. They span the wing membrane.", "Mittelhandknochen: bei der Fledermaus extrem lang. Sie spannen die Flughaut auf."),
  phalanges: tx("Finger bones: the whale has many more of them than we do, making its flipper long and stiff.", "Fingerknochen: Der Wal hat viel mehr davon als wir, das macht seine Flosse lang und steif."),
};
