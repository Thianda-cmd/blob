"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, type KeyboardEvent } from "react";
import { Switch } from "@/components/settings/primitives";
import { cvId } from "@/cv/model";
import type { Cv, CvSkill, CvSkillSection } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import type { CvChange } from "../types";
import { focusSoon, insertAt, updateSection } from "./edit";
import { CV_EXAMPLES } from "./examples";
import { AddButton, Suggestions, TextInput } from "./ui";
import { useOfferUndo } from "./undo";

const MAX_SKILLS = 60;
/** Chips shown before "more". */
const FEW = 7;

const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Skills: a name and 0–5 level dots per row, a "show levels" switch and quick-add ideas. */
export function SkillList({ section, lang, change }: { section: CvSkillSection; lang: Cv["lang"]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const tk = t.skills;
  const offerUndo = useOfferUndo();
  const sid = section.id;
  const levelsId = `cvf-${sid}-levels`;
  const skills = section.skills;
  const update = (fn: (s: CvSkillSection) => CvSkillSection) => change(updateSection<CvSkillSection>(sid, fn));
  const setSkill = (id: string, patch: Partial<CvSkill>) => update((s) => ({ ...s, skills: s.skills.map((k) => (k.id === id ? { ...k, ...patch } : k)) }));

  const add = (name = "", focus = true) => {
    const skill: CvSkill = { id: cvId(), name, level: 3 };
    update((s) => ({ ...s, skills: [...s.skills, skill] }));
    if (focus) focusSoon(`cvf-skill-${skill.id}`);
  };

  const remove = (i: number) => {
    const skill = skills[i];
    update((s) => ({ ...s, skills: s.skills.filter((k) => k.id !== skill.id) }));
    if (skill.name.trim())
      offerUndo({
        message: t.removed(skill.name.trim()),
        restore: (cv) => updateSection<CvSkillSection>(sid, (s) => ({ ...s, skills: insertAt(s.skills, Math.min(i, s.skills.length), skill) }))(cv),
      });
  };

  // Enter in a name jumps to the next skill, or starts a new one after the last.
  const onNameKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const next = skills[i + 1];
    if (next) focusSoon(`cvf-skill-${next.id}`);
    else if (e.currentTarget.value.trim() && skills.length < MAX_SKILLS) add();
  };

  const ideas = CV_EXAMPLES[lang].skills.filter((idea) => !skills.some((k) => same(k.name, idea)));

  return (
    <div className="space-y-3">
      {/* The whole row flips the switch (a bigger target than the switch on a phone). */}
      <label htmlFor={levelsId} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-hover/50 py-2 pl-3 pr-2">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-ink">{tk.showLevels}</span>
          <span className="block text-[12px] leading-snug text-ink-3">{tk.showLevelsHint}</span>
        </span>
        <Switch id={levelsId} checked={section.showLevels} onChange={(v) => update((s) => ({ ...s, showLevels: v }))} label={tk.showLevels} />
      </label>

      {skills.length > 0 && (
        <ul className="space-y-1.5">
          <AnimatePresence initial={false}>
            {skills.map((skill, i) => (
              <motion.li
                key={skill.id}
                layout="position"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.14 } }}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className={cn(
                  "flex flex-wrap items-center gap-x-1.5 gap-y-0.5",
                  // Narrow cards (phones): the dots get their own row under the name.
                  section.showLevels && "@max-[379px]:rounded-xl @max-[379px]:border @max-[379px]:border-line @max-[379px]:bg-surface/70 @max-[379px]:p-2 @max-[379px]:pb-1",
                )}
              >
                <TextInput
                  id={`cvf-skill-${skill.id}`}
                  aria-label={`${tk.name} ${i + 1}`}
                  value={skill.name}
                  onValue={(v) => setSkill(skill.id, { name: v })}
                  onKeyDown={(e) => onNameKey(e, i)}
                  maxLength={80}
                  placeholder={tk.namePlaceholder}
                  className="order-1 min-w-0 flex-1"
                />
                {section.showLevels && (
                  <LevelDots
                    name={skill.name.trim() || tk.name}
                    value={skill.level}
                    onValue={(level) => setSkill(skill.id, { level })}
                    className="order-3 basis-full pl-1 @min-[380px]:order-2 @min-[380px]:basis-auto @min-[380px]:pl-0"
                  />
                )}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={tk.remove}
                  title={tk.remove}
                  className="order-2 grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-danger @min-[380px]:order-3 max-lg:size-10"
                >
                  <X className="size-4" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AddButton onClick={() => add()} disabled={skills.length >= MAX_SKILLS}>
        {tk.add}
      </AddButton>

      <Suggestions items={ideas} limit={FEW} onPick={(name) => add(name, false)} />
    </div>
  );
}

/** Five dots: click one to set the level, click it again for "no level". Arrow keys work too. */
function LevelDots({ name, value, onValue, className }: { name: string; value: number; onValue: (level: number) => void; className?: string }) {
  const t = useMessages(cvFormText);
  const names = t.skills.levels;
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const by = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(5, value + by));
    onValue(next);
    const dot = e.currentTarget.querySelectorAll<HTMLButtonElement>("button")[Math.max(1, next) - 1];
    dot?.focus();
  };

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <div role="radiogroup" aria-label={t.skills.levelFor(name)} className="flex items-center" onMouseLeave={() => setHover(0)} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t.skills.level(n, names[n])}
            title={t.skills.level(n, names[n])}
            tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
            onMouseEnter={() => setHover(n)}
            onClick={() => onValue(value === n ? 0 : n)}
            className="group grid h-8 w-5 place-items-center max-lg:h-10 max-lg:w-7"
          >
            <span
              className={cn(
                "size-2.5 rounded-full transition-[background,transform] duration-150 group-active:scale-90 max-lg:size-3",
                n <= shown ? (hover ? "bg-blob/70" : "bg-blob") : "bg-line-2",
                hover === n && "scale-125",
              )}
            />
          </button>
        ))}
      </div>
      <span className="w-[6.5rem] truncate text-[12px] text-ink-3 @min-[380px]:hidden @min-[420px]:block">{names[shown]}</span>
    </div>
  );
}
