"use client";

// Level 3 widget for "nervous-system": continuous versus saltatory conduction as a race over
// 10 cm. Without myelin the action potential has to be regenerated at every spot of the
// membrane (a wave crawling along); with myelin it is only regenerated at the nodes of
// Ranvier and jumps from node to node.

import { animate, useReducedMotion } from "motion/react";
import { Flag, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { ActionButton, GhostButton, Note, r1, Segmented } from "./NerveKit";

const W = 620;
const LH = 64; // lane height
const X0 = 30;
const X1 = 580;
const DIST = 0.1; // m
const SLOW = 1300; // real ms of animation per simulated ms
const MAX_MS = 5.2;
const NODE_STEP = 50;
const NODES = Array.from({ length: Math.floor((X1 - X0) / NODE_STEP) + 1 }, (_, i) => X0 + i * NODE_STEP);

type Bare = "thin" | "giant";
const BARE: Record<Bare, { v: number; width: number; label: Text; who: Text }> = {
  thin: { v: 1, width: 4, label: tx("thin, unmyelinated (1 m/s)", "dünn, marklos (1 m/s)"), who: tx("thin unmyelinated fibre (pain fibre, 1 µm)", "dünne marklose Faser (Schmerzfaser, 1 µm)") },
  giant: { v: 25, width: 18, label: tx("squid giant axon (25 m/s)", "Riesenaxon Tintenfisch (25 m/s)"), who: tx("unmyelinated giant axon of a squid (0.5 mm)", "markloses Riesenaxon des Tintenfischs (0,5 mm)") },
};
const MYEL_V = 100;

const fmt = (v: number, locale: string, d = 1) => v.toFixed(d).replace(".", locale === "de" ? "," : ".");
const finish = (v: number) => (DIST / v) * 1000; // ms

function ContinuousLane({ frac, width }: { frac: number; width: number }) {
  const x = X0 + (X1 - X0) * Math.min(1, frac);
  const y = LH / 2;
  const on = frac > 0 && frac < 1;
  return (
    <svg viewBox={`0 0 ${W} ${LH}`} className="block h-auto w-full" aria-hidden>
      <line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--bio-outline)" strokeWidth={width + 2.6} strokeLinecap="round" />
      <line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--bio-nerve)" strokeWidth={width} strokeLinecap="round" />
      {frac > 0 && <line x1={X0} x2={r1(x)} y1={y} y2={y} stroke="var(--blob)" strokeWidth={width} strokeLinecap="round" opacity={0.18} />}
      {on && (
        <>
          <line x1={r1(Math.max(X0, x - 60))} x2={r1(x)} y1={y} y2={y} stroke="var(--blob)" strokeWidth={width + 2} strokeLinecap="round" opacity={0.3} />
          <line x1={r1(Math.max(X0, x - 16))} x2={r1(x + 4)} y1={y} y2={y} stroke="var(--blob)" strokeWidth={width + 6} strokeLinecap="round" opacity={0.85} />
          <path d={`M${r1(x)} ${y - width / 2 - 6} q12 -12 24 0`} fill="none" stroke="var(--blob)" strokeWidth={1.5} strokeDasharray="3 3" />
        </>
      )}
      <line x1={X1 + 12} x2={X1 + 12} y1={8} y2={LH - 8} stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 3" />
    </svg>
  );
}

function SaltatoryLane({ frac }: { frac: number }) {
  const y = LH / 2;
  const k = Math.min(NODES.length - 1, Math.floor(frac * (NODES.length - 1) + 1e-9));
  const on = frac > 0 && frac < 1;
  return (
    <svg viewBox={`0 0 ${W} ${LH}`} className="block h-auto w-full" aria-hidden>
      <line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--bio-outline)" strokeWidth={6.6} strokeLinecap="round" />
      <line x1={X0} x2={X1} y1={y} y2={y} stroke="var(--bio-nerve)" strokeWidth={4} strokeLinecap="round" />
      {NODES.slice(0, -1).map((n) => (
        <rect key={n} x={n + 4} y={y - 9} width={NODE_STEP - 8} height={18} rx={9} fill="var(--bio-bone)" stroke="var(--bio-outline)" strokeWidth={1.3} />
      ))}
      {frac > 0 &&
        NODES.slice(0, k + 1).map((n, i) => (
          <circle key={n} cx={n} cy={y} r={i === k && on ? 8 : 4.5} fill="var(--blob)" opacity={i === k && on ? 0.9 : 0.25} />
        ))}
      {on && k < NODES.length - 1 && (
        <path d={`M${NODES[k]} ${y - 12} Q${NODES[k] + NODE_STEP / 2} ${y - 30} ${NODES[k + 1]} ${y - 12}`} fill="none" stroke="var(--blob)" strokeWidth={1.8} strokeDasharray="3 3" />
      )}
      <line x1={X1 + 12} x2={X1 + 12} y1={8} y2={LH - 8} stroke="var(--ink-3)" strokeWidth={2} strokeDasharray="4 3" />
    </svg>
  );
}

export function NerveRace() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [bare, setBare] = useState<Bare>("giant");
  const [ms, setMs] = useState(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const A = BARE[bare];
  const tA = finish(A.v);
  const tB = finish(MYEL_V);
  const end = Math.min(MAX_MS, Math.max(tA, tB));
  const fracA = ms / tA;
  const fracB = ms / tB;
  const done = ms >= end - 1e-6 && ms > 0;

  const run = () => {
    ctrl.current?.stop();
    if (reduce) {
      setMs(end);
      return;
    }
    ctrl.current = animate(0, end, { duration: (end * SLOW) / 1000, ease: "linear", onUpdate: setMs });
  };

  const note: Text = !done
    ? ms > 0
      ? tx("Watch closely: below, the action potential is only formed at the nodes of Ranvier. Above, it has to be formed again at every spot of the membrane.", "Schau genau hin: Unten entsteht das Aktionspotenzial nur an den Schnürringen. Oben muss es an jeder Stelle der Membran neu gebildet werden.")
      : tx("Two fibres, 10 cm long. Start the race (in slow motion: 1 ms takes more than a second here).", "Zwei Fasern, 10 cm lang. Starte das Rennen (in Zeitlupe: 1 ms dauert hier über eine Sekunde).")
    : bare === "giant"
      ? tx(
          "The myelinated fibre wins by far, although it is about **50 times thinner** than the giant axon. Myelin is the space-saving way to be fast: the impulse jumps from node to node (**saltatory conduction**), and only the nodes need ion pumps, which saves energy.",
          "Die markhaltige Faser gewinnt deutlich, obwohl sie etwa **50-mal dünner** ist als das Riesenaxon. Myelin ist der platzsparende Weg zur Geschwindigkeit: Die Erregung springt von Schnürring zu Schnürring (**saltatorische Erregungsleitung**), und nur an den Schnürringen arbeiten Ionenpumpen, das spart Energie.",
        )
      : tx(
          "After 5 ms the thin unmyelinated fibre has covered only half a centimetre. It needs **100 ms** for the 10 cm, a hundred times longer than the myelinated fibre (**continuous conduction**).",
          "Nach 5 ms hat die dünne marklose Faser erst einen halben Zentimeter geschafft. Sie braucht für die 10 cm **100 ms**, hundertmal so lange wie die markhaltige Faser (**kontinuierliche Erregungsleitung**).",
        );

  const lane = (label: Text, frac: number, total: number, node: ReactNode) => (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px]">
        <span className="font-semibold text-ink">{t(label)}</span>
        <span className={cn("font-math tabular-nums", frac >= 1 ? "text-blob-ink" : "text-ink-3")}>
          {frac >= 1 ? (
            <>
              <Flag className="mr-1 inline size-3.5" />
              {fmt(total, locale)} ms
            </>
          ) : (
            `${fmt(Math.min(1, frac) * 10, locale)} cm`
          )}
        </span>
      </div>
      {node}
    </div>
  );

  return (
    <div className="space-y-4">
      <Segmented
        value={bare}
        onChange={(b) => {
          ctrl.current?.stop();
          setBare(b);
          setMs(0);
        }}
        label={tx("Unmyelinated fibre", "Marklose Faser")}
        options={[
          { id: "giant", label: BARE.giant.label },
          { id: "thin", label: BARE.thin.label },
        ]}
      />
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        {lane(A.who, fracA, tA, <ContinuousLane frac={fracA} width={A.width} />)}
        {lane(tx("myelinated fibre (10 µm, 100 m/s)", "markhaltige Faser (10 µm, 100 m/s)"), fracB, tB, <SaltatoryLane frac={fracB} />)}
        <div className="flex items-center justify-between text-[12.5px] text-ink-3">
          <span>{t(tx("time", "Zeit"))}</span>
          <span className="font-math text-[18px] tabular-nums text-ink">{fmt(ms, locale, 2)} ms</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton onClick={run}>
          <Play className="size-4" /> {t(ms > 0 ? tx("Race again", "Noch ein Rennen") : tx("Start the race", "Rennen starten"))}
        </ActionButton>
        <GhostButton
          label={t(tx("Start again", "Von vorn"))}
          onClick={() => {
            ctrl.current?.stop();
            setMs(0);
          }}
        >
          <RotateCcw className="size-4" />
        </GhostButton>
      </div>
      <Note id={`${bare}-${done}-${ms > 0}`} text={note} accent={done} />
    </div>
  );
}
