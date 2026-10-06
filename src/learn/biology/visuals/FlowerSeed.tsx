"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Droplets, Moon, Snowflake, Sun, Thermometer } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { DISHES, type Dish } from "@/learn/biology/topics/flowers-seeds/data";
import { StepCaption, StepControls } from "./FlowerKit";

// Seeds: a bean seed opened up (seed coat, cotyledons, embryo), a maize grain in section (with
// endosperm) and the germination of a bean step by step.

// ---------------------------------------------------------------------------
// Bean seed

const BEAN = "M 40 128 C 40 78, 90 58, 130 68 C 162 76, 170 100, 160 114 C 152 124, 154 136, 164 150 C 178 174, 152 204, 108 202 C 64 200, 40 176, 40 128 Z";

const BEAN_PARTS: FigurePart[] = [
  { id: "coat", label: tx("seed coat", "Samenschale"), at: [62, 94], tag: [30, 40], info: tx("Tough outer skin: protects the embryo from drying out and from damage.", "Feste äußere Hülle: schützt den Keimling vor Austrocknung und Verletzung.") },
  { id: "hilum", label: tx("hilum", "Nabel"), at: [160, 132], tag: [190, 40], info: tx("Scar where the seed was attached to the pod.", "Narbe, an der der Samen in der Hülse festgewachsen war.") },
  { id: "cotyledon", label: tx("cotyledon (seed leaf)", "Keimblatt"), at: [280, 160], tag: [262, 236], info: tx("Two thick seed leaves full of stored food (starch, protein) for the embryo.", "Zwei dicke Keimblätter voller Nährstoffe (Stärke, Eiweiß) für den Keimling.") },
  { id: "plumule", label: tx("shoot bud (first leaves)", "Sprossknospe (erste Laubblätter)"), at: [330, 86], tag: [300, 30], info: tx("Becomes the shoot with the first real leaves.", "Wird zum Spross mit den ersten Laubblättern.") },
  { id: "stem", label: tx("embryonic stem", "Keimstängel"), at: [364, 118], tag: [420, 80], info: tx("Connects root and shoot. In the bean it lifts the cotyledons out of the soil.", "Verbindet Wurzel und Spross. Bei der Bohne hebt er die Keimblätter aus der Erde.") },
  { id: "radicle", label: tx("embryonic root", "Keimwurzel"), at: [370, 162], tag: [420, 206], info: tx("Breaks out first when the seed germinates.", "Bricht bei der Keimung als Erstes heraus.") },
];

export function FlowerBeanSeed({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Bean seed, closed and opened", "Bohnensamen, geschlossen und aufgeklappt")} width={440} height={250} parts={BEAN_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      {/* closed bean, outside */}
      <g data-part="coat">
        <path d={BEAN} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
        <path d="M 66 96 C 80 84, 98 80, 112 82" fill="none" stroke="var(--raised)" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      </g>
      <ellipse data-part="hilum" cx={160} cy={132} rx={5} ry={11} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
      {/* opened bean: one cotyledon seen from the inside, with the embryo */}
      <g transform="translate(210 0)">
        <g data-part="cotyledon">
          <path d={BEAN} fill="var(--bio-bone)" stroke="var(--bio-wood-deep)" strokeWidth={2} />
          <path d={BEAN} transform="translate(100 135) scale(0.9) translate(-100 -135)" fill="var(--bio-cell)" stroke="var(--bio-wood)" strokeWidth={1} opacity={0.8} />
        </g>
        <g data-part="stem">
          <path d="M 146 100 C 152 112, 156 124, 156 138" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={11} strokeLinecap="round" />
          <path d="M 146 100 C 152 112, 156 124, 156 138" fill="none" stroke="var(--bio-leaf)" strokeWidth={7.5} strokeLinecap="round" />
        </g>
        <g data-part="radicle">
          <path d="M 150 136 L 162 136 C 166 152, 168 168, 170 182 C 160 172, 152 156, 150 136 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
        <g data-part="plumule">
          <path d="M 146 100 C 132 86, 112 80, 94 86 C 108 98, 128 104, 146 100 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
          <path d="M 146 100 C 140 80, 126 68, 106 66 C 114 82, 128 94, 146 100 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        </g>
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Maize grain (a fruit and seed in one), longitudinal section

const MAIZE_PARTS: FigurePart[] = [
  { id: "wall", label: tx("fruit wall and seed coat (grown together)", "Fruchtwand und Samenschale (verwachsen)"), at: [244, 64], tag: [330, 40], info: tx("A maize grain is a fruit: fruit wall and seed coat form one thin skin.", "Ein Maiskorn ist eine Frucht: Fruchtwand und Samenschale bilden eine dünne Haut.") },
  { id: "endosperm", label: tx("endosperm (nutritive tissue)", "Nährgewebe (Endosperm)"), at: [218, 112], tag: [330, 110], info: tx("Stored starch that feeds the young plant.", "Gespeicherte Stärke, die die junge Pflanze ernährt.") },
  { id: "cotyledon", label: tx("cotyledon (scutellum)", "Keimblatt (Schildchen)"), at: [160, 168], tag: [60, 120], info: tx("Only one cotyledon. It takes up the food from the endosperm.", "Nur ein Keimblatt. Es nimmt die Nährstoffe aus dem Nährgewebe auf.") },
  { id: "plumule", label: tx("shoot bud", "Sprossknospe"), at: [184, 156], tag: [60, 180], info: tx("Becomes the shoot.", "Wird zum Spross.") },
  { id: "radicle", label: tx("embryonic root", "Keimwurzel"), at: [186, 212], tag: [330, 222], info: tx("Becomes the first root.", "Wird zur ersten Wurzel.") },
];

export function FlowerMaizeGrain({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("Maize grain, longitudinal section", "Maiskorn im Längsschnitt")} width={400} height={260} parts={MAIZE_PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <path data-part="wall" d="M 200 34 C 250 34, 274 64, 272 110 C 270 160, 246 206, 214 236 C 204 244, 192 244, 184 236 C 152 206, 128 160, 128 110 C 128 64, 150 34, 200 34 Z" fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={2.4} />
      <path data-part="endosperm" d="M 200 42 C 244 42, 264 68, 262 110 C 260 152, 240 194, 212 224 C 206 200, 196 176, 172 158 C 150 142, 140 126, 138 110 C 138 68, 158 42, 200 42 Z" fill="var(--bio-bone)" stroke="var(--bio-membrane)" strokeWidth={1} />
      <g data-part="cotyledon">
        <path d="M 140 118 C 150 140, 166 154, 180 166 C 196 182, 206 204, 210 226 C 196 230, 186 224, 178 214 C 160 192, 142 160, 140 118 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
      </g>
      <g data-part="plumule">
        <path d="M 178 194 C 176 178, 178 162, 186 148 C 192 160, 192 178, 188 194 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
      </g>
      <g data-part="radicle">
        <path d="M 180 198 L 190 198 C 192 208, 190 218, 186 226 C 181 218, 179 208, 180 198 Z" fill="var(--bio-wall)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
      </g>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Germination of a bean (epigeal: the cotyledons come above ground)

const GSTEPS: { title: Text; note: Text }[] = [
  { title: tx("Dry seed", "Trockener Samen"), note: tx("A dry seed can rest for years. It needs **water**, **warmth** and **oxygen** to germinate. Most seeds don't need light.", "Ein trockener Samen kann jahrelang ruhen. Zum Keimen braucht er **Wasser**, **Wärme** und **Sauerstoff**. Licht brauchen die meisten Samen nicht.") },
  { title: tx("Swelling", "Quellung"), note: tx("The seed soaks up water and swells. The seed coat becomes soft and bursts. The stored food is mobilised.", "Der Samen nimmt Wasser auf und quillt. Die Samenschale wird weich und platzt. Die Nährstoffe werden mobilisiert.") },
  { title: tx("The root comes first", "Zuerst die Wurzel"), note: tx("The **embryonic root** breaks out first and grows downwards. It anchors the seedling and takes up water.", "Die **Keimwurzel** bricht als Erstes heraus und wächst nach unten. Sie verankert den Keimling und nimmt Wasser auf.") },
  { title: tx("A hook pushes up", "Ein Haken schiebt sich hoch"), note: tx("The **embryonic stem** grows up in a hook. That protects the tender tip while it pushes through the soil.", "Der **Keimstängel** wächst hakenförmig nach oben. So wird die empfindliche Spitze beim Durchstoßen der Erde geschützt.") },
  { title: tx("Above ground", "Über der Erde"), note: tx("The stem straightens and lifts the **cotyledons** into the light. They turn green. The first true leaves unfold.", "Der Stängel streckt sich und hebt die **Keimblätter** ans Licht. Sie werden grün. Die ersten Laubblätter entfalten sich.") },
  { title: tx("A young plant", "Eine junge Pflanze"), note: tx("The cotyledons have given away their food and shrivel. Now the green **leaves** make food by photosynthesis.", "Die Keimblätter haben ihre Nährstoffe abgegeben und schrumpfen. Jetzt stellen die grünen **Laubblätter** durch Fotosynthese selbst Nährstoffe her.") },
];

const J = { x: 210, y: 204 };
const HOOK = [
  `M ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y}`,
  `M ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y}`,
  `M ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y} C ${J.x} ${J.y}, ${J.x} ${J.y}, ${J.x} ${J.y}`,
  `M ${J.x} ${J.y} C ${J.x} 172, ${J.x + 6} 150, 198 142 C 190 138, 182 146, 182 160`,
  `M ${J.x} ${J.y} C ${J.x} 170, ${J.x + 2} 140, 210 116 C 210 104, 210 96, 210 88`,
  `M ${J.x} ${J.y} C ${J.x} 160, ${J.x + 2} 120, 210 90 C 210 80, 210 72, 210 66`,
];
/** Cotyledons per step: centre x, y, half-width, half-height, tilt, opacity. */
const COTS = [
  { x: 212, y: 200, rx: 18, ry: 12, tilt: 0, o: 0 },
  { x: 212, y: 200, rx: 22, ry: 15, tilt: 0, o: 0 },
  { x: 212, y: 200, rx: 22, ry: 15, tilt: 0, o: 0 },
  { x: 186, y: 164, rx: 13, ry: 9, tilt: 60, o: 1 },
  { x: 210, y: 98, rx: 18, ry: 10, tilt: 28, o: 1 },
  { x: 210, y: 70, rx: 10, ry: 6, tilt: 40, o: 1 },
];

export function FlowerGermination({ start = 0 }: { start?: number }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(start);
  const tr = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 60, damping: 15 } as const);
  const c = COTS[step];
  const root = [0, 0, 0.34, 0.6, 0.85, 1][step];
  const t = useText();

  return (
    <div className="space-y-3">
      <svg viewBox="40 20 340 290" className="mx-auto block h-auto w-full" style={{ maxWidth: 460 }} role="img" aria-label={t(GSTEPS[step].title)}>
        {/* soil */}
        <rect x={40} y={150} width={340} height={160} fill="var(--bio-soil)" opacity={0.85} />
        <path d="M 40 150 C 90 146, 130 154, 180 150 S 290 146, 380 151" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={2} />
        {[
          [70, 190],
          [110, 250],
          [300, 180],
          [340, 260],
          [150, 290],
          [270, 284],
        ].map(([x, y]) => (
          <ellipse key={`${x}${y}`} cx={x} cy={y} rx={6} ry={4} fill="var(--bio-wood-deep)" opacity={0.35} />
        ))}
        {/* water drops while swelling */}
        <AnimatePresence>
          {step === 1 &&
            [
              [176, 186],
              [250, 192],
              [184, 226],
              [244, 222],
            ].map(([x, y], i) => (
              <motion.path
                key={`${x}`}
                d={`M ${x} ${y - 6} C ${x + 4} ${y}, ${x + 4} ${y + 4}, ${x} ${y + 4} C ${x - 4} ${y + 4}, ${x - 4} ${y}, ${x} ${y - 6} Z`}
                fill="var(--bio-water)"
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: reduce ? 0 : i * 0.15 }}
              />
            ))}
        </AnimatePresence>
        {/* root with root hairs and side roots */}
        <motion.path
          d={`M ${J.x} ${J.y + 2} C ${J.x - 2} 236, ${J.x + 4} 268, ${J.x} 302`}
          fill="none"
          stroke="var(--bio-bone)"
          strokeWidth={5}
          strokeLinecap="round"
          initial={false}
          animate={{ pathLength: root, opacity: root ? 1 : 0 }}
          transition={tr}
        />
        <motion.g initial={false} animate={{ opacity: step >= 4 ? 1 : 0 }} transition={tr}>
          {[
            [211, 240, 180, 262],
            [211, 252, 240, 274],
            [210, 266, 186, 290],
            [212, 278, 236, 298],
          ].map(([x1, y1, x2, y2]) => (
            <path key={`${x1}${y1}`} d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${y1 + 4} ${x2} ${y2}`} fill="none" stroke="var(--bio-bone)" strokeWidth={2.4} strokeLinecap="round" />
          ))}
        </motion.g>
        {/* embryonic stem */}
        <motion.path initial={false} animate={{ d: HOOK[step], opacity: step >= 3 ? 1 : 0 }} transition={tr} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={7} strokeLinecap="round" />
        <motion.path initial={false} animate={{ d: HOOK[step], opacity: step >= 3 ? 1 : 0 }} transition={tr} fill="none" stroke="var(--bio-leaf)" strokeWidth={4} strokeLinecap="round" />
        {/* first true leaves */}
        <motion.g initial={false} animate={{ opacity: step >= 4 ? 1 : 0, scale: step >= 5 ? 1.9 : step >= 4 ? 0.55 : 0.2, x: 210, y: step >= 5 ? 66 : 84 }} transition={tr}>
          <path d="M 0 0 C -10 -6, -30 -10, -40 -2 C -30 8, -10 6, 0 0 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          <path d="M 0 0 C 10 -6, 30 -10, 40 -2 C 30 8, 10 6, 0 0 Z" fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
        </motion.g>
        {/* cotyledons */}
        {[-1, 1].map((side) => (
          <motion.ellipse
            key={side}
            initial={false}
            animate={{ cx: c.x + side * (step >= 4 ? c.rx * 0.9 : 3), cy: c.y, rx: c.rx, ry: c.ry, rotate: side * c.tilt, opacity: c.o }}
            transition={tr}
            fill={step >= 4 ? "var(--bio-leaf)" : "var(--bio-bone)"}
            stroke="var(--bio-leaf-deep)"
            strokeWidth={1.4}
          />
        ))}
        {/* the seed with its coat (until it bursts) */}
        <motion.g initial={false} animate={{ opacity: step <= 2 ? 1 : 0 }} transition={tr}>
          <motion.ellipse cx={212} cy={200} initial={false} animate={{ rx: step === 0 ? 18 : 23, ry: step === 0 ? 12 : 15.5 }} transition={tr} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.8} />
          <motion.path d="M 200 192 L 206 198 L 202 204 L 208 210" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1.6} initial={false} animate={{ opacity: step >= 1 ? 1 : 0 }} />
        </motion.g>
      </svg>
      <StepCaption n={step + 1} title={GSTEPS[step].title} note={GSTEPS[step].note} />
      <StepControls step={step} onStep={setStep} titles={GSTEPS.map((g) => g.title)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lesson widget: tabs for bean seed, maize grain and germination

type Tab = "bean" | "maize" | "germ";
const TABS: { id: Tab; label: Text }[] = [
  { id: "bean", label: tx("Bean seed", "Bohnensamen") },
  { id: "maize", label: tx("Maize grain", "Maiskorn") },
  { id: "germ", label: tx("Germination", "Keimung") },
];

export function FlowerSeed() {
  const t = useText();
  const [tab, setTab] = useState<Tab>("bean");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            onClick={() => setTab(x.id)}
            className={cn("flex h-9 items-center rounded-lg border px-3 text-[13.5px] font-medium transition-colors", tab === x.id ? "border-blob bg-blob-soft text-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
          {tab === "bean" && <FlowerBeanSeed mode="explore" />}
          {tab === "maize" && <FlowerMaizeGrain mode="explore" />}
          {tab === "germ" && <FlowerGermination />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Germination experiment: dishes with bean seeds under different conditions (task picture)

function DishPic({ d }: { d: Dish }) {
  const water = d.water;
  return (
    <svg viewBox="0 0 120 60" className="block w-full" aria-hidden>
      <ellipse cx={60} cy={44} rx={54} ry={12} fill="var(--bio-vacuole)" stroke="var(--ink-3)" strokeWidth={1.5} />
      <path d="M 6 44 L 6 30 M 114 44 L 114 30" stroke="var(--ink-3)" strokeWidth={1.5} />
      {/* cotton wool */}
      <ellipse cx={60} cy={40} rx={48} ry={8} fill={water === "dry" ? "var(--bio-bone)" : "var(--bio-water)"} opacity={water === "dry" ? 1 : 0.45} />
      {[38, 60, 82].map((x) => (
        <ellipse key={x} cx={x} cy={36} rx={8} ry={5} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.2} />
      ))}
      {water === "under" && <path d="M 6 26 Q 60 22 114 26 L 114 44 Q 60 56 6 44 Z" fill="var(--bio-water)" opacity={0.45} />}
      {water === "under" && <path d="M 6 26 Q 60 22 114 26" fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.5} />}
    </svg>
  );
}

/** A row of dishes for a germination experiment (ids from DISHES). */
export function FlowerGermDishes({ ids }: { ids: string[] }) {
  const t = useText();
  const dishes = ids.map((id) => DISHES.find((d) => d.id === id)!).filter(Boolean);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(dishes.length, 5)}, minmax(0, 1fr))` }}>
      {dishes.map((d) => (
        <div key={d.id} className="rounded-xl border border-line bg-raised p-2 text-center">
          <div className="text-[15px] font-bold text-ink">{d.id}</div>
          <DishPic d={d} />
          <div className="mt-1 space-y-0.5 text-[11.5px] leading-tight text-ink-2">
            <div className="flex items-center justify-center gap-1">
              <Droplets className="size-3 shrink-0" />
              {d.water === "dry" ? t(tx("dry", "trocken")) : d.water === "moist" ? t(tx("moist", "feucht")) : t(tx("under water", "unter Wasser"))}
            </div>
            <div className="flex items-center justify-center gap-1">
              {d.cold ? <Snowflake className="size-3 shrink-0" /> : <Thermometer className="size-3 shrink-0" />}
              {d.cold ? "4 °C" : "20 °C"}
            </div>
            <div className="flex items-center justify-center gap-1">
              {d.dark ? <Moon className="size-3 shrink-0" /> : <Sun className="size-3 shrink-0" />}
              {d.dark ? t(tx("dark", "dunkel")) : t(tx("light", "hell"))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
