"use client";

import { Signature, X } from "lucide-react";
import { Switch } from "@/components/settings/primitives";
import { formatDay } from "@/cv/model";
import { useLocale, useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import { SignatureField } from "../SignatureField";
import type { CvEditorProps } from "../types";
import { setClosing } from "./edit";
import { Field, fieldClass, FormCard, TextInput, Tip } from "./ui";

/** Part 5: "Ort, Datum, Unterschrift", shown or not. */
export function ClosingCard({ cv, change }: CvEditorProps) {
  const t = useMessages(cvFormText);
  const tc = t.closing;
  const locale = useLocale();
  const c = cv.closing;
  const city = cv.person.city.trim();
  const where = c.place.trim() || city;
  const when = c.date ? formatDay(c.date, locale) : t.entry.today;
  const subtitle = !c.show ? tc.hidden : [[where, when].filter(Boolean).join(", "), c.signature ? tc.signed : ""].filter(Boolean).join(" · ");

  return (
    <FormCard
      id="cv-part-closing"
      icon={Signature}
      title={tc.title}
      subtitle={subtitle}
      done={c.show && Boolean(c.signature)}
      muted={!c.show}
      actions={
        <span className="mr-1 flex items-center">
          <Switch checked={c.show} onChange={(show) => change(setClosing({ show }))} label={tc.show} />
        </span>
      }
    >
      <Tip id="closing">{t.tips.closing}</Tip>
      <div className="grid grid-cols-2 gap-2.5">
        <Field label={tc.place} htmlFor="cvf-closing-place" hint={tc.placeHint(city)}>
          <TextInput id="cvf-closing-place" spellCheck={false} value={c.place} onValue={(place) => change(setClosing({ place }))} maxLength={80} placeholder={city} />
        </Field>
        <Field
          label={tc.date}
          htmlFor="cvf-closing-date"
          hint={tc.dateHint}
          action={
            c.date ? (
              <button
                type="button"
                onClick={() => change(setClosing({ date: "" }))}
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
            id="cvf-closing-date"
            type="date"
            value={c.date}
            onChange={(e) => change(setClosing({ date: e.target.value }))}
            className={cn(fieldClass, "min-w-0 appearance-none", !c.date && "text-ink-3")}
          />
        </Field>
      </div>
      <SignatureField cv={cv} change={change} />
    </FormCard>
  );
}
