"use client";

// The enzyme scissors: pick a nutrient and a "pair of scissors" (an enzyme, or bile). Only the
// matching enzyme cuts: starch → maltose → glucose, protein → peptides → amino acids,
// fat → (emulsified by bile) → glycerol + fatty acids.

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { Check, RotateCcw, Scissors } from "lucide-react";
import { useState } from "react";
import { resolveText, tx, txMap, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";

type Sub = "starch" | "protein" | "fat";
type Tool = "amylase" | "maltase" | "pepsin" | "trypsin" | "peptidase" | "lipase" | "bile";

const SUBS: { id: Sub; name: Text; goal: Text }[] = [
  { id: "starch", name: tx("Starch", "Stärke"), goal: tx("glucose", "Glucose") },
  { id: "protein", name: tx("Protein", "Eiweiß"), goal: tx("amino acids", "Aminosäuren") },
  { id: "fat", name: tx("Fat", "Fett"), goal: tx("glycerol + fatty acids", "Glycerin + Fettsäuren") },
];

const TOOLS: { id: Tool; name: Text; from: Text }[] = [
  { id: "amylase", name: tx("Amylase", "Amylase"), from: tx("saliva, pancreas", "Speichel, Bauchspeichel") },
  { id: "maltase", name: tx("Maltase", "Maltase"), from: tx("small intestine wall", "Dünndarmwand") },
  { id: "pepsin", name: tx("Pepsin", "Pepsin"), from: tx("stomach", "Magen") },
  { id: "trypsin", name: tx("Trypsin", "Trypsin"), from: tx("pancreas", "Bauchspeichel") },
  { id: "peptidase", name: tx("Peptidases", "Peptidasen"), from: tx("small intestine wall", "Dünndarmwand") },
  { id: "lipase", name: tx("Lipase", "Lipase"), from: tx("pancreas", "Bauchspeichel") },
  { id: "bile", name: tx("Bile", "Galle"), from: tx("liver, gall bladder", "Leber, Gallenblase") },
];

const STAGE_NAMES: Record<Sub, Text[]> = {
  starch: [tx("a long starch chain (many glucose units)", "eine lange Stärkekette (viele Glucose-Einheiten)"), tx("maltose (double sugars)", "Maltose (Zweifachzucker)"), tx("single glucose molecules", "einzelne Glucose-Moleküle")],
  protein: [tx("a long protein chain (amino acids in a row)", "eine lange Eiweißkette (Aminosäuren in einer Reihe)"), tx("peptides (short chains)", "Peptide (kurze Ketten)"), tx("single amino acids", "einzelne Aminosäuren")],
  fat: [tx("one big fat droplet", "ein großer Fetttropfen"), tx("many tiny droplets (an emulsion)", "viele winzige Tröpfchen (eine Emulsion)"), tx("glycerol and fatty acids", "Glycerin und Fettsäuren")],
};

type Result = { next?: number; ok: boolean; say: Text };

const WRONG_SUB: Record<Exclude<Tool, "bile">, Text> = {
  amylase: tx("Amylase only cuts starch.", "Amylase schneidet nur Stärke."),
  maltase: tx("Maltase only cuts maltose.", "Maltase schneidet nur Maltose."),
  pepsin: tx("Pepsin only cuts proteins.", "Pepsin schneidet nur Eiweiße."),
  trypsin: tx("Trypsin only cuts proteins.", "Trypsin schneidet nur Eiweiße."),
  peptidase: tx("Peptidases only cut peptides.", "Peptidasen schneiden nur Peptide."),
  lipase: tx("Lipase only cuts fats.", "Lipase schneidet nur Fette."),
};

function apply(sub: Sub, stage: number, tool: Tool): Result {
  if (stage === 2) return { ok: false, say: tx("Nothing left to cut: these are already the smallest building blocks.", "Hier gibt es nichts mehr zu schneiden: Das sind schon die kleinsten Bausteine.") };
  if (tool === "bile") {
    if (sub !== "fat") return { ok: false, say: tx("Bile is **not an enzyme**: it cuts nothing. It only helps with fats.", "Galle ist **kein Enzym**: Sie schneidet nichts. Sie hilft nur bei Fetten.") };
    if (stage === 0) return { next: 1, ok: true, say: tx("Bile **emulsifies** the big drop into many tiny droplets. Nothing is cut yet, but the surface is now much bigger.", "Die Galle **emulgiert** den großen Tropfen zu vielen winzigen Tröpfchen. Gespalten ist noch nichts, aber die Oberfläche ist jetzt viel größer.") };
    return { ok: false, say: tx("Already emulsified. Now you need an enzyme that cuts.", "Schon emulgiert. Jetzt braucht es ein Enzym, das schneidet.") };
  }
  const lockKey = tx(" Every enzyme only fits its own substrate, like a key fits its lock.", " Jedes Enzym passt nur zu seinem Substrat, wie ein Schlüssel zum Schloss.");
  const wrong = (): Result => ({ ok: false, say: txMap((tt, l) => `${tt("**Doesn't fit!**", "**Passt nicht!**")} ${resolveText(WRONG_SUB[tool], l)}${resolveText(lockKey, l)}`) });
  if (sub === "starch") {
    if (tool === "amylase" && stage === 0) return { next: 1, ok: true, say: tx("Snip! **Amylase** cuts the long starch chain into pieces of two glucose units: **maltose**.", "Schnipp! **Amylase** zerschneidet die lange Stärkekette in Stücke aus zwei Glucose-Einheiten: **Maltose**.") };
    if (tool === "maltase" && stage === 1) return { next: 2, ok: true, say: tx("Snip! **Maltase** splits each maltose into two **glucose** molecules. Small enough to pass through the gut wall!", "Schnipp! **Maltase** spaltet jede Maltose in zwei **Glucose**-Moleküle. Klein genug für die Darmwand!") };
    if (tool === "maltase") return { ok: false, say: tx("Maltase only fits maltose, the double sugar. First amylase has to cut the long chain.", "Maltase passt nur zu Maltose, dem Zweifachzucker. Erst muss die Amylase die lange Kette zerschneiden.") };
    if (tool === "amylase") return { ok: false, say: tx("Amylase's work is done. Maltose is split by maltase from the small intestine wall.", "Die Amylase ist fertig. Maltose spaltet die Maltase aus der Dünndarmwand.") };
    return wrong();
  }
  if (sub === "protein") {
    if ((tool === "pepsin" || tool === "trypsin") && stage === 0)
      return {
        next: 1,
        ok: true,
        say:
          tool === "pepsin"
            ? tx("Snip! **Pepsin** (in the acidic stomach) cuts the long protein chain into shorter pieces: **peptides**.", "Schnipp! **Pepsin** (im sauren Magen) zerschneidet die lange Eiweißkette in kürzere Stücke: **Peptide**.")
            : tx("Snip! **Trypsin** (in the small intestine) cuts the long protein chain into shorter pieces: **peptides**.", "Schnipp! **Trypsin** (im Dünndarm) zerschneidet die lange Eiweißkette in kürzere Stücke: **Peptide**."),
      };
    if (tool === "peptidase" && stage === 1) return { next: 2, ok: true, say: tx("Snip! **Peptidases** split the peptides into single **amino acids**.", "Schnipp! **Peptidasen** spalten die Peptide in einzelne **Aminosäuren**.") };
    if (tool === "peptidase") return { ok: false, say: tx("Peptidases finish the job on short peptides. The long chain is first cut by pepsin and trypsin.", "Peptidasen erledigen den Rest an kurzen Peptiden. Die lange Kette zerschneiden zuerst Pepsin und Trypsin.") };
    if (tool === "pepsin" || tool === "trypsin") return { ok: false, say: tx("The peptides are already short. Peptidases from the gut wall do the rest.", "Die Peptide sind schon kurz. Den Rest erledigen die Peptidasen der Darmwand.") };
    return wrong();
  }
  if (tool === "lipase" && stage === 1) return { next: 2, ok: true, say: tx("Snip! **Lipase** splits the fat molecules into **glycerol** and **fatty acids**.", "Schnipp! **Lipase** spaltet die Fettmoleküle in **Glycerin** und **Fettsäuren**.") };
  if (tool === "lipase") return { ok: false, say: tx("Lipase only reaches the surface of the big drop, so this is very slow. Tip: emulsify it first!", "Lipase kommt nur an die Oberfläche des großen Tropfens heran, das geht sehr langsam. Tipp: Erst emulgieren!") };
  return wrong();
}

// ---------------------------------------------------------------------------
// The molecules

const W = 520;
const H = 170;
const SPRING = { type: "spring" as const, stiffness: 140, damping: 16 };

/** x positions for n units, grouped by `groups` (sizes), with gaps between groups. */
function layout(n: number, groups: number[], unit: number, gap: number) {
  const xs: number[] = [];
  let x = 0;
  let gi = 0;
  let inGroup = 0;
  for (let i = 0; i < n; i++) {
    xs.push(x);
    inGroup++;
    if (inGroup === groups[gi]) {
      gi++;
      inGroup = 0;
      x += unit + gap;
    } else x += unit;
  }
  const width = xs[n - 1];
  return xs.map((v) => v + (W - width) / 2);
}

const hex = (r: number) =>
  Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 3) * k + Math.PI / 6;
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

function Starch({ stage }: { stage: number }) {
  const n = 8;
  const groups = stage === 0 ? [8] : stage === 1 ? [2, 2, 2, 2] : [1, 1, 1, 1, 1, 1, 1, 1];
  const xs = layout(n, groups, 48, stage === 2 ? 14 : 30);
  const ys = Array.from({ length: n }, (_, i) => 84 + (stage === 0 ? Math.sin(i * 0.9) * 10 : stage === 2 ? [-14, 10, -6, 14, -10, 6, -14, 10][i] : (i % 2 ? 4 : -4)));
  const linked = (i: number) => (stage === 0 ? true : stage === 1 ? i % 2 === 0 : false);
  return (
    <g>
      {Array.from({ length: n - 1 }, (_, i) => (
        <motion.line key={`b${i}`} stroke="var(--bio-outline)" strokeWidth={2.2} initial={false} animate={{ x1: xs[i] + 15, y1: ys[i], x2: xs[i + 1] - 15, y2: ys[i + 1], opacity: linked(i) ? 1 : 0 }} transition={SPRING} />
      ))}
      {xs.map((x, i) => (
        <motion.g key={i} initial={false} animate={{ x, y: ys[i] }} transition={SPRING}>
          <polygon points={hex(16)} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.6} />
        </motion.g>
      ))}
    </g>
  );
}

const AA = ["var(--bio-a)", "var(--bio-t)", "var(--bio-g)", "var(--bio-c)", "var(--bio-u)", "var(--bio-petal)", "var(--bio-g)", "var(--bio-a)"];

function Protein({ stage }: { stage: number }) {
  const n = 8;
  const groups = stage === 0 ? [8] : stage === 1 ? [3, 2, 3] : [1, 1, 1, 1, 1, 1, 1, 1];
  const xs = layout(n, groups, 46, stage === 2 ? 16 : 34);
  const ys = Array.from({ length: n }, (_, i) => 84 + (stage === 2 ? [12, -10, 8, -14, 10, -6, 14, -10][i] : i % 2 ? 14 : -14));
  const linked = (i: number) => (stage === 0 ? true : stage === 1 ? i !== 2 && i !== 4 : false);
  return (
    <g>
      {Array.from({ length: n - 1 }, (_, i) => (
        <motion.line key={`b${i}`} stroke="var(--bio-outline)" strokeWidth={2.2} initial={false} animate={{ x1: xs[i], y1: ys[i], x2: xs[i + 1], y2: ys[i + 1], opacity: linked(i) ? 1 : 0 }} transition={SPRING} />
      ))}
      {xs.map((x, i) => (
        <motion.circle key={i} r={14} fill={AA[i]} stroke="var(--bio-outline)" strokeWidth={1.6} initial={false} animate={{ cx: x, cy: ys[i] }} transition={SPRING} />
      ))}
    </g>
  );
}

const DROPS: [number, number, number][] = [
  [150, 70, 20],
  [205, 112, 15],
  [250, 58, 17],
  [300, 104, 21],
  [350, 62, 14],
  [390, 108, 16],
  [190, 40, 11],
  [118, 112, 13],
  [420, 52, 12],
];

function Fat({ stage }: { stage: number }) {
  const reduce = useReducedMotion();
  const fill = "color-mix(in oklab, var(--bio-sun) 60%, var(--raised))";
  return (
    <AnimatePresence mode="wait" initial={false}>
      {stage === 0 && (
        <motion.g key="drop" exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 0.35 }} style={{ transformOrigin: "260px 85px" }}>
          <circle cx={260} cy={85} r={62} fill={fill} stroke="var(--bio-outline)" strokeWidth={1.8} />
          <ellipse cx={238} cy={60} rx={16} ry={9} fill="var(--raised)" opacity={0.6} />
        </motion.g>
      )}
      {stage === 1 && (
        <motion.g key="emulsion">
          {DROPS.map(([x, y, r], i) => (
            <motion.circle
              key={i}
              r={r}
              fill={fill}
              stroke="var(--bio-outline)"
              strokeWidth={1.4}
              initial={{ cx: 260, cy: 85, opacity: 0 }}
              animate={{ cx: x, cy: y, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduce ? { duration: 0 } : { ...SPRING, delay: i * 0.03 }}
            />
          ))}
        </motion.g>
      )}
      {stage === 2 && (
        <motion.g key="split" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {[
            [140, 70],
            [330, 92],
          ].map(([gx, gy], m) => (
            <g key={m}>
              <rect x={gx - 7} y={gy - 30} width={14} height={60} rx={6} fill="var(--bio-water)" stroke="var(--bio-outline)" strokeWidth={1.6} />
              {[0, 1, 2].map((k) => (
                <motion.path
                  key={k}
                  d="M0 0 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6 l8 -6 l8 6"
                  fill="none"
                  stroke="var(--bio-membrane)"
                  strokeWidth={3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ x: gx + 9, y: gy - 22 + k * 22 }}
                  animate={{ x: gx + 34 + k * 6, y: gy - 30 + k * 30 + (k - 1) * 6 }}
                  transition={reduce ? { duration: 0 } : { ...SPRING, delay: 0.15 + k * 0.08 }}
                />
              ))}
            </g>
          ))}
        </motion.g>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------

export function DigestionScissors() {
  const t = useText();
  const reduce = useReducedMotion();
  const [sub, setSub] = useState<Sub>("starch");
  const [stages, setStages] = useState<Record<Sub, number>>({ starch: 0, protein: 0, fat: 0 });
  const [last, setLast] = useState<{ n: number; res: Result; tool: Tool } | null>(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const stage = stages[sub];
  const current = SUBS.find((s) => s.id === sub)!;

  const use = (tool: Tool) => {
    const res = apply(sub, stage, tool);
    if (!res.ok && !reduce && scope.current) animate(scope.current, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.4 });
    if (res.next !== undefined) setStages((s) => ({ ...s, [sub]: res.next! }));
    setLast((l) => ({ n: (l?.n ?? 0) + 1, res, tool }));
  };
  const pick = (s: Sub) => {
    setSub(s);
    setLast(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => pick(s.id)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
              sub === s.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            {stages[s.id] === 2 && <Check className="size-3.5" strokeWidth={3} />}
            {t(s.name)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setStages({ starch: 0, protein: 0, fat: 0 });
            setLast(null);
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
        </button>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-line bg-surface">
        <div ref={scope}>
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(STAGE_NAMES[sub][stage])}>
            {sub === "starch" && <Starch stage={stage} />}
            {sub === "protein" && <Protein stage={stage} />}
            {sub === "fat" && <Fat stage={stage} />}
          </svg>
        </div>
        <AnimatePresence>
          {last?.res.ok && !reduce && (
            <motion.div
              key={last.n}
              className="pointer-events-none absolute top-1/2 -mt-5 text-blob"
              initial={{ left: "-8%", opacity: 0, rotate: -20 }}
              animate={{ left: "104%", opacity: [0, 1, 1, 0], rotate: [-20, 10, -20, 10] }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            >
              <Scissors className="size-10" strokeWidth={2.2} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2 text-[13px]">
          <span className="text-ink-2">
            <span className="text-ink-3">{t(tx("Now:", "Jetzt:"))}</span> <span className="font-medium text-ink">{t(STAGE_NAMES[sub][stage])}</span>
          </span>
          <span className="flex shrink-0 gap-1" aria-hidden>
            {[0, 1, 2].map((k) => (
              <span key={k} className={cn("h-1.5 w-5 rounded-full transition-colors", k <= stage ? "bg-blob" : "bg-line-2")} />
            ))}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TOOLS.map((tool) => (
          <motion.button
            key={tool.id}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => use(tool.id)}
            className={cn(
              "flex min-h-[52px] items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors hover:border-blob/50 hover:bg-blob-soft/40",
              tool.id === "bile" ? "border-dashed border-line-2" : "border-line bg-raised",
            )}
          >
            <Scissors className={cn("size-4 shrink-0", tool.id === "bile" ? "text-ink-3" : "text-blob-ink")} />
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-tight text-ink">{t(tool.name)}</span>
              <span className="block text-[11.5px] leading-tight text-ink-3">{t(tool.from)}</span>
            </span>
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={last ? last.n : `hint-${sub}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className={cn("min-h-[3rem] rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", last ? (last.res.ok ? "bg-blob-soft/60 text-ink" : "bg-danger/[0.06] text-ink") : "bg-surface text-ink-2")}
        >
          {last ? (
            <Inline text={last.res.say} />
          ) : (
            <Inline
              text={txMap((tt) =>
                tt(
                  `Goal: cut ${resolveText(current.name, "en").toLowerCase()} into its building blocks, **${resolveText(current.goal, "en")}**. Which scissors fit?`,
                  `Ziel: ${resolveText(current.name, "de")} in die Bausteine zerlegen, **${resolveText(current.goal, "de")}**. Welche Schere passt?`,
                ),
              )}
            />
          )}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
