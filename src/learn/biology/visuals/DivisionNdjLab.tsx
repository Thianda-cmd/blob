"use client";

// Nondisjunction and what it looks like in a karyogram: a meiosis with a separation error,
// and karyograms of the classic numerical chromosome aberrations.

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";
import { DivisionKaryogram, type Karyotype } from "./DivisionKaryogram";
import { DivisionScrubber } from "./DivisionScrubber";

export const KARYO_INFO: Record<Karyotype, { name: Text; say: Text }> = {
  "46,XX": { name: tx("Normal (female)", "Normal (weiblich)"), say: tx("Normal karyotype of a woman: 22 pairs of autosomes and two X chromosomes.", "Normaler Karyotyp einer Frau: 22 Autosomenpaare und zwei X-Chromosomen.") },
  "46,XY": { name: tx("Normal (male)", "Normal (männlich)"), say: tx("Normal karyotype of a man: 22 pairs of autosomes, one X and one Y chromosome.", "Normaler Karyotyp eines Mannes: 22 Autosomenpaare, ein X- und ein Y-Chromosom.") },
  "47,XX,+21": { name: tx("Trisomy 21", "Trisomie 21"), say: tx("Down syndrome: chromosome 21 is there three times. The most common trisomy at birth (about 1 in 700).", "Down-Syndrom: Chromosom 21 liegt dreimal vor. Die häufigste Trisomie bei Geburt (etwa 1 von 700).") },
  "47,XY,+21": { name: tx("Trisomy 21", "Trisomie 21"), say: tx("Down syndrome: chromosome 21 is there three times. The risk rises with the mother's age.", "Down-Syndrom: Chromosom 21 liegt dreimal vor. Das Risiko steigt mit dem Alter der Mutter.") },
  "47,XY,+18": { name: tx("Trisomy 18", "Trisomie 18"), say: tx("Edwards syndrome: severe malformations; most children die in their first year.", "Edwards-Syndrom: schwere Fehlbildungen, die meisten Kinder sterben im ersten Lebensjahr.") },
  "47,XX,+13": { name: tx("Trisomy 13", "Trisomie 13"), say: tx("Patau syndrome: severe malformations, very short life expectancy.", "Pätau-Syndrom: schwere Fehlbildungen, sehr geringe Lebenserwartung.") },
  "45,X": { name: tx("Turner syndrome", "Turner-Syndrom"), say: tx("Only one X chromosome (45,X, often written 45,X0). Women, mostly short and infertile. The only monosomy people survive.", "Nur ein X-Chromosom (45,X, oft 45,X0 geschrieben). Frauen, meist kleinwüchsig und unfruchtbar. Die einzige lebensfähige Monosomie.") },
  "47,XXY": { name: tx("Klinefelter syndrome", "Klinefelter-Syndrom"), say: tx("Men with an extra X chromosome, often tall and infertile.", "Männer mit einem zusätzlichen X-Chromosom, oft groß und unfruchtbar.") },
  "47,XXX": { name: tx("Triple X syndrome", "Triple-X-Syndrom"), say: tx("Women with three X chromosomes, usually without obvious symptoms.", "Frauen mit drei X-Chromosomen, meist ohne auffällige Symptome.") },
  "47,XYY": { name: tx("XYY syndrome", "XYY-Syndrom"), say: tx("Men with an extra Y chromosome, often tall, usually without other symptoms.", "Männer mit einem zusätzlichen Y-Chromosom, oft groß, meist sonst unauffällig.") },
};

const SHOWN: Karyotype[] = ["46,XY", "47,XY,+21", "45,X", "47,XXY", "47,XX,+13"];

export function DivisionNdjLab() {
  const t = useText();
  const [tab, setTab] = useState<"meiosis" | "karyo">("meiosis");
  const [k, setK] = useState<Karyotype>("47,XY,+21");
  const [mark, setMark] = useState(false);
  const tabBtn = (id: typeof tab, label: Text) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={cn("h-9 rounded-lg px-3.5 text-[13.5px] font-semibold transition-colors", tab === id ? "bg-blob text-white" : "text-ink-2 hover:bg-hover hover:text-ink")}
    >
      {t(label)}
    </button>
  );
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-line p-1" role="tablist">
        {tabBtn("meiosis", tx("Error in meiosis", "Fehler in der Meiose"))}
        {tabBtn("karyo", tx("Karyograms", "Karyogramme"))}
      </div>
      {tab === "meiosis" ? (
        <DivisionScrubber kind="meiosis" depth={3} crossing={false} allowErrors initialVariant="ndj1" start={3} />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {SHOWN.map((x) => (
              <button
                key={x}
                type="button"
                aria-pressed={k === x}
                onClick={() => setK(x)}
                className={cn("h-9 rounded-lg px-3 font-math text-[14px] transition-colors", k === x ? "bg-blob text-white" : "border border-line text-ink-2 hover:bg-hover hover:text-ink")}
              >
                {x}
              </button>
            ))}
          </div>
          <div className="rounded-xl bg-surface p-2">
            <DivisionKaryogram karyotype={k} mark={mark} />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[14px] text-ink">
            <input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} className="size-4 accent-blob" />
            {t(tx("Mark what is unusual", "Auffälligkeit markieren"))}
          </label>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={k} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">{t(KARYO_INFO[k].name)}</span> ({k}): {t(KARYO_INFO[k].say)}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
