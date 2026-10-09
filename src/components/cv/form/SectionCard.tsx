"use client";

import { ArrowDown, ArrowDownWideNarrow, ArrowUp, Eye, EyeOff, PencilLine, RotateCcw, Trash2 } from "lucide-react";
import { memo, useRef, useState } from "react";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { CV_LABELS } from "@/cv/labels";
import { interestList, isEntryKind, sectionHasContent } from "@/cv/model";
import type { Cv, CvEntrySection, CvSection } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import type { CvChange } from "../types";
import { blankEntry, entryKey, focusNextField, focusSoon, insertAt, move, updateSection } from "./edit";
import { EntryList } from "./EntryList";
import { InterestTags } from "./InterestTags";
import { KIND_ICON, SINGLE_KINDS } from "./kinds";
import { LanguageList } from "./LanguageList";
import { SkillList } from "./SkillList";
import { FormCard, MoreMenu, Tip } from "./ui";
import { useOfferUndo } from "./undo";

/** Part 3: one card per section of the CV, with its heading, show/hide, order and removal. Re-renders only when its section changes. */
export const SectionCard = memo(function SectionCard({
  section,
  lang,
  first,
  last,
  change,
}: {
  section: CvSection;
  lang: Cv["lang"];
  first: boolean;
  last: boolean;
  change: CvChange;
}) {
  const t = useMessages(cvFormText);
  const tc = t.section;
  const offerUndo = useOfferUndo();
  const partId = `cv-part-${section.id}`;
  const fallback = CV_LABELS[lang].headings[section.kind];
  const heading = section.title.trim() || fallback;
  const filled = sectionHasContent({ ...section, hidden: false });

  const update = (fn: (s: CvSection) => CvSection) => change(updateSection(section.id, fn));
  const moveBy = (by: number) => change((cv) => ({ ...cv, sections: move(cv.sections, cv.sections.findIndex((s) => s.id === section.id), by) }));
  const toggleHidden = () => update((s) => ({ ...s, hidden: !s.hidden }));
  const remove = () => {
    let at = 0;
    change((cv) => {
      at = cv.sections.findIndex((s) => s.id === section.id);
      return { ...cv, sections: cv.sections.filter((s) => s.id !== section.id) };
    });
    offerUndo({
      message: t.removed(heading),
      restore: (cv) => {
        // Skills, languages and hobbies come once. If the student has added that kind again in the
        // meantime, the removed one replaces the new one while it is still empty; otherwise keep theirs.
        let sections = cv.sections;
        const again = SINGLE_KINDS.includes(section.kind) ? sections.find((s) => s.kind === section.kind) : undefined;
        if (again) {
          if (sectionHasContent({ ...again, hidden: false })) return cv;
          sections = sections.filter((s) => s.id !== again.id);
        }
        return { ...cv, sections: insertAt(sections, Math.min(at, sections.length), section) };
      },
    });
  };
  const sortNewestFirst = () =>
    update((s) => (isEntryKind(s.kind) ? { ...s, entries: [...(s as CvEntrySection).entries].sort((a, b) => entryKey(b).localeCompare(entryKey(a))) } : s));

  let count = "";
  if (section.kind === "skills") count = tc.skills(section.skills.filter((k) => k.name.trim()).length);
  else if (section.kind === "languages") count = section.languages.map((l) => l.name.trim()).filter(Boolean).join(", ");
  else if (section.kind === "interests") count = interestList(section.text).join(", ");
  // Only entries that print: a row just added and still blank doesn't count yet.
  else count = tc.entries(section.entries.filter((e) => !blankEntry(e)).length);

  const subtitle = section.hidden ? (
    <span className="inline-flex items-center gap-1">
      <EyeOff className="size-3" /> {tc.hidden}
    </span>
  ) : filled ? (
    count
  ) : (
    tc.empty
  );

  return (
    <FormCard
      id={partId}
      icon={KIND_ICON[section.kind]}
      title={<HeadingInput id={`${partId}-title`} value={section.title} fallback={fallback} onValue={(title) => update((s) => ({ ...s, title }))} />}
      subtitle={subtitle}
      done={filled}
      muted={section.hidden}
      actions={
        <>
          <button
            type="button"
            onClick={toggleHidden}
            aria-pressed={section.hidden}
            aria-label={section.hidden ? tc.show : tc.hide}
            title={section.hidden ? tc.show : tc.hide}
            className={cn(
              "hidden size-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-hover @min-[400px]:grid max-lg:size-10",
              section.hidden ? "text-ink-2 hover:text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {section.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <MoreMenu label={t.more}>
            {(close) => {
              const run = (fn: () => void) => () => {
                close();
                fn();
              };
              return (
                <>
                  <MenuItem icon={<PencilLine />} onSelect={run(() => focusSoon(`${partId}-title`, { select: true }))}>
                    {tc.rename}
                  </MenuItem>
                  {section.title.trim() && section.title.trim() !== fallback && (
                    <MenuItem icon={<RotateCcw />} onSelect={run(() => update((s) => ({ ...s, title: "" })))}>
                      {tc.resetHeading(fallback)}
                    </MenuItem>
                  )}
                  <MenuItem icon={<ArrowUp />} onSelect={run(() => moveBy(-1))} disabled={first}>
                    {tc.moveUp}
                  </MenuItem>
                  <MenuItem icon={<ArrowDown />} onSelect={run(() => moveBy(1))} disabled={last}>
                    {tc.moveDown}
                  </MenuItem>
                  {isEntryKind(section.kind) && (section as CvEntrySection).entries.length > 1 && (
                    <MenuItem icon={<ArrowDownWideNarrow />} onSelect={run(sortNewestFirst)}>
                      {tc.sort}
                    </MenuItem>
                  )}
                  <MenuItem icon={section.hidden ? <Eye /> : <EyeOff />} onSelect={run(toggleHidden)}>
                    {section.hidden ? tc.show : tc.hide}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 />} danger onSelect={run(remove)}>
                    {tc.remove}
                  </MenuItem>
                </>
              );
            }}
          </MoreMenu>
        </>
      }
    >
      <Tip id={section.kind}>{t.tips.kinds[section.kind]}</Tip>
      {section.kind === "skills" ? (
        <SkillList section={section} lang={lang} change={change} />
      ) : section.kind === "languages" ? (
        <LanguageList section={section} lang={lang} change={change} />
      ) : section.kind === "interests" ? (
        <InterestTags section={section} lang={lang} change={change} />
      ) : (
        <EntryList section={section} lang={lang} change={change} />
      )}
    </FormCard>
  );
});

/**
 * The section's heading as it prints, edited in place. Empty (or the default) stores "" so the
 * heading follows the CV's language; while typing, the field keeps exactly what was typed.
 */
function HeadingInput({ id, value, fallback, onValue }: { id: string; value: string; fallback: string; onValue: (title: string) => void }) {
  const t = useMessages(cvFormText);
  const [draft, setDraft] = useState<string | null>(null);
  // The heading as it was when the field got focus: Escape goes back to it.
  const before = useRef("");
  const shown = draft ?? (value.trim() || fallback);
  return (
    <div className="group -ml-1.5 flex min-w-0 items-center">
      <input
        id={id}
        value={shown}
        onFocus={(e) => {
          before.current = value;
          setDraft(value.trim() || fallback);
          e.currentTarget.select();
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          onValue(!next.trim() || next.trim() === fallback ? "" : next);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            // On to the section's first field (e.g. the title of the new entry in a section of your own).
            e.preventDefault();
            focusNextField(e.currentTarget);
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (value !== before.current) onValue(before.current);
            e.currentTarget.blur();
          }
        }}
        maxLength={80}
        autoComplete="off"
        enterKeyHint="next"
        aria-label={t.section.headingLabel}
        title={t.section.renameHint}
        className="h-7 min-w-0 max-w-full truncate rounded-md border border-transparent bg-transparent px-1.5 font-display text-[15.5px] font-semibold tracking-[-0.01em] text-ink outline-none transition-[background,border,box-shadow] [field-sizing:content] hover:bg-hover focus:border-blob focus:bg-raised focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] max-lg:h-8 max-lg:text-[16px]"
      />
      <PencilLine aria-hidden className="ml-1 size-3.5 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-0 max-lg:opacity-60" />
    </div>
  );
}
