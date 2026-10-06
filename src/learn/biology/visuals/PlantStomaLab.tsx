"use client";

// How guard cells open and close the stoma, step by step: light drives the proton pump, K⁺
// flows in, water follows by osmosis, the turgor rises and the cells bend apart. In drought,
// abscisic acid (ABA) makes K⁺ and water leave again and the pore closes.

import { animate } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { useLocale } from "@/i18n/client";
import { cn } from "@/lib/utils";
import { PlantStoma } from "./PlantStoma";
import { PlantMeter, PlantNote, PlantSeg } from "./PlantUi";

type Stage = { open: number; ions: number; water?: "in" | "out"; pump?: boolean; aba?: boolean; text: Text };

const OPENING: Stage[] = [
  { open: 0, ions: 0.15, text: tx("Darkness: the pore is closed. Few K⁺ ions in the guard cells, low turgor.", "Dunkelheit: Der Spalt ist geschlossen. Wenig K⁺-Ionen in den Schließzellen, niedriger Turgor.") },
  { open: 0, ions: 0.15, pump: true, text: tx("Light (especially blue light) switches on the proton pump: using ATP, it pumps H⁺ ions out of the guard cells.", "Licht (vor allem Blaulicht) schaltet die Protonenpumpe ein: Sie pumpt unter ATP-Verbrauch H⁺-Ionen aus den Schließzellen.") },
  { open: 0.08, ions: 1, pump: true, text: tx("The inside of the membrane becomes more negative: K⁺ channels open and K⁺ ions flow in from the neighbouring cells (with Cl⁻; malate is made from starch).", "Die Membran wird innen negativer: K⁺-Kanäle öffnen sich, K⁺-Ionen strömen aus den Nachbarzellen ein (dazu Cl⁻, aus Stärke wird Malat gebildet).") },
  { open: 0.45, ions: 1, water: "in", text: tx("More dissolved particles in the vacuole: the osmotic value rises, so water flows in from the neighbouring cells by osmosis.", "Mehr gelöste Teilchen in der Vakuole: Der osmotische Wert steigt, also strömt Wasser durch Osmose aus den Nachbarzellen nach.") },
  { open: 1, ions: 1, text: tx("The turgor rises. The wall along the pore is thicker and less stretchy, so the swelling guard cells bend outwards: the pore opens. Carbon dioxide can enter.", "Der Turgor steigt. Die Wand am Spalt ist dicker und weniger dehnbar, darum krümmen sich die anschwellenden Schließzellen nach außen: Der Spalt öffnet sich. Kohlenstoffdioxid kann hinein.") },
];
const CLOSING: Stage[] = [
  { open: 1, ions: 1, text: tx("Daytime, enough water: the pore is open, the guard cells are full (high turgor).", "Tag, genug Wasser: Der Spalt ist offen, die Schließzellen sind prall (hoher Turgor).") },
  { open: 1, ions: 1, aba: true, text: tx("Water shortage: roots and leaves make the stress hormone abscisic acid (ABA). It binds to receptors on the guard cells.", "Wassermangel: Wurzeln und Blätter bilden das Stresshormon Abscisinsäure (ABA). Es bindet an Rezeptoren der Schließzellen.") },
  { open: 0.9, ions: 0.15, aba: true, text: tx("Ion channels open: K⁺ ions (and anions) flow out of the guard cells.", "Ionenkanäle öffnen sich: K⁺-Ionen (und Anionen) strömen aus den Schließzellen hinaus.") },
  { open: 0.45, ions: 0.15, aba: true, water: "out", text: tx("Fewer dissolved particles: water now flows out of the guard cells by osmosis.", "Weniger gelöste Teilchen: Jetzt strömt Wasser durch Osmose aus den Schließzellen heraus.") },
  { open: 0, ions: 0.15, aba: true, text: tx("The turgor drops, the guard cells go slack: the pore closes. The plant saves water, but it can no longer take in carbon dioxide.", "Der Turgor sinkt, die Schließzellen erschlaffen: Der Spalt schließt sich. Die Pflanze spart Wasser, kann aber kein Kohlenstoffdioxid mehr aufnehmen.") },
];

export function PlantStomaLab() {
  const t = useText();
  const locale = useLocale();
  const [mode, setMode] = useState<"open" | "close">("open");
  const [step, setStep] = useState(0);
  const ctrl = useRef<ReturnType<typeof animate> | null>(null);
  useEffect(() => () => ctrl.current?.stop(), []);
  const stages = mode === "open" ? OPENING : CLOSING;
  const s = stages[step];
  const go = (n: number) => {
    ctrl.current?.stop();
    setStep(Math.max(0, Math.min(stages.length - 1, n)));
  };
  const play = () => {
    ctrl.current?.stop();
    setStep(0);
    ctrl.current = animate(0, stages.length - 0.01, { duration: 7.5, ease: "linear", onUpdate: (v) => setStep(Math.floor(v)) });
  };
  return (
    <div className="space-y-4">
      <PlantSeg
        label={t(tx("Process", "Vorgang"))}
        value={mode}
        onChange={(m) => {
          ctrl.current?.stop();
          setMode(m);
          setStep(0);
        }}
        options={[
          { id: "open", label: t(tx("Opening in light", "Öffnen bei Licht")) },
          { id: "close", label: t(tx("Closing in drought", "Schließen bei Trockenheit")) },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)] md:items-center">
        <div>
          <PlantStoma mode="plain" open={s.open} ions={s.ions} water={s.water ?? null} pump={s.pump} aba={s.aba} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border" style={{ background: "var(--bio-nerve)", borderColor: "var(--bio-nerve-deep)" }} /> {t(tx("K⁺ ions", "K⁺-Ionen"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: "var(--bio-water-deep)" }} /> {t(tx("water", "Wasser"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded" style={{ background: "var(--bio-blood)" }} /> {t(tx("H⁺ pumped out", "H⁺ hinausgepumpt"))}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-5 rounded-full border" style={{ background: "var(--bio-nucleus)", borderColor: "var(--bio-nucleus-deep)" }} /> {t(tx("abscisic acid", "Abscisinsäure"))}
            </span>
          </div>
        </div>
        <div className="space-y-3">
          <PlantMeter label={t(tx("K⁺ in the guard cells", "K⁺ in den Schließzellen"))} value={s.ions} valueText={s.ions > 0.5 ? t(tx("high", "hoch")) : t(tx("low", "niedrig"))} color="var(--bio-nerve)" />
          <PlantMeter label={t(tx("Turgor", "Turgor"))} value={0.12 + 0.88 * s.open} valueText={s.open > 0.7 ? t(tx("high", "hoch")) : s.open > 0.2 ? t(tx("medium", "mittel")) : t(tx("low", "niedrig"))} color="var(--bio-water)" />
          <PlantMeter label={t(tx("Pore", "Spalt"))} value={s.open} valueText={s.open > 0.7 ? t(tx("open", "offen")) : s.open > 0.05 ? t(tx("half open", "halb offen")) : t(tx("closed", "geschlossen"))} color="var(--blob)" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go(step - 1)} disabled={step === 0} aria-label={t(tx("Previous step", "Vorheriger Schritt"))} className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 hover:bg-hover disabled:opacity-40">
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex gap-1.5">
          {stages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={t(tx(`Step ${i + 1}`, `Schritt ${i + 1}`))}
              className={cn("grid size-8 place-items-center rounded-lg text-[13px] font-bold transition-colors", i === step ? "bg-blob text-white" : i < step ? "bg-blob-soft text-blob-ink" : "border border-line text-ink-3 hover:bg-hover")}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => go(step + 1)} disabled={step === stages.length - 1} aria-label={t(tx("Next step", "Nächster Schritt"))} className="grid size-10 place-items-center rounded-xl border border-line text-ink-2 hover:bg-hover disabled:opacity-40">
          <ChevronRight className="size-4" />
        </button>
        <button type="button" onClick={play} className="ml-auto flex h-10 items-center gap-2 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white active:scale-[0.97]">
          <Play className="size-4" /> {t(tx("Play", "Abspielen"))}
        </button>
      </div>
      <PlantNote id={`${mode}-${step}-${locale}`} tone={step === stages.length - 1 ? "good" : "plain"}>
        <span className="mr-1.5 font-semibold text-ink">{step + 1}.</span>
        {t(s.text)}
      </PlantNote>
    </div>
  );
}
