"use client";

// The enzyme at work, step by step: substrate binds in the active site (enzyme-substrate complex),
// the bond breaks, the products leave and the unchanged enzyme takes the next substrate.
// Level 1: lock and key in plain words; level 2: with E + S → ES → E + P; level 3: lock and key
// versus induced fit, and what competitive and allosteric inhibitors do.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play, RotateCcw, StepForward } from "lucide-react";
import { useEffect, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { MathView } from "@/learn/components/MathView";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { ALLO_PATH, C, EnzymeBody, inhibitorPath, substrateHalves, SubstrateShape } from "./EnzymeShapes";

type Kind = "fit" | "wrong" | "comp" | "allo";
type Model = "lock" | "induced";

const START = { x: -150, y: -118, rotate: -14 };
const SPRING = { type: "spring", stiffness: 70, damping: 14 } as const;

/** How many phases each kind of molecule goes through. */
const PHASES: Record<Kind, number> = { fit: 4, wrong: 2, comp: 4, allo: 3 };

const CAPTIONS: Record<1 | 2 | 3, Partial<Record<Kind, Text[]>>> = {
  1: {
    fit: [
      tx("The enzyme (blue) and its substrate (yellow) move about freely. Soon they bump into each other.", "Das Enzym (blau) und sein Substrat (gelb) bewegen sich frei. Gleich stoßen sie zusammen."),
      tx("The substrate fits exactly into the enzyme's pocket, **like a key in a lock**.", "Das Substrat passt genau in die Tasche des Enzyms, **wie ein Schlüssel ins Schloss**."),
      tx("Now the bond in the substrate breaks: it is **split into two parts**.", "Jetzt bricht die Bindung im Substrat: Es wird **in zwei Teile gespalten**."),
      tx("The products leave. The enzyme is **unchanged** and ready for the next substrate right away.", "Die Produkte lösen sich. Das Enzym ist **unverändert** und sofort bereit für das nächste Substrat."),
    ],
    wrong: [
      tx("A different substance comes along. Does it fit too?", "Ein anderer Stoff kommt vorbei. Passt er auch?"),
      tx("No! Its shape doesn't fit into the pocket, so the enzyme can't split it. **Every enzyme has its own substrate.**", "Nein! Seine Form passt nicht in die Tasche, also kann das Enzym ihn nicht spalten. **Jedes Enzym hat sein eigenes Substrat.**"),
    ],
  },
  2: {
    fit: [
      tx("Enzyme (E) and substrate (S) move freely in the solution. Only if they collide in the right way can the substrate bind.", "Enzym (E) und Substrat (S) bewegen sich frei in der Lösung. Nur wenn sie richtig zusammenstoßen, kann das Substrat binden."),
      tx("The substrate binds in the **active site**: the **enzyme-substrate complex** (ES) forms.", "Das Substrat bindet im **aktiven Zentrum**: Es entsteht der **Enzym-Substrat-Komplex** (ES)."),
      tx("In the complex the bond in the substrate is strained and breaks. The enzyme lowers the activation energy for this.", "Im Komplex wird die Bindung im Substrat geschwächt und bricht. Das Enzym senkt dafür die Aktivierungsenergie."),
      tx("The products (P) are released. The enzyme (E) is unchanged and binds the next substrate.", "Die Produkte (P) lösen sich. Das Enzym (E) liegt unverändert vor und bindet das nächste Substrat."),
    ],
    wrong: [
      tx("A different molecule of a similar size comes along.", "Ein anderes Molekül von ähnlicher Größe kommt vorbei."),
      tx("It doesn't fit into the active site: no enzyme-substrate complex, no reaction. That's **substrate specificity**.", "Es passt nicht ins aktive Zentrum: kein Enzym-Substrat-Komplex, keine Reaktion. Das ist **Substratspezifität**."),
    ],
  },
  3: {
    comp: [
      tx("A **competitive inhibitor** (pink) looks very much like the substrate.", "Ein **kompetitiver Hemmstoff** (rosa) ist dem Substrat sehr ähnlich gebaut."),
      tx("It binds in the active site, but it can't be converted. It just sits there for a while.", "Er bindet im aktiven Zentrum, kann aber nicht umgesetzt werden. Er sitzt dort einfach eine Weile."),
      tx("The active site is occupied: the substrate can't get in. Inhibitor and substrate **compete** for the same site.", "Das aktive Zentrum ist besetzt: Das Substrat kommt nicht hinein. Hemmstoff und Substrat **konkurrieren** um dieselbe Stelle."),
      tx("The binding is reversible: once the inhibitor leaves, the substrate can bind. With lots of substrate it wins most of the time, so **$v_{max}$ is still reached, but $K_M$ rises**.", "Die Bindung ist reversibel: Löst sich der Hemmstoff, kann das Substrat binden. Bei viel Substrat gewinnt meist das Substrat, darum **wird $v_{max}$ noch erreicht, aber $K_M$ steigt**."),
    ],
    allo: [
      tx("An **allosteric inhibitor** (orange) looks nothing like the substrate. It has its own binding site.", "Ein **allosterischer Hemmstoff** (orange) sieht dem Substrat gar nicht ähnlich. Er hat eine eigene Bindungsstelle."),
      tx("It binds at the **allosteric site**, away from the active site. The whole enzyme changes its shape: the active site is deformed.", "Er bindet am **allosterischen Zentrum**, abseits vom aktiven Zentrum. Das ganze Enzym ändert seine Form: Das aktive Zentrum wird verformt."),
      tx("The substrate no longer fits. More substrate doesn't help here, so **$v_{max}$ falls** (non-competitive inhibition).", "Das Substrat passt nicht mehr. Mehr Substrat hilft hier nicht, darum **sinkt $v_{max}$** (nicht-kompetitive Hemmung)."),
    ],
  },
};

const LOCK_L3: Text[] = [
  tx("**Lock and key model** (Emil Fischer, 1894): the active site has exactly the right shape from the start.", "**Schlüssel-Schloss-Modell** (Emil Fischer, 1894): Das aktive Zentrum hat von Anfang an genau die passende Form."),
  tx("The substrate slots in like a rigid key into a rigid lock.", "Das Substrat passt hinein wie ein starrer Schlüssel in ein starres Schloss."),
  tx("The bond breaks. In this model the enzyme itself does not move at all.", "Die Bindung bricht. Das Enzym selbst bewegt sich in diesem Modell überhaupt nicht."),
  tx("The products leave. A good model, but real enzymes are flexible: see induced fit.", "Die Produkte lösen sich. Ein gutes Modell, aber echte Enzyme sind beweglich: Schau dir Induced Fit an."),
];
const INDUCED_L3: Text[] = [
  tx("**Induced fit** (Daniel Koshland, 1958): without the substrate, the active site doesn't quite fit yet.", "**Induced Fit** (Daniel Koshland, 1958): Ohne Substrat ist das aktive Zentrum noch nicht ganz passend geformt."),
  tx("Binding **induces a change of shape** (conformational change): the active site closes tightly around the substrate.", "Erst die Bindung **löst eine Formänderung aus** (Konformationsänderung): Das aktive Zentrum schließt sich eng um das Substrat."),
  tx("The tight grip strains the bond and stabilises the transition state, so the bond breaks easily.", "Der enge Griff spannt die Bindung und stabilisiert den Übergangszustand, darum bricht die Bindung leicht."),
  tx("The products leave and the enzyme returns to its starting shape.", "Die Produkte lösen sich, und das Enzym kehrt in seine Ausgangsform zurück."),
];

export function EnzymeLockKey({ level = 1 }: { level?: 1 | 2 | 3 }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [kind, setKind] = useState<Kind>("fit");
  const [model, setModel] = useState<Model>(level === 3 ? "induced" : "lock");
  const [phase, setPhase] = useState(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(0);
  const [playing, setPlaying] = useState(false);

  const total = PHASES[kind];
  const next = () => {
    if (phase + 1 < total) {
      setPhase(phase + 1);
      if (kind === "fit" && phase + 1 === 3) setDone((d) => d + 1);
    } else {
      setPhase(0);
      setRound((r) => r + 1);
      if (kind !== "fit") setPlaying(false);
    }
  };

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(next, phase === 0 ? 1300 : 2100);
    return () => clearTimeout(id);
  });

  const choose = (k: Kind) => {
    setKind(k);
    setPhase(0);
    setRound((r) => r + 1);
    setPlaying(false);
  };
  const reset = () => {
    setPhase(0);
    setRound((r) => r + 1);
    setDone(0);
    setPlaying(false);
  };

  const induced = level === 3 && model === "induced" && kind === "fit";
  const caption: Text =
    level === 3 && kind === "fit" ? (model === "induced" ? INDUCED_L3 : LOCK_L3)[phase] : (CAPTIONS[level][kind] ?? CAPTIONS[2].fit!)[phase];

  // Enzyme shape: open → closed with induced fit, deformed by an allosteric inhibitor.
  const variant = kind === "allo" && phase >= 1 ? "distorted" : induced ? (phase === 1 || phase === 2 ? "closed" : "open") : "fit";
  const tr = reduce ? { duration: 0 } : SPRING;

  const kinds: { id: Kind; label: Text }[] =
    level === 3
      ? [
          { id: "fit", label: tx("Substrate", "Substrat") },
          { id: "comp", label: tx("Competitive inhibitor", "Kompetitiver Hemmstoff") },
          { id: "allo", label: tx("Allosteric inhibitor", "Allosterischer Hemmstoff") },
        ]
      : [
          { id: "fit", label: level === 1 ? tx("Matching substrate", "Passendes Substrat") : tx("Substrate", "Substrat") },
          { id: "wrong", label: level === 1 ? tx("Other substance", "Anderer Stoff") : tx("Other molecule", "Anderes Molekül") },
        ];

  const eq = "E#e1 +#p1 S#s1 \\to#a1 E#e2 S#s2 \\to#a2 E#e3 +#p2 P#p3";
  const eqHl = phase === 0 ? ["e1", "p1", "s1"] : phase === 3 ? ["e3", "p2", "p3"] : ["e2", "s2"];

  return (
    <div className="space-y-4">
      {level === 3 && (
        <Segmented
          value={model}
          onChange={(m) => {
            setModel(m);
            setPhase(0);
            setRound((r) => r + 1);
            setPlaying(false);
          }}
          options={[
            { id: "lock", label: tx("Lock and key", "Schlüssel-Schloss") },
            { id: "induced", label: tx("Induced fit", "Induced Fit") },
          ]}
          disabled={kind !== "fit"}
        />
      )}

      <div className="rounded-xl border border-line bg-surface p-2">
        <svg viewBox="0 0 480 330" className="mx-auto block h-auto w-full" style={{ maxWidth: 560 }} role="img" aria-label={t(tx("An enzyme and a substrate", "Ein Enzym und ein Substrat"))}>
          <g transform="translate(240 186)">
            <EnzymeBody variant={variant} allo={level === 3} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 15 }} />

            <AnimatePresence>{kind === "fit" && <FitSubstrate key={`fit-${round}`} phase={phase} reduce={!!reduce} />}</AnimatePresence>

            {kind === "wrong" && (
              <motion.g
                key={`wrong-${round}`}
                initial={{ ...START, opacity: 0 }}
                animate={phase === 0 ? { ...START, opacity: 1 } : { x: [START.x, 0, -34], y: [START.y, -16, -70], rotate: [START.rotate, 0, -16], opacity: 1 }}
                transition={reduce ? { duration: 0 } : phase === 0 ? { duration: 0.4 } : { duration: 1.5, times: [0, 0.55, 1], ease: "easeInOut" }}
              >
                <SubstrateShape teeth={["square", "tri"]} fill={C.wrong} stroke={C.wrongLine} />
              </motion.g>
            )}

            {kind === "comp" && (
              <>
                <motion.g
                  key={`comp-${round}`}
                  initial={{ ...START, opacity: 0 }}
                  animate={phase === 0 ? { ...START, opacity: 1 } : phase < 3 ? { x: 0, y: 0, rotate: 0, opacity: 1 } : { x: 168, y: -104, rotate: 22, opacity: 1 }}
                  transition={tr}
                >
                  <path d={inhibitorPath()} fill={C.comp} stroke={C.compLine} strokeWidth={2.2} strokeLinejoin="round" />
                </motion.g>
                <motion.g
                  key={`comp-s-${round}`}
                  initial={{ x: 160, y: -122, rotate: 12, opacity: 0 }}
                  animate={
                    phase < 2
                      ? { x: 160, y: -122, rotate: 12, opacity: 1 }
                      : phase === 2
                        ? { x: [160, 10, 120], y: [-122, -84, -126], rotate: [12, 0, 18], opacity: 1 }
                        : { x: 0, y: 0, rotate: 0, opacity: 1 }
                  }
                  transition={reduce ? { duration: 0 } : phase === 2 ? { duration: 1.5, times: [0, 0.5, 1], ease: "easeInOut" } : { ...SPRING, delay: phase === 3 ? 0.5 : 0 }}
                >
                  <SubstrateShape />
                </motion.g>
              </>
            )}

            {kind === "allo" && (
              <>
                <motion.g
                  key={`allo-${round}`}
                  initial={{ x: 116, y: 6, rotate: 24, opacity: 0 }}
                  animate={phase === 0 ? { x: 116, y: 6, rotate: 24, opacity: 1 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
                  transition={tr}
                >
                  <path d={ALLO_PATH} fill={C.allo} stroke={C.alloLine} strokeWidth={2.2} strokeLinejoin="round" />
                </motion.g>
                <motion.g
                  key={`allo-s-${round}`}
                  initial={{ ...START, opacity: 0 }}
                  animate={phase < 2 ? { ...START, opacity: 1 } : { x: [START.x, 0, -40], y: [START.y, -20, -76], rotate: [START.rotate, 0, -14], opacity: 1 }}
                  transition={reduce ? { duration: 0 } : phase < 2 ? { duration: 0.4 } : { duration: 1.5, times: [0, 0.55, 1], ease: "easeInOut" }}
                >
                  <SubstrateShape />
                </motion.g>
              </>
            )}
          </g>
        </svg>
      </div>

      {level >= 2 && (
        <div className="flex justify-center">
          <MathView src={eq} size="lg" highlight={kind === "fit" ? eqHl : []} scope={`enz-eq-${level}`} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex flex-wrap gap-1.5">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => choose(k.id)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                kind === k.id ? "border-blob bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
              )}
            >
              {t(k.label)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink"
            aria-label={playing ? t(tx("Pause", "Pause")) : t(tx("Play", "Abspielen"))}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              next();
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-ink px-4 text-[14px] font-semibold text-paper transition-transform hover:bg-ink/88 active:scale-[0.97]"
          >
            <StepForward className="size-4" /> {t(tx("Next step", "Nächster Schritt"))}
          </button>
          <button type="button" onClick={reset} className="grid size-10 place-items-center rounded-xl text-ink-2 hover:bg-hover hover:text-ink" aria-label={t(tx("Start again", "Von vorn"))}>
            <RotateCcw className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === phase ? "w-6 bg-blob" : "w-1.5 bg-line-2")} />
        ))}
        {kind === "fit" && (
          <span className="ml-auto text-[13px] text-ink-3">
            {t(tx("Substrates converted:", "Umgesetzte Substrate:"))} <span className="font-semibold tabular-nums text-ink">{done}</span>
            <span className="mx-1.5">·</span>
            {t(tx("enzymes used up: 0", "verbrauchte Enzyme: 0"))}
          </span>
        )}
      </div>

      <motion.p
        key={`${kind}-${model}-${phase}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[4.5rem] rounded-xl bg-hover/60 px-3.5 py-2.5 text-[14.5px] leading-relaxed text-ink-2"
        aria-live="polite"
      >
        <Inline text={caption} />
      </motion.p>
    </div>
  );
}

/** The matching substrate through its four phases: free, bound, split, released. */
function FitSubstrate({ phase, reduce }: { phase: number; reduce: boolean }) {
  const h = substrateHalves();
  const tr = reduce ? { duration: 0 } : SPRING;
  const whole = phase === 0 ? START : { x: 0, y: 0, rotate: 0 };
  const split = phase >= 2;
  return (
    <motion.g
      initial={{ ...START, opacity: 0 }}
      animate={{ ...whole, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.3 } }}
      transition={reduce ? { duration: 0 } : { ...SPRING, opacity: { duration: 0.4 } }}
    >
      <motion.path
        d={h.left}
        fill={C.sub}
        stroke={C.subLine}
        strokeWidth={2.2}
        strokeLinejoin="round"
        initial={false}
        animate={phase === 3 ? { x: -168, y: -100, rotate: -28 } : split ? { x: -5, y: 0, rotate: 0 } : { x: 0, y: 0, rotate: 0 }}
        transition={tr}
      />
      <motion.path
        d={h.right}
        fill={C.sub}
        stroke={C.subLine}
        strokeWidth={2.2}
        strokeLinejoin="round"
        initial={false}
        animate={phase === 3 ? { x: 168, y: -100, rotate: 28 } : split ? { x: 5, y: 0, rotate: 0 } : { x: 0, y: 0, rotate: 0 }}
        transition={tr}
      />
      <motion.path d="M -9 0 L 9 0" stroke={C.subLine} strokeWidth={5} strokeLinecap="round" initial={false} animate={{ opacity: split ? 0 : 1 }} transition={{ duration: reduce ? 0 : 0.25 }} />
      <AnimatePresence>
        {phase === 2 && !reduce && (
          <motion.g key="spark" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 1, 0], scale: 1.3 }} exit={{ opacity: 0 }} transition={{ duration: 0.9 }}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path key={a} d="M 0 -12 L 0 -22" stroke="var(--blob)" strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${a})`} />
            ))}
          </motion.g>
        )}
      </AnimatePresence>
    </motion.g>
  );
}

/** A small two-way switch. */
function Segmented<T extends string>({ value, onChange, options, disabled }: { value: T; onChange: (v: T) => void; options: { id: T; label: Text }[]; disabled?: boolean }) {
  const t = useText();
  return (
    <div className={cn("inline-flex rounded-lg border border-line p-0.5", disabled && "opacity-50")}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={cn("rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors", value === o.id ? "bg-hover text-ink" : "text-ink-3 hover:text-ink")}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
