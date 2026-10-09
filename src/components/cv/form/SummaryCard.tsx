"use client";

import { ArrowRight, MessageSquareQuote, WandSparkles } from "lucide-react";
import { memo, useRef } from "react";
import { MenuItem, Popover } from "@/components/ui/Menu";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvFormText } from "@/i18n/messages/cvForm";
import { cn } from "@/lib/utils";
import type { CvChange } from "../types";
import { selectNextBlank } from "./edit";
import { BLANK, CV_EXAMPLES, type SummaryGoal } from "./examples";
import { AutoTextarea, FormCard, Tip } from "./ui";
import { useOfferUndo } from "./undo";

const GOALS: SummaryGoal[] = ["internship", "apprenticeship", "job"];
const MIN = 200;
const MAX = 500;
/** The meter's full width, a bit past the upper aim. */
const SCALE = 650;

/** Part 2: the short profile, with a length meter, a tip and starter texts with gaps. */
export const SummaryCard = memo(function SummaryCard({ summary, lang, change }: { summary: string; lang: Cv["lang"]; change: CvChange }) {
  const t = useMessages(cvFormText);
  const ts = t.summary;
  const offerUndo = useOfferUndo();
  const ref = useRef<HTMLTextAreaElement>(null);
  const n = summary.trim().length;
  const state = n === 0 ? null : n < MIN ? "short" : n <= MAX ? "good" : "long";
  // Gaps ("…") left over from an example: the profile isn't finished while one would still print.
  const gaps = summary.split(BLANK).length - 1;

  const insertExample = (goal: SummaryGoal) => {
    const before = summary;
    const text = CV_EXAMPLES[lang].summaries[goal];
    change((cv) => ({ ...cv, summary: text }));
    if (before.trim()) offerUndo({ message: ts.inserted, restore: (cv) => ({ ...cv, summary: before }) });
    requestAnimationFrame(() => ref.current && selectNextBlank(ref.current, 0));
  };

  return (
    <FormCard
      id="cv-part-summary"
      icon={MessageSquareQuote}
      title={ts.title}
      subtitle={gaps ? ts.gapsLeft(gaps) : n ? `${ts.count(n)} · ${state ? ts[state] : ""}` : ts.subtitle}
      done={n >= 40 && !gaps}
    >
      <Tip id="summary">{t.tips.summary}</Tip>

      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <label htmlFor="cvf-summary" className="text-[12.5px] font-medium text-ink-2">
            {ts.label}
          </label>
          <Popover
            align="end"
            label={ts.example}
            className="w-[250px]"
            trigger={(p) => (
              <button
                type="button"
                {...p}
                className="-mr-1 flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12.5px] font-medium text-blob-ink transition-colors hover:bg-blob-soft aria-expanded:bg-blob-soft max-lg:h-9"
              >
                <WandSparkles className="size-3.5" /> {ts.example}
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="px-2 pb-1.5 pt-1 text-[12px] text-ink-3">{ts.exampleHint}</div>
                {GOALS.map((goal) => (
                  <MenuItem
                    key={goal}
                    onSelect={() => {
                      close();
                      insertExample(goal);
                    }}
                  >
                    {ts.exampleFor[goal]}
                  </MenuItem>
                ))}
              </>
            )}
          </Popover>
        </div>
        <AutoTextarea
          ref={ref}
          id="cvf-summary"
          value={summary}
          onValue={(v) => change((cv) => ({ ...cv, summary: v }))}
          maxLength={1500}
          minRows={4}
          spellCheck
          placeholder={ts.placeholder}
          className="min-h-[104px]"
        />

        {/* Length meter: the aim (200–500 characters) is the tinted band. */}
        <div className="flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-hover" aria-hidden>
            <div className="absolute inset-y-0 bg-ok/20" style={{ left: `${(MIN / SCALE) * 100}%`, width: `${((MAX - MIN) / SCALE) * 100}%` }} />
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full transition-[width,background] duration-300", state === "good" ? "bg-ok" : state === "long" ? "bg-danger/70" : "bg-ink-3/60")}
              style={{ width: `${Math.min(100, (n / SCALE) * 100)}%` }}
            />
          </div>
          <div className="shrink-0 text-[12px] tabular-nums text-ink-3">
            <span className={cn(state === "good" && "font-medium text-ok", state === "long" && "font-medium text-danger")}>{ts.count(n)}</span> · {ts.aim}
          </div>
        </div>

        {gaps > 0 && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[color-mix(in_oklab,var(--danger)_8%,var(--surface))] py-1 pl-3 pr-1 text-[12.5px] text-ink-2">
            <span>
              <span className="font-medium text-danger">{ts.gapsLeft(gaps)}.</span> {t.blanksHint}
            </span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ref.current && selectNextBlank(ref.current)}
              className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 font-medium text-blob-ink transition-colors hover:bg-raised max-lg:h-9"
            >
              {t.nextBlank} <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </FormCard>
  );
});
