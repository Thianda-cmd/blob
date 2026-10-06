"use client";

import { motion, useReducedMotion } from "motion/react";
import { Bird, Egg, FastForward, RotateCcw } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng, type Rng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";

// The peppered moth (Birkenspanner): birds pick the moths they can see, the survivors have
// young, and over the generations the population changes. Everything random comes from a
// seeded generator inside the click handlers, so a run can be repeated exactly.

type Bark = "light" | "dark";
type Moth = { id: number; x: number; y: number; a: number; dark: boolean };
type Sim = {
  seed: number;
  gen: number;
  bark: Bark;
  moths: Moth[];
  /** Moths the birds caught in this generation (null: they haven't hunted yet). */
  eaten: number[] | null;
  /** Share of dark moths at the start of each generation, and the bark at that time. */
  history: { dark: number; bark: Bark }[];
  nextId: number;
  note: Text | null;
};

const N = 24;
const COLS = 5;
const ROWS = 7;
const TW = 300;
const TH = 340;
/** Chance to be caught: moths that stand out from the bark are found far more often. */
const P_SEEN = 0.55;
const P_HIDDEN = 0.12;
/** A rare new colour variant by mutation keeps a little variation in the population. */
const MUTATION = 0.02;

// Colours keep their meaning (light moth, dark moth) in both themes.
const BARK_LIGHT = "light-dark(color-mix(in oklab, var(--bio-bone) 86%, var(--bio-wall)), color-mix(in oklab, var(--bio-bone) 42%, var(--ink-2)))";
const LICHEN = "light-dark(color-mix(in oklab, var(--bio-wall) 45%, var(--bio-bone)), color-mix(in oklab, var(--bio-wall) 55%, var(--ink-2)))";
const BARK_DARK = "light-dark(color-mix(in oklab, var(--bio-outline) 82%, var(--bio-wood)), color-mix(in oklab, var(--surface) 80%, var(--bio-wood)))";
const SOOT = "light-dark(color-mix(in oklab, var(--bio-outline) 92%, var(--bio-soil)), color-mix(in oklab, var(--surface) 90%, var(--bio-soil)))";
const MOTH_LIGHT = "light-dark(color-mix(in oklab, var(--bio-bone) 90%, var(--bio-outline)), color-mix(in oklab, var(--bio-bone) 38%, var(--ink-2)))";
const MOTH_DARK = "light-dark(color-mix(in oklab, var(--bio-outline) 90%, var(--bio-wood)), color-mix(in oklab, var(--surface) 86%, var(--bio-wood)))";

function place(rng: Rng, darkShare: number, idStart: number, exact?: number): Moth[] {
  const cells = rng.shuffle(Array.from({ length: COLS * ROWS }, (_, i) => i)).slice(0, N);
  const darkFlags = exact !== undefined ? rng.shuffle(Array.from({ length: N }, (_, i) => i < exact)) : null;
  return cells.map((c, i) => {
    const col = c % COLS;
    const row = Math.floor(c / COLS);
    let dark = darkFlags ? darkFlags[i] : rng.next() < darkShare;
    if (!darkFlags && rng.next() < MUTATION) dark = !dark;
    return {
      id: idStart + i,
      x: 72 + col * 39 + (rng.next() - 0.5) * 18,
      y: 34 + row * 44 + (rng.next() - 0.5) * 16,
      a: (rng.next() - 0.5) * 50,
      dark,
    };
  });
}

const darkShare = (ms: Moth[]) => ms.filter((m) => m.dark).length / Math.max(1, ms.length);

function start(seed: number): Sim {
  const moths = place(createRng(seed * 7919), 0, 0, 2);
  return { seed, gen: 0, bark: "light", moths, eaten: null, history: [{ dark: darkShare(moths), bark: "light" }], nextId: N, note: null };
}

function hunt(s: Sim): number[] {
  const rng = createRng(s.seed * 7919 + s.gen * 2 + 1);
  return s.moths.filter((m) => rng.next() < (m.dark === (s.bark === "dark") ? P_HIDDEN : P_SEEN)).map((m) => m.id);
}

function breed(s: Sim, eaten: number[]): Sim {
  const survivors = s.moths.filter((m) => !eaten.includes(m.id));
  const share = survivors.length ? darkShare(survivors) : 0.5;
  const moths = place(createRng(s.seed * 7919 + s.gen * 2 + 2), share, s.nextId);
  const history = [...s.history, { dark: darkShare(moths), bark: s.bark }];
  return { ...s, gen: s.gen + 1, moths, eaten: null, history, nextId: s.nextId + N };
}

function Moth({ dark, size = 1 }: { dark: boolean; size?: number }) {
  const fill = dark ? MOTH_DARK : MOTH_LIGHT;
  const fleck = "color-mix(in oklab, var(--bio-outline) 55%, transparent)";
  const edge = dark ? "light-dark(color-mix(in oklab, var(--bio-outline) 70%, var(--bio-bone)), color-mix(in oklab, var(--surface) 60%, var(--ink-3)))" : "light-dark(color-mix(in oklab, var(--bio-bone) 60%, var(--bio-outline)), color-mix(in oklab, var(--bio-bone) 55%, var(--ink-3)))";
  return (
    <g transform={`scale(${size})`}>
      <path d="M0 -6 L-4 -12 M0 -6 L4 -12" stroke={edge} strokeWidth={0.9} strokeLinecap="round" />
      <path d="M0 -3 L-15 -9 Q-18 -2 -11 4 L0 3 Z M0 -3 L15 -9 Q18 -2 11 4 L0 3 Z" style={{ fill }} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      <path d="M0 2 L-9 4 Q-10 10 -3 10 L0 6 Z M0 2 L9 4 Q10 10 3 10 L0 6 Z" style={{ fill }} stroke={edge} strokeWidth={0.8} strokeLinejoin="round" />
      {!dark && (
        <g fill={fleck}>
          <circle cx={-8} cy={-4} r={0.9} />
          <circle cx={-11} cy={0} r={0.7} />
          <circle cx={-5} cy={0} r={0.6} />
          <circle cx={8} cy={-4} r={0.9} />
          <circle cx={11} cy={0} r={0.7} />
          <circle cx={5} cy={0} r={0.6} />
          <circle cx={-5} cy={6} r={0.6} />
          <circle cx={5} cy={6} r={0.6} />
        </g>
      )}
      <ellipse rx={1.8} ry={6.5} cy={1} style={{ fill: dark ? MOTH_DARK : "light-dark(color-mix(in oklab, var(--bio-bone) 70%, var(--bio-outline)), color-mix(in oklab, var(--bio-bone) 45%, var(--ink-3)))" }} stroke={edge} strokeWidth={0.6} />
    </g>
  );
}

/** A small bird in flight (seen from the side). */
function BirdShape() {
  return (
    <g>
      <path d="M-14 0 Q-4 -6 8 -2 L16 0 L8 3 Q-4 6 -14 0 Z" fill="var(--bio-outline)" />
      <path d="M-2 -2 Q-10 -18 -22 -20 Q-12 -10 -6 1 Z" fill="var(--bio-outline)" />
      <path d="M16 0 L22 1 L16 2.4 Z" fill="var(--bio-sun)" />
      <path d="M-14 0 L-24 -4 L-22 2 Z" fill="var(--bio-outline)" />
      <circle cx={10} cy={-1} r={1.1} fill="var(--raised)" />
    </g>
  );
}

function Trunk({ bark }: { bark: Bark }) {
  return (
    <g>
      <rect x={0} y={0} width={TW} height={TH} fill={bark === "dark" ? "color-mix(in oklab, var(--bio-outline) 14%, var(--surface))" : "color-mix(in oklab, var(--bio-leaf) 16%, var(--surface))"} style={{ transition: "fill .6s" }} />
      <path d={`M40 0 Q34 60 42 120 Q50 190 38 250 Q30 300 40 340 L262 340 Q272 310 266 270 Q252 210 260 140 Q270 70 262 0 Z`} style={{ fill: bark === "dark" ? BARK_DARK : BARK_LIGHT, transition: "fill .6s" }} stroke="var(--bio-outline)" strokeWidth={1.6} />
      {/* bark marks: lichen patches on clean bark, soot streaks on dark bark */}
      {[
        [80, 40, 22, 9],
        [190, 92, 26, 8],
        [120, 168, 18, 7],
        [220, 214, 20, 9],
        [92, 262, 24, 8],
        [176, 312, 22, 7],
        [150, 60, 14, 5],
        [60, 200, 12, 5],
      ].map(([x, y, rx, ry], i) => (
        <ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} style={{ fill: bark === "dark" ? SOOT : LICHEN, transition: "fill .6s" }} opacity={0.85} />
      ))}
      {[70, 110, 150, 196, 236].map((x, i) => (
        <path key={i} d={`M${x} ${10 + i * 7} q${i % 2 ? 4 : -4} 40 0 80 q${i % 2 ? -3 : 3} 50 0 100`} fill="none" stroke="color-mix(in oklab, var(--bio-outline) 30%, transparent)" strokeWidth={1.2} />
      ))}
    </g>
  );
}

function Chart({ history }: { history: Sim["history"] }) {
  const t = useText();
  const W = 330;
  const H = 190;
  const L = 38;
  const B = 28;
  const T = 10;
  const R = 10;
  const gens = Math.max(12, history.length + 1);
  const x = (g: number) => L + ((W - L - R) * g) / gens;
  const y = (v: number) => T + (H - T - B) * (1 - v);
  const pts = history.map((h, g) => `${x(g).toFixed(1)} ${y(h.dark).toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t(tx("Share of dark moths per generation", "Anteil dunkler Falter je Generation"))}>
      {history.map((h, g) =>
        h.bark === "dark" ? <rect key={g} x={x(g)} y={T} width={x(g + 1) - x(g)} height={H - T - B} fill="color-mix(in oklab, var(--bio-outline) 12%, transparent)" /> : null,
      )}
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={y(v)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="var(--ink-3)" style={{ fontFamily: "var(--font-sans)" }}>
            {v * 100} %
          </text>
        </g>
      ))}
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="var(--ink-3)" strokeWidth={1.2} />
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={11.5} fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
        {t(tx("generation", "Generation"))}
      </text>
      {pts.length > 1 && <path d={`M${pts.join(" L")}`} fill="none" stroke="var(--blob)" strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />}
      {history.map((h, g) => (
        <motion.circle key={g} initial={{ r: 0 }} animate={{ r: 3.4 }} cx={x(g)} cy={y(h.dark)} fill="var(--blob)" stroke="var(--raised)" strokeWidth={1.2} />
      ))}
    </svg>
  );
}

export function EvolutionMoths() {
  const t = useText();
  const scope = useId();
  const reduce = useReducedMotion();
  const [sim, setSim] = useState<Sim>(() => start(1));
  const light = sim.moths.filter((m) => !m.dark).length;
  const dark = sim.moths.length - light;
  const eatenSet = new Set(sim.eaten ?? []);
  const caught = sim.moths.filter((m) => eatenSet.has(m.id));
  const order = [...caught].sort((a, b) => a.y - b.y);
  const step = 0.42;
  const flight = reduce ? 0 : step * (order.length + 1);

  const setBark = (bark: Bark) => setSim((s) => (s.eaten ? s : { ...s, bark, note: bark === "dark" ? NOTE_SOOT : NOTE_CLEAN }));
  const doHunt = () =>
    setSim((s) => {
      const eaten = hunt(s);
      const lightEaten = s.moths.filter((m) => eaten.includes(m.id) && !m.dark).length;
      const darkEaten = eaten.length - lightEaten;
      return {
        ...s,
        eaten,
        note: tx(
          `The birds caught ${lightEaten} light and ${darkEaten} dark moth${darkEaten === 1 ? "" : "s"}. Moths that stand out from the bark are spotted first.`,
          `Die Vögel haben ${lightEaten} helle und ${darkEaten} dunkle Falter erwischt. Falter, die sich von der Rinde abheben, werden zuerst entdeckt.`,
        ),
      };
    });
  const doBreed = () =>
    setSim((s) => {
      if (!s.eaten) return s;
      const next = breed(s, s.eaten);
      const share = darkShare(next.moths);
      const note =
        s.bark === "dark" && share >= 0.75
          ? tx(
              "Most moths are dark now. Yet not a single moth changed its colour: the dark ones simply survived more often and passed their colour on.",
              "Jetzt sind die meisten Falter dunkel. Dabei hat kein einziger Falter seine Farbe geändert: Die dunklen haben einfach öfter überlebt und ihre Farbe vererbt.",
            )
          : tx("The survivors had young. The young have the colour of their parents.", "Die Überlebenden haben Nachwuchs bekommen. Die Jungen haben die Farbe ihrer Eltern.");
      return { ...next, note };
    });
  const skip = () =>
    setSim((s) => {
      let cur = s.eaten ? breed(s, s.eaten) : s;
      for (let i = s.eaten ? 1 : 0; i < 10; i++) cur = breed(cur, hunt(cur));
      return { ...cur, note: tx("Ten generations later.", "Zehn Generationen später.") };
    });
  const reset = () => setSim((s) => start(s.seed + 1));

  const BARKS: { id: Bark; label: Text }[] = [
    { id: "light", label: tx("Clean bark with lichens", "Saubere Rinde mit Flechten") },
    { id: "dark", label: tx("Bark darkened by soot", "Rußgeschwärzte Rinde") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Tree bark", "Baumrinde"))}>
        {BARKS.map((b) => (
          <button
            key={b.id}
            type="button"
            role="tab"
            aria-selected={sim.bark === b.id}
            disabled={!!sim.eaten}
            onClick={() => setBark(b.id)}
            className={cn("relative h-9 rounded-lg border px-3 text-[13.5px] font-medium transition-colors disabled:opacity-60", sim.bark === b.id ? "border-transparent text-white" : "border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            {sim.bark === b.id && <motion.span layoutId={`${scope}-bark`} className="absolute inset-0 rounded-lg bg-blob" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 34 }} />}
            <span className="relative">{t(b.label)}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
        <svg
          viewBox={`0 0 ${TW} ${TH}`}
          className="mx-auto block h-auto w-full max-w-[340px] overflow-hidden rounded-xl"
          role="img"
          aria-label={t(tx(`Birch trunk with ${light} light and ${dark} dark moths`, `Birkenstamm mit ${light} hellen und ${dark} dunklen Faltern`))}
        >
          <Trunk bark={sim.bark} />
          {sim.moths.map((m) => {
            const k = order.findIndex((o) => o.id === m.id);
            const gone = k >= 0;
            return (
              <motion.g
                key={m.id}
                initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                animate={gone ? { opacity: 0, scale: 0.3 } : { opacity: 1, scale: 1 }}
                transition={gone ? { delay: reduce ? 0 : step * (k + 1), duration: 0.25 } : { type: "spring", stiffness: 300, damping: 20, delay: reduce ? 0 : (m.id % N) * 0.012 }}
                style={{ x: m.x, y: m.y }}
              >
                <g transform={`rotate(${m.a})`}>
                  <Moth dark={m.dark} size={1.15} />
                </g>
              </motion.g>
            );
          })}
          {!reduce && order.length > 0 && (
            <motion.g
              key={`bird-${sim.gen}`}
              initial={{ x: TW + 40, y: -30 }}
              animate={{
                x: [TW + 40, ...order.map((m) => m.x + 6), -50],
                y: [-30, ...order.map((m) => m.y - 4), -40],
              }}
              transition={{ duration: flight, ease: "easeInOut", times: [0, ...order.map((_, i) => (i + 1) / (order.length + 1)), 1] }}
            >
              <BirdShape />
            </motion.g>
          )}
        </svg>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[22px] font-bold tabular-nums text-ink">Generation {sim.gen}</span>
            <span className="text-[13px] text-ink-3">{t(tx("dark moths", "dunkle Falter"))}</span>
          </div>
          <div className="flex gap-3 text-[13.5px]">
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <svg viewBox="-17 -13 34 26" className="h-5 w-6" aria-hidden>
                <Moth dark={false} />
              </svg>
              {t(tx(`light: ${light}`, `hell: ${light}`))}
            </span>
            <span className="inline-flex items-center gap-1.5 text-ink-2">
              <svg viewBox="-17 -13 34 26" className="h-5 w-6" aria-hidden>
                <Moth dark />
              </svg>
              {t(tx(`dark: ${dark}`, `dunkel: ${dark}`))}
            </span>
          </div>
          <Chart history={sim.history} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!sim.eaten ? (
          <button type="button" onClick={doHunt} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14.5px] font-semibold text-white">
            <Bird className="size-4" />
            {t(tx("Let the birds hunt", "Vögel jagen lassen"))}
          </button>
        ) : (
          <button type="button" onClick={doBreed} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14.5px] font-semibold text-white">
            <Egg className="size-4" />
            {t(tx("Young: next generation", "Nachwuchs: nächste Generation"))}
          </button>
        )}
        <button type="button" onClick={skip} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink">
          <FastForward className="size-4" />
          {t(tx("+10 generations", "+10 Generationen"))}
        </button>
        <button type="button" onClick={reset} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-[14px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink">
          <RotateCcw className="size-4" />
          {t(tx("Start again", "Neu starten"))}
        </button>
      </div>

      <motion.p
        key={`${sim.gen}-${sim.eaten ? "h" : "b"}-${sim.bark}`}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: sim.eaten && !reduce ? flight * 0.6 : 0 }}
        className="min-h-[3.25rem] rounded-xl border border-line bg-surface px-4 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        {t(sim.note ?? NOTE_START)}
      </motion.p>
    </div>
  );
}

const NOTE_START = tx(
  "Around 1850: almost all peppered moths are light, only a few are dark. Switch the bark to soot, then let the birds hunt.",
  "Um 1850: Fast alle Birkenspanner sind hell, nur wenige dunkel. Schalte die Rinde auf Ruß um und lass dann die Vögel jagen.",
);
const NOTE_SOOT = tx(
  "Factories blacken the trunks with soot and kill the lichens. Look: the moths themselves haven't changed. But which ones can you see now?",
  "Fabriken schwärzen die Stämme mit Ruß, die Flechten sterben ab. Schau: Die Falter selbst haben sich nicht verändert. Aber welche siehst du jetzt?",
);
const NOTE_CLEAN = tx(
  "Clean air: lichens grow again and the bark gets light. Now the dark moths stand out.",
  "Saubere Luft: Flechten wachsen wieder, die Rinde wird hell. Jetzt fallen die dunklen Falter auf.",
);
