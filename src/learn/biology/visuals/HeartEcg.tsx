"use client";

// The heart's own pacemaker (level 3): the conduction system drawn into the heart (sinus node,
// AV node, bundle of His, bundle branches, Purkinje fibres), the excitation spreading in step
// with the ECG, and an ECG strip on millimetre paper for tasks.

import { useAnimationFrame, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { cn } from "@/lib/utils";
import { ecgAt } from "./HeartCycle";
import { HEART_H, HEART_OUTLINES, HEART_W, HeartArt } from "./HeartSection";
import { Chip, MainButton, polyPath, svgText, type Pt } from "./HeartShared";

// ---------------------------------------------------------------------------
// Conduction system (coordinates of the heart drawing)

const SA: Pt = [130, 166];
const AVN: Pt = [206, 244];
const PATHS = {
  internodal: "M130 166 C150 190 186 214 206 244",
  bachmann: "M136 160 C200 132 268 140 304 168",
  his: "M206 244 C220 252 236 260 250 270",
  rightBranch: "M248 272 C242 310 236 346 224 376",
  leftBranch: "M254 272 C262 310 270 352 292 396",
  rightPurkinje: "M224 376 C200 392 162 380 142 352 C128 330 124 300 126 276 M190 386 C178 370 170 352 168 330 M150 360 C150 340 152 320 156 300",
  leftPurkinje: "M292 396 C324 412 354 390 370 352 C382 322 386 292 382 262 M334 404 C340 380 346 356 356 330 M372 340 C366 320 362 298 362 276",
};

const PARTS: FigurePart[] = [
  { id: "sa", label: tx("sinus node", "Sinusknoten"), at: SA, tag: [70, 150], info: tx("The pacemaker in the wall of the right atrium: it fires on its own, 60 to 80 times a minute.", "Der Schrittmacher in der Wand des rechten Vorhofs: Er erregt sich von selbst, 60- bis 80-mal pro Minute.") },
  { id: "avnode", label: tx("AV node", "AV-Knoten"), at: AVN, tag: [150, 292], info: tx("Delays the excitation by about 0.1 s so the atria can finish filling the ventricles. Backup pacemaker: 40 to 60 per minute.", "Verzögert die Erregung um etwa 0,1 s, damit die Vorhöfe die Kammern fertig füllen. Ersatzschrittmacher: 40 bis 60 pro Minute.") },
  { id: "his", label: tx("bundle of His", "His-Bündel"), at: [238, 262], tag: [300, 228], info: tx("The only path for the excitation through the insulating valve plane into the septum.", "Der einzige Weg der Erregung durch die isolierende Ventilebene in die Scheidewand.") },
  { id: "tawara", label: tx("bundle branches", "Tawara-Schenkel"), at: [262, 320], tag: [250, 448], info: tx("A right and a left branch run down the septum to the apex.", "Ein rechter und ein linker Schenkel laufen in der Scheidewand zur Herzspitze.") },
  { id: "purkinje", label: tx("Purkinje fibres", "Purkinje-Fasern"), at: [372, 320], tag: [430, 330], info: tx("Spread the excitation through the ventricle muscle, from the apex upwards: the ventricles contract.", "Verteilen die Erregung in der Kammermuskulatur, von der Herzspitze nach oben: Die Kammern kontrahieren.") },
];

function Line({ d, w, on }: { d: string; w: number; on: number }) {
  return (
    <g>
      <path d={d} fill="none" stroke="var(--bio-nerve-deep)" strokeWidth={w + 2.2} strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--bio-nerve)" strokeWidth={w} strokeLinecap="round" />
      {on > 0 && <path d={d} fill="none" stroke="var(--blob)" strokeWidth={w + 1} strokeLinecap="round" opacity={on} />}
    </g>
  );
}

/** Which parts are excited at time t of a 0.8 s beat (P wave at 0). */
function excitation(t: number, avRhythm: boolean) {
  const win = (a: number, b: number, fade = 0.03) => (t < a || t > b + fade ? 0 : t <= b ? 1 : 1 - (t - b) / fade);
  if (avRhythm) {
    return { sa: 0, atria: 0, av: win(0.13, 0.16), his: win(0.155, 0.19), tawara: win(0.165, 0.21), purkinje: win(0.175, 0.24), ventricles: t < 0.18 ? 0 : t < 0.24 ? (t - 0.18) / 0.06 : t < 0.4 ? 1 : t < 0.52 ? 1 - (t - 0.4) / 0.12 : 0 };
  }
  return {
    sa: win(0, 0.03),
    atria: t < 0.01 ? 0 : t < 0.08 ? (t - 0.01) / 0.07 : t < 0.18 ? 1 : t < 0.22 ? 1 - (t - 0.18) / 0.04 : 0,
    av: win(0.07, 0.16),
    his: win(0.155, 0.19),
    tawara: win(0.165, 0.21),
    purkinje: win(0.175, 0.24),
    ventricles: t < 0.18 ? 0 : t < 0.24 ? (t - 0.18) / 0.06 : t < 0.4 ? 1 : t < 0.52 ? 1 - (t - 0.4) / 0.12 : 0,
  };
}

function ConductionArt({ t, avRhythm, lit }: { t: number | null; avRhythm?: boolean; lit?: boolean }) {
  const e = t === null ? { sa: 0, atria: 0, av: 0, his: 0, tawara: 0, purkinje: 0, ventricles: 0 } : excitation(t, !!avRhythm);
  const O = HEART_OUTLINES;
  return (
    <g>
      <HeartArt ghost />
      {/* excited muscle glows purple */}
      <g fill="var(--blob)" pointerEvents="none">
        <ellipse cx={O.ra.cx} cy={O.ra.cy} rx={O.ra.rx} ry={O.ra.ry} opacity={e.atria * 0.32} />
        <ellipse cx={O.la.cx} cy={O.la.cy} rx={O.la.rx} ry={O.la.ry} opacity={e.atria * 0.32} />
        <path d={O.ventricles} opacity={e.ventricles * 0.3} />
      </g>
      <g opacity={lit === false ? 0.9 : 1}>
        <g data-part="sa">
          <Line d={PATHS.internodal} w={2} on={e.atria > 0 && e.atria < 1 ? 0.8 : 0} />
          <Line d={PATHS.bachmann} w={2} on={e.atria > 0 && e.atria < 1 ? 0.8 : 0} />
          <ellipse cx={SA[0]} cy={SA[1]} rx={11} ry={7} fill="var(--bio-nerve-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          {e.sa > 0 && <ellipse cx={SA[0]} cy={SA[1]} rx={15} ry={11} fill="var(--blob)" opacity={0.75 * e.sa} />}
          {avRhythm && <path d={`M${SA[0] - 10} ${SA[1] - 10} L${SA[0] + 10} ${SA[1] + 10} M${SA[0] + 10} ${SA[1] - 10} L${SA[0] - 10} ${SA[1] + 10}`} stroke="var(--danger)" strokeWidth={3} strokeLinecap="round" />}
        </g>
        <g data-part="his">
          <Line d={PATHS.his} w={4.5} on={e.his} />
        </g>
        <g data-part="tawara">
          <Line d={PATHS.rightBranch} w={3.5} on={e.tawara} />
          <Line d={PATHS.leftBranch} w={3.5} on={e.tawara} />
        </g>
        <g data-part="purkinje">
          <Line d={PATHS.rightPurkinje} w={2} on={e.purkinje} />
          <Line d={PATHS.leftPurkinje} w={2} on={e.purkinje} />
        </g>
        <g data-part="avnode">
          <ellipse cx={AVN[0]} cy={AVN[1]} rx={10} ry={7} fill="var(--bio-nerve-deep)" stroke="var(--bio-outline)" strokeWidth={1.2} />
          {e.av > 0 && <ellipse cx={AVN[0]} cy={AVN[1]} rx={14} ry={10} fill="var(--blob)" opacity={0.75 * e.av} />}
        </g>
      </g>
    </g>
  );
}

/** The conduction system drawn into the heart (for tasks: ask a part). */
export function HeartConduction({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  return (
    <Figure title={tx("The conduction system of the heart", "Das Erregungsleitungssystem des Herzens")} width={HEART_W} height={HEART_H} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <ConductionArt t={null} />
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// ECG strip

/**
 * An ECG on millimetre paper (25 mm/s; 1 mm = 4 px). `rr` is the time between two beats (s).
 * `mark` puts a "?" above one wave; `labels` writes P, Q, R, S, T.
 */
export function HeartEcgStrip({ rr = 0.8, beats = 3, mark, labels = false, noP = false, mmPerBeat }: { rr?: number; beats?: number; mark?: "P" | "QRS" | "T" | "PQ"; labels?: boolean; noP?: boolean; mmPerBeat?: boolean }) {
  const t = useText();
  const k = 4; // px per mm
  const speed = 25; // mm/s
  const total = rr * beats + 0.25;
  const w = Math.round(total * speed * k) + 20;
  const h = 150;
  const base = 96;
  const pts: Pt[] = [];
  for (let i = 0; i <= Math.round(total * 400); i++) {
    const time = i / 400;
    const local = ((time - 0.12) % rr + rr) % rr;
    const beat = Math.floor((time - 0.12) / rr);
    const mv = time < 0.12 || beat >= beats ? 0 : ecgAt(local, noP);
    pts.push([10 + time * speed * k, base - mv * 60]);
  }
  const xAt = (time: number) => 10 + time * speed * k;
  const r0 = 0.12 + 0.185;
  const markT = mark === "P" ? 0.045 : mark === "QRS" ? 0.185 : mark === "T" ? 0.45 : mark === "PQ" ? 0.12 : 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="block h-auto w-full" style={{ maxWidth: w * 1.6, ...svgText }} role="img" aria-label={t(tx("ECG strip, 25 mm per second", "EKG-Streifen, 25 mm pro Sekunde"))}>
      <rect x={0} y={0} width={w} height={h} fill="var(--bio-petal)" opacity={0.12} />
      {Array.from({ length: Math.floor((w - 10) / k) + 1 }, (_, i) => (
        <line key={`v${i}`} x1={10 + i * k} x2={10 + i * k} y1={8} y2={h - 8} stroke="var(--bio-petal-deep)" strokeWidth={i % 5 === 0 ? 0.8 : 0.3} opacity={i % 5 === 0 ? 0.55 : 0.35} />
      ))}
      {Array.from({ length: Math.floor((h - 16) / k) + 1 }, (_, i) => (
        <line key={`h${i}`} x1={10} x2={w - 10} y1={8 + i * k} y2={8 + i * k} stroke="var(--bio-petal-deep)" strokeWidth={i % 5 === 0 ? 0.8 : 0.3} opacity={i % 5 === 0 ? 0.55 : 0.35} />
      ))}
      <path d={polyPath(pts)} fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeLinejoin="round" />
      {labels &&
        Array.from({ length: beats }, (_, b) => {
          const o = 0.12 + b * rr;
          return (
            <g key={b} fontSize={11} fontWeight={700} fill="var(--blob-ink)" textAnchor="middle">
              {!noP && <text x={xAt(o + 0.045)} y={base - 16}>P</text>}
              <text x={xAt(o + 0.15)} y={base + 18}>Q</text>
              <text x={xAt(o + 0.185)} y={base - 66}>R</text>
              <text x={xAt(o + 0.225)} y={base + 22}>S</text>
              <text x={xAt(o + 0.45)} y={base - 26}>T</text>
            </g>
          );
        })}
      {mark && (
        <g>
          <circle cx={xAt(0.12 + rr + markT)} cy={20} r={10} fill="var(--blob)" />
          <text x={xAt(0.12 + rr + markT)} y={20} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="#fff">
            ?
          </text>
          <line x1={xAt(0.12 + rr + markT)} x2={xAt(0.12 + rr + markT)} y1={30} y2={base - (mark === "QRS" ? 70 : 30)} stroke="var(--blob)" strokeWidth={1.6} strokeDasharray="3 3" />
        </g>
      )}
      {mmPerBeat && beats >= 2 && (
        <g>
          <path d={`M${xAt(r0)} ${h - 18} L${xAt(r0 + rr)} ${h - 18}`} stroke="var(--blob)" strokeWidth={1.8} />
          <path d={`M${xAt(r0)} ${h - 24} L${xAt(r0)} ${h - 12} M${xAt(r0 + rr)} ${h - 24} L${xAt(r0 + rr)} ${h - 12}`} stroke="var(--blob)" strokeWidth={1.8} />
          <text x={(xAt(r0) + xAt(r0 + rr)) / 2} y={h - 24} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--blob-ink)">
            RR
          </text>
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Widget: excitation and ECG in step

type Station = { at: number; name: Text; ecg: Text; text: Text };
const STATIONS: Station[] = [
  { at: 0.015, name: tx("Sinus node", "Sinusknoten"), ecg: tx("start of P", "Beginn von P"), text: tx("The sinus node in the right atrium excites itself, 60 to 80 times a minute: the primary pacemaker.", "Der Sinusknoten im rechten Vorhof erregt sich von selbst, 60- bis 80-mal pro Minute: der primäre Schrittmacher.") },
  { at: 0.06, name: tx("Atria", "Vorhöfe"), ecg: tx("P wave", "P-Welle"), text: tx("The excitation spreads over both atria; they contract.", "Die Erregung breitet sich über beide Vorhöfe aus, sie ziehen sich zusammen.") },
  { at: 0.12, name: tx("AV node", "AV-Knoten"), ecg: tx("PQ segment", "PQ-Strecke"), text: tx("The AV node holds the excitation back for about 0.1 s, so the atria can push their blood into the ventricles first.", "Der AV-Knoten hält die Erregung etwa 0,1 s zurück, damit die Vorhöfe ihr Blut zuerst in die Kammern drücken können.") },
  { at: 0.168, name: tx("Bundle of His", "His-Bündel"), ecg: tx("Q", "Q-Zacke"), text: tx("The bundle of His carries the excitation through the insulating valve plane into the septum.", "Das His-Bündel leitet die Erregung durch die isolierende Ventilebene in die Kammerscheidewand.") },
  { at: 0.185, name: tx("Bundle branches", "Tawara-Schenkel"), ecg: tx("R", "R-Zacke"), text: tx("The right and left bundle branches run down the septum to the apex.", "Der rechte und der linke Tawara-Schenkel laufen in der Scheidewand zur Herzspitze.") },
  { at: 0.215, name: tx("Purkinje fibres", "Purkinje-Fasern"), ecg: tx("QRS complex", "QRS-Komplex"), text: tx("The Purkinje fibres spread the excitation through the ventricle muscle from the apex upwards: the ventricles contract and squeeze the blood towards the exits.", "Die Purkinje-Fasern verteilen die Erregung von der Herzspitze aus nach oben in der Kammermuskulatur: Die Kammern kontrahieren und drücken das Blut zu den Ausgängen.") },
  { at: 0.46, name: tx("Recovery", "Erregungsrückbildung"), ecg: tx("T wave", "T-Welle"), text: tx("The ventricles return to rest (repolarisation). The atria recovered already, hidden in the QRS complex.", "Die Kammern kehren in den Ruhezustand zurück (Repolarisation). Die Vorhöfe taten das schon, verdeckt im QRS-Komplex.") },
];

export function HeartConductionWidget() {
  const t = useText();
  const reduce = useReducedMotion();
  const [time, setTime] = useState(0.06);
  const [playing, setPlaying] = useState(false);
  const [avRhythm, setAvRhythm] = useState(false);
  useAnimationFrame((_, delta) => {
    if (!playing || reduce) return;
    setTime((x) => (x + (Math.min(delta, 50) / 1000) * 0.13) % 0.8);
  });
  const stations = avRhythm ? STATIONS.filter((s, i) => i >= 2) : STATIONS;
  const current = [...stations].reverse().find((s) => time >= s.at - 0.004) ?? stations[stations.length - 1];
  // ECG sweep below the heart
  const ew = 440;
  const ex = (s: number) => 20 + (s / 0.8) * (ew - 40);
  const ey = (mv: number) => 70 - mv * 46;
  const trace: Pt[] = [];
  for (let i = 0; i <= Math.round(time * 500); i++) trace.push([ex(i / 500), ey(ecgAt(i / 500, avRhythm))]);
  const ghost: Pt[] = Array.from({ length: 401 }, (_, i) => [ex((i / 400) * 0.8), ey(ecgAt((i / 400) * 0.8, avRhythm))]);
  return (
    <div className="space-y-3">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        <Figure title={tx("The conduction system of the heart", "Das Erregungsleitungssystem des Herzens")} width={HEART_W} height={HEART_H} parts={PARTS} mode="names" legend="below">
          <ConductionArt t={time} avRhythm={avRhythm} />
        </Figure>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {stations.map((s) => (
              <Chip
                key={s.at}
                on={current === s}
                className="h-8 px-2.5 text-[12.5px]"
                onClick={() => {
                  setPlaying(false);
                  setTime(s.at);
                }}
              >
                {t(s.name)}
              </Chip>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-surface p-2">
            <svg viewBox={`0 0 ${ew} 110`} className="block h-auto w-full" role="img" aria-label={t(tx("ECG drawn while the excitation spreads", "EKG, das mitgeschrieben wird, während sich die Erregung ausbreitet"))} style={svgText}>
              <path d={polyPath(ghost)} fill="none" stroke="var(--line)" strokeWidth={1.6} />
              <path d={polyPath(trace)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
              <circle cx={ex(time)} cy={ey(ecgAt(time, avRhythm))} r={4.5} fill="var(--blob)" />
              <g fontSize={11} fontWeight={700} fill="var(--ink-3)" textAnchor="middle">
                {!avRhythm && <text x={ex(0.045)} y={ey(0.15) - 8}>P</text>}
                <text x={ex(0.185) + 14} y={ey(1) + 6}>QRS</text>
                <text x={ex(0.45)} y={ey(0.3) - 8}>T</text>
              </g>
            </svg>
          </div>
          <div className="rounded-xl border border-line bg-surface px-4 py-3" aria-live="polite">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold text-ink">{t(current.name)}</span>
              <span className="text-[12.5px] font-semibold text-blob-ink">{t(tx("ECG:", "EKG:"))} {t(current.ecg)}</span>
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{t(current.text)}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!reduce && (
          <MainButton onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? t(tx("Pause", "Pause")) : t(tx("Play slowly", "Langsam abspielen"))}
          </MainButton>
        )}
        <Chip
          on={avRhythm}
          onClick={() => {
            setAvRhythm((v) => !v);
            setTime(0.13);
          }}
        >
          {t(tx("Sinus node fails", "Sinusknoten fällt aus"))}
        </Chip>
        <input
          type="range"
          min={0}
          max={0.799}
          step={0.001}
          value={time}
          onChange={(e) => {
            setPlaying(false);
            setTime(Number(e.target.value));
          }}
          aria-label={t(tx("Time in the heartbeat", "Zeitpunkt im Herzschlag"))}
          className="h-10 min-w-[140px] flex-1 cursor-pointer accent-[var(--blob)]"
        />
      </div>
      <p className={cn("text-[13px] leading-relaxed", avRhythm ? "text-ink" : "text-ink-3")}>
        {avRhythm
          ? t(tx("Without the sinus node there is no P wave. The AV node takes over as secondary pacemaker, but slower: 40 to 60 beats per minute. If it fails too, the ventricles beat on their own at 20 to 40 per minute.", "Ohne Sinusknoten fehlt die P-Welle. Der AV-Knoten übernimmt als sekundärer Schrittmacher, aber langsamer: 40 bis 60 Schläge pro Minute. Fällt auch er aus, schlagen die Kammern mit 20 bis 40 pro Minute im Eigenrhythmus."))
          : t(tx("Every part of the system can excite itself, but the sinus node is the fastest, so it sets the pace.", "Jeder Teil des Systems kann sich selbst erregen, aber der Sinusknoten ist der schnellste und gibt deshalb den Takt vor."))}
      </p>
    </div>
  );
}
