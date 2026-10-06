"use client";

// Level 1 widget: the leaf as a food factory. Switch light, water, carbon dioxide and chlorophyll
// on and off and watch what goes in (water up the stem, CO2 through the stomata, light) and what
// comes out (oxygen, sugar that is stored as starch). Missing one input stops the whole factory.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Droplets, Leaf, Sun, Wind } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { PhotoCO2, PhotoDrop, PhotoGlucose, PhotoO2, PhotoStarchChain } from "./PhotoMolecules";

type Input = "light" | "water" | "co2" | "chloro";

const INPUTS: { id: Input; label: Text; icon: ReactNode; missing: Text }[] = [
  {
    id: "light",
    label: tx("Light", "Licht"),
    icon: <Sun className="size-4" />,
    missing: tx(
      "No light, no energy: the factory stands still. In the dark a plant can't make sugar.",
      "Kein Licht, keine Energie: Die Fabrik steht still. Im Dunkeln kann eine Pflanze keinen Zucker herstellen.",
    ),
  },
  {
    id: "water",
    label: tx("Water", "Wasser"),
    icon: <Droplets className="size-4" />,
    missing: tx("Dry soil: no water comes up the stem, so the leaf has nothing to build with.", "Trockener Boden: Durch die Sprossachse kommt kein Wasser, dem Blatt fehlt ein Baustoff."),
  },
  {
    id: "co2",
    label: tx("Carbon dioxide", "Kohlenstoffdioxid"),
    icon: <Wind className="size-4" />,
    missing: tx(
      "Without carbon dioxide from the air there is no carbon for the sugar. The factory stops.",
      "Ohne Kohlenstoffdioxid aus der Luft fehlt der Kohlenstoff für den Zucker. Die Fabrik stoppt.",
    ),
  },
  {
    id: "chloro",
    label: tx("Chlorophyll", "Blattgrün"),
    icon: <Leaf className="size-4" />,
    missing: tx(
      "A white leaf has no chlorophyll. Nothing catches the light, so nothing is made, even in bright sun.",
      "Ein weißes Blatt hat kein Chlorophyll. Nichts fängt das Licht ein, also entsteht nichts, selbst in praller Sonne.",
    ),
  },
];

/** A molecule that travels along a path again and again. */
function Flow({ points, delay, duration, children, reduce }: { points: [number, number][]; delay: number; duration: number; children: ReactNode; reduce: boolean | null }) {
  if (reduce) {
    const [x, y] = points[Math.floor(points.length / 2)];
    return <g transform={`translate(${x} ${y})`}>{children}</g>;
  }
  const n = points.length;
  return (
    <motion.g
      initial={{ opacity: 0, x: points[0][0], y: points[0][1] }}
      animate={{ x: points.map((p) => p[0]), y: points.map((p) => p[1]), opacity: points.map((_, i) => (i === 0 || i === n - 1 ? 0 : 1)) }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear", times: points.map((_, i) => i / (n - 1)) }}
    >
      {children}
    </motion.g>
  );
}

const WATER_PATH: [number, number][] = [
  [196, 342],
  [214, 326],
  [238, 300],
  [240, 262],
  [242, 222],
  [262, 186],
  [300, 160],
];
const CO2_PATH: [number, number][] = [
  [40, 238],
  [120, 236],
  [200, 226],
  [282, 198],
  [312, 178],
  [330, 160],
];
const O2_PATH: [number, number][] = [
  [370, 140],
  [392, 164],
  [420, 182],
  [470, 204],
  [520, 220],
  [560, 230],
];
const SUGAR_PATH: [number, number][] = [
  [318, 152],
  [332, 144],
  [346, 136],
  [362, 126],
];

export function PhotoFactory() {
  const t = useText();
  const reduce = useReducedMotion();
  const [on, setOn] = useState<Record<Input, boolean>>({ light: true, water: true, co2: true, chloro: true });
  const [starch, setStarch] = useState(2);
  const missing = INPUTS.filter((i) => !on[i.id]);
  const running = missing.length === 0;

  // While the factory runs, sugar keeps coming and is stored as starch (a growing chain).
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setStarch((s) => (s >= 7 ? 2 : s + 1)), 1600);
    return () => clearInterval(id);
  }, [running]);

  const toggle = (id: Input) => setOn((o) => ({ ...o, [id]: !o[id] }));
  const leafFill = on.chloro ? "var(--bio-leaf)" : "var(--bio-cell)";
  const veins = on.chloro ? "var(--bio-leaf-deep)" : "var(--bio-wall-deep)";

  return (
    <div className="space-y-4">
      <svg viewBox="0 0 560 360" className="mx-auto block h-auto w-full max-w-[640px]" role="img" aria-label={t(tx("The leaf as a food factory", "Das Blatt als Nahrungsfabrik"))}>
        {/* air / soil */}
        <path d="M0 292 Q 140 284 280 290 T 560 288 L 560 360 L 0 360 Z" fill="var(--bio-soil)" opacity={on.water ? 0.85 : 0.45} />
        {on.water &&
          [
            [40, 320],
            [120, 334],
            [330, 326],
            [460, 318],
            [520, 340],
          ].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={10} ry={3} fill="var(--bio-water)" opacity={0.6} />)}

        {/* sun */}
        <motion.g animate={{ opacity: on.light ? 1 : 0.22 }} transition={{ duration: 0.4 }}>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return <line key={i} x1={66 + Math.cos(a) * 33} y1={60 + Math.sin(a) * 33} x2={66 + Math.cos(a) * 45} y2={60 + Math.sin(a) * 45} stroke="var(--bio-sun)" strokeWidth={4} strokeLinecap="round" />;
          })}
          <circle cx={66} cy={60} r={27} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.8} />
        </motion.g>
        <AnimatePresence>
          {on.light &&
            [0, 1, 2].map((i) => (
              <motion.path
                key={i}
                d={`M ${112 + i * 6} ${92 + i * 12} L ${300 + i * 14} ${128 + i * 8}`}
                stroke="var(--bio-sun)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="10 9"
                fill="none"
                initial={{ opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, strokeDashoffset: [0, -38] }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: 0.3 } : { opacity: { duration: 0.3 }, strokeDashoffset: { duration: 0.9, repeat: Infinity, ease: "linear" } }}
              />
            ))}
        </AnimatePresence>

        {/* roots, stem */}
        <g stroke="var(--bio-wood-deep)" strokeLinecap="round" fill="none" strokeWidth={3.2}>
          <path d="M240 292 C 236 312 218 326 194 344" />
          <path d="M240 292 C 246 314 264 326 290 340" />
          <path d="M240 294 C 242 312 238 332 242 350" />
        </g>
        <path d="M240 292 C 236 250 244 210 246 180" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={8} strokeLinecap="round" />

        {/* the factory leaf */}
        <motion.path
          d="M246 182 C 262 104 380 50 520 58 C 498 150 392 220 246 182 Z"
          animate={{ fill: leafFill }}
          transition={{ duration: 0.5 }}
          stroke={veins}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
        <path d="M246 182 Q 380 136 520 58" fill="none" stroke={veins} strokeWidth={1.8} />
        {[0.25, 0.45, 0.65, 0.82].map((k) => {
          const x = 246 + (520 - 246) * k;
          const y = 182 + (58 - 182) * k - 26 * Math.sin(Math.PI * k);
          return (
            <g key={k} stroke={veins} strokeWidth={1.2} fill="none">
              <path d={`M ${x} ${y} q 12 -20 30 -28`} />
              <path d={`M ${x} ${y} q 16 12 34 14`} />
            </g>
          );
        })}
        {/* stomata on the underside */}
        {[
          [304, 198],
          [352, 190],
          [404, 170],
        ].map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={6} ry={3.2} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
            <ellipse cx={x} cy={y} rx={3} ry={1} fill="var(--bio-outline)" />
          </g>
        ))}

        {/* starch store inside the leaf */}
        <g transform="translate(372 112) rotate(-24)">
          <PhotoStarchChain n={starch} s={1.3} />
        </g>

        {/* flows */}
        <AnimatePresence>
          {running && (
            <motion.g key="flows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {[0, 1, 2, 3].map((i) => (
                <Flow key={`w${i}`} points={WATER_PATH} delay={i * 0.9} duration={3.6} reduce={reduce}>
                  <PhotoDrop s={1.6} />
                </Flow>
              ))}
              {[0, 1, 2].map((i) => (
                <Flow key={`c${i}`} points={CO2_PATH} delay={0.4 + i * 1.2} duration={3.6} reduce={reduce}>
                  <PhotoCO2 s={1.5} />
                </Flow>
              ))}
              {[0, 1, 2].map((i) => (
                <Flow key={`o${i}`} points={O2_PATH} delay={1 + i * 1.2} duration={3.6} reduce={reduce}>
                  <PhotoO2 s={1.5} />
                </Flow>
              ))}
              <Flow points={SUGAR_PATH} delay={0.2} duration={1.6} reduce={reduce}>
                <PhotoGlucose s={1.5} />
              </Flow>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label={t(tx("What the leaf gets", "Was das Blatt bekommt"))}>
        {INPUTS.map((i) => (
          <button
            key={i.id}
            type="button"
            aria-pressed={on[i.id]}
            onClick={() => toggle(i.id)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[14px] font-medium transition-colors",
              on[i.id] ? "border-transparent bg-blob text-white" : "border-line bg-raised text-ink-3 line-through decoration-1 hover:bg-hover",
            )}
          >
            {i.icon}
            {t(i.label)}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Legend title={tx("Goes in", "Geht hinein")}>
          <Item icon={<PhotoDrop s={0.9} />} text={tx("water (from the soil, via roots and stem)", "Wasser (aus dem Boden, über Wurzeln und Sprossachse)")} dim={!on.water} />
          <Item icon={<PhotoCO2 s={0.85} />} text={tx("carbon dioxide (from the air, through the stomata)", "Kohlenstoffdioxid (aus der Luft, durch die Spaltöffnungen)")} dim={!on.co2} />
          <Item icon={<circle r={6} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.2} />} text={tx("light energy (from the sun)", "Lichtenergie (von der Sonne)")} dim={!on.light} />
        </Legend>
        <Legend title={tx("Comes out", "Kommt heraus")}>
          <Item icon={<PhotoO2 s={0.9} />} text={tx("oxygen (into the air)", "Sauerstoff (in die Luft)")} dim={!running} />
          <Item icon={<PhotoGlucose s={0.9} />} text={tx("glucose (sugar)", "Traubenzucker (Glucose)")} dim={!running} />
          <Item icon={<g transform="translate(-6 0)"><PhotoStarchChain n={2} s={0.7} /></g>} text={tx("stored as starch", "gespeichert als Stärke")} dim={!running} />
        </Legend>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={running ? "run" : missing.map((m) => m.id).join()}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", running ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}
        >
          {running
            ? t(tx("The factory is running! Water and carbon dioxide go in, light delivers the energy. Out come sugar and oxygen.", "Die Fabrik läuft! Wasser und Kohlenstoffdioxid gehen hinein, das Licht liefert die Energie. Heraus kommen Zucker und Sauerstoff."))
            : missing.length === 1
              ? t(missing[0].missing)
              : t(tx(`${missing.length} things are missing. Every one of them is needed, so nothing happens.`, `Es fehlen ${missing.length} Dinge. Jedes davon wird gebraucht, deshalb passiert nichts.`))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Legend({ title, children }: { title: Text; children: ReactNode }) {
  const t = useText();
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(title)}</div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Item({ icon, text, dim }: { icon: ReactNode; text: Text; dim: boolean }) {
  const t = useText();
  return (
    <li className={cn("flex items-center gap-2.5 text-[13.5px] leading-snug transition-opacity", dim ? "text-ink-3 opacity-50" : "text-ink")}>
      <svg viewBox="-12 -10 24 20" className="h-5 w-6 shrink-0" aria-hidden>
        {icon}
      </svg>
      <span>{t(text)}</span>
    </li>
  );
}
