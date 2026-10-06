"use client";

// Sizes and resolution (topic "cell", level 2): a logarithmic scale from 1 mm down to 0.1 nm.
// Pick an instrument to see down to which size it can still show separate details.

import { motion } from "motion/react";
import { useState } from "react";
import { useLocale } from "@/i18n/client";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { dec } from "@/learn/chemistry/format";
import { cn } from "@/lib/utils";

type Tool = "eye" | "lm" | "em";
const TOOLS: { id: Tool; name: Text; limitUm: number; color: string; limitText: Text }[] = [
  { id: "eye", name: tx("Eye", "Auge"), limitUm: 100, color: "var(--bio-leaf)", limitText: tx("about 0.1 mm", "etwa 0,1 mm") },
  { id: "lm", name: tx("Light microscope", "Lichtmikroskop"), limitUm: 0.2, color: "var(--bio-sun)", limitText: tx("about 0.2 µm", "etwa 0,2 µm") },
  { id: "em", name: tx("Electron microscope", "Elektronenmikroskop"), limitUm: 0.0001, color: "var(--bio-nucleus)", limitText: tx("about 0.1 nm", "etwa 0,1 nm") },
];

const THINGS: { name: Text; um: number }[] = [
  { name: tx("slipper animalcule", "Pantoffeltierchen"), um: 200 },
  { name: tx("plant cell", "Pflanzenzelle"), um: 50 },
  { name: tx("red blood cell", "rotes Blutkörperchen"), um: 7.5 },
  { name: tx("bacterium", "Bakterium"), um: 2 },
  { name: tx("virus", "Virus"), um: 0.1 },
  { name: tx("ribosome", "Ribosom"), um: 0.025 },
  { name: tx("membrane (thickness)", "Biomembran (Dicke)"), um: 0.008 },
  { name: tx("DNA (width)", "DNA (Durchmesser)"), um: 0.002 },
  { name: tx("atom", "Atom"), um: 0.0001 },
];

const TOP = 22;
const PER = 62; // svg units per power of ten
const y = (um: number) => TOP + (3 - Math.log10(um)) * PER;
const AXIS = 132;
const TICKS: [number, string][] = [
  [1000, "1 mm"],
  [100, "100 µm"],
  [10, "10 µm"],
  [1, "1 µm"],
  [0.1, "100 nm"],
  [0.01, "10 nm"],
  [0.001, "1 nm"],
  [0.0001, "0,1 nm"],
];

/** "7,5 µm", "25 nm", "0,2 mm" */
function sizeText(um: number, locale: "de" | "en") {
  if (um >= 100) return `${dec(um / 1000, locale, 2)} mm`;
  if (um >= 1) return `${dec(um, locale, 1)} µm`;
  return `${dec(um * 1000, locale, 1)} nm`;
}

export function CellSizeScale() {
  const t = useText();
  const locale = useLocale();
  const [tool, setTool] = useState<Tool>("lm");
  const [pick, setPick] = useState<number | null>(null);
  const T = TOOLS.find((x) => x.id === tool)!;
  const seen = (um: number) => um >= T.limitUm;
  const picked = pick !== null ? THINGS[pick] : null;
  const tools = picked ? TOOLS.filter((x) => picked.um >= x.limitUm) : [];
  const ticks = TICKS.map(([v, l]) => [v, locale === "de" ? l : l.replace(",", ".")] as const);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {TOOLS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={tool === x.id}
            onClick={() => setTool(x.id)}
            className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors", tool === x.id ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
          >
            <span className="size-2.5 rounded-full" style={{ background: x.color }} />
            {t(x.name)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:items-start">
        <svg viewBox="0 0 420 470" className="block h-auto w-full" role="img" aria-label={t(tx("Size scale from 1 mm to 0.1 nm", "Größenskala von 1 mm bis 0,1 nm"))}>
          {/* the instrument's range: everything above its limit */}
          <motion.rect x={AXIS - 12} width={24} rx={6} fill={T.color} opacity={0.55} initial={false} animate={{ y: TOP - 6, height: y(T.limitUm) - TOP + 6 }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
          <motion.line x1={AXIS - 22} x2={AXIS + 22} stroke="var(--blob)" strokeWidth={2.5} strokeDasharray="5 3" initial={false} animate={{ y1: y(T.limitUm), y2: y(T.limitUm) }} transition={{ type: "spring", stiffness: 140, damping: 20 }} />
          <line x1={AXIS} y1={TOP} x2={AXIS} y2={y(0.0001)} stroke="var(--ink-2)" strokeWidth={1.6} />
          {ticks.map(([v, l]) => (
            <g key={l}>
              <line x1={AXIS - 6} x2={AXIS + 6} y1={y(v)} y2={y(v)} stroke="var(--ink-2)" strokeWidth={1.4} />
              <text x={AXIS - 18} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--ink)" opacity={0.7} style={{ fontFamily: "var(--font-sans)" }}>
                {l}
              </text>
            </g>
          ))}
          {THINGS.map((x, i) => {
            const on = seen(x.um);
            return (
              <g key={i} className="cursor-pointer" onClick={() => setPick(pick === i ? null : i)} opacity={on ? 1 : 0.4}>
                <rect x={AXIS + 8} y={y(x.um) - 11} width={270} height={22} fill="transparent" />
                <circle cx={AXIS} cy={y(x.um)} r={pick === i ? 7 : 5} fill={on ? "var(--blob)" : "var(--raised)"} stroke="var(--blob)" strokeWidth={2} />
                <text x={AXIS + 16} y={y(x.um) + 4} fontSize={13} fontWeight={pick === i ? 700 : 500} fill="var(--ink)" style={{ fontFamily: "var(--font-sans)" }}>
                  {t(x.name)} <tspan opacity={0.6}>({sizeText(x.um, locale)})</tspan>
                </text>
              </g>
            );
          })}
        </svg>

        <div className="space-y-3">
          <motion.div key={tool} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[14px] leading-relaxed text-ink-2">
            <div className="font-semibold text-ink">{t(T.name)}</div>
            {t(tx("Resolution", "Auflösung"))}: {t(T.limitText)}.{" "}
            {tool === "eye"
              ? t(tx("Two dots closer than that blur into one.", "Zwei Punkte, die näher beieinanderliegen, verschwimmen zu einem."))
              : tool === "lm"
                ? t(tx("Light waves are too long for smaller details. Cells, nuclei and chloroplasts: yes. Ribosomes and viruses: no.", "Lichtwellen sind für kleinere Details zu lang. Zellen, Zellkerne und Chloroplasten: ja. Ribosomen und Viren: nein."))
                : t(tx("Electrons have a far shorter wavelength. But the specimen must be dead and in a vacuum, and the image has no colours.", "Elektronen haben eine viel kürzere Wellenlänge. Aber das Präparat muss tot sein und im Vakuum liegen, und das Bild hat keine Farben."))}
          </motion.div>
          <div className="min-h-[3.5rem] rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2" aria-live="polite">
            {picked ? (
              <>
                <span className="font-semibold text-ink">{t(picked.name)}</span>: {sizeText(picked.um, locale)}. {t(tx("Visible with", "Sichtbar mit"))}: {tools.map((x) => t(x.name)).join(", ")}.
              </>
            ) : (
              t(tx("Tap an object on the scale.", "Tipp auf ein Objekt auf der Skala."))
            )}
          </div>
          <p className="text-[12.5px] text-ink-3">{t(tx("Each step down the scale is ten times smaller.", "Jeder Schritt auf der Skala nach unten ist zehnmal kleiner."))}</p>
        </div>
      </div>
    </div>
  );
}
