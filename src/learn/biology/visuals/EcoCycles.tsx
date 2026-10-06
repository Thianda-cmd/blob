"use client";

// The carbon cycle and the nitrogen cycle as interactive diagrams: numbered arrows for each
// process; tap a process to light up its arrows and read what happens. The same drawings
// work as task pictures (numbers only, one arrow asked with "?").

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

type Pt = [number, number];
/** An arrow: 2 points (line) or 3 points (quadratic curve). */
type Arr = Pt[];
export type Proc = { id: string; name: Text; text: Text; arrows: Arr[]; badge: Pt; effect?: Text };

const FONT = { fontFamily: "var(--font-sans)" } as const;

function d(a: Arr) {
  return a.length === 2 ? `M${a[0][0]} ${a[0][1]} L${a[1][0]} ${a[1][1]}` : `M${a[0][0]} ${a[0][1]} Q${a[1][0]} ${a[1][1]} ${a[2][0]} ${a[2][1]}`;
}

function ArrowShape({ a, lit, dim }: { a: Arr; lit: boolean; dim: boolean }) {
  const end = a[a.length - 1];
  const prev = a[a.length - 2];
  const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const l = 11;
  const head = `${end[0]},${end[1]} ${end[0] - l * Math.cos(ang - 0.42)},${end[1] - l * Math.sin(ang - 0.42)} ${end[0] - l * Math.cos(ang + 0.42)},${end[1] - l * Math.sin(ang + 0.42)}`;
  const c = lit ? "var(--blob)" : "var(--ink-2)";
  // stop the line a bit before the tip so the head stays sharp
  const shortened: Arr = [...a.slice(0, -1), [end[0] - 6 * Math.cos(ang), end[1] - 6 * Math.sin(ang)]];
  return (
    <g style={{ opacity: dim ? 0.28 : 1, transition: "opacity .25s" }}>
      <path d={d(shortened)} fill="none" stroke={c} strokeWidth={lit ? 3.4 : 2.4} strokeLinecap="round" />
      <polygon points={head} fill={c} />
    </g>
  );
}

function Badge({ at, n, lit, ask, onClick }: { at: Pt; n: number; lit: boolean; ask?: boolean; onClick?: () => void }) {
  return (
    <g onClick={onClick} className={onClick ? "cursor-pointer" : undefined}>
      {ask && (
        <motion.circle
          cx={at[0]}
          cy={at[1]}
          r={12}
          fill="none"
          stroke="var(--blob)"
          strokeWidth={2}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
        />
      )}
      <circle cx={at[0]} cy={at[1]} r={11.5} fill={lit || ask ? "var(--blob)" : "var(--raised)"} stroke={lit || ask ? "var(--blob)" : "var(--ink)"} strokeWidth={1.6} />
      <text x={at[0]} y={at[1]} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill={lit || ask ? "#fff" : "var(--ink)"} style={{ ...FONT, pointerEvents: "none" }}>
        {ask ? "?" : n}
      </text>
    </g>
  );
}

function Label({ x, y, children, anchor = "middle", size = 12.5 }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; size?: number }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontWeight={600} fill="var(--ink)" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round" style={FONT}>
      {children}
    </text>
  );
}

function Diagram({ procs, width, height, art, ask, selected, onSelect, title }: { procs: Proc[]; width: number; height: number; art: ReactNode; ask?: string; selected: string | null; onSelect?: (id: string | null) => void; title: string }) {
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full" style={{ maxWidth: 620 }} role="img" aria-label={title}>
      {art}
      {procs.map((p) => p.arrows.map((a, i) => <ArrowShape key={`${p.id}${i}`} a={a} lit={selected === p.id} dim={!!selected && selected !== p.id} />))}
      {procs.map((p, i) => (
        <Badge key={p.id} at={p.badge} n={i + 1} lit={selected === p.id} ask={ask === p.id} onClick={onSelect ? () => onSelect(selected === p.id ? null : p.id) : undefined} />
      ))}
    </svg>
  );
}

function Explorer({ procs, extra, children }: { procs: Proc[]; extra?: Proc; children: (selected: string | null, select: (id: string | null) => void) => ReactNode }) {
  const t = useText();
  const [selected, setSelected] = useState<string | null>(null);
  const all = extra ? [...procs, extra] : procs;
  const picked = all.find((p) => p.id === selected);
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface px-2 py-2">{children(selected, setSelected)}</div>
      <div className="flex flex-wrap gap-1.5">
        {all.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(selected === p.id ? null : p.id)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium transition-colors",
              selected === p.id ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {i < procs.length && <span className={cn("grid size-5 place-items-center rounded-full text-[11px] font-bold", selected === p.id ? "bg-white/25" : "border border-ink text-ink")}>{i + 1}</span>}
            {t(p.name)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selected ?? "none"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          aria-live="polite"
          className={cn("min-h-[4.5rem] rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", picked ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-3")}
        >
          {picked ? (
            <>
              <span className="font-semibold">{t(picked.name)}:</span> {t(picked.text)}
              {picked.effect && <span className="mt-1 block text-[13.5px] font-semibold text-blob-ink">{t(picked.effect)}</span>}
            </>
          ) : (
            t(tx("Tap a process or a number.", "Tippe auf einen Vorgang oder eine Nummer."))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carbon cycle

const BINDS = tx("CO₂ is taken out of the air.", "CO₂ wird der Luft entzogen.");
const RELEASES = tx("CO₂ is released into the air.", "CO₂ wird an die Luft abgegeben.");
const STAYS = tx("Carbon stays bound in organic matter.", "Der Kohlenstoff bleibt in organischen Stoffen gebunden.");

export const CARBON: Proc[] = [
  {
    id: "photosynthesis",
    name: tx("Photosynthesis", "Fotosynthese"),
    text: tx(
      "Plants and algae take CO₂ from the air and use light energy to build glucose from it. Carbon is bound in biomass.",
      "Pflanzen und Algen nehmen CO₂ aus der Luft auf und bauen daraus mit Lichtenergie Traubenzucker (Glucose) auf. Kohlenstoff wird in Biomasse gebunden.",
    ),
    arrows: [[[86, 74], [88, 150]]],
    badge: [70, 112],
    effect: BINDS,
  },
  {
    id: "resp-plants",
    name: tx("Respiration of plants", "Zellatmung der Pflanzen"),
    text: tx("Plants respire too, day and night: they break down glucose and give off CO₂.", "Auch Pflanzen atmen, Tag und Nacht: Sie bauen Glucose ab und geben CO₂ ab."),
    arrows: [[[132, 150], [134, 74]]],
    badge: [150, 112],
    effect: RELEASES,
  },
  {
    id: "feeding",
    name: tx("Feeding", "Fressen"),
    text: tx("Animals take in carbon compounds (carbohydrates, fats, proteins) with their food.", "Tiere nehmen kohlenstoffhaltige Stoffe (Kohlenhydrate, Fette, Proteine) mit der Nahrung auf."),
    arrows: [[[160, 214], [210, 200], [252, 214]]],
    badge: [208, 196],
    effect: STAYS,
  },
  {
    id: "resp-animals",
    name: tx("Respiration of animals", "Zellatmung der Tiere"),
    text: tx("Animals break down nutrients in cellular respiration and breathe out CO₂.", "Tiere bauen Nährstoffe in der Zellatmung ab und atmen CO₂ aus."),
    arrows: [[[306, 160], [306, 74]]],
    badge: [322, 118],
    effect: RELEASES,
  },
  {
    id: "death",
    name: tx("Death and excretion", "Absterben und Ausscheidung"),
    text: tx("Fallen leaves, dead plants and animals and droppings become dead organic matter.", "Laub, tote Pflanzen und Tiere sowie Kot werden zu toter Biomasse."),
    arrows: [
      [[128, 262], [132, 296]],
      [[298, 282], [268, 306], [198, 312]],
    ],
    badge: [258, 292],
    effect: STAYS,
  },
  {
    id: "decomposition",
    name: tx("Decomposition", "Zersetzung"),
    text: tx("Decomposers (bacteria, fungi) break down dead matter. Their respiration releases CO₂.", "Destruenten (Bakterien, Pilze) bauen tote Biomasse ab. Bei ihrer Zellatmung entsteht CO₂."),
    arrows: [[[66, 312], [32, 300], [34, 74]]],
    badge: [36, 196],
    effect: RELEASES,
  },
  {
    id: "fossil",
    name: tx("Fossil fuels form", "Entstehung fossiler Brennstoffe"),
    text: tx(
      "Dead matter buried without oxygen turns into coal, oil and natural gas over millions of years. The carbon is stored there for a very long time.",
      "Wird tote Biomasse ohne Sauerstoff begraben, entstehen über Jahrmillionen Kohle, Erdöl und Erdgas. Der Kohlenstoff ist dort sehr lange gespeichert.",
    ),
    arrows: [[[192, 338], [300, 374], [404, 350]]],
    badge: [298, 362],
    effect: STAYS,
  },
  {
    id: "combustion",
    name: tx("Combustion", "Verbrennung"),
    text: tx(
      "Burning coal, oil and gas in power stations, heating and traffic releases, within a short time, CO₂ that was stored for millions of years.",
      "Beim Verbrennen von Kohle, Erdöl und Erdgas in Kraftwerken, Heizungen und im Verkehr wird in kurzer Zeit CO₂ frei, das Jahrmillionen gespeichert war.",
    ),
    arrows: [
      [[470, 328], [470, 290]],
      [[492, 146], [492, 74]],
    ],
    badge: [508, 112],
    effect: RELEASES,
  },
];

const GREENHOUSE: Proc = {
  id: "greenhouse",
  name: tx("Greenhouse effect", "Treibhauseffekt"),
  text: tx(
    "CO₂ lets sunlight through but holds back heat radiated by the Earth. Since about 1850 the CO₂ in the air has risen from about 280 ppm to over 420 ppm, mainly through burning fossil fuels and clearing forests. More CO₂ strengthens the greenhouse effect: the Earth warms up (climate change).",
    "CO₂ lässt Sonnenlicht durch, hält aber die Wärmestrahlung der Erde zurück. Seit etwa 1850 ist der CO₂-Gehalt der Luft von etwa 280 ppm auf über 420 ppm gestiegen, vor allem durch das Verbrennen fossiler Brennstoffe und das Roden von Wäldern. Mehr CO₂ verstärkt den Treibhauseffekt: Die Erde erwärmt sich (Klimawandel).",
  ),
  arrows: [],
  badge: [0, 0],
};

function CarbonArt() {
  const t = useText();
  return (
    <g>
      {/* air */}
      <rect x={14} y={16} width={532} height={52} rx={14} fill="var(--bio-vacuole)" stroke="var(--bio-water)" strokeWidth={1.6} />
      <Label x={280} y={47} size={14}>
        {t(tx("CO₂ in the air (atmosphere)", "CO₂ in der Luft (Atmosphäre)"))}
      </Label>
      {/* ground and soil */}
      <rect x={14} y={286} width={532} height={106} rx={10} fill="var(--bio-soil)" opacity={0.35} />
      <path d="M14 286 H546" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      {/* fossil layers */}
      <g>
        <path d="M400 336 Q470 326 540 336 V352 Q470 344 400 352 Z" fill="var(--bio-wood-deep)" opacity={0.9} />
        <path d="M404 356 Q470 350 540 358 V372 Q470 368 404 372 Z" fill="var(--bio-outline)" opacity={0.75} />
        <Label x={474} y={386} size={11.5}>
          {t(tx("coal, oil, gas", "Kohle, Erdöl, Erdgas"))}
        </Label>
      </g>
      {/* plant */}
      <path d="M104 286 L106 230 L118 230 L120 286 Z" fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      <g fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={2}>
        <circle cx={86} cy={204} r={30} />
        <circle cx={138} cy={204} r={30} />
        <circle cx={112} cy={184} r={34} />
        <circle cx={112} cy={222} r={26} />
      </g>
      <Label x={112} y={232} size={11.5}>
        {t(tx("plants", "Pflanzen"))}
      </Label>
      {/* roe deer */}
      <g fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M268 230 q8 -14 36 -12 q22 2 28 12 q4 10 -4 16 q-24 8 -56 0 q-8 -6 -4 -16 z" />
        <path d="M318 224 q4 -14 12 -24 l8 4 q-6 10 -8 22 z" />
        <path d="M328 202 q2 -10 12 -10 q8 0 14 8 q2 4 -2 5 l-12 1 q-8 2 -12 -4 z" />
        <path d="M334 194 l-4 -10 l7 7 M340 192 l1 -11 l3 10" />
        <path d="M274 244 l-2 34 M284 246 l1 32 M314 246 l-1 32 M324 244 l3 34" fill="none" strokeWidth={4} strokeLinecap="round" />
      </g>
      <circle cx={343} cy={198} r={1.5} fill="var(--bio-outline)" />
      <Label x={300} y={206} size={11.5}>
        {t(tx("animals", "Tiere"))}
      </Label>
      {/* dead matter and decomposers */}
      <g>
        {[
          [100, 304, 20],
          [128, 312, -20],
          [154, 304, 10],
          [176, 314, -30],
        ].map(([x, y, a]) => (
          <ellipse key={x} cx={x} cy={y} rx={10} ry={4.5} transform={`rotate(${a} ${x} ${y})`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
        ))}
        <path d="M80 322 v-8 q0 -2 2 -2 h4 q2 0 2 2 v8 z" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.1} />
        <path d="M72 313 q12 -16 24 0 z" fill="var(--bio-mito-deep)" stroke="var(--bio-outline)" strokeWidth={1.1} />
        <path d="M140 330 q8 -7 16 -1 q8 6 16 -1" stroke="var(--bio-flesh-deep)" strokeWidth={4} fill="none" strokeLinecap="round" />
        <Label x={122} y={378} size={11.5}>
          {t(tx("dead matter, decomposers", "tote Biomasse, Destruenten"))}
        </Label>
      </g>
      {/* power station */}
      <g fill="var(--raised)" stroke="var(--bio-outline)" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M436 286 V236 l18 -12 v12 l18 -12 v12 l18 -12 V286 Z" />
        <rect x={484} y={150} width={16} height={136} />
      </g>
      <g fill="var(--line-2)" opacity={0.9}>
        <circle cx={492} cy={140} r={8} />
        <circle cx={500} cy={128} r={6} />
      </g>
      <Label x={430} y={266} size={11.5} anchor="end">
        {t(tx("burning", "Verbrennung"))}
      </Label>
    </g>
  );
}

/** The carbon cycle for tasks: numbered arrows, optionally one asked. */
export function EcoCarbonCyclePicture({ ask }: { ask?: string }) {
  const t = useText();
  return <Diagram procs={CARBON} width={560} height={400} art={<CarbonArt />} ask={ask} selected={null} title={t(tx("The carbon cycle", "Der Kohlenstoffkreislauf"))} />;
}

export function EcoCarbonCycle() {
  const t = useText();
  return (
    <Explorer procs={CARBON} extra={GREENHOUSE}>
      {(selected, select) => (
        <Diagram
          procs={CARBON}
          width={560}
          height={400}
          art={<CarbonArt />}
          selected={selected === "greenhouse" ? "combustion" : selected}
          onSelect={select}
          title={t(tx("The carbon cycle", "Der Kohlenstoffkreislauf"))}
        />
      )}
    </Explorer>
  );
}

// ---------------------------------------------------------------------------
// Nitrogen cycle

export const NITROGEN: Proc[] = [
  {
    id: "fixation",
    name: tx("Nitrogen fixation", "Stickstofffixierung"),
    text: tx(
      "Root-nodule bacteria (rhizobia) in the roots of legumes such as clover, peas and lupins turn N₂ from the air into ammonium (NH₄⁺) with the enzyme nitrogenase. In return the plant supplies them with sugar (symbiosis). Some free-living bacteria and cyanobacteria fix nitrogen too, and industry does it for fertiliser (Haber-Bosch process).",
      "Knöllchenbakterien (Rhizobien) in den Wurzeln von Schmetterlingsblütlern wie Klee, Erbse und Lupine wandeln N₂ aus der Luft mit dem Enzym Nitrogenase in Ammonium (NH₄⁺) um. Die Pflanze versorgt sie dafür mit Zucker (Symbiose). Auch einige freilebende Bakterien und Cyanobakterien binden Stickstoff, und die Industrie tut es für Dünger (Haber-Bosch-Verfahren).",
    ),
    arrows: [[[34, 74], [30, 250], [96, 330]]],
    badge: [30, 184],
  },
  {
    id: "uptake",
    name: tx("Uptake (assimilation)", "Aufnahme (Assimilation)"),
    text: tx("Plants take up mainly nitrate (and ammonium) through their roots and build amino acids, proteins and nucleic acids from it.", "Pflanzen nehmen vor allem Nitrat (und Ammonium) über die Wurzeln auf und bauen daraus Aminosäuren, Proteine und Nukleinsäuren auf."),
    arrows: [[[432, 326], [330, 300], [244, 300]]],
    badge: [338, 304],
  },
  {
    id: "feeding",
    name: tx("Feeding", "Fressen"),
    text: tx("Animals take in nitrogen as proteins in their food.", "Tiere nehmen den Stickstoff mit der Nahrung als Proteine auf."),
    arrows: [[[262, 196], [310, 180], [350, 196]]],
    badge: [306, 182],
  },
  {
    id: "death",
    name: tx("Death and excretion", "Absterben und Ausscheidung"),
    text: tx("Dead organisms and excretions (urea, droppings) contain organically bound nitrogen.", "Tote Lebewesen und Ausscheidungen (Harnstoff, Kot) enthalten organisch gebundenen Stickstoff."),
    arrows: [
      [[220, 256], [214, 272]],
      [[384, 252], [330, 262], [266, 268]],
    ],
    badge: [338, 254],
  },
  {
    id: "ammonification",
    name: tx("Ammonification", "Ammonifikation"),
    text: tx("Decomposers (bacteria, fungi) break down proteins of dead organisms and urea into ammonium (NH₄⁺).", "Destruenten (Bakterien, Pilze) bauen die Proteine toter Lebewesen und Harnstoff zu Ammonium (NH₄⁺) ab."),
    arrows: [[[192, 290], [168, 304], [150, 322]]],
    badge: [184, 314],
  },
  {
    id: "nitrification",
    name: tx("Nitrification", "Nitrifikation"),
    text: tx(
      "Nitrifying bacteria oxidise ammonium with oxygen (aerobic): Nitrosomonas to nitrite (NO₂⁻), Nitrobacter on to nitrate (NO₃⁻). They gain energy this way (chemosynthesis).",
      "Nitrifizierende Bakterien oxidieren Ammonium mit Sauerstoff (aerob): Nitrosomonas zu Nitrit (NO₂⁻), Nitrobacter weiter zu Nitrat (NO₃⁻). Sie gewinnen dabei Energie (Chemosynthese).",
    ),
    arrows: [
      [[178, 352], [244, 360]],
      [[318, 360], [390, 352]],
    ],
    badge: [210, 372],
  },
  {
    id: "denitrification",
    name: tx("Denitrification", "Denitrifikation"),
    text: tx("In soils short of oxygen (anaerobic, waterlogged), denitrifying bacteria turn nitrate back into N₂. The nitrogen returns to the air.", "In sauerstoffarmen (anaeroben), staunassen Böden wandeln denitrifizierende Bakterien Nitrat wieder in N₂ um. Der Stickstoff geht zurück in die Luft."),
    arrows: [[[486, 330], [530, 250], [530, 74]]],
    badge: [530, 184],
  },
];

function Chem({ x, y, f, name, lit }: { x: number; y: number; f: string; name: string; lit?: boolean }) {
  return (
    <g>
      <rect x={x - 42} y={y - 20} width={84} height={40} rx={10} fill="var(--raised)" stroke={lit ? "var(--blob)" : "var(--bio-outline)"} strokeWidth={1.6} />
      <text x={x} y={y - 3} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--ink)" style={FONT}>
        {f}
      </text>
      <text x={x} y={y + 12} textAnchor="middle" fontSize={10.5} fill="var(--ink-2)" style={FONT}>
        {name}
      </text>
    </g>
  );
}

function NitrogenArt() {
  const t = useText();
  return (
    <g>
      <rect x={14} y={16} width={532} height={52} rx={14} fill="var(--bio-vacuole)" stroke="var(--bio-water)" strokeWidth={1.6} />
      <Label x={280} y={47} size={14}>
        {t(tx("N₂ in the air (78 %)", "N₂ in der Luft (78 %)"))}
      </Label>
      <rect x={14} y={282} width={532} height={108} rx={10} fill="var(--bio-soil)" opacity={0.35} />
      <path d="M14 282 H546" stroke="var(--bio-wood-deep)" strokeWidth={2} />
      {/* legume with root nodules */}
      <g>
        <path d="M100 282 V196" stroke="var(--bio-leaf-deep)" strokeWidth={2.5} />
        {[
          [100, 214, -1],
          [100, 236, 1],
          [100, 200, 1],
        ].map(([x, y, s], i) => (
          <g key={i} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4}>
            <ellipse cx={x + 12 * s} cy={y} rx={11} ry={6} transform={`rotate(${-20 * s} ${x + 12 * s} ${y})`} />
            <ellipse cx={x + 12 * s} cy={y - 10} rx={10} ry={5.5} transform={`rotate(${-35 * s} ${x + 12 * s} ${y - 10})`} />
            <ellipse cx={x + 20 * s} cy={y + 6} rx={10} ry={5.5} transform={`rotate(${10 * s} ${x + 20 * s} ${y + 6})`} />
          </g>
        ))}
        <circle cx={100} cy={188} r={7} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.4} />
        <path d="M100 282 q-4 18 -18 30 M100 282 q2 20 -2 40 M100 282 q8 16 22 24" stroke="var(--bio-wood-deep)" strokeWidth={2} fill="none" />
        {[
          [88, 302],
          [99, 318],
          [114, 300],
          [84, 310],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={4.2} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.2} />
        ))}
        <Label x={100} y={174} size={11.5}>
          {t(tx("legume", "Schmetterlingsblütler"))}
        </Label>
      </g>
      {/* plant */}
      <g>
        <path d="M228 282 V200" stroke="var(--bio-leaf-deep)" strokeWidth={2.5} />
        <g fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5}>
          <path d="M228 250 q-26 -4 -30 -22 q22 0 30 22 z" />
          <path d="M228 236 q26 -4 30 -22 q-22 0 -30 22 z" />
          <path d="M228 210 q-20 -6 -20 -24 q18 4 20 24 z" />
          <path d="M228 204 q14 -10 12 -26 q-14 8 -12 26 z" />
        </g>
        <path d="M228 282 q-6 14 -18 20 M228 282 q4 14 16 18" stroke="var(--bio-wood-deep)" strokeWidth={2} fill="none" />
        <Label x={228} y={170} size={11.5}>
          {t(tx("plant: proteins", "Pflanze: Proteine"))}
        </Label>
      </g>
      {/* hare */}
      <g fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.6}>
        <ellipse cx={392} cy={232} rx={30} ry={18} />
        <circle cx={420} cy={214} r={12} />
        <ellipse cx={414} cy={190} rx={4.5} ry={15} transform="rotate(-10 414 190)" />
        <ellipse cx={424} cy={190} rx={4.5} ry={15} transform="rotate(10 424 190)" />
        <path d="M376 248 q-6 10 4 12 h10 M404 248 q2 10 10 12 h8" fill="none" strokeWidth={3} strokeLinecap="round" />
      </g>
      <circle cx={425} cy={211} r={1.6} fill="var(--bio-outline)" />
      <circle cx={362} cy={226} r={5} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      <Label x={392} y={166} size={11.5}>
        {t(tx("animal: proteins", "Tier: Proteine"))}
      </Label>
      {/* dead matter */}
      <g>
        {[
          [214, 276, 15],
          [240, 274, -20],
          [264, 277, 8],
        ].map(([x, y, a]) => (
          <ellipse key={x} cx={x} cy={y} rx={9} ry={4} transform={`rotate(${a} ${x} ${y})`} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.1} />
        ))}
      </g>
      {/* soil compounds */}
      <Chem x={140} y={346} f="NH₄⁺" name={t(tx("ammonium", "Ammonium"))} />
      <Chem x={282} y={360} f="NO₂⁻" name={t(tx("nitrite", "Nitrit"))} />
      <Chem x={436} y={346} f="NO₃⁻" name={t(tx("nitrate", "Nitrat"))} />
    </g>
  );
}

/** The nitrogen cycle for tasks: numbered arrows, optionally one asked. */
export function EcoNitrogenCyclePicture({ ask }: { ask?: string }) {
  const t = useText();
  return <Diagram procs={NITROGEN} width={560} height={396} art={<NitrogenArt />} ask={ask} selected={null} title={t(tx("The nitrogen cycle", "Der Stickstoffkreislauf"))} />;
}

export function EcoNitrogenCycle() {
  const t = useText();
  return (
    <Explorer procs={NITROGEN}>
      {(selected, select) => <Diagram procs={NITROGEN} width={560} height={396} art={<NitrogenArt />} selected={selected} onSelect={select} title={t(tx("The nitrogen cycle", "Der Stickstoffkreislauf"))} />}
    </Explorer>
  );
}
