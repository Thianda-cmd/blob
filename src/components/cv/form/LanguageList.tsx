"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { CEFR_LEVELS, cvId, LANGUAGE_LEVELS } from "@/cv/model";
import type { Cv, CvCefr, CvLanguage, CvLanguageLevel, CvLanguageSection } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import type { CvChange } from "../types";
import { focusSoon, insertAt, updateSection } from "./edit";
import { CV_EXAMPLES } from "./examples";
import { AddButton, SelectBox, Suggestions, TextInput } from "./ui";
import { useOfferUndo } from "./undo";

const MAX_LANGUAGES = 20;
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Languages: name, how well (on the CV in words) and an optional CEFR level, plus quick-add ideas. */
export function LanguageList({ section, lang, change }: { section: CvLanguageSection; lang: Cv["lang"]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const tl = t.languages;
  const offerUndo = useOfferUndo();
  const sid = section.id;
  const languages = section.languages;
  const update = (fn: (s: CvLanguageSection) => CvLanguageSection) => change(updateSection<CvLanguageSection>(sid, fn));
  const setLanguage = (id: string, patch: Partial<CvLanguage>) =>
    update((s) => ({ ...s, languages: s.languages.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));

  const add = (name = "", level: CvLanguageLevel = "good", focus = true) => {
    const language: CvLanguage = { id: cvId(), name, level, cefr: "" };
    update((s) => ({ ...s, languages: [...s.languages, language] }));
    if (focus) focusSoon(`cvf-lang-${language.id}-name`);
  };

  const remove = (i: number) => {
    const language = languages[i];
    update((s) => ({ ...s, languages: s.languages.filter((l) => l.id !== language.id) }));
    if (language.name.trim())
      offerUndo({
        message: t.removed(language.name.trim()),
        restore: (cv) =>
          updateSection<CvLanguageSection>(sid, (s) => ({ ...s, languages: insertAt(s.languages, Math.min(i, s.languages.length), language) }))(cv),
      });
  };

  const ideas = CV_EXAMPLES[lang].languages.filter((idea) => !languages.some((l) => same(l.name, idea.name)));

  return (
    <div className="space-y-3">
      {languages.length > 0 && (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {languages.map((language, i) => {
              const id = `cvf-lang-${language.id}`;
              return (
                <motion.li
                  key={language.id}
                  layout="position"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
                  transition={{ type: "spring", stiffness: 520, damping: 38 }}
                  // Wide cards (tablets): name, level, CEFR and × in one row.
                  className="space-y-1.5 rounded-xl border border-line bg-surface/70 p-2 @min-[560px]:grid @min-[560px]:grid-cols-[minmax(0,1fr)_12rem_5.5rem_auto] @min-[560px]:items-center @min-[560px]:gap-1.5 @min-[560px]:space-y-0"
                >
                  <div className="flex items-center gap-1.5 @min-[560px]:contents">
                    <TextInput
                      id={`${id}-name`}
                      aria-label={`${tl.name} ${i + 1}`}
                      value={language.name}
                      onValue={(v) => setLanguage(language.id, { name: v })}
                      maxLength={60}
                      placeholder={tl.namePlaceholder}
                      className="min-w-0 flex-1 font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => remove(i)}
                      aria-label={tl.remove}
                      title={tl.remove}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-danger @min-[560px]:order-last max-lg:size-10"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-1.5 pr-[2.375rem] @min-[560px]:contents max-lg:pr-[2.875rem]">
                    <SelectBox id={`${id}-level`} aria-label={`${language.name || tl.name}: ${tl.level}`} value={language.level} onValue={(v) => setLanguage(language.id, { level: v as CvLanguageLevel })}>
                      {LANGUAGE_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {tl.levels[level]}
                        </option>
                      ))}
                    </SelectBox>
                    <SelectBox id={`${id}-cefr`} aria-label={`${language.name || tl.name}: ${tl.cefr}`} value={language.cefr} onValue={(v) => setLanguage(language.id, { cefr: v as CvCefr })}>
                      {CEFR_LEVELS.map((level) => (
                        <option key={level || "none"} value={level}>
                          {level || tl.cefrShort}
                        </option>
                      ))}
                    </SelectBox>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      <AddButton onClick={() => add()} disabled={languages.length >= MAX_LANGUAGES}>
        {tl.add}
      </AddButton>

      <Suggestions items={ideas.map((idea) => idea.name)} limit={5} onPick={(name) => add(name, ideas.find((idea) => idea.name === name)?.level, false)} />

      <p className="text-[12px] leading-snug text-ink-3">{tl.cefrHint}</p>
    </div>
  );
}
