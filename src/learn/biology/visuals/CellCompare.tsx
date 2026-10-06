"use client";

// Plant cell versus animal cell (topic "cell", level 1): switch between the two drawings and
// tap a row of the table to light up that structure. Rows show which cell has it.

import { AnimatePresence, motion } from "motion/react";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { CellAnimalCell } from "./CellAnimalCell";
import { CellPlantCell } from "./CellPlantCell";

const ROWS: { id: string; name: Text; plant: boolean; animal: boolean; note: Text }[] = [
  { id: "wall", name: tx("cell wall", "Zellwand"), plant: true, animal: false, note: tx("Only plant cells have a firm wall of cellulose. Animal cells are soft and can change shape.", "Nur Pflanzenzellen haben eine feste Wand aus Cellulose. Tierzellen sind weich und verformbar.") },
  { id: "membrane", name: tx("cell membrane", "Zellmembran"), plant: true, animal: true, note: tx("Both have one. In the plant cell it lies right under the wall.", "Beide haben eine. In der Pflanzenzelle liegt sie direkt unter der Wand.") },
  { id: "cytoplasm", name: tx("cytoplasm", "Zellplasma"), plant: true, animal: true, note: tx("Both are filled with it.", "Beide sind damit gefüllt.") },
  { id: "nucleus", name: tx("nucleus", "Zellkern"), plant: true, animal: true, note: tx("Both have a nucleus that controls the cell.", "Beide haben einen Zellkern, der die Zelle steuert.") },
  { id: "vacuole", name: tx("large vacuole", "große Vakuole"), plant: true, animal: false, note: tx("A big sap-filled vacuole is typical of plant cells. Animal cells have at most tiny vesicles.", "Eine große Zellsaftvakuole ist typisch für Pflanzenzellen. Tierzellen haben höchstens winzige Bläschen.") },
  { id: "chloroplast", name: tx("chloroplasts", "Chloroplasten"), plant: true, animal: false, note: tx("Only in the green parts of plants. Animals can't do photosynthesis: they have to eat.", "Nur in grünen Pflanzenteilen. Tiere können keine Fotosynthese betreiben: Sie müssen fressen.") },
];

export function CellCompare() {
  const t = useText();
  const [cell, setCell] = useState<"plant" | "animal">("plant");
  const [row, setRow] = useState<string | null>(null);
  const [diff, setDiff] = useState(false);
  const picked = ROWS.find((r) => r.id === row);
  const has = picked ? picked[cell] : true;
  const lit = diff ? ROWS.filter((r) => r.plant !== r.animal).map((r) => r.id) : row ? [row] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(["plant", "animal"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cell === c}
              onClick={() => setCell(c)}
              className={cn("h-9 rounded-lg px-3.5 text-[14px] font-semibold transition-colors", cell === c ? "bg-blob text-white" : "text-ink-2 hover:text-ink")}
            >
              {c === "plant" ? t(tx("Plant cell", "Pflanzenzelle")) : t(tx("Animal cell", "Tierzelle"))}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-pressed={diff}
          onClick={() => {
            setDiff(!diff);
            setRow(null);
          }}
          className={cn("h-9 rounded-lg px-3 text-[13px] font-medium transition-colors", diff ? "bg-blob-soft text-blob-ink" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
        >
          {t(tx("Show the differences", "Unterschiede zeigen"))}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)] lg:items-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={cell} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.2 }}>
            {cell === "plant" ? <CellPlantCell mode="plain" highlight={lit} /> : <CellAnimalCell mode="plain" highlight={lit.filter((id) => ROWS.find((r) => r.id === id)?.animal)} />}
          </motion.div>
        </AnimatePresence>

        <div className="overflow-hidden rounded-xl border border-line">
          <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] bg-surface px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-3">
            <span />
            <span className="text-center">{t(tx("Plant", "Pflanze"))}</span>
            <span className="text-center">{t(tx("Animal", "Tier"))}</span>
          </div>
          {ROWS.map((r) => {
            const on = lit.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setDiff(false);
                  setRow(row === r.id ? null : r.id);
                }}
                onPointerEnter={() => !diff && setRow(r.id)}
                className={cn("grid w-full grid-cols-[minmax(0,1fr)_64px_64px] items-center border-t border-line px-3 py-2 text-left text-[14px] transition-colors", on ? "bg-blob-soft text-ink" : "text-ink-2 hover:bg-hover")}
              >
                <span className="font-medium">{t(r.name)}</span>
                {[r.plant, r.animal].map((yes, i) => (
                  <span key={i} className="grid place-items-center">
                    {yes ? <Check className="size-4 text-ok" aria-label={t(tx("yes", "ja"))} /> : <X className="size-4 text-danger" aria-label={t(tx("no", "nein"))} />}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={diff ? "diff" : `${cell}-${row ?? "none"}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="min-h-[3rem] rounded-xl bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2"
          aria-live="polite"
        >
          {diff
            ? t(tx("Only the plant cell has these three: cell wall, large vacuole and chloroplasts.", "Diese drei hat nur die Pflanzenzelle: Zellwand, große Vakuole und Chloroplasten."))
            : picked
              ? `${t(picked.name)}: ${has ? "" : t(cell === "animal" ? tx("not in the animal cell. ", "nicht in der Tierzelle. ") : tx("not in the plant cell. ", "nicht in der Pflanzenzelle. "))}${t(picked.note)}`
              : t(tx("Tap a row to find the structure in the drawing.", "Tipp auf eine Zeile, um den Bestandteil in der Zeichnung zu finden."))}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
