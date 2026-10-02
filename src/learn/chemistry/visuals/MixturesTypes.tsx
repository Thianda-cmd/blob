"use client";

// Kinds of mixtures for the "mixtures" topic: a table "what is spread in what" with a particle
// picture of each kind (purple: the spread substance, grey: the substance around it), and the
// same pictures as small task visuals.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { MIX_TYPES, type MixType, type State } from "../mixtures-data";

// ---------------------------------------------------------------------------
// Particle pictures

const PW = 168;
const PH = 112;
const R = 4.2;

type Dot = { x: number; y: number; a: boolean };
type Pic = { dots: Dot[]; bubbles: { x: number; y: number; r: number }[] };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r1 = (v: number) => Math.round(v * 10) / 10;

/** Close-packed but jumbled, filling the box (a liquid seen from inside). */
function packed(rnd: () => number): { x: number; y: number }[] {
  const d = 2 * R + 0.9;
  const out: { x: number; y: number }[] = [];
  for (let row = 0, y = R + 2; y < PH - R; row++, y += d * 0.87) {
    for (let x = R + 2 + (row % 2 ? d / 2 : 0); x < PW - R; x += d) out.push({ x: r1(x + (rnd() - 0.5) * 2), y: r1(y + (rnd() - 0.5) * 2) });
  }
  return out;
}
/** A neat square grid (a solid). */
function grid(): { x: number; y: number }[] {
  const d = 2 * R + 0.6;
  const out: { x: number; y: number }[] = [];
  for (let y = R + 3; y < PH - R; y += d) for (let x = R + 3; x < PW - R; x += d) out.push({ x: r1(x), y: r1(y) });
  return out;
}
/** Far apart (a gas). */
function sparse(rnd: () => number, n: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let tries = 0; out.length < n && tries < 4000; tries++) {
    const p = { x: r1(R + 2 + rnd() * (PW - 2 * R - 4)), y: r1(R + 2 + rnd() * (PH - 2 * R - 4)) };
    if (out.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > 6 * R)) out.push(p);
  }
  return out;
}
/** A small blob of particles around (cx, cy): `round` for droplets, square for solid bits. */
function clump(cx: number, cy: number, k: number, round: boolean): { x: number; y: number }[] {
  const d = 2 * R + 0.4;
  const out: { x: number; y: number }[] = [];
  if (round) {
    out.push({ x: cx, y: cy });
    for (let i = 0; i < Math.min(6, k - 1); i++) out.push({ x: r1(cx + d * Math.cos((i * Math.PI) / 3)), y: r1(cy + d * Math.sin((i * Math.PI) / 3)) });
  } else {
    const side = Math.ceil(Math.sqrt(k));
    for (let i = 0; i < k; i++) out.push({ x: r1(cx + ((i % side) - (side - 1) / 2) * d), y: r1(cy + (Math.floor(i / side) - (side - 1) / 2) * d) });
  }
  return out;
}
const away = (p: { x: number; y: number }, centres: { x: number; y: number }[], dist: number) => centres.every((c) => Math.hypot(c.x - p.x, c.y - p.y) > dist);

const CENTRES = [
  { x: 40, y: 34 },
  { x: 118, y: 30 },
  { x: 78, y: 80 },
  { x: 140, y: 84 },
];

export function mixPicture(type: MixType): Pic {
  const rnd = seeded(type.length * 31 + 7);
  const dots = (list: { x: number; y: number }[], a: boolean) => list.map((p) => ({ ...p, a }));
  switch (type) {
    case "solution": {
      const all = packed(rnd);
      return { dots: all.map((p, i) => ({ ...p, a: i % 5 === 2 })), bubbles: [] };
    }
    case "alloy": {
      const all = grid();
      return { dots: all.map((p) => ({ ...p, a: rnd() < 0.35 })), bubbles: [] };
    }
    case "gasmix": {
      const all = sparse(rnd, 18);
      return { dots: all.map((p, i) => ({ ...p, a: i % 2 === 0 })), bubbles: [] };
    }
    case "suspension":
    case "emulsion": {
      const round = type === "emulsion";
      const c = CENTRES.slice(0, 3);
      const around = packed(rnd).filter((p) => away(p, c, round ? 15 : 17));
      return { dots: [...dots(around, false), ...c.flatMap((q) => dots(clump(q.x, q.y, round ? 7 : 9, round), true))], bubbles: [] };
    }
    case "smoke":
    case "fog": {
      const round = type === "fog";
      const c = CENTRES;
      const gas = sparse(rnd, 14).filter((p) => away(p, c, 18));
      return { dots: [...dots(gas, false), ...c.flatMap((q) => dots(clump(q.x, q.y, round ? 7 : 4, round), true))], bubbles: [] };
    }
    case "foam": {
      const b = [
        { x: 42, y: 40, r: 22 },
        { x: 112, y: 36, r: 20 },
        { x: 84, y: 86, r: 17 },
      ];
      const liquid = packed(rnd).filter((p) => b.every((q) => Math.hypot(q.x - p.x, q.y - p.y) > q.r + R));
      const gas = b.flatMap((q) => [
        { x: r1(q.x - q.r * 0.35), y: r1(q.y - q.r * 0.2), a: true },
        { x: r1(q.x + q.r * 0.3), y: r1(q.y + q.r * 0.3), a: true },
      ]);
      return { dots: [...dots(liquid, false), ...gas], bubbles: b };
    }
    case "solidmix": {
      // Grains: blocks of one substance next to blocks of the other.
      const out: Dot[] = [];
      const bw = PW / 4;
      const bh = PH / 2;
      const kinds = [true, false, false, true, false, true, true, false];
      for (let i = 0; i < 8; i++) {
        const gx = (i % 4) * bw;
        const gy = Math.floor(i / 4) * bh;
        const d = 2 * R + 0.6;
        for (let y = gy + R + 3; y < gy + bh - R; y += d) for (let x = gx + R + 3; x < gx + bw - R; x += d) out.push({ x: r1(x), y: r1(y), a: kinds[i] });
      }
      return { dots: out, bubbles: [] };
    }
  }
}

/** A circle cut-out "under the microscope". */
export function MixPicture({ type, className }: { type: MixType; className?: string }) {
  const t = useText();
  const id = useId();
  const pic = mixPicture(type);
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} className={cn("block h-auto w-full", className)} role="img" aria-label={t(tx("Particle picture of a mixture", "Teilchenbild eines Gemischs"))}>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={1} y={1} width={PW - 2} height={PH - 2} rx={12} />
        </clipPath>
      </defs>
      <rect x={1} y={1} width={PW - 2} height={PH - 2} rx={12} fill="var(--surface)" stroke="var(--line-2)" strokeWidth={1.5} />
      <g clipPath={`url(#${id}-clip)`}>
        {pic.bubbles.map((b, i) => (
          <circle key={`b${i}`} cx={b.x} cy={b.y} r={b.r} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1} />
        ))}
        {pic.dots.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={R} fill={d.a ? "var(--blob)" : "color-mix(in oklab, var(--ink-3) 60%, var(--surface))"} />
        ))}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The table: what is spread (rows) in what (columns)

const STATES: State[] = ["s", "l", "g"];
const STATE_LABEL: Record<State, Text> = { s: tx("solid", "fest"), l: tx("liquid", "flüssig"), g: tx("gas", "gasförmig") };

/** Kinds in each cell: [heterogeneous, homogeneous]. */
const CELLS: Record<`${State}${State}`, [MixType | null, MixType | null]> = {
  ss: ["solidmix", "alloy"],
  sl: ["suspension", "solution"],
  sg: ["smoke", null],
  ls: [null, null],
  ll: ["emulsion", "solution"],
  lg: ["fog", null],
  gs: ["foam", null],
  gl: ["foam", "solution"],
  gg: [null, "gasmix"],
};

const CELL_EXAMPLES: Partial<Record<`${State}${State}${"het" | "hom"}`, Text[]>> = {
  sshet: [tx("muesli", "Müsli"), tx("granite", "Granit"), tx("sand with iron filings", "Sand mit Eisenspänen")],
  sshom: [tx("brass", "Messing"), tx("bronze", "Bronze"), tx("steel", "Stahl")],
  slhet: [tx("muddy water", "Schlammwasser"), tx("orange juice with pulp", "Orangensaft mit Fruchtfleisch"), tx("blood", "Blut")],
  slhom: [tx("salt water", "Salzwasser"), tx("sugar water", "Zuckerwasser"), tx("sea water", "Meerwasser")],
  sghet: [tx("smoke", "Rauch"), tx("dust in the air", "Staub in der Luft")],
  llhet: [tx("milk", "Milch"), tx("mayonnaise", "Mayonnaise"), tx("hand cream", "Handcreme")],
  llhom: [tx("vinegar (acetic acid in water)", "Essig (Essigsäure in Wasser)"), tx("alcohol in water", "Alkohol in Wasser")],
  lghet: [tx("fog", "Nebel"), tx("clouds", "Wolken"), tx("spray", "Sprühnebel")],
  gshet: [tx("polystyrene", "Styropor"), tx("pumice", "Bimsstein")],
  glhet: [tx("soap suds", "Seifenschaum"), tx("whipped cream", "Schlagsahne")],
  glhom: [tx("carbon dioxide in mineral water", "Kohlenstoffdioxid in Mineralwasser")],
  gghom: [tx("air", "Luft")],
};

export function MixturesTypes() {
  const t = useText();
  const scope = useId();
  const [cell, setCell] = useState<`${State}${State}`>("sl");
  const [hom, setHom] = useState(false);
  const [het, homType] = CELLS[cell];
  const showHom = hom ? homType !== null || het === null : het === null;
  const type = (showHom ? homType : het) ?? het ?? homType;
  const examples = CELL_EXAMPLES[`${cell}${showHom ? "hom" : "het"}`] ?? [];
  const both = het !== null && homType !== null;

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div className="space-y-2">
        <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-1.5 text-[12.5px]">
          <span className="self-end pb-1 pr-1 text-[10.5px] leading-tight text-ink-3">
            {t(tx("spread ↓ in →", "verteilt ↓ in →"))}
          </span>
          {STATES.map((s) => (
            <span key={s} className="pb-1 text-center font-semibold text-ink-2">
              {t(STATE_LABEL[s])}
            </span>
          ))}
          {STATES.map((a) => (
            <Row key={a} a={a} cell={cell} onPick={(c) => setCell(c)} scope={scope} />
          ))}
        </div>
        <p className="text-[12px] leading-snug text-ink-3">{t(tx("Rows: the substance that is spread out. Columns: the substance it is spread in.", "Zeilen: der Stoff, der verteilt ist. Spalten: der Stoff, in dem er verteilt ist."))}</p>
      </div>

      <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
        {type ? (
          <>
            {both && (
              <div className="inline-flex rounded-lg border border-line p-0.5">
                {[false, true].map((h) => (
                  <button
                    key={String(h)}
                    type="button"
                    onClick={() => setHom(h)}
                    className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", hom === h ? "text-ink" : "text-ink-3 hover:text-ink")}
                  >
                    {hom === h && <motion.span layoutId={`${scope}-hom`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
                    <span className="relative">{h ? t(tx("homogeneous", "homogen")) : t(tx("heterogeneous", "heterogen"))}</span>
                  </button>
                ))}
              </div>
            )}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={`${cell}-${type}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }} className="space-y-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-display text-[24px] font-semibold text-blob-ink">{t(MIX_TYPES[type].name)}</span>
                  <span className="text-[12.5px] font-medium text-ink-3">
                    {t(MIX_TYPES[type].homogeneous ? tx("homogeneous", "homogen") : tx("heterogeneous", "heterogen"))}
                  </span>
                </div>
                <div className="mx-auto max-w-[280px]">
                  <MixPicture type={type} />
                </div>
                <p className="text-[14px] leading-relaxed text-ink-2">{t(MIX_TYPES[type].what)}</p>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((e) => (
                    <span key={t(e)} className="rounded-full bg-hover px-2.5 py-1 text-[12.5px] text-ink">
                      {t(e)}
                    </span>
                  ))}
                </div>
                <p className="text-[12.5px] leading-snug text-ink-3">
                  {MIX_TYPES[type].homogeneous
                    ? t(tx("Homogeneous: looks the same everywhere, even under a microscope.", "Homogen: überall gleich, selbst unter dem Mikroskop."))
                    : t(tx("Heterogeneous: the parts can be seen, at least with a magnifier or microscope.", "Heterogen: Die Bestandteile sind erkennbar, zumindest mit Lupe oder Mikroskop."))}
                </p>
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <p className="text-[14px] text-ink-2">{t(tx("No name you need to know for this one.", "Dafür brauchst du keinen eigenen Namen."))}</p>
        )}
      </div>
    </div>
  );
}

function Row({ a, cell, onPick, scope }: { a: State; cell: string; onPick: (c: `${State}${State}`) => void; scope: string }) {
  const t = useText();
  return (
    <>
      <span className="self-center pr-1 text-right font-semibold text-ink-2">{t(STATE_LABEL[a])}</span>
      {STATES.map((b) => {
        const key = `${a}${b}` as `${State}${State}`;
        const [het, hom] = CELLS[key];
        const on = cell === key;
        const empty = !het && !hom;
        return (
          <button
            key={key}
            type="button"
            disabled={empty}
            onClick={() => onPick(key)}
            className={cn(
              "relative min-h-[54px] rounded-lg border px-1.5 py-1.5 text-center leading-tight transition-colors",
              on ? "border-transparent text-white" : empty ? "border-dashed border-line text-ink-3" : "border-line bg-raised text-ink hover:border-blob/50",
            )}
          >
            {on && <motion.span layoutId={`${scope}-cell`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
            <span className="relative block text-[12px] font-semibold">
              {empty ? "–" : [het, hom].filter(Boolean).map((x) => t(MIX_TYPES[x!].name)).filter((v, i, arr) => arr.indexOf(v) === i).join(" / ")}
            </span>
          </button>
        );
      })}
    </>
  );
}

/** Task picture: one mixture kind under the "microscope". */
export function MixturesPicture({ type }: { type: MixType }) {
  return (
    <div className="mx-auto max-w-[300px]">
      <MixPicture type={type} />
    </div>
  );
}

