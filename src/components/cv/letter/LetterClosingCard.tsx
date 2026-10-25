"use client";

import { Signature, X } from "lucide-react";
import { CV_LABELS } from "@/cv/labels";
import { enclosureList, letterPlaceDate } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvLetterText } from "@/i18n/messages/cvLetter";
import { cn } from "@/lib/utils";
import { SignatureField } from "../SignatureField";
import { setClosing, setLetter } from "../form/edit";
import { CV_EXAMPLES } from "../form/examples";
import { AutoTextarea, Field, fieldClass, FormCard, Suggestions, TextInput, Tip } from "../form/ui";
import type { CvChange } from "../types";

/** Letter part 4: regards, place and date, enclosures and the signature (the last two shared with the CV). */
export function LetterClosingCard({ cv, change }: { cv: Cv; change: CvChange }) {
  const t = useMessages(cvLetterText);
  const tc = t.closing;
  const l = cv.letter;
  const examples = CV_EXAMPLES[cv.lang].letter;
  const city = cv.person.city.trim();
  const listed = enclosureList(l.enclosures);
  const subtitle = [letterPlaceDate(cv), cv.closing.signature ? tc.signed : ""].filter(Boolean).join(" · ");

  return (
    <FormCard id="cv-letter-closing" icon={Signature} title={tc.title} subtitle={subtitle} done={Boolean(cv.closing.signature)}>
      <Tip id="letter-closing">{t.tips.closing}</Tip>
      <div className="space-y-2">
        <Field label={tc.regards} htmlFor="cvl-regards">
          <TextInput id="cvl-regards" value={l.regards} onValue={(regards) => change(setLetter({ regards }))} maxLength={80} placeholder={CV_LABELS[cv.lang].regards} />
        </Field>
        <Suggestions items={examples.regards.filter((r) => r !== (l.regards.trim() || CV_LABELS[cv.lang].regards))} onPick={(regards) => change(setLetter({ regards }))} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={tc.place} htmlFor="cvl-place" hint={tc.placeHint(city)}>
          <TextInput id="cvl-place" spellCheck={false} value={cv.closing.place} onValue={(place) => change(setClosing({ place }))} maxLength={80} placeholder={city} />
        </Field>
        <Field
          label={tc.date}
          htmlFor="cvl-date"
          hint={tc.dateHint}
          action={
            l.date ? (
              <button
                type="button"
                onClick={() => change(setLetter({ date: "" }))}
                aria-label={tc.clearDate}
                title={tc.clearDate}
                className="-my-1 grid size-6 place-items-center rounded-md text-ink-3 transition-colors hover:bg-hover hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            ) : undefined
          }
        >
          <input
            id="cvl-date"
            type="date"
            value={l.date}
            onChange={(e) => change(setLetter({ date: e.target.value }))}
            className={cn(fieldClass, "min-w-0 appearance-none", !l.date && "text-ink-3")}
          />
        </Field>
      </div>
      <div className="space-y-2">
        <Field label={tc.enclosures} htmlFor="cvl-enclosures" hint={tc.enclosuresHint}>
          <AutoTextarea
            id="cvl-enclosures"
            value={l.enclosures}
            onValue={(enclosures) => change(setLetter({ enclosures }))}
            maxLength={400}
            minRows={2}
            spellCheck
            placeholder={tc.enclosuresPlaceholder}
          />
        </Field>
        <Suggestions
          items={examples.enclosures.filter((e) => !listed.some((x) => x.toLowerCase() === e.toLowerCase()))}
          onPick={(e) => change((c) => setLetter({ enclosures: [...enclosureList(c.letter.enclosures), e].join("\n") })(c))}
        />
      </div>
      <div className="space-y-1.5">
        <div className="text-[12.5px] font-medium text-ink-2">{tc.signature}</div>
        <SignatureField cv={cv} change={change} />
        <p className="text-[12px] leading-snug text-ink-3">{tc.signatureHint}</p>
      </div>
    </FormCard>
  );
}
