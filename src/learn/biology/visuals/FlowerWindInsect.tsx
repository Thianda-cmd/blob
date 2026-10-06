"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Bug, Wind } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";
import { Anther, Bee, CHERRY, mirror } from "./FlowerKit";
import { cos, sin } from "@/lib/stableMath";

// Insect flower or wind flower? One flower morphs between the two: big coloured petals with
// scent and nectar and a few sticky pollen grains, or tiny green husks, dangling anthers,
// clouds of light pollen and big feathery stigmas. A close-up shows the pollen grain.

type Kind = "insect" | "wind";

const BASE = { x: 180, y: 232 };
/** Stamens: base, control and tip for each kind. */
const STAMENS: { b: [number, number]; insect: [number, number, number, number]; wind: [number, number, number, number] }[] = [
  { b: [174, 228], insect: [160, 196, 150, 158], wind: [112, 128, 104, 222] },
  { b: [177, 228], insect: [170, 190, 166, 148], wind: [138, 118, 132, 246] },
  { b: [183, 228], insect: [190, 190, 194, 148], wind: [222, 118, 228, 246] },
  { b: [186, 228], insect: [200, 196, 210, 158], wind: [248, 128, 256, 222] },
];
const filament = (s: (typeof STAMENS)[number], k: Kind) => `M ${s.b[0]} ${s.b[1]} Q ${s[k][0]} ${s[k][1]} ${s[k][2]} ${s[k][3]}`;

/** A cloud of light pollen drifting away with the wind (fixed positions). */
const CLOUD = (() => {
  const rng = createRng(77);
  return Array.from({ length: 42 }, () => ({ x: rng.int(250, 500), y: rng.int(110, 300), r: 1.4 + rng.next() * 1.2, d: rng.next() }));
})();

const ROWS: { label: Text; insect: Text; wind: Text }[] = [
  { label: tx("Petals", "Kronblätter"), insect: tx("large, colourful", "groß und bunt"), wind: tx("tiny or missing, green", "winzig oder fehlend, grün") },
  { label: tx("Scent, nectar", "Duft, Nektar"), insect: tx("yes: lure and reward", "ja: Lockmittel und Belohnung"), wind: tx("none", "keine") },
  { label: tx("Pollen", "Pollen"), insect: tx("little, large, sticky grains", "wenig, große, klebrige Körner"), wind: tx("huge amounts, small, light and dry", "riesige Mengen, klein, leicht und trocken") },
  { label: tx("Stamens", "Staubblätter"), insect: tx("inside the flower", "innerhalb der Blüte"), wind: tx("long, dangling out in the wind", "lang, hängen in den Wind") },
  { label: tx("Stigma", "Narbe"), insect: tx("small and sticky", "klein und klebrig"), wind: tx("large and feathery: a pollen net", "groß und federig: ein Pollennetz") },
  { label: tx("Examples", "Beispiele"), insect: tx("cherry, rapeseed, apple, sage", "Kirsche, Raps, Apfel, Salbei"), wind: tx("hazel, birch, grasses, maize", "Hasel, Birke, Gräser, Mais") },
];

function Feather({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <line x1={0} y1={0} x2={0} y2={-56} stroke="var(--bio-petal-deep)" strokeWidth={2} strokeLinecap="round" />
      {Array.from({ length: 11 }, (_, i) => {
        const yy = -8 - i * 4.6;
        const len = 9 - Math.abs(i - 5) * 0.6;
        return (
          <g key={i}>
            <line x1={0} y1={yy} x2={-len} y2={yy - 4} stroke="var(--bio-petal-deep)" strokeWidth={1.1} strokeLinecap="round" />
            <line x1={0} y1={yy} x2={len} y2={yy - 4} stroke="var(--bio-petal-deep)" strokeWidth={1.1} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}

export function FlowerWindInsect({ start = "insect" }: { start?: Kind }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<Kind>(start);
  const [gust, setGust] = useState(0);
  const wind = kind === "wind";
  const tr = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 80, damping: 15 } as const);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist">
          {(["insect", "wind"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13.5px] font-medium transition-colors", kind === k ? "bg-blob text-white shadow-card" : "text-ink-2 hover:bg-hover hover:text-ink")}
            >
              {k === "insect" ? <Bug className="size-4" /> : <Wind className="size-4" />}
              {k === "insect" ? t(tx("Insect flower", "Insektenblüte")) : t(tx("Wind flower", "Windblüte"))}
            </button>
          ))}
        </div>
        {wind && (
          <button type="button" onClick={() => setGust((g) => g + 1)} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
            <Wind className="size-3.5" /> {t(tx("Blow!", "Pusten!"))}
          </button>
        )}
      </div>

      <svg viewBox="40 60 480 290" className="mx-auto block h-auto w-full" style={{ maxWidth: 600 }} role="img" aria-label={wind ? t(tx("A wind-pollinated flower", "Eine Windblüte")) : t(tx("An insect-pollinated flower", "Eine Insektenblüte"))}>
        {/* wind lines */}
        <AnimatePresence>
          {wind &&
            [130, 190, 270].map((y, i) => (
              <motion.path
                key={`w${y}`}
                d={`M 60 ${y} C 120 ${y - 14}, 180 ${y + 14}, 250 ${y} S 380 ${y - 12}, 470 ${y}`}
                fill="none"
                stroke="var(--ink-3)"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeDasharray="10 14"
                initial={{ opacity: 0 }}
                animate={reduce ? { opacity: 0.35 } : { opacity: 0.35, strokeDashoffset: [0, -48] }}
                exit={{ opacity: 0 }}
                transition={reduce ? { duration: 0 } : { strokeDashoffset: { duration: 1.6 + i * 0.3, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.4 } }}
              />
            ))}
        </AnimatePresence>

        {/* stem and leaf */}
        <path d={`M ${BASE.x} 350 C ${BASE.x - 2} 300, ${BASE.x + 2} 270, ${BASE.x} ${BASE.y + 4}`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={7} strokeLinecap="round" />
        <path d={`M ${BASE.x} 350 C ${BASE.x - 2} 300, ${BASE.x + 2} 270, ${BASE.x} ${BASE.y + 4}`} fill="none" stroke="var(--bio-leaf)" strokeWidth={4} strokeLinecap="round" />
        <path d="M 181 318 C 200 300, 232 296, 254 300 C 232 312, 206 318, 181 318 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />

        {/* insect: big petals (the cherry petal, scaled) */}
        <motion.g initial={false} animate={{ opacity: wind ? 0 : 1, scale: wind ? 0.2 : 1 }} transition={tr} style={{ originX: "180px", originY: "232px", transformBox: "view-box" }}>
          {[false, true].map((m) => (
            <g key={String(m)} transform={m ? mirror(360) : undefined}>
              <g transform="translate(173 230) scale(0.78) translate(-188 -184)">
                <path d={CHERRY.petal} transform="rotate(34 188 184)" fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={1.6} opacity={0.5} />
                <path d={CHERRY.petal} fill="var(--bio-petal)" stroke="var(--bio-petal-deep)" strokeWidth={2} />
                {CHERRY.petalVeins.map((d) => (
                  <path key={d} d={d} fill="none" stroke="var(--bio-petal-deep)" strokeWidth={1.2} opacity={0.45} />
                ))}
              </g>
            </g>
          ))}
        </motion.g>
        {/* wind: tiny green husks */}
        <motion.g initial={false} animate={{ opacity: wind ? 1 : 0, scale: wind ? 1 : 0.4 }} transition={tr} style={{ originX: "180px", originY: "232px", transformBox: "view-box" }}>
          {[false, true].map((m) => (
            <path key={String(m)} transform={m ? mirror(360) : undefined} d="M 178 234 C 160 228, 148 204, 154 178 C 164 194, 172 212, 180 228 Z" fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
          ))}
        </motion.g>

        {/* ovary and style */}
        <ellipse cx={180} cy={222} rx={10} ry={12} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.5} />
        <motion.path initial={false} animate={{ d: wind ? "M 177.5 212 L 178 190 L 182 190 L 182.5 212 Z" : "M 177.5 212 L 178 160 L 182 160 L 182.5 212 Z" }} transition={tr} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1.3} />
        {/* insect: small sticky stigma */}
        <motion.ellipse initial={false} animate={{ opacity: wind ? 0 : 1, cy: wind ? 188 : 157 }} transition={tr} cx={180} rx={8} ry={5} fill="var(--bio-chloro)" stroke="var(--bio-leaf-deep)" strokeWidth={1.4} />
        {/* wind: big feathery stigmas */}
        <motion.g initial={false} animate={{ opacity: wind ? 1 : 0, scale: wind ? 1 : 0.3 }} transition={tr} style={{ originX: "180px", originY: "190px", transformBox: "view-box" }}>
          <Feather x={179} y={190} angle={-28} />
          <Feather x={181} y={190} angle={28} />
        </motion.g>

        {/* nectar and scent (insect) */}
        <motion.g initial={false} animate={{ opacity: wind ? 0 : 1 }} transition={{ duration: 0.3 }}>
          <circle cx={168} cy={228} r={3} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
          <circle cx={192} cy={228} r={3} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
          {[150, 180, 210].map((x, i) => (
            <motion.path
              key={x}
              d={`M ${x} 128 c -6 -8, 6 -14, 0 -22 c -6 -8, 6 -14, 0 -22`}
              fill="none"
              stroke="var(--bio-petal-deep)"
              strokeWidth={1.6}
              strokeLinecap="round"
              animate={reduce || wind ? { opacity: 0.5 } : { opacity: [0.15, 0.6, 0.15], y: [4, -4, 4] }}
              transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
        </motion.g>

        {/* stamens */}
        {STAMENS.map((s, i) => (
          <g key={i}>
            <motion.path initial={false} animate={{ d: filament(s, kind) }} transition={tr} fill="none" stroke="var(--bio-outline)" strokeWidth={3.4} strokeLinecap="round" />
            <motion.path initial={false} animate={{ d: filament(s, kind) }} transition={tr} fill="none" stroke="var(--bio-cell)" strokeWidth={1.4} strokeLinecap="round" />
            <motion.g initial={false} animate={{ x: s[kind][2], y: s[kind][3] + (wind ? 15 : 0), rotate: wind ? 180 : 0, scale: wind ? 1.35 : 1 }} transition={tr}>
              <Anther x={0} y={0} />
            </motion.g>
          </g>
        ))}

        {/* insect: a few large sticky pollen grains on the anthers */}
        <motion.g initial={false} animate={{ opacity: wind ? 0 : 1 }}>
          {[
            [144, 146],
            [172, 134],
            [200, 136],
            [216, 148],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r={3.4} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={0.9} />
          ))}
        </motion.g>

        {/* wind: a cloud of pollen drifting away */}
        <AnimatePresence>
          {wind && (
            <motion.g key={`cloud${gust}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {CLOUD.map((p, i) => (
                <motion.circle
                  key={i}
                  r={p.r}
                  fill="var(--bio-pollen)"
                  initial={{ cx: 120 + (p.x - 250) * 0.25, cy: 230 + (p.y - 200) * 0.3, opacity: 0 }}
                  animate={{ cx: p.x, cy: p.y, opacity: [0, 0.95, 0.85] }}
                  transition={reduce ? { duration: 0 } : { duration: 1.6 + p.d * 1.4, delay: 0.3 + p.d * 0.6, ease: "easeOut" }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* insect: a bee coming for nectar */}
        <AnimatePresence>
          {!wind && (
            <motion.g key="bee" initial={{ opacity: 0, x: 60, y: -30 }} animate={{ opacity: 1, x: 0, y: 0 }} exit={{ opacity: 0, x: 80, y: -40 }} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 70, damping: 14 }}>
              <g transform="translate(300 128) scale(-1.5 1.5)">
                <Bee pollen={4} />
              </g>
            </motion.g>
          )}
        </AnimatePresence>

        {/* close-up of a pollen grain */}
        <g transform="translate(430 112)">
          <circle r={44} fill="var(--raised)" stroke="var(--line-2)" strokeWidth={1.5} />
          <AnimatePresence mode="wait" initial={false}>
            {wind ? (
              <motion.g key="smooth" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.25 }}>
                <circle r={14} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1.3} />
                <circle cx={5} cy={-5} r={2.6} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1} />
              </motion.g>
            ) : (
              <motion.g key="spiky" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.25 }}>
                {Array.from({ length: 18 }, (_, i) => {
                  const a = (i / 18) * Math.PI * 2;
                  return (
                    <path
                      key={i}
                      d={`M ${(cos(a - 0.12) * 24).toFixed(1)} ${(sin(a - 0.12) * 24).toFixed(1)} L ${(cos(a) * 33).toFixed(1)} ${(sin(a) * 33).toFixed(1)} L ${(cos(a + 0.12) * 24).toFixed(1)} ${(sin(a + 0.12) * 24).toFixed(1)} Z`}
                      fill="var(--bio-membrane)"
                    />
                  );
                })}
                <circle r={25} fill="var(--bio-pollen)" stroke="var(--bio-outline)" strokeWidth={1.4} />
                {[
                  [-8, -6],
                  [6, -10],
                  [10, 6],
                  [-6, 10],
                  [0, 0],
                ].map(([x, y]) => (
                  <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill="var(--bio-sun)" stroke="var(--bio-membrane)" strokeWidth={0.8} />
                ))}
              </motion.g>
            )}
          </AnimatePresence>
        </g>
        <text x={430} y={172} textAnchor="middle" fontSize={12} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
          {t(tx("pollen grain, magnified", "Pollenkorn, vergrößert"))}
        </text>
      </svg>

      <div className="overflow-hidden rounded-xl border border-line text-[13px]">
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-line bg-surface font-semibold text-ink">
          <div className="px-2.5 py-1.5" />
          <div className={cn("px-2.5 py-1.5 transition-colors", !wind && "bg-blob-soft")}>{t(tx("Insect flower", "Insektenblüte"))}</div>
          <div className={cn("px-2.5 py-1.5 transition-colors", wind && "bg-blob-soft")}>{t(tx("Wind flower", "Windblüte"))}</div>
        </div>
        {ROWS.map((r) => (
          <div key={en(r.label)} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-line last:border-b-0">
            <div className="px-2.5 py-1.5 font-medium text-ink">{t(r.label)}</div>
            <div className={cn("px-2.5 py-1.5 leading-snug transition-colors", !wind ? "bg-blob-soft/60 text-ink" : "text-ink-3")}>{t(r.insect)}</div>
            <div className={cn("px-2.5 py-1.5 leading-snug transition-colors", wind ? "bg-blob-soft/60 text-ink" : "text-ink-3")}>{t(r.wind)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const en = (x: Text) => (typeof x === "string" ? x : x.en);
