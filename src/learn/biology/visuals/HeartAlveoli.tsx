"use client";

// Gas exchange in the lungs: a bronchiole ends in a cluster of alveoli wrapped in capillaries
// (left); the zoom shows one alveolar wall and a capillary. Oxygen diffuses from the air into
// the blood, carbon dioxide the other way, always from high to low concentration.

import { useAnimationFrame, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { useId, useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure, type DrawingProps, type FigurePart } from "@/learn/biology/Figure";
import { bloodMix, noise, SoftButton, svgText } from "./HeartShared";
import { sin } from "@/lib/stableMath";

const W = 520;
const H = 300;

const PARTS: FigurePart[] = [
  { id: "bronchiole", label: tx("bronchiole", "Bronchiole"), at: [40, 56], info: tx("The finest airway. It ends in a cluster of alveoli.", "Der feinste Luftweg. Er endet in einer Traube aus Lungenbläschen.") },
  { id: "alveolus", label: tx("alveolus (air sac)", "Lungenbläschen (Alveole)"), at: [360, 70], info: tx("Filled with fresh air: lots of oxygen, little carbon dioxide. About 300 million of them give a surface of about 100 m².", "Mit frischer Luft gefüllt: viel Sauerstoff, wenig Kohlenstoffdioxid. Etwa 300 Millionen davon ergeben eine Oberfläche von etwa 100 m².") },
  { id: "wall", label: tx("thin wall (one cell layer)", "dünne Wand (eine Zellschicht)"), at: [470, 183], tag: [500, 150], info: tx("Alveolar wall and capillary wall together are less than 1 µm thick: a very short way for diffusion.", "Bläschenwand und Kapillarwand sind zusammen weniger als 1 µm dick: ein sehr kurzer Weg für die Diffusion.") },
  { id: "capillary", label: tx("capillary", "Kapillare"), at: [292, 232], info: tx("Blood arrives oxygen-poor (left) and leaves oxygen-rich (right).", "Das Blut kommt sauerstoffarm an (links) und fließt sauerstoffreich weiter (rechts).") },
  { id: "rbc", label: tx("red blood cell", "rotes Blutkörperchen"), at: [420, 226], info: tx("Its haemoglobin binds the oxygen that diffuses in.", "Sein Hämoglobin bindet den Sauerstoff, der hineindiffundiert.") },
];

const ALVEOLI: [number, number, number][] = [
  [92, 110, 30], [132, 92, 28], [150, 140, 30], [110, 162, 28], [70, 150, 24], [176, 104, 22], [190, 152, 24], [138, 196, 24],
];

/** Particle i at time t (seconds): oxygen goes air → wall → blood, carbon dioxide the reverse. */
function particle(i: number, t: number, kind: "o2" | "co2") {
  const period = 4.2;
  const ph = ((t / period + noise(i, kind === "o2" ? 3 : 9)) % 1 + 1) % 1;
  const x0 = 270 + noise(i, kind === "o2" ? 1 : 5) * 220;
  const yAir = 70 + noise(i, kind === "o2" ? 2 : 6) * 90;
  const yBlood = 214 + noise(i, kind === "o2" ? 4 : 8) * 30;
  const drift = 50; // blood carries particles to the right
  if (kind === "o2") {
    // 0–0.45 wander in the air towards the wall, 0.45–0.6 cross, 0.6–1 ride with the blood
    if (ph < 0.45) return { x: x0 + sin(ph * 9 + i) * 6, y: yAir + (186 - yAir) * (ph / 0.45) * 0.85, o: Math.min(1, ph * 8) };
    if (ph < 0.6) return { x: x0, y: 186 - 2 + ((ph - 0.45) / 0.15) * (yBlood - 184), o: 1 };
    return { x: x0 + ((ph - 0.6) / 0.4) * drift, y: yBlood, o: ph > 0.9 ? (1 - ph) * 10 : 1 };
  }
  if (ph < 0.4) return { x: x0 - drift * (1 - ph / 0.4), y: yBlood, o: Math.min(1, ph * 8) };
  if (ph < 0.55) return { x: x0, y: yBlood - ((ph - 0.4) / 0.15) * (yBlood - 182), o: 1 };
  return { x: x0 + sin(ph * 9 + i) * 6, y: 182 - ((ph - 0.55) / 0.45) * (182 - yAir), o: ph > 0.9 ? (1 - ph) * 10 : 1 };
}

function Particles({ playing }: { playing: boolean }) {
  const reduce = useReducedMotion();
  const [time, setTime] = useState(1.3);
  useAnimationFrame((_, delta) => {
    if (reduce || !playing) return;
    setTime((t) => t + Math.min(delta, 50) / 1000);
  });
  const o2 = Array.from({ length: 14 }, (_, i) => ({ ...particle(i, time, "o2"), k: `o${i}` }));
  const co2 = Array.from({ length: 9 }, (_, i) => ({ ...particle(i, time, "co2"), k: `c${i}` }));
  const cells = [0, 1, 2, 3].map((i) => (((time * 22 + i * 64) % 256) + 256) % 256);
  return (
    <g pointerEvents="none">
      <g data-part="rbc">
        {cells.map((s, i) => {
          const x = 258 + s;
          return (
            <g key={i}>
              <ellipse cx={x} cy={229} rx={15} ry={11} fill={bloodMix((x - 270) / 200)} stroke="var(--bio-outline)" strokeWidth={1.2} />
              <ellipse cx={x} cy={229} rx={6} ry={4} fill="var(--bio-flesh)" opacity={0.4} />
            </g>
          );
        })}
      </g>
      {o2
        .filter((p) => p.x > 262 && p.x < 512)
        .map((p) => (
          <g key={p.k} opacity={p.o}>
            <circle cx={p.x - 2.6} cy={p.y} r={3.4} fill="var(--bio-water-deep)" />
            <circle cx={p.x + 2.6} cy={p.y} r={3.4} fill="var(--bio-water-deep)" />
          </g>
        ))}
      {co2
        .filter((p) => p.x > 262 && p.x < 512)
        .map((p) => (
          <g key={p.k} opacity={p.o}>
            <circle cx={p.x - 5} cy={p.y} r={2.8} fill="var(--bio-mito-deep)" />
            <circle cx={p.x} cy={p.y} r={3.2} fill="var(--ink-2)" />
            <circle cx={p.x + 5} cy={p.y} r={2.8} fill="var(--bio-mito-deep)" />
          </g>
        ))}
    </g>
  );
}

function AlveoliArt({ gid, moving, playing }: { gid: string; moving: boolean; playing: boolean }) {
  return (
    <g>
      <defs>
        <linearGradient id={`${gid}-cap`} x1="262" y1="0" x2="512" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0.05" style={{ stopColor: "var(--bio-blood-low)" }} />
          <stop offset="0.9" style={{ stopColor: "var(--bio-blood)" }} />
        </linearGradient>
        <linearGradient id={`${gid}-net`} x1="60" y1="0" x2="210" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--bio-blood-low)" }} />
          <stop offset="1" style={{ stopColor: "var(--bio-blood)" }} />
        </linearGradient>
        <clipPath id={`${gid}-zoom`}>
          <rect x={262} y={26} width={250} height={250} rx={22} />
        </clipPath>
      </defs>
      {/* Overview: bronchiole and alveoli with capillaries */}
      <g data-part="bronchiole">
        <path d="M20 40 C46 54 68 76 86 98" fill="none" stroke="var(--bio-outline)" strokeWidth={21} strokeLinecap="round" />
        <path d="M20 40 C46 54 68 76 86 98" fill="none" stroke="var(--bio-flesh)" strokeWidth={17} strokeLinecap="round" />
        <path d="M20 40 C46 54 68 76 86 98" fill="none" stroke="var(--bio-vacuole)" strokeWidth={8} strokeLinecap="round" />
      </g>
      <g data-part="alveolus">
        {ALVEOLI.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="var(--bio-vacuole)" stroke="var(--bio-flesh-deep)" strokeWidth={3} />
        ))}
      </g>
      <g data-part="capillary" fill="none" stroke={`url(#${gid}-net)`} strokeWidth={2.6} strokeLinecap="round" opacity={0.95}>
        <path d="M58 132 C80 120 92 140 112 130 C132 120 140 150 162 138 C178 130 190 142 210 132" />
        <path d="M60 172 C84 160 96 178 120 168 C140 160 152 186 176 172 C190 166 200 178 214 170" />
        <path d="M74 96 C96 82 110 104 130 92 C150 80 164 110 186 98 C196 92 204 104 214 98" />
        <path d="M100 210 C120 196 136 214 160 204" />
      </g>
      {/* Zoom frame and guide lines */}
      <path d="M176 104 L262 40 M190 152 L262 270" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 4" fill="none" />
      <circle cx={176} cy={128} r={36} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="4 4" />
      <g clipPath={`url(#${gid}-zoom)`}>
        <rect x={262} y={26} width={250} height={250} fill="var(--bio-flesh)" />
        <g data-part="alveolus">
          <path d="M262 26 L512 26 L512 178 C440 184 340 184 262 178 Z" fill="var(--bio-vacuole)" />
        </g>
        <g data-part="wall">
          <path d="M262 178 C340 184 440 184 512 178" fill="none" stroke="var(--bio-flesh-deep)" strokeWidth={7} />
          <path d="M262 196 L512 196" stroke="var(--bio-flesh-deep)" strokeWidth={4} />
          <ellipse cx={330} cy={184} rx={12} ry={3.5} fill="var(--bio-nucleus)" stroke="var(--bio-nucleus-deep)" strokeWidth={1} />
        </g>
        <g data-part="capillary">
          <rect x={262} y={198} width={250} height={62} fill={`url(#${gid}-cap)`} opacity={0.9} />
          <path d="M262 262 L512 262" stroke="var(--bio-flesh-deep)" strokeWidth={4} />
        </g>
        {moving ? (
          <Particles playing={playing} />
        ) : (
          <g>
            <g data-part="rbc">
              {[300, 380, 460].map((x) => (
                <ellipse key={x} cx={x} cy={229} rx={15} ry={11} fill={bloodMix((x - 270) / 200)} stroke="var(--bio-outline)" strokeWidth={1.2} />
              ))}
            </g>
            <g fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M300 110 L300 205 M292 196 L300 206 L308 196" stroke="var(--bio-water-deep)" />
              <path d="M470 205 L470 110 M462 120 L470 110 L478 120" stroke="var(--bio-mito-deep)" />
            </g>
          </g>
        )}
      </g>
      <rect x={262} y={26} width={250} height={250} rx={22} fill="none" stroke="var(--bio-outline)" strokeWidth={2} />
    </g>
  );
}

/** The gas-exchange picture without animation (for tasks), or with moving molecules. */
export function HeartAlveoli({ mode = "names", show, ask, highlight, legend }: DrawingProps) {
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <Figure title={tx("Gas exchange in the alveoli", "Gasaustausch in den Lungenbläschen")} width={W} height={H} parts={PARTS} mode={mode} show={show} ask={ask} highlight={highlight} legend={legend}>
      <AlveoliArt gid={gid} moving={false} playing={false} />
    </Figure>
  );
}

export function HeartAlveoliWidget() {
  const t = useText();
  const gid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  return (
    <div className="space-y-3">
      <Figure title={tx("Gas exchange in the alveoli", "Gasaustausch in den Lungenbläschen")} width={W} height={H} parts={PARTS} mode="explore">
        <AlveoliArt gid={gid} moving={!reduce} playing={playing} />
      </Figure>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-2">
        {!reduce && (
          <SoftButton onClick={() => setPlaying((p) => !p)} className="h-9">
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? t(tx("Pause", "Pause")) : t(tx("Play", "Abspielen"))}
          </SoftButton>
        )}
        <span className="flex items-center gap-2">
          <svg width="22" height="10" aria-hidden>
            <circle cx="7" cy="5" r="3.4" fill="var(--bio-water-deep)" />
            <circle cx="13" cy="5" r="3.4" fill="var(--bio-water-deep)" />
          </svg>
          <span>
            O₂: {t(tx("air → blood", "Luft → Blut"))}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <svg width="22" height="10" aria-hidden>
            <circle cx="5" cy="5" r="2.8" fill="var(--bio-mito-deep)" />
            <circle cx="11" cy="5" r="3.2" fill="var(--ink-2)" />
            <circle cx="17" cy="5" r="2.8" fill="var(--bio-mito-deep)" />
          </svg>
          <span>
            CO₂: {t(tx("blood → air", "Blut → Luft"))}
          </span>
        </span>
      </div>
      <p className="text-[12px] text-ink-3" style={svgText}>
        {t(tx("Each gas diffuses from where there is a lot of it to where there is little. No pump needed.", "Jedes Gas diffundiert von dort, wo viel davon ist, dorthin, wo wenig ist. Dafür braucht es keine Pumpe."))}
      </p>
    </div>
  );
}
