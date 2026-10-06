"use client";

// Microscope lab (topic "cell", level 1): choose a specimen, swing in an objective, turn the
// coarse and fine focus knobs and set the diaphragm until the cells are sharp.

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { SPECIMENS, SpecimenField, type Specimen } from "./CellSpecimen";
import { cos, sin } from "@/lib/stableMath";

const OBJECTIVES = [
  { mag: 4, ring: "var(--bio-blood)", zoom: 0.1, blurPer: 0.09 },
  { mag: 10, ring: "var(--bio-sun)", zoom: 0.25, blurPer: 0.22 },
  { mag: 40, ring: "var(--bio-water)", zoom: 1, blurPer: 0.75 },
] as const;

const FOCUS = 62; // stage height at which the specimen is sharp (the same for every objective)
const CRASH = 74; // with 40× the objective touches the cover slip above this height

/** A focus knob: drag up or down (mouse or finger), or use the arrow keys. */
export function CellKnob({ label, value, onChange, perPixel, keyStep, size, min, max }: { label: string; value: number; onChange: (v: number) => void; perPixel: number; keyStep: number; size: number; min: number; max: number }) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const ridges = 18;
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value * 10) / 10}
      className="cursor-ns-resize touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blob"
      style={{ width: size, height: size }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, v: value };
      }}
      onPointerMove={(e) => {
        if (drag.current) onChange(clamp(drag.current.v + (drag.current.y - e.clientY) * perPixel));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(clamp(value + keyStep));
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(clamp(value - keyStep));
        else return;
        e.preventDefault();
      }}
    >
      <svg viewBox="-50 -50 100 100" className="h-full w-full" aria-hidden>
        <g style={{ transform: `rotate(${(value / perPixel) * 1.4}deg)` }}>
          <circle r={46} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={3} />
          {Array.from({ length: ridges }, (_, i) => {
            const a = (i / ridges) * 2 * Math.PI;
            return <line key={i} x1={38 * cos(a)} y1={38 * sin(a)} x2={46 * cos(a)} y2={46 * sin(a)} stroke="var(--bio-outline)" strokeWidth={2.2} />;
          })}
          <circle r={17} fill="var(--ink-3)" stroke="var(--bio-outline)" strokeWidth={2.5} />
          <circle cx={0} cy={-29} r={4} fill="var(--blob)" />
        </g>
      </svg>
    </div>
  );
}

export function CellMicroscopeLab() {
  const t = useText();
  const [spec, setSpec] = useState<Specimen>("onion");
  const [obj, setObj] = useState(0);
  const [h, setH] = useState(20);
  const [coarseTurn, setCoarseTurn] = useState(0);
  const [fineTurn, setFineTurn] = useState(0);
  const [diaphragm, setDiaphragm] = useState(85);
  const [warned, setWarned] = useState(false);

  const O = OBJECTIVES[obj];
  const off = Math.abs(h - FOCUS);
  const blur = Math.min(9, off * O.blurPer);
  const sharp = blur < 0.45;
  // An open diaphragm gives a bright but washed-out image, a closed one a dark one.
  const open = diaphragm / 100;
  const brightness = 0.45 + 0.75 * open;
  const contrast = 1.45 - 0.75 * open;

  const move = (to: number, viaCoarse: boolean) => {
    let next = to;
    if (obj === 2 && next > CRASH) {
      next = CRASH;
      setWarned(true);
    } else if (viaCoarse && obj === 2 && Math.abs(next - h) > 0.01) setWarned(true);
    setH(Math.min(100, Math.max(0, next)));
  };

  let tip: { text: Text; tone: "ok" | "info" | "warn" };
  if (warned && obj === 2)
    tip = {
      tone: "warn",
      text: tx(
        "Careful! With the 40× objective the lens is almost touching the cover slip. Only use the fine focus knob now.",
        "Vorsicht! Beim 40er-Objektiv berührt die Linse fast das Deckgläschen. Nimm jetzt nur noch den Feintrieb.",
      ),
    };
  else if (diaphragm < 22) tip = { tone: "info", text: tx("Too dark: open the diaphragm a little.", "Zu dunkel: Öffne die Blende etwas.") };
  else if (off > 6) tip = { tone: "info", text: obj === 2 ? tx("Very blurry. Go back to a smaller objective and focus there first.", "Sehr unscharf. Geh zurück zu einem kleineren Objektiv und stell dort erst scharf.") : tx("Blurry: turn the coarse focus knob until you can make something out.", "Unscharf: Dreh am Grobtrieb, bis du etwas erkennst.") };
  else if (!sharp) tip = { tone: "info", text: tx("Nearly! Now the fine focus knob.", "Fast! Jetzt mit dem Feintrieb.") };
  else if (diaphragm > 80 && spec === "onion") tip = { tone: "info", text: tx("Sharp, but pale. Close the diaphragm a bit for more contrast.", "Scharf, aber blass. Schließ die Blende etwas für mehr Kontrast.") };
  else if (obj < 2) tip = { tone: "ok", text: tx("Sharp! Now swing in the next bigger objective. It stays almost sharp.", "Scharf! Jetzt kannst du das nächstgrößere Objektiv einschwenken. Es bleibt fast scharf.") };
  else tip = { tone: "ok", text: SPECIMENS[spec].what };

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-start">
      <div className="space-y-3">
        <SpecimenField kind={spec} zoom={O.zoom} blur={blur} brightness={brightness} contrast={contrast} />
        <div className="flex items-center justify-center gap-2 text-[12.5px] text-ink-3">
          <span>{t(tx("eyepiece 10×", "Okular 10×"))}</span>
          <span aria-hidden>·</span>
          <span>{t(tx(`objective ${O.mag}×`, `Objektiv ${O.mag}×`))}</span>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Specimen", "Präparat"))}</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(SPECIMENS) as Specimen[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setSpec(k);
                  setObj(0);
                  setH(20);
                  setWarned(false);
                }}
                className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", spec === k ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
              >
                {t(SPECIMENS[k].name)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Revolving nosepiece: objective", "Objektivrevolver: Objektiv"))}</div>
          <div className="flex gap-1.5">
            {OBJECTIVES.map((o, i) => (
              <button
                key={o.mag}
                type="button"
                aria-pressed={obj === i}
                onClick={() => {
                  setObj(i);
                  setWarned(false);
                }}
                className={cn("flex h-10 items-center gap-2 rounded-lg px-3.5 font-math text-[14px] font-semibold transition-colors", obj === i ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
              >
                <span className="h-3 w-1.5 rounded-sm" style={{ background: o.ring }} />
                {o.mag}×
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-5">
          <div className="flex flex-col items-center gap-1">
            <CellKnob
              label={t(tx("Coarse focus knob", "Grobtrieb"))}
              value={coarseTurn}
              onChange={(v) => {
                move(h + (v - coarseTurn), true);
                setCoarseTurn(v);
              }}
              perPixel={0.35}
              keyStep={3}
              size={76}
              min={-1000}
              max={1000}
            />
            <span className="text-[12.5px] font-medium text-ink-2">{t(tx("coarse focus", "Grobtrieb"))}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <CellKnob
              label={t(tx("Fine focus knob", "Feintrieb"))}
              value={fineTurn}
              onChange={(v) => {
                move(h + (v - fineTurn), false);
                setFineTurn(v);
              }}
              perPixel={0.03}
              keyStep={0.3}
              size={52}
              min={-1000}
              max={1000}
            />
            <span className="text-[12.5px] font-medium text-ink-2">{t(tx("fine focus", "Feintrieb"))}</span>
          </div>
          <label className="min-w-[150px] flex-1">
            <span className="mb-1 block text-[12.5px] font-medium text-ink-2">{t(tx("Diaphragm (light)", "Blende (Licht)"))}</span>
            <input type="range" min={0} max={100} value={diaphragm} onChange={(e) => setDiaphragm(Number(e.target.value))} className="w-full accent-[var(--blob)]" aria-label={t(tx("Diaphragm", "Blende"))} />
          </label>
        </div>
        <p className="text-[12.5px] text-ink-3">{t(tx("Drag a knob up or down, or click it and use the arrow keys.", "Zieh einen Knopf nach oben oder unten oder klick ihn an und nimm die Pfeiltasten."))}</p>

        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${tip.tone}-${t(tip.text)}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn("rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed", tip.tone === "warn" ? "border border-danger/40 bg-danger/10 text-ink" : tip.tone === "ok" ? "border border-blob/30 bg-blob-soft/60 text-ink" : "bg-surface text-ink-2")}
            aria-live="polite"
          >
            {t(tip.text)}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
