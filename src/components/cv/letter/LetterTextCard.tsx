"use client";

import { ArrowRight, Lightbulb, PenLine, TriangleAlert } from "lucide-react";
import { memo, useRef } from "react";
import { MenuItem, Popover } from "@/components/ui/Menu";
import { LETTER_PARTS, letterChecklist, letterWords, type LetterPart } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cvLetterText } from "@/i18n/messages/cvLetter";
import { cn } from "@/lib/utils";
import { selectNextBlank, setLetter } from "../form/edit";
import { BLANK, CV_EXAMPLES, type SummaryGoal } from "../form/examples";
import { AutoTextarea, Field, FormCard, Tip } from "../form/ui";
import { useOfferUndo } from "../form/undo";
import type { CvChange } from "../types";

const GOALS: SummaryGoal[] = ["internship", "apprenticeship", "job"];
const MAX: Record<LetterPart, number> = { opening: 2000, body: 4000, ending: 1500 };
/** The aim, in words: a school application letter that fits on one page. */
const MIN_WORDS = 150;
const MAX_WORDS = 350;

/**
 * Letter part 3: the text in three parts (opening, main part, closing), each with what belongs in
 * it, starter texts with gaps for an internship, an apprenticeship or a side job, a word count and
 * a warning when the letter no longer fits on one page.
 */
export const LetterTextCard = memo(function LetterTextCard({ cv, change, pages }: { cv: Cv; change: CvChange; pages: number | null }) {
  const t = useMessages(cvLetterText);
  const tt = t.text;
  const tf = useMessages(cvFormText);
  const offerUndo = useOfferUndo();
  const l = cv.letter;
  const refs = {
    opening: useRef<HTMLTextAreaElement>(null),
    body: useRef<HTMLTextAreaElement>(null),
    ending: useRef<HTMLTextAreaElement>(null),
  };
  const words = letterWords(l);
  const gaps = LETTER_PARTS.reduce((n, p) => n + l[p].split(BLANK).length - 1, 0);
  const state = words === 0 ? null : words < MIN_WORDS ? "short" : words <= MAX_WORDS ? "good" : "long";

  const insertExample = (goal: SummaryGoal) => {
    const before = { opening: l.opening, body: l.body, ending: l.ending };
    change(setLetter(CV_EXAMPLES[cv.lang].letter.parts[goal]));
    if (LETTER_PARTS.some((p) => before[p].trim())) offerUndo({ message: tt.inserted, restore: setLetter(before) });
    requestAnimationFrame(() => refs.opening.current && selectNextBlank(refs.opening.current, 0));
  };

  /** The next "…": after the caret in the part being written, then in the parts after it (round to the top). */
  const nextGap = () => {
    const els = LETTER_PARTS.map((p) => refs[p].current);
    const i = els.findIndex((el) => el && el === document.activeElement);
    const focused = els[i];
    if (focused && focused.value.indexOf(BLANK, focused.selectionEnd ?? 0) >= 0) return void selectNextBlank(focused);
    for (let k = 1; k <= els.length; k++) {
      const el = els[(i + k + els.length) % els.length];
      if (el?.value.includes(BLANK)) return void selectNextBlank(el, 0);
    }
  };

  return (
    <FormCard
      id="cv-letter-text"
      icon={PenLine}
      title={tt.title}
      subtitle={gaps ? tt.gapsLeft(gaps) : words ? `${tt.words(words)} · ${tt.aim}` : tt.empty}
      done={letterChecklist(cv).text}
    >
      <Tip id="letter-text">{t.tips.text}</Tip>

      {pages !== null && pages > 1 && (
        <p role="status" className="flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] leading-snug text-ink">
          <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
          <span>{tt.tooLong(pages)}</span>
        </p>
      )}

      <div className="flex justify-end">
        <Popover
          align="end"
          label={tt.example}
          className="w-[250px]"
          trigger={(p) => (
            <button
              type="button"
              {...p}
              className="-my-1 -mr-1 flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-blob-ink transition-colors hover:bg-blob-soft aria-expanded:bg-blob-soft max-lg:h-9"
            >
              <Lightbulb className="size-3.5" /> {tt.example}
            </button>
          )}
        >
          {(close) => (
            <>
              <div className="px-2 pb-1.5 pt-1 text-[12px] text-ink-3">{tt.exampleHint}</div>
              {GOALS.map((goal) => (
                <MenuItem
                  key={goal}
                  onSelect={() => {
                    close();
                    insertExample(goal);
                  }}
                >
                  {tt.exampleFor[goal]}
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
      </div>

      {LETTER_PARTS.map((part) => (
        <Field key={part} label={tt.parts[part]} htmlFor={`cvl-${part}`} hint={tt.hints[part]}>
          <AutoTextarea
            ref={refs[part]}
            id={`cvl-${part}`}
            value={l[part]}
            onValue={(v) => change(setLetter({ [part]: v }))}
            maxLength={MAX[part]}
            minRows={part === "body" ? 6 : 3}
            spellCheck
            placeholder={tt.placeholders[part]}
          />
        </Field>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] tabular-nums text-ink-3">
        <span>
          <span className={cn(state === "good" && "font-medium text-ok", state === "long" && "font-medium text-danger")}>{tt.words(words)}</span> · {tt.aim}
        </span>
      </div>

      {gaps > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] py-1 pl-3 pr-1 text-[12.5px] text-ink-2">
          <span>
            <span className="font-medium text-danger">{tt.gapsLeft(gaps)}.</span> {tf.blanksHint}
          </span>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={nextGap}
            className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-blob-ink transition-colors hover:bg-raised max-lg:h-9"
          >
            {tf.nextBlank} <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}
    </FormCard>
  );
});
