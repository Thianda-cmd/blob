"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { CherryCup, CherryNectar, CherryPetals, CherrySepals, CherryStalk, CherryStamens, CherryStigma, CherryStyle, StepCaption, StepControls } from "./FlowerKit";

// From flower to fruit: after fertilisation the petals fall, the cup with sepals and stamens
// drops off, the ovary swells and ripens into a cherry. Colour code: the ovary (green) becomes
// the fruit, the ovule (orange) becomes the seed.

type Step = { title: Text; note: Text };

const STEPS: Step[] = [
  {
    title: tx("Fertilised flower", "Befruchtete Blüte"),
    note: tx(
      "Pollination and fertilisation have happened. Watch the **ovary** (green) and the **ovule** (orange) inside it.",
      "Bestäubung und Befruchtung sind passiert. Achte auf den **Fruchtknoten** (grün) und die **Samenanlage** (orange) darin.",
    ),
  },
  {
    title: tx("The petals fall", "Die Kronblätter fallen ab"),
    note: tx("The petals have done their job and fall off. The anthers are empty, the stigma dries up.", "Die Kronblätter haben ihre Aufgabe erfüllt und fallen ab. Die Staubbeutel sind leer, die Narbe vertrocknet."),
  },
  {
    title: tx("The ovary swells", "Der Fruchtknoten schwillt an"),
    note: tx(
      "In the cherry, the cup with sepals and stamens drops off too. Only the ovary stays on the stalk and grows.",
      "Bei der Kirsche fällt auch der Becher mit Kelchblättern und Staubblättern ab. Nur der Fruchtknoten bleibt am Stiel und wächst.",
    ),
  },
  {
    title: tx("A green cherry", "Eine grüne Kirsche"),
    note: tx(
      "The wall of the ovary becomes the fruit wall: soft on the outside, hard on the inside. The ovule grows into the seed.",
      "Die Wand des Fruchtknotens wird zur Fruchtwand: außen weich, innen hart. Die Samenanlage wächst zum Samen heran.",
    ),
  },
  {
    title: tx("A ripe cherry", "Eine reife Kirsche"),
    note: tx(
      "The **fruit** came from the ovary: skin, juicy flesh and the hard stone. The **seed** inside the stone came from the ovule.",
      "Die **Frucht** ist aus dem Fruchtknoten entstanden: Haut, saftiges Fruchtfleisch und der harte Steinkern. Der **Samen** im Stein ist aus der Samenanlage entstanden.",
    ),
  },
];

// Geometry per step: ovary (fruit) ellipse, inner cavity / stone, ovule / seed.
const FRUIT = [
  { cx: 240, cy: 226, rx: 21, ry: 26 },
  { cx: 240, cy: 225, rx: 23, ry: 28 },
  { cx: 240, cy: 214, rx: 34, ry: 40 },
  { cx: 240, cy: 200, rx: 52, ry: 55 },
  { cx: 240, cy: 190, rx: 68, ry: 66 },
];
const INNER = [
  { cx: 240, cy: 226, rx: 12.5, ry: 17 },
  { cx: 240, cy: 225, rx: 13.5, ry: 18 },
  { cx: 240, cy: 214, rx: 18, ry: 23 },
  { cx: 240, cy: 200, rx: 24, ry: 28 },
  { cx: 240, cy: 190, rx: 27, ry: 31 },
];
const SEED = [
  { cx: 240, cy: 228, rx: 7, ry: 10 },
  { cx: 240, cy: 227, rx: 7.5, ry: 10.5 },
  { cx: 240, cy: 216, rx: 11, ry: 15 },
  { cx: 240, cy: 202, rx: 15.5, ry: 19.5 },
  { cx: 240, cy: 192, rx: 17, ry: 21 },
];

const spring = { type: "spring", stiffness: 70, damping: 16 } as const;

export function FlowerToFruit({ start = 0 }: { start?: number }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(start);
  const last = STEPS.length - 1;

  const tr = reduce ? { duration: 0 } : spring;
  const fall = (on: boolean, dx: number) => ({ opacity: on ? 0 : 1, x: on ? dx : 0, y: on ? 90 : 0, rotate: on ? dx / 2 : 0 });
  const ripe = step === last;
  const green = step === 3;

  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-center">
        <svg viewBox="40 30 400 330" className="mx-auto block h-auto w-full" style={{ maxWidth: 520 }} role="img" aria-label={t(STEPS[step].title)}>
          {/* petals fall first */}
          <motion.g initial={false} animate={fall(step >= 1, -40)} transition={tr} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <CherryPetals part={false} />
          </motion.g>
          {/* the cup with sepals, nectar and stamens drops off at step 2 */}
          <motion.g initial={false} animate={fall(step >= 2, 0)} transition={tr}>
            <CherrySepals part={false} />
          </motion.g>
          <CherryStalk part={false} />
          {/* the top of the stalk that carries the growing fruit once the cup has gone */}
          <motion.line
            initial={false}
            animate={{ y1: FRUIT[step].cy + FRUIT[step].ry - 3, opacity: step >= 2 ? 1 : 0 }}
            transition={tr}
            x1={240}
            x2={240}
            y2={266}
            stroke="var(--bio-leaf-deep)"
            strokeWidth={10}
            strokeLinecap="round"
          />
          <motion.line
            initial={false}
            animate={{ y1: FRUIT[step].cy + FRUIT[step].ry - 3, opacity: step >= 2 ? 1 : 0 }}
            transition={tr}
            x1={240}
            x2={240}
            y2={266}
            stroke="var(--bio-leaf)"
            strokeWidth={6.5}
            strokeLinecap="round"
          />
          <motion.g initial={false} animate={fall(step >= 2, 0)} transition={tr}>
            <CherryCup part={false} />
            <motion.g initial={false} animate={{ opacity: step >= 1 ? 0.25 : 1 }} transition={tr}>
              <CherryNectar part={false} />
            </motion.g>
          </motion.g>

          {/* ovary → fruit: green layer, then the ripe red layer */}
          <motion.ellipse initial={false} animate={{ ...FRUIT[step], opacity: ripe ? 0 : 1 }} transition={tr} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.8} />
          <motion.ellipse initial={false} animate={{ ...FRUIT[step], opacity: ripe ? 1 : 0 }} transition={tr} fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={2} />
          {/* flesh of the ripe cherry (inside the skin): a lighter red */}
          <motion.ellipse
            initial={false}
            animate={{ cx: FRUIT[step].cx, cy: FRUIT[step].cy, rx: Math.max(0, FRUIT[step].rx - 5), ry: Math.max(0, FRUIT[step].ry - 5), opacity: ripe ? 1 : 0 }}
            transition={tr}
            fill="var(--raised)"
          />
          <motion.ellipse
            initial={false}
            animate={{ cx: FRUIT[step].cx, cy: FRUIT[step].cy, rx: Math.max(0, FRUIT[step].rx - 5), ry: Math.max(0, FRUIT[step].ry - 5), opacity: ripe ? 0.62 : 0 }}
            transition={tr}
            fill="var(--bio-blood)"
          />
          {/* cavity of the ovary → stone (hard inner layer of the fruit wall) */}
          <motion.ellipse initial={false} animate={{ ...INNER[step], opacity: step >= 3 ? 0 : 1 }} transition={tr} fill="var(--bio-cell)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
          <motion.ellipse
            initial={false}
            animate={{ ...INNER[step], opacity: green ? 0.75 : ripe ? 1 : 0 }}
            transition={tr}
            fill="var(--bio-bone)"
            stroke="var(--bio-wood-deep)"
            strokeWidth={green ? 1.2 : 3}
          />
          {/* ovule → seed */}
          <motion.line
            initial={false}
            animate={{ x1: 240, x2: 240, y1: INNER[step].cy - INNER[step].ry, y2: SEED[step].cy - SEED[step].ry, opacity: step >= 3 ? 0 : 1 }}
            transition={tr}
            stroke="var(--bio-mito-deep)"
            strokeWidth={1.6}
          />
          <motion.ellipse initial={false} animate={SEED[step]} transition={tr} fill="var(--bio-mito)" stroke="var(--bio-mito-deep)" strokeWidth={1.5} />
          {/* style and stigma dry up, then fall */}
          <motion.g initial={false} animate={{ opacity: step === 0 ? 1 : step === 1 ? 0.45 : 0, y: step >= 2 ? -10 : 0 }} transition={tr}>
            <CherryStyle part={false} />
            <CherryStigma part={false} />
          </motion.g>
          {/* stamens: anthers empty at step 1, gone with the cup at step 2 */}
          <motion.g initial={false} animate={{ ...fall(step >= 2, 0), opacity: step >= 2 ? 0 : step === 1 ? 0.55 : 1 }} transition={tr}>
            <CherryStamens part={false} />
          </motion.g>
          {/* a shine on the ripe cherry */}
          <motion.path
            d="M 196 150 Q 206 136 222 132"
            fill="none"
            stroke="var(--raised)"
            strokeWidth={5}
            strokeLinecap="round"
            initial={false}
            animate={{ opacity: ripe ? 0.6 : 0 }}
            transition={tr}
          />
        </svg>

        <div className="space-y-2 text-[13.5px]">
          <Key swatch="var(--bio-leaf)" from={tx("ovary", "Fruchtknoten")} to={tx("fruit", "Frucht")} t={t} ripeSwatch={ripe ? "var(--bio-blood)" : undefined} />
          <Key swatch="var(--bio-mito)" from={tx("ovule", "Samenanlage")} to={tx("seed", "Samen")} t={t} />
          <AnimatePresence initial={false}>
            {ripe && (
              <motion.ul initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-1 pt-1 text-ink-2">
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full border-2" style={{ borderColor: "var(--bio-outline)", background: "var(--bio-blood)" }} /> {t(tx("skin", "Haut"))}
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: "color-mix(in srgb, var(--bio-blood) 62%, var(--raised))" }} /> {t(tx("flesh", "Fruchtfleisch"))}
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full border-2" style={{ borderColor: "var(--bio-wood-deep)", background: "var(--bio-bone)" }} /> {t(tx("stone (hard inner fruit wall)", "Steinkern (harte innere Fruchtwand)"))}
                </li>
                <li className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: "var(--bio-mito)" }} /> {t(tx("seed", "Samen"))}
                </li>
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      </div>

      <StepCaption n={step + 1} title={STEPS[step].title} note={STEPS[step].note} />
      <StepControls step={step} onStep={setStep} titles={STEPS.map((s) => s.title)} />
    </div>
  );
}

function Key({ swatch, ripeSwatch, from, to, t }: { swatch: string; ripeSwatch?: string; from: Text; to: Text; t: (x: Text) => string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
      <span className="size-3.5 shrink-0 rounded-full" style={{ background: ripeSwatch ?? swatch }} />
      <span className="text-ink">{t(from)}</span>
      <ChevronRight className="size-3.5 text-ink-3" />
      <span className="font-semibold text-ink">{t(to)}</span>
    </div>
  );
}
