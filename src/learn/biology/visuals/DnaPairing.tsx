"use client";

import { AnimatePresence, motion } from "motion/react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { BASE_NAME, HBONDS, PAIR } from "@/learn/biology/topics/dna/data";
import { cn } from "@/lib/utils";
import { BASE_COLOR, BaseTile, baseTint, StepButton } from "./DnaKit";

const STARTS = ["TACGGATC", "GATTCGCA", "CCTAGTAG", "ATGCGTTA", "TGACCATG", "AGCTTCGA"];
const TILE = 36;

/** Build the complementary strand: tap (or type) the base that pairs with the next one. */
export function DnaPairing({ hbonds = false, ends = false }: { hbonds?: boolean; ends?: boolean }) {
  const t = useText();
  const [template, setTemplate] = useState(STARTS[0]);
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<{ at: number; base: string; n: number } | null>(null);
  const done = placed.length === template.length;
  const at = placed.length;

  const pick = (b: string) => {
    if (done) return;
    const want = PAIR[template[at]];
    if (b === want) {
      setPlaced([...placed, b]);
      setWrong(null);
    } else setWrong({ at, base: b, n: (wrong?.n ?? 0) + 1 });
  };

  const fresh = () => {
    let next = template;
    // A new strand to pair (Math.random is fine in an event handler).
    while (next === template) next = STARTS[Math.floor(Math.random() * STARTS.length)];
    setTemplate(next);
    setPlaced([]);
    setWrong(null);
  };

  const note: Text | null = wrong
    ? wrong.base === template[wrong.at]
      ? tx(`${wrong.base} doesn't pair with itself. Look for its partner.`, `${wrong.base} paart nicht mit sich selbst. Such seinen Partner.`)
      : tx(
          `${wrong.base} doesn't fit opposite ${template[wrong.at]}. Remember: A–T and G–C.`,
          `${wrong.base} passt nicht gegenüber von ${template[wrong.at]}. Denk dran: A–T und G–C.`,
        )
    : done
      ? hbonds
        ? tx(
            `Done! Count the hydrogen bonds: ${[...template].reduce((s, b) => s + HBONDS[b], 0)} in total. G–C pairs hold tighter (3) than A–T pairs (2).`,
            `Fertig! Zähl die Wasserstoffbrücken: insgesamt ${[...template].reduce((s, b) => s + HBONDS[b], 0)}. G–C-Paare halten fester (3) als A–T-Paare (2).`,
          )
        : tx("Done! Every base found its partner. The two strands are complementary.", "Fertig! Jede Base hat ihren Partner gefunden. Die beiden Stränge sind komplementär.")
      : null;

  return (
    <div
      className="space-y-4 outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        const k = e.key.toUpperCase();
        if (["A", "T", "G", "C"].includes(k)) {
          e.preventDefault();
          pick(k);
        }
      }}
      aria-label={t(tx("Base pairing: type A, T, G or C", "Basenpaarung: tippe A, T, G oder C"))}
    >
      <div className="overflow-x-auto pb-1">
        <div className="mx-auto w-max">
          <div className="flex items-center gap-1">
            {ends && <span className="w-6 text-center text-[13px] font-semibold text-ink-3">5′</span>}
            {[...template].map((b, i) => (
              <BaseTile key={`${template}-${i}`} base={b} size={TILE} ring={i === at && !done} />
            ))}
            {ends && <span className="w-6 text-center text-[13px] font-semibold text-ink-3">3′</span>}
          </div>
          {/* bonds between the strands */}
          <div className="flex items-center gap-1">
            {ends && <span className="w-6" />}
            {[...template].map((b, i) => (
              <span key={`${template}-bond-${i}`} className="flex h-6 items-center justify-center gap-[3px]" style={{ width: TILE }}>
                {i < at &&
                  (hbonds ? (
                    Array.from({ length: HBONDS[b] }, (_, k) => (
                      <motion.span
                        key={k}
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ delay: 0.05 * k }}
                        className="h-5 w-[2px] rounded-full"
                        style={{ background: "repeating-linear-gradient(to bottom, var(--ink-2) 0 3px, transparent 3px 5px)" }}
                      />
                    ))
                  ) : (
                    <motion.span initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} className="h-5 w-[3px] rounded-full bg-ink-3" />
                  ))}
              </span>
            ))}
            {ends && <span className="w-6" />}
          </div>
          <div className="flex items-center gap-1">
            {ends && <span className="w-6 text-center text-[13px] font-semibold text-ink-3">3′</span>}
            {[...template].map((_, i) => (
              <span key={`${template}-slot-${i}`} className="relative grid place-items-center" style={{ width: TILE, height: TILE }}>
                <span className={cn("absolute inset-0 rounded-md border-2 border-dashed", i === at && !done ? "border-blob" : "border-line-2")} />
                <AnimatePresence>
                  {i < at && (
                    <motion.span key="b" initial={{ y: 26, scale: 0.4, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 25 }} className="relative">
                      <BaseTile base={placed[i]} size={TILE} />
                    </motion.span>
                  )}
                  {wrong && wrong.at === i && i === at && (
                    <motion.span
                      key={`w${wrong.n}`}
                      initial={{ x: 0, opacity: 1 }}
                      animate={{ x: [0, -6, 6, -4, 4, 0], opacity: [1, 1, 1, 1, 1, 0] }}
                      transition={{ duration: 0.6 }}
                      className="absolute"
                    >
                      <BaseTile base={wrong.base} size={TILE} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            ))}
            {ends && <span className="w-6 text-center text-[13px] font-semibold text-ink-3">5′</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {(["A", "T", "G", "C"] as const).map((b) => (
          <motion.button
            key={b}
            type="button"
            whileTap={{ scale: 0.92 }}
            disabled={done}
            onClick={() => pick(b)}
            aria-label={t(BASE_NAME[b])}
            className="flex h-12 min-w-[72px] items-center justify-center gap-2 rounded-xl border-2 px-3 text-[15px] font-semibold text-ink transition-opacity disabled:opacity-40"
            style={{ borderColor: BASE_COLOR[b], background: baseTint(b, 22) }}
          >
            <span className="text-[19px]">{b}</span>
            <span className="hidden text-[12.5px] font-medium text-ink-2 sm:inline">{t(BASE_NAME[b])}</span>
          </motion.button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-h-[2.75rem] min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[14px] leading-snug" aria-live="polite">
          {note ? (
            <span className={cn(wrong ? "text-ink" : "font-medium text-ink")}>{t(note)}</span>
          ) : (
            <span className="text-ink-3">
              {t(tx(`Which base pairs with ${template[at]}? Tap it (or press its key).`, `Welche Base paart mit ${template[at]}? Tipp sie an (oder drück die Taste).`))}
            </span>
          )}
        </div>
        {done ? (
          <StepButton primary onClick={fresh} label={t(tx("New strand", "Neuer Strang"))}>
            <RefreshCw className="size-4" /> {t(tx("New strand", "Neuer Strang"))}
          </StepButton>
        ) : (
          <StepButton
            onClick={() => {
              setPlaced([]);
              setWrong(null);
            }}
            disabled={!placed.length}
            label={t(tx("Start again", "Neu anfangen"))}
          >
            <RotateCcw className="size-4" />
          </StepButton>
        )}
      </div>
    </div>
  );
}
