"use client";

// A cladogram of the land plants for the "plant-diversity" topic: green algae (stoneworts), mosses,
// ferns and allies, gymnosperms, angiosperms. Numbered bars on the stem mark new features
// (apomorphies). Tap a bar to see the group it defines, tap a group to see all features it carries.

import { motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type CladeTip = "algae" | "mosses" | "ferns" | "gymno" | "angio";

export const TIPS: { id: CladeTip; name: Text; info: Text }[] = [
  { id: "angio", name: tx("Angiosperms (flowering plants)", "Bedecktsamer"), info: tx("Ovules enclosed in an ovary; flowers, fruits. Monocots and dicots.", "Samenanlagen im Fruchtknoten eingeschlossen; Blüten, Früchte. Ein- und Zweikeimblättrige.") },
  { id: "gymno", name: tx("Gymnosperms", "Nacktsamer"), info: tx("Ovules lie open on scales: conifers, ginkgo, cycads. No fruits.", "Samenanlagen liegen frei auf Schuppen: Nadelbäume, Ginkgo, Palmfarne. Keine Früchte.") },
  { id: "ferns", name: tx("Ferns and allies", "Farnpflanzen"), info: tx("Ferns, horsetails, clubmosses: vascular tissue and roots, but spores instead of seeds.", "Farne, Schachtelhalme, Bärlappe: Leitgewebe und Wurzeln, aber Sporen statt Samen.") },
  { id: "mosses", name: tx("Mosses", "Moose"), info: tx("Liverworts and mosses: no true roots, no lignified vascular tissue; the gametophyte dominates.", "Leber- und Laubmoose: keine echten Wurzeln, kein verholztes Leitgewebe; der Gametophyt herrscht vor.") },
  { id: "algae", name: tx("Green algae", "Grünalgen"), info: tx("Live in water. Freshwater green algae such as stoneworts and conjugating algae are the closest relatives of land plants: chlorophyll a and b, starch, cellulose walls.", "Leben im Wasser. Süßwasser-Grünalgen wie Armleuchter- und Jochalgen sind die nächsten Verwandten der Landpflanzen: Chlorophyll a und b, Stärke, Zellwände aus Cellulose.") },
];

export const BARS: { n: number; group: Text; features: Text }[] = [
  { n: 1, group: tx("land plants", "Landpflanzen"), features: tx("embryo fed by the mother plant, cuticle, spores with a tough wall, multicellular sex organs", "Embryo, der von der Mutterpflanze ernährt wird, Cuticula, Sporen mit widerstandsfähiger Wand, vielzellige Geschlechtsorgane") },
  { n: 2, group: tx("vascular plants", "Gefäßpflanzen"), features: tx("vascular tissue with lignified walls, true roots, the sporophyte is the dominant generation", "Leitgewebe mit verholzten Wänden (Lignin), echte Wurzeln, der Sporophyt ist die vorherrschende Generation") },
  { n: 3, group: tx("seed plants", "Samenpflanzen"), features: tx("seeds and pollen: fertilisation by a pollen tube, without water", "Samen und Pollen: Befruchtung über einen Pollenschlauch, ohne Wasser") },
  { n: 4, group: tx("angiosperms", "Bedecktsamer"), features: tx("ovary around the ovules, flowers with petals, fruits, double fertilisation", "Fruchtknoten um die Samenanlagen, Blüten mit Blütenhülle, Früchte, doppelte Befruchtung") },
];

// Geometry: tips stacked on the right, nodes on a diagonal stem from the root (bottom left).
const ROW = (k: number) => 34 + k * 50;
const SX = (y: number) => 26 + ((290 - y) * 168) / 256;
const TIP_X = 214;
const BAR_Y = [ROW(4) - 25, ROW(3) - 25, ROW(2) - 25, ROW(1) - 25];

/** Which bars a tip carries (all bars on its way from the root). */
export const barsOf = (tip: CladeTip): number[] => ({ algae: [], mosses: [1], ferns: [1, 2], gymno: [1, 2, 3], angio: [1, 2, 3, 4] })[tip];
/** Which tips a bar's group contains. */
export const tipsOf = (bar: number): CladeTip[] => TIPS.filter((x) => barsOf(x.id).includes(bar)).map((x) => x.id);

export function Cladogram({ bar, tip, onBar, onTip, ask, numbersOnly = false }: { bar?: number | null; tip?: CladeTip | null; onBar?: (n: number) => void; onTip?: (t: CladeTip) => void; ask?: number; numbersOnly?: boolean }) {
  const t = useText();
  const litTips = new Set<CladeTip>(bar ? tipsOf(bar) : tip ? [tip] : []);
  const litBars = new Set<number>(tip ? barsOf(tip) : bar ? [bar] : []);
  const stemTop = ROW(0);
  // The highlighted part of the stem: from the bar's position up (a clade), or from the root to the tip.
  const litStem = bar ? [BAR_Y[bar - 1] + 8, stemTop] : tip ? [290, ROW(TIPS.findIndex((x) => x.id === tip))] : null;
  return (
    <svg viewBox="0 0 400 300" className="mx-auto block h-auto w-full max-w-[560px]" role="img" aria-label={t(tx("Cladogram of the land plants", "Kladogramm der Landpflanzen"))}>
      {/* stem and side branches */}
      <path d={`M${SX(290)} 290L${SX(stemTop)} ${stemTop}L${TIP_X} ${stemTop}`} fill="none" stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {TIPS.slice(1).map((x, k) => {
        const y = ROW(k + 1);
        return <path key={x.id} d={`M${SX(y)} ${y}L${TIP_X} ${y}`} fill="none" stroke="var(--ink-3)" strokeWidth={3} strokeLinecap="round" />;
      })}
      {litStem && (
        <motion.path
          key={`${bar}-${tip}`}
          d={
            tip
              ? `M${SX(290)} 290L${SX(litStem[1])} ${litStem[1]}L${TIP_X} ${litStem[1]}`
              : `M${SX(litStem[0])} ${litStem[0]}L${SX(stemTop)} ${stemTop}L${TIP_X} ${stemTop}${TIPS.slice(1)
                  .map((x, k) => ({ x, y: ROW(k + 1) }))
                  .filter(({ x }) => litTips.has(x.id))
                  .map(({ y }) => `M${SX(y)} ${y}L${TIP_X} ${y}`)
                  .join("")}`
          }
          fill="none"
          stroke="var(--blob)"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      )}
      {/* tips */}
      {TIPS.map((x, k) => {
        const y = ROW(k);
        const on = litTips.has(x.id);
        return (
          <g key={x.id} onClick={onTip ? () => onTip(x.id) : undefined} className={cn(onTip && "cursor-pointer")}>
            <rect x={TIP_X + 6} y={y - 15} width={176} height={30} rx={8} fill={on ? "var(--blob-soft)" : "var(--raised)"} stroke={on ? "var(--blob)" : "var(--line-2)"} strokeWidth={1.4} />
            <text x={TIP_X + 16} y={y + 5} fill="var(--ink)" fontWeight={on ? 700 : 500} style={{ fontSize: 13.5, fontFamily: "var(--font-sans)" }}>
              {t(x.name).split(" (")[0]}
            </text>
          </g>
        );
      })}
      {/* apomorphy bars */}
      {BAR_Y.map((y, i) => {
        const n = i + 1;
        const x = SX(y);
        const on = litBars.has(n);
        const isAsk = ask === n;
        return (
          <g key={n} onClick={onBar ? () => onBar(n) : undefined} className={cn(onBar && "cursor-pointer")}>
            <path d={`M${x - 9} ${y - 5}L${x + 9} ${y + 5}`} stroke={on ? "var(--blob)" : "var(--ink)"} strokeWidth={4} strokeLinecap="round" />
            <circle cx={x - 24} cy={y + 4} r={11} fill={on || isAsk ? "var(--blob)" : "var(--raised)"} stroke={on || isAsk ? "var(--blob)" : "var(--ink)"} strokeWidth={1.4} />
            <text x={x - 24} y={y + 4} textAnchor="middle" dominantBaseline="central" fill={on || isAsk ? "#fff" : "var(--ink)"} fontWeight={700} style={{ fontSize: 12, fontFamily: "var(--font-sans)" }}>
              {isAsk ? "?" : n}
            </text>
          </g>
        );
      })}
      {!numbersOnly && (
        <text x={SX(290) - 4} y={296} fill="var(--ink-3)" style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}>
          {t(tx("common ancestor", "gemeinsamer Vorfahr"))}
        </text>
      )}
    </svg>
  );
}

/** Lesson widget: explore the cladogram. */
export function DiversityCladogram() {
  const t = useText();
  const [bar, setBar] = useState<number | null>(1);
  const [tip, setTip] = useState<CladeTip | null>(null);
  const B = bar ? BARS[bar - 1] : null;
  const T = tip ? TIPS.find((x) => x.id === tip)! : null;
  return (
    <div className="space-y-3">
      <Cladogram
        bar={bar}
        tip={tip}
        onBar={(n) => {
          setBar(n);
          setTip(null);
        }}
        onTip={(x) => {
          setTip(x);
          setBar(null);
        }}
      />
      <motion.div key={`${bar}-${tip}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="min-h-[92px] rounded-xl border border-line bg-surface px-4 py-3 text-[14px] leading-snug">
        {B && (
          <>
            <div className="mb-1 font-semibold text-ink">
              {B.n}: {t(B.group)}
            </div>
            <p className="text-ink-2">{t(B.features)}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">{t(tx("All groups above this bar share these features: they come from one common ancestor.", "Alle Gruppen oberhalb dieses Strichs teilen diese Merkmale: Sie stammen von einem gemeinsamen Vorfahren ab."))}</p>
          </>
        )}
        {T && (
          <>
            <div className="mb-1 font-semibold text-ink">{t(T.name)}</div>
            <p className="text-ink-2">{t(T.info)}</p>
            <p className="mt-1.5 text-[12.5px] text-ink-3">
              {barsOf(T.id).length
                ? t(tx(`New features on the way here: ${barsOf(T.id).join(", ")}.`, `Neue Merkmale auf dem Weg hierher: ${barsOf(T.id).join(", ")}.`))
                : t(tx("Branched off first: none of the land-plant features.", "Zweigt als Erstes ab: keines der Landpflanzen-Merkmale."))}
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

/** Task picture: the cladogram, one bar asked or one group lit. */
export function DiversityCladogramPicture({ ask, tip }: { ask?: number; tip?: CladeTip }) {
  return <Cladogram ask={ask} tip={tip ?? null} numbersOnly />;
}
