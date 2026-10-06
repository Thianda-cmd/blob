"use client";

// Magnification lab (topic "cell", level 2): pick an eyepiece and an objective, the total
// magnification is worked out, and an object appears on a millimetre ruler as big as it looks.

import { motion } from "motion/react";
import { useId, useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";

const EYEPIECES = [5, 10, 15];
const OBJECTIVES = [4, 10, 40, 100];

type Obj = { id: string; name: Text; um: number; aspect: number };
const THINGS: Obj[] = [
  { id: "paramecium", name: tx("slipper animalcule", "Pantoffeltierchen"), um: 200, aspect: 0.32 },
  { id: "onion", name: tx("onion skin cell", "Zwiebelhautzelle"), um: 250, aspect: 0.2 },
  { id: "cheek", name: tx("cheek cell", "Mundschleimhautzelle"), um: 60, aspect: 0.8 },
  { id: "rbc", name: tx("red blood cell", "rotes Blutkörperchen"), um: 7.5, aspect: 1 },
  { id: "bacterium", name: tx("bacterium (E. coli)", "Bakterium (E. coli)"), um: 2, aspect: 0.4 },
];

const W = 600;
const RULER_MM = 120;
const PX = 540 / RULER_MM; // svg units per millimetre of image size
const X0 = 30;

function Thing({ id, len, aspect }: { id: string; len: number; aspect: number }) {
  const h = len * aspect;
  const cx = X0 + len / 2;
  const cy = 62;
  if (len < 2.5) return <circle cx={X0 + 1.5} cy={cy} r={1.5} fill="var(--bio-outline)" />;
  switch (id) {
    case "paramecium":
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={len / 2} ry={h / 2} fill="var(--bio-cell)" stroke="var(--bio-membrane)" strokeWidth={2} />
          <ellipse cx={cx + len * 0.05} cy={cy} rx={len * 0.12} ry={h * 0.2} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.5} />
        </g>
      );
    case "onion":
      return (
        <g>
          <rect x={X0} y={cy - h / 2} width={len} height={h} rx={Math.min(6, h / 4)} fill="var(--bio-cell)" stroke="var(--bio-wall-deep)" strokeWidth={2} />
          <circle cx={X0 + len * 0.3} cy={cy} r={Math.max(1.5, h * 0.18)} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1.2} />
        </g>
      );
    case "cheek":
      return (
        <g>
          <path
            d={`M ${X0} ${cy} Q ${X0 + len * 0.05} ${cy - h * 0.55} ${X0 + len * 0.45} ${cy - h / 2} Q ${X0 + len * 1.02} ${cy - h * 0.42} ${X0 + len} ${cy + h * 0.05} Q ${X0 + len * 0.9} ${cy + h * 0.55} ${X0 + len * 0.4} ${cy + h / 2} Q ${X0 - len * 0.02} ${cy + h * 0.4} ${X0} ${cy} Z`}
            fill="var(--bio-vacuole)"
            stroke="var(--bio-water-deep)"
            strokeWidth={2}
          />
          <circle cx={cx} cy={cy} r={Math.max(1.5, len * 0.1)} fill="var(--bio-water-deep)" opacity={0.8} />
        </g>
      );
    case "rbc":
      return (
        <g>
          <circle cx={cx} cy={cy} r={len / 2} fill="var(--bio-blood)" stroke="var(--bio-blood)" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={len * 0.2} fill="var(--bio-flesh)" opacity={0.7} />
        </g>
      );
    default:
      return <rect x={X0} y={cy - h / 2} width={len} height={h} rx={h / 2} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />;
  }
}

export function CellMagnifier() {
  const t = useText();
  const locale = useLocale();
  const [eye, setEye] = useState(10);
  const [obj, setObj] = useState(40);
  const [thing, setThing] = useState("cheek");
  const clip = `cell-mag-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const T = THINGS.find((x) => x.id === thing)!;
  const M = eye * obj;
  const imageMm = (T.um * M) / 1000;
  const len = imageMm * PX;
  const tooBig = imageMm > RULER_MM;
  const n = (v: number, d = 2) => dec(v, locale, d);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Picker label={t(tx("Eyepiece", "Okular"))} values={EYEPIECES} value={eye} onChange={setEye} />
        <Picker label={t(tx("Objective", "Objektiv"))} values={OBJECTIVES} value={obj} onChange={setObj} />
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-3">
        <div className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Total magnification = eyepiece × objective", "Gesamtvergrößerung = Okular × Objektiv"))}</div>
        <div className="mt-1 font-math text-[26px] font-semibold text-ink">
          {eye} × {obj} ={" "}
          <motion.span key={M} initial={{ scale: 1.25, color: "var(--blob)" }} animate={{ scale: 1, color: "var(--ink)" }} className="inline-block">
            {M}
          </motion.span>
          <span className="text-ink-3">{t(tx("×", "-fach"))}</span>
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t(tx("Look at", "Objekt"))}</div>
        <div className="flex flex-wrap gap-1.5">
          {THINGS.map((x) => (
            <button
              key={x.id}
              type="button"
              aria-pressed={thing === x.id}
              onClick={() => setThing(x.id)}
              className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", thing === x.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {t(x.name)}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} 150`} className="block h-auto w-full" role="img" aria-label={t(tx("How big the object looks, on a millimetre ruler", "Wie groß das Objekt erscheint, auf einem Millimeterlineal"))}>
        <defs>
          <clipPath id={clip}>
            <rect x={0} y={8} width={X0 + 545} height={110} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <motion.g key={`${thing}-${M}`} initial={{ opacity: 0, scaleX: 0.6 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ type: "spring", stiffness: 160, damping: 22 }} style={{ transformOrigin: `${X0}px 62px` }}>
            <Thing id={thing} len={Math.min(len, 2000)} aspect={T.aspect} />
          </motion.g>
        </g>
        {tooBig && <path d={`M ${X0 + 548} 50 l 14 12 l -14 12`} fill="none" stroke="var(--blob)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />}
        <line x1={X0} y1={122} x2={X0 + 540} y2={122} stroke="var(--ink-2)" strokeWidth={1.5} />
        {Array.from({ length: RULER_MM + 1 }, (_, i) => (
          <line key={i} x1={X0 + i * PX} y1={122} x2={X0 + i * PX} y2={i % 10 === 0 ? 134 : i % 5 === 0 ? 130 : 127} stroke="var(--ink-2)" strokeWidth={i % 10 === 0 ? 1.4 : 0.8} />
        ))}
        {Array.from({ length: RULER_MM / 10 + 1 }, (_, i) => (
          <text key={i} x={X0 + i * 10 * PX} y={147} textAnchor="middle" fontSize={11} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
            {i * 10}
          </text>
        ))}
        <text x={X0 + 548} y={126} textAnchor="start" fontSize={11} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
          mm
        </text>
      </svg>

      <div className="space-y-1 rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
        <p>
          {t(tx("Actual size", "Tatsächliche Größe"))}: <b className="text-ink">{n(T.um, 1)} µm</b> = {n(T.um / 1000, 4)} mm
        </p>
        <p>
          {t(tx("Image size = actual size × magnification", "Bildgröße = tatsächliche Größe × Vergrößerung"))}: {n(T.um / 1000, 4)} mm × {M} = <b className="text-ink">{n(imageMm, 2)} mm</b>
        </p>
        <p className="text-[13px] text-ink-3">
          {M > 1000
            ? t(tx("Above about 1000× a light microscope shows no new details: the image only gets bigger and blurrier (empty magnification).", "Über etwa 1000-fach zeigt ein Lichtmikroskop keine neuen Details: Das Bild wird nur größer und unschärfer (leere Vergrößerung)."))
            : tooBig
              ? t(tx("Too big for the ruler: a smaller objective shows the whole object.", "Zu groß fürs Lineal: Mit einem kleineren Objektiv siehst du das ganze Objekt."))
              : imageMm < 3
                ? t(tx("Still tiny: you would need a stronger objective to see any details.", "Immer noch winzig: Für Details brauchst du ein stärkeres Objektiv."))
                : t(tx("Backwards works too: actual size = image size ÷ magnification.", "Umgekehrt geht es auch: tatsächliche Größe = Bildgröße : Vergrößerung."))}
        </p>
      </div>
    </div>
  );
}

function Picker({ label, values, value, onChange }: { label: string; values: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={cn("h-10 min-w-[54px] rounded-lg px-3 font-math text-[15px] font-semibold transition-colors", value === v ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {v}×
          </button>
        ))}
      </div>
    </div>
  );
}
