"use client";

import { Check, ChevronRight, TriangleAlert } from "lucide-react";
import { cvChecklist, cvProgress, type CvCheck } from "@/cv/model";
import type { Cv } from "@/cv/types";
import { useMessages } from "@/i18n/client";
import { cvEditorText } from "@/i18n/messages/cvEditor";
import { cn } from "@/lib/utils";
import { ProgressRing } from "./ProgressRing";

/** Something about the length that needs fixing before the CV is ready (cut off, too many pages). */
export type LengthIssue = { text: string; onShow?: () => void };

/** What a good school CV has, how far this one is, and a jump to each missing part. */
export function Checklist({ cv, onJump, issue }: { cv: Cv; onJump: (check: CvCheck) => void; issue?: LengthIssue | null }) {
  const all = useMessages(cvEditorText);
  const t = all.check;
  const items = cvChecklist(cv);
  const progress = cvProgress(cv);
  const left = items.filter((c) => !c.optional && !c.done).length;
  const groups = [
    { title: t.required, items: items.filter((c) => !c.optional) },
    { title: t.extras, items: items.filter((c) => c.optional) },
  ];

  return (
    <div className="pb-6">
      <div className="flex items-center gap-4 border-b border-line px-4 py-4">
        <ProgressRing value={progress} size={64} stroke={6} label={t.ring(progress)}>
          <span className="font-display text-[16px] font-semibold tabular-nums tracking-[-0.02em] text-ink" aria-hidden>
            {progress}
            <span className="text-[11px] font-medium text-ink-3">%</span>
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <div className="font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">{issue && !left ? t.stageLength : t.stage(progress)}</div>
          <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{left ? t.left(left) : issue ? t.fixLength : t.allDone}</p>
        </div>
      </div>

      {/* Complete is not ready while something is cut off or the CV runs to three pages and more. */}
      {issue && (
        <div role="status" className="mx-3 mt-3 flex items-start gap-2.5 rounded-lg bg-danger/10 px-3 py-2.5 text-[12.5px] leading-snug text-ink">
          <TriangleAlert className="mt-px size-4 shrink-0 text-danger" aria-hidden />
          <span className="min-w-0 flex-1">{issue.text}</span>
          {issue.onShow && (
            <button type="button" onClick={issue.onShow} className="-my-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-medium text-blob-ink transition-colors hover:bg-blob-soft">
              {all.tooLongShow}
            </button>
          )}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.title} className="px-2 pt-3">
          <h3 className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">{g.title}</h3>
          <ul className="grid gap-0.5">
            {g.items.map((c) => {
              const item = t.items[c.id];
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onJump(c.id)}
                    className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-hover"
                  >
                    <span
                      className={cn(
                        "mt-px grid size-[18px] shrink-0 place-items-center rounded-full transition-colors",
                        c.done ? "bg-ok text-white" : "border-[1.5px] border-dashed border-ink-3/60 group-hover:border-blob",
                      )}
                      aria-hidden
                    >
                      {c.done && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("flex items-center gap-1.5 text-[13.5px] leading-snug", c.done ? "text-ink-3" : "font-medium text-ink")}>
                        {item.label}
                        {c.done && <span className="sr-only">({t.done})</span>}
                      </span>
                      {/* Tips only for what is still missing: the list stays short as it fills up. */}
                      {!c.done && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{item.tip}</span>}
                    </span>
                    <ChevronRight className="mt-0.5 size-4 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="px-4 pt-3 text-[12px] text-ink-3">{t.hint}</p>
    </div>
  );
}
