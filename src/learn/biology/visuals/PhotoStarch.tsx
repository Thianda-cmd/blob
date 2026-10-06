"use client";

// The iodine starch test on a partly covered leaf (level 1). `PhotoStarchLeaf` is the drawing
// (also used in tasks, with numbered areas), `PhotoStarchTest` the lesson widget: destarch the
// plant in the dark, cover part of a leaf, put it in the light, boil it, take the green out with
// hot alcohol and drip iodine solution on it. Only lit, green parts turn blue-black.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";

export type Stencil = "strip" | "circle" | "star";
export type LeafStage = "green" | "foil" | "pale" | "iodine";

const LEAF = "M60 130 C 100 40 262 36 330 122 C 262 212 104 218 60 130 Z";
const INNER = "M80 130 C 114 68 250 62 302 122 C 252 186 118 192 80 130 Z";
const MIDRIB = "M60 130 Q 196 116 330 122";

/** Blue-black of starch with iodine, and the yellow-brown of iodine solution, from the palette. */
const STARCH_BLUE = "light-dark(color-mix(in oklab, var(--bio-blood-low) 50%, var(--bio-outline)), color-mix(in oklab, var(--bio-blood-low) 62%, var(--bio-cell)))";
const IODINE_BROWN = "color-mix(in oklab, var(--bio-pollen) 55%, var(--bio-wood))";

function starPath(cx: number, cy: number, R: number, r: number) {
  return (
    Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 ? r : R;
      return `${i ? "L" : "M"}${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
    }).join(" ") + " Z"
  );
}
const STAR = starPath(196, 130, 50, 21);

/** The foil, as SVG shapes (evenodd for the stencil with a star-shaped window). */
function Foil({ stencil, fill, stroke }: { stencil: Stencil; fill: string; stroke?: string }) {
  const s = stroke ? { stroke, strokeWidth: 1.6 } : {};
  if (stencil === "strip") return <rect x={168} y={30} width={58} height={200} rx={3} fill={fill} {...s} />;
  if (stencil === "circle") return <circle cx={240} cy={126} r={42} fill={fill} {...s} />;
  return <path d={`M44 30 H 346 V 226 H 44 Z ${STAR}`} fillRule="evenodd" fill={fill} {...s} />;
}

const LIT_AT: Record<Stencil, [number, number]> = { strip: [114, 130], circle: [142, 128], star: [196, 132] };
const COVER_AT: Record<Stencil, [number, number]> = { strip: [197, 128], circle: [240, 126], star: [276, 124] };

function parts(stencil: Stencil, variegated: boolean, order?: string[]): FigurePart[] {
  const all: FigurePart[] = [
    { id: "lit", label: tx("green, in the light", "grün, im Licht"), at: LIT_AT[stencil] },
    { id: "covered", label: tx("covered by foil", "mit Folie abgedeckt"), at: COVER_AT[stencil] },
    ...(variegated ? [{ id: "margin", label: tx("white edge, in the light", "weißer Rand, im Licht"), at: [124, 188] as [number, number] }] : []),
  ];
  return order ? order.flatMap((id) => all.filter((p) => p.id === id)) : all;
}

export type StarchLeafProps = {
  stencil?: Stencil;
  variegated?: boolean;
  stage?: LeafStage;
  /** Numbered areas (tasks): which areas get a marker, numbered in this order. */
  areas?: string[];
};

/** The leaf drawing at any stage of the test. */
export function PhotoStarchLeaf({ stencil = "strip", variegated = false, stage = "iodine", areas }: StarchLeafProps) {
  const p = parts(stencil, variegated, areas);
  return (
    <Figure
      title={tx("Leaf in the iodine starch test", "Blatt beim Stärkenachweis mit Iod")}
      width={380}
      height={250}
      parts={p}
      mode={areas ? "numbers" : "plain"}
      legend="none"
    >
      <LeafArt stencil={stencil} variegated={variegated} stage={stage} />
    </Figure>
  );
}

function LeafArt({ stencil, variegated, stage, stain = 1 }: { stencil: Stencil; variegated: boolean; stage: LeafStage; stain?: number }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const green = stage === "green" || stage === "foil";
  const base = green ? (variegated ? "var(--bio-cell)" : "var(--bio-leaf)") : stage === "pale" ? "var(--bio-bone)" : IODINE_BROWN;
  const vein = green ? "var(--bio-leaf-deep)" : "var(--bio-wood-deep)";
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-leaf`}>
          <path d={LEAF} />
        </clipPath>
        <mask id={`${uid}-starch`} maskUnits="userSpaceOnUse" x={0} y={0} width={380} height={250}>
          <rect x={0} y={0} width={380} height={250} fill="black" />
          <path d={variegated ? INNER : LEAF} fill="white" />
          <Foil stencil={stencil} fill="black" />
        </mask>
      </defs>
      <line x1={60} y1={130} x2={14} y2={150} stroke={green ? "var(--bio-leaf-deep)" : vein} strokeWidth={5} strokeLinecap="round" />
      <path d={LEAF} fill={base} stroke={green ? "var(--bio-leaf-deep)" : vein} strokeWidth={2} strokeLinejoin="round" />
      {green && variegated && <path d={INNER} fill="var(--bio-leaf)" />}
      {stage === "iodine" && (
        <motion.g initial={false} animate={{ opacity: stain }} transition={{ duration: 1.4 }} mask={`url(#${uid}-starch)`}>
          <path d={LEAF} fill={STARCH_BLUE} />
        </motion.g>
      )}
      <g clipPath={`url(#${uid}-leaf)`} fill="none" stroke={vein} strokeWidth={1.3} opacity={0.8}>
        <path d={MIDRIB} strokeWidth={2} />
        {[0.2, 0.36, 0.52, 0.68, 0.84].map((k) => {
          const x = 60 + 270 * k;
          const y = 130 - 8 * Math.sin(Math.PI * k) - 8 * k;
          return (
            <g key={k}>
              <path d={`M ${x} ${y} q 14 -30 40 -52`} />
              <path d={`M ${x} ${y} q 14 30 40 52`} />
            </g>
          );
        })}
      </g>
      {stage === "foil" && (
        <g>
          <Foil stencil={stencil} fill="var(--raised)" stroke="var(--ink-3)" />
          {stencil !== "star" &&
            [0, 1, 2].map((i) => (
              <line
                key={i}
                x1={stencil === "strip" ? 176 + i * 16 : 214 + i * 16}
                y1={stencil === "strip" ? 44 : 100 + i * 4}
                x2={stencil === "strip" ? 186 + i * 16 : 226 + i * 16}
                y2={stencil === "strip" ? 216 : 150 + i * 4}
                stroke="var(--line-2)"
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// The lesson widget

type Step = { title: Text; text: Text; stage: LeafStage; prop?: "moon" | "sun" | "water" | "alcohol" | "iodine" };

const STEPS: Step[] = [
  {
    title: tx("The plant", "Die Pflanze"),
    text: tx("Choose a stencil and a leaf. Then start the experiment.", "Wähle eine Abdeckung und ein Blatt. Dann starte den Versuch."),
    stage: "green",
  },
  {
    title: tx("1. Two days in the dark", "1. Zwei Tage ins Dunkle"),
    text: tx(
      "In the dark the plant uses up the starch in its leaves. Now we know: any starch we find later must be new.",
      "Im Dunkeln verbraucht die Pflanze die Stärke in ihren Blättern (entstärken). So wissen wir: Jede Stärke, die wir später finden, ist neu.",
    ),
    stage: "green",
    prop: "moon",
  },
  {
    title: tx("2. Cover part of a leaf", "2. Einen Blattteil abdecken"),
    text: tx("Aluminium foil on both sides keeps the light away from this part. The rest of the leaf stays uncovered.", "Alufolie auf beiden Seiten hält das Licht von diesem Teil fern. Der Rest des Blattes bleibt frei."),
    stage: "foil",
  },
  {
    title: tx("3. Into the light", "3. Ins Licht"),
    text: tx("A few hours of sunshine. Where light reaches green leaf parts, the plant makes sugar and stores it as starch.", "Ein paar Stunden Sonne. Wo Licht auf grüne Blattteile fällt, stellt die Pflanze Zucker her und speichert ihn als Stärke."),
    stage: "foil",
    prop: "sun",
  },
  {
    title: tx("4. Boil the leaf", "4. Blatt abkochen"),
    text: tx("Remove the foil and put the leaf into boiling water for a minute. This softens it so the next liquids can get in.", "Folie ab und das Blatt kurz in kochendes Wasser. Das macht es weich, damit die nächsten Flüssigkeiten eindringen können."),
    stage: "green",
    prop: "water",
  },
  {
    title: tx("5. Hot alcohol", "5. Heißer Alkohol"),
    text: tx(
      "In hot alcohol (heated in a water bath, never over a flame) the chlorophyll dissolves out. The leaf turns pale and the alcohol green. Now colours are easy to see.",
      "In heißem Alkohol (im Wasserbad erhitzt, nie über der Flamme) löst sich das Chlorophyll heraus. Das Blatt wird blass, der Alkohol grün. Jetzt sieht man Farben gut.",
    ),
    stage: "pale",
    prop: "alcohol",
  },
  {
    title: tx("6. Iodine solution", "6. Iodlösung"),
    text: tx(
      "Iodine solution turns starch blue-black. Without starch it stays yellow-brown.",
      "Iodlösung färbt Stärke blau-schwarz. Ohne Stärke bleibt sie gelb-braun.",
    ),
    stage: "iodine",
    prop: "iodine",
  },
];

const STENCILS: { id: Stencil; label: Text }[] = [
  { id: "strip", label: tx("Strip", "Streifen") },
  { id: "circle", label: tx("Circle", "Kreis") },
  { id: "star", label: tx("Star stencil", "Stern-Schablone") },
];

function result(stencil: Stencil, variegated: boolean): Text {
  const covered =
    stencil === "star"
      ? ["Only the star, where light came through the stencil, turns blue-black.", "Nur der Stern, durch den Licht fiel, wird blau-schwarz."]
      : ["The lit green part turns blue-black. The covered part stays yellow-brown: no light, no photosynthesis, no starch.", "Der belichtete grüne Teil wird blau-schwarz. Der abgedeckte Teil bleibt gelb-braun: kein Licht, keine Fotosynthese, keine Stärke."];
  const margin = variegated
    ? [" The white edge stays yellow-brown too, although it was in the light: it has no chlorophyll.", " Auch der weiße Rand bleibt gelb-braun, obwohl er im Licht war: Ihm fehlt das Chlorophyll."]
    : ["", ""];
  return tx(covered[0] + margin[0], covered[1] + margin[1]);
}

export function PhotoStarchTest() {
  const t = useText();
  const reduce = useReducedMotion();
  const [stencil, setStencil] = useState<Stencil>("strip");
  const [variegated, setVariegated] = useState(false);
  const [step, setStep] = useState(0);
  const S = STEPS[step];
  const last = step === STEPS.length - 1;

  const choose = (fn: () => void) => {
    fn();
    setStep(0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t(tx("Foil", "Abdeckung"))}>
          {STENCILS.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={stencil === s.id}
              onClick={() => choose(() => setStencil(s.id))}
              className={cn("h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", stencil === s.id ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={variegated}
          onClick={() => choose(() => setVariegated((v) => !v))}
          className={cn("h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors", variegated ? "border-transparent bg-blob text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {t(tx("Leaf with white edge", "Blatt mit weißem Rand"))}
        </button>
      </div>

      <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
        <svg viewBox="0 0 380 250" className="mx-auto block h-auto w-full max-w-[520px]" role="img" aria-label={t(S.title)}>
          <LeafArt stencil={stencil} variegated={variegated} stage={S.stage} />
          {S.stage === "iodine" && !reduce && (
            <motion.circle key={`drop-${stencil}-${variegated}`} cx={196} r={6} fill={IODINE_BROWN} initial={{ cy: 0, opacity: 1 }} animate={{ cy: 120, opacity: 0 }} transition={{ duration: 0.7 }} />
          )}
        </svg>
        <Prop kind={S.prop} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex h-10 items-center gap-1 rounded-xl px-3 text-[13.5px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
          aria-label={t(tx("Previous step", "Vorheriger Schritt"))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn("h-2 rounded-full transition-all", i === step ? "w-6 bg-blob" : i < step ? "w-2 bg-blob/50" : "w-2 bg-line-2")}
              aria-label={t(STEPS[i].title)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStep((s) => (last ? 0 : s + 1))}
          className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]"
        >
          {last ? <RotateCcw className="size-4" /> : null}
          {last ? t(tx("Again", "Nochmal")) : step === 0 ? t(tx("Start", "Starten")) : t(tx("Next step", "Nächster Schritt"))}
          {!last && <ChevronRight className="size-4" />}
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${step}-${stencil}-${variegated}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", last ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}
        >
          <span className="font-semibold text-ink">{t(S.title)}: </span>
          {t(S.text)}
          {last && <span className="mt-1 block text-ink">{t(result(stencil, variegated))}</span>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** The equipment of the current step, drawn small beside the leaf. */
function Prop({ kind }: { kind: Step["prop"] }) {
  const t = useText();
  const label: Record<NonNullable<Step["prop"]>, Text> = {
    moon: tx("dark cupboard, 2 days", "dunkler Schrank, 2 Tage"),
    sun: tx("sunlight, a few hours", "Sonnenlicht, einige Stunden"),
    water: tx("boiling water", "kochendes Wasser"),
    alcohol: tx("hot alcohol in a water bath", "heißer Alkohol im Wasserbad"),
    iodine: tx("iodine solution", "Iodlösung"),
  };
  return (
    <div className="flex min-h-[120px] flex-col items-center justify-center gap-1.5">
      <AnimatePresence mode="wait" initial={false}>
        {kind && (
          <motion.div key={kind} initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-1.5">
            <svg viewBox="0 0 100 100" className="size-[92px]" aria-hidden>
              {kind === "moon" && (
                <g>
                  <rect x={8} y={8} width={84} height={84} rx={14} fill="var(--bio-nucleus)" stroke="var(--bio-outline)" strokeWidth={2} />
                  <path d="M58 26 A 26 26 0 1 0 74 66 A 20 20 0 1 1 58 26 Z" fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.5} />
                </g>
              )}
              {kind === "sun" && (
                <g>
                  {Array.from({ length: 10 }, (_, i) => {
                    const a = (i / 10) * Math.PI * 2;
                    return <line key={i} x1={50 + Math.cos(a) * 26} y1={50 + Math.sin(a) * 26} x2={50 + Math.cos(a) * 40} y2={50 + Math.sin(a) * 40} stroke="var(--bio-sun)" strokeWidth={5} strokeLinecap="round" />;
                  })}
                  <circle cx={50} cy={50} r={21} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={2} />
                </g>
              )}
              {(kind === "water" || kind === "alcohol") && (
                <g>
                  {kind === "alcohol" && <rect x={6} y={34} width={88} height={58} rx={6} fill="var(--bio-water)" opacity={0.35} stroke="var(--bio-outline)" strokeWidth={1.5} />}
                  <path d="M26 20 L 26 84 Q 26 90 32 90 L 68 90 Q 74 90 74 84 L 74 20" fill="none" stroke="var(--bio-outline)" strokeWidth={2.2} />
                  <path d="M28 46 L 72 46 L 72 84 Q 72 88 68 88 L 32 88 Q 28 88 28 84 Z" fill={kind === "water" ? "var(--bio-water)" : "var(--bio-chloro)"} opacity={kind === "water" ? 0.75 : 0.55} />
                  {[36, 50, 62].map((x, i) => (
                    <circle key={x} cx={x} cy={70 - i * 6} r={3} fill="none" stroke="var(--bio-outline)" strokeWidth={1.2} />
                  ))}
                </g>
              )}
              {kind === "iodine" && (
                <g>
                  <path d="M44 8 L 56 8 L 56 52 L 52 66 L 48 66 L 44 52 Z" fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={2} />
                  <path d="M45 34 L 55 34 L 55 52 L 51.5 64 L 48.5 64 L 45 52 Z" fill={IODINE_BROWN} />
                  <rect x={40} y={2} width={20} height={10} rx={4} fill="var(--bio-petal)" stroke="var(--bio-outline)" strokeWidth={1.5} />
                  <circle cx={50} cy={80} r={5} fill={IODINE_BROWN} stroke="var(--bio-outline)" strokeWidth={1} />
                </g>
              )}
            </svg>
            <span className="max-w-[150px] text-center text-[12.5px] leading-tight text-ink-3">{t(label[kind])}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
