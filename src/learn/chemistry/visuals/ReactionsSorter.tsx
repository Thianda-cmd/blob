"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Shuffle, X } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { createRng } from "@/learn/engine/rng";
import { cn } from "@/lib/utils";

// "Physical change or chemical reaction?" A round of everyday processes to sort. Each card
// says why once you've picked: a new substance or not.

export type Process = {
  what: Text;
  chem: boolean;
  why: Text;
  /** A reaction with fire or a bright glow. */
  fire?: boolean;
  /** A physical change that shows bubbles, light or heat (easy to mistake for a reaction). */
  looks?: boolean;
};

export const PROCESSES: Process[] = [
  { what: tx("Ice melts into water.", "Eis schmilzt zu Wasser."), chem: false, why: tx("Still water: only the state of matter changes.", "Es bleibt Wasser: Nur der Aggregatzustand ändert sich.") },
  { what: tx("Magnesium burns with a dazzling light.", "Magnesium verbrennt mit grellem Licht."), chem: true, why: tx("A white powder forms: magnesium oxide, a new substance.", "Es entsteht ein weißes Pulver: Magnesiumoxid, ein neuer Stoff."), fire: true },
  { what: tx("Sugar dissolves in tea.", "Zucker löst sich in Tee."), chem: false, why: tx("The tea tastes sweet: the sugar is still there, just spread out.", "Der Tee schmeckt süß: Der Zucker ist noch da, nur fein verteilt.") },
  { what: tx("An iron nail rusts.", "Ein Eisennagel rostet."), chem: true, why: tx("Rust is a new substance: brown, crumbly and not shiny like iron.", "Rost ist ein neuer Stoff: braun, bröckelig und nicht glänzend wie Eisen.") },
  { what: tx("Water boils in a kettle.", "Wasser siedet im Wasserkocher."), chem: false, why: tx("The bubbles are water vapour: still water.", "Die Blasen sind Wasserdampf, also immer noch Wasser."), looks: true },
  { what: tx("Bread turns brown in the toaster.", "Brot wird im Toaster braun."), chem: true, why: tx("New substances form that smell and taste different.", "Es entstehen neue Stoffe, die anders riechen und schmecken.") },
  { what: tx("A light bulb glows.", "Eine Glühlampe leuchtet."), chem: false, why: tx("Light and heat, but the wire stays the same metal. Energy alone proves nothing.", "Licht und Wärme, aber der Draht bleibt dasselbe Metall. Energie allein beweist nichts."), looks: true },
  { what: tx("Milk goes sour.", "Milch wird sauer."), chem: true, why: tx("Bacteria turn milk sugar into lactic acid, a new substance.", "Bakterien machen aus Milchzucker Milchsäure, einen neuen Stoff.") },
  { what: tx("Baking powder fizzes in vinegar.", "Backpulver sprudelt in Essig."), chem: true, why: tx("The bubbles are a new gas: carbon dioxide.", "Die Bläschen sind ein neues Gas: Kohlenstoffdioxid.") },
  { what: tx("Candle wax melts.", "Kerzenwachs schmilzt."), chem: false, why: tx("Liquid wax is still wax. Let it cool and it's solid again.", "Flüssiges Wachs ist immer noch Wachs. Abgekühlt wird es wieder fest.") },
  { what: tx("Wood burns in a campfire.", "Holz verbrennt im Lagerfeuer."), chem: true, why: tx("Ash, carbon dioxide and water vapour form: new substances.", "Asche, Kohlenstoffdioxid und Wasserdampf entstehen: neue Stoffe."), fire: true },
  { what: tx("Iron powder and sulfur powder are mixed.", "Eisenpulver und Schwefelpulver werden gemischt."), chem: false, why: tx("Just a mixture: a magnet can still pull the iron out.", "Nur ein Gemisch: Ein Magnet zieht das Eisen wieder heraus.") },
  { what: tx("Iron and sulfur are heated and glow brightly.", "Eisen und Schwefel werden erhitzt und glühen auf."), chem: true, why: tx("Iron sulfide forms, a new substance with new properties.", "Es entsteht Eisensulfid, ein neuer Stoff mit neuen Eigenschaften."), fire: true },
  { what: tx("Steam mists up a cold window.", "Wasserdampf beschlägt eine kalte Scheibe."), chem: false, why: tx("Water vapour condenses to liquid water: still water.", "Wasserdampf kondensiert zu flüssigem Wasser: immer noch Wasser.") },
  { what: tx("A silver spoon turns black.", "Ein Silberlöffel läuft schwarz an."), chem: true, why: tx("The black layer is silver sulfide, a new substance.", "Die schwarze Schicht ist Silbersulfid, ein neuer Stoff.") },
  { what: tx("Paper is cut into pieces.", "Papier wird zerschnitten."), chem: false, why: tx("Smaller pieces, but still paper.", "Kleinere Stücke, aber immer noch Papier.") },
  { what: tx("A copper roof slowly turns green.", "Ein Kupferdach wird langsam grün."), chem: true, why: tx("The green layer (patina) is a new substance made from copper.", "Die grüne Schicht (Patina) ist ein neuer Stoff, der aus dem Kupfer entsteht.") },
  { what: tx("Salt water evaporates and leaves salt crystals.", "Salzwasser verdunstet, Salzkristalle bleiben zurück."), chem: false, why: tx("The water evaporates. The salt was there all along.", "Das Wasser verdunstet. Das Salz war die ganze Zeit schon da.") },
];

const ROUND = 6;

function deal(round: number): number[] {
  const rng = createRng(round * 7477 + 13);
  // Three of each kind, shuffled.
  const chem = rng.shuffle(PROCESSES.map((p, i) => (p.chem ? i : -1)).filter((i) => i >= 0)).slice(0, ROUND / 2);
  const phys = rng.shuffle(PROCESSES.map((p, i) => (p.chem ? -1 : i)).filter((i) => i >= 0)).slice(0, ROUND / 2);
  return rng.shuffle([...chem, ...phys]);
}

export function ReactionsSorter() {
  const t = useText();
  const [round, setRound] = useState(1);
  const [cards, setCards] = useState(() => deal(1));
  const [picks, setPicks] = useState<Record<number, boolean>>({});
  const answered = Object.keys(picks).length;
  const right = cards.filter((i) => i in picks && picks[i] === PROCESSES[i].chem).length;

  const next = () => {
    setRound(round + 1);
    setCards(deal(round + 1));
    setPicks({});
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-ink-2">
          {answered < ROUND
            ? t(tx(`Sort all ${ROUND}: ${answered} done`, `Sortiere alle ${ROUND}: ${answered} geschafft`))
            : t(tx(`${right} of ${ROUND} right`, `${right} von ${ROUND} richtig`))}
        </div>
        <button type="button" onClick={next} className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-2 hover:bg-hover hover:text-ink">
          <Shuffle className="size-3.5" /> {t(tx("New round", "Neue Runde"))}
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {cards.map((i, n) => {
            const pr = PROCESSES[i];
            const picked = picks[i];
            const done = i in picks;
            const ok = done && picked === pr.chem;
            return (
              <motion.div
                key={`${round}-${i}`}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.12 } }}
                transition={{ type: "spring", stiffness: 420, damping: 32, delay: n * 0.03 }}
                className={cn("rounded-xl border bg-surface p-3", !done ? "border-line" : ok ? "border-ok/40 bg-ok/[0.05]" : "border-danger/30 bg-danger/[0.04]")}
              >
                <div className="flex items-start gap-2">
                  <p className="min-h-[2.6em] flex-1 text-[14.5px] leading-snug text-ink">{t(pr.what)}</p>
                  {done && (
                    <motion.span
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 520, damping: 16 }}
                      className={cn("grid size-6 shrink-0 place-items-center rounded-full text-white", ok ? "bg-ok" : "bg-danger")}
                    >
                      {ok ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
                    </motion.span>
                  )}
                </div>
                {!done ? (
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {[false, true].map((chem) => (
                      <button
                        key={String(chem)}
                        type="button"
                        onClick={() => setPicks((p) => ({ ...p, [i]: chem }))}
                        className="h-9 rounded-lg border border-line bg-raised px-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-blob/50 hover:bg-blob-soft/50 hover:text-ink"
                      >
                        {chem ? t(tx("chemical reaction", "chemische Reaktion")) : t(tx("physical change", "physikalischer Vorgang"))}
                      </button>
                    ))}
                  </div>
                ) : (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-1.5 overflow-hidden text-[13px] leading-snug text-ink-2">
                    <span className={cn("font-semibold", pr.chem ? "text-blob-ink" : "text-ink")}>
                      {pr.chem ? t(tx("Chemical reaction.", "Chemische Reaktion.")) : t(tx("Physical change.", "Physikalischer Vorgang."))}
                    </span>{" "}
                    {t(pr.why)}
                  </motion.p>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
