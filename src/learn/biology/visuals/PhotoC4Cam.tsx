"use client";

// Level 3: how C3, C4 and CAM plants fix CO2. C4 plants separate CO2 pre-fixation (PEP
// carboxylase, mesophyll) and the Calvin cycle (Rubisco, bundle sheath) in space; CAM plants
// separate them in time (night: stomata open, malate stored in the vacuole; day: stomata shut,
// malate releases CO2 for the Calvin cycle).

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Moon, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { PhotoCO2 } from "./PhotoMolecules";

const OUT = "var(--bio-outline)";
type Kind = "c3" | "c4" | "cam";
type Pt = [number, number];

function Loop({ path, delay = 0, dur = 3, children, on = true }: { path: Pt[]; delay?: number; dur?: number; children: ReactNode; on?: boolean }) {
  const reduce = useReducedMotion();
  if (!on) return null;
  if (reduce) {
    const [x, y] = path[Math.floor(path.length / 2)];
    return <g transform={`translate(${x} ${y})`}>{children}</g>;
  }
  const n = path.length;
  return (
    <motion.g
      initial={{ x: path[0][0], y: path[0][1], opacity: 0 }}
      animate={{ x: path.map((p) => p[0]), y: path.map((p) => p[1]), opacity: path.map((_, i) => (i === 0 || i === n - 1 ? 0 : 1)) }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "linear" }}
    >
      {children}
    </motion.g>
  );
}

function Word({ x, y, children, size = 12, weight = 600, anchor = "middle" }: { x: number; y: number; children: ReactNode; size?: number; weight?: number; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="central" fontSize={size} fontWeight={weight} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
      {children}
    </text>
  );
}

function Pill({ x, y, label, fill, w }: { x: number; y: number; label: string; fill: string; w: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={11} fill={fill} stroke={OUT} strokeWidth={1.2} />
      <Word x={x} y={y} size={11} weight={700}>
        {label}
      </Word>
    </g>
  );
}

/** A small token with a name (malate, pyruvate…). */
function Tag({ label, fill }: { label: string; fill: string }) {
  const w = Math.max(30, label.length * 7 + 12);
  return (
    <g>
      <rect x={-w / 2} y={-9} width={w} height={18} rx={9} fill={fill} stroke={OUT} strokeWidth={1} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {label}
      </text>
    </g>
  );
}

function MiniCycle({ x, y, label, active = true }: { x: number; y: number; label: string; active?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g animate={active && !reduce ? { rotate: 360 } : { rotate: 0 }} transition={active && !reduce ? { duration: 6, repeat: Infinity, ease: "linear" } : { duration: 0.3 }}>
        <circle r={26} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={3} strokeDasharray="30 10" />
        <path d="M 22 -14 L 28 -4 L 17 -6" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.4} strokeLinejoin="round" />
      </motion.g>
      <Word x={0} y={0} size={10.5} weight={700}>
        {label}
      </Word>
    </g>
  );
}

function Stoma({ x, y, open }: { x: number; y: number; open: boolean }) {
  return (
    <g>
      <motion.path initial={false} animate={{ d: open ? `M${x - 2} ${y - 12} C ${x - 18} ${y - 10} ${x - 18} ${y + 10} ${x - 2} ${y + 12} C ${x - 9} ${y + 6} ${x - 9} ${y - 6} ${x - 2} ${y - 12} Z` : `M${x} ${y - 12} C ${x - 16} ${y - 10} ${x - 16} ${y + 10} ${x} ${y + 12} C ${x - 3} ${y + 6} ${x - 3} ${y - 6} ${x} ${y - 12} Z` }} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      <motion.path initial={false} animate={{ d: open ? `M${x + 2} ${y - 12} C ${x + 18} ${y - 10} ${x + 18} ${y + 10} ${x + 2} ${y + 12} C ${x + 9} ${y + 6} ${x + 9} ${y - 6} ${x + 2} ${y - 12} Z` : `M${x} ${y - 12} C ${x + 16} ${y - 10} ${x + 16} ${y + 10} ${x} ${y + 12} C ${x + 3} ${y + 6} ${x + 3} ${y - 6} ${x} ${y - 12} Z` }} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
    </g>
  );
}

const CO2 = () => <PhotoCO2 s={1.3} />;

function C3({ t }: { t: (x: Text) => string }) {
  return (
    <g>
      <rect x={0} y={250} width={600} height={22} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={1.2} />
      <Stoma x={80} y={261} open />
      <rect x={140} y={36} width={330} height={196} rx={26} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
      <Word x={305} y={54} size={12}>
        {t(tx("mesophyll cell", "Mesophyllzelle"))}
      </Word>
      <ellipse cx={340} cy={142} rx={112} ry={64} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      <Pill x={262} y={142} label="Rubisco" fill="var(--bio-leaf)" w={64} />
      <MiniCycle x={370} y={142} label="Calvin" />
      <Loop path={[[20, 300], [80, 262], [130, 214], [190, 160], [232, 144]]} dur={3.2}>
        <CO2 />
      </Loop>
      <Loop path={[[20, 300], [80, 262], [130, 214], [190, 160], [232, 144]]} dur={3.2} delay={1.6}>
        <CO2 />
      </Loop>
      <Loop path={[[400, 172], [450, 196], [520, 210], [580, 214]]} dur={2.6} delay={0.8}>
        <Tag label={t(tx("sugar", "Zucker"))} fill="var(--bio-bone)" />
      </Loop>
    </g>
  );
}

function C4({ t }: { t: (x: Text) => string }) {
  return (
    <g>
      <rect x={0} y={250} width={600} height={22} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={1.2} />
      <Stoma x={70} y={261} open />
      <rect x={20} y={46} width={230} height={186} rx={24} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
      <Word x={135} y={64} size={12}>
        {t(tx("mesophyll cell", "Mesophyllzelle"))}
      </Word>
      <rect x={282} y={36} width={210} height={206} rx={24} fill="var(--bio-leaf)" stroke="var(--bio-wall-deep)" strokeWidth={4} />
      <Word x={387} y={56} size={12}>
        {t(tx("bundle sheath cell", "Bündelscheidenzelle"))}
      </Word>
      <circle cx={548} cy={140} r={36} fill="var(--bio-cell)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      {[
        [536, 128],
        [556, 124],
        [548, 146],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} fill="var(--bio-vacuole)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      ))}
      <Word x={548} y={192} size={11}>
        {t(tx("vein", "Leitbündel"))}
      </Word>
      <Pill x={128} y={128} label={t(tx("PEP carboxylase", "PEP-Carboxylase"))} fill="var(--bio-petal)" w={118} />
      <Word x={128} y={156} size={10.5} weight={500}>
        {t(tx("CO₂ + PEP → C₄ acid", "CO₂ + PEP → C₄-Säure"))}
      </Word>
      <Word x={128} y={210} size={10.5} weight={500}>
        {t(tx("pyruvate + ATP → PEP", "Pyruvat + ATP → PEP"))}
      </Word>
      <Pill x={330} y={110} label="Rubisco" fill="var(--bio-leaf)" w={64} />
      <MiniCycle x={420} y={140} label="Calvin" />
      <Loop path={[[20, 300], [70, 262], [96, 210], [118, 146]]} dur={2.6}>
        <CO2 />
      </Loop>
      <Loop path={[[150, 140], [210, 140], [266, 140], [312, 140], [330, 140]]} dur={2.6} delay={0.9}>
        <Tag label={t(tx("malate", "Malat"))} fill="var(--bio-petal)" />
      </Loop>
      <Loop path={[[330, 140], [348, 124], [372, 132], [392, 140]]} dur={1.6} delay={2.2}>
        <CO2 />
      </Loop>
      <Loop path={[[330, 196], [290, 198], [250, 198], [200, 198], [160, 196]]} dur={2.6} delay={1.6}>
        <Tag label={t(tx("pyruvate", "Pyruvat"))} fill="var(--bio-nerve)" />
      </Loop>
      <Loop path={[[440, 168], [480, 160], [512, 150], [540, 142]]} dur={2} delay={0.5}>
        <Tag label={t(tx("sugar", "Zucker"))} fill="var(--bio-bone)" />
      </Loop>
    </g>
  );
}

function Cam({ t, day }: { t: (x: Text) => string; day: boolean }) {
  const malate = day ? 3 : 12;
  const spots: Pt[] = Array.from({ length: 12 }, (_, i) => [134 + (i % 4) * 34 + (Math.floor(i / 4) % 2) * 14, 108 + Math.floor(i / 4) * 26]);
  return (
    <g>
      <rect x={0} y={250} width={600} height={22} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={1.2} />
      <Stoma x={90} y={261} open={!day} />
      <rect x={50} y={34} width={480} height={200} rx={26} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
      <ellipse cx={200} cy={140} rx={110} ry={74} fill="var(--bio-vacuole)" stroke="var(--bio-water-deep)" strokeWidth={1.6} />
      <Word x={200} y={84} size={11.5}>
        {t(tx("vacuole", "Vakuole"))}
      </Word>
      <AnimatePresence>
        {spots.slice(0, malate).map(([x, y], i) => (
          <motion.g key={i} initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={{ delay: i * 0.06 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <circle cx={x} cy={y} r={7} fill="var(--bio-petal)" stroke={OUT} strokeWidth={1} />
          </motion.g>
        ))}
      </AnimatePresence>
      <Word x={200} y={194} size={10.5} weight={500}>
        {day ? t(tx("little malic acid, pH higher", "wenig Äpfelsäure, pH höher")) : t(tx("malic acid stored: acidic", "Äpfelsäure gespeichert: sauer"))}
      </Word>
      <ellipse cx={420} cy={142} rx={92} ry={58} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
      <MiniCycle x={440} y={142} label="Calvin" active={day} />
      <Pill x={360} y={196} label="Rubisco" fill="var(--bio-leaf)" w={64} />
      <Pill x={120} y={220} label={t(tx("PEP carboxylase", "PEP-Carboxylase"))} fill="var(--bio-petal)" w={118} />
      {!day && (
        <>
          <Loop path={[[30, 300], [90, 262], [104, 236], [132, 196], [168, 160]]} dur={2.8}>
            <CO2 />
          </Loop>
          <Loop path={[[30, 300], [90, 262], [104, 236], [132, 196], [168, 160]]} dur={2.8} delay={1.4}>
            <CO2 />
          </Loop>
        </>
      )}
      {day && (
        <>
          <Loop path={[[230, 140], [290, 140], [330, 140]]} dur={1.8}>
            <Tag label={t(tx("malate", "Malat"))} fill="var(--bio-petal)" />
          </Loop>
          <Loop path={[[330, 140], [370, 136], [404, 140]]} dur={1.4} delay={1.8}>
            <CO2 />
          </Loop>
          <Loop path={[[470, 176], [500, 200], [550, 220], [590, 226]]} dur={2.2} delay={0.6}>
            <Tag label={t(tx("sugar", "Zucker"))} fill="var(--bio-bone)" />
          </Loop>
        </>
      )}
      <g transform="translate(562 40)">
        {day ? (
          <g>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return <line key={i} x1={Math.cos(a) * 17} y1={Math.sin(a) * 17} x2={Math.cos(a) * 24} y2={Math.sin(a) * 24} stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" />;
            })}
            <circle r={13} fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.4} />
          </g>
        ) : (
          <path d="M 4 -18 A 18 18 0 1 0 18 6 A 14 14 0 1 1 4 -18 Z" fill="var(--bio-sun)" stroke={OUT} strokeWidth={1.4} />
        )}
      </g>
    </g>
  );
}

const INFO: Record<Kind, Text> = {
  c3: tx(
    "C₃ plants (wheat, rice, beech): Rubisco fixes CO₂ directly; the first product is 3-PG with 3 C. In heat the stomata close, CO₂ runs short and Rubisco also binds O₂ (photorespiration): fixed carbon is lost.",
    "C₃-Pflanzen (Weizen, Reis, Buche): Rubisco fixiert CO₂ direkt; das erste Produkt ist 3-PG mit 3 C. Bei Hitze schließen sich die Spaltöffnungen, CO₂ wird knapp und Rubisco bindet auch O₂ (Fotorespiration): Fixierter Kohlenstoff geht verloren.",
  ),
  c4: tx(
    "C₄ plants (maize, sugar cane, millet): separation in space. In the mesophyll, PEP carboxylase pre-fixes CO₂ very efficiently into a C₄ acid (malate). In the bundle sheath, malate releases CO₂ again, and Rubisco works at high CO₂: hardly any photorespiration, even with nearly closed stomata. Costs extra ATP.",
    "C₄-Pflanzen (Mais, Zuckerrohr, Hirse): räumliche Trennung. Im Mesophyll fixiert die PEP-Carboxylase CO₂ sehr effektiv vor, zu einer C₄-Säure (Malat). In der Bündelscheide setzt Malat das CO₂ wieder frei, Rubisco arbeitet bei hoher CO₂-Konzentration: kaum Fotorespiration, auch bei fast geschlossenen Spaltöffnungen. Kostet zusätzlich ATP.",
  ),
  cam: tx(
    "CAM plants (cacti, pineapple, Kalanchoe): separation in time. At night the stomata open, PEP carboxylase fixes CO₂ and malic acid is stored in the vacuole. By day the stomata stay shut to save water; malate releases CO₂ for the Calvin cycle, powered by light.",
    "CAM-Pflanzen (Kakteen, Ananas, Kalanchoe): zeitliche Trennung. Nachts öffnen sich die Spaltöffnungen, die PEP-Carboxylase fixiert CO₂, Äpfelsäure wird in der Vakuole gespeichert. Tagsüber bleiben die Spaltöffnungen zu und sparen Wasser; Malat setzt CO₂ für den Calvin-Zyklus frei, angetrieben vom Licht.",
  ),
};

export function PhotoC4Cam() {
  const t = useText();
  const [kind, setKind] = useState<Kind>("c4");
  const [day, setDay] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex gap-1.5" role="tablist" aria-label={t(tx("Type of plant", "Pflanzentyp"))}>
          {(["c3", "c4", "cam"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn("h-9 rounded-lg border px-3.5 text-[13.5px] font-semibold transition-colors", kind === k ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {k === "c3" ? "C₃" : k === "c4" ? "C₄" : "CAM"}
            </button>
          ))}
        </div>
        {kind === "cam" && (
          <button
            type="button"
            onClick={() => setDay((d) => !d)}
            className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
          >
            {day ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {day ? t(tx("Day: switch to night", "Tag: zur Nacht wechseln")) : t(tx("Night: switch to day", "Nacht: zum Tag wechseln"))}
          </button>
        )}
      </div>
      <div className="rounded-xl border border-line bg-surface">
        <svg viewBox="0 0 600 300" className="block h-auto w-full" role="img" aria-label={t(tx("CO₂ fixation in C3, C4 and CAM plants", "CO₂-Fixierung bei C3-, C4- und CAM-Pflanzen"))}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.g key={kind === "cam" ? `cam-${day}` : kind} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
              {kind === "c3" ? <C3 t={t} /> : kind === "c4" ? <C4 t={t} /> : <Cam t={t} day={day} />}
            </motion.g>
          </AnimatePresence>
        </svg>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={kind}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className="rounded-xl bg-blob-soft/70 px-4 py-3 text-[14.5px] leading-relaxed text-ink"
        >
          {t(INFO[kind])}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
