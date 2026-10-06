"use client";

// Secondary growth to play with: let a young stem grow year by year. The cambium closes into
// a ring and adds a new annual ring every year; dry years give narrow rings. A monocot stem
// (maize) has no cambium and doesn't grow thicker.

import { CloudSun, Droplets } from "lucide-react";
import { useState } from "react";
import { tx } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useLocale } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { PlantStemPrimary, PlantStemSection } from "./PlantStem";
import { PlantNote, PlantSeg, PlantSlider } from "./PlantUi";

/** Ring widths: a little narrower each year, much narrower in a dry year. */
export const ringWidths = (dry: boolean[]) => dry.map((d, i) => (d ? 0.42 : 1) * (1.15 - 0.045 * i));

export function PlantRings() {
  const t = useText();
  const locale = useLocale();
  const [kind, setKind] = useState<"dicot" | "monocot">("dicot");
  const [years, setYears] = useState(0);
  const [dry, setDry] = useState<boolean[]>([false, false, false, true, false, false, false, true, false, false]);
  const widths = ringWidths(dry.slice(0, years));
  const narrow = dry.slice(0, years).filter(Boolean).length;
  const note =
    kind === "monocot"
      ? tx(
          "Monocots like maize have scattered, closed bundles without cambium. So there is no secondary growth and there are no annual rings, however old the plant gets.",
          "Einkeimblättrige wie Mais haben zerstreute, geschlossene Leitbündel ohne Kambium. Darum gibt es kein sekundäres Dickenwachstum und keine Jahresringe, egal wie alt die Pflanze wird.",
        )
      : years === 0
        ? tx(
            "A young dicot stem: the vascular bundles form a ring. Between xylem and phloem lies the cambium. Move the slider to let the stem grow.",
            "Ein junger Spross einer Zweikeimblättrigen: Die Leitbündel liegen im Kreis. Zwischen Xylem und Phloem liegt das Kambium. Schieb den Regler und lass den Spross wachsen.",
          )
        : years === 1
          ? tx(
              "Cambium also forms between the bundles and closes into a ring. It makes new wood (secondary xylem) inwards and new bast (secondary phloem) outwards: the first annual ring.",
              "Auch zwischen den Leitbündeln entsteht Kambium und schließt sich zum Ring. Es bildet nach innen neues Holz (sekundäres Xylem) und nach außen neuen Bast (sekundäres Phloem): der erste Jahresring.",
            )
          : tx(
              `${years} annual rings: the stem is ${years} years old. Each ring = light early wood (spring) + dark late wood (summer). ${narrow ? `The ${narrow} narrow ring${narrow > 1 ? "s" : ""} show${narrow > 1 ? "" : "s"} dry years.` : "Tap a year to make it dry."}`,
              `${years} Jahresringe: Der Stamm ist ${years} Jahre alt. Jeder Ring = helles Frühholz (Frühjahr) + dunkles Spätholz (Sommer). ${narrow ? `${narrow === 1 ? "Der schmale Ring zeigt ein trockenes Jahr." : `Die ${narrow} schmalen Ringe zeigen trockene Jahre.`}` : "Tipp auf ein Jahr, um es trocken zu machen."}`,
            );
  return (
    <div className="space-y-4">
      <PlantSeg
        label={t(tx("Plant", "Pflanze"))}
        value={kind}
        onChange={setKind}
        options={[
          { id: "dicot", label: t(tx("Dicot (lime tree)", "Zweikeimblättrig (Linde)")) },
          { id: "monocot", label: t(tx("Monocot (maize)", "Einkeimblättrig (Mais)")) },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-start">
        <PlantSlider label={t(tx("Age", "Alter"))} value={years} min={0} max={10} onChange={setYears} valueText={t(tx(`${years} year${years === 1 ? "" : "s"}`, `${years} ${years === 1 ? "Jahr" : "Jahre"}`))} />
        {kind === "dicot" && years > 0 && (
          <div className="space-y-2">
            <div className="text-[12.5px] font-semibold text-ink-2">{t(tx("Weather in each year (tap to change)", "Wetter in jedem Jahr (zum Ändern tippen)"))}</div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: years }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={dry[i]}
                  aria-label={t(tx(`Year ${i + 1}: ${dry[i] ? "dry" : "good"}`, `Jahr ${i + 1}: ${dry[i] ? "trocken" : "gut"}`))}
                  onClick={() => setDry(dry.map((d, k) => (k === i ? !d : d)))}
                  className={cn("flex h-9 items-center gap-1 rounded-lg border px-2 text-[13px] font-semibold transition-colors", dry[i] ? "text-ink" : "border-line bg-raised text-ink-2 hover:bg-hover")}
                  style={dry[i] ? { borderColor: "var(--bio-sun)", background: "color-mix(in oklab, var(--bio-sun) 25%, transparent)" } : undefined}
                >
                  {dry[i] ? <CloudSun className="size-3.5" /> : <Droplets className="size-3.5" />}
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {kind === "monocot" ? (
        <PlantStemPrimary kind="monocot" mode="explore" />
      ) : years === 0 ? (
        <PlantStemPrimary kind="dicot" mode="explore" />
      ) : (
        <PlantStemSection widths={widths} fit={false} unit={12.5} mode="explore" />
      )}
      <PlantNote id={`${kind}-${years}-${narrow}-${locale}`}>{t(note)}</PlantNote>
    </div>
  );
}
