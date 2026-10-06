"use client";

// The knee-jerk reflex for the "nervous-system" topic (level 2): a seated leg, the thigh muscle
// with its muscle spindle, the spinal cord in cross-section and the two neurons of the reflex
// arc. Tap the knee and follow the impulse: receptor → sensory neuron → synapse in the spinal
// cord → motor neuron → muscle, and only afterwards a message reaches the brain.

import { animate, useReducedMotion } from "motion/react";
import { Hammer, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { ActionButton, chain, cubic, GhostButton, Note, pathOf, r1, span, track, type Pt } from "./NerveKit";

const W = 560;
const H = 380;
const KNEE: Pt = [350, 268];

const SENSORY = track(
  chain(
    cubic([190, 244], [200, 226], [226, 206], [246, 190]),
    cubic([246, 190], [262, 170], [276, 140], [282, 112]),
    cubic([282, 112], [288, 82], [300, 56], [320, 52]),
    cubic([320, 52], [340, 50], [358, 56], [372, 64]),
    cubic([372, 64], [384, 70], [392, 74], [394, 84]),
    cubic([394, 84], [396, 94], [394, 102], [391, 108]),
  ),
);
const MOTOR = track(
  chain(
    cubic([384, 114], [374, 118], [364, 122], [352, 124]),
    cubic([352, 124], [320, 128], [298, 118], [289, 118]),
    cubic([289, 118], [284, 140], [270, 172], [254, 194]),
    cubic([254, 194], [248, 206], [244, 222], [242, 236]),
  ),
);
const BRAIN = track(cubic([394, 80], [402, 60], [412, 38], [414, 4]));
const TRUNK = pathOf(cubic([288, 104], [282, 140], [268, 172], [250, 198]));

// Grey matter (butterfly), left half; the right half is mirrored.
const GREY_HALF = "M420 84 C410 82 400 70 394 56 C390 51 385 55 387 62 C391 74 398 84 396 92 C390 98 378 104 378 114 C380 125 396 127 404 118 C410 110 414 102 420 100 Z";

const PARTS: FigurePart[] = [
  { id: "receptor", label: tx("receptor (muscle spindle)", "Rezeptor (Muskelspindel)"), at: [190, 246], tag: [132, 200], info: tx("Senses that the muscle is stretched and turns that into nerve impulses.", "Registriert, dass der Muskel gedehnt wird, und wandelt das in Erregung um.") },
  { id: "sensory", label: tx("sensory neuron (afferent)", "Sensorisches Neuron (afferent)"), at: [263, 160], tag: [198, 128], info: tx("Carries the impulse from the receptor to the spinal cord.", "Leitet die Erregung vom Rezeptor zum Rückenmark.") },
  { id: "ganglion", label: tx("spinal ganglion", "Spinalganglion"), at: [320, 52], tag: [292, 16], info: tx("Swelling of the dorsal root. The cell bodies of the sensory neurons sit here.", "Verdickung der hinteren Wurzel. Hier liegen die Zellkörper der sensorischen Neurone.") },
  { id: "cord", label: tx("spinal cord", "Rückenmark"), at: [452, 82], info: tx("Grey matter (butterfly, cell bodies) inside, white matter (nerve fibres) outside. Reflexes are switched here.", "Innen graue Substanz (Schmetterling, Zellkörper), außen weiße Substanz (Nervenfasern). Hier wird der Reflex umgeschaltet.") },
  { id: "synapse", label: tx("synapse (switch-over)", "Synapse (Umschaltung)"), at: [391, 109], tag: [476, 170], info: tx("Here the sensory neuron passes the signal directly to the motor neuron. Only one synapse: very fast.", "Hier gibt das sensorische Neuron die Erregung direkt an das motorische Neuron weiter. Nur eine Synapse: sehr schnell.") },
  { id: "motor", label: tx("motor neuron (efferent)", "Motorisches Neuron (efferent)"), at: [330, 127], tag: [352, 182], info: tx("Carries the impulse from the spinal cord to the muscle.", "Leitet die Erregung vom Rückenmark zum Muskel.") },
  { id: "effector", label: tx("effector: thigh muscle", "Effektor: Oberschenkelstrecker"), at: [112, 250], tag: [60, 200], info: tx("The muscle contracts and the lower leg kicks forward.", "Der Muskel zieht sich zusammen, der Unterschenkel schnellt nach vorn.") },
  { id: "brainpath", label: tx("pathway to the brain", "Bahn zum Gehirn"), at: [413, 26], tag: [480, 24], info: tx("A side branch also reports to the brain, but the reflex is already over when you notice it.", "Eine Abzweigung meldet es auch dem Gehirn, aber der Reflex ist schon vorbei, wenn du es merkst.") },
];

export const REFLEX_PARTS = PARTS;

export type ReflexState = {
  /** Muscle spindle lights up (0..1). */
  spindle?: number;
  /** Impulse on the sensory / motor / brain fibre: 0..1 along it, or undefined. */
  s?: number;
  m?: number;
  b?: number;
  /** Synapse flash (0..1). */
  syn?: number;
  /** Muscle contraction (0..1). */
  contract?: number;
  /** Lower leg angle in degrees (negative = kicks forward). */
  kick?: number;
  /** Hammer lifted (1) or on the tendon (0). */
  hammer?: number;
};

const rot = ([x, y]: Pt, a: number): Pt => {
  const r = (a * Math.PI) / 180;
  const dx = x - KNEE[0];
  const dy = y - KNEE[1];
  return [r1(KNEE[0] + dx * Math.cos(r) - dy * Math.sin(r)), r1(KNEE[1] + dx * Math.sin(r) + dy * Math.cos(r))];
};

function Impulse({ path, at, color }: { path: ReturnType<typeof track>; at?: number; color: string }) {
  if (at === undefined || at <= 0 || at >= 1) return null;
  const [x, y] = path.at(at);
  return (
    <g style={{ pointerEvents: "none" }}>
      <path d={pathOf(path.part(Math.max(0, at - 0.14), at))} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" opacity={0.35} />
      <circle cx={r1(x)} cy={r1(y)} r={7} fill={color} opacity={0.3} />
      <circle cx={r1(x)} cy={r1(y)} r={4} fill={color} stroke="var(--raised)" strokeWidth={1.5} />
    </g>
  );
}

/** The reflex arc drawing. `state` shows a moment of the reflex. */
export function NerveReflexArc({ mode = "names", show, ask, highlight, legend, state = {}, onTap }: DrawingProps & { state?: ReflexState; onTap?: () => void }) {
  const parts = show ? PARTS.filter((p) => show.includes(p.id)) : PARTS;
  const kick = state.kick ?? 0;
  const contract = state.contract ?? 0;
  const tendonEnd = rot([368, 304], kick);
  const hammerAngle = (state.hammer ?? 1) * 24;
  return (
    <Figure title={tx("Knee-jerk reflex: the reflex arc", "Kniesehnenreflex: der Reflexbogen")} width={W} height={H} parts={parts} mode={mode} ask={ask} highlight={highlight} legend={legend}>
      {/* the nerve (bundle of fibres) */}
      <path d={TRUNK} fill="none" stroke="var(--bio-nerve)" strokeWidth={20} strokeLinecap="round" opacity={0.35} />

      {/* spinal cord in cross-section (back = top) */}
      <g data-part="cord">
        <ellipse cx={420} cy={92} rx={58} ry={46} fill="var(--bio-cell)" stroke="var(--bio-outline)" strokeWidth={2} />
        <path d={GREY_HALF} fill="var(--bio-flesh-deep)" opacity={0.5} />
        <path d={GREY_HALF} transform="translate(840 0) scale(-1 1)" fill="var(--bio-flesh-deep)" opacity={0.5} />
        <circle cx={420} cy={92} r={2.6} fill="var(--bio-outline)" />
      </g>

      {/* leg: thigh with femur and muscle; lower leg rotates about the knee */}
      <g>
        <path d="M24 236 C120 226 260 228 340 240 C362 244 372 256 372 272 C372 290 356 298 336 298 C250 300 120 302 24 298 Z" fill="var(--bio-flesh)" opacity={0.5} stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
        <rect x={34} y={266} width={312} height={12} rx={6} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.2} />
        <g transform={`rotate(${r1(kick)} ${KNEE[0]} ${KNEE[1]})`}>
          <path d="M326 262 C324 300 328 340 332 380 L376 380 C374 340 378 300 378 268 C370 256 340 254 326 262 Z" fill="var(--bio-flesh)" opacity={0.5} stroke="var(--bio-flesh-deep)" strokeWidth={1.4} />
          <rect x={340} y={276} width={12} height={110} rx={6} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.2} />
        </g>
        <ellipse cx={376} cy={254} rx={8} ry={12} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.3} />
        <line x1={378} y1={264} x2={tendonEnd[0]} y2={tendonEnd[1]} stroke="var(--bio-bone)" strokeWidth={6} strokeLinecap="round" />
        <line x1={378} y1={264} x2={tendonEnd[0]} y2={tendonEnd[1]} stroke="var(--bio-outline)" strokeWidth={1} strokeLinecap="round" opacity={0.5} />
      </g>
      <g data-part="effector">
        <path
          d="M66 250 C126 224 270 226 332 246 C270 262 126 270 66 250 Z"
          transform={`translate(332 248) scale(${r1(100 - 5 * contract) / 100} ${r1(100 + 28 * contract) / 100}) translate(-332 -248)`}
          fill="var(--bio-blood)"
          fillOpacity={0.45 + 0.25 * contract}
          stroke="var(--bio-outline)"
          strokeWidth={1.5}
        />
        <line x1={330} y1={247} x2={372} y2={250} stroke="var(--bio-bone)" strokeWidth={4} strokeLinecap="round" />
      </g>
      <g data-part="receptor">
        <ellipse cx={190} cy={246} rx={17} ry={5} fill="var(--bio-water)" stroke="var(--bio-water-deep)" strokeWidth={1.2} />
        <path d="M178 246 l3 -4 l3 8 l3 -8 l3 8 l3 -8 l3 8 l3 -8 l3 4" fill="none" stroke="var(--bio-water-deep)" strokeWidth={1.1} />
        {(state.spindle ?? 0) > 0 && <circle cx={190} cy={246} r={10 + 10 * (state.spindle ?? 0)} fill="none" stroke="var(--bio-water-deep)" strokeWidth={2} opacity={1 - (state.spindle ?? 0)} />}
      </g>

      {/* neurons */}
      <g data-part="brainpath">
        <path d={BRAIN.d} fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 4" />
        <path d="M408 12 L414 2 L420 12" fill="none" stroke="var(--ink-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g data-part="sensory">
        <path d={SENSORY.d} fill="none" stroke="var(--bio-water-deep)" strokeWidth={2.6} strokeLinecap="round" />
      </g>
      <g data-part="ganglion">
        <ellipse cx={320} cy={52} rx={17} ry={12} fill="var(--bio-nerve)" fillOpacity={0.6} stroke="var(--bio-outline)" strokeWidth={1.4} />
        <circle cx={320} cy={52} r={5} fill="var(--bio-water-deep)" />
      </g>
      <g data-part="motor">
        <path d={MOTOR.d} fill="none" stroke="var(--bio-blood)" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M384 108 L392 118 L378 122 Z" fill="var(--bio-blood)" stroke="var(--bio-outline)" strokeWidth={1} strokeLinejoin="round" />
        <path d="M242 236 l-7 4 M242 236 l0 6 M242 236 l7 4" stroke="var(--bio-blood)" strokeWidth={2} strokeLinecap="round" />
      </g>
      <g data-part="synapse">
        <circle cx={391} cy={109} r={4.5} fill="var(--bio-water-deep)" stroke="var(--raised)" strokeWidth={1} />
        {(state.syn ?? 0) > 0 && <circle cx={391} cy={109} r={6 + 12 * (state.syn ?? 0)} fill="none" stroke="var(--blob)" strokeWidth={2.2} opacity={1 - (state.syn ?? 0)} />}
      </g>

      {/* the reflex hammer, tapping the tendon below the kneecap */}
      <g transform={`rotate(${r1(hammerAngle)} 486 350)`} style={{ cursor: onTap ? "pointer" : undefined }} onClick={onTap}>
        <line x1={486} y1={350} x2={404} y2={290} stroke="var(--bio-wood-deep)" strokeWidth={5} strokeLinecap="round" />
        <path d="M388 270 L412 282 L396 304 Z" fill="var(--bio-petal-deep)" stroke="var(--bio-outline)" strokeWidth={1.4} strokeLinejoin="round" />
      </g>

      <Impulse path={SENSORY} at={state.s} color="var(--bio-water-deep)" />
      <Impulse path={MOTOR} at={state.m} color="var(--bio-blood)" />
      <Impulse path={BRAIN} at={state.b} color="var(--ink-2)" />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Widget: tap and follow the impulse.

const STAGES: { until: number; text: Text }[] = [
  { until: 0.12, text: tx("**Stimulus:** the hammer hits the tendon below the kneecap. That stretches the thigh muscle a tiny bit.", "**Reiz:** Der Hammer trifft die Sehne unter der Kniescheibe. Dadurch wird der Oberschenkelmuskel ein kleines bisschen gedehnt.") },
  { until: 0.18, text: tx("**Receptor:** the muscle spindle in the muscle senses the stretch and produces nerve impulses.", "**Rezeptor:** Die Muskelspindel im Muskel registriert die Dehnung und bildet Erregungen.") },
  { until: 0.44, text: tx("**Sensory neuron:** it carries the impulse to the spinal cord (its cell body sits in the spinal ganglion).", "**Sensorisches Neuron:** Es leitet die Erregung zum Rückenmark (sein Zellkörper liegt im Spinalganglion).") },
  { until: 0.5, text: tx("**Spinal cord:** at a synapse the signal is passed straight to the motor neuron. The brain is not asked.", "**Rückenmark:** An einer Synapse wird direkt auf das motorische Neuron umgeschaltet. Das Gehirn wird nicht gefragt.") },
  { until: 0.76, text: tx("**Motor neuron:** it carries the impulse back to the same muscle.", "**Motorisches Neuron:** Es leitet die Erregung zurück zum selben Muskel.") },
  { until: 1.01, text: tx("**Effector:** the thigh muscle contracts and the lower leg kicks forward. Only now does the message reach your brain: you notice the kick afterwards.", "**Effektor:** Der Oberschenkelstrecker zieht sich zusammen, der Unterschenkel schnellt nach vorn. Erst jetzt kommt die Meldung im Gehirn an: Du merkst den Tritt hinterher.") },
];

/** The state of the drawing at time t (0..1) of the reflex. */
export function reflexAt(t: number): ReflexState {
  if (t <= 0) return {};
  const kickIn = span(t, 0.76, 0.86);
  const kickOut = span(t, 0.9, 1);
  return {
    hammer: t < 0.04 ? 1 - span(t, 0, 0.04) : Math.min(1, span(t, 0.1, 0.2)),
    spindle: t > 0.08 && t < 0.24 ? span(t, 0.08, 0.24) : 0,
    s: t > 0.16 && t < 0.44 ? span(t, 0.16, 0.44) : undefined,
    syn: t > 0.43 && t < 0.53 ? span(t, 0.43, 0.53) : 0,
    m: t > 0.5 && t < 0.76 ? span(t, 0.5, 0.76) : undefined,
    contract: t < 0.74 ? 0 : t < 0.8 ? span(t, 0.74, 0.8) : 1 - span(t, 0.88, 1),
    kick: -30 * (kickIn - kickOut),
    b: t > 0.48 && t < 1 ? span(t, 0.48, 1) : undefined,
  };
}

export function NerveReflexLab() {
  const t = useText();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0);
  const [slow, setSlow] = useState(true);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const stage = time <= 0 ? -1 : STAGES.findIndex((s) => time < s.until);

  const tap = () => {
    ctrl.current?.stop();
    if (reduce) {
      // No animation: step from stage to stage.
      const next = STAGES.find((s) => s.until > time + 0.001);
      setTime(next && time > 0 ? Math.min(1, next.until - 0.005) : STAGES[0].until - 0.005);
      return;
    }
    setTime(0.001);
    ctrl.current = animate(0.001, 1, { duration: slow ? 7 : 1.6, ease: "linear", onUpdate: setTime });
  };

  return (
    <div className="space-y-4">
      <NerveReflexArc mode="names" legend="below" state={reflexAt(time)} onTap={tap} highlight={stage === 3 ? ["synapse"] : stage === 1 ? ["receptor"] : stage === 5 ? ["effector"] : []} />
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={tap}>
          <Hammer className="size-4" /> {t(time > 0 && time < 1 ? tx("Tap again", "Noch mal klopfen") : tx("Tap the knee", "Aufs Knie klopfen"))}
        </ActionButton>
        <GhostButton pressed={slow} onClick={() => setSlow(!slow)}>
          {t(tx("Slow motion", "Zeitlupe"))}
        </GhostButton>
        <GhostButton
          label={t(tx("Start again", "Von vorn"))}
          onClick={() => {
            ctrl.current?.stop();
            setTime(0);
          }}
        >
          <RotateCcw className="size-4" />
        </GhostButton>
        <input
          type="range"
          min={0}
          max={1}
          step={0.005}
          value={time}
          onChange={(e) => {
            ctrl.current?.stop();
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Time", "Zeit"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>
      <ol className="grid gap-1 sm:grid-cols-6">
        {STAGES.map((s, i) => (
          <li key={i} className={cn("h-1.5 rounded-full transition-colors", i <= stage ? "bg-blob" : "bg-line")} />
        ))}
      </ol>
      <Note
        id={`st${stage}`}
        text={stage < 0 ? tx("Tap the knee with the hammer (button or hammer) and follow the impulse. Use the slider to go back and forth.", "Klopf mit dem Hammer aufs Knie (Knopf oder Hammer) und verfolge die Erregung. Mit dem Regler kannst du vor- und zurückspulen.") : STAGES[stage].text}
        accent={stage >= 0}
      />
      <p className="text-[12.5px] text-ink-3">{t(tx("In real life the whole reflex takes only about 0.03 seconds.", "In Wirklichkeit dauert der ganze Reflex nur etwa 0,03 Sekunden."))}</p>
    </div>
  );
}
