"use client";

import { ArrowRight, Languages, UserRound } from "lucide-react";
import { BlobMark } from "@/components/blob/BlobMark";
import { fullName } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cvLetterText } from "@/i18n/messages/cvLetter";
import { CvTextLang } from "../form/ui";
import { UndoProvider } from "../form/undo";
import type { CvEditorProps } from "../types";
import { LetterClosingCard } from "./LetterClosingCard";
import { LetterTextCard } from "./LetterTextCard";
import { RecipientCard } from "./RecipientCard";
import { SubjectCard } from "./SubjectCard";

/**
 * The cover letter's content, part by part: who it goes to, the subject, the text and the regards.
 * Name, address, design and signature come from the CV; without a name the letter has no
 * letterhead, so it asks for "About you" first. `pages` is the letter's page count (one is right).
 */
export function LetterForm({ cv, change, pages, onShowCv }: CvEditorProps & { pages: number | null; onShowCv: () => void }) {
  const t = useMessages(cvLetterText);
  const tf = useMessages(cvFormText);
  const locale = useLocale();

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
              <p>{tf.langNote(tf.langNames[cv.lang])}</p>
            </div>
          )}
          {!fullName(cv.person) && (
            <button
              type="button"
              onClick={onShowCv}
              className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-line-2 px-3 py-2.5 text-left text-[13px] leading-snug text-ink-2 transition-colors hover:border-blob/50 hover:bg-blob-soft/50"
            >
              <UserRound className="size-4 shrink-0 text-blob-ink" />
              <span className="min-w-0 flex-1">{t.needName}</span>
              <ArrowRight className="size-4 shrink-0 text-blob-ink" />
            </button>
          )}

          <RecipientCard cv={cv} change={change} />
          <SubjectCard cv={cv} change={change} />
          <LetterTextCard cv={cv} change={change} pages={pages} />
          <LetterClosingCard cv={cv} change={change} />
        </div>
      </CvTextLang.Provider>
    </UndoProvider>
  );
}
