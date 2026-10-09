"use client";

import { AtSign, FileText, History, Lightbulb, Quote, Sparkles, SpellCheck } from "lucide-react";
import { useMessages } from "@/i18n/client";
import { cvHomeText } from "@/i18n/messages/cvHome";
import { cn } from "@/lib/utils";

// One icon per tip, in the order of cvHomeText.tips.
const ICONS = [FileText, History, Sparkles, Quote, AtSign, SpellCheck];

/** "How to write a good CV": six short tips for school students. A column beside the CVs on wide screens. */
export function CvTips({ className }: { className?: string }) {
  const t = useMessages(cvHomeText);
  return (
    <section className={cn("rounded-2xl border border-line bg-raised p-4 shadow-card sm:p-5", className)} aria-labelledby="cv-tips-title">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-blob-soft text-blob-ink">
          <Lightbulb className="size-4" />
        </span>
        <h2 id="cv-tips-title" className="font-display text-[16px] font-semibold tracking-[-0.01em]">
          {t.tipsTitle}
        </h2>
      </div>
      <p className="mt-1.5 text-[12.5px] text-ink-3">{t.tipsIntro}</p>
      <ol className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1">
        {t.tips.map((tip, i) => {
          const Icon = ICONS[i] ?? Lightbulb;
          return (
            <li key={tip.title} className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-surface text-ink-2">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium leading-snug text-ink">{tip.title}</div>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{tip.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
