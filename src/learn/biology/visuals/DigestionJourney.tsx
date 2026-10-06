"use client";

// "Follow a bite": a bite of food travels through the digestive tract station by station. The
// organ it is in lights up, and a card says what happens there (depth 2 adds the enzymes and
// how far starch, protein and fat are digested).

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Clock, RotateCcw, Ruler } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { Figure } from "@/learn/biology/Figure";
import { Inline } from "@/learn/components/Rich";
import { cn } from "@/lib/utils";
import { BITE_PATH, DigestiveOrgans, SYSTEM_H, SYSTEM_PARTS, SYSTEM_W, type OrganId } from "./DigestionSystem";

type Nutrient = "starch" | "protein" | "fat";
/** 0 = not yet, 1 = started, 2 = cut into building blocks and absorbed. */
type Progress = 0 | 1 | 2;

type Station = {
  name: Text;
  organs: OrganId[];
  time: Text;
  length?: Text;
  does: Text[];
  /** Depth 2: juices and enzymes at work here. */
  enzymes?: Text[];
  progress: Record<Nutrient, Progress>;
};

const STATIONS: Station[] = [
  {
    name: tx("Mouth", "Mund"),
    organs: ["mouth", "teeth", "saliva"],
    time: tx("seconds to a minute", "Sekunden bis eine Minute"),
    does: [
      tx("The teeth bite off and grind the food.", "Die Zähne beißen ab und zermahlen die Nahrung."),
      tx("Saliva makes it moist and slippery. The tongue shapes a bite and pushes it back to be swallowed.", "Speichel macht sie feucht und gleitfähig. Die Zunge formt einen Bissen und schiebt ihn zum Schlucken nach hinten."),
      tx("**Digestion starts here:** saliva begins to break down starch. Chew bread for a long time and it tastes sweet!", "**Die Verdauung beginnt hier:** Der Speichel beginnt, Stärke zu zerlegen. Kau Brot lange, dann schmeckt es süß!"),
    ],
    enzymes: [tx("**Amylase** (saliva): starch → maltose", "**Amylase** (Speichel): Stärke → Maltose")],
    progress: { starch: 1, protein: 0, fat: 0 },
  },
  {
    name: tx("Oesophagus", "Speiseröhre"),
    organs: ["oesophagus"],
    time: tx("5 to 10 seconds", "5 bis 10 Sekunden"),
    length: tx("about 25 cm", "etwa 25 cm"),
    does: [
      tx("When you swallow, the epiglottis closes the windpipe.", "Beim Schlucken verschließt der Kehldeckel die Luftröhre."),
      tx("Rings of muscle squeeze behind the bite like a wave (peristalsis) and push it down.", "Ringmuskeln ziehen sich hinter dem Bissen wellenartig zusammen (Peristaltik) und schieben ihn nach unten."),
      tx("That's why you can even swallow doing a handstand.", "Darum kannst du sogar im Handstand schlucken."),
    ],
    enzymes: [tx("No juices of its own. The saliva amylase in the bite keeps working.", "Keine eigenen Verdauungssäfte. Die Amylase aus dem Speichel arbeitet im Bissen weiter.")],
    progress: { starch: 1, protein: 0, fat: 0 },
  },
  {
    name: tx("Stomach", "Magen"),
    organs: ["stomach"],
    time: tx("2 to 4 hours", "2 bis 4 Stunden"),
    does: [
      tx("Stomach muscles knead the food into a pulp, the chyme.", "Die Magenmuskeln kneten die Nahrung zu einem Speisebrei."),
      tx("Gastric juice contains **hydrochloric acid**: it kills germs.", "Der Magensaft enthält **Salzsäure**: Sie tötet Keime ab."),
      tx("**Protein digestion** begins. A layer of mucus protects the stomach wall from the acid.", "Die **Eiweißverdauung** beginnt. Eine Schleimschicht schützt die Magenwand vor der Säure."),
      tx("The pylorus (a ring of muscle) lets the chyme into the small intestine bit by bit.", "Der Magenpförtner (ein Ringmuskel) gibt den Brei portionsweise in den Dünndarm ab."),
    ],
    enzymes: [
      tx("**Hydrochloric acid** (pH 1 to 2): kills germs, unfolds proteins, activates pepsin", "**Salzsäure** (pH 1 bis 2): tötet Keime, entfaltet Eiweiße, aktiviert Pepsin"),
      tx("**Pepsin**: protein → peptides (shorter chains)", "**Pepsin**: Eiweiß → Peptide (kürzere Ketten)"),
      tx("The acid stops the saliva amylase.", "Die Säure stoppt die Amylase aus dem Speichel."),
    ],
    progress: { starch: 1, protein: 1, fat: 0 },
  },
  {
    name: tx("Small intestine", "Dünndarm"),
    organs: ["small", "duodenum", "liver", "gallbladder", "pancreas"],
    time: tx("several hours", "mehrere Stunden"),
    length: tx("3 to 5 m", "3 bis 5 m"),
    does: [
      tx("In its first part, the duodenum, **bile** (from the liver and gall bladder) and **pancreatic juice** (from the pancreas) flow in.", "In den ersten Abschnitt, den Zwölffingerdarm, fließen **Galle** (aus Leber und Gallenblase) und **Bauchspeichel** (aus der Bauchspeicheldrüse)."),
      tx("Now all nutrients are cut into their small building blocks.", "Jetzt werden alle Nährstoffe in ihre kleinen Bausteine zerlegt."),
      tx("The building blocks pass through the intestinal wall **into the blood**.", "Die Bausteine gelangen durch die Darmwand **ins Blut**."),
    ],
    enzymes: [
      tx("**Pancreatic juice**: amylase (starch → maltose), trypsin (proteins → peptides), lipase (fat → glycerol + fatty acids), hydrogen carbonate neutralises the acid", "**Bauchspeichel**: Amylase (Stärke → Maltose), Trypsin (Eiweiße → Peptide), Lipase (Fett → Glycerin + Fettsäuren), Hydrogencarbonat neutralisiert die Säure"),
      tx("**Bile** emulsifies fat into tiny droplets. It is **not** an enzyme.", "**Galle** emulgiert Fett zu winzigen Tröpfchen. Sie ist **kein** Enzym."),
      tx("**Enzymes of the gut wall**: maltase (maltose → glucose), peptidases (peptides → amino acids)", "**Enzyme der Darmwand**: Maltase (Maltose → Glucose), Peptidasen (Peptide → Aminosäuren)"),
      tx("**Absorption** through the villi: glucose and amino acids into the blood, fat building blocks into the lymph", "**Resorption** über die Darmzotten: Glucose und Aminosäuren ins Blut, Fettbausteine in die Lymphe"),
    ],
    progress: { starch: 2, protein: 2, fat: 2 },
  },
  {
    name: tx("Large intestine", "Dickdarm"),
    organs: ["large", "appendix"],
    time: tx("about 1 to 2 days", "etwa 1 bis 2 Tage"),
    length: tx("about 1.5 m", "etwa 1,5 m"),
    does: [
      tx("Takes **water** and minerals back from the leftovers: the pulp becomes firm.", "Entzieht den Resten **Wasser** und Mineralstoffe: Der Brei wird fest."),
      tx("Trillions of gut bacteria break down part of the dietary fibre.", "Billionen Darmbakterien bauen einen Teil der Ballaststoffe ab."),
      tx("What can't be digested is left over: faeces.", "Was nicht verdaut werden kann, bleibt übrig: der Kot."),
    ],
    enzymes: [tx("No more digestive enzymes of its own: absorption of water and minerals, gut bacteria at work", "Keine eigenen Verdauungsenzyme mehr: Resorption von Wasser und Mineralstoffen, Darmbakterien bei der Arbeit")],
    progress: { starch: 2, protein: 2, fat: 2 },
  },
  {
    name: tx("Rectum and anus", "Mastdarm und After"),
    organs: ["rectum", "anus"],
    time: tx("until you go to the toilet", "bis zum Toilettengang"),
    does: [
      tx("The faeces collect in the rectum.", "Im Mastdarm sammelt sich der Kot."),
      tx("When it is full, you feel it. The sphincter muscle at the anus opens when you go to the toilet.", "Ist er voll, spürst du das. Der Schließmuskel am After öffnet sich, wenn du zur Toilette gehst."),
      tx("The whole journey takes about 1 to 3 days.", "Die ganze Reise dauert etwa 1 bis 3 Tage."),
    ],
    enzymes: [tx("Excretion: only what the body couldn't use leaves it.", "Ausscheidung: Nur was der Körper nicht verwerten konnte, verlässt ihn.")],
    progress: { starch: 2, protein: 2, fat: 2 },
  },
];

const NUTRIENTS: { id: Nutrient; name: Text }[] = [
  { id: "starch", name: tx("Starch", "Stärke") },
  { id: "protein", name: tx("Protein", "Eiweiß") },
  { id: "fat", name: tx("Fat", "Fett") },
];
const PROGRESS: Text[] = [tx("not yet", "noch nicht"), tx("started", "beginnt"), tx("building blocks, absorbed", "Bausteine, resorbiert")];

/** How the bite looks at each station: food, chyme, then leftovers getting firmer. */
const LOOK = [
  { r: 8, fill: "var(--bio-pollen)" },
  { r: 7, fill: "var(--bio-pollen)" },
  { r: 10, fill: "color-mix(in oklab, var(--bio-pollen) 55%, var(--bio-cell))" },
  { r: 6.5, fill: "color-mix(in oklab, var(--bio-pollen) 45%, var(--bio-soil))" },
  { r: 6.5, fill: "var(--bio-soil)" },
  { r: 6, fill: "var(--bio-wood-deep)" },
];

const stopOf = (i: number) => BITE_PATH[i][BITE_PATH[i].length - 1];

export function DigestionJourney({ depth = 1 }: { depth?: 1 | 2 }) {
  const t = useText();
  const reduce = useReducedMotion();
  const [{ at, from }, setPos] = useState({ at: 0, from: 0 });
  const st = STATIONS[at];
  const go = (i: number) => setPos({ at: Math.max(0, Math.min(STATIONS.length - 1, i)), from: at });

  // Forward by one: glide along the tract. Anything else: hop straight there.
  const along = at === from + 1 && !reduce;
  const pts = along ? [stopOf(from), ...BITE_PATH[at]] : [stopOf(at)];
  const duration = along ? Math.min(2.6, 0.5 + pts.length * 0.16) : 0.35;
  const look = LOOK[at];
  const organs = depth === 1 ? st.organs.filter((o) => o !== "duodenum") : st.organs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t(tx("Stations", "Stationen"))}>
        {STATIONS.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === at}
            onClick={() => go(i)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
              i === at ? "border-transparent bg-blob text-white" : i < at ? "border-line bg-blob-soft text-blob-ink" : "border-line text-ink-2 hover:bg-hover hover:text-ink",
            )}
          >
            <span className="tabular-nums opacity-70">{i + 1}</span>
            {t(s.name)}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
        <div className="mx-auto w-full max-w-[380px]">
          <Figure title={tx("The way of a bite", "Der Weg eines Bissens")} width={SYSTEM_W} height={SYSTEM_H} parts={SYSTEM_PARTS} mode="plain" highlight={organs}>
            <DigestiveOrgans />
            {at === 3 && !reduce && <Absorbing />}
            <motion.circle
              initial={false}
              animate={{ cx: pts.map((p) => p[0]), cy: pts.map((p) => p[1]), r: look.r }}
              transition={{ cx: { duration, ease: "linear" }, cy: { duration, ease: "linear" }, r: { type: "spring", stiffness: 260, damping: 18 } }}
              style={{ fill: look.fill, transition: "fill 0.8s" }}
              stroke="var(--bio-outline)"
              strokeWidth={1.6}
            />
          </Figure>
        </div>

        <div className="min-w-0 space-y-3">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={at} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22 }} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                <h3 className="font-display text-[22px] font-bold leading-tight">
                  <span className="mr-1.5 text-blob-ink tabular-nums">{at + 1}.</span>
                  {t(st.name)}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-hover px-2.5 py-0.5 text-[12.5px] text-ink-2">
                  <Clock className="size-3.5" /> {t(st.time)}
                </span>
                {st.length && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-hover px-2.5 py-0.5 text-[12.5px] text-ink-2">
                    <Ruler className="size-3.5" /> {t(st.length)}
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-[14.5px] leading-relaxed text-ink-2">
                {st.does.map((d, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-blob" />
                    <span>
                      <Inline text={d} />
                    </span>
                  </li>
                ))}
              </ul>
              {depth === 2 && st.enzymes && (
                <div className="space-y-1.5 rounded-xl border border-line bg-surface px-3.5 py-3">
                  <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{t(tx("Juices and enzymes", "Säfte und Enzyme"))}</div>
                  <ul className="space-y-1 text-[13.5px] leading-snug text-ink-2">
                    {st.enzymes.map((e, i) => (
                      <li key={i}>
                        <Inline text={e} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {depth === 2 && (
            <div className="grid grid-cols-3 gap-2">
              {NUTRIENTS.map((n) => {
                const p = st.progress[n.id];
                return (
                  <div key={n.id} className="rounded-xl border border-line px-2.5 py-2">
                    <div className="text-[13px] font-semibold text-ink">{t(n.name)}</div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hover">
                      <motion.div className="h-full rounded-full bg-blob" initial={false} animate={{ width: `${[0, 40, 100][p]}%` }} transition={{ type: "spring", stiffness: 200, damping: 26 }} />
                    </div>
                    <div className="mt-1 text-[11.5px] leading-tight text-ink-3">{t(PROGRESS[p])}</div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => go(at - 1)}
              disabled={at === 0}
              className="flex h-10 items-center gap-1 rounded-xl border border-line px-3 text-[13.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink disabled:opacity-35"
            >
              <ChevronLeft className="size-4" /> {t(tx("Back", "Zurück"))}
            </button>
            {at < STATIONS.length - 1 ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => go(at + 1)}
                className="flex h-10 flex-1 items-center justify-center gap-1 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white sm:flex-none"
              >
                {t(tx("Push the bite on", "Bissen weiterschieben"))} <ChevronRight className="size-4" />
              </motion.button>
            ) : (
              <button type="button" onClick={() => setPos({ at: 0, from: 0 })} className="flex h-10 items-center gap-1.5 rounded-xl bg-blob px-4 text-[14px] font-semibold text-white">
                <RotateCcw className="size-4" /> {t(tx("Take another bite", "Noch ein Bissen"))}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Little building blocks leaving the small intestine (into the blood). */
function Absorbing() {
  const dots = [
    [200, 424],
    [246, 442],
    [270, 460],
    [214, 478],
    [258, 424],
    [230, 496],
  ];
  return (
    <g>
      {dots.map(([x, y], i) => (
        <motion.circle
          key={i}
          cx={x}
          r={2.6}
          fill="var(--bio-blood)"
          initial={{ cy: y, opacity: 0 }}
          animate={{ cy: [y, y - 9], opacity: [0, 1, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.27, ease: "easeOut" }}
        />
      ))}
    </g>
  );
}

export const DigestionJourney1 = () => <DigestionJourney depth={1} />;
export const DigestionJourney2 = () => <DigestionJourney depth={2} />;
