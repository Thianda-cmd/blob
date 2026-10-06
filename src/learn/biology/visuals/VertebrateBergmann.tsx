"use client";

// Temperature rules of warm-blooded animals: surface-to-volume ratio of a cube (slider), the
// Bergmann rule with four penguin species from the Antarctic to the equator, and the Allen rule
// with the ears of arctic fox, red fox and fennec.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, type JSX } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { decText } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";
import { VertebrateEnergyWidget } from "./VertebrateTemperature";

function Cube() {
  const t = useText();
  const [a, setA] = useState(2);
  const O = 6 * a * a;
  const V = a ** 3;
  const r = 6 / a;
  const s = 22 * a;
  const cx = 150;
  const cy = 150;
  // isometric cube
  const dx = s * 0.866;
  const dy = s * 0.5;
  const top = `M${cx} ${cy - s} L ${cx + dx} ${cy - s + dy} L ${cx} ${cy - s + 2 * dy} L ${cx - dx} ${cy - s + dy} Z`;
  const left = `M${cx - dx} ${cy - s + dy} L ${cx} ${cy - s + 2 * dy} L ${cx} ${cy + 2 * dy} L ${cx - dx} ${cy + dy} Z`;
  const right = `M${cx + dx} ${cy - s + dy} L ${cx} ${cy - s + 2 * dy} L ${cx} ${cy + 2 * dy} L ${cx + dx} ${cy + dy} Z`;
  const spring = { type: "spring" as const, stiffness: 200, damping: 24 };
  return (
    <div className="space-y-4">
      <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <svg viewBox="0 0 300 300" className="mx-auto block h-auto w-full max-w-[280px]" role="img" aria-label={t(tx("A cube with edge length a", "Ein Würfel mit der Kantenlänge a"))}>
          <motion.path initial={false} animate={{ d: left }} transition={spring} fill="color-mix(in oklab, var(--bio-mito) 55%, var(--raised))" stroke="var(--bio-outline)" strokeWidth={1.6} />
          <motion.path initial={false} animate={{ d: right }} transition={spring} fill="color-mix(in oklab, var(--bio-mito) 80%, var(--raised))" stroke="var(--bio-outline)" strokeWidth={1.6} />
          <motion.path initial={false} animate={{ d: top }} transition={spring} fill="color-mix(in oklab, var(--bio-mito) 35%, var(--raised))" stroke="var(--bio-outline)" strokeWidth={1.6} />
        </svg>
        <div className="space-y-2">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 font-math text-[18px]">
            <span className="text-ink-3">O =</span>
            <span>
              6 · {a}² = {O} cm²
            </span>
            <span className="text-ink-3">V =</span>
            <span>
              {a}³ = {V} cm³
            </span>
            <span className="text-ink-3">O : V =</span>
            <span className="font-bold text-blob-ink">{t(decText(r, 2))} cm⁻¹</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-hover">
            <motion.div className="h-full rounded-full bg-blob" initial={false} animate={{ width: `${(r / 6) * 100}%` }} transition={spring} />
          </div>
          <p className="text-[14px] text-ink-2">
            {t(tx(`Each cm³ of body has ${resolveText(decText(r, 2), "en")} cm² of surface to lose heat through.`, `Jeder cm³ Körper hat ${resolveText(decText(r, 2), "de")} cm² Oberfläche, über die er Wärme verliert.`))}
          </p>
        </div>
      </div>
      <label className="block">
        <span className="flex items-baseline justify-between text-[13px] font-semibold text-ink-2">
          <span>{t(tx("Edge length a", "Kantenlänge a"))}</span>
          <span className="font-math text-[17px] text-ink">{a} cm</span>
        </span>
        <input type="range" min={1} max={5} step={1} value={a} onChange={(e) => setA(Number(e.target.value))} className="mt-1.5 h-2 w-full cursor-pointer" style={{ accentColor: "var(--blob)" }} aria-label={t(tx("Edge length in cm", "Kantenlänge in cm"))} />
      </label>
      <p className="text-[14px] text-ink-2">{t(tx("Heat is made in the volume and lost through the surface. Double the size: the surface grows 4 times, the volume 8 times. So O : V halves.", "Wärme entsteht im Volumen und geht über die Oberfläche verloren. Doppelte Größe: Die Oberfläche wächst auf das 4-Fache, das Volumen auf das 8-Fache. O : V halbiert sich also."))}</p>
    </div>
  );
}

type Peng = { name: Text; where: Text; h: number };
const PENGUINS: Peng[] = [
  { name: tx("Emperor penguin", "Kaiserpinguin"), where: tx("Antarctica", "Antarktis"), h: 1.2 },
  { name: tx("King penguin", "Königspinguin"), where: tx("Subantarctic islands", "Subantarktische Inseln"), h: 0.95 },
  { name: tx("Humboldt penguin", "Humboldtpinguin"), where: tx("Coast of Peru and Chile", "Küste von Peru und Chile"), h: 0.65 },
  { name: tx("Galápagos penguin", "Galápagospinguin"), where: tx("Equator", "Äquator"), h: 0.5 },
];

function Penguin({ x, h }: { x: number; h: number }) {
  const H = h * 170;
  const W = H * 0.42;
  const base = 210;
  return (
    <motion.g initial={{ scaleY: 0.2, opacity: 0 }} animate={{ scaleY: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} style={{ transformOrigin: `${x}px ${base}px` }}>
      <ellipse cx={x} cy={base - H * 0.45} rx={W / 2} ry={H * 0.45} fill="var(--bio-outline)" />
      <ellipse cx={x} cy={base - H * 0.4} rx={W * 0.32} ry={H * 0.36} fill="var(--raised)" />
      <circle cx={x} cy={base - H * 0.86} r={W * 0.3} fill="var(--bio-outline)" />
      <path d={`M${x - W * 0.08} ${base - H * 0.86} L ${x - W * 0.45} ${base - H * 0.83} L ${x - W * 0.08} ${base - H * 0.8} Z`} fill="var(--bio-sun)" />
      <circle cx={x - W * 0.12} cy={base - H * 0.9} r={Math.max(1.4, W * 0.05)} fill="var(--raised)" />
      <path d={`M${x - W * 0.25} ${base} l -6 3 M${x + W * 0.25} ${base} l 6 3`} stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" />
    </motion.g>
  );
}

function Bergmann() {
  const t = useText();
  const grad = `vt-berg-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 520 230" className="block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(tx("Four penguin species from the Antarctic to the equator", "Vier Pinguinarten von der Antarktis bis zum Äquator"))}>
        <defs>
          <linearGradient id={grad} x1="0" x2="1">
            <stop offset="0" stopColor="var(--bio-vacuole)" />
            <stop offset="1" stopColor="color-mix(in oklab, var(--bio-sun) 35%, var(--raised))" />
          </linearGradient>
        </defs>
        <rect x={0} y={212} width={520} height={14} rx={7} fill={`url(#${grad})`} />
        {PENGUINS.map((p, i) => (
          <Penguin key={i} x={70 + i * 126} h={p.h} />
        ))}
      </svg>
      <div className="grid grid-cols-4 gap-1 text-center">
        {PENGUINS.map((p, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[12.5px] font-semibold leading-tight text-ink sm:text-[14px]">{t(p.name)}</div>
            <div className="text-[11.5px] leading-tight text-ink-3 sm:text-[12.5px]">{t(p.where)}</div>
            <div className="font-math text-[14px] text-ink-2">{t(tx(`up to ${p.h} m`, `bis ${String(p.h).replace(".", ",")} m`))}</div>
          </div>
        ))}
      </div>
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "Bergmann's rule: among closely related warm-blooded species, those in colder regions are larger. A larger body has a smaller surface-to-volume ratio and loses relatively less heat.",
            "Bergmannsche Regel: Bei nah verwandten gleichwarmen Arten sind die Arten in kälteren Gebieten größer. Ein größerer Körper hat ein kleineres Oberflächen-Volumen-Verhältnis und verliert relativ weniger Wärme.",
          ),
        )}
      </p>
    </div>
  );
}

type Fox = { name: Text; where: Text; ear: number; color: string };
const FOXES: Fox[] = [
  { name: tx("Arctic fox", "Polarfuchs"), where: tx("Arctic", "Arktis"), ear: 0.55, color: "var(--bio-bone)" },
  { name: tx("Red fox", "Rotfuchs"), where: tx("Europe", "Europa"), ear: 1, color: "var(--bio-mito)" },
  { name: tx("Fennec", "Fennek (Wüstenfuchs)"), where: tx("Sahara", "Sahara"), ear: 1.9, color: "color-mix(in oklab, var(--bio-sun) 70%, var(--bio-wood))" },
];

function FoxHead({ x, ear, color }: { x: number; ear: number; color: string }) {
  const cy = 150;
  const eh = 46 * ear;
  const ew = 22 * Math.sqrt(ear);
  return (
    <motion.g initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      {[-1, 1].map((s) => (
        <g key={s}>
          <path d={`M${x + s * 14} ${cy - 30} L ${x + s * (20 + ew)} ${cy - 30 - eh} L ${x + s * (34 + ew * 0.4)} ${cy - 14} Z`} fill={color} stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round" />
          <path d={`M${x + s * 19} ${cy - 28} L ${x + s * (21 + ew * 0.8)} ${cy - 30 - eh * 0.75} L ${x + s * (30 + ew * 0.3)} ${cy - 18} Z`} fill="var(--bio-flesh)" opacity={0.8} />
        </g>
      ))}
      <path d={`M${x - 42} ${cy - 20} C ${x - 40} ${cy - 44}, ${x + 40} ${cy - 44}, ${x + 42} ${cy - 20} C ${x + 40} ${cy + 4}, ${x + 14} ${cy + 22}, ${x} ${cy + 34} C ${x - 14} ${cy + 22}, ${x - 40} ${cy + 4}, ${x - 42} ${cy - 20} Z`} fill={color} stroke="var(--bio-outline)" strokeWidth={1.8} />
      <path d={`M${x - 20} ${cy + 6} C ${x - 10} ${cy + 16}, ${x + 10} ${cy + 16}, ${x + 20} ${cy + 6} C ${x + 12} ${cy + 22}, ${x} ${cy + 32}, ${x} ${cy + 32} C ${x} ${cy + 32}, ${x - 12} ${cy + 22}, ${x - 20} ${cy + 6} Z`} fill="var(--raised)" opacity={0.85} />
      <circle cx={x - 15} cy={cy - 12} r={3.6} fill="var(--bio-outline)" />
      <circle cx={x + 15} cy={cy - 12} r={3.6} fill="var(--bio-outline)" />
      <circle cx={x} cy={cy + 30} r={4.5} fill="var(--bio-outline)" />
    </motion.g>
  );
}

function Allen() {
  const t = useText();
  return (
    <div className="space-y-3">
      <svg viewBox="0 0 520 200" className="block h-auto w-full" style={{ maxWidth: 640 }} role="img" aria-label={t(tx("Arctic fox, red fox and fennec", "Polarfuchs, Rotfuchs und Fennek"))}>
        {FOXES.map((f, i) => (
          <FoxHead key={i} x={90 + i * 170} ear={f.ear} color={f.color} />
        ))}
      </svg>
      <div className="grid grid-cols-3 gap-1 text-center">
        {FOXES.map((f, i) => (
          <div key={i} className="min-w-0">
            <div className="text-[13px] font-semibold text-ink sm:text-[14px]">{t(f.name)}</div>
            <div className="text-[12px] text-ink-3">{t(f.where)}</div>
          </div>
        ))}
      </div>
      <p className="text-[14px] text-ink-2">
        {t(
          tx(
            "Allen's rule: in colder regions, body parts that stick out (ears, tail, legs) are smaller: less surface, less heat loss. The fennec even uses its huge ears to give off heat.",
            "Allensche Regel: In kälteren Gebieten sind abstehende Körperteile (Ohren, Schwanz, Beine) kleiner: weniger Oberfläche, weniger Wärmeverlust. Der Fennek gibt über seine riesigen Ohren sogar gezielt Wärme ab.",
          ),
        )}
      </p>
    </div>
  );
}

export function VertebrateBergmann({ withEnergy = false }: { withEnergy?: boolean }) {
  const t = useText();
  const [tab, setTab] = useState(0);
  const views: { label: Text; view: () => JSX.Element }[] = [
    ...(withEnergy ? [{ label: tx("Energy use", "Energieumsatz"), view: VertebrateEnergyWidget }] : []),
    { label: tx("Surface and volume", "Oberfläche und Volumen"), view: Cube },
    { label: tx("Bergmann: penguins", "Bergmann: Pinguine"), view: Bergmann },
    { label: tx("Allen: foxes", "Allen: Füchse"), view: Allen },
  ];
  const View = views[tab].view;
  return (
    <div className="space-y-3">
      <div className="flex w-fit max-w-full flex-wrap rounded-full border border-line bg-surface p-0.5 text-[13.5px] font-semibold" role="tablist">
        {views.map((v, k) => (
          <button key={k} type="button" role="tab" aria-selected={k === tab} onClick={() => setTab(k)} className={cn("rounded-full px-3 py-1 transition-colors", k === tab ? "bg-ink text-paper" : "text-ink-2 hover:text-ink")}>
            {t(v.label)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }}>
          <View />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export const VertebrateThermoWidget = () => <VertebrateBergmann withEnergy />;
