"use client";

import { AnimatePresence, motion, useReducedMotion, useSpring, useTransform } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

// Lamarck and Darwin side by side, explaining the giraffe's long neck in four steps.

const OUT = "var(--bio-outline)";
const COAT = "var(--bio-sun)";
const SPOT = "var(--bio-wood)";
const ANGLE = (68 * Math.PI) / 180;

type G = { id: string; x: number; neck: number; s?: number; faded?: boolean; stretch?: boolean };

const neckTop = (L: number) => [16 + L * cos(ANGLE), -66 - L * sin(ANGLE)] as const;

/** One giraffe standing on the ground at (0, 0), facing right. The neck length glides smoothly. */
function Giraffe({ g }: { g: G }) {
  const reduce = useReducedMotion();
  const L = useSpring(g.neck, { stiffness: 60, damping: 14 });
  useEffect(() => {
    if (reduce) L.jump(g.neck);
    else L.set(g.neck);
  }, [L, g.neck, reduce]);
  // the neck runs from the shoulders up and forward; p is the direction across the neck
  const px = sin(ANGLE);
  const py = cos(ANGLE);
  const neckD = useTransform(L, (l) => {
    const [x2, y2] = neckTop(l);
    return `M${17 - px * 7} ${-62 - py * 7} L${x2 - px * 3.5} ${y2 - py * 3.5} L${x2 + px * 3.5} ${y2 + py * 3.5} L${17 + px * 7} ${-62 + py * 7} Z`;
  });
  const maneD = useTransform(L, (l) => {
    const [x2, y2] = neckTop(l);
    return `M${17 - px * 7.5} ${-62 - py * 7.5} L${x2 - px * 3.8} ${y2 - py * 3.8}`;
  });
  const spotsD = useTransform(L, (l) => {
    const [x2, y2] = neckTop(l);
    return `M${17 + px * 0.5} ${-64} L${x2} ${y2 + 5}`;
  });
  const hx = useTransform(L, (l) => neckTop(l)[0]);
  const hy = useTransform(L, (l) => neckTop(l)[1]);
  return (
    <motion.g initial={false} animate={{ x: g.x, opacity: g.faded ? 0.22 : 1 }} transition={{ type: "spring", stiffness: 120, damping: 18 }}>
      <g transform={`scale(${g.s ?? 1})`}>
        {/* legs */}
        {[-18, -11, 13, 20].map((x, i) => (
          <g key={i}>
            <path d={`M${x} -50 L${x + (i % 2 ? 1 : -1)} -2`} stroke={OUT} strokeWidth={6.4} strokeLinecap="round" />
            <path d={`M${x} -50 L${x + (i % 2 ? 1 : -1)} -2`} stroke={COAT} strokeWidth={4} strokeLinecap="round" />
          </g>
        ))}
        {/* tail */}
        <path d="M-26 -62 Q-34 -50 -31 -36" fill="none" stroke={OUT} strokeWidth={1.6} />
        <ellipse cx={-31} cy={-33} rx={2.4} ry={4} fill={OUT} />
        {/* neck behind the body */}
        <motion.path d={neckD} fill={COAT} stroke={OUT} strokeWidth={1.6} strokeLinejoin="round" />
        <motion.path d={spotsD} fill="none" stroke={SPOT} strokeWidth={5.5} strokeDasharray="4 5" strokeLinecap="round" />
        <motion.path d={maneD} fill="none" stroke={SPOT} strokeWidth={2.2} strokeLinecap="round" />
        {/* body */}
        <ellipse cx={0} cy={-60} rx={28} ry={14} transform="rotate(-9 0 -60)" fill={COAT} stroke={OUT} strokeWidth={1.7} />
        {[
          [-14, -62, 6, 4],
          [-2, -66, 5, 3.5],
          [10, -63, 5.5, 4],
          [-8, -54, 5, 3.2],
          [6, -55, 4.5, 3],
        ].map(([x, y, rx, ry], i) => (
          <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill={SPOT} />
        ))}
        {/* head */}
        <motion.g style={{ x: hx, y: hy }}>
          <path d="M-3 -6 L-4 -12 M2 -6 L2 -12" stroke={OUT} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={-4} cy={-12.5} r={1.8} fill={OUT} />
          <circle cx={2} cy={-12.5} r={1.8} fill={OUT} />
          <ellipse cx={-6} cy={-4} rx={4} ry={2} transform="rotate(-30 -6 -4)" fill={COAT} stroke={OUT} strokeWidth={1.2} />
          <path d="M-6 -6 Q2 -9 9 -3 Q13 1 11 4 Q6 6 -2 2 Q-7 -1 -6 -6 Z" fill={COAT} stroke={OUT} strokeWidth={1.5} strokeLinejoin="round" />
          <circle cx={1} cy={-3} r={1.3} fill={OUT} />
        </motion.g>
        {/* stretching arrow */}
        <AnimatePresence>
          {g.stretch && (
            <motion.g initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <motion.g style={{ x: hx, y: hy }}>
                <path d="M16 6 L16 -20 M10 -13 L16 -20 L22 -13" fill="none" stroke="var(--blob)" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </motion.g>
            </motion.g>
          )}
        </AnimatePresence>
      </g>
    </motion.g>
  );
}

/** An acacia: leaves high up in the crown, and low leaves that may already be eaten. */
function Acacia({ low }: { low: boolean }) {
  return (
    <g>
      <path d="M258 200 Q254 140 250 84 M250 112 Q236 100 222 90 M252 100 Q266 88 276 80" fill="none" stroke="var(--bio-wood)" strokeWidth={6} strokeLinecap="round" />
      <path d="M258 200 Q254 140 250 84" fill="none" stroke={OUT} strokeWidth={1.2} opacity={0.4} />
      <ellipse cx={248} cy={70} rx={52} ry={15} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
      <ellipse cx={228} cy={64} rx={24} ry={9} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      <ellipse cx={268} cy={63} rx={22} ry={8} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
      <AnimatePresence>
        {low && (
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.6 }} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <path d="M256 160 Q240 152 226 150" fill="none" stroke="var(--bio-wood)" strokeWidth={3.5} strokeLinecap="round" />
            <ellipse cx={226} cy={148} rx={16} ry={7} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.2} />
          </motion.g>
        )}
      </AnimatePresence>
    </g>
  );
}

type Scene = { title: Text; giraffes: G[]; low: boolean; text: Text; wrong?: boolean };

const LAMARCK: Scene[] = [
  {
    title: tx("Short necks", "Kurze Hälse"),
    giraffes: [{ id: "p", x: 150, neck: 34 }],
    low: false,
    text: tx("The ancestors of giraffes had short necks. The low leaves were eaten, the high ones were out of reach.", "Die Vorfahren der Giraffen hatten kurze Hälse. Die unteren Blätter waren abgefressen, an die oberen kamen sie nicht heran."),
  },
  {
    title: tx("Use: stretching", "Gebrauch: Strecken"),
    giraffes: [{ id: "p", x: 150, neck: 58, stretch: true }],
    low: false,
    text: tx(
      "Lamarck: each giraffe stretched its neck all its life. Organs that are used a lot grow stronger, so the neck got a little longer (use and disuse).",
      "Lamarck: Jede Giraffe streckte ihr Leben lang den Hals. Organe, die viel gebraucht werden, werden kräftiger. So wurde der Hals etwas länger (Gebrauch und Nichtgebrauch).",
    ),
  },
  {
    title: tx("Inheritance of acquired traits", "Vererbung erworbener Eigenschaften"),
    giraffes: [
      { id: "p", x: 118, neck: 58 },
      { id: "c", x: 196, neck: 58, s: 0.62 },
    ],
    low: false,
    wrong: true,
    text: tx(
      "Lamarck thought the young inherit the longer neck their parents acquired. That's wrong: what a body acquires during life doesn't change the genetic information in its germ cells.",
      "Lamarck meinte, die Jungen erben den im Leben erworbenen längeren Hals. Das ist falsch: Was ein Körper im Leben erwirbt, verändert nicht die Erbinformation in den Keimzellen.",
    ),
  },
  {
    title: tx("Long necks", "Lange Hälse"),
    giraffes: [
      { id: "p", x: 96, neck: 80 },
      { id: "c", x: 168, neck: 82 },
    ],
    low: false,
    text: tx("So, according to Lamarck, the neck grew a little longer generation after generation, because the animals needed it.", "So wäre der Hals nach Lamarck Generation für Generation etwas länger geworden, weil die Tiere ihn brauchten."),
  },
];

const herd = (necks: number[], faded: number[] = []): G[] => necks.map((n, i) => ({ id: `g${i}`, x: 34 + i * 40, neck: n, s: 0.78, faded: faded.includes(i) }));

const DARWIN: Scene[] = [
  {
    title: tx("Variation and many young", "Variation und Überproduktion"),
    giraffes: herd([30, 46, 36, 58, 40]),
    low: true,
    text: tx(
      "Darwin: giraffes have more young than can survive. The animals differ, for example in neck length (variation), and these differences are inherited.",
      "Darwin: Giraffen bekommen mehr Junge, als überleben können. Die Tiere unterscheiden sich, z. B. in der Halslänge (Variation), und diese Unterschiede sind erblich.",
    ),
  },
  {
    title: tx("Competition", "Konkurrenz"),
    giraffes: herd([30, 46, 36, 58, 40]),
    low: false,
    text: tx("In the dry season food gets scarce: the low leaves are gone. The animals compete for the rest (struggle for existence).", "In der Trockenzeit wird das Futter knapp: Die unteren Blätter sind weg. Die Tiere konkurrieren um den Rest (Kampf ums Dasein)."),
  },
  {
    title: tx("Natural selection", "Natürliche Selektion"),
    giraffes: herd([30, 46, 36, 58, 40], [0, 2, 4]),
    low: false,
    text: tx(
      "Animals with longer necks reach more leaves. They survive more often and have more young. Short-necked ones more often starve before they reproduce.",
      "Tiere mit längerem Hals erreichen mehr Blätter. Sie überleben häufiger und haben mehr Nachkommen. Kurzhalsige verhungern öfter, bevor sie sich fortpflanzen.",
    ),
  },
  {
    title: tx("Inheritance", "Vererbung"),
    giraffes: herd([52, 62, 48, 66, 56]),
    low: false,
    text: tx(
      "The young inherit the long necks of their parents. Over many generations the average neck in the population gets longer. No single giraffe changed: the population did.",
      "Die Jungen erben die langen Hälse ihrer Eltern. Über viele Generationen wird der Hals in der Population im Mittel länger. Keine einzelne Giraffe hat sich verändert, sondern die Population.",
    ),
  },
];

function Panel({ who, year, scene, step }: { who: Text; year: string; scene: Scene; step: number }) {
  const t = useText();
  const reduce = useReducedMotion();
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3.5 py-2">
        <span className="font-semibold text-ink">
          {t(who)} <span className="font-normal text-ink-3">({year})</span>
        </span>
        <AnimatePresence>
          {scene.wrong && (
            <motion.span initial={reduce ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="rounded-full border border-danger px-2 py-0.5 text-[12px] font-semibold text-danger">
              {t(tx("refuted", "widerlegt"))}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <svg viewBox="0 0 300 210" className="block h-auto w-full" role="img" aria-label={t(scene.title)}>
        <rect x={0} y={0} width={300} height={210} fill="color-mix(in oklab, var(--bio-sun) 10%, var(--surface))" />
        <path d="M0 196 Q80 190 150 194 Q230 198 300 192 L300 210 L0 210 Z" fill="color-mix(in oklab, var(--bio-soil) 45%, var(--bio-sun))" />
        <Acacia low={scene.low} />
        <g transform="translate(0 198)">
          <AnimatePresence>
            {scene.giraffes.map((g) => (
              <motion.g key={g.id} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Giraffe g={g} />
              </motion.g>
            ))}
          </AnimatePresence>
        </g>
      </svg>
      <div className="flex-1 space-y-1 px-3.5 py-3">
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-blob-ink">
          {step + 1}. {t(scene.title)}
        </div>
        <p className="text-[14px] leading-relaxed text-ink-2">{t(scene.text)}</p>
      </div>
    </div>
  );
}

export function EvolutionGiraffes() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const last = LAMARCK.length - 1;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          aria-label={t(tx("Previous step", "Vorheriger Schritt"))}
          className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-hover disabled:opacity-40"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="flex flex-1 gap-1.5" role="tablist" aria-label={t(tx("Steps", "Schritte"))}>
          {LAMARCK.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={step === i}
              onClick={() => setStep(i)}
              className={cn("relative h-10 flex-1 rounded-xl border text-[14px] font-semibold tabular-nums transition-colors", step === i ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover")}
            >
              {step === i && <motion.span layoutId={`${scope}-step`} className="absolute inset-0 rounded-xl bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
              <span className="relative">{i + 1}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep(Math.min(last, step + 1))}
          disabled={step === last}
          aria-label={t(tx("Next step", "Nächster Schritt"))}
          className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 transition-colors hover:bg-hover disabled:opacity-40"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Panel who={tx("Lamarck", "Lamarck")} year="1809" scene={LAMARCK[step]} step={step} />
        <Panel who={tx("Darwin", "Darwin")} year="1859" scene={DARWIN[step]} step={step} />
      </div>
    </div>
  );
}
