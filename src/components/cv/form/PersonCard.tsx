"use client";

import { ArrowRight, Link2, Plus, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import { cvId, fullName } from "@/cv/model";
import type { CvLink, CvPerson } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import { PhotoField } from "../PhotoField";
import type { CvEditorProps } from "../types";
import { focusSoon, insertAt, selectNextBlank, setPerson } from "./edit";
import { BLANK, CV_EXAMPLES } from "./examples";
import { AutoTextarea, Field, fieldClass, FormCard, Group, Suggestions, TextInput, Tip } from "./ui";
import { useOfferUndo } from "./undo";

const MAX_LINKS = 6;
const THIS_YEAR = new Date().getFullYear();

/** Part 1: photo, name, headline, contact, address, personal details and links. */
export function PersonCard({ cv, change }: CvEditorProps) {
  const t = useMessages(cvFormText);
  const tp = t.person;
  const p = cv.person;
  const offerUndo = useOfferUndo();
  const headlineRef = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<CvPerson>) => change(setPerson(patch));
  const name = fullName(p);
  // A headline idea whose "…" hasn't been filled in yet would print as is.
  const headlineGaps = p.headline.includes(BLANK);

  const pickHeadline = (text: string) => {
    set({ headline: text });
    // The idea has a gap ("… als …"): select it, so typing fills it in.
    requestAnimationFrame(() => {
      const el = headlineRef.current;
      if (el && !selectNextBlank(el, 0)) {
        el.focus();
        el.setSelectionRange(text.length, text.length);
      }
    });
  };

  const addLink = () => {
    const id = cvId();
    change((cv) => setPerson({ links: [...cv.person.links, { id, label: "", url: "" }] })(cv));
    focusSoon(`cvf-link-${id}-label`);
  };
  const setLink = (id: string, patch: Partial<CvLink>) =>
    change((cv) => setPerson({ links: cv.person.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })(cv));
  const removeLink = (i: number) => {
    const link = p.links[i];
    change((cv) => setPerson({ links: cv.person.links.filter((l) => l.id !== link.id) })(cv));
    if (link.label.trim() || link.url.trim())
      offerUndo({
        message: t.removed(link.label.trim() || link.url.trim()),
        restore: (cv) => setPerson({ links: insertAt(cv.person.links, Math.min(i, cv.person.links.length), link) })(cv),
      });
  };

  return (
    <FormCard id="cv-part-person" icon={UserRound} title={tp.title} subtitle={name || tp.subtitle} done={Boolean(p.firstName.trim() && p.lastName.trim() && (p.email.trim() || p.phone.trim()) && !headlineGaps)}>
      <Tip id="person">{t.tips.person}</Tip>

      <PhotoField cv={cv} change={change} />

      <Group title={tp.groupName}>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={tp.firstName} htmlFor="cvf-firstName">
            <TextInput id="cvf-firstName" spellCheck={false} value={p.firstName} onValue={(v) => set({ firstName: v })} maxLength={80} autoComplete="given-name" autoCapitalize="words" placeholder={tp.firstNamePlaceholder} />
          </Field>
          <Field label={tp.lastName} htmlFor="cvf-lastName">
            <TextInput id="cvf-lastName" spellCheck={false} value={p.lastName} onValue={(v) => set({ lastName: v })} maxLength={80} autoComplete="family-name" autoCapitalize="words" placeholder={tp.lastNamePlaceholder} />
          </Field>
        </div>
        <Field
          label={tp.headline}
          htmlFor="cvf-headline"
          hint={
            headlineGaps ? (
              <span className="flex items-center justify-between gap-2 rounded-lg bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] py-1 pl-3 pr-1 text-[12.5px] text-ink-2">
                <span>{t.blanksHint}</span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => headlineRef.current && selectNextBlank(headlineRef.current)}
                  className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-blob-ink transition-colors hover:bg-raised max-lg:h-9"
                >
                  {t.nextBlank} <ArrowRight className="size-3.5" />
                </button>
              </span>
            ) : !p.headline.trim() ? (
              tp.headlineHint
            ) : undefined
          }
        >
          <AutoTextarea ref={headlineRef} singleLine id="cvf-headline" value={p.headline} onValue={(v) => set({ headline: v })} maxLength={160} spellCheck placeholder={tp.headlinePlaceholder} />
        </Field>
        {!p.headline.trim() && <Suggestions items={CV_EXAMPLES[cv.lang].headlines} onPick={pickHeadline} />}
      </Group>

      <Group title={tp.groupContact}>
        <div className="grid gap-2.5 @min-[400px]:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
          <Field label={tp.email} htmlFor="cvf-email">
            <TextInput id="cvf-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={p.email} onValue={(v) => set({ email: v })} maxLength={120} placeholder={tp.emailPlaceholder} />
          </Field>
          <Field label={tp.phone} htmlFor="cvf-phone">
            <TextInput id="cvf-phone" type="tel" inputMode="tel" autoComplete="tel" spellCheck={false} value={p.phone} onValue={(v) => set({ phone: v })} maxLength={60} placeholder={tp.phonePlaceholder} />
          </Field>
        </div>
      </Group>

      <Group title={tp.groupAddress}>
        <Field label={tp.street} htmlFor="cvf-street">
          <TextInput id="cvf-street" spellCheck={false} autoComplete="address-line1" value={p.street} onValue={(v) => set({ street: v })} maxLength={120} placeholder={tp.streetPlaceholder} />
        </Field>
        <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2.5">
          <Field label={tp.postalCode} htmlFor="cvf-postalCode">
            <TextInput
              id="cvf-postalCode"
              autoComplete="postal-code"
              // German postcodes are five digits; British ones have letters (SW1A 1AA).
              inputMode={cv.lang === "de" ? "numeric" : "text"}
              autoCapitalize="characters"
              spellCheck={false}
              value={p.postalCode}
              onValue={(v) => set({ postalCode: v })}
              maxLength={20}
              placeholder={tp.postalCodePlaceholder}
            />
          </Field>
          <Field label={tp.city} htmlFor="cvf-city">
            <TextInput id="cvf-city" spellCheck={false} autoComplete="address-level2" value={p.city} onValue={(v) => set({ city: v })} maxLength={80} placeholder={tp.cityPlaceholder} />
          </Field>
        </div>
      </Group>

      <Group title={tp.groupPersonal} optional note={tp.personalNote}>
        <div className="grid grid-cols-2 gap-2.5">
          <Field label={tp.birthDate} htmlFor="cvf-birthDate">
            <input
              id="cvf-birthDate"
              type="date"
              autoComplete="bday"
              value={p.birthDate}
              min="1950-01-01"
              max={`${THIS_YEAR}-12-31`}
              onChange={(e) => set({ birthDate: e.target.value })}
              className={cn(fieldClass, "min-w-0 appearance-none", !p.birthDate && "text-ink-3")}
            />
          </Field>
          <Field label={tp.birthPlace} htmlFor="cvf-birthPlace">
            <TextInput id="cvf-birthPlace" spellCheck={false} value={p.birthPlace} onValue={(v) => set({ birthPlace: v })} maxLength={80} placeholder={tp.birthPlacePlaceholder} />
          </Field>
        </div>
        <Field label={tp.nationality} htmlFor="cvf-nationality">
          <TextInput id="cvf-nationality" value={p.nationality} onValue={(v) => set({ nationality: v })} maxLength={80} placeholder={tp.nationalityPlaceholder} />
        </Field>
      </Group>

      <Group title={tp.groupLinks} optional note={tp.linksNote}>
        <AnimatePresence initial={false}>
          {p.links.map((link, i) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-1.5 p-px">
                <Link2 className="size-4 shrink-0 text-ink-3 max-[359px]:hidden" />
                <TextInput
                  id={`cvf-link-${link.id}-label`}
                  aria-label={`${tp.link} ${i + 1}: ${tp.linkLabel}`}
                  value={link.label}
                  onValue={(v) => setLink(link.id, { label: v })}
                  maxLength={60}
                  spellCheck={false}
                  placeholder={tp.linkLabelPlaceholder}
                  className="w-[38%] shrink-0"
                />
                <TextInput
                  id={`cvf-link-${link.id}-url`}
                  aria-label={`${tp.link} ${i + 1}: ${tp.linkUrl}`}
                  inputMode="url"
                  autoComplete="url"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={link.url}
                  onValue={(v) => setLink(link.id, { url: v })}
                  maxLength={300}
                  placeholder={tp.linkUrlPlaceholder}
                  className="min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeLink(i)}
                  aria-label={tp.removeLink}
                  title={tp.removeLink}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-danger max-lg:size-10"
                >
                  <X className="size-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {p.links.length < MAX_LINKS && (
          <button
            type="button"
            onClick={addLink}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink max-lg:h-10"
          >
            <Plus className="size-4" /> {tp.addLink}
          </button>
        )}
      </Group>
    </FormCard>
  );
}
