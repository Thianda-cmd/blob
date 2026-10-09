"use client";

import { Languages } from "lucide-react";
import { BlobMark } from "@/components/blob/BlobMark";
import { useLocale, useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { AddSectionCard } from "./form/AddSectionCard";
import { ClosingCard } from "./form/ClosingCard";
import { PersonCard } from "./form/PersonCard";
import { SectionCard } from "./form/SectionCard";
import { SummaryCard } from "./form/SummaryCard";
import { CvTextLang } from "./form/ui";
import { UndoProvider } from "./form/undo";
import type { CvEditorProps } from "./types";

/**
 * The CV's content, part by part: about you, profile, one card per section (in the CV's order),
 * "add a section", and place, date and signature. Each part is a card with an id the editor can
 * scroll to (cv-part-person, -summary, -<section id>, -add, -closing; see openCvPart in form/edit.ts).
 */
export function CvForm({ cv, change }: CvEditorProps) {
  const t = useMessages(cvFormText);
  const locale = useLocale();
  const sections = cv.sections;

  return (
    <UndoProvider change={change}>
      <CvTextLang.Provider value={cv.lang}>
        <div data-cv-form aria-label={t.formLabel} role="group" className="mx-auto w-full max-w-[640px] space-y-3 px-3 pb-4 pt-4 sm:px-4">
          <div className="flex items-start gap-2.5 px-1 text-[13px] leading-snug text-ink-3">
            <BlobMark size={18} className="mt-px" />
            <p>{t.intro}</p>
          </div>
          {cv.lang !== locale && (
            <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] leading-snug text-ink-2">
              <Languages className="mt-px size-4 shrink-0 text-blob-ink" />
              <p>{t.langNote(t.langNames[cv.lang])}</p>
            </div>
          )}

          <PersonCard cv={cv} change={change} />
          <SummaryCard summary={cv.summary} lang={cv.lang} change={change} />
          {sections.map((section, i) => (
            <SectionCard key={section.id} section={section} lang={cv.lang} first={i === 0} last={i === sections.length - 1} change={change} />
          ))}
          <AddSectionCard sections={sections} change={change} />
          <ClosingCard cv={cv} change={change} />
        </div>
      </CvTextLang.Provider>
    </UndoProvider>
  );
}
