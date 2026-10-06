"use client";

// The transpiration stream as a playground: light, temperature, wind, humidity and soil
// water change how fast water evaporates from the leaves, and with it how fast the water
// column is pulled up from the roots. A magnifier shows a stoma opening and closing.

import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import { CloudRain, Droplets, Sun, Thermometer, Wind } from "lucide-react";
import { useId, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useLocale } from "@/i18n/client";
import { PlantLeafShape } from "./PlantWhole";
import { PlantStomaBody } from "./PlantStoma";
import { PlantChip, PlantMeter, PlantNote, PlantSlider } from "./PlantUi";

type Pt = [number, number];

const STEM_X = 200;
const GROUND = 334;
const LEAVES: { y: number; angle: number; len: number; width: number }[] = [
  { y: 296, angle: 198, len: 112, width: 22 },
  { y: 258, angle: -20, len: 122, width: 24 },
  { y: 212, angle: 204, len: 104, width: 21 },
  { y: 170, angle: -28, len: 96, width: 19 },
  { y: 134, angle: 214, len: 74, width: 15 },
];
const ROOT_TIPS: Pt[] = [
  [138, 404],
  [196, 414],
  [262, 402],
];

const leafPoint = (k: number, f: number): Pt => {
  const L = LEAVES[k];
  const a = (L.angle * Math.PI) / 180;
  return [STEM_X + Math.cos(a) * L.len * f, L.y + Math.sin(a) * L.len * f];
};

/** The way of one water particle: root tip → shoot axis → leaf vein → stoma. */
const TRACKS: Pt[][] = Array.from({ length: 15 }, (_, i) => {
  const k = i % LEAVES.length;
  return [ROOT_TIPS[i % 3], [STEM_X, GROUND + 8], [STEM_X, LEAVES[k].y + 2], leafPoint(k, 0.3), leafPoint(k, 0.82)];
});

function pointOn(track: Pt[], f: number): Pt {
  const seg = track.slice(1).map((p, i) => Math.hypot(p[0] - track[i][0], p[1] - track[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = f * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i]) {
      const t = d / seg[i];
      return [track[i][0] + (track[i + 1][0] - track[i][0]) * t, track[i][1] + (track[i + 1][1] - track[i][1]) * t];
    }
    d -= seg[i];
  }
  return track[track.length - 1];
}

function WaterDot({ phase, track, offset }: { phase: MotionValue<number>; track: Pt[]; offset: number }) {
  const f = useTransform(phase, (p) => (p + offset) % 1);
  const x = useTransform(f, (v) => pointOn(track, v)[0]);
  const y = useTransform(f, (v) => pointOn(track, v)[1]);
  const opacity = useTransform(f, (v) => (v > 0.9 ? (1 - v) / 0.1 : v < 0.06 ? v / 0.06 : 1));
  return <motion.circle cx={x} cy={y} r={3.4} fill="var(--bio-water-deep)" style={{ opacity }} />;
}

/** Water vapour leaving a leaf's underside. */
function Vapour({ phase, k, j, strength }: { phase: MotionValue<number>; k: number; j: number; strength: number }) {
  const g = useTransform(phase, (p) => (p * 1.4 + j / 3 + k * 0.17) % 1);
  const L = LEAVES[k];
  const [bx, by] = leafPoint(k, 0.45 + j * 0.16);
  const side = L.angle > 90 ? -1 : 1;
  const x = useTransform(g, (v) => bx + side * v * 10);
  const y = useTransform(g, (v) => by + 8 + v * 22);
  const r = useTransform(g, (v) => 2.5 + v * 4);
  const opacity = useTransform(g, (v) => (1 - v) * 0.85 * strength);
  return <motion.circle cx={x} cy={y} r={r} fill="var(--bio-water)" style={{ opacity }} />;
}

function WindStreak({ phase, i, strength }: { phase: MotionValue<number>; i: number; strength: number }) {
  const g = useTransform(phase, (p) => (p + i * 0.27) % 1);
  const x = useTransform(g, (v) => -70 + v * 470);
  const y0 = 120 + i * 58;
  return (
    <motion.path
      d={`M0 ${y0} q14 -8 28 0 t28 0 t22 -4`}
      fill="none"
      stroke="var(--ink-3)"
      strokeWidth={2}
      strokeLinecap="round"
      style={{ x, opacity: strength * 0.8 }}
    />
  );
}

/** Saturation vapour pressure in kPa (Magnus formula). */
const es = (t: number) => 0.611 * Math.exp((17.27 * t) / (t + 237.3));

export function transpirationModel(light: number, temp: number, wind: number, humidity: number, wet: boolean) {
  const aperture = wet ? 0.05 + 0.95 * Math.pow(light / 100, 0.6) : 0.07;
  const boundary = 0.3 + 1.2 * (wind / 100);
  const g = 1 / (1 / Math.max(0.01, aperture) + 1 / boundary) + 0.025;
  const vpd = es(temp) * (1 - humidity / 100);
  const rate = Math.min(1, (g * vpd) / 1.7);
  return { aperture, rate };
}

type Control = "start" | "light" | "temp" | "wind" | "humidity" | "soil";

const NOTES: Record<Control, Text> = {
  start: tx(
    "Water evaporates from the leaves through the stomata (transpiration). Like sucking on a straw, this pulls water up from the roots: the transpiration pull. Change the conditions!",
    "Wasser verdunstet aus den Blättern durch die Spaltöffnungen (Transpiration). Wie beim Trinken mit einem Strohhalm zieht das Wasser aus der Wurzel nach: der Transpirationssog. Verändere die Bedingungen!",
  ),
  light: tx(
    "Light opens the stomata (the plant needs carbon dioxide for photosynthesis). Open stomata also let more water vapour out.",
    "Licht öffnet die Spaltöffnungen (die Pflanze braucht Kohlenstoffdioxid für die Fotosynthese). Durch offene Spalten entweicht aber auch mehr Wasserdampf.",
  ),
  temp: tx("Warmer air takes up more water vapour, and water evaporates faster. Transpiration goes up.", "Warme Luft kann mehr Wasserdampf aufnehmen, und Wasser verdunstet schneller. Die Transpiration steigt."),
  wind: tx(
    "Wind blows away the moist air right in front of the stomata. The difference between inside and outside stays large, so more water evaporates.",
    "Wind weht die feuchte Luft direkt vor den Spaltöffnungen weg. Der Unterschied zwischen innen und außen bleibt groß, also verdunstet mehr Wasser.",
  ),
  humidity: tx(
    "Humid air already holds a lot of water vapour. The difference to the moist air inside the leaf gets smaller, so less water evaporates.",
    "Feuchte Luft enthält schon viel Wasserdampf. Der Unterschied zur feuchten Luft im Blatt wird kleiner, also verdunstet weniger Wasser.",
  ),
  soil: tx(
    "Water shortage! The plant closes its stomata so it doesn't dry out. Transpiration drops sharply, but so does the uptake of carbon dioxide.",
    "Wassermangel! Die Pflanze schließt ihre Spaltöffnungen, damit sie nicht vertrocknet. Die Transpiration sinkt stark, aber auch die Aufnahme von Kohlenstoffdioxid.",
  ),
};

export function PlantTranspiration() {
  const t = useText();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [light, setLight] = useState(70);
  const [temp, setTemp] = useState(22);
  const [wind, setWind] = useState(20);
  const [humidity, setHumidity] = useState(55);
  const [wet, setWet] = useState(true);
  const [last, setLast] = useState<Control>("start");

  const { aperture, rate } = transpirationModel(light, temp, wind, humidity, wet);
  const phase = useMotionValue(0);
  const windPhase = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const dt = Math.min(0.05, delta / 1000);
    phase.set(phase.get() + dt * (0.015 + 0.42 * rate));
    windPhase.set(windPhase.get() + dt * (0.12 + 0.9 * (wind / 100)));
  });

  const level =
    rate < 0.04
      ? tx("very low", "sehr gering")
      : rate < 0.16
        ? tx("low", "gering")
        : rate < 0.4
          ? tx("medium", "mittel")
          : rate < 0.7
            ? tx("high", "hoch")
            : tx("very high", "sehr hoch");
  const stomata = aperture < 0.2 ? tx("almost closed", "fast geschlossen") : aperture < 0.65 ? tx("half open", "halb offen") : tx("wide open", "weit offen");
  const lightText = light < 10 ? tx("dark", "dunkel") : light < 40 ? tx("dim", "trüb") : light < 75 ? tx("bright", "hell") : tx("full sun", "volle Sonne");
  const windText = wind < 8 ? tx("still", "windstill") : wind < 40 ? tx("light breeze", "leichter Wind") : wind < 75 ? tx("windy", "windig") : tx("stormy", "stürmisch");

  const sunR = 14 + 10 * (light / 100);
  const mist = (humidity - 20) / 80;
  const stomaClip = `tr-clip-${uid}`;

  const note = last === "light" && light < 12 ? tx("In the dark the stomata close. Only a tiny amount of water still escapes through the cuticle.", "Im Dunkeln schließen sich die Spaltöffnungen. Nur noch sehr wenig Wasser entweicht durch die Cuticula.") : last === "soil" && wet ? tx("Enough water again: the stomata open, and the transpiration stream flows.", "Wieder genug Wasser: Die Spaltöffnungen öffnen sich, und der Transpirationsstrom fließt.") : NOTES[last];

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)] md:items-start">
      <svg viewBox="0 0 400 430" className="mx-auto block h-auto w-full max-w-[460px]" role="img" aria-label={t(tx("A plant: water rises from the roots and evaporates from the leaves", "Eine Pflanze: Wasser steigt von der Wurzel auf und verdunstet aus den Blättern"))}>
        <defs>
          <clipPath id={stomaClip}>
            <circle cx={330} cy={318} r={48} />
          </clipPath>
        </defs>
        {/* sky: sun, humid air, wind */}
        <motion.g initial={false} animate={{ opacity: 0.25 + 0.75 * (light / 100) }}>
          <circle cx={52} cy={52} r={sunR} fill="var(--bio-sun)" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={52 + Math.cos(a) * (sunR + 5)} y1={52 + Math.sin(a) * (sunR + 5)} x2={52 + Math.cos(a) * (sunR + 5 + 9 * (light / 100))} y2={52 + Math.sin(a) * (sunR + 5 + 9 * (light / 100))} stroke="var(--bio-sun)" strokeWidth={3} strokeLinecap="round" />;
          })}
        </motion.g>
        {light < 15 && <circle cx={52} cy={52} r={13} fill="var(--ink-3)" opacity={0.25} />}
        <motion.g initial={false} animate={{ opacity: 0.15 + 0.85 * mist }}>
          <path d="M282 64 q-2 -20 18 -22 q8 -16 26 -8 q16 -6 22 10 q16 2 14 18 q0 12 -16 12 h-56 q-12 -2 -8 -10 Z" fill="var(--bio-vacuole)" stroke="var(--bio-water)" strokeWidth={1.6} />
          {Array.from({ length: 14 }, (_, i) => (
            <circle key={i} cx={250 + ((i * 53) % 140)} cy={96 + ((i * 37) % 60)} r={2.2} fill="var(--bio-water)" opacity={0.55} />
          ))}
        </motion.g>
        {[0, 1, 2, 3].map((i) => (
          <WindStreak key={i} phase={windPhase} i={i} strength={wind / 100} />
        ))}

        {/* thermometer */}
        <g>
          <rect x={372} y={128} width={10} height={86} rx={5} fill="var(--raised)" stroke="var(--ink-3)" strokeWidth={1.4} />
          <circle cx={377} cy={222} r={9} fill="var(--bio-blood)" stroke="var(--ink-3)" strokeWidth={1.4} />
          <motion.rect x={374.5} width={5} rx={2.5} fill="var(--bio-blood)" initial={false} animate={{ y: 214 - ((temp - 5) / 30) * 80, height: 8 + ((temp - 5) / 30) * 80 }} />
        </g>

        {/* soil and roots */}
        <rect x={0} y={GROUND} width={400} height={96} fill="var(--bio-soil)" opacity={wet ? 0.38 : 0.18} />
        <path d={`M0 ${GROUND} Q50 ${GROUND - 4} 100 ${GROUND} T200 ${GROUND} T300 ${GROUND} T400 ${GROUND}`} fill="none" stroke="var(--bio-soil)" strokeWidth={2.4} />
        {!wet && (
          <g stroke="var(--bio-soil)" strokeWidth={1.6} fill="none" opacity={0.9}>
            <path d="M40 360 l14 10 l-6 12 M300 372 l12 -8 l10 12 M110 400 l10 -6 l8 10" />
          </g>
        )}
        <g fill="none" strokeLinecap="round">
          {ROOT_TIPS.map(([x, y], i) => (
            <g key={i}>
              <path d={`M${STEM_X} ${GROUND + 6} Q${(STEM_X + x) / 2} ${GROUND + 14} ${x} ${y}`} stroke="var(--bio-wood-deep)" strokeWidth={6} />
              <path d={`M${STEM_X} ${GROUND + 6} Q${(STEM_X + x) / 2} ${GROUND + 14} ${x} ${y}`} stroke="var(--bio-bone)" strokeWidth={3.6} />
            </g>
          ))}
        </g>

        {/* shoot */}
        <path d={`M${STEM_X} ${GROUND + 8} L${STEM_X} 112`} stroke="var(--bio-leaf-deep)" strokeWidth={12} strokeLinecap="round" />
        <path d={`M${STEM_X} ${GROUND + 8} L${STEM_X} 112`} stroke="var(--bio-leaf)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M${STEM_X} ${GROUND + 6} L${STEM_X} 114`} stroke="var(--bio-water)" strokeWidth={2.4} opacity={0.5} />
        {LEAVES.map((L, i) => (
          <PlantLeafShape key={i} x={STEM_X} y={L.y} angle={L.angle} len={L.len} width={L.width} />
        ))}

        {/* water */}
        {TRACKS.map((track, i) => (
          <WaterDot key={i} phase={phase} track={track} offset={i / TRACKS.length} />
        ))}
        {LEAVES.map((_, k) => [0, 1, 2].map((j) => <Vapour key={`${k}-${j}`} phase={phase} k={k} j={j} strength={Math.min(1, 0.15 + rate * 1.4)} />))}

        {/* magnifier: a stoma on the underside of a leaf */}
        <circle cx={281} cy={236} r={6} fill="none" stroke="var(--ink-3)" strokeWidth={1.2} strokeDasharray="3 2.5" />
        <path d="M285 241 L304 277" stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 2.5" />
        <circle cx={330} cy={318} r={48} fill="var(--raised)" />
        <g clipPath={`url(#${stomaClip})`}>
          <g transform="translate(330 318) scale(0.42) translate(-180 -130)">
            <PlantStomaBody uid={`tr-${uid}`} open={Math.min(1, aperture * 1.05)} />
          </g>
        </g>
        <circle cx={330} cy={318} r={48} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
      </svg>

      <div className="space-y-4">
        <PlantSlider
          label={t(tx("Light", "Licht"))}
          icon={<Sun className="size-4 text-ink-3" />}
          value={light}
          min={0}
          max={100}
          step={5}
          onChange={(v) => {
            setLight(v);
            setLast("light");
          }}
          valueText={t(lightText)}
        />
        <PlantSlider
          label={t(tx("Temperature", "Temperatur"))}
          icon={<Thermometer className="size-4 text-ink-3" />}
          value={temp}
          min={5}
          max={35}
          onChange={(v) => {
            setTemp(v);
            setLast("temp");
          }}
          valueText={`${temp} °C`}
        />
        <PlantSlider
          label={t(tx("Wind", "Wind"))}
          icon={<Wind className="size-4 text-ink-3" />}
          value={wind}
          min={0}
          max={100}
          step={5}
          onChange={(v) => {
            setWind(v);
            setLast("wind");
          }}
          valueText={t(windText)}
        />
        <PlantSlider
          label={t(tx("Air humidity", "Luftfeuchtigkeit"))}
          icon={<CloudRain className="size-4 text-ink-3" />}
          value={humidity}
          min={20}
          max={100}
          step={5}
          onChange={(v) => {
            setHumidity(v);
            setLast("humidity");
          }}
          valueText={`${humidity} %`}
        />
        <PlantChip
          on={!wet}
          onClick={() => {
            setWet(!wet);
            setLast("soil");
          }}
          icon={<Droplets className="size-4" />}
        >
          {t(tx("Dry soil (water shortage)", "Trockener Boden (Wassermangel)"))}
        </PlantChip>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
          <PlantMeter label={t(tx("Transpiration", "Transpiration"))} value={rate} valueText={t(level)} color="var(--bio-water)" />
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-ink">{t(tx("Stomata", "Spaltöffnungen"))}</span>
            <span className="text-ink-2">{t(stomata)}</span>
          </div>
        </div>
      </div>
      <div className="md:col-span-2">
        <PlantNote id={`${last}-${locale}-${light < 12 ? "d" : "l"}-${wet ? "w" : "x"}`} tone={last === "soil" && !wet ? "warn" : "plain"}>
          {t(note)}
        </PlantNote>
      </div>
    </div>
  );
}
