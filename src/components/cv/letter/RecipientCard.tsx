"use client";

import { Building2 } from "lucide-react";
import { memo } from "react";
import { letterAddress, letterChecklist, letterGreeting } from "@/cv/model";
import type { Cv, CvSalutation } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cvLetterText } from "@/i18n/messages/cvLetter";
import { Segmented } from "../editor/Segmented";
import { setLetter } from "../form/edit";
import { Field, FormCard, TextInput, Tip } from "../form/ui";
import type { CvChange } from "../types";

const SALUTATIONS: CvSalutation[] = ["ms", "mr", "neutral"];

/** Letter part 1: the company and the person it goes to, and how the letter greets them. */
export const RecipientCard = memo(function RecipientCard({ cv, change }: { cv: Cv; change: CvChange }) {
  const t = useMessages(cvLetterText);
  const tr = t.recipient;
  const optional = useMessages(cvFormText).optional;
  const l = cv.letter;
  const address = letterAddress(cv);
  const named = Boolean(l.contact.trim());

  return (
    <FormCard
      id="cv-letter-recipient"
      icon={Building2}
      title={tr.title}
      subtitle={address.length ? address.join(", ") : tr.empty}
      done={letterChecklist(cv).recipient}
    >
      <Tip id="letter-recipient">{t.tips.recipient}</Tip>
      <Field label={tr.company} htmlFor="cvl-company">
        <TextInput id="cvl-company" value={l.company} onValue={(company) => change(setLetter({ company }))} maxLength={120} placeholder={tr.companyPlaceholder} />
      </Field>
      <Field label={`${tr.department} (${optional})`} htmlFor="cvl-department">
        <TextInput id="cvl-department" value={l.department} onValue={(department) => change(setLetter({ department }))} maxLength={120} placeholder={tr.departmentPlaceholder} />
      </Field>
      <div className="space-y-2">
        <div className="grid gap-2.5 @min-[460px]:grid-cols-[minmax(0,1fr)_auto]">
          <Field label={tr.contact} htmlFor="cvl-contact">
            <TextInput id="cvl-contact" spellCheck={false} value={l.contact} onValue={(contact) => change(setLetter({ contact }))} maxLength={120} placeholder={tr.contactPlaceholder} />
          </Field>
          <Field label={tr.salutation}>
            <Segmented
              label={tr.salutation}
              size="md"
              equal={false}
              value={l.salutation}
              onChange={(salutation) => change(setLetter({ salutation }))}
              disabled={!named}
              options={SALUTATIONS.map((s) => ({ id: s, label: tr.salutations[s], title: tr.salutationTitles[s] }))}
            />
          </Field>
        </div>
        <p className="text-[12px] leading-snug text-ink-3">
          {named ? tr.greeting(letterGreeting(cv)) : `${tr.contactHint} ${tr.greeting(letterGreeting(cv))}`}
        </p>
      </div>
      <Field label={tr.street} htmlFor="cvl-street">
        <TextInput id="cvl-street" value={l.street} onValue={(street) => change(setLetter({ street }))} maxLength={120} />
      </Field>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2.5">
        <Field label={tr.postalCode} htmlFor="cvl-postal">
          <TextInput id="cvl-postal" inputMode="numeric" spellCheck={false} value={l.postalCode} onValue={(postalCode) => change(setLetter({ postalCode }))} maxLength={20} />
        </Field>
        <Field label={tr.city} htmlFor="cvl-city">
          <TextInput id="cvl-city" value={l.city} onValue={(city) => change(setLetter({ city }))} maxLength={80} />
        </Field>
      </div>
    </FormCard>
  );
});
