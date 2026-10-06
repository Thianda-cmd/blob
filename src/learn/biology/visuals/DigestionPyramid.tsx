"use client";

// Plan a day with the food pyramid (as in the German BZfE pyramid: 22 portions a day).
// Tap foods; each one fills a block in its row. Green rows: plenty, yellow: moderately,
// red: sparingly. Blob's tips show what is still missing or too much.

import { AnimatePresence, motion } from "motion/react";
import { Apple, Beef, Candy, Carrot, Check, Droplet, GlassWater, Milk, RotateCcw, Undo2, Wheat, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { cn } from "@/lib/utils";

export type FoodGroup = "drinks" | "veg" | "fruit" | "grains" | "dairy" | "meat" | "fats" | "extras";

export const GROUPS: Record<FoodGroup, { name: Text; target: number; tone: "green" | "yellow" | "red"; icon: LucideIcon }> = {
  drinks: { name: tx("Drinks", "Getränke"), target: 6, tone: "green", icon: GlassWater },
  veg: { name: tx("Vegetables and salad", "Gemüse und Salat"), target: 3, tone: "green", icon: Carrot },
  fruit: { name: tx("Fruit", "Obst"), target: 2, tone: "green", icon: Apple },
  grains: { name: tx("Bread, cereals, potatoes, pasta, rice", "Brot, Getreide, Kartoffeln, Nudeln, Reis"), target: 4, tone: "green", icon: Wheat },
  dairy: { name: tx("Milk and dairy products", "Milch und Milchprodukte"), target: 3, tone: "yellow", icon: Milk },
  meat: { name: tx("Meat, sausage, fish or egg", "Fleisch, Wurst, Fisch oder Ei"), target: 1, tone: "yellow", icon: Beef },
  fats: { name: tx("Oils and fats", "Öle und Fette"), target: 2, tone: "yellow", icon: Droplet },
  extras: { name: tx("Extras: sweets, snacks, soft drinks", "Extras: Süßes, Knabberzeug, Limo"), target: 1, tone: "red", icon: Candy },
};

/** Rows from the top of the pyramid down. */
const ROWS: FoodGroup[][] = [["extras"], ["fats"], ["dairy", "meat"], ["grains"], ["veg", "fruit"], ["drinks"]];

const FOODS: { name: Text; group: FoodGroup }[] = [
  { name: tx("Water", "Wasser"), group: "drinks" },
  { name: tx("Herbal tea", "Kräutertee"), group: "drinks" },
  { name: tx("Carrot", "Möhre"), group: "veg" },
  { name: tx("Salad", "Salat"), group: "veg" },
  { name: tx("Apple", "Apfel"), group: "fruit" },
  { name: tx("Banana", "Banane"), group: "fruit" },
  { name: tx("Wholemeal bread", "Vollkornbrot"), group: "grains" },
  { name: tx("Pasta", "Nudeln"), group: "grains" },
  { name: tx("Potatoes", "Kartoffeln"), group: "grains" },
  { name: tx("Milk", "Milch"), group: "dairy" },
  { name: tx("Cheese", "Käse"), group: "dairy" },
  { name: tx("Yoghurt", "Joghurt"), group: "dairy" },
  { name: tx("Fish", "Fisch"), group: "meat" },
  { name: tx("Egg", "Ei"), group: "meat" },
  { name: tx("Sausage", "Wurst"), group: "meat" },
  { name: tx("Rapeseed oil", "Rapsöl"), group: "fats" },
  { name: tx("Butter", "Butter"), group: "fats" },
  { name: tx("Gummy bears", "Gummibärchen"), group: "extras" },
  { name: tx("Crisps", "Chips"), group: "extras" },
  { name: tx("Lemonade", "Limonade"), group: "extras" },
];

const TONE = {
  green: "var(--bio-leaf)",
  yellow: "var(--bio-sun)",
  red: "var(--bio-blood)",
};

const EMPTY: Record<FoodGroup, number> = { drinks: 0, veg: 0, fruit: 0, grains: 0, dairy: 0, meat: 0, fats: 0, extras: 0 };

function tips(c: Record<FoodGroup, number>): Text[] {
  const out: Text[] = [];
  if (c.extras > 1) out.push(tx("Lots of extras! Sweets and snacks only now and then: one portion a day at most.", "Ganz schön viele Extras! Süßes und Knabberzeug nur ab und zu: höchstens eine Portion am Tag."));
  if (c.meat > 1) out.push(tx("One portion of meat, sausage, fish or egg a day is enough.", "Eine Portion Fleisch, Wurst, Fisch oder Ei am Tag reicht."));
  if (c.fats > 2) out.push(tx("Go easy on fats: about two portions a day, best are plant oils.", "Fett sparsam: etwa zwei Portionen am Tag, am besten Pflanzenöle."));
  if (c.drinks < 6) out.push(tx(`Drink more: ${6 - c.drinks} more glasses of water or unsweetened tea.`, `Trink mehr: noch ${6 - c.drinks} Gläser Wasser oder ungesüßten Tee.`));
  if (c.veg + c.fruit < 5) out.push(tx("More vegetables and fruit! Five portions a day: three of vegetables, two of fruit.", "Mehr Gemüse und Obst! Fünf Portionen am Tag: drei Gemüse, zwei Obst."));
  if (c.grains < 4) out.push(tx("Bread, potatoes, pasta or rice fill you up and give energy: four portions a day, ideally wholemeal.", "Brot, Kartoffeln, Nudeln oder Reis machen satt und liefern Energie: vier Portionen am Tag, am besten Vollkorn."));
  if (c.dairy < 3) out.push(tx("Milk, yoghurt or cheese bring calcium for bones and teeth.", "Milch, Joghurt oder Käse bringen Calcium für Knochen und Zähne."));
  return out;
}

export function DigestionPyramid() {
  const t = useText();
  const [log, setLog] = useState<FoodGroup[]>([]);
  const counts = log.reduce((c, g) => ({ ...c, [g]: c[g] + 1 }), EMPTY);
  const advice = tips(counts);
  const balanced = log.length > 0 && advice.length === 0;
  const total = log.length;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
        {/* the pyramid */}
        <div className="flex flex-col items-center gap-1.5" aria-label={t(tx("Food pyramid", "Ernährungspyramide"))}>
          {ROWS.map((row, r) => (
            <div key={r} className="flex items-center gap-1.5">
              {row.flatMap((g) =>
                Array.from({ length: GROUPS[g].target }, (_, i) => {
                  const filled = i < counts[g];
                  const Icon = GROUPS[g].icon;
                  return (
                    <div key={`${g}${i}`} className="relative size-[34px] sm:size-[40px]" title={t(GROUPS[g].name)}>
                      <div className="absolute inset-0 rounded-lg border-[1.5px] border-dashed" style={{ borderColor: `color-mix(in oklab, ${TONE[GROUPS[g].tone]} 70%, var(--line-2))` }} />
                      <AnimatePresence>
                        {filled && (
                          <motion.div
                            initial={{ scale: 0.3, opacity: 0, y: -14 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.3, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 520, damping: 24 }}
                            className="absolute inset-0 grid place-items-center rounded-lg"
                            style={{ background: TONE[GROUPS[g].tone] }}
                          >
                            <Icon className="size-4 text-[var(--bio-outline)] sm:size-[18px]" strokeWidth={2.2} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                }),
              )}
              {row.some((g) => counts[g] > GROUPS[g].target) && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="ml-1 rounded-full bg-danger px-2 py-0.5 text-[11.5px] font-bold text-white tabular-nums">
                  +{row.reduce((s, g) => s + Math.max(0, counts[g] - GROUPS[g].target), 0)}
                </motion.span>
              )}
            </div>
          ))}
          <div className="mt-2 text-[12.5px] text-ink-3 tabular-nums">
            {t(tx(`${total} of 22 portions`, `${total} von 22 Portionen`))}
          </div>
        </div>

        {/* Blob's verdict */}
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1.5 text-[11.5px] text-ink-3">
            {(["green", "yellow", "red"] as const).map((tone) => (
              <span key={tone} className="flex items-center gap-1.5">
                <span className="size-3 shrink-0 rounded" style={{ background: TONE[tone] }} />
                {t(tone === "green" ? tx("plenty", "reichlich") : tone === "yellow" ? tx("moderately", "mäßig") : tx("sparingly", "sparsam"))}
              </span>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={balanced ? "ok" : (advice[0] && t(advice[0])) || "start"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn("rounded-xl px-3.5 py-3 text-[14px] leading-relaxed", balanced ? "border border-ok/30 bg-ok/[0.07] text-ink" : "bg-surface text-ink-2")}
            >
              {balanced ? (
                <span className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-ok" strokeWidth={3} />
                  {t(tx("A balanced day! Lots from the green rows, a little from the yellow ones, the red one only as a treat.", "Ein ausgewogener Tag! Viel aus den grünen Reihen, etwas aus den gelben, die rote nur als kleiner Genuss."))}
                </span>
              ) : total === 0 ? (
                t(tx("Plan a day: tap what you eat and drink. Each block is one portion, about a handful.", "Plane einen Tag: Tipp an, was du isst und trinkst. Jeder Baustein ist eine Portion, etwa eine Handvoll."))
              ) : (
                <ul className="space-y-1">
                  {advice.slice(0, 2).map((a, i) => (
                    <li key={i}>{t(a)}</li>
                  ))}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FOODS.map((f) => {
          const Icon = GROUPS[f.group].icon;
          return (
            <motion.button
              key={t(f.name)}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => setLog((l) => (l.length < 40 ? [...l, f.group] : l))}
              className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised pl-1.5 pr-3 text-[13px] font-medium text-ink transition-colors hover:border-blob/50 hover:bg-blob-soft/40"
            >
              <span className="grid size-6 place-items-center rounded-full" style={{ background: TONE[GROUPS[f.group].tone] }}>
                <Icon className="size-3.5 text-[var(--bio-outline)]" strokeWidth={2.2} />
              </span>
              {t(f.name)}
            </motion.button>
          );
        })}
      </div>

      <div className="flex justify-end gap-1">
        <button type="button" onClick={() => setLog((l) => l.slice(0, -1))} disabled={!log.length} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
          <Undo2 className="size-3.5" /> {t(tx("Undo", "Rückgängig"))}
        </button>
        <button type="button" onClick={() => setLog([])} disabled={!log.length} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-35">
          <RotateCcw className="size-3.5" /> {t(tx("Start again", "Von vorn"))}
        </button>
      </div>
    </div>
  );
}
