"use client";

// A deep lake in temperate climate through the year: spring and autumn circulation, summer
// and winter stagnation, explained by the density anomaly of water (densest at 4 °C).
// Lake cross-section plus temperature and oxygen profile; the profile alone serves tasks.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { Axes, Tag, path, scales, type Box } from "./EcoChart";

export type SeasonId = "spring" | "summer" | "autumn" | "winter";

type Season = {
  id: SeasonId;
  name: Text;
  state: Text;
  text: Text;
  temp: [number, number][];
  o2: [number, number][];
  mix: "full" | "top" | "none";
};

export const SEASONS: Season[] = [
  {
    id: "spring",
    name: tx("Spring", "Frühjahr"),
    state: tx("spring circulation", "Frühjahrszirkulation"),
    text: tx(
      "The ice melts and the surface water warms up to 4 °C. Now the whole lake has the same temperature and density, so the wind can mix it from top to bottom: oxygen gets down to the bottom, minerals come up.",
      "Das Eis schmilzt, das Oberflächenwasser erwärmt sich auf 4 °C. Jetzt hat der ganze See dieselbe Temperatur und Dichte, deshalb kann der Wind ihn von oben bis unten durchmischen: Sauerstoff gelangt bis zum Grund, Mineralstoffe kommen nach oben.",
    ),
    temp: [
      [0, 4.6],
      [30, 4],
    ],
    o2: [
      [0, 11.5],
      [30, 11],
    ],
    mix: "full",
  },
  {
    id: "summer",
    name: tx("Summer", "Sommer"),
    state: tx("summer stagnation", "Sommerstagnation"),
    text: tx(
      "The sun warms the top layer (epilimnion). Warm water is less dense and floats on the cold, dense water below (hypolimnion, about 4 to 5 °C). In between lies the thermocline (metalimnion), where the temperature drops fast. The layers don't mix: in the deep water decomposers use up the oxygen.",
      "Die Sonne erwärmt die obere Schicht (Epilimnion). Warmes Wasser hat eine geringere Dichte und schwimmt auf dem kalten, dichten Tiefenwasser (Hypolimnion, etwa 4 bis 5 °C). Dazwischen liegt die Sprungschicht (Metalimnion), in der die Temperatur rasch abfällt. Die Schichten mischen sich nicht: In der Tiefe verbrauchen Destruenten den Sauerstoff.",
    ),
    temp: [
      [0, 21],
      [6, 20],
      [9, 15],
      [12, 8],
      [15, 5.5],
      [30, 4.4],
    ],
    o2: [
      [0, 9.5],
      [8, 9.5],
      [12, 7],
      [16, 4],
      [24, 2],
      [30, 0.5],
    ],
    mix: "top",
  },
  {
    id: "autumn",
    name: tx("Autumn", "Herbst"),
    state: tx("autumn circulation", "Herbstzirkulation"),
    text: tx(
      "The surface water cools, becomes denser and sinks. As soon as the lake has the same temperature everywhere, autumn storms mix it completely: oxygen reaches the deep water again, minerals from the bottom come up.",
      "Das Oberflächenwasser kühlt ab, wird dichter und sinkt ab. Sobald der See überall gleich warm ist, durchmischen ihn die Herbststürme vollständig: Sauerstoff gelangt wieder in die Tiefe, Mineralstoffe vom Grund kommen nach oben.",
    ),
    temp: [
      [0, 6.4],
      [30, 6],
    ],
    o2: [
      [0, 10.5],
      [30, 9.5],
    ],
    mix: "full",
  },
  {
    id: "winter",
    name: tx("Winter", "Winter"),
    state: tx("winter stagnation", "Winterstagnation"),
    text: tx(
      "Water below 4 °C is less dense again, so it stays on top and freezes at 0 °C. Ice floats because it is less dense than water. At the bottom the densest water stays at 4 °C: fish and other animals survive the winter there.",
      "Wasser unter 4 °C hat wieder eine geringere Dichte, bleibt deshalb oben und gefriert bei 0 °C. Eis schwimmt, weil es eine geringere Dichte hat als Wasser. Am Grund bleibt das dichteste Wasser mit 4 °C: Dort überwintern Fische und andere Tiere.",
    ),
    temp: [
      [0, 0],
      [1, 1],
      [4, 2.6],
      [10, 3.5],
      [18, 3.9],
      [30, 4],
    ],
    o2: [
      [0, 11],
      [12, 10],
      [24, 8],
      [30, 6.5],
    ],
    mix: "none",
  },
];

export const season = (id: SeasonId) => SEASONS.find((s) => s.id === id)!;

const lerp = (pts: [number, number][], depth: number) => {
  for (let i = 1; i < pts.length; i++) {
    const [d0, v0] = pts[i - 1];
    const [d1, v1] = pts[i];
    if (depth <= d1) return v0 + ((v1 - v0) * (depth - d0)) / (d1 - d0);
  }
  return pts[pts.length - 1][1];
};

// ---------------------------------------------------------------------------
// Profile chart

const PBOX: Box = { W: 250, H: 286, l: 40, r: 14, t: 40, b: 40 };

/** Temperature (and oxygen) over depth. `o2` adds the oxygen line; `blank` hides the season's name. */
export function EcoLakeProfile({ id, o2 = true }: { id: SeasonId; o2?: boolean }) {
  const t = useText();
  const locale = useLocale();
  const s = season(id);
  const { px, py } = scales(PBOX, [0, 25], [0, 30], true);
  const ox = (v: number) => px((v / 12) * 25);
  const depths = Array.from({ length: 61 }, (_, i) => i * 0.5);
  const fmt = (v: number) => (locale === "de" ? String(v).replace(".", ",") : String(v));
  return (
    <svg viewBox={`0 0 ${PBOX.W} ${PBOX.H}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 320 }} role="img" aria-label={t(tx("Temperature and oxygen over depth", "Temperatur und Sauerstoff über der Tiefe"))}>
      <Axes box={PBOX} x={[0, 25]} y={[0, 30]} xTicks={[0, 4, 10, 15, 20, 25]} yTicks={[0, 5, 10, 15, 20, 25, 30]} xLabel={t(tx("temperature in °C", "Temperatur in °C"))} yLabel={t(tx("depth in m", "Tiefe in m"))} flipY xFmt={fmt} />
      <line x1={px(4)} x2={px(4)} y1={PBOX.t} y2={PBOX.H - PBOX.b} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="2 4" />
      {o2 && (
        <g>
          {[0, 4, 8, 12].map((v) => (
            <text key={v} x={ox(v)} y={PBOX.H - PBOX.b + 15} textAnchor="middle" fontSize={10.5} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
              {v}
            </text>
          ))}
          <text x={PBOX.W - PBOX.r} y={PBOX.H - 6} textAnchor="end" fontSize={11} fill="var(--bio-water-deep)" style={{ fontFamily: "var(--font-sans)" }}>
            {t(tx("oxygen in mg/l", "Sauerstoff in mg/l"))}
          </text>
          <path d={path(depths.map((d) => [ox(lerp(s.o2, d)), py(d)]))} fill="none" stroke="var(--bio-water-deep)" strokeWidth={2.6} strokeDasharray="7 4" />
        </g>
      )}
      <path d={path(depths.map((d) => [px(lerp(s.temp, d)), py(d)]))} fill="none" stroke="var(--bio-blood)" strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The lake picture

const SURF = 46;
const BOTTOM = 232;
const BASIN = `M8 ${SURF} C 36 120, 92 ${BOTTOM}, 170 ${BOTTOM} C 248 ${BOTTOM}, 304 120, 332 ${SURF} Z`;
const yOf = (depth: number) => SURF + (depth / 30) * (BOTTOM - SURF);

function waterColor(temp: number): { c: string; o: number } {
  if (temp < 3) return { c: "var(--bio-vacuole)", o: 0.95 };
  if (temp <= 5) return { c: "var(--bio-water)", o: 0.9 };
  if (temp <= 12) return { c: "var(--bio-water)", o: 0.55 };
  return { c: "var(--bio-mito)", o: 0.8 };
}

function Loop({ cx, cy, rx, ry, reverse, reduce }: { cx: number; cy: number; rx: number; ry: number; reverse?: boolean; reduce: boolean | null }) {
  const d = `M${cx - rx} ${cy} a${rx} ${ry} 0 1 ${reverse ? 0 : 1} ${2 * rx} 0 a${rx} ${ry} 0 1 ${reverse ? 0 : 1} ${-2 * rx} 0`;
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="var(--raised)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeDasharray="10 9"
      opacity={0.9}
      animate={reduce ? undefined : { strokeDashoffset: [0, -38] }}
      transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "linear" }}
    />
  );
}

function LakePicture({ s }: { s: Season }) {
  const t = useText();
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const stops = Array.from({ length: 16 }, (_, i) => (i / 15) * 30);
  return (
    <svg viewBox="0 0 340 250" className="mx-auto block h-auto w-full" style={{ maxWidth: 420 }} role="img" aria-label={t(tx("Cross-section of a lake", "Querschnitt durch einen See"))}>
      <defs>
        <linearGradient id={`${uid}-w`} x1="0" y1={SURF} x2="0" y2={BOTTOM} gradientUnits="userSpaceOnUse">
          {stops.map((d) => {
            const { c, o } = waterColor(lerp(s.temp, d));
            return <stop key={d} offset={d / 30} style={{ stopColor: c, stopOpacity: o }} />;
          })}
        </linearGradient>
        <clipPath id={`${uid}-c`}>
          <path d={BASIN} />
        </clipPath>
      </defs>
      {/* ground around the basin */}
      <path d={`M0 ${SURF} H8 C 36 120, 92 ${BOTTOM}, 170 ${BOTTOM} C 248 ${BOTTOM}, 304 120, 332 ${SURF} H340 V250 H0 Z`} fill="var(--bio-soil)" opacity={0.6} />
      <motion.path key={s.id} d={BASIN} fill={`url(#${uid}-w)`} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
      <path d={BASIN} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      <g clipPath={`url(#${uid}-c)`}>
        {s.mix === "full" && (
          <>
            <Loop cx={110} cy={130} rx={60} ry={62} reduce={reduce} />
            <Loop cx={230} cy={130} rx={60} ry={62} reverse reduce={reduce} />
          </>
        )}
        {s.mix === "top" && (
          <>
            <Loop cx={110} cy={66} rx={70} ry={14} reduce={reduce} />
            <Loop cx={240} cy={66} rx={60} ry={14} reverse reduce={reduce} />
          </>
        )}
        {s.id === "summer" && (
          <g>
            <rect x={0} y={yOf(8)} width={340} height={yOf(14) - yOf(8)} fill="var(--raised)" opacity={0.18} />
            <line x1={0} x2={340} y1={yOf(8)} y2={yOf(8)} stroke="var(--raised)" strokeWidth={1.4} strokeDasharray="5 4" />
            <line x1={0} x2={340} y1={yOf(14)} y2={yOf(14)} stroke="var(--raised)" strokeWidth={1.4} strokeDasharray="5 4" />
          </g>
        )}
      </g>
      {s.id === "summer" && (
        <g>
          <Tag x={170} y={yOf(4.5)} size={11.5}>
            {t(tx("epilimnion ~20 °C", "Epilimnion ~20 °C"))}
          </Tag>
          <Tag x={170} y={yOf(11.4)} size={11}>
            {t(tx("thermocline (metalimnion)", "Sprungschicht (Metalimnion)"))}
          </Tag>
          <Tag x={170} y={yOf(22)} size={11.5}>
            {t(tx("hypolimnion ~4 °C, little O₂", "Hypolimnion ~4 °C, wenig O₂"))}
          </Tag>
          {/* sun */}
          <circle cx={300} cy={20} r={12} fill="var(--bio-sun)" stroke="var(--bio-nerve-deep)" strokeWidth={1.2} />
        </g>
      )}
      {s.id === "winter" && (
        <g>
          <path d={`M10 ${SURF - 3} H330 L326 ${SURF + 7} H14 Z`} fill="var(--raised)" stroke="var(--bio-water)" strokeWidth={1.6} />
          <Tag x={170} y={SURF - 9} size={11.5}>
            {t(tx("ice 0 °C", "Eis 0 °C"))}
          </Tag>
          <Tag x={170} y={yOf(6)} size={11.5}>
            {t(tx("0 to 4 °C", "0 bis 4 °C"))}
          </Tag>
          <Tag x={170} y={yOf(24)} size={11.5}>
            {t(tx("4 °C, densest water", "4 °C, dichtestes Wasser"))}
          </Tag>
          {/* resting fish */}
          <g transform={`translate(140 ${yOf(28.4)})`}>
            <ellipse cx={0} cy={0} rx={12} ry={4.5} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1} />
            <path d="M-11 0 l-7 -4 v8 z" fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1} />
            <circle cx={7} cy={-1} r={1} fill="var(--bio-outline)" />
          </g>
        </g>
      )}
      {(s.id === "spring" || s.id === "autumn") && (
        <g>
          <Tag x={170} y={yOf(16)} size={12}>
            {t(s.id === "spring" ? tx("about 4 °C everywhere", "überall etwa 4 °C") : tx("same temperature everywhere", "überall gleich warm"))}
          </Tag>
          {/* wind */}
          {[0, 1, 2].map((i) => (
            <motion.path
              key={i}
              d={`M${40 + i * 90} ${18 + (i % 2) * 8} q20 -8 40 0 t40 0`}
              fill="none"
              stroke="var(--ink-3)"
              strokeWidth={2}
              strokeLinecap="round"
              animate={reduce ? undefined : { x: [0, 14, 0] }}
              transition={reduce ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}

export function EcoLakeSeasons() {
  const t = useText();
  const scope = useId();
  const [i, setI] = useState(1);
  const s = SEASONS[i];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {SEASONS.map((x, k) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setI(k)}
            className={cn("relative h-9 rounded-lg border px-3 text-[14px] font-medium transition-colors", k === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {k === i && <motion.span layoutId={`${scope}-season`} className="absolute inset-0 rounded-lg bg-blob" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(x.name)}</span>
          </button>
        ))}
      </div>
      <div className="grid gap-3 rounded-xl border border-line bg-surface p-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:items-center">
        <LakePicture s={s} />
        <div>
          <EcoLakeProfile id={s.id} />
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: "var(--bio-blood)" }} />
              {t(tx("temperature", "Temperatur"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-[3px] w-5 rounded-full" style={{ background: "var(--bio-water-deep)" }} />
              {t(tx("oxygen", "Sauerstoff"))}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setI((i + 3) % 4)} aria-label={t(tx("Previous season", "Vorige Jahreszeit"))} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-ink-2 hover:bg-hover hover:text-ink">
          <ChevronLeft className="size-5" />
        </button>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }} aria-live="polite" className="flex-1 rounded-xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">{t(s.state)}:</span> {t(s.text)}
          </motion.div>
        </AnimatePresence>
        <button type="button" onClick={() => setI((i + 1) % 4)} aria-label={t(tx("Next season", "Nächste Jahreszeit"))} className="grid size-10 shrink-0 place-items-center rounded-xl bg-blob text-white transition-transform active:scale-[0.96]">
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
