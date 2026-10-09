"use client";

import { Plus } from "lucide-react";
import { memo } from "react";
import { cvId, isEntryKind, newEntry, newSection, SECTION_KINDS } from "@/cv/model";
import type { CvSection, CvSectionKind } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import type { CvChange } from "../types";
import { focusSoon, insertAt, openCvPart, sectionInsertIndex } from "./edit";
import { KIND_ICON, MAX_SECTIONS, SINGLE_KINDS } from "./kinds";
import { FormCard, Tip } from "./ui";

/** Part 4: every kind of section with its icon and a line about it. Skills, languages and hobbies come once. */
export const AddSectionCard = memo(function AddSectionCard({ sections, change }: { sections: CvSection[]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const full = sections.length >= MAX_SECTIONS;

  // A new section comes with its first empty row, focused, so the student can type right away.
  const add = (kind: CvSectionKind) => {
    const section = newSection(kind);
    let focus = `cv-part-${section.id}-title`;
    if (isEntryKind(kind) && "entries" in section) {
      const entry = newEntry();
      section.entries = [entry];
      focus = `cvf-${entry.id}-name`;
    } else if (section.kind === "skills") {
      const skill = { id: cvId(), name: "", level: 3 };
      section.skills = [skill];
      focus = `cvf-skill-${skill.id}`;
    } else if (section.kind === "languages") {
      const language = { id: cvId(), name: "", level: "good" as const, cefr: "" as const };
      section.languages = [language];
      focus = `cvf-lang-${language.id}-name`;
    } else if (section.kind === "interests") focus = `cvf-${section.id}-tags`;
    // In its usual place (school first, placements after school, hobbies last), not just at the end.
    change((cv) => ({ ...cv, sections: insertAt(cv.sections, sectionInsertIndex(cv.sections, kind), section) }));
    // A section of your own starts with its heading: "Weiteres" is selected, ready to be typed over.
    if (kind === "custom") focusSoon(`cv-part-${section.id}-title`, { select: true });
    else focusSoon(focus);
  };

  return (
    <FormCard id="cv-part-add" icon={Plus} title={t.add.title} subtitle={t.add.subtitle}>
      <Tip id="add">{t.tips.add}</Tip>
      {full && <p className="text-[12.5px] text-ink-3">{t.add.max}</p>}
      <div className="grid gap-1.5 @min-[380px]:grid-cols-2">
        {SECTION_KINDS.map((kind) => {
          const Icon = KIND_ICON[kind];
          const existing = SINGLE_KINDS.includes(kind) ? sections.find((s) => s.kind === kind) : undefined;
          return (
            <button
              key={kind}
              type="button"
              disabled={full && !existing}
              onClick={() => (existing ? openCvPart(`cv-part-${existing.id}`) : add(kind))}
              className={cn(
                "group flex min-h-14 items-center gap-2.5 rounded-xl border px-2.5 py-2.5 text-left transition-[background,border,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
                existing ? "border-transparent bg-hover/40" : "border-line bg-surface/70 hover:border-blob/40 hover:bg-blob-soft/40",
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                  existing ? "bg-hover text-ink-3" : "bg-raised text-ink-2 shadow-card group-hover:bg-blob-soft group-hover:text-blob-ink",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-balance text-[13.5px] font-medium leading-tight", existing ? "text-ink-3" : "text-ink")}>{t.kinds[kind].name}</span>
                <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-3">{existing ? t.add.already : t.kinds[kind].desc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </FormCard>
  );
});
