"use client";

// "Which class am I?": a tricky animal (whale, bat, penguin, platypus...) shows its profile.
// Pick a class and every clue is checked against it: key features tick or cross, while looks
// and habitat stay grey because they say nothing about the class.

import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Minus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { resolveText, tx, type Text } from "@/i18n/text";
import { useText } from "@/i18n/useText";
import { animal, CLASS_IDS, CLASSES, SORTER_IDS, TheName, type ClassId } from "@/learn/biology/topics/vertebrates/data";
import { cn } from "@/lib/utils";
import { ClassAnimal } from "./VertebrateAnimals";

export function VertebrateSorter() {
  const t = useText();
  const [i, setI] = useState(0);
  const [tried, setTried] = useState<ClassId[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(0);
  const a = animal(SORTER_IDS[i]);
  const picked = tried.length ? tried[tried.length - 1] : null;
  const solved = picked === a.cls;
  const finished = done === SORTER_IDS.length;

  const pick = (c: ClassId) => {
    if (solved || tried.includes(c)) return;
    setTried([...tried, c]);
    if (c === a.cls) {
      if (!tried.length) setScore((s) => s + 1);
      setDone((d) => d + 1);
    }
  };
  const next = () => {
    setI((i + 1) % SORTER_IDS.length);
    setTried([]);
  };
  const restart = () => {
    setI(0);
    setTried([]);
    setScore(0);
    setDone(0);
  };

  const wrongSay: Text | null = picked && !solved ? (a.traps?.[picked] ?? CLASSES[picked].test) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-[12.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        <span>{t(tx(`Animal ${i + 1} of ${SORTER_IDS.length}`, `Tier ${i + 1} von ${SORTER_IDS.length}`))}</span>
        <span className="text-blob-ink">{t(tx(`${score} right first time`, `${score} auf Anhieb richtig`))}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24, transition: { duration: 0.14 } }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="rounded-xl border border-line bg-surface"
        >
          <div className="flex items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
            <h3 className="font-display text-[22px] font-bold leading-tight">{t(a.name)}</h3>
            <span className="text-[12.5px] text-ink-3">{t(tx("Which class am I?", "Welche Klasse bin ich?"))}</span>
          </div>
          <ul className="divide-y divide-line">
            {a.clues!.map((c, k) => {
              const key = !!c.fits;
              const state = !picked ? "idle" : !key ? "neutral" : c.fits!.includes(picked) ? "yes" : "no";
              return (
                <li key={k} className="flex items-center gap-3 px-4 py-2">
                  <span className="min-w-0 flex-1 text-[15px] text-ink">{t(c.text)}</span>
                  <AnimatePresence mode="wait" initial={false}>
                    {state !== "idle" && (
                      <motion.span
                        key={`${state}-${picked}`}
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.4, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.06 * k }}
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold",
                          state === "yes" && "bg-ok/12 text-ok",
                          state === "no" && "bg-danger/12 text-danger",
                          state === "neutral" && "bg-hover text-ink-3",
                        )}
                      >
                        {state === "yes" ? <Check className="size-3.5" /> : state === "no" ? <X className="size-3.5" /> : <Minus className="size-3.5" />}
                        <span className="hidden sm:inline">
                          {state === "neutral" ? t(tx("says nothing", "verrät nichts")) : state === "yes" ? t(tx("fits", "passt")) : t(tx("doesn't fit", "passt nicht"))}
                        </span>
                      </motion.span>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </AnimatePresence>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
        {CLASS_IDS.map((c) => {
          const wasWrong = tried.includes(c) && c !== a.cls;
          const right = solved && c === a.cls;
          return (
            <motion.button
              key={c}
              type="button"
              onClick={() => pick(c)}
              disabled={solved || wasWrong}
              whileTap={{ scale: 0.94 }}
              animate={wasWrong ? { x: [0, -5, 5, -3, 0] } : { x: 0 }}
              transition={{ duration: 0.35 }}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 pb-2 pt-1 transition-colors",
                right ? "border-ok bg-ok/10" : wasWrong ? "border-danger/50 opacity-50" : "border-line bg-raised hover:border-blob hover:bg-blob-soft",
                solved && !right && "opacity-40",
              )}
            >
              <div className="w-full max-w-[90px]">
                <ClassAnimal cls={c} title={false} />
              </div>
              <span className="w-full break-words text-center text-[11px] font-semibold leading-tight text-ink sm:text-[13px]">{t(CLASSES[c].name)}</span>
            </motion.button>
          );
        })}
      </div>

      <div className="min-h-[4.5rem]" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {solved ? (
            <motion.div key="ok" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-3 rounded-xl border border-ok/40 bg-ok/8 px-4 py-3">
              <p className="min-w-0 flex-1 text-[15px] text-ink">
                <span className="font-semibold">{t(tx("Right! ", "Richtig! "))}</span>
                {t(TheName(a))} {t(tx("is", "ist"))} {t(CLASSES[a.cls].one)}. {t(tx("The grey clues are looks and habitat: they don't decide the class.", "Die grauen Hinweise sind Aussehen und Lebensraum: Sie entscheiden nicht über die Klasse."))}
              </p>
              {finished && i === SORTER_IDS.length - 1 ? (
                <button type="button" onClick={restart} className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13.5px] font-semibold text-paper">
                  <RotateCcw className="size-3.5" /> {t(tx("Start again", "Nochmal"))}
                </button>
              ) : (
                <button type="button" onClick={next} className="flex items-center gap-1.5 rounded-full bg-blob px-3.5 py-1.5 text-[13.5px] font-semibold text-white">
                  {t(tx("Next animal", "Nächstes Tier"))} <ArrowRight className="size-3.5" />
                </button>
              )}
            </motion.div>
          ) : wrongSay ? (
            <motion.div key={`no-${picked}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-xl border border-danger/30 bg-danger/6 px-4 py-3 text-[15px] text-ink">
              <span className="font-semibold">
                {t(tx(`Not ${resolveText(CLASSES[picked!].name, "en").toLowerCase()}. `, `Keine ${resolveText(CLASSES[picked!].name, "de")}. `))}
              </span>
              {t(wrongSay)}
            </motion.div>
          ) : (
            <motion.p key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-1 pt-2 text-[14px] text-ink-3">
              {t(tx("Read the profile and tap a class. Each clue is then checked against that class.", "Lies den Steckbrief und tipp auf eine Klasse. Dann wird jeder Hinweis mit dieser Klasse verglichen."))}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
