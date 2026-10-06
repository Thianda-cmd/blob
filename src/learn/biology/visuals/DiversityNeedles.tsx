"use client";

// Conifer twigs for the "plant-diversity" topic: spruce, fir, pine, larch and yew, each with its
// needles and its cone (or the yew's red aril). A widget to compare them, with a summer/winter
// switch that shows the larch dropping its needles, and task pictures.

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { cos, sin } from "@/lib/stableMath";

export type ConiferId = "spruce" | "fir" | "pine" | "larch" | "yew";
export type Season = "summer" | "autumn" | "winter";

const W = 240;
const H = 170;
const r1 = (v: number) => Math.round(v * 10) / 10;

// The twig: a quadratic curve from left to right.
const P0 = [14, 96];
const P1 = [120, 80];
const P2 = [214, 84];
function twigAt(t: number) {
  const x = (1 - t) * (1 - t) * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0];
  const y = (1 - t) * (1 - t) * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1];
  const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
  const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
  return { x, y, a: (Math.atan2(dy, dx) * 180) / Math.PI };
}
const TWIG = `M${P0[0]} ${P0[1]}Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`;

/** A flat needle from (0,0) pointing right, length len, width w, with a notched, pointed or round tip. */
function needlePath(len: number, w: number, tip: "notch" | "point" | "round") {
  const h = w / 2;
  if (tip === "point") return `M0 ${-h * 0.7}L${len - w * 1.6} ${-h}Q${len - w * 0.4} ${-h * 0.6} ${len} 0Q${len - w * 0.4} ${h * 0.6} ${len - w * 1.6} ${h}L0 ${h * 0.7}Z`;
  if (tip === "notch") return `M0 ${-h * 0.7}L${len - h} ${-h}Q${len} ${-h} ${len} ${-h * 0.25}L${len - h * 0.6} 0L${len} ${h * 0.25}Q${len} ${h} ${len - h} ${h}L0 ${h * 0.7}Z`;
  return `M0 ${-h * 0.7}L${len - h} ${-h}Q${len + h * 0.4} 0 ${len - h} ${h}L0 ${h * 0.7}Z`;
}

type N = { x: number; y: number; a: number; len: number; w: number };

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Spruce: short stiff needles all round the twig (a bottle brush), pointing forwards.
const SPRUCE: N[] = (() => {
  const rnd = seeded(11);
  const out: N[] = [];
  for (let t = 0.04; t < 0.97; t += 0.03) {
    const p = twigAt(t);
    for (const side of [-1, 1]) out.push({ x: p.x, y: p.y, a: p.a + side * (50 + rnd() * 30), len: 13 + rnd() * 4, w: 2 });
    // needles seen from above, foreshortened
    out.push({ x: p.x, y: p.y, a: p.a + (rnd() - 0.5) * 70, len: 7 + rnd() * 4, w: 2 });
  }
  return out;
})();

// Fir: flat needles in two rows like a comb (parted), blunt and notched.
const FIR: N[] = (() => {
  const rnd = seeded(5);
  const out: N[] = [];
  for (let t = 0.04; t < 0.97; t += 0.03) {
    const p = twigAt(t);
    for (const side of [-1, 1]) out.push({ x: p.x, y: p.y, a: p.a + side * (74 + rnd() * 10), len: 24 + rnd() * 5 - (t > 0.85 ? 8 : 0), w: 4.4 });
  }
  return out;
})();

// Yew: flat pointed needles in two rows, a little further forward.
const YEW: N[] = (() => {
  const rnd = seeded(7);
  const out: N[] = [];
  for (let t = 0.04; t < 0.97; t += 0.032) {
    const p = twigAt(t);
    for (const side of [-1, 1]) out.push({ x: p.x, y: p.y, a: p.a + side * (62 + rnd() * 12), len: 25 + rnd() * 4 - (t > 0.85 ? 8 : 0), w: 4 });
  }
  return out;
})();

// Pine: pairs of long needles from little sheaths.
const PINE: { x: number; y: number; a: number; len: number; bend: number }[] = (() => {
  const rnd = seeded(3);
  const out: { x: number; y: number; a: number; len: number; bend: number }[] = [];
  let side = 1;
  for (let t = 0.06; t < 0.96; t += 0.055) {
    const p = twigAt(t);
    side = -side;
    out.push({ x: p.x, y: p.y, a: p.a + side * (38 + rnd() * 18), len: 46 + rnd() * 10, bend: side * (6 + rnd() * 6) });
  }
  return out;
})();

// Larch: tufts of soft needles on short side shoots.
const LARCH: { x: number; y: number; a: number }[] = [0.12, 0.27, 0.42, 0.57, 0.72, 0.87].map((t, i) => {
  const p = twigAt(t);
  return { x: p.x, y: p.y, a: p.a + (i % 2 ? 90 : -90) };
});

function Cone({ id }: { id: ConiferId }) {
  switch (id) {
    case "spruce":
      // Long cone hanging down, falls off whole.
      return (
        <g transform="translate(150 96)">
          <path d="M0 0L0 8" stroke="var(--bio-wood-deep)" strokeWidth={2} />
          <rect x={-10} y={6} width={20} height={62} rx={9} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
          {[14, 22, 30, 38, 46, 54, 61].map((y, i) => (
            <path key={y} d={`M-9 ${y}Q${i % 2 ? -3 : 3} ${y + 5} 9 ${y}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1} />
          ))}
        </g>
      );
    case "fir":
      // Cone standing upright on the twig; it falls apart on the tree.
      return (
        <g transform="translate(120 74)">
          <rect x={-10} y={-56} width={20} height={56} rx={9} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
          {[-48, -40, -32, -24, -16, -8].map((y, i) => (
            <path key={y} d={`M-9 ${y}Q${i % 2 ? -3 : 3} ${y + 5} 9 ${y}`} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1} />
          ))}
        </g>
      );
    case "pine":
      // Small woody egg-shaped cone with diamond scales.
      return (
        <g transform="translate(132 84) rotate(118)">
          <path d="M0 0L-6 0" stroke="var(--bio-wood-deep)" strokeWidth={2} transform="scale(-1 1)" />
          <ellipse cx={24} cy={0} rx={18} ry={11} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.5} />
          <path d="M10 -5L38 5M10 5L38 -5M18 -9L32 9M18 9L32 -9" stroke="var(--bio-wood-deep)" strokeWidth={0.9} opacity={0.8} />
        </g>
      );
    case "larch":
      // Little upright cones with rounded scales; they stay on the twig for years.
      return (
        <g>
          {[0.27, 0.57].map((t) => twigAt(t)).map(({ x, y }) => (
            <g key={x} transform={`translate(${r1(x)} ${r1(y - 2)})`}>
              <ellipse cx={0} cy={-11} rx={8} ry={10} fill="var(--bio-wood)" stroke="var(--bio-wood-deep)" strokeWidth={1.4} />
              <path d="M-7 -8Q0 -4 7 -8M-6 -14Q0 -10 6 -14M-4 -19Q0 -16 4 -19" fill="none" stroke="var(--bio-wood-deep)" strokeWidth={1} />
            </g>
          ))}
        </g>
      );
    case "yew":
      // No cone: a red, fleshy cup (aril) around a single seed.
      return (
        <g transform="translate(134 84)">
          <path d="M0 0L0 8" stroke="var(--bio-leaf-deep)" strokeWidth={1.6} />
          <path d="M-9 12C-9 26 9 26 9 12C9 8 5 7 0 7C-5 7 -9 8 -9 12Z" fill="var(--bio-blood)" stroke="var(--bio-blood)" strokeWidth={1.2} />
          <ellipse cx={0} cy={12} rx={4.2} ry={3.2} fill="var(--bio-wood-deep)" />
        </g>
      );
  }
}

/** The twig drawing on its own. */
export function ConiferTwig({ id, season = "summer", className, title }: { id: ConiferId; season?: Season; className?: string; title?: string }) {
  const larchColour = season === "autumn" ? "var(--bio-sun)" : "var(--bio-leaf)";
  const larchDeep = season === "autumn" ? "var(--bio-wood-deep)" : "var(--bio-leaf-deep)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full", className)} role="img" aria-label={title}>
      {id === "spruce" && <Cone id={id} />}
      <path d={TWIG} fill="none" stroke="var(--bio-wood-deep)" strokeWidth={4.5} strokeLinecap="round" />
      {id === "spruce" &&
        SPRUCE.map((n, i) => (
          <path key={i} d={needlePath(n.len, n.w, "point")} transform={`translate(${r1(n.x)} ${r1(n.y)}) rotate(${r1(n.a)})`} fill="var(--bio-leaf-deep)" stroke="var(--bio-leaf-deep)" strokeWidth={0.6} />
        ))}
      {id === "fir" &&
        FIR.map((n, i) => (
          <g key={i} transform={`translate(${r1(n.x)} ${r1(n.y)}) rotate(${r1(n.a)})`}>
            <path d={needlePath(n.len, n.w, "notch")} fill="var(--bio-leaf-deep)" stroke="var(--bio-leaf-deep)" strokeWidth={0.6} />
            {/* the two white wax stripes on the underside */}
            <path d={`M3 -0.95L${n.len - 3} -0.95M3 0.95L${n.len - 3} 0.95`} stroke="var(--raised)" strokeWidth={0.9} opacity={0.9} />
          </g>
        ))}
      {id === "yew" &&
        YEW.map((n, i) => (
          <path key={i} d={needlePath(n.len, n.w, "point")} transform={`translate(${r1(n.x)} ${r1(n.y)}) rotate(${r1(n.a)})`} fill="var(--bio-leaf)" stroke="var(--bio-leaf-deep)" strokeWidth={1} />
        ))}
      {id === "pine" &&
        PINE.map((n, i) => (
          <g key={i} transform={`translate(${r1(n.x)} ${r1(n.y)}) rotate(${r1(n.a)})`}>
            <path d={`M4 -1Q${n.len * 0.5} ${-1 - n.bend * 0.3 - 3} ${n.len} -6`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.2} strokeLinecap="round" />
            <path d={`M4 1Q${n.len * 0.5} ${1 + n.bend * 0.3 + 3} ${n.len - 4} 6`} fill="none" stroke="var(--bio-leaf-deep)" strokeWidth={2.2} strokeLinecap="round" />
            <rect x={0} y={-2.4} width={6} height={4.8} rx={1.5} fill="var(--bio-wood-deep)" />
          </g>
        ))}
      {id === "larch" &&
        LARCH.map((n, i) => (
          <g key={i} transform={`translate(${r1(n.x)} ${r1(n.y)}) rotate(${r1(n.a)})`}>
            <rect x={-1} y={-3.5} width={9} height={7} rx={3} fill="var(--bio-wood-deep)" />
            {season !== "winter" &&
              Array.from({ length: 19 }, (_, k) => {
                const a = -76 + (152 * k) / 18;
                const len = 17 + ((k * 7) % 6);
                return (
                  <path
                    key={k}
                    d={`M7 0L${r1(7 + len * cos((a * Math.PI) / 180))} ${r1(len * sin((a * Math.PI) / 180))}`}
                    stroke={larchDeep}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    opacity={0.95}
                  />
                );
              })}
            {season !== "winter" &&
              Array.from({ length: 19 }, (_, k) => {
                const a = -76 + (152 * k) / 18;
                const len = 17 + ((k * 7) % 6);
                return <path key={`c${k}`} d={`M7 0L${r1(7 + len * cos((a * Math.PI) / 180))} ${r1(len * sin((a * Math.PI) / 180))}`} stroke={larchColour} strokeWidth={1.2} strokeLinecap="round" />;
              })}
          </g>
        ))}
      {id !== "spruce" && <Cone id={id} />}
    </svg>
  );
}

export const CONIFER_FACTS: Record<ConiferId, { name: Text; needles: Text; cone: Text; tip: Text }> = {
  spruce: {
    name: tx("Spruce (Norway spruce)", "Fichte (Rotfichte)"),
    needles: tx("single, short, stiff and pointed: they prick; all round the twig, on little pegs", "einzeln, kurz, steif und spitz: Sie stechen; rundum am Zweig, auf kleinen Stielchen"),
    cone: tx("cones hang down and fall off whole", "Zapfen hängen nach unten und fallen als Ganzes ab"),
    tip: tx("\"Spruce stings, fir is kind\": spruce needles prick.", "„Die Fichte sticht, die Tanne nicht.“"),
  },
  fir: {
    name: tx("Fir (silver fir)", "Tanne (Weißtanne)"),
    needles: tx("single, flat, soft, tip notched; two white wax stripes underneath; in two rows like a comb", "einzeln, flach, weich, vorne eingekerbt; unten zwei weiße Wachsstreifen; zweizeilig wie ein Kamm"),
    cone: tx("cones stand upright and fall apart on the tree", "Zapfen stehen aufrecht und zerfallen am Baum"),
    tip: tx("You will hardly ever find a whole fir cone on the ground.", "Ganze Tannenzapfen findest du am Boden fast nie."),
  },
  pine: {
    name: tx("Pine (Scots pine)", "Kiefer (Waldkiefer)"),
    needles: tx("long needles in pairs, coming out of a little sheath", "lange Nadeln, immer zu zweit aus einer kleinen Scheide"),
    cone: tx("small, woody, egg-shaped cones", "kleine, holzige, eiförmige Zapfen"),
    tip: tx("The bark high up the trunk is orange-red.", "Die Rinde oben am Stamm ist fuchsrot."),
  },
  larch: {
    name: tx("Larch (European larch)", "Lärche (Europäische Lärche)"),
    needles: tx("soft, light green, in tufts of 20 to 40 on short shoots", "weich, hellgrün, in Büscheln aus 20 bis 40 Nadeln an Kurztrieben"),
    cone: tx("small upright cones that stay on the twig for years", "kleine aufrechte Zapfen, die jahrelang am Zweig bleiben"),
    tip: tx("The only native conifer that turns golden and drops its needles in autumn.", "Der einzige heimische Nadelbaum, der sich im Herbst goldgelb färbt und die Nadeln abwirft."),
  },
  yew: {
    name: tx("Yew", "Eibe"),
    needles: tx("flat, soft, pointed, dark green; pale green underneath without white stripes", "flach, weich, zugespitzt, dunkelgrün; unten hellgrün ohne weiße Streifen"),
    cone: tx("no cones: each seed sits in a red, fleshy cup (aril)", "keine Zapfen: Jeder Samen sitzt in einem roten, fleischigen Samenmantel"),
    tip: tx("Almost every part is very poisonous, especially the seeds and needles.", "Fast alle Teile sind sehr giftig, vor allem Samen und Nadeln."),
  },
};

const ORDER: ConiferId[] = ["spruce", "fir", "pine", "larch", "yew"];

/** Lesson widget: compare the five conifers; switch to winter and watch the larch. */
export function DiversityConifers() {
  const t = useText();
  const scope = useId();
  const [id, setId] = useState<ConiferId>("spruce");
  const [season, setSeason] = useState<Season>("summer");
  const f = CONIFER_FACTS[id];
  const seasons: [Season, Text][] = [
    ["summer", tx("Summer", "Sommer")],
    ["autumn", tx("Autumn", "Herbst")],
    ["winter", tx("Winter", "Winter")],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setId(k)}
              className={cn("relative rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors", id === k ? "text-white" : "bg-hover text-ink-2 hover:text-ink")}
            >
              {id === k && <motion.span layoutId={`${scope}-c`} className="absolute inset-0 rounded-full bg-blob" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(CONIFER_FACTS[k].name).split(" (")[0]}</span>
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-line p-0.5">
          {seasons.map(([s, label]) => (
            <button key={s} type="button" onClick={() => setSeason(s)} className={cn("relative rounded-md px-2.5 py-1 text-[13px] font-medium", season === s ? "text-ink" : "text-ink-3 hover:text-ink")}>
              {season === s && <motion.span layoutId={`${scope}-s`} className="absolute inset-0 rounded-md bg-hover" transition={{ type: "spring", stiffness: 500, damping: 36 }} />}
              <span className="relative">{t(label)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${id}-${season}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="mx-auto w-full max-w-[380px]">
            <ConiferTwig id={id} season={season} title={t(f.name)} />
          </motion.div>
        </AnimatePresence>
        <div className="space-y-2.5">
          <div className="font-display text-[22px] font-semibold text-ink">{t(f.name)}</div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[14px] leading-snug">
            <dt className="font-semibold text-ink-3">{t(tx("Needles", "Nadeln"))}</dt>
            <dd className="text-ink">{t(f.needles)}</dd>
            <dt className="font-semibold text-ink-3">{t(tx("Cones", "Zapfen"))}</dt>
            <dd className="text-ink">{t(f.cone)}</dd>
          </dl>
          <p className="text-[13px] leading-snug text-ink-3">{t(f.tip)}</p>
          {season === "winter" && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-blob-soft px-3 py-2 text-[13px] leading-snug text-ink">
              {id === "larch"
                ? t(tx("In winter the larch is bare: only the knobby short shoots are left.", "Im Winter ist die Lärche kahl: Nur die knubbeligen Kurztriebe sind übrig."))
                : t(tx("This one stays green in winter. Each needle lives several years, then falls and is replaced.", "Dieser Baum bleibt im Winter grün. Jede Nadel lebt mehrere Jahre, dann fällt sie ab und wird ersetzt."))}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Task picture: one twig. */
export function DiversityTwigPicture({ id, season = "summer" }: { id: ConiferId; season?: Season }) {
  const t = useText();
  return (
    <div className="mx-auto w-full max-w-[360px]">
      <ConiferTwig id={id} season={season} title={t(tx("A conifer twig", "Ein Nadelzweig"))} />
    </div>
  );
}
