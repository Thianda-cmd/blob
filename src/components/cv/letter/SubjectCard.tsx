"use client";

import { Heading } from "lucide-react";
import { memo, useRef } from "react";
import { letterChecklist } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cvLetterText } from "@/i18n/messages/cvLetter";
import { selectNextBlank, setLetter } from "../form/edit";
import { CV_EXAMPLES } from "../form/examples";
import { AutoTextarea, Field, FormCard, Suggestions, TextInput, Tip } from "../form/ui";
import type { CvChange } from "../types";

/** Letter part 2: the subject line and, under it, where the job was advertised. */
export const SubjectCard = memo(function SubjectCard({ cv, change }: { cv: Cv; change: CvChange }) {
  const t = useMessages(cvLetterText);
  const ts = t.subject;
  const optional = useMessages(cvFormText).optional;
  const l = cv.letter;
  const examples = CV_EXAMPLES[cv.lang].letter;
  const subjectRef = useRef<HTMLTextAreaElement>(null);
  const referenceRef = useRef<HTMLInputElement>(null);
  // A CV headline that already says what it is for ("Bewerbung um …") makes a good subject.
  const headline = cv.person.headline.trim();
  const subjects = [...(/^(bewerbung|application|applying)\b/i.test(headline) ? [headline] : []), ...examples.subjects].filter((s) => s !== l.subject.trim());

  return (
    <FormCard id="cv-letter-subject" icon={Heading} title={ts.title} subtitle={l.subject.trim() || ts.empty} done={letterChecklist(cv).subject}>
      <Tip id="letter-subject">{t.tips.subject}</Tip>
      <div className="space-y-2">
        <Field label={ts.label} htmlFor="cvl-subject">
          <AutoTextarea
            ref={subjectRef}
            id="cvl-subject"
            singleLine
            value={l.subject}
            onValue={(subject) => change(setLetter({ subject }))}
            maxLength={200}
            spellCheck
            placeholder={ts.placeholder}
          />
        </Field>
        {!l.subject.trim() && (
          <Suggestions
            items={subjects}
            onPick={(subject) => {
              change(setLetter({ subject }));
              requestAnimationFrame(() => subjectRef.current && selectNextBlank(subjectRef.current, 0));
            }}
          />
        )}
      </div>
      <div className="space-y-2">
        <Field label={`${ts.reference} (${optional})`} htmlFor="cvl-reference" hint={ts.referenceHint}>
          <TextInput ref={referenceRef} id="cvl-reference" value={l.reference} onValue={(reference) => change(setLetter({ reference }))} maxLength={200} placeholder={ts.referencePlaceholder} />
        </Field>
        {!l.reference.trim() && (
          <Suggestions
            items={examples.references}
            onPick={(reference) => {
              change(setLetter({ reference }));
              requestAnimationFrame(() => referenceRef.current && selectNextBlank(referenceRef.current, 0));
            }}
          />
        )}
      </div>
    </FormCard>
  );
});
