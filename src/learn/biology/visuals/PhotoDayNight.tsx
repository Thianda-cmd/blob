"use client";

// Level 2 widget: a plant over 24 hours. Photosynthesis follows the light, cellular respiration
// goes on day and night. The difference decides whether the plant gives off oxygen or takes it
// in; where both are equal (the compensation point) there is no net gas exchange.

import { animate, AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

const RISE = 5;
const SET = 21;
const RESP = 10;
const light = (h: number) => Math.max(0, Math.sin((Math.PI * (h - RISE)) / (SET - RISE)));
const photo = (h: number) => 50 * light(h) ** 0.9;
/** The hours when photosynthesis just equals respiration (morning and evening). */
const COMP = (() => {
  const x = Math.asin((RESP / 50) ** (1 / 0.9));
  return [RISE + ((SET - RISE) * x) / Math.PI, SET - ((SET - RISE) * x) / Math.PI];
})();

const W = 440;
const H = 220;
const M = { l: 36, r: 12, t: 12, b: 34 };
const X = (h: number) => M.l + (h / 24) * (W - M.l - M.r);
const Y = (v: number) => H - M.b - (v / 60) * (H - M.t - M.b);

const clock = (h: number) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

export function PhotoDayNight() {
  const t = useText();
  const reduce = useReducedMotion();
  const [h, setH] = useState(12);
  const [playing, setPlaying] = useState(false);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);

  const p = photo(h);
  const net = p - RESP;
  const state: "night" | "comp" | "day" | "dim" = p < 0.5 ? "night" : Math.abs(net) < 2.5 ? "comp" : net > 0 ? "day" : "dim";

  const stop = () => {
    ctrl.current?.stop();
    setPlaying(false);
  };
  const toggle = () => {
    if (playing) return stop();
    if (reduce) {
      setH((x) => (x + 3) % 24);
      return;
    }
    setPlaying(true);
    const from = h >= 23.9 ? 0 : h;
    ctrl.current = animate(from, 24, { duration: (24 - from) * 0.45, ease: "linear", onUpdate: setH, onComplete: () => setPlaying(false) });
  };

  const area = (above: boolean) => {
    const top: string[] = [];
    for (let x = 0; x <= 24.001; x += 0.1) {
      const v = photo(x);
      top.push(`${X(x).toFixed(1)},${Y(above ? Math.max(v, RESP) : Math.min(v, RESP)).toFixed(1)}`);
    }
    return `M ${X(0)},${Y(RESP)} L ${top.join(" L ")} L ${X(24)},${Y(RESP)} Z`;
  };
  const pPath = Array.from({ length: 241 }, (_, i) => `${i ? "L" : "M"}${X(i / 10).toFixed(1)} ${Y(photo(i / 10)).toFixed(1)}`).join(" ");

  const text: Record<typeof state, Text> = {
    night: tx(
      "Night: no light, no photosynthesis. But respiration goes on: the plant takes in oxygen and gives off carbon dioxide, like us.",
      "Nacht: kein Licht, keine Fotosynthese. Die Zellatmung läuft aber weiter: Die Pflanze nimmt Sauerstoff auf und gibt Kohlenstoffdioxid ab, wie wir.",
    ),
    dim: tx(
      "Dim light: there is some photosynthesis, but respiration uses more. Overall the plant still takes in oxygen.",
      "Schwaches Licht: Es gibt etwas Fotosynthese, aber die Zellatmung verbraucht mehr. Insgesamt nimmt die Pflanze noch Sauerstoff auf.",
    ),
    comp: tx(
      "Compensation point: photosynthesis makes exactly as much oxygen as respiration uses. From the outside the plant seems to exchange no gas at all.",
      "Kompensationspunkt: Die Fotosynthese erzeugt genau so viel Sauerstoff, wie die Zellatmung verbraucht. Von außen sieht man keinen Gasaustausch.",
    ),
    day: tx(
      "Photosynthesis is far stronger than respiration: the plant gives off oxygen and takes in carbon dioxide. Respiration still goes on!",
      "Die Fotosynthese ist viel stärker als die Zellatmung: Die Pflanze gibt Sauerstoff ab und nimmt Kohlenstoffdioxid auf. Die Zellatmung läuft trotzdem weiter!",
    ),
  };

  const outO2 = net > 2.5;
  const inO2 = net < -2.5;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-center">
        <div className="rounded-xl border border-line bg-surface p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Photosynthesis and respiration over a day", "Fotosynthese und Zellatmung im Tagesverlauf"))}>
            <rect x={X(0)} y={M.t} width={X(RISE) - X(0)} height={H - M.t - M.b} fill="var(--bio-nucleus)" opacity={0.35} />
            <rect x={X(SET)} y={M.t} width={X(24) - X(SET)} height={H - M.t - M.b} fill="var(--bio-nucleus)" opacity={0.35} />
            {[0, 6, 12, 18, 24].map((x) => (
              <g key={x}>
                <line x1={X(x)} x2={X(x)} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeWidth={0.8} />
                <text x={X(x)} y={H - M.b + 15} textAnchor="middle" fontSize={11} className="fill-ink-3 tabular-nums">
                  {x}
                </text>
              </g>
            ))}
            <text x={W - M.r} y={H - 4} textAnchor="end" fontSize={11} className="fill-ink-2">
              {t(tx("time of day in h", "Uhrzeit in h"))}
            </text>
            <path d={area(true)} fill="var(--bio-chloro)" opacity={0.3} />
            <path d={area(false)} fill="var(--bio-mito-deep)" opacity={0.3} />
            <path d={pPath} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.8} strokeLinecap="round" />
            <line x1={X(0)} x2={X(24)} y1={Y(RESP)} y2={Y(RESP)} stroke="var(--bio-mito-deep)" strokeWidth={2.6} />
            {COMP.map((c) => (
              <rect key={c} x={X(c) - 4.5} y={Y(RESP) - 4.5} width={9} height={9} transform={`rotate(45 ${X(c)} ${Y(RESP)})`} fill="var(--raised)" stroke="var(--ink)" strokeWidth={1.6} />
            ))}
            <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--ink-2)" strokeWidth={1.2} />
            <line x1={X(h)} x2={X(h)} y1={M.t} y2={H - M.b} stroke="var(--blob)" strokeWidth={1.6} />
            <circle cx={X(h)} cy={Y(p)} r={5.5} fill="var(--raised)" stroke="var(--bio-leaf-deep)" strokeWidth={2.6} />
            <circle cx={X(h)} cy={Y(RESP)} r={5.5} fill="var(--raised)" stroke="var(--bio-mito-deep)" strokeWidth={2.6} />
          </svg>
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-2 pb-1 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-5 rounded-full bg-[var(--bio-leaf-deep)]" /> {t(tx("photosynthesis (O₂ made)", "Fotosynthese (O₂ erzeugt)"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[3px] w-5 rounded-full bg-[var(--bio-mito-deep)]" /> {t(tx("respiration (O₂ used)", "Zellatmung (O₂ verbraucht)"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rotate-45 border-[1.5px] border-ink bg-raised" /> {t(tx("compensation point", "Kompensationspunkt"))}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <svg viewBox="0 0 200 150" className="mx-auto block h-auto w-full max-w-[260px]" role="img" aria-label={t(tx("Gas exchange of the plant", "Gasaustausch der Pflanze"))}>
            <motion.circle cx={30} cy={28} r={16} initial={false} animate={{ opacity: light(h) > 0.02 ? 1 : 0.15 }} fill="var(--bio-sun)" stroke="var(--bio-outline)" strokeWidth={1.4} />
            <path d="M100 132 C 98 110 102 90 100 64" fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={4} strokeLinecap="round" />
            <path d="M100 96 C 84 80 62 80 50 88 C 62 102 84 104 100 96 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
            <path d="M100 78 C 116 62 138 62 150 70 C 138 84 116 86 100 78 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
            <path d="M100 66 C 94 52 86 48 80 50 C 84 60 92 66 100 66 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
            <path d="M70 134 L 130 134 L 124 148 L 76 148 Z" fill="var(--bio-wood)" stroke="var(--bio-outline)" strokeWidth={1.5} />
            <AnimatePresence>
              {(outO2 || inO2) && (
                <motion.g key={outO2 ? "out" : "in"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Arrow from={outO2 ? 152 : 194} to={outO2 ? 194 : 156} y={108} label="O₂" color="var(--bio-blood)" />
                  <Arrow from={outO2 ? 4 : 46} to={outO2 ? 44 : 6} y={118} label="CO₂" color="var(--bio-outline)" />
                </motion.g>
              )}
            </AnimatePresence>
          </svg>
          <Bar label={t(tx("Photosynthesis", "Fotosynthese"))} value={p} color="var(--bio-leaf-deep)" />
          <Bar label={t(tx("Respiration", "Zellatmung"))} value={RESP} color="var(--bio-mito-deep)" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white transition-transform active:scale-[0.97]">
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          {playing ? t(tx("Pause", "Pause")) : t(tx("Play the day", "Tag abspielen"))}
        </button>
        <span className="w-14 font-math text-[18px] tabular-nums text-ink">{clock(h)}</span>
        <input
          type="range"
          min={0}
          max={24}
          step={0.1}
          value={h}
          onChange={(e) => {
            stop();
            setH(Number(e.target.value));
          }}
          aria-label={t(tx("Time of day", "Uhrzeit"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={state}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          className={cn("rounded-xl px-4 py-3 text-[14.5px] leading-relaxed", state === "comp" ? "bg-blob-soft/70 text-ink" : "bg-surface text-ink-2")}
        >
          {t(text[state])}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Arrow({ from, to, y, label, color }: { from: number; to: number; y: number; label: string; color: string }) {
  const d = Math.sign(to - from);
  return (
    <g>
      <line x1={from} y1={y} x2={to} y2={y} stroke={color} strokeWidth={3} strokeLinecap="round" />
      <path d={`M ${to - 8 * d} ${y - 6} L ${to} ${y} L ${to - 8 * d} ${y + 6}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <text x={(from + to) / 2} y={y - 9} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
        {label}
      </text>
    </g>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[12.5px] text-ink-2">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(value)}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-hover">
        <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.min(100, (value / 50) * 100)}%` }} transition={{ type: "spring", stiffness: 300, damping: 32 }} />
      </div>
    </div>
  );
}
