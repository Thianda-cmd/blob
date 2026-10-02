"use client";

// Widgets for the "particles" topic about motion: zooming into a drop of water, diffusion
// (two gases mix by themselves, faster when warm) and squeezing a syringe of air or water.

import { AnimatePresence, motion } from "motion/react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { ParticleSim } from "./ParticlesSim";

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: Text }[]; onChange: (v: T) => void }) {
  const t = useText();
  const scope = useId();
  return (
    <div className="inline-flex rounded-lg border border-line p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn("relative rounded-md px-3 py-1.5 text-[13px] font-medium", value === o.id ? "text-ink" : "text-ink-3 hover:text-ink")}
        >
          {value === o.id && <motion.span layoutId={`${scope}-tab`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
          <span className="relative">{t(o.label)}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zoom into a drop of water

const ZOOM: { factor: Text; title: Text; text: Text }[] = [
  {
    factor: "1×",
    title: tx("A drop of water", "Ein Wassertropfen"),
    text: tx("Smooth and clear. Nothing suggests it's made of anything smaller.", "Glatt und klar. Nichts deutet darauf hin, dass er aus etwas Kleinerem besteht."),
  },
  {
    factor: tx("1,000×", "1.000×"),
    title: tx("Under a light microscope", "Unter dem Lichtmikroskop"),
    text: tx("Still smooth! Even the best light microscope is far too weak to show the particles.", "Immer noch glatt! Selbst das beste Lichtmikroskop ist viel zu schwach, um die Teilchen zu zeigen."),
  },
  {
    factor: tx("10,000,000×", "10.000.000×"),
    title: tx("In the particle model", "Im Teilchenmodell"),
    text: tx(
      "Now you'd see them: tiny particles, all the same, constantly moving. Between them there is nothing at all, just empty space. Even at this zoom a water particle would only be about 3 mm across.",
      "Jetzt würdest du sie sehen: winzige Teilchen, alle gleich, ständig in Bewegung. Zwischen ihnen ist gar nichts, nur leerer Raum. Selbst bei dieser Vergrößerung wäre ein Wasserteilchen nur etwa 3 mm groß.",
    ),
  },
];

/** Zoom into a drop of water until the particles show up. */
export function ParticlesZoom() {
  const t = useText();
  const [z, setZ] = useState(0);
  const lens = z > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setZ((v) => Math.max(0, v - 1))}
          disabled={z === 0}
          aria-label={t(tx("Zoom out", "Herauszoomen"))}
          className="grid size-10 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        >
          <Minus className="size-4" />
        </button>
        <div className="flex gap-1">
          {ZOOM.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setZ(i)}
              className={cn("h-10 rounded-lg px-3 font-math text-[16px] tabular-nums transition-colors", z === i ? "bg-blob text-white" : "text-ink-2 hover:bg-hover")}
            >
              {t(s.factor)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setZ((v) => Math.min(2, v + 1))}
          disabled={z === 2}
          aria-label={t(tx("Zoom in", "Hineinzoomen"))}
          className="grid size-10 place-items-center rounded-lg border border-line text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="grid items-center gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto aspect-square w-full max-w-[280px]">
          <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
            <motion.g initial={false} animate={{ scale: lens ? 0.62 : 1, x: lens ? -38 : 0, y: lens ? 36 : 0 }} style={{ originX: "100px", originY: "120px" }} transition={{ type: "spring", stiffness: 160, damping: 22 }}>
              <path
                d="M100 22 C100 22 46 92 46 128 C46 158 70 180 100 180 C130 180 154 158 154 128 C154 92 100 22 100 22 Z"
                fill="color-mix(in oklab, var(--subject-sky) 30%, var(--surface))"
                stroke="color-mix(in oklab, var(--subject-sky) 70%, var(--ink))"
                strokeWidth={2}
              />
              <ellipse cx={80} cy={124} rx={8} ry={16} fill="var(--raised)" opacity={0.7} transform="rotate(20 80 124)" />
            </motion.g>
            <AnimatePresence>
              {lens && (
                <motion.g key="lens" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <line x1={74} y1={136} x2={112} y2={96} stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="4 4" />
                  <circle cx={70} cy={140} r={6} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
          <AnimatePresence>
            {lens && (
              <motion.div
                key="view"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                style={{ originX: 0.1, originY: 0.9 }}
                className="absolute right-0 top-0 size-[64%] overflow-hidden rounded-full border-[3px] border-ink-2 bg-surface shadow-card"
              >
                {z === 1 ? (
                  <div className="h-full w-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--subject-sky)_22%,var(--surface)),color-mix(in_oklab,var(--subject-sky)_38%,var(--surface)))]" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <ParticleSim liquid={1} gas={0} heat={0.45} width={150} height={150} n={58} r={8} cols={8} gravity={false} frame={false} seed={5} label={t(tx("Water particles", "Wasserteilchen"))} className="scale-110" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={z} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6, transition: { duration: 0.1 } }} className="space-y-1.5">
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(ZOOM[z].factor)}</div>
            <div className="font-display text-[21px] font-semibold text-ink">{t(ZOOM[z].title)}</div>
            <p className="text-[14.5px] leading-relaxed text-ink-2">{t(ZOOM[z].text)}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Diffusion and compressing

const COLS = 8;
const N = 32;
const MIX_FILLS = Array.from({ length: N }, (_, i) => (i % COLS < COLS / 2 ? "var(--blob)" : "color-mix(in oklab, var(--ink-3) 75%, var(--surface))"));

function Diffusion() {
  const t = useText();
  const [run, setRun] = useState(0);
  const [open, setOpen] = useState(false);
  const [warm, setWarm] = useState(false);
  const [mix, setMix] = useState(0);
  const shown = Math.min(100, Math.round((mix / 0.5) * 100));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={open}
          className="h-9 rounded-lg bg-blob px-3.5 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {t(tx("Remove the wall", "Trennwand entfernen"))}
        </button>
        <Tabs
          value={warm ? "warm" : "cold"}
          options={[
            { id: "cold", label: tx("cold", "kalt") },
            { id: "warm", label: tx("warm", "warm") },
          ]}
          onChange={(v) => setWarm(v === "warm")}
        />
        <button
          type="button"
          onClick={() => {
            setRun((r) => r + 1);
            setOpen(false);
            setMix(0);
          }}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink"
        >
          <RotateCcw className="size-3.5" /> {t(tx("Again", "Neu"))}
        </button>
      </div>
      <ParticleSim
        key={run}
        liquid={1}
        gas={1}
        heat={warm ? 0.9 : 0.05}
        barrier={!open}
        fills={MIX_FILLS}
        seed={11}
        onMix={setMix}
        label={t(tx("Two gases separated by a wall", "Zwei Gase, getrennt durch eine Wand"))}
      />
      <div className="flex items-center gap-3">
        <span className="w-[110px] shrink-0 text-[12.5px] text-ink-3">{t(tx("Mixed", "Durchmischt"))}</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <motion.div className="h-full rounded-full bg-blob" initial={false} animate={{ width: `${open ? shown : 0}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
        </div>
        <span className="w-10 text-right text-[13px] tabular-nums text-ink-2">{open ? shown : 0} %</span>
      </div>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {open
          ? warm
            ? t(tx("Warm particles are faster, so the gases mix much more quickly. That's **diffusion**.", "Warme Teilchen sind schneller, deshalb mischen sich die Gase viel schneller. Das ist **Diffusion**."))
            : t(tx("Nobody stirs, yet the gases mix: their particles move on their own. That's **diffusion**. Now try it warm!", "Niemand rührt, trotzdem mischen sich die Gase: Ihre Teilchen bewegen sich von selbst. Das ist **Diffusion**. Probier es jetzt warm!"))
          : t(tx("Purple: a scent. Grey: air. Remove the wall and watch.", "Lila: ein Duftstoff. Grau: Luft. Entferne die Wand und schau zu."))}
      </p>
    </div>
  );
}

const BW = 300;
const BH = 70;

function Syringe({ kind, push }: { kind: "air" | "water"; push: number }) {
  const t = useText();
  const travel = kind === "air" ? BW * 0.62 : 5;
  const right = BW - push * travel;
  return (
    <ParticleSim
      liquid={1}
      gas={kind === "air" ? 1 : 0}
      heat={0.45}
      width={BW + 40}
      height={BH}
      n={kind === "air" ? 12 : 66}
      r={8}
      cols={kind === "air" ? 6 : 17}
      right={right}
      seed={kind === "air" ? 3 : 4}
      label={kind === "air" ? t(tx("Syringe with air", "Spritze mit Luft")) : t(tx("Syringe with water", "Spritze mit Wasser"))}
    >
      <rect x={right} y={3} width={8} height={BH - 6} rx={2} fill="var(--ink-2)" />
      <rect x={right + 8} y={BH / 2 - 4} width={BW + 40 - right} height={8} rx={2} fill="var(--ink-3)" />
    </ParticleSim>
  );
}

function Compress() {
  const t = useText();
  const [push, setPush] = useState(0);
  const airVol = Math.round(100 - push * 62);
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-ink">{t(tx("Air", "Luft"))}</span>
          <span className="tabular-nums text-ink-3">
            {t(tx("volume", "Volumen"))} {airVol} %
          </span>
        </div>
        <Syringe kind="air" push={push} />
      </div>
      <div className="space-y-1">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-semibold text-ink">{t(tx("Water", "Wasser"))}</span>
          <span className="tabular-nums text-ink-3">
            {t(tx("volume", "Volumen"))} {push > 0.02 ? "≈ 99" : "100"} %
          </span>
        </div>
        <Syringe kind="water" push={push} />
      </div>
      <label className="flex items-center gap-3">
        <span className="w-[110px] shrink-0 text-[12.5px] text-ink-3">{t(tx("Push the piston", "Kolben drücken"))}</span>
        <input type="range" min={0} max={1} step={0.01} value={push} onChange={(e) => setPush(Number(e.target.value))} className="h-9 flex-1 cursor-pointer accent-[var(--blob)]" />
      </label>
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        {push > 0.3
          ? t(
              tx(
                "Air gets squeezed: its particles are far apart, so they can move closer together. In water the particles already touch, so the piston hardly moves.",
                "Die Luft lässt sich zusammendrücken: Ihre Teilchen sind weit voneinander entfernt und können näher zusammenrücken. Im Wasser berühren sich die Teilchen schon, deshalb bewegt sich der Kolben kaum.",
              ),
            )
          : t(tx("Push both pistons at the same time. Which one gives way?", "Drück beide Kolben gleichzeitig. Welcher gibt nach?"))}
      </p>
    </div>
  );
}

/** Diffusion and compressing gases, side by side in tabs. */
export function ParticlesMotion() {
  const [tab, setTab] = useState<"mix" | "squeeze">("mix");
  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        options={[
          { id: "mix", label: tx("Diffusion", "Diffusion") },
          { id: "squeeze", label: tx("Compressing", "Zusammendrücken") },
        ]}
        onChange={setTab}
      />
      {tab === "mix" ? <Diffusion /> : <Compress />}
    </div>
  );
}

/** Two syringes for a task picture: air (gas) and water (liquid). */
export function ParticlesSyringes() {
  return (
    <div className="space-y-2 p-1">
      <Syringe kind="air" push={0} />
      <Syringe kind="water" push={0} />
    </div>
  );
}
