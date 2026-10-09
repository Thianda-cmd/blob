"use client";

import { ArrowDown, ArrowUp, ChevronDown, Copy, List, Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { cvId, formatRange, newEntry } from "@/cv/model";
import type { Cv, CvEntry, CvEntrySection } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import type { CvChange } from "../types";
import { blankEntry, focusSoon, insertAt, move, updateEntry, updateSection } from "./edit";
import { AddButton, AutoTextarea, Field, fieldClass, MonthYear, MoreMenu, TextInput } from "./ui";
import { useOfferUndo } from "./undo";

const MAX_ENTRIES = 40;

/** The entries of a timeline section (school, internships, jobs…): each one folds into a summary line. */
export function EntryList({ section, lang, change }: { section: CvEntrySection; lang: Cv["lang"]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const words = t.entryWords[section.kind];
  const offerUndo = useOfferUndo();
  // Entries with something in them start folded; blank ones (just added) start open.
  const [open, setOpen] = useState(() => new Set(section.entries.filter(blankEntry).map((e) => e.id)));
  const entries = section.entries;
  const sid = section.id;

  const setEntries = (fn: (entries: CvEntry[]) => CvEntry[]) => change(updateSection<CvEntrySection>(sid, (s) => ({ ...s, entries: fn(s.entries) })));
  const setEntryOpen = (id: string, value = true) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = () => {
    const entry = newEntry();
    setEntries((list) => [...list, entry]);
    setEntryOpen(entry.id);
    focusSoon(`cvf-${entry.id}-name`);
  };

  const duplicate = (i: number) => {
    const copy = { ...entries[i], id: cvId() };
    setEntries((list) => insertAt(list, i + 1, copy));
    setEntryOpen(copy.id);
    focusSoon(`cvf-${copy.id}-name`, { select: true });
  };

  const remove = (i: number) => {
    const entry = entries[i];
    setEntries((list) => list.filter((e) => e.id !== entry.id));
    if (!blankEntry(entry))
      offerUndo({
        message: t.removed(entry.title.trim() || entry.org.trim() || t.entry.untitled),
        restore: (cv) => updateSection<CvEntrySection>(sid, (s) => ({ ...s, entries: insertAt(s.entries, Math.min(i, s.entries.length), entry) }))(cv),
      });
  };

  if (!entries.length)
    return (
      <div className="rounded-xl border border-dashed border-line-2 px-4 py-4 text-center">
        <p className="text-balance text-[13.5px] text-ink-2">{words.empty}</p>
        <button
          type="button"
          onClick={add}
          data-cv-add
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blob-soft px-3.5 text-[13.5px] font-medium text-blob-ink transition-[background,transform] hover:bg-blob/15 active:scale-[0.97] max-lg:h-11 max-lg:px-4"
        >
          <Plus className="size-4" /> {words.add}
        </button>
      </div>
    );

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {entries.map((entry, i) => (
          <motion.div
            key={entry.id}
            layout="position"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
            transition={{ type: "spring", stiffness: 500, damping: 38 }}
          >
            <EntryItem
              entry={entry}
              section={section}
              lang={lang}
              first={i === 0}
              last={i === entries.length - 1}
              open={open.has(entry.id)}
              onToggle={() => setEntryOpen(entry.id, !open.has(entry.id))}
              onPatch={(patch) => change(updateEntry(sid, entry.id, patch))}
              onMove={(by) => setEntries((list) => move(list, list.findIndex((e) => e.id === entry.id), by))}
              onDuplicate={() => duplicate(i)}
              onRemove={() => remove(i)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      <AddButton onClick={add} disabled={entries.length >= MAX_ENTRIES}>
        {words.add}
      </AddButton>
    </div>
  );
}

function EntryItem({
  entry: e,
  section,
  lang,
  first,
  last,
  open,
  onToggle,
  onPatch,
  onMove,
  onDuplicate,
  onRemove,
}: {
  entry: CvEntry;
  section: CvEntrySection;
  lang: Cv["lang"];
  first: boolean;
  last: boolean;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: Partial<CvEntry>) => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const t = useMessages(cvFormText);
  const te = t.entry;
  const words = t.entryWords[section.kind];
  const textRef = useRef<HTMLTextAreaElement>(null);
  const single = section.kind === "awards";
  const range = single ? formatRange({ start: e.start, end: "", current: false }, lang, "numeric") : formatRange(e, lang, "numeric");
  const heading = e.title.trim() || e.org.trim();
  const meta = [e.title.trim() ? e.org.trim() : "", range].filter(Boolean).join(" · ");
  const endBeforeStart = !single && !e.current && e.start && e.end && compareDates(e.end, e.start) < 0;
  const id = (field: string) => `cvf-${e.id}-${field}`;

  const addBullet = () => {
    const text = e.text;
    const next = !text.trim() ? "- " : text.endsWith("\n") ? `${text}- ` : `${text}\n- `;
    onPatch({ text: next });
    requestAnimationFrame(() => {
      const el = textRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  return (
    <div className={cn("rounded-xl border transition-colors", open ? "border-line-2 bg-surface" : "border-line bg-surface/70 hover:border-line-2")}>
      <div className="flex items-center gap-0.5 pr-1">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-12 min-w-0 flex-1 flex-col justify-center py-2 pl-3 pr-1 text-left">
          <span className={cn("block w-full truncate text-[13.5px] font-medium", heading ? "text-ink" : "text-ink-3")}>{heading || te.untitled}</span>
          {meta && <span className="block w-full truncate text-[12px] text-ink-3">{meta}</span>}
        </button>
        <MoreMenu label={te.options} size="xs">
          {(close) => {
            const run = (fn: () => void) => () => {
              close();
              fn();
            };
            return (
              <>
                <MenuItem icon={<Copy />} onSelect={run(onDuplicate)}>
                  {te.duplicate}
                </MenuItem>
                <MenuItem icon={<ArrowUp />} onSelect={run(() => onMove(-1))} disabled={first}>
                  {te.moveUp}
                </MenuItem>
                <MenuItem icon={<ArrowDown />} onSelect={run(() => onMove(1))} disabled={last}>
                  {te.moveDown}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={run(onRemove)}>
                  {te.remove}
                </MenuItem>
              </>
            );
          }}
        </MoreMenu>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? te.close : te.open}
          title={open ? te.close : te.open}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink max-lg:size-9"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200", !open && "-rotate-90")} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t border-line px-3 pb-3.5 pt-3">
              <Field label={words.title} htmlFor={id("name")}>
                <AutoTextarea singleLine id={id("name")} value={e.title} onValue={(v) => onPatch({ title: v })} maxLength={200} spellCheck placeholder={words.titlePlaceholder} />
              </Field>
              <div className="grid gap-2.5 @min-[400px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                <Field label={words.org} htmlFor={id("org")}>
                  <TextInput id={id("org")} spellCheck={false} value={e.org} onValue={(v) => onPatch({ org: v })} maxLength={200} placeholder={words.orgPlaceholder} />
                </Field>
                <Field label={te.place} htmlFor={id("place")}>
                  <TextInput id={id("place")} spellCheck={false} value={e.place} onValue={(v) => onPatch({ place: v })} maxLength={120} placeholder={te.placePlaceholder} />
                </Field>
              </div>

              {single ? (
                <Field label={te.date} htmlFor={id("start-month")} className="max-w-[16rem]">
                  <MonthYear idPrefix={id("start")} label={te.date} value={e.start} onValue={(v) => onPatch({ start: v })} />
                </Field>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-2.5 @min-[400px]:grid-cols-2">
                    <Field label={te.from} htmlFor={id("start-month")}>
                      <MonthYear idPrefix={id("start")} label={te.from} value={e.start} onValue={(v) => onPatch({ start: v })} />
                    </Field>
                    <Field label={te.to} htmlFor={id("end-month")}>
                      {e.current ? (
                        <div className={cn(fieldClass, "flex items-center bg-hover/50 text-ink-2")}>{te.today}</div>
                      ) : (
                        <MonthYear idPrefix={id("end")} label={te.to} value={e.end} onValue={(v) => onPatch({ end: v })} />
                      )}
                    </Field>
                  </div>
                  <label className="flex w-fit cursor-pointer select-none items-center gap-2 py-1 text-[13px] text-ink-2 max-lg:text-[14px]">
                    <input
                      type="checkbox"
                      checked={e.current}
                      onChange={(ev) => onPatch({ current: ev.target.checked })}
                      className="size-4 shrink-0 cursor-pointer rounded accent-blob max-lg:size-5"
                    />
                    {te.current}
                  </label>
                  {endBeforeStart && <p className="text-[12.5px] text-danger">{te.endBeforeStart}</p>}
                </div>
              )}

              <Field
                label={te.details}
                htmlFor={id("text")}
                hint={
                  <span className="flex items-start justify-between gap-2">
                    <span className="pt-1">{te.bulletHint}</span>
                    <button
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={addBullet}
                      className="-mr-1 flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink max-lg:h-9"
                    >
                      <List className="size-3.5" /> {te.addBullet}
                    </button>
                  </span>
                }
              >
                <AutoTextarea
                  ref={textRef}
                  id={id("text")}
                  value={e.text}
                  onValue={(v) => onPatch({ text: v })}
                  maxLength={3000}
                  minRows={2}
                  placeholder={words.textPlaceholder}
                  className="min-h-[64px]"
                />
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compares "YYYY" / "YYYY-MM" dates; a year alone counts as its whole year (never "before" a month in it). */
function compareDates(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay - by;
  if (!am || !bm) return 0;
  return am - bm;
}
