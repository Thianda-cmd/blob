"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { interestList } from "@/cv/model";
import type { Cv, CvInterestSection } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import type { CvChange } from "../types";
import { updateSection } from "./edit";
import { CV_EXAMPLES } from "./examples";
import { Suggestions } from "./ui";
import { useOfferUndo } from "./undo";

const MAX_TEXT = 1000;
const same = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
const join = (tags: string[]) => tags.join(", ");

/**
 * Hobbies as tags: Enter or a comma adds one, × removes it, Backspace in the empty field takes the
 * last one back for editing. Stored as the comma-separated text the CV prints.
 */
export function InterestTags({ section, lang, change }: { section: CvInterestSection; lang: Cv["lang"]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const ti = t.interests;
  const offerUndo = useOfferUndo();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const sid = section.id;
  const tags = interestList(section.text);
  const inputId = `cvf-${sid}-tags`;
  // Stable keys even if a hobby appears twice in hand-typed text.
  const keys = tags.map((tag, i) => `${tag.toLocaleLowerCase()}#${tags.slice(0, i).filter((other) => same(other, tag)).length}`);

  const setText = (fn: (tags: string[]) => string[]) =>
    change(updateSection<CvInterestSection>(sid, (s) => {
      const text = join(fn(interestList(s.text)));
      return text.length > MAX_TEXT ? s : { ...s, text };
    }));

  const addTags = (raw: string[]) => {
    const fresh = raw.map((r) => r.trim()).filter(Boolean);
    if (fresh.length) setText((list) => [...list, ...fresh.filter((f, i) => !list.some((l) => same(l, f)) && fresh.findIndex((g) => same(g, f)) === i)]);
  };

  const removeTag = (i: number) => {
    const tag = tags[i];
    setText((list) => list.filter((_, j) => j !== i));
    offerUndo({ message: t.removed(tag), restore: (cv) => updateSection<CvInterestSection>(sid, (s) => ({ ...s, text: join([...interestList(s.text).slice(0, i), tag, ...interestList(s.text).slice(i)]) }))(cv) });
  };

  const onValue = (value: string) => {
    // Typing or pasting a comma (or semicolon) turns everything before it into tags.
    const parts = value.split(/[,;\n]/);
    if (parts.length > 1) {
      addTags(parts.slice(0, -1));
      setDraft(parts[parts.length - 1].trimStart());
    } else setDraft(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      addTags([draft]);
      setDraft("");
    } else if (e.key === "Backspace" && !draft && tags.length && e.currentTarget.selectionStart === 0) {
      e.preventDefault();
      const last = tags[tags.length - 1];
      setText((list) => list.slice(0, -1));
      setDraft(last);
    }
  };

  return (
    <div className="space-y-2.5">
      <label htmlFor={inputId} className="block text-[12.5px] font-medium text-ink-2">
        {ti.label}
      </label>
      <div
        onClick={(e) => e.target === e.currentTarget && inputRef.current?.focus()}
        className="flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-line bg-raised px-1.5 py-1.5 shadow-[inset_0_1px_1px_rgb(0_0_0/0.03)] transition-[border,box-shadow] focus-within:border-blob focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--blob)_18%,transparent)] hover:border-line-2 max-lg:min-h-12"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {tags.map((tag, i) => (
            <motion.span
              key={keys[i]}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 600, damping: 32 }}
              className="inline-flex h-7 max-w-full items-center gap-0.5 rounded-full bg-blob-soft pl-2.5 pr-0.5 text-[13px] font-medium text-blob-ink max-lg:h-8 max-lg:text-[14px]"
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                onClick={() => removeTag(i)}
                aria-label={ti.remove(tag)}
                title={ti.remove(tag)}
                className="grid size-6 shrink-0 place-items-center rounded-full transition-colors hover:bg-blob/15 max-lg:size-7"
              >
                <X className="size-3" strokeWidth={2.4} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => onValue(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (!draft.trim()) return;
            addTags([draft]);
            setDraft("");
          }}
          maxLength={80}
          autoComplete="off"
          enterKeyHint="enter"
          placeholder={tags.length ? ti.placeholderMore : ti.placeholder}
          className="h-7 min-w-[9rem] flex-1 bg-transparent px-1.5 text-[14px] text-ink outline-none placeholder:text-ink-3/80 max-lg:h-8 max-lg:text-[16px]"
        />
      </div>
      <p className="text-[12px] text-ink-3">{ti.hint}</p>
      <Suggestions items={CV_EXAMPLES[lang].interests.filter((idea) => !tags.some((tag) => same(tag, idea)))} limit={8} onPick={(idea) => addTags([idea])} />
    </div>
  );
}
